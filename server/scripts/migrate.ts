import { bootstrapDatabase } from "../db/bootstrap.js";
import { closeDatabase, getDatabaseConfig } from "../db/client.js";
import { DatabaseConfigurationError } from "../db/config.js";

/**
 * `pnpm db:migrate` — driver-aware migration / local bootstrap.
 *
 * Examples:
 *   pnpm db:migrate                                   # uses .env.local (PGlite locally)
 *   DATABASE_DRIVER=neon DATABASE_URL=... pnpm db:migrate:env
 */
async function main(): Promise<number> {
  try {
    const config = getDatabaseConfig();
    const target = config.driver === "pglite" ? config.pgliteDataDir : "remote database (credentials hidden)";
    console.log(`[db:migrate] driver=${config.driver} target=${target}`);

    const result = await bootstrapDatabase({ force: true });

    if (result.verification) {
      console.log(`[db:migrate] migrations recorded in journal: ${result.verification.appliedMigrations}`);
      console.log(
        `[db:migrate] tables ready (${result.verification.tables.length}): ${result.verification.tables.join(", ")}`,
      );
    }
    console.log("[db:migrate] done");
    return 0;
  } catch (error) {
    if (error instanceof DatabaseConfigurationError) {
      console.error(`[db:migrate] configuration error: ${error.message}`);
    } else {
      console.error("[db:migrate] migration failed:", error);
    }
    return 1;
  } finally {
    await closeDatabase();
  }
}

main().then((exitCode) => {
  process.exitCode = exitCode;
});

