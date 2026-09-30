import { Router, type Request } from "express";
import { and, count, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  followUps,
  groups,
  members,
  missionActivities,
  users,
  type FollowUpStatus,
  type UserRole,
} from "../../shared/schema.js";
import {
  followUpInputSchema,
  followUpQuerySchema,
  followUpStatusUpdateSchema,
  followUpUpdateSchema,
} from "../../shared/validation.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";

export const followUpsRouter = Router();

followUpsRouter.use(requireAuth);

/**
 * Follow-ups are internal ministry tasks, not public content — unlike
 * Mission Activity there is no "published" state anyone can read. Visibility
 * is: privileged roles, the owner, the creator, or (for group_leader) a
 * group they actually lead. Reuses the same USER_ROLES RBAC as activities.
 */
const PRIVILEGED_ROLES: UserRole[] = ["super_admin", "admin", "staff", "ministry_leader"];
const CREATE_ROLES: UserRole[] = ["super_admin", "admin", "staff", "ministry_leader", "group_leader"];

const STATUS_TRANSITIONS: Record<FollowUpStatus, FollowUpStatus[]> = {
  open: ["in_progress", "completed", "cancelled"],
  in_progress: ["open", "completed", "cancelled"],
  completed: ["open"],
  cancelled: ["open"],
};

function isPrivileged(role: UserRole): boolean {
  return PRIVILEGED_ROLES.includes(role);
}

async function getLedGroupIds(userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(isNull(groups.deletedAt), or(eq(groups.leaderId, userId), eq(groups.coLeaderId, userId))));
  return rows.map((r) => r.id);
}

async function canAccess(
  req: Request,
  followUp: { ownerId: string | null; createdById: string | null; subjectGroupId: string | null }
): Promise<boolean> {
  const user = req.user!;
  if (isPrivileged(user.role)) return true;
  if (followUp.ownerId === user.id || followUp.createdById === user.id) return true;
  if (user.role === "group_leader" && followUp.subjectGroupId) {
    const ledGroupIds = await getLedGroupIds(user.id);
    return ledGroupIds.includes(followUp.subjectGroupId);
  }
  return false;
}

async function fetchDetail(id: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: followUps.id,
      status: followUps.status,
      title: followUps.title,
      note: followUps.note,
      subjectMemberId: followUps.subjectMemberId,
      subjectMemberName: members.name,
      subjectGroupId: followUps.subjectGroupId,
      subjectGroupName: groups.name,
      activityId: followUps.activityId,
      activityTitle: missionActivities.title,
      ownerId: followUps.ownerId,
      ownerName: users.name,
      dueAt: followUps.dueAt,
      completedAt: followUps.completedAt,
      createdById: followUps.createdById,
      createdAt: followUps.createdAt,
      updatedAt: followUps.updatedAt,
    })
    .from(followUps)
    .leftJoin(members, eq(followUps.subjectMemberId, members.id))
    .leftJoin(groups, eq(followUps.subjectGroupId, groups.id))
    .leftJoin(missionActivities, eq(followUps.activityId, missionActivities.id))
    .leftJoin(users, eq(followUps.ownerId, users.id))
    .where(eq(followUps.id, id))
    .limit(1);
  return row ?? null;
}

// 1. GET / - list, role-filtered
followUpsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = followUpQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(
        "พารามิเตอร์การค้นหาไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const { page, limit, status, ownerId, subjectMemberId, subjectGroupId, overdue } = parsed.data;
    const offset = (page - 1) * limit;
    const db = getDb();
    const user = req.user!;

    const conditions = [];

    if (!isPrivileged(user.role)) {
      const visibilityConditions = [eq(followUps.ownerId, user.id), eq(followUps.createdById, user.id)];
      if (user.role === "group_leader") {
        const ledGroupIds = await getLedGroupIds(user.id);
        if (ledGroupIds.length > 0) {
          visibilityConditions.push(inArray(followUps.subjectGroupId, ledGroupIds));
        }
      }
      conditions.push(or(...visibilityConditions)!);
    }

    if (status) conditions.push(eq(followUps.status, status));
    if (ownerId) conditions.push(eq(followUps.ownerId, ownerId));
    if (subjectMemberId) conditions.push(eq(followUps.subjectMemberId, subjectMemberId));
    if (subjectGroupId) conditions.push(eq(followUps.subjectGroupId, subjectGroupId));
    if (overdue) {
      conditions.push(lt(followUps.dueAt, new Date()));
      conditions.push(inArray(followUps.status, ["open", "in_progress"]));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db.select({ total: count() }).from(followUps).where(whereClause);
    const total = Number(countResult?.total ?? 0);

    const rows = await db
      .select({
        id: followUps.id,
        status: followUps.status,
        title: followUps.title,
        subjectMemberId: followUps.subjectMemberId,
        subjectMemberName: members.name,
        subjectGroupId: followUps.subjectGroupId,
        subjectGroupName: groups.name,
        activityId: followUps.activityId,
        ownerId: followUps.ownerId,
        ownerName: users.name,
        dueAt: followUps.dueAt,
        createdAt: followUps.createdAt,
      })
      .from(followUps)
      .leftJoin(members, eq(followUps.subjectMemberId, members.id))
      .leftJoin(groups, eq(followUps.subjectGroupId, groups.id))
      .leftJoin(users, eq(followUps.ownerId, users.id))
      .where(whereClause)
      .orderBy(sql`${followUps.dueAt} asc nulls last`, desc(followUps.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ success: true, data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
  } catch (err) {
    next(err);
  }
});

// 2. GET /:id - detail
followUpsRouter.get("/:id", async (req, res, next) => {
  try {
    const detail = await fetchDetail(req.params.id);
    if (!detail) throw new NotFoundError("ไม่พบรายการติดตามที่ต้องการ");
    if (!(await canAccess(req, detail))) throw new NotFoundError("ไม่พบรายการติดตามที่ต้องการ");
    res.json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
});

// 3. POST / - create
followUpsRouter.post("/", requireRole(...CREATE_ROLES), async (req, res, next) => {
  try {
    const parsed = followUpInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "ข้อมูลการติดตามไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const db = getDb();
    const { subjectMemberId, subjectGroupId, activityId, ownerId, note, dueAt, title } = parsed.data;

    const [created] = await db
      .insert(followUps)
      .values({
        title,
        note: note || null,
        subjectMemberId: subjectMemberId || null,
        subjectGroupId: subjectGroupId || null,
        activityId: activityId || null,
        ownerId: ownerId || req.user!.id,
        dueAt: dueAt || null,
        createdById: req.user!.id,
      })
      .returning();

    await logAudit({
      req,
      action: "FOLLOW_UP_CREATED",
      entityType: "follow_up",
      entityId: created.id,
      details: { title: created.title },
    });

    const detail = await fetchDetail(created.id);
    res.status(201).json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
});

// 4. PUT /:id - update fields
followUpsRouter.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const [existing] = await db.select().from(followUps).where(eq(followUps.id, id)).limit(1);
    if (!existing) throw new NotFoundError("ไม่พบรายการติดตามที่ต้องการแก้ไข");
    if (!(await canAccess(req, existing))) throw new ForbiddenError("คุณไม่มีสิทธิ์แก้ไขรายการติดตามนี้");

    const parsed = followUpUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const { subjectMemberId, subjectGroupId, activityId, ownerId, note, dueAt, title } = parsed.data;
    const nextSubjectMemberId = subjectMemberId !== undefined ? subjectMemberId || null : existing.subjectMemberId;
    const nextSubjectGroupId = subjectGroupId !== undefined ? subjectGroupId || null : existing.subjectGroupId;
    if (!nextSubjectMemberId && !nextSubjectGroupId) {
      throw new ValidationError("การติดตามต้องระบุบุคคลหรือกลุ่มอย่างน้อยหนึ่งอย่าง");
    }

    const [updated] = await db
      .update(followUps)
      .set({
        ...(title !== undefined && { title }),
        ...(note !== undefined && { note: note || null }),
        subjectMemberId: nextSubjectMemberId,
        subjectGroupId: nextSubjectGroupId,
        ...(activityId !== undefined && { activityId: activityId || null }),
        ...(ownerId !== undefined && { ownerId: ownerId || null }),
        ...(dueAt !== undefined && { dueAt: dueAt || null }),
        updatedAt: new Date(),
      })
      .where(eq(followUps.id, id))
      .returning();

    await logAudit({
      req,
      action: "FOLLOW_UP_UPDATED",
      entityType: "follow_up",
      entityId: id,
      details: { changes: Object.keys(parsed.data) },
    });

    const detail = await fetchDetail(updated.id);
    res.json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
});

// 5. PUT /:id/status - explicit lifecycle transition
followUpsRouter.put("/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = followUpStatusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        "สถานะไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const db = getDb();
    const [existing] = await db.select().from(followUps).where(eq(followUps.id, id)).limit(1);
    if (!existing) throw new NotFoundError("ไม่พบรายการติดตามที่ต้องการ");
    if (!(await canAccess(req, existing))) throw new ForbiddenError("คุณไม่มีสิทธิ์เปลี่ยนสถานะรายการติดตามนี้");

    const { status: nextStatus } = parsed.data;
    const allowedNext = STATUS_TRANSITIONS[existing.status];
    if (!allowedNext.includes(nextStatus)) {
      throw new ValidationError(`ไม่สามารถเปลี่ยนสถานะจาก "${existing.status}" ไปเป็น "${nextStatus}" ได้`);
    }

    const [updated] = await db
      .update(followUps)
      .set({
        status: nextStatus,
        completedAt: nextStatus === "completed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(followUps.id, id))
      .returning();

    await logAudit({
      req,
      action: "FOLLOW_UP_STATUS_CHANGED",
      entityType: "follow_up",
      entityId: id,
      details: { from: existing.status, to: nextStatus },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
