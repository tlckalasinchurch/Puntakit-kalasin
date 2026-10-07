import * as path from "node:path";

/**
 * Database driver configuration resolution.
 *
 * The driver is always selected explicitly through `DATABASE_DRIVER`
 * (`neon | postgres | pglite`) or `USE_LOCAL_DB=true` for the embedded local
 * database. See `.env.example` / DEPLOYMENT.md for the supported matrix.
 *
 * Production rules (fail-fast, no silent fallback):
 * - `NODE_ENV=production` + missing `DATABASE_URL` -> DatabaseConfigurationError
 * - `NODE_ENV=production` + `USE_LOCAL_DB=true` -> DatabaseConfigurationError
 * - `NODE_ENV=production` + `DATABASE_DRIVER=pglite` -> DatabaseConfigurationError
 */

export const DATABASE_DRIVERS = ["neon", "postgres", "pglite"] as const;

export type DatabaseDriver = (typeof DATABASE_DRIVERS)[number];

/** How the active driver was decided — surfaced in logs and asserted in tests. */
export type DriverSource = "explicit" | "inferred" | "local-flag" | "development-fallback";

/** Default directory for the embedded PostgreSQL (PGlite) data files. */
export const DEFAULT_PGLITE_DATA_DIR = ".db_data";

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

/** Values accepted by the postgres-js client `ssl` option. */
export type PostgresSslValue =
  | "require"
  | "allow"
  | "prefer"
  | "verify-full"
  | false
  | { rejectUnauthorized: false };

/** Connection tuning handed to the postgres-js client. */
export interface PostgresConnectionOptions {
  max: number;
  idle_timeout: number;
  connect_timeout: number;
  /** `undefined` keeps the postgres-js default (or the value embedded in DATABASE_URL). */
  ssl?: PostgresSslValue;
}

interface CommonDatabaseConfig {
  /** `process.env.NODE_ENV`, normalised to `development` when unset. */
  nodeEnv: string;
  isProduction: boolean;
  driverSource: DriverSource;
  /** `DB_AUTO_MIGRATE=true` allows remote drivers to migrate during bootstrap. */
  autoMigrate: boolean;
}

export interface PgliteDatabaseConfig extends CommonDatabaseConfig {
  driver: "pglite";
  /** Absolute path of the embedded PostgreSQL data directory. */
  pgliteDataDir: string;
}

export interface NeonDatabaseConfig extends CommonDatabaseConfig {
  driver: "neon";
  connectionString: string;
}

export interface PostgresDatabaseConfig extends CommonDatabaseConfig {
  driver: "postgres";
  connectionString: string;
  postgres: PostgresConnectionOptions;
}

export type DatabaseConfig = PgliteDatabaseConfig | NeonDatabaseConfig | PostgresDatabaseConfig;

export function isDatabaseDriver(value: string): value is DatabaseDriver {
  return (DATABASE_DRIVERS as readonly string[]).includes(value);
}

function readTrimmed(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const raw = env[key];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseBooleanFlag(name: string, raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new DatabaseConfigurationError(`${name} must be "true" or "false" (received "${raw}").`);
}

function parseBoundedInteger(name: string, raw: string, min: number, max: number): number {
  if (!/^\d+$/.test(raw.trim())) {
    throw new DatabaseConfigurationError(`${name} must be a whole number (received "${raw}").`);
  }
  const value = Number(raw.trim());
  if (value < min || value > max) {
    throw new DatabaseConfigurationError(`${name} must be between ${min} and ${max} (received "${raw}").`);
  }
  return value;
}

function isPostgresUrl(connectionString: string): boolean {
  return /^postgres(ql)?:\/\//i.test(connectionString);
}

function isHttpUrl(connectionString: string): boolean {
  return /^https?:\/\//i.test(connectionString);
}

/** `neon.tech` hosts (or a Neon `https://` HTTP endpoint) use the Neon serverless driver. */
function inferRemoteDriver(connectionString: string): "neon" | "postgres" {
  if (isHttpUrl(connectionString)) return "neon";
  return /neon\.tech/i.test(connectionString) ? "neon" : "postgres";
}

/**
 * Absolute path of the PGlite data directory (`PGLITE_DATA_DIR`, default `./.db_data`).
 * Relative values are resolved against the current working directory.
 */
export function resolvePgliteDataDir(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  const configured = readTrimmed(env, "PGLITE_DATA_DIR");
  return path.resolve(cwd, configured ?? DEFAULT_PGLITE_DATA_DIR);
}

const POSTGRES_OPTION_DEFAULTS = {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
} as const;

/** Parses the postgres-js pool/TLS tuning variables (all optional). */
export function resolvePostgresConnectionOptions(
  env: NodeJS.ProcessEnv = process.env,
): PostgresConnectionOptions {
  const max = readTrimmed(env, "POSTGRES_MAX_CONNECTIONS");
  const idleTimeout = readTrimmed(env, "POSTGRES_IDLE_TIMEOUT_SECONDS");
  const connectTimeout = readTrimmed(env, "POSTGRES_CONNECT_TIMEOUT_SECONDS");

  const options: PostgresConnectionOptions = {
    max: max ? parseBoundedInteger("POSTGRES_MAX_CONNECTIONS", max, 1, 100) : POSTGRES_OPTION_DEFAULTS.max,
    idle_timeout: idleTimeout
      ? parseBoundedInteger("POSTGRES_IDLE_TIMEOUT_SECONDS", idleTimeout, 0, 3600)
      : POSTGRES_OPTION_DEFAULTS.idle_timeout,
    connect_timeout: connectTimeout
      ? parseBoundedInteger("POSTGRES_CONNECT_TIMEOUT_SECONDS", connectTimeout, 1, 300)
      : POSTGRES_OPTION_DEFAULTS.connect_timeout,
  };

  const ssl = readTrimmed(env, "POSTGRES_SSL");
  if (ssl) {
    options.ssl = parsePostgresSsl(ssl);
  }

  return options;
}
function parsePostgresSsl(raw: string): PostgresSslValue {
  switch (raw.trim().toLowerCase()) {
    case "require":
      return "require";
    case "allow":
      return "allow";
    case "prefer":
      return "prefer";
    case "verify-full":
      return "verify-full";
    case "no-verify":
      return { rejectUnauthorized: false };
    case "false":
    case "disable":
      return false;
    default:
      throw new DatabaseConfigurationError(
        `POSTGRES_SSL must be one of require | allow | prefer | verify-full | no-verify | disable (received "${raw}").`,
      );
  }
}



export interface ResolveDatabaseConfigOptions {
  /** Base directory used to resolve a relative `PGLITE_DATA_DIR`. */
  cwd?: string;
}

/**
 * Resolves the active database configuration from the environment.
 *
 * Throws {@link DatabaseConfigurationError} (fail-fast, before any connection is
 * opened) when the configuration is missing, ambiguous, or forbidden.
 */
export function resolveDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: ResolveDatabaseConfigOptions = {},
): DatabaseConfig {
  const nodeEnv = readTrimmed(env, "NODE_ENV") ?? "development";
  const isProduction = nodeEnv === "production";

  const explicitDriver = readTrimmed(env, "DATABASE_DRIVER");
  if (explicitDriver !== undefined && !isDatabaseDriver(explicitDriver)) {
    throw new DatabaseConfigurationError(
      `DATABASE_DRIVER must be one of ${DATABASE_DRIVERS.join(" | ")} (received "${explicitDriver}").`,
    );
  }

  const useLocalDbRaw = readTrimmed(env, "USE_LOCAL_DB");
  const useLocalDb = useLocalDbRaw ? parseBooleanFlag("USE_LOCAL_DB", useLocalDbRaw) : false;

  const autoMigrateRaw = readTrimmed(env, "DB_AUTO_MIGRATE");
  const autoMigrate = autoMigrateRaw ? parseBooleanFlag("DB_AUTO_MIGRATE", autoMigrateRaw) : false;

  const connectionString = readTrimmed(env, "DATABASE_URL");

  if (isProduction) {
    if (useLocalDb) {
      throw new DatabaseConfigurationError(
        "USE_LOCAL_DB=true is rejected when NODE_ENV=production. Configure DATABASE_URL with a managed PostgreSQL (Neon) connection string instead.",
      );
    }
    if (explicitDriver === "pglite") {
      throw new DatabaseConfigurationError(
        "DATABASE_DRIVER=pglite is rejected when NODE_ENV=production. Use DATABASE_DRIVER=neon (or postgres) with DATABASE_URL.",
      );
    }
    if (!connectionString) {
      throw new DatabaseConfigurationError(
        "DATABASE_URL is required when NODE_ENV=production. Refusing to fall back to the embedded PGlite database.",
      );
    }

    return buildRemoteConfig({
      driver: explicitDriver === undefined ? inferRemoteDriver(connectionString) : explicitDriver,
      connectionString,
      env,
      nodeEnv,
      isProduction,
      autoMigrate,
      driverSource: explicitDriver === undefined ? "inferred" : "explicit",
    });
  }

  if (useLocalDb && (explicitDriver === "neon" || explicitDriver === "postgres")) {
    throw new DatabaseConfigurationError(
      `USE_LOCAL_DB=true conflicts with DATABASE_DRIVER=${explicitDriver}. Remove one of the two variables.`,
    );
  }

  if (explicitDriver === "pglite" || useLocalDb) {
    return {
      driver: "pglite",
      pgliteDataDir: resolvePgliteDataDir(env, options.cwd),
      nodeEnv,
      isProduction,
      driverSource: explicitDriver === "pglite" ? "explicit" : "local-flag",
      autoMigrate,
    };
  }

  if (connectionString) {
    return buildRemoteConfig({
      driver: explicitDriver === undefined ? inferRemoteDriver(connectionString) : explicitDriver,
      connectionString,
      env,
      nodeEnv,
      isProduction,
      autoMigrate,
      driverSource: explicitDriver === undefined ? "inferred" : "explicit",
    });
  }

  // Local development / test fallback only — production always throws above.
  return {
    driver: "pglite",
    pgliteDataDir: resolvePgliteDataDir(env, options.cwd),
    nodeEnv,
    isProduction,
    driverSource: "development-fallback",
    autoMigrate,
  };
}

interface BuildRemoteConfigInput {
  driver: "neon" | "postgres";
  connectionString: string;
  env: NodeJS.ProcessEnv;
  nodeEnv: string;
  isProduction: boolean;
  autoMigrate: boolean;
  driverSource: DriverSource;
}

function buildRemoteConfig(input: BuildRemoteConfigInput): NeonDatabaseConfig | PostgresDatabaseConfig {
  const { driver, connectionString, env, nodeEnv, isProduction, autoMigrate, driverSource } = input;

  const schemeIsValid = isPostgresUrl(connectionString) || (driver === "neon" && isHttpUrl(connectionString));
  if (!schemeIsValid) {
    throw new DatabaseConfigurationError(
      `DATABASE_URL is not usable with DATABASE_DRIVER=${driver}. Expected a postgres:// / postgresql:// URL` +
        (driver === "neon" ? " or the Neon https:// HTTP endpoint." : "."),
    );
  }

  const common = { nodeEnv, isProduction, autoMigrate, driverSource };

  if (driver === "postgres") {
    return {
      driver: "postgres",
      connectionString,
      postgres: resolvePostgresConnectionOptions(env),
      ...common,
    };
  }

  return { driver: "neon", connectionString, ...common };
}
