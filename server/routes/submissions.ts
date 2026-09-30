import { Router, type Request } from "express";
import { and, count, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  missionSubmissions,
  users,
  type MissionSubmissionStatus,
  type UserRole,
} from "../../shared/schema.js";
import {
  missionSubmissionInputSchema,
  missionSubmissionPublishSchema,
  missionSubmissionQuerySchema,
  missionSubmissionStatusUpdateSchema,
} from "../../shared/validation.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { insertMissionActivity, insertMissionActivityMedia } from "../lib/missionActivity.js";
import { logAudit } from "../lib/audit.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";

export const submissionsRouter = Router();

submissionsRouter.use(requireAuth);

/**
 * Mission Inbox: "what has not yet become official data." Anyone who can
 * create Mission Activity can also drop a raw submission in (e.g. typing up
 * what came in over LINE today, until a real LINE adapter exists). Only
 * privileged roles review, approve, and publish — the same "draft -> human
 * review -> publish" gate activities.ts enforces on the manual path.
 */
const CREATE_ROLES: UserRole[] = ["super_admin", "admin", "staff", "ministry_leader", "group_leader"];
const REVIEW_ROLES: UserRole[] = ["super_admin", "admin", "staff", "ministry_leader"];

const STATUS_TRANSITIONS: Record<MissionSubmissionStatus, MissionSubmissionStatus[]> = {
  new: ["reviewing", "rejected"],
  reviewing: ["needs_info", "approved", "rejected", "new"],
  needs_info: ["reviewing", "rejected"],
  approved: [],
  rejected: ["new"],
};

function isReviewer(role: UserRole): boolean {
  return REVIEW_ROLES.includes(role);
}

function parseRawMediaUrls(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}

async function fetchDetail(id: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: missionSubmissions.id,
      status: missionSubmissions.status,
      source: missionSubmissions.source,
      rawText: missionSubmissions.rawText,
      rawMediaUrls: missionSubmissions.rawMediaUrls,
      submittedByLabel: missionSubmissions.submittedByLabel,
      reviewNote: missionSubmissions.reviewNote,
      publishedActivityId: missionSubmissions.publishedActivityId,
      reviewedById: missionSubmissions.reviewedById,
      reviewedByName: users.name,
      reviewedAt: missionSubmissions.reviewedAt,
      createdById: missionSubmissions.createdById,
      createdAt: missionSubmissions.createdAt,
      updatedAt: missionSubmissions.updatedAt,
    })
    .from(missionSubmissions)
    .leftJoin(users, eq(missionSubmissions.reviewedById, users.id))
    .where(eq(missionSubmissions.id, id))
    .limit(1);
  if (!row) return null;
  return { ...row, rawMediaUrls: parseRawMediaUrls(row.rawMediaUrls) };
}

// 1. GET / - list (reviewer sees all, everyone else sees only their own submissions)
submissionsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = missionSubmissionQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(
        "พารามิเตอร์การค้นหาไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }
    const { page, limit, status } = parsed.data;
    const offset = (page - 1) * limit;
    const db = getDb();
    const user = req.user!;

    const conditions = [];
    if (!isReviewer(user.role)) {
      conditions.push(eq(missionSubmissions.createdById, user.id));
    }
    if (status) conditions.push(eq(missionSubmissions.status, status));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db.select({ total: count() }).from(missionSubmissions).where(whereClause);
    const total = Number(countResult?.total ?? 0);

    const rows = await db
      .select({
        id: missionSubmissions.id,
        status: missionSubmissions.status,
        source: missionSubmissions.source,
        rawText: missionSubmissions.rawText,
        submittedByLabel: missionSubmissions.submittedByLabel,
        publishedActivityId: missionSubmissions.publishedActivityId,
        createdById: missionSubmissions.createdById,
        createdAt: missionSubmissions.createdAt,
      })
      .from(missionSubmissions)
      .where(whereClause)
      .orderBy(desc(missionSubmissions.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ success: true, data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
  } catch (err) {
    next(err);
  }
});

// 2. GET /:id - detail
submissionsRouter.get("/:id", async (req, res, next) => {
  try {
    const detail = await fetchDetail(req.params.id);
    if (!detail) throw new NotFoundError("ไม่พบข้อมูลนำเข้าที่ต้องการ");
    const user = req.user!;
    if (!isReviewer(user.role) && detail.createdById !== user.id) {
      throw new NotFoundError("ไม่พบข้อมูลนำเข้าที่ต้องการ");
    }
    res.json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
});

// 3. POST / - create a raw submission (manual entry — no LINE adapter yet)
submissionsRouter.post("/", requireRole(...CREATE_ROLES), async (req, res, next) => {
  try {
    const parsed = missionSubmissionInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const db = getDb();
    const { rawText, rawMediaUrls, submittedByLabel } = parsed.data;
    const [created] = await db
      .insert(missionSubmissions)
      .values({
        source: "manual",
        rawText: rawText || null,
        rawMediaUrls: rawMediaUrls.length > 0 ? JSON.stringify(rawMediaUrls) : null,
        submittedByLabel: submittedByLabel || null,
        createdById: req.user!.id,
      })
      .returning();

    await logAudit({
      req,
      action: "MISSION_SUBMISSION_CREATED",
      entityType: "mission_submission",
      entityId: created.id,
    });

    const detail = await fetchDetail(created.id);
    res.status(201).json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
});

// 4. PUT /:id/status - review lifecycle transition (reviewers only, except reopening own rejected submission)
submissionsRouter.put("/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = missionSubmissionStatusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        "สถานะไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const db = getDb();
    const [existing] = await db.select().from(missionSubmissions).where(eq(missionSubmissions.id, id)).limit(1);
    if (!existing) throw new NotFoundError("ไม่พบข้อมูลนำเข้าที่ต้องการ");

    const user = req.user!;
    const isOwnResubmit = existing.status === "rejected" && parsed.data.status === "new" && existing.createdById === user.id;
    if (!isReviewer(user.role) && !isOwnResubmit) {
      throw new ForbiddenError("คุณไม่มีสิทธิ์เปลี่ยนสถานะข้อมูลนำเข้านี้");
    }

    const { status: nextStatus, reviewNote } = parsed.data;
    const allowedNext = STATUS_TRANSITIONS[existing.status];
    if (!allowedNext.includes(nextStatus)) {
      throw new ValidationError(`ไม่สามารถเปลี่ยนสถานะจาก "${existing.status}" ไปเป็น "${nextStatus}" ได้`);
    }

    const [updated] = await db
      .update(missionSubmissions)
      .set({
        status: nextStatus,
        ...(reviewNote !== undefined && { reviewNote: reviewNote || null }),
        ...(isReviewer(user.role) && { reviewedById: user.id, reviewedAt: new Date() }),
        updatedAt: new Date(),
      })
      .where(eq(missionSubmissions.id, id))
      .returning();

    await logAudit({
      req,
      action: "MISSION_SUBMISSION_STATUS_CHANGED",
      entityType: "mission_submission",
      entityId: id,
      details: { from: existing.status, to: nextStatus },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// 5. POST /:id/publish - promote an approved submission into a Mission Activity (draft)
submissionsRouter.post("/:id/publish", requireRole(...REVIEW_ROLES), async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const [existing] = await db.select().from(missionSubmissions).where(eq(missionSubmissions.id, id)).limit(1);
    if (!existing) throw new NotFoundError("ไม่พบข้อมูลนำเข้าที่ต้องการ");
    if (existing.status !== "approved") {
      throw new ValidationError("ต้องอนุมัติ (approved) ข้อมูลนำเข้าก่อนจึงจะเผยแพร่เป็นกิจกรรมได้");
    }
    if (existing.publishedActivityId) {
      throw new ValidationError("ข้อมูลนำเข้านี้ถูกเผยแพร่เป็นกิจกรรมไปแล้ว");
    }

    const parsed = missionSubmissionPublishSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "ข้อมูลกิจกรรมไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const { includeRawMedia, ...activityFields } = parsed.data;
    const created = await insertMissionActivity({ ...activityFields, createdById: req.user!.id });

    if (includeRawMedia) {
      const mediaUrls = parseRawMediaUrls(existing.rawMediaUrls);
      await insertMissionActivityMedia(
        created.id,
        mediaUrls.map((url) => ({ url, kind: "image" as const }))
      );
    }

    const [updated] = await db
      .update(missionSubmissions)
      .set({
        publishedActivityId: created.id,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(missionSubmissions.id, id))
      .returning();

    await logAudit({
      req,
      action: "MISSION_SUBMISSION_PUBLISHED",
      entityType: "mission_submission",
      entityId: id,
      details: { activityId: created.id },
    });

    res.json({ success: true, data: { submission: updated, activity: created } });
  } catch (err) {
    next(err);
  }
});
