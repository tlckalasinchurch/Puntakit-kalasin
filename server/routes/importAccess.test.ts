import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { count as sqlCount } from "drizzle-orm";

/**
 * Import write access is super_admin only. Every endpoint that loads, decides or approves
 * import data is exercised with each role and without a session, against real PGlite
 * Postgres. Request bodies are deliberately invalid or point at nothing: a role that is let
 * through must stop at validation (400/404), never write, and a role that is refused must
 * leave every import table untouched. All data here is synthetic.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
const tempDirs: string[] = [];

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

const NIL = "00000000-0000-4000-8000-000000000000";
const DENIED_ROLES = ["admin", "ministry_leader", "staff", "group_leader", "viewer", "member"] as const;

type Endpoint = { name: string; path: string; init: { headers?: Record<string, string>; body?: string } };
const json = (body: unknown): Endpoint["init"] => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const WRITE_ENDPOINTS: Endpoint[] = [
  { name: "upload (raw)", path: "/api/import/upload", init: { headers: { "Content-Type": "application/octet-stream" } } },
  { name: "upload/token", path: "/api/import/upload/token", init: json({}) },
  { name: "upload/from-blob", path: "/api/import/upload/from-blob", init: json({}) },
  { name: "duplicates/decisions", path: "/api/import/duplicates/decisions", init: json({}) },
  { name: "rules/:id/confirm", path: `/api/import/rules/${NIL}/confirm`, init: json({}) },
  { name: "merge-plans (create)", path: "/api/import/merge-plans", init: json({}) },
  { name: "merge-plans/:id/review", path: `/api/import/merge-plans/${NIL}/review`, init: json({}) },
  { name: "merge-plans/:id/withdraw", path: `/api/import/merge-plans/${NIL}/withdraw`, init: json({}) },
  { name: "org-data/dry-run", path: "/api/org-data/dry-run", init: json({}) },
  { name: "org-data/apply", path: "/api/org-data/apply", init: json({}) },
  { name: "org-data/rollback", path: "/api/org-data/rollback", init: json({}) },
];

describe("import write access is super_admin only (real PGlite Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");
  const cookies: Record<string, string> = {};

  beforeAll(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-import-access-"));
    tempDirs.push(root);
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });
    const client = await import("../db/client.js");
    const bootstrap = await import("../db/bootstrap.js");
    schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await bootstrap.bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    db = client.getDb();
    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        const a = server.address();
        if (typeof a === "object" && a !== null) baseUrl = `http://127.0.0.1:${a.port}`;
        resolve();
      });
    });
    for (const role of ["super_admin", ...DENIED_ROLES] as const) {
      const [row] = await db.insert(schema.users).values({ email: `${role}@import-access.local`, passwordHash: "x", name: role, role }).returning();
      cookies[role] = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: row.id, email: row.email, role })}`;
    }
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await (await import("../db/client.js")).closeDatabase();
  });

  const call = (endpoint: Endpoint, cookie?: string) =>
    fetch(`${baseUrl}${endpoint.path}`, {
      method: "POST",
      headers: { ...endpoint.init.headers, ...(cookie ? { Cookie: cookie } : {}) },
      body: endpoint.init.body,
    });

  const snapshot = async () => ({
    batches: (await db.select({ c: sqlCount() }).from(schema.importBatches))[0].c,
    sourceRows: (await db.select({ c: sqlCount() }).from(schema.importSourceRows))[0].c,
    mergePlans: (await db.select({ c: sqlCount() }).from(schema.importMergePlans))[0].c,
    members: (await db.select({ c: sqlCount() }).from(schema.members))[0].c,
    groups: (await db.select({ c: sqlCount() }).from(schema.groups))[0].c,
    groupMembers: (await db.select({ c: sqlCount() }).from(schema.groupMembers))[0].c,
    audit: (await db.select({ c: sqlCount() }).from(schema.auditLogs))[0].c,
  });

  describe.each(WRITE_ENDPOINTS)("POST $name", (endpoint) => {
    it("answers 401 without a session", async () => {
      expect((await call(endpoint)).status).toBe(401);
    });

    it.each(DENIED_ROLES)("answers 403 to %s", async (role) => {
      expect((await call(endpoint, cookies[role])).status).toBe(403);
    });

    it("lets super_admin through authorization (stops at validation, not at 401/403)", async () => {
      const status = (await call(endpoint, cookies.super_admin)).status;
      expect([401, 403]).not.toContain(status);
    });
  });

  it("refused requests change nothing: no import, member, group or audit rows", async () => {
    const before = await snapshot();
    for (const endpoint of WRITE_ENDPOINTS) {
      await call(endpoint);
      for (const role of DENIED_ROLES) await call(endpoint, cookies[role]);
    }
    expect(await snapshot()).toEqual(before);
  });

  it("keeps the read endpoints on their existing PRIVILEGED_ROLES rule", async () => {
    for (const role of ["admin", "staff"] as const) {
      expect((await fetch(`${baseUrl}/api/import/batches`, { headers: { Cookie: cookies[role] } })).status).toBe(200);
    }
    expect((await fetch(`${baseUrl}/api/import/batches`, { headers: { Cookie: cookies.member } })).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/import/batches`)).status).toBe(401);
  });

  it("checks the role before the upload body is read (guard sits ahead of express.raw)", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "import.ts"), "utf8");
    const route = source.slice(source.indexOf('importRouter.post(\n  "/upload",'));
    const guard = route.indexOf("requireImportWriter");
    const parser = route.indexOf("express.raw(");
    expect(guard).toBeGreaterThan(-1);
    expect(parser).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(parser);
  });

  it("does not loosen the shared requireAdmin guard other routes rely on", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../middleware/auth.ts"), "utf8");
    expect(source).toContain("export const requireAdmin = requireRole(...ADMIN_ROLES);");
  });
});
