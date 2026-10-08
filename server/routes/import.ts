import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import express from "express";
import { and, count, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { getDb } from "../db/client.js";
import {
  importBatches,
  importDuplicateDecisions,
  importRowNorm,
  importSourceRows,
  normalizationRules,
  users,
  IMPORT_BLOCKED_FIELD_KEYS,
  type ImportBatch,
} from "../../shared/schema.js";
import {
  importBatchQuerySchema,
  importDuplicateDecisionBodySchema,
  importDuplicatesQuerySchema,
  importPreviewQuerySchema,
  importRuleConfirmSchema,
  IMPORT_UPLOAD_FILENAME_HEADER,
  importFromBlobBodySchema,
  IMPORT_UPLOAD_MAX_BYTES,
} from "../../shared/import.js";
import { PRIVILEGED_ROLES } from "../../shared/roles.js";
import { requireAdmin, requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { runAtomically } from "../db/atomic.js";
import { isUniqueViolation, KNOWN_UNIQUE_CONSTRAINTS } from "../lib/dbErrors.js";
import { runGroupMembersPreCheck } from "../lib/groupMembersPreCheck.js";
import { createImportUploadToken, deleteImportBlob, readImportBlob } from "../lib/importBlob.js";
import { AppError, ConflictError, NotFoundError, ValidationError } from "../lib/errors.js";
import {
  checksumBuffer,
  computeCompleteness,
  duplicateGroupFingerprint,
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
    )
    // Two imports can seed at the same time. The natural unique index decides
    // the winner and the loser must not fail: seeding is idempotent.
    .onConflictDoNothing();
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

type ImportAuditExtra = Record<string, unknown>;

/**
 * Shared by every upload path (raw body and Blob hand-off): dedupe by
 * checksum, parse, normalize, then write L1 + L2 as ONE atomic unit. It never
 * touches L3.
 *
 * Atomic unit = the `import_batches` row + every `import_source_rows` row +
 * every `import_row_norm` row of this file. All of them are written together
 * or none are (`runAtomically`: db.batch on Neon HTTP, db.transaction
 * elsewhere). Ids are generated here because a Neon batch cannot read the
 * result of an earlier statement.
 *
 * Every failure is written to the audit log (IMPORT_BATCH_FAILED) with the
 * stage it failed in, so a failed import leaves a trace even though no
 * import_batches row exists.
 */
async function importWorkbookBytes(req: Request, bytes: Buffer, fileName: string, extra: ImportAuditExtra = {}) {
  const checksum = checksumBuffer(bytes);
  let stage: "precheck" | "parse" | "write" = "precheck";
  try {
    return await importWorkbookBytesUnchecked(req, bytes, fileName, checksum, extra, (next) => {
      stage = next;
    });
  } catch (error) {
    await logAudit({
      req,
      action: "IMPORT_BATCH_FAILED",
      entityType: "import_batch",
      entityId: null,
      details: {
        sourceFileName: fileName,
        sizeBytes: bytes.length,
        checksum,
        stage,
        errorCode: error instanceof AppError ? error.code : "UNEXPECTED",
        ...extra,
      },
    });
    throw error;
  }
}

async function importWorkbookBytesUnchecked(
  req: Request,
  bytes: Buffer,
  fileName: string,
  checksum: string,
  extra: ImportAuditExtra,
  setStage: (stage: "precheck" | "parse" | "write") => void
) {
  const db = getDb();

  // §15: the same workbook is never imported twice silently.
  const duplicateOfExisting = async () => {
    const [existing] = await db
      .select({ id: importBatches.id, sourceFileName: importBatches.sourceFileName })
      .from(importBatches)
      .where(eq(importBatches.fileChecksum, checksum))
      .limit(1);
    return existing
      ? new ConflictError("ไฟล์นี้ถูกนำเข้าไปแล้ว — ไม่นำเข้าซ้ำโดยอัตโนมัติ", [
          { field: "existingBatchId", message: existing.id },
        ])
      : null;
  };
  const alreadyImported = await duplicateOfExisting();
  if (alreadyImported) throw alreadyImported;

  setStage("parse");
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

  setStage("write");
  await seedNormalizationRules();

  const CHUNK = 500;
  const batchId = randomUUID();
  const sourceRowIds = prepared.map(() => randomUUID());
  try {
    await runAtomically((exec) => {
      const statements: PromiseLike<unknown>[] = [
        exec.insert(importBatches).values({
          id: batchId,
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
        }),
      ];

      // L1 first: every source row, so the L2 rows below can reference them.
      for (let i = 0; i < prepared.length; i += CHUNK) {
        statements.push(
          exec.insert(importSourceRows).values(
            prepared.slice(i, i + CHUNK).map((item, offset) => ({
              id: sourceRowIds[i + offset],
              ...toSourceRowInsert(item, batchId),
            }))
          )
        );
      }

      // L2: only rows that normalized; a quarantined row stays in L1 alone.
      for (let i = 0; i < prepared.length; i += CHUNK) {
        const normValues: (typeof importRowNorm.$inferInsert)[] = [];
        prepared.slice(i, i + CHUNK).forEach((item, offset) => {
          if (item.outcome.status === "ok") {
            normValues.push({ sourceRowId: sourceRowIds[i + offset], ...item.outcome.norm });
          }
        });
        if (normValues.length > 0) statements.push(exec.insert(importRowNorm).values(normValues));
      }
      return statements;
    });
  } catch (error) {
    // Two uploads of the same file raced past the pre-check above; the unique
    // index on the checksum picked the winner. This is a known conflict: 409.
    // Any other database error is unexpected and stays a 500.
    if (isUniqueViolation(error, KNOWN_UNIQUE_CONSTRAINTS.importFileChecksum)) {
      throw (
        (await duplicateOfExisting()) ??
        new ConflictError("ไฟล์นี้ถูกนำเข้าไปแล้ว — ไม่นำเข้าซ้ำโดยอัตโนมัติ")
      );
    }
    throw error;
  }

  await logAudit({
    req,
    action: "IMPORT_BATCH_CREATED",
    entityType: "import_batch",
    entityId: batchId,
    details: { sourceFileName: fileName, memberCount: parsed.memberRowCount, quarantinedCount, ...extra },
  });

  const batch = await fetchBatchOrThrow(batchId);
  return {
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
  };
}

// 1. POST /upload — parse a workbook into L1 + L2 (admin only)
// Raw body path. Vercel caps a function request at 4.5 MB, so real workbooks
// go through /upload/token + /upload/from-blob below; this path stays for
// small files, self-hosted deployments and tests.
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
      res.status(201).json({ success: true, data: await importWorkbookBytes(req, bytes, fileName) });
    } catch (err) {
      next(err);
    }
  }
);

// 1b. POST /upload/token — Vercel Blob client-upload handshake (admin only).
// The browser uploads straight to a PRIVATE blob; only a short token passes here.
importRouter.post("/upload/token", requireAdmin, async (req, res, next) => {
  try {
    res.json(await createImportUploadToken(req));
  } catch (err) {
    next(err);
  }
});

// 1c. POST /upload/from-blob — import a workbook the browser put in Blob (admin only).
//
// Retention: the blob is deleted as soon as its bytes are fully in memory, before
// parsing and writing. So a failed import needs a re-upload (the file is gone).
// Deletion is not guaranteed: a timeout, a failed read or a failed delete leaves
// the blob in storage; those cases are recorded in the audit log (never silent).
importRouter.post("/upload/from-blob", requireAdmin, async (req, res, next) => {
  try {
    const parsedBody = importFromBlobBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new ValidationError("ข้อมูลไม่ถูกต้อง", parsedBody.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })));
    }
    const { pathname, fileName } = parsedBody.data;
    const safeName = sanitizeFileName(fileName);

    let bytes: Buffer;
    try {
      bytes = await readImportBlob(pathname);
    } catch (error) {
      // The bytes were NOT loaded, so the file is still the only copy.
      // A ValidationError means the file is missing or can never be accepted
      // (too large): removing it loses nothing. Any other failure (a broken
      // read) keeps the blob so the upload is not lost, and says so in the audit log.
      if (error instanceof ValidationError) {
        await deleteImportBlob(pathname);
      } else {
        await logAudit({
          req,
          action: "IMPORT_BLOB_RETAINED",
          entityType: "import_blob",
          entityId: null,
          details: { pathname, sourceFileName: safeName, reason: "READ_FAILED" },
        });
      }
      await logAudit({
        req,
        action: "IMPORT_BATCH_FAILED",
        entityType: "import_batch",
        entityId: null,
        details: {
          sourceFileName: safeName,
          stage: "read-blob",
          errorCode: error instanceof AppError ? error.code : "UNEXPECTED",
          source: "blob",
          blobPathname: pathname,
        },
      });
      throw error;
    }

    // Bytes are safely loaded: the blob is no longer needed.
    const blobDeleted = await deleteImportBlob(pathname);
    if (!blobDeleted) {
      await logAudit({
        req,
        action: "IMPORT_BLOB_DELETE_FAILED",
        entityType: "import_blob",
        entityId: null,
        details: { pathname, sourceFileName: safeName },
      });
    }

    const data = await importWorkbookBytes(req, bytes, safeName, {
      source: "blob",
      blobPathname: pathname,
      blobDeleted,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

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
        sourceRowId: importSourceRows.id,
        batchId: importSourceRows.batchId,
        sourceFileName: importBatches.sourceFileName,
        sheetName: importSourceRows.sheetName,
        excelRow: importSourceRows.excelRow,
        team: importSourceRows.team,
        rawFullName: importSourceRows.rawFullName,
        rawAge: importSourceRows.rawAge,
        rawOccupation: importSourceRows.rawOccupation,
        rawWorkplace: importSourceRows.rawWorkplace,
      })
      .from(importRowNorm)
      .innerJoin(importSourceRows, eq(importRowNorm.sourceRowId, importSourceRows.id))
      .innerJoin(importBatches, eq(importSourceRows.batchId, importBatches.id))
      .where(and(...conditions));

    // Per-row evidence so a reviewer can compare candidates side by side.
    // L1 values stay verbatim; only `age` is the L2 coerced number.
    const occurrencesByNickname = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = (row.nickname ?? "").trim();
      if (key === "") continue;
      const list = occurrencesByNickname.get(key) ?? [];
      list.push(row);
      occurrencesByNickname.set(key, list);
    }
    const candidates = groupDuplicateCandidates(rows, parsed.data.limit).map((group) => ({
      ...group,
      members: (occurrencesByNickname.get(group.nickname) ?? [])
        .map(({ nickname: _nickname, ...member }) => member)
        .sort((a, b) => a.sourceFileName.localeCompare(b.sourceFileName) || a.sheetName.localeCompare(b.sheetName) || a.excelRow - b.excelRow),
    }));

    // Recorded human decisions, newest first. A decision applies to a group
    // only while the group's rows are exactly the rows that were compared.
    const decisionRows =
      candidates.length === 0
        ? []
        : await db
            .select({
              id: importDuplicateDecisions.id,
              nickname: importDuplicateDecisions.nickname,
              groupFingerprint: importDuplicateDecisions.groupFingerprint,
              decision: importDuplicateDecisions.decision,
              note: importDuplicateDecisions.note,
              decidedAt: importDuplicateDecisions.decidedAt,
              decidedByName: users.name,
            })
            .from(importDuplicateDecisions)
            .leftJoin(users, eq(importDuplicateDecisions.decidedById, users.id))
            .where(inArray(importDuplicateDecisions.nickname, candidates.map((c) => c.nickname)))
            .orderBy(desc(importDuplicateDecisions.decidedAt));
    const duplicates = candidates.map((group) => {
      const fingerprint = duplicateGroupFingerprint(group.members.map((m) => m.sourceRowId));
      return {
        ...group,
        decisions: decisionRows
          .filter((d) => d.nickname === group.nickname)
          .map(({ groupFingerprint, nickname: _nickname, ...d }) => ({
            ...d,
            matchesCurrentRows: groupFingerprint === fingerprint,
          })),
      };
    });

    res.json({
      success: true,
      data: {
        duplicates,
        note: "ชื่อเล่นซ้ำเป็นเพียงผู้เข้ารอบตรวจสอบ — ระบบไม่รวมบันทึกอัตโนมัติ (§8)",
      },
    });
  } catch (err) {
    next(err);
  }
});

// 5b. POST /duplicates/decisions — record a human decision on a candidate group (admin).
// Append-only; it never merges, edits or promotes any row (§8).
importRouter.post("/duplicates/decisions", requireAdmin, async (req, res, next) => {
  try {
    const parsed = importDuplicateDecisionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        "ข้อมูลการตัดสินใจไม่ถูกต้อง",
        parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }))
      );
    }
    const { nickname, decision, note } = parsed.data;
    const sourceRowIds = Array.from(new Set(parsed.data.sourceRowIds));
    if (sourceRowIds.length < 2) {
      throw new ValidationError("ต้องเลือกอย่างน้อย 2 แถวเพื่อตัดสินใจ");
    }

    const db = getDb();
    // Every row must exist and carry this nickname: a decision cannot be
    // recorded against rows the reviewer did not actually compare.
    const found = await db
      .select({ id: importSourceRows.id, nickname: importRowNorm.nickname })
      .from(importSourceRows)
      .innerJoin(importRowNorm, eq(importRowNorm.sourceRowId, importSourceRows.id))
      .where(inArray(importSourceRows.id, sourceRowIds));
    if (found.length !== sourceRowIds.length || found.some((row) => (row.nickname ?? "").trim() !== nickname)) {
      throw new ValidationError("แถวที่เลือกไม่ตรงกับชื่อเล่นนี้ หรือไม่พบในระบบ");
    }

    const groupFingerprint = duplicateGroupFingerprint(sourceRowIds);

    // A repeated click records nothing new: the latest decision for this exact
    // group with the same outcome and note is returned as is.
    const [latest] = await db
      .select()
      .from(importDuplicateDecisions)
      .where(eq(importDuplicateDecisions.groupFingerprint, groupFingerprint))
      .orderBy(desc(importDuplicateDecisions.decidedAt))
      .limit(1);
    if (latest && latest.decision === decision && (latest.note ?? undefined) === note) {
      res.json({ success: true, data: latest });
      return;
    }

    const [created] = await db
      .insert(importDuplicateDecisions)
      .values({
        nickname,
        groupFingerprint,
        sourceRowIds: [...sourceRowIds].sort(),
        decision,
        note: note ?? null,
        decidedById: req.user!.id,
      })
      .returning();

    await logAudit({
      req,
      action: "IMPORT_DUPLICATE_DECIDED",
      entityType: "import_duplicate_decision",
      entityId: created.id,
      details: { nickname, decision, rowCount: sourceRowIds.length },
    });

    res.status(201).json({ success: true, data: created });
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

// 7. GET /precheck/group-members — the Q2 gate, readable by an admin (read-only)
//
// Migration 0010 swaps `group_members_group_member_uniq` for a partial unique
// index, and that DDL is not allowed until this check reports clean against
// PRODUCTION. The production DATABASE_URL is a write-only Vercel secret, so
// the CLI in server/scripts/pre-migration-check.ts cannot be run from a laptop.
// This route runs the very same function inside the deployed app, where the
// Neon connection already exists: an admin opens it and the report is the
// gate. Admin-only because the numbers are production aggregates and the
// verdict authorises DDL — readers of import data are not enough.
importRouter.get("/precheck/group-members", requireAdmin, async (_req, res, next) => {
  try {
    const report = await runGroupMembersPreCheck();
    res.json({
      success: true,
      data: {
        report,
        gate: {
          migrationBlocked: report.migrationBlocked,
          verdict: report.migrationBlocked ? "BLOCKED" : "CLEAR",
          verdictThai: report.migrationBlocked
            ? "มี active membership ซ้ำต่อคู่ (group_id, member_id) — migration 0010 ห้ามรันจนกว่าคนจะแก้ข้อมูลเอง"
            : "ไม่พบกรณีที่บล็อก — เขียนและรัน migration 0010 ได้ (ยังต้องผ่านการอนุมัติของคน)",
        },
        note: "read-only — ทุกคำสั่งที่รันเป็น SELECT ไม่มีการแก้ไขข้อมูลใดๆ",
      },
    });
  } catch (err) {
    next(err);
  }
});