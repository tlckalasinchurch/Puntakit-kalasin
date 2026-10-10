import { Router } from "express";
import { and, count, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  followUps,
  groups,
  members,
  membershipTerms,
  missionActivities,
  missionActivityMedia,
  type UserRole,
} from "../../shared/schema.js";
import { ADMIN_SHELL_ROLES, MEMBERSHIP_PAYMENT_ROLES, MEMBERSHIP_VIEW_ROLES, PRIVILEGED_ROLES } from "../../shared/roles.js";
import { summarizeMembership, todayInThailand } from "../../shared/membership.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { memberIdsInGroups, resolveMembershipScope } from "../lib/membershipScope.js";
import { getLedGroupIds as getDirectLedGroupIds } from "../lib/careScope.js";

/**
 * "My home": the numbers a person sees first, computed ONLY from rows that
 * exist, inside the scope their role and groups allow.
 *
 * - office roles / ministry_leader: the whole church;
 * - group_leader: the groups they lead, plus the care groups nested under a
 *   body they lead.
 *
 * There is no weekly-report table yet, so nothing here pretends to be one: no
 * targets, no scores, no "reports submitted". Counts are what the registers
 * and the activity feed actually contain.
 */
export const homeRouter = Router();

homeRouter.use(requireAuth, requireRole(...ADMIN_SHELL_ROLES));

const RECENT_DAYS = 30;

interface HomeScope {
  /** null = the whole church */
  groupIds: string[] | null;
  label: string;
}

async function resolveHomeScope(user: { id: string; role: UserRole }): Promise<HomeScope> {
  if (user.role !== "group_leader") {
    return { groupIds: null, label: PRIVILEGED_ROLES.includes(user.role) ? "ภาพรวมทั้งคริสตจักร" : "ภาพรวมคริสตจักร" };
  }
  const scope = await resolveMembershipScope(user);
  const ids = scope.kind === "groups" ? Array.from(scope.viewGroupIds) : [];
  return { groupIds: ids, label: "พันธกิจของฉัน" };
}

homeRouter.get("/overview", async (req, res, next) => {
  try {
    const user = req.user!;
    const db = getDb();
    const scope = await resolveHomeScope(user);
    const ledByMe = user.role === "group_leader" ? await getDirectLedGroupIds(user.id) : [];

    // --- groups in scope ---------------------------------------------------
    const groupRows =
      scope.groupIds === null
        ? await db
            .select({ id: groups.id, name: groups.name, orgLevel: groups.orgLevel })
            .from(groups)
            .where(and(isNull(groups.deletedAt), eq(groups.orgLevel, "care")))
        : scope.groupIds.length === 0
          ? []
          : await db
              .select({ id: groups.id, name: groups.name, orgLevel: groups.orgLevel })
              .from(groups)
              .where(and(isNull(groups.deletedAt), inArray(groups.id, scope.groupIds)));

    // --- members in scope --------------------------------------------------
    let memberIds: string[] | null = null;
    let memberCount: number;
    if (scope.groupIds === null) {
      const [row] = await db.select({ n: count() }).from(members).where(isNull(members.deletedAt));
      memberCount = Number(row?.n ?? 0);
    } else {
      memberIds = await memberIdsInGroups(new Set(scope.groupIds));
      memberCount = memberIds.length;
    }

    // --- membership attention (only for roles allowed to see membership) ----
    let membership: { attention: number; trialReview: number; unpaid: number } | null = null;
    if (MEMBERSHIP_VIEW_ROLES.includes(user.role)) {
      const today = todayInThailand();
      const terms =
        memberIds !== null && memberIds.length === 0
          ? []
          : await db
              .select({ term: membershipTerms })
              .from(membershipTerms)
              .innerJoin(members, eq(membershipTerms.memberId, members.id))
              .where(
                and(
                  eq(membershipTerms.status, "open"),
                  isNull(members.deletedAt),
                  memberIds ? inArray(membershipTerms.memberId, memberIds) : undefined
                )
              );
      let attention = 0;
      let trialReview = 0;
      let unpaid = 0;
      for (const { term } of terms) {
        const s = summarizeMembership([term], today);
        if (s.needsAttention) attention += 1;
        if (s.state === "trial_review_due") trialReview += 1;
        if (term.type === "ordinary" && term.paymentStatus === "unpaid") unpaid += 1;
      }
      membership = { attention, trialReview, unpaid };
    }

    // --- recent mission activity & photos ----------------------------------
    const since = new Date(Date.now() - RECENT_DAYS * 86_400_000);
    // Same visibility as `GET /api/activities` (a photo listed here must be one
    // the person can actually open): privileged roles see every status; anyone
    // else sees published activities, and a group_leader additionally sees
    // activities of the groups they LEAD (any status) and their own. A body
    // leader therefore sees published photos of the care groups below them,
    // not their drafts. Non-privileged roles are limited to their scope groups.
    const inScope = scope.groupIds === null ? undefined : scope.groupIds.length === 0 ? sql`false` : inArray(missionActivities.groupId, scope.groupIds);
    const visible =
      user.role === "group_leader"
        ? or(
            eq(missionActivities.status, "published"),
            eq(missionActivities.createdById, user.id),
            ledByMe.length > 0 ? inArray(missionActivities.groupId, ledByMe) : undefined
          )
        : eq(missionActivities.status, "published");
    const activityScope = PRIVILEGED_ROLES.includes(user.role)
      ? undefined
      : user.role === "group_leader"
        ? or(and(inScope, visible), eq(missionActivities.createdById, user.id))
        : visible;
    const [activityCount] = await db
      .select({ n: count() })
      .from(missionActivities)
      .where(and(isNull(missionActivities.deletedAt), gte(missionActivities.occurredAt, since), activityScope));

    const photoRows = await db
      .select({
        activityId: missionActivities.id,
        title: missionActivities.title,
        occurredAt: missionActivities.occurredAt,
        groupName: groups.name,
        url: missionActivityMedia.url,
        sortOrder: missionActivityMedia.sortOrder,
      })
      .from(missionActivityMedia)
      .innerJoin(missionActivities, eq(missionActivityMedia.activityId, missionActivities.id))
      .leftJoin(groups, eq(missionActivities.groupId, groups.id))
      .where(
        and(
          isNull(missionActivities.deletedAt),
          eq(missionActivityMedia.kind, "image"),
          activityScope
        )
      )
      .orderBy(desc(missionActivities.occurredAt), missionActivityMedia.sortOrder)
      .limit(40);
    const seen = new Set<string>();
    const recentPhotos = [];
    for (const p of photoRows) {
      if (seen.has(p.activityId)) continue;
      seen.add(p.activityId);
      recentPhotos.push({ activityId: p.activityId, title: p.title, occurredAt: p.occurredAt, groupName: p.groupName, url: p.url });
      if (recentPhotos.length >= 6) break;
    }

    // --- my open follow-ups --------------------------------------------------
    const [followUpCount] = await db
      .select({ n: count() })
      .from(followUps)
      .where(and(eq(followUps.ownerId, user.id), inArray(followUps.status, ["open", "in_progress"])));

    res.json({
      success: true,
      data: {
        role: user.role,
        scopeLabel: scope.label,
        scopeIsWholeChurch: scope.groupIds === null,
        counts: {
          groups: groupRows.length,
          members: memberCount,
          activitiesLast30Days: Number(activityCount?.n ?? 0),
          openFollowUps: Number(followUpCount?.n ?? 0),
        },
        // Groups the user may post photos for (the ones they lead; everyone else: any care group).
        photoGroups:
          user.role === "group_leader"
            ? groupRows.filter((g) => ledByMe.includes(g.id)).map((g) => ({ id: g.id, name: g.name.trim() }))
            : groupRows.map((g) => ({ id: g.id, name: g.name.trim() })).slice(0, 200),
        membership,
        canRecordPayment: MEMBERSHIP_PAYMENT_ROLES.includes(user.role),
        recentPhotos,
      },
    });
  } catch (err) {
    next(err);
  }
});
