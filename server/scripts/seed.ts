import { bootstrapDatabase } from "../db/bootstrap.js";
import { closeDatabase, getDatabaseConfig, getDb } from "../db/client.js";
import { DEMO_USER_EMAIL, seedLocalDemo } from "../lib/demoSeed.js";

/**
 * `pnpm db:seed` — local demo data: the demo admin account, one body, two care
 * groups and six sample members. Safe to re-run (idempotent).
 *
 * The demo account has no PIN and the data is fictional, so this refuses to
 * touch anything but the embedded PGlite database outside production.
 */
async function main(): Promise<number> {
  try {
    const config = getDatabaseConfig();
    if (config.driver !== "pglite" || config.nodeEnv === "production") {
      console.error(
        `[db:seed] refused: only the local PGlite database may be seeded (driver=${config.driver}, NODE_ENV=${config.nodeEnv}).`,
      );
      return 1;
    }

    console.log(`[db:seed] target=${config.pgliteDataDir}`);
    await bootstrapDatabase();
    const { created } = await seedLocalDemo(getDb());
    console.log(
      `[db:seed] created: ${created.users} user (${DEMO_USER_EMAIL}), ${created.groups} groups, ` +
        `${created.members} members, ${created.groupMembers} group memberships` +
        (Object.values(created).every((n) => n === 0) ? " — already seeded, nothing to do" : ""),
    );
    return 0;
  } catch (error) {
    console.error("[db:seed] failed:", error);
    return 1;
  } finally {
    // Closing PGlite cleanly is what keeps the data directory's WAL consistent.
    await closeDatabase();
  }
}

main().then((exitCode) => {
  process.exitCode = exitCode;
});
