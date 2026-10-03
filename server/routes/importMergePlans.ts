import { Router, type Request } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "../db/client.js";
import {
  importBatches,
  importDuplicateDecisions,
  importMergePlans,
  importRowNorm,
  importSourceRows,
  users,
  type ImportMergePlanRow,
} from "../../shared/schema.js";
import {
  IMPORT_MERGE_FIELDS,
  IMPORT_MERGE_REQUIRES_SECOND_REVIEWER,
  importMergePlanBodySchema,
  importMergePlanQuerySchema,
  importMergeReviewBodySchema,
  type ImportMergeField,
} from "../../shared/importMerge.js";
import { PRIVILEGED_ROLES } from "../../shared/roles.js";
import { requireAdmin, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { duplicateGroupFingerprint } from "../lib/missionImport.js";
import { isUniqueViolation, KNOWN_UNIQUE_CONSTRAINTS } from "../lib/dbErrors.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";

/**
 * Merge PLANS for duplicate groups (§8). A plan names the surviving row and the
 * source row of each field; a second admin approves or rejects it.
 *
 * Approval records agreement and nothing else. This router never merges rows,
 * never edits L1/L2 and never writes to members or groups (L3).
 *
 * Mounted under /api/import/merge-plans by routes/import.ts (which already
 * requires a session).
 */
export const mergePlansRouter = Router();

const requireReader = requireRole(...PRIVILEGED_ROLES);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function planIdParam(req: Request): string {
  const { id } = req.params as { id?: string };
  if (!id || !UUID_RE.test(id)) throw new ValidationError("รหัสอ้างอิงไม่ถูกต้อง");
  return id;
}

function zodDetails(issues: Array<{ path: PropertyKey[]; message: string }>) {
  return issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }));
}

/** The newest decision recorded for exactly this set of rows. */
async function latestDecisionFor(fingerprint: string) {
  const db = getDb();
  const [latest] = await db
    .select()
    .from(importDuplicateDecisions)
    .where(eq(importDuplicateDecisions.groupFingerprint, fingerprint))
    .orderBy(desc(importDuplicateDecisions.decidedAt))
    .limit(1);
  return latest ?? null;
}

type RowValues = {
  id: string;
  sheetName: string;
  excelRow: number;
  sourceFileName: string;
  rawFullName: string | null;
  rawAge: string | null;
  rawOccupation: string | null;
  rawWorkplace: string | null;
};

const FIELD_COLUMN: Record<ImportMergeField, "rawFullName" | "rawAge" | "rawOccupation" | "rawWorkplace"> = {
  fullName: "rawFullName",
  age: "rawAge",
  occupation: "rawOccupation",
  workplace: "rawWorkplace",
};

async function loadRows(ids: string[]): Promise<RowValues[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  return db
    .select({
      id: importSourceRows.id,
      sheetName: importSourceRows.sheetName,
      excelRow: importSourceRows.excelRow,
      sourceFileName: importBatches.sourceFileName,
      rawFullName: importSourceRows.rawFullName,
      rawAge: importSourceRows.rawAge,
      rawOccupation: importSourceRows.rawOccupation,
      rawWorkplace: importSourceRows.rawWorkplace,
    })
    .from(importSourceRows)
    .innerJoin(importBatches, eq(importSourceRows.batchId, importBatches.id))
    .where(inArray(importSourceRows.id, ids));
}

/** Adds names and the rows' verbatim values, so a reviewer sees what would be merged. */
async function hydrate(plans: ImportMergePlanRow[]) {
  if (plans.length === 0) return [];
  const db = getDb();
  const userIds = Array.from(
    new Set(plans.flatMap((p) => [p.proposedById, p.reviewedById]).filter((v): v is string => Boolean(v)))
  );
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds));
    for (const row of rows) names.set(row.id, row.name);
  }
  const rows = await loadRows(Array.from(new Set(plans.flatMap((p) => p.sourceRowIds))));
  const rowById = new Map(rows.map((r) => [r.id, r]));

  return plans.map((plan) => {
    const members = plan.sourceRowIds
      .map((rowId) => rowById.get(rowId))
      .filter((row): row is RowValues => row !== undefined)
      .sort((a, b) => a.sourceFileName.localeCompare(b.sourceFileName) || a.sheetName.localeCompare(b.sheetName) || a.excelRow - b.excelRow);
    const result = Object.fromEntries(
      IMPORT_MERGE_FIELDS.map((field) => {
        const from = rowById.get(plan.fieldChoices[field]);
        return [field, { fromRowId: plan.fieldChoices[field], value: from ? from[FIELD_COLUMN[field]] : null }];
      })
    );
    return {
      id: plan.id,
      nickname: plan.nickname,
      status: plan.status,
      note: plan.note,
      decisionId: plan.decisionId,
      primarySourceRowId: plan.primarySourceRowId,
      fieldChoices: plan.fieldChoices,
      result,
      members,
      proposedById: plan.proposedById,
      proposedByName: plan.proposedById ? (names.get(plan.proposedById) ?? null) : null,
      proposedAt: plan.proposedAt,
      reviewedByName: plan.reviewedById ? (names.get(plan.reviewedById) ?? null) : null,
      reviewedAt: plan.reviewedAt,
      reviewNote: plan.reviewNote,
    };
  });
}

// GET / — plans, newest first (readers)
mergePlansRouter.get("/", requireReader, async (req, res, next) => {
  try {
    const parsed = importMergePlanQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError("พารามิเตอร์การค้นหาไม่ถูกต้อง");
    const db = getDb();
    const where = parsed.data.status === "all" ? undefined : eq(importMergePlans.status, parsed.data.status);
    const plans = await db
      .select()
      .from(importMergePlans)
      .where(where)
      .orderBy(desc(importMergePlans.proposedAt))
      .limit(parsed.data.limit);
    res.json({
      success: true,
      data: {
        plans: await hydrate(plans),
        requiresSecondReviewer: IMPORT_MERGE_REQUIRES_SECOND_REVIEWER,
        note: "การอนุมัติแผนรวมเป็นเพียงบันทึกความเห็นชอบ — ระบบยังไม่รวมข้อมูลจริง",
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST / — propose a merge plan for a group decided "same person" (admin)
mergePlansRouter.post("/", requireAdmin, async (req, res, next) => {
  try {
    const parsed = importMergePlanBodySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("ข้อมูลแผนรวมไม่ถูกต้อง", zodDetails(parsed.error.issues));
    const { nickname, primarySourceRowId, fieldChoices, note } = parsed.data;
    const sourceRowIds = Array.from(new Set(parsed.data.sourceRowIds));
    if (sourceRowIds.length < 2) throw new ValidationError("ต้องเลือกอย่างน้อย 2 แถว");

    const inGroup = new Set(sourceRowIds);
    const chosen = [primarySourceRowId, ...IMPORT_MERGE_FIELDS.map((field) => fieldChoices[field])];
    if (chosen.some((rowId) => !inGroup.has(rowId))) {
      throw new ValidationError("แถวหลักและแถวต้นทางของแต่ละช่องต้องอยู่ในกลุ่มที่เปรียบเทียบ");
    }

    const db = getDb();
    const found = await db
      .select({ id: importSourceRows.id, nickname: importRowNorm.nickname })
      .from(importSourceRows)
      .innerJoin(importRowNorm, eq(importRowNorm.sourceRowId, importSourceRows.id))
      .where(inArray(importSourceRows.id, sourceRowIds));
    if (found.length !== sourceRowIds.length || found.some((row) => (row.nickname ?? "").trim() !== nickname)) {
      throw new ValidationError("แถวที่เลือกไม่ตรงกับชื่อเล่นนี้ หรือไม่พบในระบบ");
    }

    const groupFingerprint = duplicateGroupFingerprint(sourceRowIds);
    const decision = await latestDecisionFor(groupFingerprint);
    if (!decision || decision.decision !== "same_person") {
      throw new ValidationError("ต้องบันทึกผลตรวจสอบว่า “คนเดียวกัน” กับกลุ่มนี้ก่อนจึงเสนอแผนรวมได้");
    }

    const findOpenPlanId = async () => {
      const [open] = await db
        .select({ id: importMergePlans.id })
        .from(importMergePlans)
        .where(and(eq(importMergePlans.groupFingerprint, groupFingerprint), eq(importMergePlans.status, "proposed")))
        .limit(1);
      return open?.id ?? null;
    };
    const openConflict = (openPlanId: string | null) =>
      new ConflictError(
        "กลุ่มนี้มีแผนรวมที่รออนุมัติอยู่แล้ว",
        openPlanId ? [{ field: "openPlanId", message: openPlanId }] : undefined
      );

    const alreadyOpen = await findOpenPlanId();
    if (alreadyOpen) throw openConflict(alreadyOpen);

    let created: ImportMergePlanRow;
    try {
      [created] = await db
        .insert(importMergePlans)
        .values({
          nickname,
          groupFingerprint,
          sourceRowIds: [...sourceRowIds].sort(),
          decisionId: decision.id,
          primarySourceRowId,
          fieldChoices,
          note: note ?? null,
          proposedById: req.user!.id,
        })
        .returning();
    } catch (error) {
      // Two proposals for the same group raced past the check above; the
      // partial unique index allowed only one. Known conflict: 409. Any other
      // database error is unexpected and stays a 500.
      if (isUniqueViolation(error, KNOWN_UNIQUE_CONSTRAINTS.mergePlanOneOpenPerGroup)) {
        throw openConflict(await findOpenPlanId());
      }
      throw error;
    }

    await logAudit({
      req,
      action: "IMPORT_MERGE_PLAN_PROPOSED",
      entityType: "import_merge_plan",
      entityId: created.id,
      details: { nickname, rowCount: sourceRowIds.length },
    });

    const [view] = await hydrate([created]);
    res.status(201).json({ success: true, data: view });
  } catch (err) {
    next(err);
  }
});

async function loadOpenPlan(id: string): Promise<ImportMergePlanRow> {
  const db = getDb();
  const [plan] = await db.select().from(importMergePlans).where(eq(importMergePlans.id, id)).limit(1);
  if (!plan) throw new NotFoundError("ไม่พบแผนรวมที่ต้องการ");
  if (plan.status !== "proposed") throw new ConflictError("แผนนี้ถูกดำเนินการไปแล้ว");
  return plan;
}

// POST /:id/review — a second admin approves or rejects (admin)
mergePlansRouter.post("/:id/review", requireAdmin, async (req, res, next) => {
  try {
    const id = planIdParam(req);
    const parsed = importMergeReviewBodySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("ข้อมูลการพิจารณาไม่ถูกต้อง", zodDetails(parsed.error.issues));
    const { outcome, note } = parsed.data;

    const plan = await loadOpenPlan(id);
    if (IMPORT_MERGE_REQUIRES_SECOND_REVIEWER && plan.proposedById === req.user!.id) {
      throw new ForbiddenError("ผู้เสนอแผนไม่สามารถอนุมัติหรือปฏิเสธแผนของตัวเองได้ ต้องให้ผู้ดูแลระบบอีกคนพิจารณา");
    }

    if (outcome === "approved") {
      // Approve only what is still true: the group was judged "same person" and
      // every row still exists. Otherwise the reviewer must reject or wait.
      const decision = await latestDecisionFor(plan.groupFingerprint);
      if (!decision || decision.decision !== "same_person") {
        throw new ConflictError("ผลตรวจสอบของกลุ่มนี้เปลี่ยนไปแล้ว ไม่ใช่ “คนเดียวกัน” อีกต่อไป จึงอนุมัติไม่ได้");
      }
      const rows = await loadRows(plan.sourceRowIds);
      if (rows.length !== plan.sourceRowIds.length) {
        throw new ConflictError("แถวต้นทางบางแถวไม่มีอยู่ในระบบแล้ว จึงอนุมัติไม่ได้");
      }
    }

    const db = getDb();
    const [updated] = await db
      .update(importMergePlans)
      .set({ status: outcome, reviewedById: req.user!.id, reviewedAt: new Date(), reviewNote: note ?? null })
      .where(and(eq(importMergePlans.id, id), eq(importMergePlans.status, "proposed")))
      .returning();
    if (!updated) throw new ConflictError("แผนนี้ถูกดำเนินการไปแล้ว");

    await logAudit({
      req,
      action: outcome === "approved" ? "IMPORT_MERGE_PLAN_APPROVED" : "IMPORT_MERGE_PLAN_REJECTED",
      entityType: "import_merge_plan",
      entityId: id,
      details: { nickname: plan.nickname },
    });

    const [view] = await hydrate([updated]);
    res.json({ success: true, data: view });
  } catch (err) {
    next(err);
  }
});

// POST /:id/withdraw — the proposer takes back an open plan (admin)
mergePlansRouter.post("/:id/withdraw", requireAdmin, async (req, res, next) => {
  try {
    const id = planIdParam(req);
    const plan = await loadOpenPlan(id);
    if (plan.proposedById !== req.user!.id) {
      throw new ForbiddenError("ถอนแผนได้เฉพาะผู้เสนอแผน");
    }
    const db = getDb();
    const [updated] = await db
      .update(importMergePlans)
      .set({ status: "withdrawn", reviewedById: req.user!.id, reviewedAt: new Date() })
      .where(and(eq(importMergePlans.id, id), eq(importMergePlans.status, "proposed")))
      .returning();
    if (!updated) throw new ConflictError("แผนนี้ถูกดำเนินการไปแล้ว");

    await logAudit({
      req,
      action: "IMPORT_MERGE_PLAN_WITHDRAWN",
      entityType: "import_merge_plan",
      entityId: id,
      details: { nickname: plan.nickname },
    });
    const [view] = await hydrate([updated]);
    res.json({ success: true, data: view });
  } catch (err) {
    next(err);
  }
});
