import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Real embedded-PostgreSQL (PGlite) bootstrap tests: migrations are applied to a
 * throwaway data directory and then exercised through the same typed client the
 * API routes use.
 */

const MANAGED_KEYS = [
  "NODE_ENV",
  "DATABASE_DRIVER",
  "DATABASE_URL",
  "USE_LOCAL_DB",
  "PGLITE_DATA_DIR",
  "DB_AUTO_MIGRATE",
] as const;

/** Number of `.sql` files in server/db/migrations (drizzle journal entries). */
const MIGRATION_COUNT = 8;

const originalEnv = { ...process.env };
const tempDirs: string[] = [];
const silentLogger = { log: (): void => {}, warn: (): void => {} };

function setEnv(values: Partial<Record<(typeof MANAGED_KEYS)[number], string | undefined>>): void {
  for (const key of MANAGED_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) process.env[key] = value;
  }
}

function makeTempDataDir(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-bootstrap-test-"));
  tempDirs.push(root);
  return path.join(root, "nested", ".db_data");
}

async function loadModules() {
  vi.resetModules();
  const client = await import("./client.js");
  const bootstrap = await import("./bootstrap.js");
  const schema = await import("../../shared/schema.js");
  return { client, bootstrap, schema };
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

describe("PGlite local bootstrap", () => {
  it("applies every migration to a fresh data directory and serves typed queries", async () => {
    setEnv({
      NODE_ENV: "development",
      DATABASE_DRIVER: "pglite",
      PGLITE_DATA_DIR: makeTempDataDir(),
    });
    const { client, bootstrap, schema } = await loadModules();

    const result = await bootstrap.bootstrapDatabase({ logger: silentLogger });

    expect(result.driver).toBe("pglite");
    expect(result.ranMigrations).toBe(true);
    expect(result.verification?.appliedMigrations).toBe(MIGRATION_COUNT);
    expect(result.verification?.tables).toEqual(
      expect.arrayContaining(["members", "groups", "group_members", "attendance_records", "users"]),
    );

    // The migrated schema is usable through the shared Drizzle schema/client.
    const db = client.getDb();
    const [inserted] = await db
      .insert(schema.members)
      .values({ name: "ทดสอบ PGlite", phone: "0800000000" })
      .returning();
    expect(inserted?.id).toBeTruthy();

    const [found] = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, inserted.id))
      .limit(1);
    expect(found?.name).toBe("ทดสอบ PGlite");

    await client.closeDatabase();
  }, 120_000);

  it("is idempotent when the bootstrap runs twice against the same data directory", async () => {
    setEnv({
      NODE_ENV: "development",
      DATABASE_DRIVER: "pglite",
      PGLITE_DATA_DIR: makeTempDataDir(),
    });
    const { client, bootstrap } = await loadModules();

    const first = await bootstrap.bootstrapDatabase({ logger: silentLogger });
    const second = await bootstrap.bootstrapDatabase({ logger: silentLogger });

    expect(first.verification?.appliedMigrations).toBe(MIGRATION_COUNT);
    expect(second.verification?.appliedMigrations).toBe(MIGRATION_COUNT);
    expect(second.verification?.tables).toEqual(first.verification?.tables);

    await client.closeDatabase();
  }, 120_000);

  it(
    "writes the PGlite data directory into PGLITE_DATA_DIR",
    async () => {
      const dataDir = makeTempDataDir();
      setEnv({ NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: dataDir });
      const { client } = await loadModules();

      expect(client.getDatabaseConfig()).toMatchObject({ driver: "pglite", pgliteDataDir: dataDir });

      const handle = client.getDatabaseHandle();
      expect(handle.driver).toBe("pglite");
      if (handle.driver !== "pglite") return; // narrows the union for TypeScript
      await handle.client.waitReady;

      expect(fs.existsSync(path.join(dataDir, "PG_VERSION"))).toBe(true);

      await client.closeDatabase();
    },
    120_000,
  );
});

describe("remote driver bootstrap policy", () => {
  it("does not migrate (or connect) for postgres unless DB_AUTO_MIGRATE is enabled", async () => {
    setEnv({
      NODE_ENV: "development",
      DATABASE_DRIVER: "postgres",
      // Port 1 is guaranteed unreachable: the test fails loudly if a connection is attempted.
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:1/puntakit",
    });
    const { client, bootstrap } = await loadModules();

    const result = await bootstrap.bootstrapDatabase({ logger: silentLogger });

    expect(result.ranMigrations).toBe(false);
    expect(result.reason).toContain("DB_AUTO_MIGRATE");
    expect(result.verification).toBeNull();

    await client.closeDatabase();
  }, 60_000);
});
