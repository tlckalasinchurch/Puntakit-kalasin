import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import postgres, { type Options as PostgresJsOptions } from "postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as fs from "node:fs";
import * as path from "node:path";
import * as schema from "../../shared/schema.js";
import {
  resolveDatabaseConfig,
  type DatabaseConfig,
  type DatabaseDriver,
  type PostgresConnectionOptions,
} from "./config.js";

/**
 * Canonical database type used across the server. Every driver exposes the same
 * `PgDatabase` query-builder API, so routes stay driver-agnostic and this module
 * never needs `any`.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export type PostgresClient = ReturnType<typeof postgres>;

/**
 * Handle for the active driver. It keeps the concrete client so connections can
 * be closed cleanly. `neon` (HTTP) is connectionless, so it only carries the db.
 */
export type DatabaseHandle =
  | { driver: "pglite"; client: PGlite; db: PgliteDatabase<typeof schema> }
  | { driver: "postgres"; client: PostgresClient; db: PostgresJsDatabase<typeof schema> }
  | { driver: "neon"; db: NeonHttpDatabase<typeof schema> };

/** Grace period (seconds) given to postgres-js when draining the pool. */
const POSTGRES_SHUTDOWN_TIMEOUT_SECONDS = 5;

let resolvedConfig: DatabaseConfig | null = null;
let activeHandle: DatabaseHandle | null = null;

/** Resolved (and validated) database configuration; throws on invalid config. */
export function getDatabaseConfig(): DatabaseConfig {
  if (!resolvedConfig) {
    resolvedConfig = resolveDatabaseConfig();
  }
  return resolvedConfig;
}

export function getDatabaseDriver(): DatabaseDriver {
  return getDatabaseConfig().driver;
}

/** Creates the active driver handle on first use and reuses it afterwards. */
export function getDatabaseHandle(): DatabaseHandle {
  if (!activeHandle) {
    const config = getDatabaseConfig();
    activeHandle = createDatabaseHandle(config);
    logInitialization(config);
  }
  return activeHandle;
}

export function getDb(): Database {
  return getDatabaseHandle().db;
}

export function hasOpenDatabaseHandle(): boolean {
  return activeHandle !== null;
}

/**
 * Closes the active connection (postgres-js pool / embedded PGlite runtime) and
 * releases the singleton so a later call reconnects. Safe to call when nothing
 * has been opened.
 */
export async function closeDatabase(): Promise<void> {
  const handle = activeHandle;
  if (!handle) return;
  activeHandle = null;

  switch (handle.driver) {
    case "pglite":
      if (!handle.client.closed) {
        await handle.client.close();
      }
      return;
    case "postgres":
      await handle.client.end({ timeout: POSTGRES_SHUTDOWN_TIMEOUT_SECONDS });
      return;
    case "neon":
      // neon-http is connectionless (fetch per query) — nothing to drain.
      return;
    default: {
      const exhaustive: never = handle;
      throw new Error(`Unsupported database handle: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function createDatabaseHandle(config: DatabaseConfig): DatabaseHandle {
  switch (config.driver) {
    case "pglite": {
      // PGlite creates the leaf data directory itself but not missing parents.
      fs.mkdirSync(path.dirname(config.pgliteDataDir), { recursive: true });
      const client = new PGlite(config.pgliteDataDir);
      return { driver: "pglite", client, db: drizzlePglite(client, { schema }) };
    }
    case "neon": {
      const sql = neon(config.connectionString);
      return { driver: "neon", db: drizzleNeon(sql, { schema }) };
    }
    case "postgres": {
      const client = postgres(config.connectionString, toPostgresJsOptions(config.postgres));
      return { driver: "postgres", client, db: drizzlePostgres(client, { schema }) };
    }
    default: {
      const exhaustive: never = config;
      throw new Error(`Unsupported database driver: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function toPostgresJsOptions(
  options: PostgresConnectionOptions,
): PostgresJsOptions<Record<string, never>> {
  const clientOptions: PostgresJsOptions<Record<string, never>> = {
    // Pooled/proxied endpoints (Neon pooler, pgbouncer) cannot use prepared statements.
    prepare: false,
    max: options.max,
    idle_timeout: options.idle_timeout,
    connect_timeout: options.connect_timeout,
  };
  if (options.ssl !== undefined) {
    clientOptions.ssl = options.ssl;
  }
  return clientOptions;
}

/** Startup diagnostics — never logs connection strings or credentials. */
function logInitialization(config: DatabaseConfig): void {
  if (config.nodeEnv === "test") return;

  switch (config.driver) {
    case "pglite":
      if (config.driverSource === "development-fallback") {
        console.warn(
          "[db] DATABASE_URL and DATABASE_DRIVER are not set — using the embedded PGlite database for local development only. Production always refuses this fallback.",
        );
      }
      console.log(`[db] driver=pglite dataDir=${config.pgliteDataDir}`);
      return;
    case "neon":
      console.log("[db] driver=neon (Neon HTTP serverless)");
      return;
    case "postgres":
      console.log(
        `[db] driver=postgres max=${config.postgres.max} idle_timeout=${config.postgres.idle_timeout}s ` +
          `connect_timeout=${config.postgres.connect_timeout}s ssl=${config.postgres.ssl ?? "driver-default"}`,
      );
      return;
    default: {
      const exhaustive: never = config;
      console.log(`[db] driver=${JSON.stringify(exhaustive)}`);
    }
  }
}

