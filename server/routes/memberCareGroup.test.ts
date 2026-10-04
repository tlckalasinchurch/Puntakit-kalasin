import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { and, eq } from "drizzle-orm";

/** A member's care group is a real membership. Synthetic names throughout. */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let root: string;
afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
});

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const care = (n: number, name: string, body: number) => ({
  id: id(n), body_id: id(body), sheet_name: name, village: "", tambon: "", amphoe: "เมือง", province: "", care_code: "", care_leader_raw: "", coordinator_raw: "", declared_member_count: "",
});
const dataset = {
  org_hierarchy: [
    { id: id(1), level: 0, title: "ศบ.", name: "" },
    { id: id(10), level: 1, title: "หนบ. บอดี้หนึ่ง", name: "" },
  ],
  care_groups: [care(20, "พันธกิจเอ", 10), care(21, "พันธกิจบี", 10)],
  members: [],
};

describe("member <-> care group membership (real PGlite Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let adminCookie: string;
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-caremember-"));
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });
    const client = await import("../db/client.js");
    schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const lib = await import("../lib/orgDataset.js");
    const { createApp } = await import("../app.js");
    await (await import("../db/bootstrap.js")).bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    db = client.getDb();
    await lib.applyOrgLoad(lib.buildOrgRows(lib.orgDatasetSchema.parse(dataset)));
    await db.insert(schema.groups).values({ id: id(30), name: "กลุ่มทั่วไป" }); // not a care group
    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        const a = server.address();
        if (typeof a === "object" && a !== null) baseUrl = `http://127.0.0.1:${a.port}`;
        resolve();
      });
    });
    const [admin] = await db.insert(schema.users).values({ email: "a@care.local", passwordHash: "x", name: "A", role: "admin" }).returning();
    adminCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: admin.id, email: admin.email, role: "admin" })}`;
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await (await import("../db/client.js")).closeDatabase();
  });

  const call = (method: string, url: string, body?: unknown) =>
    fetch(`${baseUrl}${url}`, { method, headers: { "Content-Type": "application/json", Cookie: adminCookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async (r: Response) => (await r.json()) as { data?: any };
  const memberships = async (memberId: string) =>
    (await db.select().from(schema.groupMembers).where(eq(schema.groupMembers.memberId, memberId))).map((r) => ({ g: r.groupId, s: r.status, left: r.leftAt !== null }));

  let memberId: string;

  it("creates a member inside a care group: membership, label and read-back", async () => {
    const res = await call("POST", "/api/members", { name: "สมาชิกทดสอบ", nickname: "ทด", careGroupId: id(20) });
    expect(res.status).toBe(201);
    memberId = (await json(res)).data.id;
    expect(await memberships(memberId)).toEqual([{ g: id(20), s: "active", left: false }]);
    const detail = (await json(await call("GET", `/api/members/${memberId}`))).data;
    expect(detail.group).toBe("พันธกิจเอ");
    expect(detail.careGroup).toEqual({ id: id(20), name: "พันธกิจเอ", bodyName: "บอดี้หนึ่ง" });
    const list = (await json(await call("GET", "/api/members?search=ทด"))).data as any[];
    expect(list[0].careGroup.name).toBe("พันธกิจเอ");
  });

  it("rejects an unknown care group and a group that is not a care group, creating nothing", async () => {
    for (const bad of [id(999), id(30)]) {
      const res = await call("POST", "/api/members", { name: "ไม่ควรมี", careGroupId: bad });
      expect(res.status).toBe(400);
    }
    const rows = await db.select().from(schema.members).where(eq(schema.members.name, "ไม่ควรมี"));
    expect(rows).toHaveLength(0);
  });

  it("moving to another care group ends the old membership and keeps one active", async () => {
    expect((await call("PUT", `/api/members/${memberId}`, { careGroupId: id(21) })).status).toBe(200);
    expect((await memberships(memberId)).sort((a, b) => a.g.localeCompare(b.g))).toEqual([
      { g: id(20), s: "inactive", left: true },
      { g: id(21), s: "active", left: false },
    ]);
    expect((await json(await call("GET", `/api/members/${memberId}`))).data.group).toBe("พันธกิจบี");
  });

  it("moving back reactivates the old row instead of adding a second one", async () => {
    expect((await call("PUT", `/api/members/${memberId}`, { careGroupId: id(20) })).status).toBe(200);
    const rows = await memberships(memberId);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.g === id(20))).toEqual({ g: id(20), s: "active", left: false });
    expect(rows.find((r) => r.g === id(21))?.s).toBe("inactive");
  });

  it("an update without careGroupId leaves memberships alone", async () => {
    const before = await memberships(memberId);
    expect((await call("PUT", `/api/members/${memberId}`, { notes: "บันทึก" })).status).toBe(200);
    expect(await memberships(memberId)).toEqual(before);
  });

  it("filters the member list by care group", async () => {
    await call("POST", "/api/members", { name: "คนในพันธกิจบี", careGroupId: id(21) });
    const a = (await json(await call("GET", `/api/members?careGroupId=${id(20)}`))).data as any[];
    const b = (await json(await call("GET", `/api/members?careGroupId=${id(21)}`))).data as any[];
    expect(a.map((m) => m.id)).toEqual([memberId]);
    expect(b.map((m) => m.name)).toEqual(["คนในพันธกิจบี"]);
  });

  it("clearing the care group ends the membership and the label", async () => {
    expect((await call("PUT", `/api/members/${memberId}`, { careGroupId: "" })).status).toBe(200);
    const active = await db.select().from(schema.groupMembers).where(and(eq(schema.groupMembers.memberId, memberId), eq(schema.groupMembers.status, "active")));
    expect(active).toHaveLength(0);
    const detail = (await json(await call("GET", `/api/members/${memberId}`))).data;
    expect(detail.group).toBeNull();
    expect(detail.careGroup).toBeNull();
  });
});
