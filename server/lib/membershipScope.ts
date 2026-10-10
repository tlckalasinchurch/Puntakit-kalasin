import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { groupMembers, groups, members, type UserRole } from "../../shared/schema.js";
import { MEMBERSHIP_DECIDE_ROLES, MEMBERSHIP_VIEW_ROLES } from "../../shared/roles.js";
import { ForbiddenError } from "./errors.js";
import { getLedGroupIds } from "./groupAccess.js";

/**
 * Who may see / act on a member's membership term.
 *
 * Roles are the existing ones (`shared/roles.ts`); "หัวหน้าแคร์" and
 * "หัวหน้าบอดี้" are NOT roles, they are a `group_leader` who leads a care or
 * a body group (`groups.leader_id` / `co_leader_id`, or a leader membership —
 * see `getLedGroupIds`). So:
 *
 * - office roles (super_admin / admin / staff): every member;
 * - `group_leader`, VIEW: members active in a group they lead, plus members of
 *   the groups nested under those (a body leader sees their care groups);
 * - `group_leader`, DECIDE: only members active in a group they lead directly
 *   (the care leader reviews the trial; a body leader looks but does not act);
 * - everyone else (viewer, member, ministry_leader): nothing.
 *
 * The UI only mirrors this. Every membership endpoint calls into it.
 */

export type MembershipScope =
  | { kind: "all"; canDecide: true }
  | { kind: "groups"; viewGroupIds: Set<string>; decideGroupIds: Set<string> }
  | { kind: "none" };

const OFFICE_ROLES: readonly UserRole[] = ["super_admin", "admin", "staff"];

/** `rootIds` plus every group below them (parent_group_id chain, cycle-safe). */
export async function withDescendantGroups(rootIds: Iterable<string>): Promise<Set<string>> {
  const db = getDb();
  const all = new Set(rootIds);
  let frontier = Array.from(all);
  while (frontier.length > 0) {
    const children = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(inArray(groups.parentGroupId, frontier), isNull(groups.deletedAt)));
    frontier = children.map((c) => c.id).filter((id) => !all.has(id));
    for (const id of frontier) all.add(id);
  }
  return all;
}

export async function resolveMembershipScope(user: { id: string; role: UserRole }): Promise<MembershipScope> {
  if (OFFICE_ROLES.includes(user.role)) return { kind: "all", canDecide: true };
  if (user.role !== "group_leader") return { kind: "none" };
  const led = await getLedGroupIds(user.id);
  if (led.size === 0) return { kind: "groups", viewGroupIds: new Set(), decideGroupIds: new Set() };
  return { kind: "groups", viewGroupIds: await withDescendantGroups(led), decideGroupIds: led };
}

/** Members who are active in any of `groupIds` (members and groups not deleted). */
export async function memberIdsInGroups(groupIds: Set<string>): Promise<string[]> {
  if (groupIds.size === 0) return [];
  const rows = await getDb()
    .selectDistinct({ id: groupMembers.memberId })
    .from(groupMembers)
    .innerJoin(members, eq(groupMembers.memberId, members.id))
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(
      and(
        inArray(groupMembers.groupId, Array.from(groupIds)),
        eq(groupMembers.status, "active"),
        isNull(members.deletedAt),
        isNull(groups.deletedAt)
      )
    );
  return rows.map((r) => r.id);
}

/** True when `memberId` is active in one of `groupIds`. */
async function inGroups(memberId: string, groupIds: Set<string>): Promise<boolean> {
  if (groupIds.size === 0) return false;
  const rows = await getDb()
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(
      and(
        eq(groupMembers.memberId, memberId),
        inArray(groupMembers.groupId, Array.from(groupIds)),
        eq(groupMembers.status, "active"),
        isNull(groups.deletedAt)
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function canViewMember(scope: MembershipScope, role: UserRole, memberId: string): Promise<boolean> {
  if (!MEMBERSHIP_VIEW_ROLES.includes(role)) return false;
  if (scope.kind === "all") return true;
  if (scope.kind === "none") return false;
  return inGroups(memberId, scope.viewGroupIds);
}

export async function canDecideForMember(scope: MembershipScope, role: UserRole, memberId: string): Promise<boolean> {
  if (!MEMBERSHIP_DECIDE_ROLES.includes(role)) return false;
  if (scope.kind === "all") return true;
  if (scope.kind === "none") return false;
  return inGroups(memberId, scope.decideGroupIds);
}

/** 403 helpers: the same message either way, so the answer never confirms a member exists. */
export async function assertCanView(scope: MembershipScope, role: UserRole, memberId: string): Promise<void> {
  if (!(await canViewMember(scope, role, memberId))) {
    throw new ForbiddenError("คุณไม่มีสิทธิ์ดูสถานะสมาชิกคนนี้");
  }
}

export async function assertCanDecide(scope: MembershipScope, role: UserRole, memberId: string): Promise<void> {
  if (!(await canDecideForMember(scope, role, memberId))) {
    throw new ForbiddenError("คุณไม่มีสิทธิ์ดำเนินการกับสมาชิกคนนี้");
  }
}
