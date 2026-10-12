import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * P0 readiness gate: a `super_admin` with a NULL `pin_hash` can never
 * authenticate, so `/api/ready` must not report a production deployment as ready
 * while one exists. Outside production the gate stays off — local development
 * is exactly where such rows are created on purpose.
 *
 * `resolveDatabaseConfig()` rejects PGlite under NODE_ENV=production, so the
 * production case is exercised by flipping NODE_ENV after the embedded database
 * is already open: `getDb()` serves the cached handle and never re-resolves the
 * configuration.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalNodeEnv = process.env.NODE_ENV;
const tempDirs: string[] = [];

describe("/api/ready blocks a production database with no super-admin PIN", () => {
  let server: Server;
  let baseUrl: string;
  let db: Awaited<ReturnType<typeof import("./db/client.js").getDb>>;
  let schema: typeof import("../shared/schema.js");
  let auth: typeof import("./lib/firstPartyAuth.js");
  let superAdminId: string;

  beforeAll(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-ready-p0-"));
    tempDirs.push(root);
    for (const key of MANAGED_KEYS) delete process.env[key];
    process.env.NODE_ENV = "development";
    process.env.DATABASE_DRIVER = "pglite";
    process.env.PGLITE_DATA_DIR = path.join(root, ".db_data");

    const client = await import("./db/client.js");
    const bootstrap = await import("./db/bootstrap.js");
    schema = await import("../shared/schema.js");
    auth = await import("./lib/firstPartyAuth.js");
    const { createApp } = await import("./app.js");
    await bootstrap.bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    db = client.getDb();

    const [admin] = await db
      .insert(schema.users)
      .values({ email: "pinned@p0.local", passwordHash: "x", name: "pinned", role: "super_admin" })
      .returning();
    superAdminId = admin.id;

    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (typeof address === "object" && address !== null) baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  }, 120_000);

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await (await import("./db/client.js")).closeDatabase();
    for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  const ready = async () => {
    const response = await fetch(`${baseUrl}/api/ready`);
    return { status: response.status, body: await response.json() as { success: boolean; data?: { status: string }; error?: { code: string; message: string } } };
  };

  const setProduction = (value: string | undefined) => {
    if (value === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = value;
  };

  it("reports ready outside production even though the super admin has no PIN", async () => {
    setProduction("development");

    const { status, body } = await ready();

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data?.status).toBe("ready");
  });

  it("returns 503 SUPER_ADMIN_PIN_MISSING in production while the PIN is unset", async () => {
    setProduction("production");

    const { status, body } = await ready();

    expect(status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe("SUPER_ADMIN_PIN_MISSING");
    expect(body.error?.message).toContain("pnpm db:set-pin:env");
    // The response must not leak which account is affected.
    expect(JSON.stringify(body)).not.toContain("pinned@p0.local");
  });

  it("returns to ready once the super admin has a PIN, and health stays 200 throughout", async () => {
    setProduction("production");
    const healthBefore = await fetch(`${baseUrl}/api/health`);
    expect(healthBefore.status).toBe(200);

    await db
      .update(schema.users)
      .set({ pinHash: await auth.hashPin("246810"), updatedAt: new Date() })
      .where(eq(schema.users.id, superAdminId));

    const { status, body } = await ready();
    expect(status).toBe(200);
    expect(body.data?.status).toBe("ready");

    // Liveness is deliberately independent of the readiness gate.
    const healthAfter = await fetch(`${baseUrl}/api/health`);
    expect(healthAfter.status).toBe(200);

    const [after] = await db.select().from(schema.users).where(eq(schema.users.id, superAdminId)).limit(1);
    expect(after.pinHash).not.toBeNull();
    expect(await auth.verifyPin("246810", after.pinHash)).toBe(true);
  });

  it("still fails readiness when a second super admin is left without a PIN", async () => {
    setProduction("production");
    const [second] = await db
      .insert(schema.users)
      .values({ email: "second@p0.local", passwordHash: "x", name: "second", role: "super_admin" })
      .returning();
    expect(second.pinHash).toBeNull();

    const { status, body } = await ready();

    expect(status).toBe(503);
    expect(body.error?.code).toBe("SUPER_ADMIN_PIN_MISSING");

    await db.delete(schema.users).where(eq(schema.users.id, second.id));
  }, 30_000);

  it("ignores non-super-admin accounts without a PIN", async () => {
    setProduction("production");
    const [admin] = await db
      .insert(schema.users)
      .values({ email: "plain-admin@p0.local", passwordHash: "x", name: "plain", role: "admin" })
      .returning();
    expect(admin.pinHash).toBeNull();

    const { status } = await ready();
    expect(status).toBe(200);

    await db.delete(schema.users).where(eq(schema.users.id, admin.id));
  }, 30_000);
});