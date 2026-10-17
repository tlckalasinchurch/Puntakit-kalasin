import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Body-leader read scope (RBP-02) on real PGlite. Two bodies; body1 has two
 * care groups, body2 has one. body1's parent is set to one of its own children
 * so the hierarchy contains a cycle.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let root: string;
afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
});

describe("care data scope: body leader reads descendants, writes stay direct", () => {
  let server: Server;
  let baseUrl: string;
  const cookie: Record<string, string> = {};
  const uid: Record<string, string> = {};
  const g: Record<string, string> = {};
  const m: Record<string, string> = {};

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-carescope-"));
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await (await import("../db/bootstrap.js")).bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    const db = client.getDb();
    const { eq } = await import("drizzle-orm");

    const mkUser = async (key: string, role: "group_leader" | "admin") => {
      const [u] = await db.insert(schema.users).values({ email: `${key}@scope.local`, passwordHash: "x", name: key, role }).returning();
      uid[key] = u.id;
      cookie[key] = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: u.id, email: u.email, role })}`;
    };
    await mkUser("body1Lead", "group_leader");
    await mkUser("body2Lead", "group_leader");
    await mkUser("care1aLead", "group_leader");
    await mkUser("admin", "admin");

    const mkGroup = async (key: string, orgLevel: "body" | "care", parentKey: string | null, leaderId: string | null) => {
      const [row] = await db
        .insert(schema.groups)
        .values({ name: key, orgLevel, parentGroupId: parentKey ? g[parentKey] : null, leaderId })
        .returning();
      g[key] = row.id;
    };
    await mkGroup("body1", "body", null, uid.body1Lead);
    await mkGroup("body2", "body", null, uid.body2Lead);
    await mkGroup("care1a", "care", "body1", uid.care1aLead);
    await mkGroup("care1b", "care", "body1", null);
    await mkGroup("care2a", "care", "body2", null);
    // Cycle: body1 becomes a child of its own child.
    await db.update(schema.groups).set({ parentGroupId: g.care1b }).where(eq(schema.groups.id, g.body1));

    const mkMember = async (key: string, groupKey: string) => {
      const [row] = await db.insert(schema.members).values({ name: key }).returning();
      m[key] = row.id;
      await db.insert(schema.groupMembers).values({ groupId: g[groupKey], memberId: row.id });
    };
    await mkMember("m1a", "care1a");
    await mkMember("m1b", "care1b");
    await mkMember("m2a", "care2a");

    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        const a = server.address();
        if (typeof a === "object" && a !== null) baseUrl = `http://127.0.0.1:${a.port}`;
        resolve();
      });
    });
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await (await import("../db/client.js")).closeDatabase();
  });

  const get = (who: string, url: string) => fetch(`${baseUrl}${url}`, { headers: { Cookie: cookie[who] } });

  it("viewable groups = led groups + descendants, cycle-safe, never another body", async () => {
    const { getViewableGroupIds, getLedGroupIds } = await import("./careScope.js");
    expect(new Set(await getViewableGroupIds(uid.body1Lead))).toEqual(new Set([g.body1, g.care1a, g.care1b]));
    expect(await getLedGroupIds(uid.body1Lead)).toEqual([g.body1]); // write scope unchanged
  });

  it("a care leader's viewable scope stays their own care group", async () => {
    const { getViewableGroupIds } = await import("./careScope.js");
    expect(await getViewableGroupIds(uid.care1aLead)).toEqual([g.care1a]);
  });

  it("/api/care/groups lists the child care groups for the body leader only", async () => {
    const res = await get("body1Lead", "/api/care/groups");
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { bodies: Array<{ careGroups: Array<{ id: string }> }> } };
    expect(new Set(data.bodies.flatMap((b) => b.careGroups.map((c) => c.id)))).toEqual(new Set([g.care1a, g.care1b]));
  });

  it("roster: body leader opens child care groups (200); other body and sibling care are 403", async () => {
    expect((await get("body1Lead", `/api/care/groups/${g.care1a}/roster`)).status).toBe(200);
    expect((await get("body1Lead", `/api/care/groups/${g.care1b}/roster`)).status).toBe(200);
    expect((await get("body1Lead", `/api/care/groups/${g.care2a}/roster`)).status).toBe(403);
    expect((await get("body2Lead", `/api/care/groups/${g.care1a}/roster`)).status).toBe(403);
    expect((await get("care1aLead", `/api/care/groups/${g.care1b}/roster`)).status).toBe(403);
    expect((await get("care1aLead", `/api/care/groups/${g.care1a}/roster`)).status).toBe(200);
  });

  it("/api/members: body leader lists and opens child-care members, not another body's", async () => {
    const list = await get("body1Lead", "/api/members?limit=100");
    expect(list.status).toBe(200);
    const names = ((await list.json()) as { data: Array<{ name: string }> }).data.map((r) => r.name);
    expect(names.sort()).toEqual(["m1a", "m1b"]);
    expect((await get("body1Lead", `/api/members/${m.m1a}`)).status).toBe(200);
    expect((await get("body1Lead", `/api/members/${m.m2a}`)).status).toBe(404);
    expect((await get("care1aLead", `/api/members/${m.m1b}`)).status).toBe(404);
  });

  it("writes stay direct: body leader cannot edit a child care member", async () => {
    const res = await fetch(`${baseUrl}/api/members/${m.m1a}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie.body1Lead },
      body: JSON.stringify({ name: "renamed" }),
    });
    expect([403, 404]).toContain(res.status);
  });

  it("membership: body leader views child care groups but decides only for groups led directly", async () => {
    const { resolveMembershipScope } = await import("./membershipScope.js");
    const scope = await resolveMembershipScope({ id: uid.body1Lead, role: "group_leader" });
    if (scope.kind !== "groups") throw new Error("expected groups scope");
    expect(scope.viewGroupIds.has(g.care1a)).toBe(true);
    expect(scope.decideGroupIds.has(g.care1a)).toBe(false);
    expect(scope.decideGroupIds.has(g.body1)).toBe(true);
  });

  it("admin still reaches every group", async () => {
    expect((await get("admin", `/api/care/groups/${g.care2a}/roster`)).status).toBe(200);
  });
});
