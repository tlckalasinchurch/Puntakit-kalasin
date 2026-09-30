import { sql } from "drizzle-orm";
import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as path from "node:path";
import * as schema from "../../shared/schema.js";
import { getDatabaseConfig, getDatabaseHandle, getDb } from "./client.js";
import type { DatabaseDriver } from "./config.js";

/**
 * Driver-aware migration + schema verification.
 *
 * - `pglite` always migrates: the embedded database is a brand-new (or reused)
 *   data directory, so the local schema is bootstrapped automatically.
 * - `neon` / `postgres` only migrate when `DB_AUTO_MIGRATE=true` or when the
 *   caller asks explicitly (`bootstrapDatabase({ force: true })`, i.e. the
 *   `pnpm db:migrate` CLI).
 */

export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "server", "db", "migrations");

export interface SchemaVerification {
  /** Rows recorded in drizzle's `drizzle.__drizzle_migrations` journal table. */
  appliedMigrations: number;
  /** Public tables created by the migrations. */
  tables: string[];
}

export interface BootstrapResult {
  driver: DatabaseDriver;
  ranMigrations: boolean;
  /** Why migrations were skipped (only set when `ranMigrations` is false). */
  reason?: string;
  /** Populated after a successful migration run. */
  verification: SchemaVerification | null;
}

export interface BootstrapOptions {
  /** Run migrations even for remote drivers (used by the migration CLI). */
  force?: boolean;
  logger?: Pick<Console, "log" | "warn">;
}

export async function bootstrapDatabase(options: BootstrapOptions = {}): Promise<BootstrapResult> {
  const { force = false, logger = console } = options;
  const config = getDatabaseConfig();
  const handle = getDatabaseHandle();

  const shouldMigrate = force || config.driver === "pglite" || config.autoMigrate;

  if (!shouldMigrate) {
    return {
      driver: config.driver,
      ranMigrations: false,
      reason: `DB_AUTO_MIGRATE is not enabled (driver=${config.driver}); run "pnpm db:migrate" explicitly.`,
      verification: null,
    };
  }

  logger.log(`[db] applying migrations from ${MIGRATIONS_FOLDER} (driver=${config.driver})`);

  switch (handle.driver) {
    case "pglite":
      await migratePglite(handle.db, { migrationsFolder: MIGRATIONS_FOLDER });
      break;
    case "postgres":
      await migratePostgres(handle.db, { migrationsFolder: MIGRATIONS_FOLDER });
      break;
    case "neon":
      await migrateNeon(handle.db, { migrationsFolder: MIGRATIONS_FOLDER });
      break;
    default: {
      const exhaustive: never = handle;
      throw new Error(`Unsupported database handle: ${JSON.stringify(exhaustive)}`);
    }
  }

  const verification = await verifyDatabaseSchema();

  return { driver: config.driver, ranMigrations: true, verification };
}

/**
 * Proves the migrated schema is usable: reads the drizzle journal table, lists
 * the public tables and runs a typed query against a migrated table.
 */
export async function verifyDatabaseSchema(): Promise<SchemaVerification> {
  const db = getDb();

  const tableRows = extractRows<{ table_name: string }>(
    await db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    ),
  );

  const journalRows = extractRows<{ count: number | string }>(
    await db.execute(sql`select count(*)::int as count from drizzle.__drizzle_migrations`),
  );

  // Typed round-trip against a migrated table (throws when the schema is missing).
  await db.select({ id: schema.members.id }).from(schema.members).limit(1);

  return {
    appliedMigrations: Number(journalRows[0]?.count ?? 0),
    tables: tableRows.map((row) => row.table_name),
  };
}

/**
 * Normalises `db.execute()` results: postgres-js returns an array of rows while
 * neon-http and PGlite return `{ rows }`.
 */
function extractRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const withRows = result as { rows?: unknown } | null;
  return Array.isArray(withRows?.rows) ? (withRows.rows as T[]) : [];
}
