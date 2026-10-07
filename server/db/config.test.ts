import { describe, expect, it } from "vitest";
import * as path from "node:path";
import {
  DEFAULT_PGLITE_DATA_DIR,
  DatabaseConfigurationError,
  resolveDatabaseConfig,
  resolvePgliteDataDir,
  resolvePostgresConnectionOptions,
  type DatabaseConfig,
} from "./config.js";

const NEON_URL =
  "postgresql://user:secret@ep-cool-lab-123456-pooler.ap-southeast-1.aws.neon.tech/puntakit?sslmode=require";
const LOCAL_PG_URL = "postgresql://postgres:postgres@127.0.0.1:5432/puntakit";

function expectConfigError(env: NodeJS.ProcessEnv, messageFragment: string): void {
  let thrown: unknown;
  try {
    resolveDatabaseConfig(env);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(DatabaseConfigurationError);
  expect((thrown as Error).message).toContain(messageFragment);
}

describe("database driver selection", () => {
  it("honours an explicit DATABASE_DRIVER=neon", () => {
    const config = resolveDatabaseConfig({ DATABASE_DRIVER: "neon", DATABASE_URL: NEON_URL });
    expect(config.driver).toBe("neon");
    expect(config.driverSource).toBe("explicit");
    expect(config.isProduction).toBe(false);
  });

  it("honours an explicit DATABASE_DRIVER=postgres and parses connection options", () => {
    const config = resolveDatabaseConfig({
      DATABASE_DRIVER: "postgres",
      DATABASE_URL: LOCAL_PG_URL,
      POSTGRES_MAX_CONNECTIONS: "25",
      POSTGRES_IDLE_TIMEOUT_SECONDS: "45",
      POSTGRES_CONNECT_TIMEOUT_SECONDS: "7",
      POSTGRES_SSL: "no-verify",
    });
    expect(config).toMatchObject({
      driver: "postgres",
      connectionString: LOCAL_PG_URL,
      driverSource: "explicit",
      postgres: {
        max: 25,
        idle_timeout: 45,
        connect_timeout: 7,
        ssl: { rejectUnauthorized: false },
      },
    });
  });

  it("honours an explicit DATABASE_DRIVER=pglite outside production", () => {
    const config = resolveDatabaseConfig({ DATABASE_DRIVER: "pglite" });
    expect(config).toMatchObject({ driver: "pglite", driverSource: "explicit" });
  });

  it("honours USE_LOCAL_DB=true outside production", () => {
    const config = resolveDatabaseConfig({ USE_LOCAL_DB: "true" });
    expect(config).toMatchObject({ driver: "pglite", driverSource: "local-flag" });
  });

  it("infers neon from a neon.tech host and postgres from any other host", () => {
    expect(resolveDatabaseConfig({ DATABASE_URL: NEON_URL })).toMatchObject({
      driver: "neon",
      driverSource: "inferred",
    });
    expect(resolveDatabaseConfig({ DATABASE_URL: LOCAL_PG_URL })).toMatchObject({
      driver: "postgres",
      driverSource: "inferred",
    });
  });

  it("infers neon from a Neon https:// HTTP endpoint", () => {
    const config = resolveDatabaseConfig({
      DATABASE_URL: "https://ep-cool-lab-123456.ap-southeast-1.aws.neon.tech/sql",
    });
    expect(config).toMatchObject({ driver: "neon", driverSource: "inferred" });
  });

  it("rejects an unknown DATABASE_DRIVER value", () => {
    expectConfigError(
      { DATABASE_DRIVER: "mysql", DATABASE_URL: NEON_URL },
      "DATABASE_DRIVER must be one of neon | postgres | pglite",
    );
  });

  it("rejects USE_LOCAL_DB=true combined with a remote explicit driver", () => {
    expectConfigError(
      { USE_LOCAL_DB: "true", DATABASE_DRIVER: "neon", DATABASE_URL: NEON_URL },
      "USE_LOCAL_DB=true conflicts with DATABASE_DRIVER=neon",
    );
  });

  it("rejects a non-boolean USE_LOCAL_DB value", () => {
    expectConfigError({ USE_LOCAL_DB: "yes" }, 'USE_LOCAL_DB must be "true" or "false"');
  });

  it("rejects a DATABASE_URL scheme that does not match the chosen driver", () => {
    expectConfigError(
      { DATABASE_DRIVER: "postgres", DATABASE_URL: "https://ep-cool-lab-123456.aws.neon.tech/sql" },
      "DATABASE_URL is not usable with DATABASE_DRIVER=postgres",
    );
  });
});

describe("production fail-fast rules", () => {
  it("throws when DATABASE_URL is missing in production (no PGlite fallback)", () => {
    expectConfigError({ NODE_ENV: "production" }, "DATABASE_URL is required when NODE_ENV=production");
  });

  it("throws when DATABASE_URL is blank even though PGLITE_DATA_DIR is set", () => {
    expectConfigError(
      { NODE_ENV: "production", DATABASE_DRIVER: "", PGLITE_DATA_DIR: "./.db_data" },
      "Refusing to fall back to the embedded PGlite database",
    );
  });

  it("rejects USE_LOCAL_DB=true in production even when DATABASE_URL exists", () => {
    expectConfigError(
      { NODE_ENV: "production", USE_LOCAL_DB: "true", DATABASE_URL: NEON_URL },
      "USE_LOCAL_DB=true is rejected when NODE_ENV=production",
    );
  });

  it("rejects DATABASE_DRIVER=pglite in production", () => {
    expectConfigError(
      { NODE_ENV: "production", DATABASE_DRIVER: "pglite", DATABASE_URL: NEON_URL },
      "DATABASE_DRIVER=pglite is rejected when NODE_ENV=production",
    );
  });

  it("accepts a Neon configuration in production", () => {
    const config: DatabaseConfig = resolveDatabaseConfig({
      NODE_ENV: "production",
      DATABASE_DRIVER: "neon",
      DATABASE_URL: NEON_URL,
    });
    expect(config).toMatchObject({ driver: "neon", isProduction: true, nodeEnv: "production" });
  });

  it("falls back to embedded PGlite outside production when nothing is configured", () => {
    expect(resolveDatabaseConfig({ NODE_ENV: "development" })).toMatchObject({
      driver: "pglite",
      driverSource: "development-fallback",
    });
    expect(resolveDatabaseConfig({ NODE_ENV: "test" })).toMatchObject({ driver: "pglite" });
  });
});

describe("PGlite data directory resolution", () => {
  it("defaults to ./.db_data resolved against the working directory", () => {
    const cwd = path.resolve("/tmp/puntakit");
    expect(resolvePgliteDataDir({}, cwd)).toBe(path.join(cwd, DEFAULT_PGLITE_DATA_DIR));
  });

  it("resolves a relative PGLITE_DATA_DIR against the working directory", () => {
    const cwd = path.resolve("/tmp/puntakit");
    expect(resolvePgliteDataDir({ PGLITE_DATA_DIR: "./local/.db_data" }, cwd)).toBe(
      path.join(cwd, "local", ".db_data"),
    );
  });

  it("keeps an absolute PGLITE_DATA_DIR untouched", () => {
    const absolute = path.resolve("/tmp/puntakit-pglite");
    expect(resolvePgliteDataDir({ PGLITE_DATA_DIR: absolute })).toBe(absolute);
  });
});

describe("postgres-js connection options", () => {
  it("applies documented defaults and leaves ssl to the driver", () => {
    const options = resolvePostgresConnectionOptions({});
    expect(options).toEqual({ max: 10, idle_timeout: 20, connect_timeout: 10 });
    expect(options.ssl).toBeUndefined();
  });

  it("maps POSTGRES_SSL values onto postgres-js ssl values", () => {
    expect(resolvePostgresConnectionOptions({ POSTGRES_SSL: "require" }).ssl).toBe("require");
    expect(resolvePostgresConnectionOptions({ POSTGRES_SSL: "verify-full" }).ssl).toBe("verify-full");
    expect(resolvePostgresConnectionOptions({ POSTGRES_SSL: "disable" }).ssl).toBe(false);
    expect(resolvePostgresConnectionOptions({ POSTGRES_SSL: "no-verify" }).ssl).toEqual({
      rejectUnauthorized: false,
    });
  });

  it("rejects invalid numeric and ssl values", () => {
    expect(() => resolvePostgresConnectionOptions({ POSTGRES_MAX_CONNECTIONS: "many" })).toThrow(
      DatabaseConfigurationError,
    );
    expect(() => resolvePostgresConnectionOptions({ POSTGRES_MAX_CONNECTIONS: "0" })).toThrow(
      /POSTGRES_MAX_CONNECTIONS must be between/,
    );
    expect(() => resolvePostgresConnectionOptions({ POSTGRES_IDLE_TIMEOUT_SECONDS: "-5" })).toThrow(
      /POSTGRES_IDLE_TIMEOUT_SECONDS must be a whole number/,
    );
    expect(() => resolvePostgresConnectionOptions({ POSTGRES_CONNECT_TIMEOUT_SECONDS: "1000" })).toThrow(
      /POSTGRES_CONNECT_TIMEOUT_SECONDS must be between/,
    );
    expect(() => resolvePostgresConnectionOptions({ POSTGRES_SSL: "sometimes" })).toThrow(
      /POSTGRES_SSL must be one of/,
    );
  });
});
