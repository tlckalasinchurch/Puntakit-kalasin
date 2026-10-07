import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** Org chart read API against embedded PostgreSQL. Names are synthetic. */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let root: string;

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
});

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const member = (n: number, extra: Record<string, unknown> = {}) => ({
  id: id(100 + n),
  care_group_id: id(20),
  sheet_name: "พันธกิจตัวอย่าง",
  excel_row: 5 + n,
  full_name_raw: "",
  nickname_raw: `เล่น${n}`,
  age_raw: "34",
  occupation_raw: "ครู",
  workplace_raw: "-",
  belief_year_raw: "2015",
  goal_raw: "ผู้เชื่อผูกพัน",
  goal_q1: "",
  goal_q2: "",
  goal_q3: "",
  goal_q4: "",
  builder_raw: "สมศรี",
  marital_marks: ",1,",
  response_marks: "",
  participation_marks: "",
  flags: "",
  ...extra,
});
const dataset = {
  org_hierarchy: [
    { id: id(1), level: 0, title: "ศบ.", name: "ผู้นำตัวอย่าง" },
    { id: id(10), level: 1, title: "หนบ. บอดี้หนึ่ง", name: "หัวหน้าหนึ่ง" },
    { id: id(11), level: 1, title: "หนบ. บอดี้สอง", name: "" },
  ],
  care_groups: [
    {
      id: id(20),
      body_id: id(10),
      sheet_name: "พันธกิจตัวอย่าง",
      village: "บ้านตัวอย่าง",
      tambon: "",
      amphoe: "เมือง",
      province: "กาฬสินธุ์",
      care_code: "G2",
      care_leader_raw: "ผู้นำพันธกิจตัวอย่าง",
      coordinator_raw: "ผู้ประสานงานตัวอย่าง",
      declared_member_count: "2",
    },
    { id: id(21), body_id: id(11), sheet_name: "พันธกิจว่าง", village: "", tambon: "", amphoe: "", province: "", care_code: "", care_leader_raw: "", coordinator_raw: "", declared_member_count: "" },
  ],
  members: [member(1), member(2, { full_name_raw: "ชื่อ จริง", age_raw: "สี่สิบ" })],
};

describe("Org chart read API (real PGlite Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let adminCookie: string;
  let memberCookie: string;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-orgview-"));
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const lib = await import("../lib/orgDataset.js");
    const { createApp } = await import("../app.js");
    await (await import("../db/bootstrap.js")).bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    const db = client.getDb();
    await lib.applyOrgLoad(lib.buildOrgRows(lib.orgDatasetSchema.parse(dataset)));
    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        const a = server.address();
        if (typeof a === "object" && a !== null) baseUrl = `http://127.0.0.1:${a.port}`;
        resolve();
      });
    });
    const [admin] = await db.insert(schema.users).values({ email: "a@view.local", passwordHash: "x", name: "A", role: "admin" }).returning();
    const [mem] = await db.insert(schema.users).values({ email: "m@view.local", passwordHash: "x", name: "M", role: "member" }).returning();
    adminCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: admin.id, email: admin.email, role: "admin" })}`;
    memberCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: mem.id, email: mem.email, role: "member" })}`;
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await (await import("../db/client.js")).closeDatabase();
  });

  const get = (p: string, cookie = adminCookie) => fetch(`${baseUrl}/api/org${p}`, { headers: { Cookie: cookie } });

  it("requires a session and a privileged role", async () => {
    expect((await fetch(`${baseUrl}/api/org/overview`)).status).toBe(401);
    expect((await get("/overview", memberCookie)).status).toBe(403);
  });

  it("returns the head, bodies with leaders, care groups with leaders and counts", async () => {
    const res = await get("/overview");
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: any };
    expect(data.head.name).toBe("ผู้นำตัวอย่าง");
    expect(data.totals).toEqual({ bodies: 2, careGroups: 2, members: 2 });
    expect(data.bodies.map((b: any) => b.name)).toEqual(["บอดี้หนึ่ง", "บอดี้สอง"]); // largest first
    const one = data.bodies.find((b: any) => b.name === "บอดี้หนึ่ง");
    expect(one).toMatchObject({ leaderName: "หัวหน้าหนึ่ง", careGroupCount: 1, memberCount: 2 });
    expect(one.careGroups[0]).toMatchObject({
      name: "พันธกิจตัวอย่าง",
      area: "เมือง",
      memberCount: 2,
      careLeaderName: "ผู้นำพันธกิจตัวอย่าง",
      coordinatorName: "ผู้ประสานงานตัวอย่าง",
      careCode: "G2",
    });
    const two = data.bodies.find((b: any) => b.name === "บอดี้สอง");
    expect(two).toMatchObject({ leaderName: null, careGroupCount: 1, memberCount: 0 });
    expect(two.careGroups[0].careLeaderName).toBeNull();
  });

  it("lists the members of a care group with the fields read back from the loaded notes", async () => {
    const res = await get(`/care-groups/${id(20)}/members`);
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: any };
    expect(data.group).toMatchObject({ name: "พันธกิจตัวอย่าง", bodyName: "บอดี้หนึ่ง", careLeaderName: "ผู้นำพันธกิจตัวอย่าง" });
    expect(data.members).toHaveLength(2);
    const byNick = Object.fromEntries(data.members.map((m: any) => [m.nickname, m]));
    expect(byNick["เล่น1"]).toMatchObject({ name: "เล่น1", nameMissing: true, age: 34, occupation: "ครู", workplace: null, beliefYear: "2015", goal: "ผู้เชื่อผูกพัน", builder: "สมศรี" });
    expect(byNick["เล่น2"]).toMatchObject({ name: "ชื่อ จริง", nameMissing: false, age: null, ageRaw: "สี่สิบ" });
    expect(data.members[0]).not.toHaveProperty("notes");
  });

  it("shows the care leader picked in the app (a real member) instead of the imported text", async () => {
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const { eq } = await import("drizzle-orm");
    const db = client.getDb();
    const [leader] = await db.insert(schema.members).values({ name: "ผู้นำที่เลือกในแอป" }).returning();
    await db.update(schema.groups).set({ leaderMemberId: leader.id }).where(eq(schema.groups.id, id(20)));
    const overview = (await (await get("/overview")).json()) as { data: any };
    const care = overview.data.bodies.flatMap((b: any) => b.careGroups).find((c: any) => c.id === id(20));
    expect(care).toMatchObject({ careLeaderName: "ผู้นำที่เลือกในแอป", leaderMemberId: leader.id });
    const roster = (await (await get(`/care-groups/${id(20)}/members`)).json()) as { data: any };
    expect(roster.data.group.careLeaderName).toBe("ผู้นำที่เลือกในแอป");
  });

  it("404 for an unknown care group, 400 for a malformed id", async () => {
    expect((await get(`/care-groups/${id(999)}/members`)).status).toBe(404);
    expect((await get(`/care-groups/not-an-id/members`)).status).toBe(400);
  });

  it("lists care groups that have no body, so the UI can show them", async () => {
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const { eq } = await import("drizzle-orm");
    const db = client.getDb();
    const [orphan] = await db.insert(schema.groups).values({ name: "พันธกิจไม่มีบอดี้", orgLevel: "care" }).returning();
    try {
      const { data } = (await (await get("/overview")).json()) as { data: any };
      expect(data.unassignedCareGroups).toBe(1);
      expect(data.unassigned).toHaveLength(1);
      expect(data.unassigned[0]).toMatchObject({ id: orphan.id, name: "พันธกิจไม่มีบอดี้", memberCount: 0 });
      // Groups that belong to a body must not be repeated in the list.
      expect(data.unassigned.map((c: any) => c.id)).not.toContain(id(20));
    } finally {
      await db.delete(schema.groups).where(eq(schema.groups.id, orphan.id));
    }
  });
});
