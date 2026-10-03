/**
 * READ-ONLY pre-migration check for the `group_members` constraint swap.
 *
 * Q2 decision (2026-10-03): keep `group_members` as the membership-history
 * table and swap its full UNIQUE(group_id, member_id) for a partial
 * UNIQUE WHERE left_at IS NULL — but ONLY after this check reports clean
 * against PRODUCTION data. This script is STEP 1 of that gate: it runs
 * SELECTs only and changes nothing.
 *
 * Usage (someone with production DB access):
 *   dotenv -e .env.production.local -- tsx server/scripts/pre-migration-check.ts [--json]
 *
 * Exit codes: 0 = safe to migrate, 1 = BLOCKED (duplicate active pairs),
 * 2 = environment/config problem.
 */
import { closeDatabase, getDb } from "../db/client.js";
import { runGroupMembersPreCheck } from "../lib/groupMembersPreCheck.js";

async function main(): Promise<void> {
  const asJson = process.argv.includes("--json");

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Source the production env file, e.g.:");
    console.error("  dotenv -e .env.production.local -- tsx server/scripts/pre-migration-check.ts");
    process.exitCode = 2;
    return;
  }
  if (process.env.DATABASE_DRIVER === "pglite" && process.env.NODE_ENV === "production") {
    console.error("Refusing to run: PGlite is a local-development driver, never a production database.");
    process.exitCode = 2;
    return;
  }

  getDb(); // fail fast on a bad connection before printing anything
  const report = await runGroupMembersPreCheck();
  await closeDatabase();

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const rule = (label: string) => `${label} ${"-".repeat(Math.max(3, 74 - label.length))}`;
    console.log("=".repeat(78));
    console.log("PUNTAKIT — group_members PRE-MIGRATION CHECK (READ-ONLY)");
    console.log("=".repeat(78));
    console.log(`driver        : ${process.env.DATABASE_DRIVER ?? "(default)"}`);
    console.log(`total rows    : ${report.totalRows}  (active ${report.activeRows} / history ${report.historicalRows})`);
    console.log("");
    console.log(rule("CHECK 1 — duplicate (group_id, member_id) rows (informational)"));
    console.log(`  pairs: ${report.duplicatePairsTotal}, rows involved: ${report.duplicatePairRows}`);
    console.log("");
    console.log(rule("CHECK 2 — historical rows (left_at IS NOT NULL)"));
    console.log(`  history rows: ${report.historicalRows}`);
    console.log("");
    console.log(rule("CHECK 3 — duplicate ACTIVE rows for the same pair (BLOCKS migration)"));
    console.log(`  pairs with >1 active row: ${report.duplicateActivePairs}`);
    for (const sample of report.duplicateActiveSamples) {
      console.log(`    - group ${sample.groupId} · member ${sample.memberId} · active rows ${sample.activeRows}`);
    }
    console.log("");
    console.log(rule("CHECK 4 — status contradicting left_at (warning)"));
    console.log(`  status='active' + left_at set    : ${report.activeWithLeftAt}`);
    console.log(`  status='inactive' + left_at null : ${report.inactiveWithoutLeftAt}`);
    console.log("");
    console.log(rule("CHECK 5 — orphan references (warning)"));
    console.log(`  missing group rows : ${report.orphanGroupRefs}`);
    console.log(`  missing member rows: ${report.orphanMemberRefs}`);
    console.log("");
    console.log(rule("BACKFILL PLANNING — members.group legacy text"));
    console.log(`  members with a legacy group value: ${report.membersWithLegacyGroupText}`);
    console.log("");
    console.log("=".repeat(78));
    if (report.migrationBlocked) {
      console.log("VERDICT: BLOCKED — resolve duplicate ACTIVE (group_id, member_id) pairs first.");
      console.log("The constraint swap must not run until CHECK 3 is zero.");
    } else {
      console.log("VERDICT: SAFE — no duplicate active pairs. The constraint swap may proceed.");
      console.log("Still review CHECK 4 / CHECK 5 warnings before migrating.");
    }
    console.log("This run made no changes: SELECTs only.");
    console.log("=".repeat(78));
  }

  process.exitCode = report.migrationBlocked ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
