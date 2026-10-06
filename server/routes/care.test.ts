import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** Care-leader roster: membership, today's marks, consecutive misses. Synthetic names. */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let root: string;
afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
});

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const mem = (n: number, nick: string) => ({
  id: id(100 + n), care_group_id: id(20), sheet_name: "พันธกิจเอ", excel_row: 5 + n, full_name_raw: "", nickname_raw: nick,
  age_raw: "", occupation_raw: "", workplace_raw: "", belief_year_raw: "", goal_raw: "", goal_q1: "", goal_q2: "", goal_q3: "", goal_q4: "",
  builder_raw: "", marital_marks: "", response_marks: "", participation_marks: "", flags: "",
});
const dataset = {
  org_hierarchy: [{ id: id(1), level: 0, title: "ศบ.", name: "" }, { id: id(10), level: 1, title: "หนบ. บอดี้หนึ่ง", name: "" }],
  care_groups: [{ id: id(20), body_id: id(10), sheet_name: "พันธกิจเอ", village: "", tambon: "", amphoe: "", province: "", care_code: "", care_leader_raw: "หนค.ตัวอย่าง", coordinator_raw: "", declared_member_count: "" }],
  members: [mem(1, "ก้อง"), mem(2, "ข้าว"), mem(3, "ค้อน")],
};

describe("care roster (real PGlite Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let adminCookie: string;
  let memberCookie: string;
  let leaderCookie: string;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-care-"));
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
    const [admin] = await db.insert(schema.users).values({ email: "a@care2.local", passwordHash: "x", name: "A", role: "admin" }).returning();
    const [viewer] = await db.insert(schema.users).values({ email: "v@care2.local", passwordHash: "x", name: "V", role: "member" }).returning();
    const [leader] = await db.insert(schema.users).values({ email: "l@care2.local", passwordHash: "x", name: "L", role: "group_leader" }).returning();
    leaderCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: leader.id, email: leader.email, role: "group_leader" })}`;
    // The leader leads this care group (groups.leader_id). Ownership is what lets it save a check-in.
    const { eq } = await import("drizzle-orm");
    await db.update(schema.groups).set({ leaderId: leader.id }).where(eq(schema.groups.id, id(20)));
    adminCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: admin.id, email: admin.email, role: "admin" })}`;
    memberCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: viewer.id, email: viewer.email, role: "member" })}`;
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await (await import("../db/client.js")).closeDatabase();
  });

  const roster = async (date: string, cookie = adminCookie) => fetch(`${baseUrl}/api/care/groups/${id(20)}/roster?date=${date}`, { headers: { Cookie: cookie } });
  const save = (date: string, marks: Record<number, "present" | "absent">) =>
    fetch(`${baseUrl}/api/attendance/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ date, serviceType: "care_group", groupId: id(20), records: Object.entries(marks).map(([n, status]) => ({ memberId: id(100 + Number(n)), status })) }),
    });

  it("is limited to roles that can record attendance", async () => {
    expect((await fetch(`${baseUrl}/api/care/groups/${id(20)}/roster`)).status).toBe(401);
    expect((await roster("2026-10-07", memberCookie)).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/care/groups/${id(999)}/roster`, { headers: { Cookie: adminCookie } })).status).toBe(404);
    expect((await fetch(`${baseUrl}/api/care/groups/nope/roster`, { headers: { Cookie: adminCookie } })).status).toBe(400);
  });

  it("lets a group_leader load the care-group picker that /api/org/overview refuses them", async () => {
    const picker = await fetch(`${baseUrl}/api/care/groups`, { headers: { Cookie: leaderCookie } });
    expect(picker.status).toBe(200);
    const { data } = (await picker.json()) as { data: { bodies: Array<{ careGroups: unknown[] }> } };
    expect(data.bodies.flatMap((b) => b.careGroups).length).toBeGreaterThan(0);
    expect((await fetch(`${baseUrl}/api/org/overview`, { headers: { Cookie: leaderCookie } })).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/care/groups`, { headers: { Cookie: memberCookie } })).status).toBe(403);
  });

  it("lists the active members with no marks and no misses before any meeting", async () => {
    const { data } = (await (await roster("2026-10-07")).json()) as { data: any };
    expect(data.group).toMatchObject({ name: "พันธกิจเอ", bodyName: "บอดี้หนึ่ง", careLeaderName: "หนค.ตัวอย่าง" });
    expect(data.sessions).toEqual([]);
    expect(data.members.map((m: any) => m.nickname).sort()).toEqual(["ก้อง", "ข้าว", "ค้อน"].sort());
    expect(data.members.every((m: any) => m.status === null && m.missed === 0)).toBe(true);
  });

  it("counts consecutive missed meetings before the chosen date and shows that day's marks", async () => {
    // ก้อง: present, absent, absent  -> missed 2 (newest two) ; ข้าว: absent, present, present -> missed 0 ; ค้อน: absent x3 -> missed 3
    expect((await save("2026-09-23", { 1: "present", 2: "absent", 3: "absent" })).status).toBe(200);
    expect((await save("2026-09-30", { 1: "absent", 2: "present", 3: "absent" })).status).toBe(200);
    expect((await save("2026-10-07", { 1: "absent", 2: "present", 3: "absent" })).status).toBe(200);
    const { data } = (await (await roster("2026-10-14")).json()) as { data: any };
    expect(data.sessions).toEqual(["2026-10-07", "2026-09-30", "2026-09-23"]);
    const by = Object.fromEntries(data.members.map((m: any) => [m.nickname, m]));
    expect(by["ก้อง"]).toMatchObject({ missed: 2, lastSeen: "2026-09-23", status: null });
    expect(by["ข้าว"]).toMatchObject({ missed: 0, lastSeen: "2026-10-07" });
    expect(by["ค้อน"]).toMatchObject({ missed: 3, lastSeen: null });
    const sameDay = (await (await roster("2026-10-07")).json()) as { data: any };
    const by2 = Object.fromEntries(sameDay.data.members.map((m: any) => [m.nickname, m]));
    expect(by2["ข้าว"].status).toBe("present");
    expect(by2["ก้อง"].status).toBe("absent");
    expect(by2["ก้อง"].missed).toBe(1); // only the 09-30 miss counts before 10-07
  });

  it("does not list a member who left the care group", async () => {
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const { and, eq } = await import("drizzle-orm");
    await client.getDb().update(schema.groupMembers).set({ status: "inactive" }).where(and(eq(schema.groupMembers.memberId, id(103)), eq(schema.groupMembers.groupId, id(20))));
    const { data } = (await (await roster("2026-10-14")).json()) as { data: any };
    expect(data.members.map((m: any) => m.nickname)).not.toContain("ค้อน");
  });

  it("lets a group_leader open the roster and save a check-in for the group", async () => {
    // Last on purpose: it adds a meeting day that earlier tests count.
    const res = await fetch(`${baseUrl}/api/attendance/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: leaderCookie },
      body: JSON.stringify({ date: "2026-11-04", serviceType: "care_group", groupId: id(20), records: [{ memberId: id(101), status: "present" }] }),
    });
    expect(res.status).toBe(200);
    const { data } = (await (await roster("2026-11-04", leaderCookie)).json()) as { data: any };
    expect(data.members.find((m: any) => m.nickname === "ก้อง")?.status).toBe("present");
  });
});
