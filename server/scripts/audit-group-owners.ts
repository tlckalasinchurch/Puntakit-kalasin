/**
 * Read-only pre-deploy audit: which groups have no owner a `group_leader` can
 * act through?
 *
 * Attendance and care roster access for a `group_leader` follows
 * `getLedGroupIds` (server/lib/groupAccess.ts). A group counts as owned when,
 * for a group that is not deleted, ANY of these holds:
 *   - groups.leader_id points to a user
 *   - groups.co_leader_id points to a user
 *   - an ACTIVE group_members row has role leader or assistant_leader and its
 *     member (not deleted) is linked to a user (members.user_id)
 * `groups.leader_member_id` is NOT counted: it is not a permission source.
 *
 * A SELECT and nothing else. Run it against the target database:
 *   dotenv -e .env.prod.local -- tsx server/scripts/audit-group-owners.ts
 * Output has counts and group ids/names only; it prints no member data.
 */
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { closeDatabase, getDb } from "../db/client.js";
import { groupMembers, groups, members } from "../../shared/schema.js";

async function main(): Promise<number> {
  const db = getDb();

  const all = await db
    .select({
      id: groups.id,
      name: groups.name,
      orgLevel: groups.orgLevel,
      leaderId: groups.leaderId,
      coLeaderId: groups.coLeaderId,
      leaderMemberId: groups.leaderMemberId,
    })
    .from(groups)
    .where(isNull(groups.deletedAt));

  const viaMembership = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .innerJoin(members, eq(groupMembers.memberId, members.id))
    .where(
      and(
        isNotNull(members.userId),
        isNull(members.deletedAt),
        eq(groupMembers.status, "active"),
        inArray(groupMembers.role, ["leader", "assistant_leader"])
      )
    );
  const memberOwned = new Set(viaMembership.map((r) => r.groupId));

  const owned = (g: (typeof all)[number]) => Boolean(g.leaderId || g.coLeaderId || memberOwned.has(g.id));
  const levels = ["body", "care", "other"] as const;
  const levelOf = (g: (typeof all)[number]) => (g.orgLevel === "body" || g.orgLevel === "care" ? g.orgLevel : "other");

  console.log(`[audit] ${all.length} active group(s) (not deleted)\n`);
  let unownedTotal = 0;
  for (const level of levels) {
    const inLevel = all.filter((g) => levelOf(g) === level);
    const unowned = inLevel.filter((g) => !owned(g));
    unownedTotal += unowned.length;
    const onlyLeaderMember = unowned.filter((g) => g.leaderMemberId).length;
    console.log(
      `[audit] ${level.padEnd(5)} total=${inLevel.length} owned=${inLevel.length - unowned.length} ` +
        `NO_OWNER=${unowned.length} (of which leader_member_id only: ${onlyLeaderMember})`
    );
  }

  const unownedCare = all.filter((g) => g.orgLevel === "care" && !owned(g));
  if (unownedCare.length > 0) {
    console.log("\n[audit] care groups with no owner (a group_leader cannot save a check-in for them):");
    for (const g of unownedCare) console.log(`  ${g.id}  ${g.name}${g.leaderMemberId ? "  [leader_member_id set]" : ""}`);
  }

  console.log(`\n[audit] total without a valid owner relationship: ${unownedTotal}`);
  return 0;
}

main()
  .then((code) => closeDatabase().finally(() => process.exit(code)))
  .catch(async (err) => {
    console.error("[audit] failed:", err);
    await closeDatabase().catch(() => {});
    process.exit(1);
  });
