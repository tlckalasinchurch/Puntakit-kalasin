import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveDefaultSuperAdminPinPolicy } from "./bootstrap.js";

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

/** Number of `.sql` files in server/db/migrations (drizzle journal entries).
 *  0008_import_audit added the mission import L1/L2 tables (Phase 2);
 *  0009_import_duplicate_decisions added the duplicate-review decision log;
 *  0010_org_hierarchy added org hierarchy columns to groups;
 *  0011_import_merge_plans added merge plans and their approval state;
 *  0012_membership_lifecycle_and_media added membership_terms, media_assets and members.member_no. */
const MIGRATION_COUNT = 14;

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

/**
 * P0: `DEFAULT_SUPER_ADMIN_PIN` is a constant in source. It may only ever reach
 * the local embedded PGlite directory, never a remote or production database.
 */
describe("starter super-admin PIN policy", () => {
  it("seeds only on the local embedded database outside production", () => {
    expect(resolveDefaultSuperAdminPinPolicy({ driver: "pglite", isProduction: false }).mode).toBe("seed");
  });

  it("refuses under NODE_ENV=production regardless of driver", () => {
    for (const driver of ["pglite", "postgres", "neon"] as const) {
      const policy = resolveDefaultSuperAdminPinPolicy({ driver, isProduction: true });
      expect(policy.mode).toBe("refuse");
      expect(policy.reason).toContain("production");
    }
  });

  it("refuses on a remote driver even outside production", () => {
    for (const driver of ["postgres", "neon"] as const) {
      const policy = resolveDefaultSuperAdminPinPolicy({ driver, isProduction: false });
      expect(policy.mode).toBe("refuse");
      expect(policy.reason).toContain(driver);
    }
  });

  it("writes the starter PIN for a super admin that has none, on PGlite", async () => {
    setEnv({
      NODE_ENV: "development",
      DATABASE_DRIVER: "pglite",
      PGLITE_DATA_DIR: makeTempDataDir(),
    });
    const { client, bootstrap, schema } = await loadModules();
    const auth = await import("../lib/firstPartyAuth.js");
    await bootstrap.bootstrapDatabase({ logger: silentLogger });
    const db = client.getDb();

    const [admin] = await db
      .insert(schema.users)
      .values({ email: "seed-me@p0.local", passwordHash: "x", name: "seed", role: "super_admin" })
      .returning();
    expect(admin.pinHash).toBeNull();
    expect(await bootstrap.countSuperAdminsWithoutPin()).toBe(1);

    const warnings: string[] = [];
    const audit = await bootstrap.ensureDefaultSuperAdminPins(
      { log: () => {}, warn: (m: string) => warnings.push(m) },
      { driver: "pglite", isProduction: false },
    );

    expect(audit.mode).toBe("seed");
    expect(audit.missingPins).toBe(1);
    expect(audit.seeded).toBe(1);
    expect(await bootstrap.countSuperAdminsWithoutPin()).toBe(0);
    expect(warnings.join("\n")).toContain("starter PIN");

    const [after] = await db.select().from(schema.users).where(eq(schema.users.id, admin.id)).limit(1);
    expect(await auth.verifyPin("999999", after.pinHash)).toBe(true);

    await client.closeDatabase();
  }, 120_000);

  it("never overwrites a PIN that is already set", async () => {
    setEnv({
      NODE_ENV: "development",
      DATABASE_DRIVER: "pglite",
      PGLITE_DATA_DIR: makeTempDataDir(),
    });
    const { client, bootstrap, schema } = await loadModules();
    const auth = await import("../lib/firstPartyAuth.js");
    await bootstrap.bootstrapDatabase({ logger: silentLogger });
    const db = client.getDb();

    const chosen = await auth.hashPin("314159");
    const [admin] = await db
      .insert(schema.users)
      .values({
        email: "already-set@p0.local",
        passwordHash: "x",
        name: "chosen",
        role: "super_admin",
        pinHash: chosen,
      })
      .returning();

    const audit = await bootstrap.ensureDefaultSuperAdminPins(silentLogger, { driver: "pglite", isProduction: false });

    expect(audit.missingPins).toBe(0);
    expect(audit.seeded).toBe(0);
    expect(await auth.verifyPin("314159", admin.pinHash)).toBe(true);

    const [after] = await db.select().from(schema.users).where(eq(schema.users.id, admin.id)).limit(1);
    expect(after.pinHash).toBe(chosen);
    expect(await auth.verifyPin("999999", after.pinHash)).toBe(false);

    await client.closeDatabase();
  }, 120_000);

  it("reports without writing when the policy refuses", async () => {
    setEnv({
      NODE_ENV: "development",
      DATABASE_DRIVER: "pglite",
      PGLITE_DATA_DIR: makeTempDataDir(),
    });
    const { client, bootstrap, schema } = await loadModules();
    await bootstrap.bootstrapDatabase({ logger: silentLogger });
    const db = client.getDb();

    const [admin] = await db
      .insert(schema.users)
      .values({ email: "production-like@p0.local", passwordHash: "x", name: "prod", role: "super_admin" })
      .returning();
    expect(admin.pinHash).toBeNull();

    const warnings: string[] = [];
    // Same embedded database, but the audit is told it is production: it must
    // warn and leave the row untouched rather than seed the starter PIN.
    const audit = await bootstrap.ensureDefaultSuperAdminPins(
      { log: () => {}, warn: (m: string) => warnings.push(m) },
      { driver: "pglite", isProduction: true },
    );

    expect(audit.mode).toBe("refuse");
    expect(audit.missingPins).toBe(1);
    expect(audit.seeded).toBe(0);
    expect(warnings.join("\n")).toContain("pnpm db:set-pin:env");

    const [after] = await db.select().from(schema.users).where(eq(schema.users.id, admin.id)).limit(1);
    expect(after.pinHash).toBeNull();
    expect(await bootstrap.countSuperAdminsWithoutPin()).toBe(1);

    await client.closeDatabase();
  }, 120_000);
});
