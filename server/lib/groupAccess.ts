import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { groupMembers, groups, members, type UserRole } from "../../shared/schema.js";
import { ForbiddenError, NotFoundError } from "./errors.js";

/**
 * Group ownership: which groups a user leads. This is the single query behind
 * the group-scoped attendance and care routes, and behind
 * `verifyGroupManagementAccess` in `routes/groups.ts`.
 *
 * A user leads a group when ANY of these holds (groups and members not deleted):
 *   1. `groups.leader_id` is the user
 *   2. `groups.co_leader_id` is the user
 *   3. the member linked to the user (`members.user_id`) has an ACTIVE
 *      `group_members` row in the group with role `leader` or `assistant_leader`
 *
 * `groups.leader_member_id` is NOT an ownership source. It records the imported
 * care leader (หนค.) for display, not a permission grant.
 */
export async function getLedGroupIds(userId: string): Promise<Set<string>> {
  const db = getDb();

  const direct = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(isNull(groups.deletedAt), or(eq(groups.leaderId, userId), eq(groups.coLeaderId, userId))));

  const viaMembership = await db
    .select({ id: groups.id })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .innerJoin(members, eq(groupMembers.memberId, members.id))
    .where(
      and(
        eq(members.userId, userId),
        isNull(members.deletedAt),
        isNull(groups.deletedAt),
        eq(groupMembers.status, "active"),
        inArray(groupMembers.role, ["leader", "assistant_leader"])
      )
    );

  return new Set([...direct, ...viaMembership].map((r) => r.id));
}

/**
 * Which groups a caller may reach through the attendance and care routes.
 * `group_leader` is limited to the groups it leads. Every other role keeps the
 * reach its role gate already gives it, so this adds no permission.
 */
export type GroupScope = { kind: "all" } | { kind: "led"; ids: Set<string> };

export async function resolveGroupScope(user: { id: string; role: UserRole }): Promise<GroupScope> {
  if (user.role !== "group_leader") return { kind: "all" };
  return { kind: "led", ids: await getLedGroupIds(user.id) };
}

export function scopeAllows(scope: GroupScope, groupId: string): boolean {
  return scope.kind === "all" || scope.ids.has(groupId);
}

/** 404 when the group does not exist or is deleted. */
export async function assertGroupExists(groupId: string): Promise<void> {
  const db = getDb();
  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1);
  if (!group) throw new NotFoundError("ไม่พบข้อมูลกลุ่มที่ระบุ");
}

/**
 * Gate for attendance writes.
 * - A group that does not exist is 404 for every role.
 * - A `group_leader` must name a group (no group id -> 403) that it leads (-> 403).
 * - Other roles that reach the route are unchanged: a group id is optional.
 */
export async function assertGroupWriteAccess(
  user: { id: string; role: UserRole },
  groupId: string | null | undefined
): Promise<void> {
  const id = groupId || null;
  if (id) await assertGroupExists(id);

  if (user.role !== "group_leader") return;
  if (!id) throw new ForbiddenError("ต้องระบุกลุ่มที่คุณดูแลสำหรับการบันทึกการเช็คชื่อ");
  if (!(await getLedGroupIds(user.id)).has(id)) {
    throw new ForbiddenError("คุณไม่มีสิทธิ์บันทึกการเช็คชื่อของกลุ่มนี้");
  }
}

/**
 * Member <-> group integrity for a `group_leader` attendance write that names a
 * group: every member must be an ACTIVE member of that group
 * (group_members.status = active, member not deleted). One failing member
 * rejects the whole request (403), so a bulk save never writes part of its rows.
 *
 * Only a `group_leader` is held to this. admin, staff and ministry_leader keep
 * the earlier behaviour: they may record a visitor or an unassigned member
 * against the selected group, so the member need not belong to it.
 */
export async function assertMembersInLedGroup(
  user: { role: UserRole },
  groupId: string,
  memberIds: string[]
): Promise<void> {
  if (user.role !== "group_leader") return;

  const wanted = Array.from(new Set(memberIds));
  if (wanted.length === 0) return;

  const db = getDb();
  const found = await db
    .select({ id: groupMembers.memberId })
    .from(groupMembers)
    .innerJoin(members, eq(groupMembers.memberId, members.id))
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.status, "active"),
        isNull(members.deletedAt),
        inArray(groupMembers.memberId, wanted)
      )
    );

  if (found.length < wanted.length) {
    throw new ForbiddenError("สมาชิกที่เลือกไม่ได้เป็นสมาชิกที่ใช้งานอยู่ของกลุ่มนี้");
  }
}
