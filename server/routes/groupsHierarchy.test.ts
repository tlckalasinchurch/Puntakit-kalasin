import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
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

describe("Groups org hierarchy (real PGlite Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let adminCookie: string;
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");

  beforeAll(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-hier-test-"));
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
    const [admin] = await db
      .insert(schema.users)
      .values({ email: "admin@hier-test.local", passwordHash: "x", name: "Admin", role: "admin" })
      .returning();
    adminCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: admin.id, email: admin.email, role: "admin" })}`;
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await (await import("../db/client.js")).closeDatabase();
  });

  const call = (method: string, url: string, body?: unknown) =>
    fetch(`${baseUrl}${url}`, {
      method,
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async (res: Response) => (await res.json()) as { data?: any; error?: { code: string } };

  let bodyId: string;
  let careId: string;

  it("creates a body and a care group under it", async () => {
    const b = await call("POST", "/api/groups", { name: "บอดี้ทดสอบ", orgLevel: "body" });
    expect(b.status).toBe(201);
    bodyId = (await json(b)).data.id;
    const c = await call("POST", "/api/groups", { name: "แคร์ทดสอบ", orgLevel: "care", parentGroupId: bodyId });
    expect(c.status).toBe(201);
    const created = (await json(c)).data;
    careId = created.id;
    expect(created.parentGroupId).toBe(bodyId);
    expect(created.orgLevel).toBe("care");
  });

  it("rejects a body with a parent, a plain group with a parent, and a care parent that is not a body", async () => {
    expect((await call("POST", "/api/groups", { name: "x", orgLevel: "body", parentGroupId: bodyId })).status).toBe(400);
    expect((await call("POST", "/api/groups", { name: "x", parentGroupId: bodyId })).status).toBe(400);
    expect((await call("POST", "/api/groups", { name: "x", orgLevel: "care", parentGroupId: careId })).status).toBe(400);
    expect(
      (await call("POST", "/api/groups", { name: "x", orgLevel: "care", parentGroupId: "11111111-1111-4111-8111-111111111111" })).status
    ).toBe(400);
  });

  it("rejects a group that is its own parent", async () => {
    expect((await call("PUT", `/api/groups/${careId}`, { parentGroupId: careId })).status).toBe(400);
  });

  it("refuses to change the level of a body that still has a care group (409)", async () => {
    const res = await call("PUT", `/api/groups/${bodyId}`, { orgLevel: "care" });
    expect(res.status).toBe(409);
    const [row] = await db.select().from(schema.groups).where((await import("drizzle-orm")).eq(schema.groups.id, bodyId));
    expect(row.orgLevel).toBe("body");
  });

  it("filters the list by level and by parent", async () => {
    const bodies = (await json(await call("GET", "/api/groups?orgLevel=body"))).data as Array<{ id: string }>;
    expect(bodies.map((g) => g.id)).toEqual([bodyId]);
    const kids = (await json(await call("GET", `/api/groups?parentGroupId=${bodyId}`))).data as Array<{ id: string; parentGroupId: string }>;
    expect(kids.map((g) => g.id)).toEqual([careId]);
    expect(kids[0].parentGroupId).toBe(bodyId);
  });

  it("requires leaderMemberId to be a live member, and accepts one that is", async () => {
    const missing = await call("PUT", `/api/groups/${careId}`, { leaderMemberId: "22222222-2222-4222-8222-222222222222" });
    expect(missing.status).toBe(400);
    const [member] = await db.insert(schema.members).values({ name: "ผู้นำทดสอบ" }).returning();
    const ok = await call("PUT", `/api/groups/${careId}`, { leaderMemberId: member.id });
    expect(ok.status).toBe(200);
    expect((await json(ok)).data.leaderMemberId).toBe(member.id);
  });

  it("allows moving a care group after its body is changed only once the care group is gone", async () => {
    expect((await call("DELETE", `/api/groups/${careId}`)).status).toBe(200);
    expect((await call("PUT", `/api/groups/${bodyId}`, { orgLevel: "care" })).status).toBe(200);
  });
});
