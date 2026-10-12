import { and, count, eq, isNull, sql } from "drizzle-orm";
import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as path from "node:path";
import * as schema from "../../shared/schema.js";
import { getDatabaseConfig, getDatabaseHandle, getDb } from "./client.js";
import type { DatabaseConfig, DatabaseDriver } from "./config.js";
import { DEFAULT_SUPER_ADMIN_PIN, hashPin } from "../lib/firstPartyAuth.js";

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
    // Deliberately does NOT audit super-admin PINs here. This branch must not
    // open a connection to a remote database — `server/db/bootstrap.test.ts`
    // pins that with an unreachable port. The production signal lives in
    // `/api/ready`, which already runs on a connected database.
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
  await ensureDefaultSuperAdminPins(logger);

  return { driver: config.driver, ranMigrations: true, verification };
}

export type DefaultSuperAdminPinMode = "seed" | "refuse";

export interface DefaultSuperAdminPinPolicy {
  mode: DefaultSuperAdminPinMode;
  /** Operator-facing explanation, logged whenever the audit finds anything. */
  reason: string;
}

/**
 * Decides whether the starter PIN may be written to this database at all.
 *
 * `DEFAULT_SUPER_ADMIN_PIN` is a constant committed to this repository, so it may
 * only ever reach the local embedded PGlite data directory. A remote driver can
 * be a real deployment, and seeding it would hand a super_admin login to anyone
 * who can read the source. `resolveDatabaseConfig()` already rejects PGlite
 * under `NODE_ENV=production`, so the driver check below is the second lock on
 * the same door rather than the only one.
 */
export function resolveDefaultSuperAdminPinPolicy(
  config: Pick<DatabaseConfig, "driver" | "isProduction">,
): DefaultSuperAdminPinPolicy {
  if (config.isProduction) {
    return {
      mode: "refuse",
      reason:
        "NODE_ENV=production — the starter PIN is public in source and is never written to a production database",
    };
  }
  if (config.driver !== "pglite") {
    return {
      mode: "refuse",
      reason: `driver=${config.driver} is not the local embedded database — the starter PIN is never written to a remote database`,
    };
  }
  return { mode: "seed", reason: "local embedded PGlite database" };
}

export interface SuperAdminPinAudit {
  /** Super admins that cannot sign in because they have no PIN. */
  missingPins: number;
  /** Rows written by the starter-PIN seed; always 0 when the policy refuses. */
  seeded: number;
  mode: DefaultSuperAdminPinMode;
  reason: string;
}

/**
 * Super admins with a NULL `pin_hash` can never authenticate: `authenticateWithPin`
 * only considers rows where `pin_hash IS NOT NULL`. Used by `/api/ready` to keep
 * production out of rotation until the operator assigns one.
 */
export async function countSuperAdminsWithoutPin(): Promise<number> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(schema.users)
    .where(and(eq(schema.users.role, "super_admin"), isNull(schema.users.pinHash)));
  return Number(row?.value ?? 0);
}

/**
 * Gives super admins without a PIN the local starter PIN, but only on the local
 * embedded database. On any other database it reports instead of writing.
 *
 * The NULL guard is intentional and must not be relaxed: it appears both in the
 * scan and in the UPDATE's WHERE clause, so a PIN chosen later by an admin is
 * never replaced on boot, and a row that gained a PIN between the two statements
 * is left alone.
 */
export async function ensureDefaultSuperAdminPins(
  logger: Pick<Console, "log" | "warn"> = console,
  /** Overridable so the refusal path is testable without a remote database. */
  config: Pick<DatabaseConfig, "driver" | "isProduction"> = getDatabaseConfig(),
): Promise<SuperAdminPinAudit> {
  const policy = resolveDefaultSuperAdminPinPolicy(config);
  const missingPins = await countSuperAdminsWithoutPin();
  const audit: SuperAdminPinAudit = { missingPins, seeded: 0, mode: policy.mode, reason: policy.reason };

  if (missingPins === 0) return audit;

  if (policy.mode === "refuse") {
    logger.warn(
      `[db] ${missingPins} super_admin account(s) have no PIN and cannot sign in (${policy.reason}). ` +
        'Assign one with "pnpm db:set-pin:env <email> <pin>" against this environment — the plain ' +
        '"db:set-pin" loads .env.local and would target a different database.',
    );
    return audit;
  }

  const db = getDb();
  const candidates = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.role, "super_admin"), isNull(schema.users.pinHash)))
    .limit(100);
  const pinHash = await hashPin(DEFAULT_SUPER_ADMIN_PIN);
  let seeded = 0;
  for (const candidate of candidates) {
    // `returning()` makes `seeded` reflect rows actually written, so a PIN set
    // between the scan and the update is not counted.
    const written = await db
      .update(schema.users)
      .set({ pinHash, pinFailedAttempts: 0, pinLockedUntil: null, pinUpdatedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(schema.users.id, candidate.id), isNull(schema.users.pinHash)))
      .returning({ id: schema.users.id });
    seeded += written.length;
  }

  if (seeded > 1) {
    logger.warn(
      `[db] seeded the local starter PIN for ${seeded} super_admin account(s). A PIN must identify exactly ` +
        "one account, so these accounts now share one PIN and cannot all sign in — set distinct PINs before use.",
    );
  } else if (seeded === 1) {
    logger.warn(
      `[db] seeded the local starter PIN for 1 super_admin account. Change it before sharing this database.`,
    );
  }

  return { ...audit, seeded };
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
