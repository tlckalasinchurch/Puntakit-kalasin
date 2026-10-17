import type { Request } from "express";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { groupMembers, members } from "../../shared/schema.js";
import type { UserRole } from "../../shared/schema.js";
import { ForbiddenError } from "./errors.js";
import { getLedGroupIds as getScopedGroupIds } from "./groupAccess.js";
import { withDescendantGroups } from "./membershipScope.js";

/**
 * Tenant scope for the `group_leader` role.
 *
 * One definition of "assigned": a user leads a group when `groups.leader_id`
 * or `groups.co_leader_id` is the user id (the field `/admin/users` writes).
 * A member is in scope when they have an ACTIVE `group_members` row in a group
 * the user leads. Every other role is unscoped here; their access is decided
 * by their role set in `shared/roles.ts`.
 */
export const isScopedRole = (role: UserRole): boolean => role === "group_leader";

export async function getLedGroupIds(userId: string): Promise<string[]> {
  return Array.from(await getScopedGroupIds(userId));
}

export async function leadsGroup(userId: string, groupId: string): Promise<boolean> {
  return (await getLedGroupIds(userId)).includes(groupId);
}

/** Members who are active in any of `groupIds` (members not deleted). */
async function activeMemberIdsIn(groupIds: string[]): Promise<string[]> {
  if (groupIds.length === 0) return [];
  const rows = await getDb()
    .selectDistinct({ id: groupMembers.memberId })
    .from(groupMembers)
    .innerJoin(members, eq(groupMembers.memberId, members.id))
    .where(and(inArray(groupMembers.groupId, groupIds), eq(groupMembers.status, "active"), isNull(members.deletedAt)));
  return rows.map((r) => r.id);
}

/** Ids of members who are active in any group the user leads. Write scope: direct groups only. */
export async function getScopedMemberIds(userId: string): Promise<string[]> {
  return activeMemberIdsIn(await getLedGroupIds(userId));
}

/**
 * READ scope: the groups a leader may look at — the groups they lead plus every
 * descendant (a body leader sees the care groups under the body). Cycle-safe.
 * Writes keep using `getLedGroupIds`, so a body leader reads but does not edit
 * a child care group's records.
 */
export async function getViewableGroupIds(userId: string): Promise<string[]> {
  const led = await getLedGroupIds(userId);
  if (led.length === 0) return [];
  return Array.from(await withDescendantGroups(led));
}

export async function viewsGroup(userId: string, groupId: string): Promise<boolean> {
  return (await getViewableGroupIds(userId)).includes(groupId);
}

/** READ scope for members: active members of any viewable group. */
export async function getViewableMemberIds(userId: string): Promise<string[]> {
  return activeMemberIdsIn(await getViewableGroupIds(userId));
}

/** Throws 403 unless the request user is unscoped, or leads `groupId`. */
export async function assertGroupInScope(req: Request, groupId: string | null | undefined): Promise<void> {
  const user = req.user!;
  if (!isScopedRole(user.role)) return;
  if (!groupId || !(await leadsGroup(user.id, groupId))) {
    throw new ForbiddenError("คุณไม่มีสิทธิ์เข้าถึงพันธกิจนี้");
  }
}

/** Throws 403 unless every id is in scope for a scoped user. No-op for other roles. */
export async function assertMembersInScope(req: Request, memberIds: string[]): Promise<void> {
  const user = req.user!;
  if (!isScopedRole(user.role) || memberIds.length === 0) return;
  const allowed = new Set(await getScopedMemberIds(user.id));
  if (memberIds.some((id) => !allowed.has(id))) {
    throw new ForbiddenError("คุณไม่มีสิทธิ์ดำเนินการกับสมาชิกนอกพันธกิจของคุณ");
  }
}

/** Phone mask used wherever a roster shows a number (same pattern as `maskSensitiveData`). */
export function maskPhone(phone: string | null): string | null {
  return phone ? phone.replace(/(\d{3})\d{3,4}(\d{3})/, "$1-xxx-$2") : null;
}

/** Show a phone number unmasked only to roles that may see contact data, or to a leader viewing their own scope. */
export function phoneForRole(phone: string | null, role: UserRole): string | null {
  return role === "super_admin" || role === "admin" || role === "staff" || role === "group_leader" ? phone : maskPhone(phone);
}
