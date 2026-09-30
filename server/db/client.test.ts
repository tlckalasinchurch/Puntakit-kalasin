import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Driver-selection + fail-fast tests for the database client singleton.
 *
 * Each case resets the module registry so the memoised configuration/handle from
 * a previous case cannot leak into the next one.
 */

const MANAGED_KEYS = [
  "NODE_ENV",
  "DATABASE_DRIVER",
  "DATABASE_URL",
  "USE_LOCAL_DB",
  "PGLITE_DATA_DIR",
  "DB_AUTO_MIGRATE",
  "POSTGRES_MAX_CONNECTIONS",
  "POSTGRES_IDLE_TIMEOUT_SECONDS",
  "POSTGRES_CONNECT_TIMEOUT_SECONDS",
  "POSTGRES_SSL",
] as const;

const originalEnv = { ...process.env };
const tempDirs: string[] = [];

function setEnv(values: Partial<Record<(typeof MANAGED_KEYS)[number], string | undefined>>): void {
  for (const key of MANAGED_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) process.env[key] = value;
  }
}

/** Isolated PGlite data directory so tests never touch ./.db_data. */
function makeTempDataDir(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-db-test-"));
  tempDirs.push(root);
  return path.join(root, "nested", ".db_data");
}

async function loadClient() {
  vi.resetModules();
  // Loaded together so the error class identity matches the client's own config module.
  const config = await import("./config.js");
  const client = await import("./client.js");
  return { client, config };
}

afterEach(() => {
  vi.resetModules();
});

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("database client driver selection", () => {
  it(
    "opens the embedded PGlite database outside production when nothing is configured",
    async () => {
      setEnv({ NODE_ENV: "development", PGLITE_DATA_DIR: makeTempDataDir() });
      const { client } = await loadClient();

      expect(client.getDatabaseDriver()).toBe("pglite");
      const handle = client.getDatabaseHandle();
      expect(handle.driver).toBe("pglite");
      // Singleton: repeated calls reuse the exact same handle.
      expect(client.getDb()).toBe(handle.db);
      expect(client.hasOpenDatabaseHandle()).toBe(true);

      await client.closeDatabase();
      expect(client.hasOpenDatabaseHandle()).toBe(false);
    },
    60_000,
  );

  it(
    "reopens the database after a graceful shutdown",
    async () => {
      setEnv({ NODE_ENV: "development", PGLITE_DATA_DIR: makeTempDataDir() });
      const { client } = await loadClient();

      const first = client.getDatabaseHandle();
      await client.closeDatabase();
      const second = client.getDatabaseHandle();

      expect(second.driver).toBe("pglite");
      expect(second).not.toBe(first);

      await client.closeDatabase();
    },
    60_000,
  );

  it(
    "creates a postgres-js handle for DATABASE_DRIVER=postgres without eager connection",
    async () => {
      setEnv({
        NODE_ENV: "development",
        DATABASE_DRIVER: "postgres",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/puntakit",
        POSTGRES_MAX_CONNECTIONS: "3",
      });
      const { client } = await loadClient();

      expect(client.getDatabaseDriver()).toBe("postgres");
      const handle = client.getDatabaseHandle();
      expect(handle.driver).toBe("postgres");
      expect(client.getDatabaseConfig()).toMatchObject({ postgres: { max: 3 } });

      await client.closeDatabase();
    },
    30_000,
  );

  it(
    "creates a neon http handle and treats shutdown as a no-op",
    async () => {
      setEnv({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:secret@ep-cool-lab-123456.ap-southeast-1.aws.neon.tech/puntakit",
      });
      const { client } = await loadClient();

      expect(client.getDatabaseDriver()).toBe("neon");
      expect(client.getDatabaseHandle().driver).toBe("neon");

      await expect(client.closeDatabase()).resolves.toBeUndefined();
    },
    30_000,
  );
});

describe("database client production fail-fast", () => {
  it("refuses to open a database when DATABASE_URL is missing in production", async () => {
    setEnv({ NODE_ENV: "production", PGLITE_DATA_DIR: makeTempDataDir() });
    const { client, config } = await loadClient();

    expect(() => client.getDb()).toThrow(config.DatabaseConfigurationError);
    expect(() => client.getDb()).toThrow(/DATABASE_URL is required when NODE_ENV=production/);
    expect(client.hasOpenDatabaseHandle()).toBe(false);
  });

  it("refuses USE_LOCAL_DB=true in production", async () => {
    setEnv({
      NODE_ENV: "production",
      USE_LOCAL_DB: "true",
      PGLITE_DATA_DIR: makeTempDataDir(),
      DATABASE_URL: "postgresql://user:secret@ep-cool-lab-123456.aws.neon.tech/puntakit",
    });
    const { client } = await loadClient();

    expect(() => client.getDb()).toThrow(/USE_LOCAL_DB=true is rejected when NODE_ENV=production/);
    expect(client.hasOpenDatabaseHandle()).toBe(false);
  });

  it("does not create a PGlite data directory when production config is invalid", async () => {
    const dataDir = makeTempDataDir();
    setEnv({ NODE_ENV: "production", DATABASE_DRIVER: "pglite", DATABASE_URL: "", PGLITE_DATA_DIR: dataDir });
    const { client } = await loadClient();

    expect(() => client.getDb()).toThrow(/DATABASE_DRIVER=pglite is rejected when NODE_ENV=production/);
    expect(fs.existsSync(dataDir)).toBe(false);
  });

  it("selects the Neon driver in production when DATABASE_URL is configured", async () => {
    setEnv({
      NODE_ENV: "production",
      DATABASE_DRIVER: "neon",
      DATABASE_URL: "postgresql://user:secret@ep-cool-lab-123456-pooler.aws.neon.tech/puntakit?sslmode=require",
    });
    const { client } = await loadClient();

    expect(client.getDatabaseDriver()).toBe("neon");
    expect(client.getDatabaseConfig()).toMatchObject({ isProduction: true, driverSource: "explicit" });
  });
});
