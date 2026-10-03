import { Router, type Request } from "express";
import express from "express";
import { and, count, desc, eq, isNotNull } from "drizzle-orm";

import { getDb } from "../db/client.js";
import {
  importBatches,
  importRowNorm,
  importSourceRows,
  normalizationRules,
  IMPORT_BLOCKED_FIELD_KEYS,
  type ImportBatch,
} from "../../shared/schema.js";
import {
  importBatchQuerySchema,
  importDuplicatesQuerySchema,
  importPreviewQuerySchema,
  importRuleConfirmSchema,
  IMPORT_UPLOAD_FILENAME_HEADER,
  IMPORT_UPLOAD_MAX_BYTES,
} from "../../shared/import.js";
import { PRIVILEGED_ROLES } from "../../shared/roles.js";
import { requireAdmin, requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors.js";
import {
  checksumBuffer,
  computeCompleteness,
  groupDuplicateCandidates,
  NORMALIZATION_RULES,
  NORMALIZATION_VERSION,
  normalizeMemberRow,
  parseWorkbookFile,
  withTempWorkbook,
  type CapturedMemberRow,
  type NormalizationOutcome,
  type ParsedWorkbook,
} from "../lib/missionImport.js";

/**
 * Mission import pipeline API — Phase 2 (L1 raw + L2 normalized).
 *
 * What this router deliberately does NOT do: it never promotes anything into
 * `members`, `groups` or `mission_member_details` (L3). Promotion is a later,
 * explicit, human-confirmed phase (§7, §18 — `POST /batches/:id/confirm` ships
 * only when L3 exists). Checkbox codes stay opaque end to end (Q5): the only
 * thing this layer does with `1` or `/` is record it verbatim.
 */

export const importRouter = Router();

importRouter.use(requireAuth);

/** Reads of import data: the privileged ministry roles, via shared/roles.ts. */
const requireImportReader = requireRole(...PRIVILEGED_ROLES);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuidParam(req: Request): string {
  const { id } = req.params as { id?: string };
  if (!id || !UUID_RE.test(id)) {
    throw new ValidationError("รหัสอ้างอิงไม่ถูกต้อง");
  }
  return id;
}

function sanitizeFileName(rawHeader: string | undefined): string {
  if (!rawHeader) {
    throw new ValidationError("ต้องระบุชื่อไฟล์ใน header x-source-filename", [
      { field: IMPORT_UPLOAD_FILENAME_HEADER, message: "missing header" },
    ]);
  }
  let decoded = rawHeader;
  try {
    decoded = decodeURIComponent(rawHeader);
  } catch {
    // keep the raw value — some clients send it unencoded
  }
  const base = decoded.split(/[\\/]/).pop() ?? "";
  if (base === "" || base === "." || base === ".." || !base.toLowerCase().endsWith(".xlsx")) {
    throw new ValidationError("รองรับเฉพาะไฟล์ .xlsx เท่านั้น", [
      { field: IMPORT_UPLOAD_FILENAME_HEADER, message: `unacceptable file name: ${base}` },
    ]);
  }
  return base;
}

/** Natural key of a versioned rule (mirrors normalization_rules_natural_uniq). */
function ruleKey(rule: {
  fieldKey: string;
  layoutVariant: string;
  ruleKind: string;
  fromPattern: string | null;
}): string {
  return `${rule.fieldKey}\u0000${rule.layoutVariant}\u0000${rule.ruleKind}\u0000${rule.fromPattern ?? ""}`;
}

/**
 * Insert any v1 registry rule the table does not have yet. Idempotent: the
 * natural unique index is the real guard, this only avoids a failed insert.
 * Rules start UNCONFIRMED (confirmedById IS NULL) — a human confirms them.
 */
async function seedNormalizationRules(): Promise<number> {
  const db = getDb();
  const existing = await db
    .select({
      fieldKey: normalizationRules.fieldKey,
      layoutVariant: normalizationRules.layoutVariant,
      ruleKind: normalizationRules.ruleKind,
      fromPattern: normalizationRules.fromPattern,
    })
    .from(normalizationRules)
    .where(eq(normalizationRules.version, NORMALIZATION_VERSION));
  const seen = new Set(existing.map(ruleKey));
  const missing = NORMALIZATION_RULES.filter((rule) => !seen.has(ruleKey(rule)));
  if (missing.length === 0) return 0;
  await db
    .insert(normalizationRules)
    .values(
      missing.map((rule) => ({
        version: rule.version,
        fieldKey: rule.fieldKey,
        layoutVariant: rule.layoutVariant,
        ruleKind: rule.ruleKind,
        fromPattern: rule.fromPattern,
        toCode: rule.toCode,
        confidence: rule.confidence,
      }))
    );
  return missing.length;
}

type PreparedSourceRow = {
  sheetName: string;
  team: string | null;
  excelRow: number;
  raw: CapturedMemberRow;
  outcome: NormalizationOutcome;
};

/** Flatten a parsed workbook into the exact rows that will be persisted. */
function prepareSourceRows(parsed: ParsedWorkbook): PreparedSourceRow[] {
  const prepared: PreparedSourceRow[] = [];
  for (const sheet of parsed.sheets) {
    for (const raw of sheet.rows) {
      prepared.push({
        sheetName: sheet.sheetName,
        // The sheet's title cell, captured verbatim; never parsed into a
        // group name or team code — that is L3 work.
        team: sheet.title,
        excelRow: raw.excelRowNumber,
        raw,
        outcome: normalizeMemberRow(raw),
      });
    }
  }
  return prepared;
}

function toSourceRowInsert(item: PreparedSourceRow, batchId: string) {
  return {
    batchId,
    sheetName: item.sheetName,
    team: item.team,
    excelRow: item.excelRow,
    rawSequence: item.raw.rawValues.sequence ?? null,
    rawFullName: item.raw.rawValues.fullName ?? null,
    rawNickname: item.raw.rawValues.nickname ?? null,
    rawAge: item.raw.rawValues.age ?? null,
    rawOccupation: item.raw.rawValues.occupation ?? null,
    rawWorkplace: item.raw.rawValues.workplace ?? null,
    rawBeliefYear: item.raw.rawValues.beliefYear ?? null,
    rawGoal: item.raw.rawValues.goal ?? null,
    rawMaritalCheckbox: item.raw.checkboxMarkers.marital ?? null,
    rawResponseCheckbox: item.raw.checkboxMarkers.response ?? null,
    rawParticipationCheckbox: item.raw.checkboxMarkers.participation ?? null,
    normStatus: item.outcome.status,
    normIssue: item.outcome.status === "quarantined" ? item.outcome.issue : null,
    normVersion: NORMALIZATION_VERSION,
  };
}

async function fetchBatchOrThrow(id: string): Promise<ImportBatch> {
  const db = getDb();
  const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, id)).limit(1);
  if (!batch) throw new NotFoundError("ไม่พบชุดข้อมูลนำเข้าที่ต้องการ");
  return batch;
}

/** Rebuilds the L1 shape (verbatim values) for the completeness report (§12). */
function toCapturedRow(row: typeof importSourceRows.$inferSelect): CapturedMemberRow {
  return {
    excelRowNumber: row.excelRow,
    rawValues: {
      sequence: row.rawSequence ?? "",
      fullName: row.rawFullName ?? "",
      nickname: row.rawNickname ?? "",
      age: row.rawAge ?? "",
      occupation: row.rawOccupation ?? "",
      workplace: row.rawWorkplace ?? "",
      beliefYear: row.rawBeliefYear ?? "",
      goal: row.rawGoal ?? "",
    },
    checkboxMarkers: {
      marital: row.rawMaritalCheckbox ?? [],
      response: row.rawResponseCheckbox ?? [],
      participation: row.rawParticipationCheckbox ?? [],
    },
  };
}

const BLOCKED_FIELD_NOTE = "ยังไม่ยืนยัน semantic meaning — ค่าคือ raw token เท่านั้น ไม่ถูกส่งต่อเข้าโดเมน (L3)";
const blockedFields = () =>
  IMPORT_BLOCKED_FIELD_KEYS.map((key) => ({ key, note: BLOCKED_FIELD_NOTE }));

// 1. POST /upload — parse a workbook into L1 + L2 (admin only)
importRouter.post(
  "/upload",
  // The workbook bytes ARE the request body (application/octet-stream). No
  // multipart dependency, and the file never passes through JSON parsing.
  express.raw({ type: "application/octet-stream", limit: IMPORT_UPLOAD_MAX_BYTES }),
  requireAdmin,
  async (req, res, next) => {
    try {
      const fileName = sanitizeFileName(req.headers[IMPORT_UPLOAD_FILENAME_HEADER] as string | undefined);
      const bytes = req.body as Buffer | undefined;
      if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
        throw new ValidationError("ต้องส่งไฟล์เป็น raw bytes (application/octet-stream)");
      }

      const db = getDb();
      const checksum = checksumBuffer(bytes);

      // §15: the same workbook is never imported twice silently.
      const [existing] = await db
        .select({ id: importBatches.id, sourceFileName: importBatches.sourceFileName })
        .from(importBatches)
        .where(eq(importBatches.fileChecksum, checksum))
        .limit(1);
      if (existing) {
        throw new ConflictError("ไฟล์นี้ถูกนำเข้าไปแล้ว — ไม่นำเข้าซ้ำโดยอัตโนมัติ", [
          { field: "existingBatchId", message: existing.id },
        ]);
      }

      let parsed: ParsedWorkbook;
      try {
        parsed = await withTempWorkbook(bytes, (filePath) => parseWorkbookFile(filePath));
      } catch (error) {
        throw new ValidationError(
          `อ่านไฟล์ไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      if (parsed.memberRowCount === 0) {
        throw new ValidationError(
          "ไม่พบแถวสมาชิกใด ๆ ในไฟล์นี้ (ไม่มี sheet ที่ header ตรงกับทะเบียนพันธกิจ)"
        );
      }

      // Normalize BEFORE writing, so a batch is written all-or-nothing.
      const prepared = prepareSourceRows(parsed);
      const quarantinedCount = prepared.filter((p) => p.outcome.status === "quarantined").length;
      const layoutVariants = Array.from(
        new Set(
          parsed.sheets
            .map((s) => s.analysis.layout?.signature)
            .filter((signature): signature is string => Boolean(signature))
        )
      );

      await seedNormalizationRules();

      const CHUNK = 500;
      const batchId = await db.transaction(async (tx) => {
        const [batch] = await tx
          .insert(importBatches)
          .values({
            sourceFileName: fileName,
            fileChecksum: checksum,
            layoutVariants,
            checkboxConventions: parsed.checkboxConventions,
            worksheetCount: parsed.worksheetCount,
            rowCount: parsed.dataRowCount,
            memberCount: parsed.memberRowCount,
            quarantinedCount,
            normalizationVersion: NORMALIZATION_VERSION,
            importedById: req.user!.id,
          })
          .returning();

        for (let i = 0; i < prepared.length; i += CHUNK) {
          const chunk = prepared.slice(i, i + CHUNK);
          const saved = await tx
            .insert(importSourceRows)
            .values(chunk.map((item) => toSourceRowInsert(item, batch.id)))
            .returning({ id: importSourceRows.id, sheetName: importSourceRows.sheetName, excelRow: importSourceRows.excelRow });

          const normValues: (typeof importRowNorm.$inferInsert)[] = [];
          for (const sourceRow of saved) {
            const item = chunk.find(
              (c) => c.sheetName === sourceRow.sheetName && c.excelRow === sourceRow.excelRow
            );
            if (!item || item.outcome.status !== "ok") continue;
            normValues.push({ sourceRowId: sourceRow.id, ...item.outcome.norm });
          }
          if (normValues.length > 0) {
            await tx.insert(importRowNorm).values(normValues);
          }
        }

        return batch.id;
      });

      await logAudit({
        req,
        action: "IMPORT_BATCH_CREATED",
        entityType: "import_batch",
        entityId: batchId,
        details: { sourceFileName: fileName, memberCount: parsed.memberRowCount, quarantinedCount },
      });

      const batch = await fetchBatchOrThrow(batchId);
      res.status(201).json({
        success: true,
        data: {
          batch,
          counts: {
            worksheets: parsed.worksheetCount,
            dataRows: parsed.dataRowCount,
            memberRows: parsed.memberRowCount,
            normalized: parsed.memberRowCount - quarantinedCount,
            quarantined: quarantinedCount,
            skipped: 0, // §12: nothing is ever silently dropped
          },
          blockedFields: blockedFields(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// 2. GET /batches — list batches with their counts
importRouter.get("/batches", requireImportReader, async (req, res, next) => {
  try {
    const parsed = importBatchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("พารามิเตอร์การค้นหาไม่ถูกต้อง");
    }
    const { page, limit } = parsed.data;
    const db = getDb();
    const [totalResult] = await db.select({ total: count() }).from(importBatches);
    const total = Number(totalResult?.total ?? 0);
    const rows = await db
      .select()
      .from(importBatches)
      .orderBy(desc(importBatches.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    res.json({
      success: true,
      data: rows,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
});

// 3. GET /batches/:id/preview — L1 verbatim beside L2 opaque
importRouter.get("/batches/:id/preview", requireImportReader, async (req, res, next) => {
  try {
    const id = requireUuidParam(req);
    const parsed = importPreviewQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("พารามิเตอร์การค้นหาไม่ถูกต้อง");
    }
    const batch = await fetchBatchOrThrow(id);
    const db = getDb();

    const conditions = [eq(importSourceRows.batchId, id)];
    if (parsed.data.status !== "all") {
      conditions.push(eq(importSourceRows.normStatus, parsed.data.status));
    }

    const rows = await db
      .select({
        id: importSourceRows.id,
        sheetName: importSourceRows.sheetName,
        team: importSourceRows.team,
        excelRow: importSourceRows.excelRow,
        rawSequence: importSourceRows.rawSequence,
        rawFullName: importSourceRows.rawFullName,
        rawNickname: importSourceRows.rawNickname,
        rawAge: importSourceRows.rawAge,
        rawOccupation: importSourceRows.rawOccupation,
        rawWorkplace: importSourceRows.rawWorkplace,
        rawBeliefYear: importSourceRows.rawBeliefYear,
        rawGoal: importSourceRows.rawGoal,
        rawMaritalCheckbox: importSourceRows.rawMaritalCheckbox,
        rawResponseCheckbox: importSourceRows.rawResponseCheckbox,
        rawParticipationCheckbox: importSourceRows.rawParticipationCheckbox,
        normStatus: importSourceRows.normStatus,
        normIssue: importSourceRows.normIssue,
        norm: {
          fullName: importRowNorm.fullName,
          nickname: importRowNorm.nickname,
          age: importRowNorm.age,
          occupation: importRowNorm.occupation,
          workplace: importRowNorm.workplace,
          beliefYear: importRowNorm.beliefYear,
          maritalCode: importRowNorm.maritalCode,
          responseCode: importRowNorm.responseCode,
          participationCode: importRowNorm.participationCode,
          goalCode: importRowNorm.goalCode,
        },
      })
      .from(importSourceRows)
      .leftJoin(importRowNorm, eq(importRowNorm.sourceRowId, importSourceRows.id))
      .where(and(...conditions))
      .orderBy(importSourceRows.sheetName, importSourceRows.excelRow)
      .limit(parsed.data.limit);

    res.json({ success: true, data: { batch, rows, blockedFields: blockedFields() } });
  } catch (err) {
    next(err);
  }
});

// 4. GET /batches/:id/report — §12 completeness + counts + in-batch duplicates
importRouter.get("/batches/:id/report", requireImportReader, async (req, res, next) => {
  try {
    const id = requireUuidParam(req);
    const batch = await fetchBatchOrThrow(id);
    const db = getDb();

    const sourceRows = await db.select().from(importSourceRows).where(eq(importSourceRows.batchId, id));
    const normRows = await db
      .select({
        nickname: importRowNorm.nickname,
        age: importRowNorm.age,
        sheetName: importSourceRows.sheetName,
        excelRow: importSourceRows.excelRow,
      })
      .from(importRowNorm)
      .innerJoin(importSourceRows, eq(importRowNorm.sourceRowId, importSourceRows.id))
      .where(eq(importSourceRows.batchId, id));

    const quarantined = sourceRows.filter((row) => row.normStatus === "quarantined");
    const issueCounts: Record<string, number> = {};
    for (const row of quarantined) {
      const issue = row.normIssue ?? "UNKNOWN";
      issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
    }
    const duplicates = groupDuplicateCandidates(normRows.map((row) => ({ ...row, batchId: id })));

    res.json({
      success: true,
      data: {
        batch,
        counts: {
          memberRows: sourceRows.length,
          normalized: sourceRows.length - quarantined.length,
          quarantined: quarantined.length,
          skipped: 0, // never silently dropped
          flaggedDuplicates: duplicates.reduce((sum, group) => sum + group.occurrences, 0),
        },
        quarantinedIssues: Object.entries(issueCounts).map(([issue, rows]) => ({ issue, rows })),
        completeness: computeCompleteness(sourceRows.map(toCapturedRow)),
        duplicates,
        blockedFields: blockedFields(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// 5. GET /duplicates — the §8 review queue across batches (flags, never merges)
importRouter.get("/duplicates", requireImportReader, async (req, res, next) => {
  try {
    const parsed = importDuplicatesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("พารามิเตอร์การค้นหาไม่ถูกต้อง");
    }
    const db = getDb();
    const conditions = [isNotNull(importRowNorm.nickname)];
    if (parsed.data.batchId) conditions.push(eq(importSourceRows.batchId, parsed.data.batchId));

    const rows = await db
      .select({
        nickname: importRowNorm.nickname,
        age: importRowNorm.age,
        batchId: importSourceRows.batchId,
        sheetName: importSourceRows.sheetName,
        excelRow: importSourceRows.excelRow,
      })
      .from(importRowNorm)
      .innerJoin(importSourceRows, eq(importRowNorm.sourceRowId, importSourceRows.id))
      .where(and(...conditions));

    res.json({
      success: true,
      data: {
        duplicates: groupDuplicateCandidates(rows, parsed.data.limit),
        note: "ชื่อเล่นซ้ำเป็นเพียงผู้เข้ารอบตรวจสอบ — ระบบไม่รวมบันทึกอัตโนมัติ (§8)",
      },
    });
  } catch (err) {
    next(err);
  }
});

// 6. POST /rules/:id/confirm — a human confirms a normalization rule (admin)
importRouter.post("/rules/:id/confirm", requireAdmin, async (req, res, next) => {
  try {
    const id = requireUuidParam(req);
    if (!importRuleConfirmSchema.safeParse(req.body ?? {}).success) {
      throw new ValidationError("พารามิเตอร์ไม่ถูกต้อง");
    }
    const db = getDb();
    const [rule] = await db.select().from(normalizationRules).where(eq(normalizationRules.id, id)).limit(1);
    if (!rule) throw new NotFoundError("ไม่พบกฎ normalization ที่ต้องการ");

    const [updated] = await db
      .update(normalizationRules)
      .set({ confirmedById: req.user!.id, confirmedAt: new Date() })
      .where(eq(normalizationRules.id, id))
      .returning();

    await logAudit({
      req,
      action: "IMPORT_RULE_CONFIRMED",
      entityType: "normalization_rule",
      entityId: id,
      details: { version: rule.version, fieldKey: rule.fieldKey, ruleKind: rule.ruleKind },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});