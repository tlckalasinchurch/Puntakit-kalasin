import { Router, type Request } from "express";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  groups,
  members,
  missionActivities,
  missionActivityMedia,
  missionActivityParticipants,
  users,
  type MissionActivityStatus,
  type UserRole,
} from "../../shared/schema.js";
import {
  missionActivityInputSchema,
  missionActivityQuerySchema,
  missionActivityStatusUpdateSchema,
} from "../../shared/validation.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";

export const activitiesRouter = Router();

activitiesRouter.use(requireAuth);

/**
 * Roles that can see every activity (any status) and manage any activity,
 * regardless of who created it or which group it belongs to. Reuses the
 * existing USER_ROLES enum — no separate permission system.
 */
const PRIVILEGED_ROLES: UserRole[] = ["super_admin", "admin", "staff", "ministry_leader"];
const CREATE_ROLES: UserRole[] = ["super_admin", "admin", "staff", "ministry_leader", "group_leader"];
const PUBLISH_ROLES: UserRole[] = ["super_admin", "admin", "staff", "ministry_leader"];
const DELETE_ROLES: UserRole[] = ["super_admin", "admin", "ministry_leader"];

/**
 * Explicit lifecycle transitions. No status value may move to a state not
 * listed here — arbitrary status values are rejected by
 * `missionActivityStatusUpdateSchema`'s enum, and arbitrary *transitions*
 * are rejected here.
 */
const STATUS_TRANSITIONS: Record<MissionActivityStatus, MissionActivityStatus[]> = {
  draft: ["pending_review", "published", "archived"],
  pending_review: ["published", "draft", "archived"],
  published: ["archived"],
  archived: ["draft"],
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

/** Read access: privileged roles see everything; everyone else sees published
 * activities, their own (any status), and — for group leaders — activities
 * tied to a group they lead (any status). */
async function canRead(
  req: Request,
  activity: { status: string; createdById: string | null; groupId: string | null }
): Promise<boolean> {
  const user = req.user!;
  if (isPrivileged(user.role)) return true;
  if (activity.status === "published") return true;
  if (activity.createdById === user.id) return true;
  if (user.role === "group_leader" && activity.groupId) {
    const ledGroupIds = await getLedGroupIds(user.id);
    return ledGroupIds.includes(activity.groupId);
  }
  return false;
}

/** Write access for editing core fields or deleting: privileged roles, the
 * activity's creator, or a group leader for that activity's group. */
async function canManage(
  req: Request,
  activity: { createdById: string | null; groupId: string | null }
): Promise<boolean> {
  const user = req.user!;
  if (isPrivileged(user.role)) return true;
  if (activity.createdById === user.id) return true;
  if (user.role === "group_leader" && activity.groupId) {
    const ledGroupIds = await getLedGroupIds(user.id);
    return ledGroupIds.includes(activity.groupId);
  }
  return false;
}

/** Publishing (and any transition into "published") requires an elevated
 * role or leadership of the activity's group — a field worker can submit
 * for review but should not be the one who marks it official. */
async function canPublish(
  req: Request,
  activity: { groupId: string | null }
): Promise<boolean> {
  const user = req.user!;
  if (PUBLISH_ROLES.includes(user.role)) return true;
  if (user.role === "group_leader" && activity.groupId) {
    const ledGroupIds = await getLedGroupIds(user.id);
    return ledGroupIds.includes(activity.groupId);
  }
  return false;
}

async function fetchActivityDetail(id: string) {
  const db = getDb();
  const [activity] = await db
    .select({
      id: missionActivities.id,
      type: missionActivities.type,
      status: missionActivities.status,
      title: missionActivities.title,
      story: missionActivities.story,
      occurredAt: missionActivities.occurredAt,
      groupId: missionActivities.groupId,
      groupName: groups.name,
      placeLabel: missionActivities.placeLabel,
      latitude: missionActivities.latitude,
      longitude: missionActivities.longitude,
      createdById: missionActivities.createdById,
      createdByName: users.name,
      createdAt: missionActivities.createdAt,
      updatedAt: missionActivities.updatedAt,
    })
    .from(missionActivities)
    .leftJoin(groups, eq(missionActivities.groupId, groups.id))
    .leftJoin(users, eq(missionActivities.createdById, users.id))
    .where(and(eq(missionActivities.id, id), isNull(missionActivities.deletedAt)))
    .limit(1);

  if (!activity) return null;

  const participants = await db
    .select({
      memberId: members.id,
      memberName: members.name,
      memberNickname: members.nickname,
      memberAvatarUrl: members.avatarUrl,
    })
    .from(missionActivityParticipants)
    .innerJoin(members, eq(missionActivityParticipants.memberId, members.id))
    .where(eq(missionActivityParticipants.activityId, id));

  const media = await db
    .select({
      id: missionActivityMedia.id,
      url: missionActivityMedia.url,
      kind: missionActivityMedia.kind,
      sortOrder: missionActivityMedia.sortOrder,
    })
    .from(missionActivityMedia)
    .where(eq(missionActivityMedia.activityId, id))
    .orderBy(asc(missionActivityMedia.sortOrder));

  return { ...activity, participants, media };
}

async function replaceParticipantsAndMedia(
  activityId: string,
  participantMemberIds: string[] | undefined,
  media: { url: string; kind: "image" | "video" }[] | undefined
) {
  const db = getDb();

  if (participantMemberIds !== undefined) {
    await db.delete(missionActivityParticipants).where(eq(missionActivityParticipants.activityId, activityId));
    if (participantMemberIds.length > 0) {
      const uniqueIds = Array.from(new Set(participantMemberIds));
      const existingMembers = await db
        .select({ id: members.id })
        .from(members)
        .where(and(inArray(members.id, uniqueIds), isNull(members.deletedAt)));
      const validIds = new Set(existingMembers.map((m) => m.id));
      const rows = uniqueIds.filter((mId) => validIds.has(mId)).map((memberId) => ({ activityId, memberId }));
      if (rows.length > 0) {
        await db.insert(missionActivityParticipants).values(rows);
      }
    }
  }

  if (media !== undefined) {
    await db.delete(missionActivityMedia).where(eq(missionActivityMedia.activityId, activityId));
    if (media.length > 0) {
      await db.insert(missionActivityMedia).values(
        media.map((m, index) => ({
          activityId,
          url: m.url,
          kind: m.kind,
          sortOrder: index,
        }))
      );
    }
  }
}

// 1. GET / - list activities (Feed source query), filtered by role-based visibility
activitiesRouter.get("/", async (req, res, next) => {
  try {
    const parsed = missionActivityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(
        "พารามิเตอร์การค้นหาไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const { page, limit, type, status, groupId, memberId, startDate, endDate, search } = parsed.data;
    const offset = (page - 1) * limit;
    const db = getDb();
    const user = req.user!;

    const conditions = [isNull(missionActivities.deletedAt)];

    if (!isPrivileged(user.role)) {
      const visibilityConditions = [eq(missionActivities.status, "published"), eq(missionActivities.createdById, user.id)];
      if (user.role === "group_leader") {
        const ledGroupIds = await getLedGroupIds(user.id);
        if (ledGroupIds.length > 0) {
          visibilityConditions.push(inArray(missionActivities.groupId, ledGroupIds));
        }
      }
      conditions.push(or(...visibilityConditions)!);
    }

    if (type) conditions.push(eq(missionActivities.type, type));
    if (status) conditions.push(eq(missionActivities.status, status));
    if (groupId) conditions.push(eq(missionActivities.groupId, groupId));
    if (startDate) conditions.push(gte(missionActivities.occurredAt, new Date(startDate)));
    if (endDate) conditions.push(lte(missionActivities.occurredAt, new Date(endDate)));
    if (search) {
      conditions.push(
        or(ilike(missionActivities.title, `%${search}%`), ilike(missionActivities.story, `%${search}%`))!
      );
    }

    let activityIds: string[] | null = null;
    if (memberId) {
      const participantRows = await db
        .select({ activityId: missionActivityParticipants.activityId })
        .from(missionActivityParticipants)
        .where(eq(missionActivityParticipants.memberId, memberId));
      activityIds = participantRows.map((r) => r.activityId);
      if (activityIds.length === 0) {
        return res.json({ success: true, data: [], meta: { page, limit, total: 0, totalPages: 1 } });
      }
      conditions.push(inArray(missionActivities.id, activityIds));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db.select({ total: count() }).from(missionActivities).where(whereClause);
    const total = Number(countResult?.total ?? 0);

    const rows = await db
      .select({
        id: missionActivities.id,
        type: missionActivities.type,
        status: missionActivities.status,
        title: missionActivities.title,
        story: missionActivities.story,
        occurredAt: missionActivities.occurredAt,
        groupId: missionActivities.groupId,
        groupName: groups.name,
        placeLabel: missionActivities.placeLabel,
        latitude: missionActivities.latitude,
        longitude: missionActivities.longitude,
        createdById: missionActivities.createdById,
        createdByName: users.name,
        createdAt: missionActivities.createdAt,
        // Feed is photo-first: cheapest way to get one ordered thumbnail per
        // row without a second round-trip or duplicating media data.
        thumbnailUrl: sql<string | null>`(
          select ${missionActivityMedia.url} from ${missionActivityMedia}
          where ${missionActivityMedia.activityId} = ${missionActivities.id}
          order by ${missionActivityMedia.sortOrder} asc limit 1
        )`,
      })
      .from(missionActivities)
      .leftJoin(groups, eq(missionActivities.groupId, groups.id))
      .leftJoin(users, eq(missionActivities.createdById, users.id))
      .where(whereClause)
      .orderBy(desc(missionActivities.occurredAt))
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      data: rows,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
});

// 2. GET /:id - activity detail with participants and media
activitiesRouter.get("/:id", async (req, res, next) => {
  try {
    const detail = await fetchActivityDetail(req.params.id);
    if (!detail) {
      throw new NotFoundError("ไม่พบกิจกรรมพันธกิจที่ต้องการ");
    }
    if (!(await canRead(req, detail))) {
      throw new NotFoundError("ไม่พบกิจกรรมพันธกิจที่ต้องการ");
    }
    res.json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
});

// 3. POST / - create activity (draft by default)
activitiesRouter.post("/", requireRole(...CREATE_ROLES), async (req, res, next) => {
  try {
    const parsed = missionActivityInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "ข้อมูลกิจกรรมไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const { participantMemberIds, media, ...activityFields } = parsed.data;
    const db = getDb();

    const [created] = await db
      .insert(missionActivities)
      .values({
        ...activityFields,
        story: activityFields.story || null,
        groupId: activityFields.groupId || null,
        placeLabel: activityFields.placeLabel || null,
        latitude: activityFields.latitude || null,
        longitude: activityFields.longitude || null,
        createdById: req.user!.id,
      })
      .returning();

    await replaceParticipantsAndMedia(created.id, participantMemberIds, media);

    await logAudit({
      req,
      action: "MISSION_ACTIVITY_CREATED",
      entityType: "mission_activity",
      entityId: created.id,
      details: { title: created.title, type: created.type },
    });

    const detail = await fetchActivityDetail(created.id);
    res.status(201).json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
});

// 4. PUT /:id - update core fields (and optionally participants/media)
activitiesRouter.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(missionActivities)
      .where(and(eq(missionActivities.id, id), isNull(missionActivities.deletedAt)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("ไม่พบกิจกรรมพันธกิจที่ต้องการแก้ไข");
    }
    if (!(await canManage(req, existing))) {
      throw new ForbiddenError("คุณไม่มีสิทธิ์แก้ไขกิจกรรมนี้");
    }

    const parsed = missionActivityInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const { participantMemberIds, media, ...activityFields } = parsed.data;

    const [updated] = await db
      .update(missionActivities)
      .set({
        ...activityFields,
        groupId: activityFields.groupId !== undefined ? activityFields.groupId || null : existing.groupId,
        updatedAt: new Date(),
      })
      .where(eq(missionActivities.id, id))
      .returning();

    await replaceParticipantsAndMedia(id, participantMemberIds, media);

    await logAudit({
      req,
      action: "MISSION_ACTIVITY_UPDATED",
      entityType: "mission_activity",
      entityId: id,
      details: { changes: Object.keys(parsed.data) },
    });

    const detail = await fetchActivityDetail(updated.id);
    res.json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
});

// 5. PUT /:id/status - explicit lifecycle transition (draft -> pending_review -> published -> archived)
activitiesRouter.put("/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = missionActivityStatusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        "สถานะไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const db = getDb();
    const [existing] = await db
      .select()
      .from(missionActivities)
      .where(and(eq(missionActivities.id, id), isNull(missionActivities.deletedAt)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("ไม่พบกิจกรรมพันธกิจที่ต้องการ");
    }

    const { status: nextStatus } = parsed.data;
    const allowedNext = STATUS_TRANSITIONS[existing.status];
    if (!allowedNext.includes(nextStatus)) {
      throw new ValidationError(
        `ไม่สามารถเปลี่ยนสถานะจาก "${existing.status}" ไปเป็น "${nextStatus}" ได้`
      );
    }

    const hasManageAccess = await canManage(req, existing);
    if (!hasManageAccess) {
      throw new ForbiddenError("คุณไม่มีสิทธิ์เปลี่ยนสถานะกิจกรรมนี้");
    }

    if (nextStatus === "published" && !(await canPublish(req, existing))) {
      throw new ForbiddenError("คุณไม่มีสิทธิ์เผยแพร่กิจกรรมนี้ ต้องได้รับการตรวจสอบจากผู้นำก่อน");
    }

    const [updated] = await db
      .update(missionActivities)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(missionActivities.id, id))
      .returning();

    await logAudit({
      req,
      action: "MISSION_ACTIVITY_STATUS_CHANGED",
      entityType: "mission_activity",
      entityId: id,
      details: { from: existing.status, to: nextStatus },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// 6. DELETE /:id - soft delete
activitiesRouter.delete("/:id", requireRole(...DELETE_ROLES), async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const [deleted] = await db
      .update(missionActivities)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(missionActivities.id, id), isNull(missionActivities.deletedAt)))
      .returning();

    if (!deleted) {
      throw new NotFoundError("ไม่พบกิจกรรม หรือถูกลบไปแล้ว");
    }

    await logAudit({
      req,
      action: "MISSION_ACTIVITY_SOFT_DELETED",
      entityType: "mission_activity",
      entityId: deleted.id,
      details: { title: deleted.title },
    });

    res.json({ success: true, data: deleted });
  } catch (err) {
    next(err);
  }
});
