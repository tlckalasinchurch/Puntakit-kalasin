import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { count as sqlCount, eq } from "drizzle-orm";

/** Org dataset loader against embedded PostgreSQL. All names below are synthetic. */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
const tempDirs: string[] = [];

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const member = (n: number, extra: Record<string, unknown> = {}) => ({
  id: id(100 + n),
  care_group_id: id(20),
  sheet_name: "พันธกิจตัวอย่าง",
  excel_row: 5 + n,
  full_name_raw: "",
  nickname_raw: `ชื่อเล่น${n}`,
  age_raw: "30",
  occupation_raw: "",
  workplace_raw: "",
  belief_year_raw: "",
  goal_raw: "ผู้เชื่อผูกพัน",
  goal_q1: "",
  goal_q2: "",
  goal_q3: "",
  goal_q4: "",
  builder_raw: "",
  marital_marks: ",1,",
  response_marks: "",
  participation_marks: "",
  flags: "",
  ...extra,
});
const dataset = {
  org_hierarchy: [
    { id: id(1), level: 0, title: "ศบ.", name: "ผู้นำตัวอย่าง" },
    { id: id(10), level: 1, title: "หนบ. บอดี้ตัวอย่าง", name: "หัวหน้าตัวอย่าง", body_code: "sample" },
    { id: id(11), level: 1, title: "หนบ. บอดี้สอง", name: "" },
  ],
  care_groups: [
    {
      id: id(20),
      body_id: id(10),
      sheet_name: "พันธกิจตัวอย่าง",
      village: "บ้านตัวอย่าง",
      tambon: "ตำบลหนึ่ง",
      amphoe: "เมือง",
      province: "กาฬสินธุ์",
      care_code: "G1",
      care_leader_raw: "หนค.ตัวอย่าง",
      coordinator_raw: "",
      declared_member_count: "2",
    },
  ],
  members: [member(1), member(2, { full_name_raw: "ชื่อ นามสกุล" })],
};

describe("Org dataset loader (real PGlite Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let adminCookie: string;
  let staffCookie: string;
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");

  beforeAll(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-org-test-"));
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
    const [admin] = await db.insert(schema.users).values({ email: "a@org.local", passwordHash: "x", name: "A", role: "admin" }).returning();
    const [staff] = await db.insert(schema.users).values({ email: "s@org.local", passwordHash: "x", name: "S", role: "staff" }).returning();
    adminCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: admin.id, email: admin.email, role: "admin" })}`;
    staffCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: staff.id, email: staff.email, role: "staff" })}`;
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await (await import("../db/client.js")).closeDatabase();
  });

  const post = (p: string, body: unknown, cookie = adminCookie) =>
    fetch(`${baseUrl}/api/org-data${p}`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body) });
  const counts = async () => ({
    members: (await db.select({ c: sqlCount() }).from(schema.members))[0].c,
    groups: (await db.select({ c: sqlCount() }).from(schema.groups))[0].c,
    gm: (await db.select({ c: sqlCount() }).from(schema.groupMembers))[0].c,
  });

  it("is admin-only and requires a session", async () => {
    expect((await fetch(`${baseUrl}/api/org-data/dry-run`, { method: "POST" })).status).toBe(401);
    expect((await post("/dry-run", { dataset }, staffCookie)).status).toBe(403);
  });

  it("rejects a malformed or inconsistent dataset (400)", async () => {
    expect((await post("/dry-run", { dataset: { ...dataset, members: "x" } })).status).toBe(400);
    const orphan = { ...dataset, members: [member(1, { care_group_id: id(99) })] };
    expect((await post("/dry-run", { dataset: orphan })).status).toBe(400);
  });

  it("dry-run reports the plan and writes nothing", async () => {
    const res = await post("/dry-run", { dataset });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { plan: Record<string, number>; alreadyPresent: Record<string, number> } };
    expect(body.data.plan).toMatchObject({ people: 2, bodies: 2, careGroups: 1, members: 2, groupMembers: 2, nameFromNickname: 1 });
    expect(body.data.alreadyPresent).toEqual({ members: 0, groups: 0 });
    expect(await counts()).toEqual({ members: 0, groups: 0, gm: 0 });
  });

  it("apply needs confirm, then loads the hierarchy; a second apply changes nothing", async () => {
    expect((await post("/apply", { dataset })).status).toBe(400);
    expect(await counts()).toEqual({ members: 0, groups: 0, gm: 0 });

    expect((await post("/apply", { dataset, confirm: true })).status).toBe(200);
    expect(await counts()).toEqual({ members: 4, groups: 3, gm: 2 });
    expect((await post("/apply", { dataset, confirm: true })).status).toBe(200);
    expect(await counts()).toEqual({ members: 4, groups: 3, gm: 2 });

    const [care] = await db.select().from(schema.groups).where(eq(schema.groups.id, id(20)));
    expect(care).toMatchObject({ orgLevel: "care", parentGroupId: id(10), area: "เมือง" });
    const [body] = await db.select().from(schema.groups).where(eq(schema.groups.id, id(10)));
    expect(body.orgLevel).toBe("body");
    expect(body.leaderMemberId).not.toBeNull();
    const [nick] = await db.select().from(schema.members).where(eq(schema.members.id, id(101)));
    expect(nick.name).toBe("ชื่อเล่น1");
    expect(nick.notes).toContain("ไม่มีชื่อ-สกุลในต้นฉบับ");
  });

  it("is atomic: a failing statement leaves nothing behind", async () => {
    const lib = await import("../lib/orgDataset.js");
    const fresh = JSON.parse(JSON.stringify(dataset));
    fresh.members = [member(7), member(8)];
    const rows = lib.buildOrgRows(lib.orgDatasetSchema.parse(fresh));
    // last statement violates the group_members -> groups foreign key
    rows.groupMembers.push({ id: lib.derivedId("bad"), groupId: id(999), memberId: rows.members[0].id!, role: "member", status: "active" });
    const before = await counts();
    await expect(lib.applyOrgLoad(rows)).rejects.toThrow();
    expect(await counts()).toEqual(before);
  });

  it("rollback removes exactly what the dataset created", async () => {
    const [other] = await db.insert(schema.members).values({ name: "สมาชิกเดิม" }).returning();
    expect((await post("/rollback", { dataset })).status).toBe(400);
    expect((await post("/rollback", { dataset, confirm: true })).status).toBe(200);
    expect(await counts()).toEqual({ members: 1, groups: 0, gm: 0 });
    const [still] = await db.select().from(schema.members).where(eq(schema.members.id, other.id));
    expect(still.name).toBe("สมาชิกเดิม");
  });

  it("records counts only in the audit log", async () => {
    const rows = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, "ORG_DATASET_LOADED"));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.details).not.toContain("ชื่อเล่น");
      expect(r.details).not.toContain("ผู้นำตัวอย่าง");
    }
  });
});
