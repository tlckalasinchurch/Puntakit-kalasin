/**
 * Read-only pre-deploy audit: which groups have no owner a `group_leader` can
 * act through?
 *
 * Attendance and care roster access for a `group_leader` follows
 * `getLedGroupIds` (server/lib/groupAccess.ts). For a group that is not
 * deleted, an owner is ANY of:
 *   - groups.leader_id points to a user
 *   - groups.co_leader_id points to a user
 *   - an ACTIVE group_members row has role leader or assistant_leader and its
 *     member (not deleted) is linked to a user (members.user_id)
 * `groups.leader_member_id` is NOT an owner: it is not a permission source.
 *
 * Read-only: SELECT statements only. It prints counts, and group ids only
 * (add --names to print group names). It prints no member data, no emails and
 * no connection string.
 *
 * Run it against the target database, for example:
 *   dotenv -e .env.prod.local -- tsx server/scripts/audit-group-owners.ts
 *
 * The script cannot tell which database it reached. It prints the driver it
 * used. A PGlite run is local test data and is NEVER a production result.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { closeDatabase, getDb } from "../db/client.js";
import { groupMembers, groups, members } from "../../shared/schema.js";

type Level = "body" | "care" | "other";
const LEVELS: Level[] = ["body", "care", "other"];

async function main(): Promise<number> {
  const showNames = process.argv.includes("--names");
  const driver = process.env.DATABASE_DRIVER ?? "(unset)";
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

  // Active leader / assistant_leader rows of live members, with whether the member is linked to a user.
  const leaderRows = await db
    .select({ groupId: groupMembers.groupId, userId: members.userId })
    .from(groupMembers)
    .innerJoin(members, eq(groupMembers.memberId, members.id))
    .where(
      and(
        isNull(members.deletedAt),
        eq(groupMembers.status, "active"),
        inArray(groupMembers.role, ["leader", "assistant_leader"])
      )
    );
  const withLeaderRows = new Set(leaderRows.map((r) => r.groupId));
  const withLinkedLeaderRows = new Set(leaderRows.filter((r) => r.userId).map((r) => r.groupId));

  const levelOf = (g: (typeof all)[number]): Level => (g.orgLevel === "body" || g.orgLevel === "care" ? g.orgLevel : "other");
  const stats = (rows: typeof all) => {
    const byLeader = rows.filter((g) => g.leaderId).length;
    const byCo = rows.filter((g) => g.coLeaderId).length;
    const byMembership = rows.filter((g) => withLinkedLeaderRows.has(g.id)).length;
    const owned = rows.filter((g) => g.leaderId || g.coLeaderId || withLinkedLeaderRows.has(g.id));
    const unowned = rows.filter((g) => !(g.leaderId || g.coLeaderId || withLinkedLeaderRows.has(g.id)));
    return {
      total: rows.length,
      owned: owned.length,
      unowned: unowned.length,
      byLeader,
      byCo,
      byMembership,
      leaderRowsNotLinked: rows.filter((g) => withLeaderRows.has(g.id) && !withLinkedLeaderRows.has(g.id)).length,
      leaderMemberOnly: unowned.filter((g) => g.leaderMemberId).length,
      unownedRows: unowned,
    };
  };

  const line = (label: string, s: ReturnType<typeof stats>) =>
    [
      `[audit] ${label.padEnd(8)}`,
      `total=${s.total}`,
      `valid_owner=${s.owned}`,
      `NO_OWNER=${s.unowned}`,
      `leaderId=${s.byLeader}`,
      `coLeaderId=${s.byCo}`,
      `leader_or_assistant_rows(linked_to_user)=${s.byMembership}`,
      `leader_rows_without_user_link=${s.leaderRowsNotLinked}`,
      `leaderMemberId_only=${s.leaderMemberOnly}`,
    ].join("  ");

  console.log(`[audit] database driver: ${driver}`);
  console.log(`[audit] groups not deleted: ${all.length}\n`);
  console.log(line("ALL", stats(all)));
  for (const level of LEVELS) console.log(line(level, stats(all.filter((g) => levelOf(g) === level))));

  const unownedCare = stats(all.filter((g) => g.orgLevel === "care")).unownedRows;
  if (unownedCare.length > 0) {
    console.log("\n[audit] care groups with no valid owner (a group_leader cannot save a check-in for them):");
    for (const g of unownedCare) {
      console.log(`  ${g.id}${showNames ? `  ${g.name}` : ""}${g.leaderMemberId ? "  [leaderMemberId set]" : ""}`);
    }
  }

  console.log("");
  if (driver === "pglite") {
    console.log("[audit] PRODUCTION OWNERSHIP = NOT VERIFIED (PGlite is local data, not production)");
  } else {
    console.log(
      `[audit] ran against driver=${driver}. This script cannot confirm the target is production: ` +
        "the operator must confirm the environment before recording a production result."
    );
  }
  return 0;
}

main()
  .then((code) => closeDatabase().finally(() => process.exit(code)))
  .catch(async (err) => {
    console.error("[audit] failed:", err instanceof Error ? err.message : err);
    await closeDatabase().catch(() => {});
    process.exit(1);
  });
