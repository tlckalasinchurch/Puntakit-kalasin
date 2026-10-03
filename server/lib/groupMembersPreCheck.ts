import { count, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { getDb } from "../db/client.js";
import { groupMembers, groups, members } from "../../shared/schema.js";

/**
 * READ-ONLY pre-migration check for the `group_members` constraint swap
 * (full UNIQUE → partial UNIQUE WHERE left_at IS NULL).
 *
 * Migration rule (Q2 decision, 2026-10-03): the swap happens in ONE migration
 * and only after this check reports clean against PRODUCTION data. The check
 * itself must stay incapable of change — every query below is a SELECT.
 *
 * Checks (numbering follows the Q2 decision):
 *   1. existing duplicate (group_id, member_id) rows            → information
 *   2. historical rows (left_at IS NOT NULL)                    → information
 *   3. duplicate ACTIVE rows for the same pair                  → BLOCKS migration
 *   4. status rows contradicting left_at                        → warning
 *   5. orphan references                                        → warning
 *   +  members.group legacy text rows (backfill planning)       → information
 */

export type GroupMembersPreCheckReport = {
  /** Total group_members rows. */
  totalRows: number;
  /** Rows with left_at IS NULL (current memberships). */
  activeRows: number;
  /** Rows with left_at IS NOT NULL (history). */
  historicalRows: number;
  /** Check 1 — distinct (group_id, member_id) pairs appearing more than once. */
  duplicatePairsTotal: number;
  /** Rows involved in those pairs. */
  duplicatePairRows: number;
  /** Check 3 — pairs with MORE THAN ONE active row (left_at IS NULL). Blocks migration. */
  duplicateActivePairs: number;
  /** Check 4 — status contradicts left_at. */
  activeWithLeftAt: number;
  inactiveWithoutLeftAt: number;
  /** Check 5 — references pointing at missing groups / members. */
  orphanGroupRefs: number;
  orphanMemberRefs: number;
  /** Legacy text column `members.group` — rows to backfill later. */
  membersWithLegacyGroupText: number;
  /** Samples of duplicate-active pairs for human review (max 20). */
  duplicateActiveSamples: Array<{ groupId: string; memberId: string; activeRows: number }>;
  /** True when the constraint swap must NOT run (check 3 non-zero). */
  migrationBlocked: boolean;
};

function toNumber(value: unknown): number {
  // `count()` arrives as a string from the pg drivers.
  return Number(value ?? 0);
}

export async function runGroupMembersPreCheck(): Promise<GroupMembersPreCheckReport> {
  const db = getDb();

  const [totals] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${groupMembers.leftAt} is null)`,
      historical: sql<number>`count(*) filter (where ${groupMembers.leftAt} is not null)`,
      activeWithLeftAt: sql<number>`count(*) filter (where ${groupMembers.leftAt} is not null and ${groupMembers.status} = 'active')`,
      inactiveWithoutLeftAt: sql<number>`count(*) filter (where ${groupMembers.leftAt} is null and ${groupMembers.status} = 'inactive')`,
    })
    .from(groupMembers);

  // Check 1 + 3: per-pair row counts, split by activity. The pair universe is
  // small (groups × members), so aggregating fully and deciding in code keeps
  // this a single portable query per metric.
  const pairRows = await db
    .select({
      groupId: groupMembers.groupId,
      memberId: groupMembers.memberId,
      total: count(),
      active: sql<number>`count(*) filter (where ${groupMembers.leftAt} is null)`,
    })
    .from(groupMembers)
    .groupBy(groupMembers.groupId, groupMembers.memberId);

  let duplicatePairsTotal = 0;
  let duplicatePairRows = 0;
  let duplicateActivePairs = 0;
  const duplicateActiveSamples: GroupMembersPreCheckReport["duplicateActiveSamples"] = [];
  for (const pair of pairRows) {
    if (pair.total > 1) {
      duplicatePairsTotal += 1;
      duplicatePairRows += pair.total;
    }
    if (pair.active > 1) {
      duplicateActivePairs += 1;
      if (duplicateActiveSamples.length < 20) {
        duplicateActiveSamples.push({
          groupId: pair.groupId,
          memberId: pair.memberId,
          activeRows: toNumber(pair.active),
        });
      }
    }
  }

  // Check 5: orphan references (foreign keys make these impossible through
  // the app, but the check must not assume the data was only ever written
  // through the app).
  const [orphanGroups] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .leftJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(isNull(groups.id))
    .limit(1);
  const [orphanMembers] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .leftJoin(members, eq(groupMembers.memberId, members.id))
    .where(isNull(members.id))
    .limit(1);

  const orphanGroupRefs = orphanGroups ? await countOrphans("group") : 0;
  const orphanMemberRefs = orphanMembers ? await countOrphans("member") : 0;

  const [legacy] = await db
    .select({ total: count() })
    .from(members)
    .where(isNotNull(members.group));

  const duplicateActivePairsNumber = duplicateActivePairs;
  return {
    totalRows: toNumber(totals?.total),
    activeRows: toNumber(totals?.active),
    historicalRows: toNumber(totals?.historical),
    duplicatePairsTotal,
    duplicatePairRows,
    duplicateActivePairs: duplicateActivePairsNumber,
    activeWithLeftAt: toNumber(totals?.activeWithLeftAt),
    inactiveWithoutLeftAt: toNumber(totals?.inactiveWithoutLeftAt),
    orphanGroupRefs,
    orphanMemberRefs,
    membersWithLegacyGroupText: toNumber(legacy?.total),
    duplicateActiveSamples,
    migrationBlocked: duplicateActivePairsNumber > 0,
  };
}

async function countOrphans(which: "group" | "member"): Promise<number> {
  const db = getDb();
  if (which === "group") {
    const [row] = await db
      .select({ total: count() })
      .from(groupMembers)
      .leftJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(isNull(groups.id));
    return toNumber(row?.total);
  }
  const [row] = await db
    .select({ total: count() })
    .from(groupMembers)
    .leftJoin(members, eq(groupMembers.memberId, members.id))
    .where(isNull(members.id));
  return toNumber(row?.total);
}
