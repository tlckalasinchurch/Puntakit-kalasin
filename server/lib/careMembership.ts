import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { groupMembers, groups, members } from "../../shared/schema.js";
import { ValidationError } from "./errors.js";

/**
 * A member's CARE GROUP is a real membership (`group_members` row of a group
 * with `org_level = 'care'`), not the free-text `members.group`. The text is
 * still written, as a display label, so older screens keep working.
 *
 * One person belongs to at most one care group at a time: choosing a new one
 * ends the previous membership (status `inactive`, `left_at` set) instead of
 * deleting it, so history stays. Choosing a group the person left before
 * reactivates that row (the (group, member) pair is unique).
 */

export type CareGroupRef = { id: string; name: string; bodyName: string | null };

/** Returns the live care group, or throws a 400 the form can show. */
export async function requireCareGroup(db: Database, careGroupId: string): Promise<{ id: string; name: string }> {
  const [row] = await db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(and(eq(groups.id, careGroupId), eq(groups.orgLevel, "care"), isNull(groups.deletedAt)))
    .limit(1);
  if (!row) throw new ValidationError("ไม่พบพันธกิจที่เลือก", [{ field: "careGroupId", message: "ไม่พบพันธกิจที่เลือก" }]);
  return { id: row.id, name: row.name.trim() };
}

/**
 * Statements that make `careGroupId` (or none, when null) the member's only
 * active care group. Build with the `db` handed to `runAtomically`.
 */
export function careMembershipStatements(
  db: Database,
  memberId: string,
  care: { id: string; name: string } | null,
  now: Date = new Date()
): unknown[] {
  const careIds = db.select({ id: groups.id }).from(groups).where(eq(groups.orgLevel, "care"));
  const end = db
    .update(groupMembers)
    .set({ status: "inactive", leftAt: now })
    .where(
      and(
        eq(groupMembers.memberId, memberId),
        eq(groupMembers.status, "active"),
        inArray(groupMembers.groupId, careIds),
        care ? ne(groupMembers.groupId, care.id) : sql`true`
      )
    );
  const label = db
    .update(members)
    .set({ group: care ? care.name : null, updatedAt: now })
    .where(eq(members.id, memberId));
  if (!care) return [end, label];
  const join = db
    .insert(groupMembers)
    .values({ id: randomUUID(), groupId: care.id, memberId, role: "member", status: "active", joinedAt: now })
    .onConflictDoUpdate({
      target: [groupMembers.groupId, groupMembers.memberId],
      set: { status: "active", leftAt: null },
    });
  return [end, join, label];
}

/** memberId -> current care group (with its body), for the given members. */
export async function careGroupsOf(db: Database, memberIds: string[]): Promise<Map<string, CareGroupRef>> {
  const out = new Map<string, CareGroupRef>();
  if (memberIds.length === 0) return out;
  const parent = db.$with("parent").as(db.select({ id: groups.id, name: groups.name }).from(groups));
  const rows = await db
    .with(parent)
    .select({ memberId: groupMembers.memberId, id: groups.id, name: groups.name, bodyName: parent.name })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .leftJoin(parent, eq(groups.parentGroupId, parent.id))
    .where(
      and(
        inArray(groupMembers.memberId, memberIds),
        eq(groupMembers.status, "active"),
        eq(groups.orgLevel, "care"),
        isNull(groups.deletedAt)
      )
    );
  for (const r of rows) out.set(r.memberId, { id: r.id, name: r.name.trim(), bodyName: r.bodyName ?? null });
  return out;
}
