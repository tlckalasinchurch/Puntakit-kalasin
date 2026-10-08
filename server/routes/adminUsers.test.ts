import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Org hierarchy on groups (body -> care) against real embedded PostgreSQL.
 * Rules under test: body has no parent; care parent must be a live body;
 * a body with live children cannot change level; list can filter by level
 * and parent; leaderMemberId must be a live member.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
const tempDirs: string[] = [];

function setEnv(values: Partial<Record<(typeof MANAGED_KEYS)[number], string | undefined>>): void {
  for (const key of MANAGED_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) if (value !== undefined) process.env[key] = value;
}

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe("Admin users (real PGlite Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let superA: { u: { id: string }; cookie: string };
  let adminA: { u: { id: string }; cookie: string };
  let memberA: { u: { id: string }; cookie: string };
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");

  beforeAll(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-adminusers-test-"));
    tempDirs.push(root);
    setEnv({ NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });

    const client = await import("../db/client.js");
    const bootstrap = await import("../db/bootstrap.js");
    schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await bootstrap.bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    db = client.getDb();

    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (typeof address === "object" && address !== null) baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
    const mk = async (email: string, role: "super_admin" | "admin" | "member") => {
      const [u] = await db.insert(schema.users).values({ email, passwordHash: "x", name: email.split("@")[0], role }).returning();
      return { u, cookie: `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: u.id, email: u.email, role })}` };
    };
    superA = await mk("super@au-test.local", "super_admin");
    adminA = await mk("admin@au-test.local", "admin");
    memberA = await mk("member@au-test.local", "member");
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await (await import("../db/client.js")).closeDatabase();
  });

  const call = (method: string, url: string, body?: unknown, who: { cookie: string } = superA) =>
    fetch(`${baseUrl}${url}`, {
      method,
      headers: { "Content-Type": "application/json", Cookie: who.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async (res: Response) => (await res.json()) as { data?: any; error?: { code: string } };

  it("refuses admin and member (403) and anonymous (401)", async () => {
    expect((await call("GET", "/api/admin/users", undefined, adminA)).status).toBe(403);
    expect((await call("GET", "/api/admin/users", undefined, memberA)).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/admin/users`)).status).toBe(401);
    expect((await call("PUT", `/api/admin/users/${memberA.u.id}/role`, { role: "admin" }, adminA)).status).toBe(403);
  });

  it("lists users with the care groups they lead", async () => {
    const res = await json(await call("GET", "/api/admin/users?search=member@au"));
    expect(res.data).toHaveLength(1);
    expect(res.data[0].careGroups).toEqual([]);
  });

  it("changes a role, writes an audit row, and rejects an unknown role", async () => {
    expect((await call("PUT", `/api/admin/users/${memberA.u.id}/role`, { role: "root" })).status).toBe(400);
    const ok = await call("PUT", `/api/admin/users/${memberA.u.id}/role`, { role: "group_leader" });
    expect(ok.status).toBe(200);
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, memberA.u.id));
    expect(row.role).toBe("group_leader");
    const audit = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, "USER_ROLE_CHANGED"));
    expect(audit.length).toBe(1);
  });

  it("does not let a super admin change their own role, and lets another super admin change a peer", async () => {
    expect((await call("PUT", `/api/admin/users/${superA.u.id}/role`, { role: "admin" })).status).toBe(409);
    // second super admin demotes the first: allowed. Then the remaining one is protected.
    const [second] = await db.insert(schema.users).values({ email: "super2@au-test.local", passwordHash: "x", name: "s2", role: "super_admin" }).returning();
    expect((await call("PUT", `/api/admin/users/${second.id}/role`, { role: "admin" })).status).toBe(200);
    expect((await call("PUT", `/api/admin/users/${second.id}/role`, { role: "super_admin" })).status).toBe(200);
  });

  it("assigns several care groups to one user, replaces the set, and rejects bodies and unknown ids", async () => {
    const [body] = await db.insert(schema.groups).values({ name: "บอดี้ทดสอบ", orgLevel: "body" }).returning();
    const [c1, c2, c3] = await db
      .insert(schema.groups)
      .values([1, 2, 3].map((n) => ({ name: `พันธกิจ ${n}`, orgLevel: "care" as const, parentGroupId: body.id })))
      .returning();
    const put = (ids: string[]) => call("PUT", `/api/admin/users/${memberA.u.id}/care-groups`, { groupIds: ids });

    expect((await put([c1.id, c2.id])).status).toBe(200);
    let list = await json(await call("GET", "/api/admin/users?search=member@au"));
    expect(list.data[0].careGroups.map((g: { id: string }) => g.id).sort()).toEqual([c1.id, c2.id].sort());

    expect((await put([c3.id])).status).toBe(200);
    list = await json(await call("GET", "/api/admin/users?search=member@au"));
    expect(list.data[0].careGroups.map((g: { id: string }) => g.id)).toEqual([c3.id]);
    const [c1row] = await db.select().from(schema.groups).where(eq(schema.groups.id, c1.id));
    expect(c1row.leaderId).toBeNull();

    expect((await put([body.id])).status).toBe(400);
    expect((await put(["22222222-2222-4222-8222-222222222222"])).status).toBe(400);
    expect((await call("PUT", `/api/admin/users/22222222-2222-4222-8222-222222222222/care-groups`, { groupIds: [] })).status).toBe(404);
  });
});
