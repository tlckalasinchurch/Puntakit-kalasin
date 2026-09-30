import { Router } from "express";
import { and, count, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  announcements,
  events,
  followUps,
  groups,
  members,
  missionActivities,
  missionSubmissions,
  users,
} from "../../shared/schema.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

const OPERATIONS_ROLES = ["super_admin", "admin", "staff", "ministry_leader"] as const;
const INACTIVE_GROUP_DAYS = 14;

dashboardRouter.get("/summary", async (_req, res, next) => {
  try {
    const db = getDb();

    // Calculate beginning of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Total active members
    const [totalResult] = await db
      .select({ count: count() })
      .from(members)
      .where(isNull(members.deletedAt));
    const totalMembers = Number(totalResult?.count ?? 0);

    // 2. New members this month
    const [newResult] = await db
      .select({ count: count() })
      .from(members)
      .where(and(isNull(members.deletedAt), gte(members.joinedAt, startOfMonth)));
    const newThisMonth = Number(newResult?.count ?? 0);

    // 3. Need follow-up count
    const [needFollowResult] = await db
      .select({ count: count() })
      .from(members)
      .where(and(isNull(members.deletedAt), eq(members.status, "ต้องติดตาม")));
    const needFollowUp = Number(needFollowResult?.count ?? 0);

    // 4. Followed up count
    const [followedResult] = await db
      .select({ count: count() })
      .from(members)
      .where(and(isNull(members.deletedAt), eq(members.status, "ติดตามแล้ว")));
    const followedUp = Number(followedResult?.count ?? 0);

    // 5. In group count (members assigned to a cell group)
    const [inGroupResult] = await db
      .select({ count: count() })
      .from(members)
      .where(and(isNull(members.deletedAt), eq(members.membershipStatus, "active")));
    const activeMembers = Number(inGroupResult?.count ?? 0);

    // 6. Recent 5 members
    const recentMembers = await db
      .select({
        id: members.id,
        name: members.name,
        nickname: members.nickname,
        role: members.role,
        area: members.area,
        status: members.status,
        joinedAt: members.joinedAt,
      })
      .from(members)
      .where(isNull(members.deletedAt))
      .orderBy(desc(members.createdAt))
      .limit(5);

    // 7. Recent announcements
    const recentAnnouncements = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        publishDate: announcements.publishDate,
        status: announcements.status,
      })
      .from(announcements)
      .orderBy(desc(announcements.publishDate))
      .limit(3);

    res.json({
      success: true,
      data: {
        totalMembers,
        newThisMonth,
        needFollowUp,
        followedUp,
        activeMembers,
        recentMembers,
        recentAnnouncements,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Operations: "what happened, what's waiting, what needs attention, what
 * should happen next" — real aggregates over Phase 1-5 tables (Mission
 * Activity, Follow-up, Mission Inbox), not fabricated scores. Restricted to
 * the same privileged roles that can review Inbox submissions and see every
 * Activity/Follow-up regardless of status, since this view exists to
 * surface exactly that otherwise-hidden queue.
 */
dashboardRouter.get("/operations", requireRole(...OPERATIONS_ROLES), async (_req, res, next) => {
  try {
    const db = getDb();
    const now = new Date();
    const inactiveCutoff = new Date(now.getTime() - INACTIVE_GROUP_DAYS * 24 * 60 * 60 * 1000);

    const [pendingSubmissionsCount] = await db
      .select({ count: count() })
      .from(missionSubmissions)
      .where(inArray(missionSubmissions.status, ["new", "reviewing", "needs_info"]));

    const pendingSubmissions = await db
      .select({
        id: missionSubmissions.id,
        status: missionSubmissions.status,
        rawText: missionSubmissions.rawText,
        submittedByLabel: missionSubmissions.submittedByLabel,
        createdAt: missionSubmissions.createdAt,
      })
      .from(missionSubmissions)
      .where(inArray(missionSubmissions.status, ["new", "reviewing", "needs_info"]))
      .orderBy(desc(missionSubmissions.createdAt))
      .limit(5);

    const [openFollowUpsCount] = await db
      .select({ count: count() })
      .from(followUps)
      .where(inArray(followUps.status, ["open", "in_progress"]));

    const [overdueFollowUpsCount] = await db
      .select({ count: count() })
      .from(followUps)
      .where(and(inArray(followUps.status, ["open", "in_progress"]), lt(followUps.dueAt, now)));

    const overdueFollowUps = await db
      .select({
        id: followUps.id,
        title: followUps.title,
        dueAt: followUps.dueAt,
        subjectMemberId: followUps.subjectMemberId,
        subjectMemberName: members.name,
        subjectGroupId: followUps.subjectGroupId,
        subjectGroupName: groups.name,
        ownerName: users.name,
      })
      .from(followUps)
      .leftJoin(members, eq(followUps.subjectMemberId, members.id))
      .leftJoin(groups, eq(followUps.subjectGroupId, groups.id))
      .leftJoin(users, eq(followUps.ownerId, users.id))
      .where(and(inArray(followUps.status, ["open", "in_progress"]), lt(followUps.dueAt, now)))
      .orderBy(followUps.dueAt)
      .limit(5);

    // Groups with no Mission Activity in the last INACTIVE_GROUP_DAYS days.
    const inactiveGroups = await db
      .select({ id: groups.id, name: groups.name, category: groups.category })
      .from(groups)
      .where(
        and(
          isNull(groups.deletedAt),
          eq(groups.status, "active"),
          sql`${groups.id} not in (
            select ${missionActivities.groupId} from ${missionActivities}
            where ${missionActivities.groupId} is not null
              and ${missionActivities.deletedAt} is null
              and ${missionActivities.occurredAt} >= ${inactiveCutoff}
          )`
        )
      )
      .orderBy(groups.name)
      .limit(10);

    const recentActivity = await db
      .select({
        id: missionActivities.id,
        type: missionActivities.type,
        status: missionActivities.status,
        title: missionActivities.title,
        occurredAt: missionActivities.occurredAt,
        groupName: groups.name,
      })
      .from(missionActivities)
      .leftJoin(groups, eq(missionActivities.groupId, groups.id))
      .where(isNull(missionActivities.deletedAt))
      .orderBy(desc(missionActivities.occurredAt))
      .limit(5);

    const upcomingEvents = await db
      .select({ id: events.id, title: events.title, eventDate: events.eventDate, category: events.category })
      .from(events)
      .where(and(gte(events.eventDate, now), eq(events.status, "scheduled")))
      .orderBy(events.eventDate)
      .limit(5);

    res.json({
      success: true,
      data: {
        pendingSubmissionsCount: Number(pendingSubmissionsCount?.count ?? 0),
        pendingSubmissions,
        openFollowUpsCount: Number(openFollowUpsCount?.count ?? 0),
        overdueFollowUpsCount: Number(overdueFollowUpsCount?.count ?? 0),
        overdueFollowUps,
        inactiveGroups,
        recentActivity,
        upcomingEvents,
      },
    });
  } catch (err) {
    next(err);
  }
});
