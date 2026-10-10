import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Tenant scope for the group_leader role against real embedded PostgreSQL.
 * A group leader reaches only the groups they lead and the members active in
 * them; unassigned leaders and the `member` role reach none; admin cannot use
 * the super-admin user API. Fixtures are synthetic (no real people).
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


describe("group_leader tenant scope (real PGlite Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");
  let bootstrap: typeof import("../lib/bootstrapAdmin.js");
  type Actor = { id: string; cookie: string };
  let superA: Actor, adminA: Actor, staffA: Actor, viewerA: Actor, memberU: Actor, leaderA: Actor, leaderB: Actor, lonely: Actor;
  let careA: string, careB: string, mA1: string, mA2: string, mB1: string, mFree: string;
  let newActor: (key: string, role: "member" | "group_leader") => Promise<Actor>;

  beforeAll(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-scope-test-"));
    tempDirs.push(root);
    setEnv({ NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });

    const client = await import("../db/client.js");
    const dbBootstrap = await import("../db/bootstrap.js");
    schema = await import("../../shared/schema.js");
    bootstrap = await import("../lib/bootstrapAdmin.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await dbBootstrap.bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    db = client.getDb();

    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (typeof address === "object" && address !== null) baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    const mk = async (key: string, role: "super_admin" | "admin" | "staff" | "viewer" | "member" | "group_leader"): Promise<Actor> => {
      const [u] = await db.insert(schema.users).values({ email: `${key}@scope-test.local`, passwordHash: "x", name: key, role }).returning();
      return { id: u.id, cookie: `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: u.id, email: u.email, role })}` };
    };
    newActor = (key, role) => mk(key, role);
    superA = await mk("super", "super_admin");
    adminA = await mk("admin", "admin");
    staffA = await mk("staff", "staff");
    viewerA = await mk("viewer", "viewer");
    memberU = await mk("member", "member");
    leaderA = await mk("leadera", "group_leader");
    leaderB = await mk("leaderb", "group_leader");
    lonely = await mk("lonely", "group_leader");

    const [body] = await db.insert(schema.groups).values({ name: "บอดี้ทดสอบ", orgLevel: "body" }).returning();
    const [a, b] = await db
      .insert(schema.groups)
      .values([
        { name: "พันธกิจ A", orgLevel: "care", parentGroupId: body.id, leaderId: leaderA.id },
        { name: "พันธกิจ B", orgLevel: "care", parentGroupId: body.id, leaderId: leaderB.id },
      ])
      .returning();
    careA = a.id;
    careB = b.id;
    const [x1, x2, y1, free] = await db
      .insert(schema.members)
      .values([
        { name: "สมาชิก เอ1", phone: "0811111111" },
        { name: "สมาชิก เอ2", phone: "0822222222" },
        { name: "สมาชิก บี1", phone: "0833333333" },
        { name: "สมาชิก ว่าง", phone: "0844444444" },
      ])
      .returning();
    mA1 = x1.id;
    mA2 = x2.id;
    mB1 = y1.id;
    mFree = free.id;
    await db.insert(schema.groupMembers).values([
      { groupId: careA, memberId: mA1, status: "active" },
      { groupId: careA, memberId: mA2, status: "active" },
      { groupId: careB, memberId: mB1, status: "active" },
    ]);
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await (await import("../db/client.js")).closeDatabase();
  });

  const call = (who: Actor | null, method: string, url: string, body?: unknown) =>
    fetch(`${baseUrl}${url}`, {
      method,
      headers: { "Content-Type": "application/json", ...(who ? { Cookie: who.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async (res: Response) => (await res.json()) as { data?: any; meta?: any };
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

  it("1. a group leader reads the care group they lead, its members and its roster", async () => {
    const list = await json(await call(leaderA, "GET", "/api/members?limit=100"));
    expect(ids(list.data)).toEqual([mA1, mA2].sort());
    expect((await call(leaderA, "GET", `/api/members/${mA1}`)).status).toBe(200);
    const group = await call(leaderA, "GET", `/api/groups/${careA}`);
    expect(group.status).toBe(200);
    const roster = await json(await call(leaderA, "GET", `/api/groups/${careA}/members`));
    // Roster read access is unchanged; member phone numbers are masked because a
    // group leader is not in CONTACT_VISIBLE_ROLES and is not these members'
    // assignedLeaderId (see server/routes/groupContactPrivacy.test.ts).
    expect(roster.data.map((r: { memberPhone: string }) => r.memberPhone).sort()).toEqual(["081-xxx-111", "082-xxx-222"]);
    const care = await json(await call(leaderA, "GET", `/api/care/groups/${careA}/roster`));
    expect(care.data.members).toHaveLength(2);
  });

  it("2. a group leader cannot read another care group by id, list or filter", async () => {
    expect((await call(leaderA, "GET", `/api/members/${mB1}`)).status).toBe(404);
    expect((await call(leaderA, "GET", `/api/members/${mFree}`)).status).toBe(404);
    const filtered = await json(await call(leaderA, "GET", `/api/members?careGroupId=${careB}&limit=100`));
    expect(filtered.data).toHaveLength(0);
    const search = await json(await call(leaderA, "GET", `/api/members?search=${encodeURIComponent("บี1")}`));
    expect(search.data).toHaveLength(0);
    expect((await call(leaderA, "GET", `/api/groups/${careB}`)).status).toBe(403);
    expect((await call(leaderA, "GET", `/api/groups/${careB}/members`)).status).toBe(403);
    expect((await call(leaderA, "GET", `/api/care/groups/${careB}/roster`)).status).toBe(403);
    const csv = await (await call(leaderA, "GET", "/api/members/export/csv")).text();
    expect(csv).toContain("เอ1");
    expect(csv).not.toContain("บี1");
    const dup = await json(await call(leaderA, "GET", "/api/members/check-duplicate?phone=0833333333"));
    expect(dup.data.isDuplicate).toBe(false);
  });

  it("3. a group leader cannot edit a member outside their groups, even with the id", async () => {
    expect((await call(leaderA, "PUT", `/api/members/${mB1}`, { notes: "x" })).status).toBe(404);
    expect((await call(leaderA, "PUT", `/api/members/${mFree}`, { notes: "x" })).status).toBe(404);
    const [b1] = await db.select().from(schema.members).where(eq(schema.members.id, mB1));
    expect(b1.notes).toBeNull();
    // inside the scope: ordinary edits work, moving the person or choosing a viewer does not
    expect((await call(leaderA, "PUT", `/api/members/${mA1}`, { notes: "เยี่ยมแล้ว" })).status).toBe(200);
    expect((await call(leaderA, "PUT", `/api/members/${mA1}`, { careGroupId: careB })).status).toBe(403);
    expect((await call(leaderA, "PUT", `/api/members/${mA1}`, { assignedLeaderId: leaderA.id })).status).toBe(403);
  });

  it("3b. a group leader cannot take over their group or pull a member in from another care group", async () => {
    expect((await call(leaderA, "PUT", `/api/groups/${careA}`, { meetingLocation: "ศาลา" })).status).toBe(200);
    expect((await call(leaderA, "PUT", `/api/groups/${careA}`, { leaderId: lonely.id })).status).toBe(403);
    expect((await call(leaderA, "PUT", `/api/groups/${careA}`, { privacy: "confidential" })).status).toBe(403);
    expect((await call(leaderA, "PUT", `/api/groups/${careB}`, { meetingLocation: "x" })).status).toBe(403);
    expect((await call(leaderA, "POST", `/api/groups/${careA}/members`, { memberId: mB1 })).status).toBe(403);
    expect((await call(leaderA, "POST", `/api/groups/${careB}/members`, { memberId: mFree })).status).toBe(403);
    expect((await call(leaderA, "POST", `/api/groups/${careA}/members`, { memberId: mFree })).status).toBe(201);
    // once added, the free member is in scope
    expect((await call(leaderA, "GET", `/api/members/${mFree}`)).status).toBe(200);
  });

  it("4. a group leader files activities and follow-ups only inside their scope", async () => {
    const base = { type: "house_mission", title: "เยี่ยมบ้าน", occurredAt: new Date().toISOString() };
    expect((await call(leaderA, "POST", "/api/activities", { ...base, groupId: careB })).status).toBe(403);
    expect((await call(leaderA, "POST", "/api/activities", { ...base })).status).toBe(403);
    expect((await call(leaderA, "POST", "/api/activities", { ...base, groupId: careA, participantMemberIds: [mB1] })).status).toBe(403);
    const ok = await call(leaderA, "POST", "/api/activities", { ...base, groupId: careA, participantMemberIds: [mA1] });
    expect(ok.status).toBe(201);
    const activityId = (await json(ok)).data.id;
    expect((await call(leaderA, "PUT", `/api/activities/${activityId}`, { groupId: careB })).status).toBe(403);
    expect((await call(leaderA, "PUT", `/api/activities/${activityId}`, { participantMemberIds: [mB1] })).status).toBe(403);
    // another leader cannot reach it while it is a draft
    expect((await call(leaderB, "GET", `/api/activities/${activityId}`)).status).toBe(404);

    expect((await call(leaderA, "POST", "/api/follow-ups", { title: "ติดตาม", subjectMemberId: mB1 })).status).toBe(403);
    expect((await call(leaderA, "POST", "/api/follow-ups", { title: "ติดตาม", subjectGroupId: careB })).status).toBe(403);
    expect((await call(leaderA, "POST", "/api/follow-ups", { title: "ติดตาม", subjectMemberId: mA1, ownerId: leaderB.id })).status).toBe(403);
    expect((await call(leaderA, "POST", "/api/follow-ups", { title: "ติดตาม", subjectMemberId: mA1 })).status).toBe(201);
  });

  it("4b. attendance: a group leader records and reads only their own members", async () => {
    const day = new Date().toISOString();
    const rec = (memberId: string) => ({ memberId, status: "present", checkInMethod: "manual" });
    expect((await call(leaderA, "POST", "/api/attendance/bulk", { date: day, serviceType: "care_group", groupId: careA, records: [rec(mA1), rec(mA2)] })).status).toBe(200);
    expect((await call(leaderA, "POST", "/api/attendance/bulk", { date: day, serviceType: "care_group", groupId: careA, records: [rec(mB1)] })).status).toBe(403);
    expect((await call(leaderA, "POST", "/api/attendance/bulk", { date: day, serviceType: "care_group", groupId: careB, records: [rec(mA1)] })).status).toBe(403);
    expect((await call(leaderA, "POST", "/api/attendance/check-in", { date: day, serviceType: "sunday_service", memberId: mB1, status: "present", checkInMethod: "manual" })).status).toBe(403);
    expect((await call(leaderA, "POST", "/api/attendance/qr-scan", { token: `PK-MEM-${mB1}`, serviceType: "sunday_service" })).status).toBe(403);
    // staff records for the other group, then each leader sees only their own rows
    expect((await call(staffA, "POST", "/api/attendance/bulk", { date: day, serviceType: "care_group", groupId: careB, records: [rec(mB1)] })).status).toBe(200);
    const mine = await json(await call(leaderA, "GET", "/api/attendance?limit=100"));
    expect(mine.data.map((r: { memberId: string }) => r.memberId).sort()).toEqual([mA1, mA2].sort());
    const probe = await json(await call(leaderA, "GET", `/api/attendance?memberId=${mB1}`));
    expect(probe.data).toHaveLength(0);
    const all = await json(await call(staffA, "GET", "/api/attendance?limit=100"));
    expect(all.data.length).toBe(3);
    // org-wide views stay privileged
    expect((await call(leaderA, "GET", "/api/attendance/summary")).status).toBe(403);
    expect((await call(leaderA, "GET", "/api/attendance/export")).status).toBe(403);
    expect((await call(staffA, "GET", "/api/attendance/summary")).status).toBe(200);
  });

  it("5. /api/care/groups lists only the groups the caller may check in", async () => {
    const names = async (who: Actor) =>
      (await json(await call(who, "GET", "/api/care/groups"))).data.bodies.flatMap((b: { careGroups: { name: string }[] }) => b.careGroups.map((c) => c.name)).sort();
    expect(await names(leaderA)).toEqual(["พันธกิจ A"]);
    expect(await names(leaderB)).toEqual(["พันธกิจ B"]);
    expect(await names(staffA)).toEqual(["พันธกิจ A", "พันธกิจ B"]);
  });

  it("6. an unassigned group leader and the member role get nothing", async () => {
    expect((await json(await call(lonely, "GET", "/api/members?limit=100"))).data).toHaveLength(0);
    expect((await json(await call(lonely, "GET", "/api/care/groups"))).data.bodies).toHaveLength(0);
    expect((await json(await call(lonely, "GET", "/api/attendance?limit=100"))).data).toHaveLength(0);
    expect((await call(lonely, "GET", `/api/groups/${careA}`)).status).toBe(403);
    expect((await call(lonely, "POST", "/api/attendance/bulk", { date: new Date().toISOString(), serviceType: "care_group", records: [{ memberId: mA1, status: "present", checkInMethod: "manual" }] })).status).toBe(403);
    expect((await call(lonely, "POST", "/api/activities", { type: "house_mission", title: "x", occurredAt: new Date().toISOString() })).status).toBe(403);
    expect((await call(lonely, "PUT", `/api/members/${mA1}`, { notes: "x" })).status).toBe(404);

    for (const [method, url] of [
      ["GET", "/api/members"], ["GET", `/api/members/${mA1}`], ["GET", "/api/attendance"], ["GET", `/api/groups/${careA}`],
      ["GET", `/api/groups/${careA}/members`], ["GET", "/api/attendance/absentees"], ["GET", "/api/members/export/csv"],
    ] as const) {
      expect((await call(memberU, method, url)).status, `${method} ${url} as member`).toBe(403);
    }
    expect((await call(memberU, "POST", "/api/attendance/check-in", { date: new Date().toISOString(), serviceType: "sunday_service", memberId: mA1, status: "present", checkInMethod: "manual" })).status).toBe(403);
    expect((await json(await call(memberU, "GET", "/api/dashboard/summary"))).data.recentMembers).toEqual([]);
    expect((await json(await call(leaderA, "GET", "/api/dashboard/summary"))).data.recentMembers).toEqual([]);
  });

  it("6b. contact data in rosters: staff see numbers, a viewer sees them masked", async () => {
    const staff = await json(await call(staffA, "GET", `/api/groups/${careA}/members`));
    expect(staff.data.some((r: { memberPhone: string }) => r.memberPhone === "0811111111")).toBe(true);
    const viewer = await json(await call(viewerA, "GET", `/api/groups/${careA}/members`));
    expect(viewer.data.every((r: { memberPhone: string }) => /xxx/.test(r.memberPhone))).toBe(true);
    // account emails of leaders are for staff-level roles
    const listViewer = await json(await call(viewerA, "GET", "/api/groups?orgLevel=care"));
    expect(listViewer.data.every((g: { leaderEmail: string | null }) => g.leaderEmail === null)).toBe(true);
    const listStaff = await json(await call(staffA, "GET", "/api/groups?orgLevel=care"));
    expect(listStaff.data.some((g: { leaderEmail: string | null }) => g.leaderEmail)).toBe(true);
  });

  it("7. admin cannot call the user-management API (super admin only)", async () => {
    expect((await call(adminA, "GET", "/api/admin/users")).status).toBe(403);
    expect((await call(adminA, "PUT", `/api/admin/users/${memberU.id}/role`, { role: "admin" })).status).toBe(403);
    expect((await call(adminA, "PUT", `/api/admin/users/${memberU.id}/care-groups`, { groupIds: [] })).status).toBe(403);
    expect((await call(null, "GET", "/api/admin/users")).status).toBe(401);
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, memberU.id));
    expect(row.role).toBe("member");
  });

  it("8. a super admin cannot change their own role", async () => {
    expect((await call(superA, "PUT", `/api/admin/users/${superA.id}/role`, { role: "member" })).status).toBe(409);
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, superA.id));
    expect(row.role).toBe("super_admin");
  });

  it("9. giving a care group to someone else asks first, and then really moves the access", async () => {
    const refused = await call(superA, "PUT", `/api/admin/users/${lonely.id}/care-groups`, { groupIds: [careA] });
    expect(refused.status).toBe(409);
    const detail = (await refused.json()) as { error?: { details?: { message: string }[] } };
    expect(JSON.stringify(detail)).toContain("พันธกิจ A");
    // nothing changed: leader A still has access, the other account none
    expect((await call(leaderA, "GET", `/api/groups/${careA}`)).status).toBe(200);
    expect((await call(lonely, "GET", `/api/groups/${careA}`)).status).toBe(403);

    expect((await call(superA, "PUT", `/api/admin/users/${lonely.id}/care-groups`, { groupIds: [careA], replaceExisting: true })).status).toBe(200);
    expect((await call(lonely, "GET", `/api/groups/${careA}`)).status).toBe(200);
    expect((await call(leaderA, "GET", `/api/groups/${careA}`)).status).toBe(403);
    expect((await json(await call(leaderA, "GET", "/api/members?limit=100"))).data).toHaveLength(0);
    // assigning a group a user already leads is not a conflict
    expect((await call(superA, "PUT", `/api/admin/users/${lonely.id}/care-groups`, { groupIds: [careA] })).status).toBe(200);
  });

  it("10. bootstrap promotes only a verified primary listed email, never demotes, never touches admins", async () => {
    const allowList = new Set(["boss@scope-test.local"]);
    const mkUser = async (email: string, role: "member" | "group_leader" | "admin" | "super_admin") =>
      (await db.insert(schema.users).values({ email, passwordHash: "x", name: email, role }).returning())[0];
    const verified = await bootstrap.applyBootstrapAdmin(await mkUser("boss@scope-test.local", "member"), { emailVerified: true, allowList });
    expect(verified.role).toBe("super_admin");
    const unverified = await bootstrap.applyBootstrapAdmin(await mkUser("boss2@scope-test.local", "member"), { emailVerified: false, allowList: new Set(["boss2@scope-test.local"]) });
    expect(unverified.role).toBe("member");
    const stranger = await bootstrap.applyBootstrapAdmin(await mkUser("someone@scope-test.local", "member"), { emailVerified: true, allowList });
    expect(stranger.role).toBe("member");
    const alreadyAdmin = await bootstrap.applyBootstrapAdmin(await mkUser("boss3@scope-test.local", "admin"), { emailVerified: true, allowList: new Set(["boss3@scope-test.local"]) });
    expect(alreadyAdmin.role).toBe("admin");
    const leader = await bootstrap.applyBootstrapAdmin(await mkUser("boss4@scope-test.local", "group_leader"), { emailVerified: true, allowList: new Set(["boss4@scope-test.local"]) });
    expect(leader.role).toBe("super_admin");
    const keeps = await bootstrap.applyBootstrapAdmin(await mkUser("keeps@scope-test.local", "super_admin"), { emailVerified: true, allowList: new Set() });
    expect(keeps.role).toBe("super_admin");
  });

  // ---- follow-up review: F1 (duplicate-contact privacy) and F2 (co-leader scope) ----

  it("11. duplicate-contact errors never reveal who holds the number or email", async () => {
    // test 9 moved care group A to another account; give it back to leader A
    await db.update(schema.groups).set({ leaderId: leaderA.id }).where(eq(schema.groups.id, careA));
    // in the leader's own scope: a duplicate is reported, in one generic sentence without a name
    const inScope = await call(leaderA, "PUT", `/api/members/${mA1}`, { phone: "0822222222" });
    expect(inScope.status).toBe(409);
    const inText = await inScope.text();
    expect(inText).toContain("ถูกใช้งานแล้วในระบบ");
    expect(inText).not.toContain("เอ2");
    expect(inText).not.toContain("0822222222");

    // outside the scope: indistinguishable from "no duplicate", and nothing about the other person is returned
    const outside = await call(leaderA, "PUT", `/api/members/${mA1}`, { phone: "0833333333" });
    expect(outside.status).toBe(200);
    expect(await outside.text()).not.toContain("บี1");
    await db.update(schema.members).set({ phone: "0811111111" }).where(eq(schema.members.id, mA1));

    // e-mail follows the same policy
    await db.update(schema.members).set({ email: "a2@scope-test.local" }).where(eq(schema.members.id, mA2));
    await db.update(schema.members).set({ email: "b1@scope-test.local" }).where(eq(schema.members.id, mB1));
    const mailIn = await call(leaderA, "PUT", `/api/members/${mA1}`, { email: "a2@scope-test.local" });
    expect(mailIn.status).toBe(409);
    expect(await mailIn.text()).not.toContain("เอ2");
    const mailOut = await call(leaderA, "PUT", `/api/members/${mA1}`, { email: "b1@scope-test.local" });
    expect(mailOut.status).toBe(200);
    expect(await mailOut.text()).not.toContain("บี1");
    await db.update(schema.members).set({ email: null }).where(eq(schema.members.id, mA1));

    // roles that see the whole directory keep the helpful message with the name
    const staff = await call(staffA, "PUT", `/api/members/${mA1}`, { phone: "0833333333" });
    expect(staff.status).toBe(409);
    expect(await staff.text()).toContain("สมาชิก บี1");

    // the separate lookup endpoint stays scoped: an outside number looks like "not found"
    const lookup = await json(await call(leaderA, "GET", "/api/members/check-duplicate?phone=0833333333"));
    expect(lookup.data.isDuplicate).toBe(false);
    const lookupMail = await json(await call(leaderA, "GET", "/api/members/check-duplicate?email=b1@scope-test.local"));
    expect(lookupMail.data.isDuplicate).toBe(false);
    const lookupIn = await json(await call(leaderA, "GET", "/api/members/check-duplicate?phone=0822222222"));
    expect(lookupIn.data.isDuplicate).toBe(true);
  });

  it("12. co_leader_id grants the same scope as leader_id, and nothing more", async () => {
    const co = await newActor("coleader", "group_leader");
    const [c, d] = await db
      .insert(schema.groups)
      .values([
        { name: "พันธกิจ C", orgLevel: "care", coLeaderId: co.id },
        { name: "พันธกิจ D", orgLevel: "care", leaderId: leaderB.id },
      ])
      .returning();
    const [mC, mD] = await db
      .insert(schema.members)
      .values([{ name: "สมาชิก ซี1", phone: "0855555555" }, { name: "สมาชิก ดี1", phone: "0866666666" }])
      .returning();
    await db.insert(schema.groupMembers).values([
      { groupId: c.id, memberId: mC.id, status: "active" },
      { groupId: d.id, memberId: mD.id, status: "active" },
    ]);
    const day = new Date().toISOString();
    const rec = (memberId: string) => ({ memberId, status: "present", checkInMethod: "manual" });

    // allowed: the co-leader's own group
    expect(ids((await json(await call(co, "GET", "/api/members?limit=100"))).data)).toEqual([mC.id]);
    expect((await call(co, "GET", `/api/members/${mC.id}`)).status).toBe(200);
    expect((await call(co, "GET", `/api/groups/${c.id}`)).status).toBe(200);
    const roster = await json(await call(co, "GET", `/api/groups/${c.id}/members`));
    // Masked, for the same reason as above: a co-leader reads the roster but is
    // not a contact-visible role.
    expect(roster.data.map((r: { memberPhone: string }) => r.memberPhone)).toEqual(["085-xxx-555"]);
    expect((await call(co, "GET", `/api/care/groups/${c.id}/roster`)).status).toBe(200);
    const mine = (await json(await call(co, "GET", "/api/care/groups"))).data.bodies.flatMap((b: { careGroups: { name: string }[] }) => b.careGroups.map((g) => g.name));
    expect(mine).toEqual(["พันธกิจ C"]);
    expect((await call(co, "POST", "/api/attendance/bulk", { date: day, serviceType: "care_group", groupId: c.id, records: [rec(mC.id)] })).status).toBe(200);
    expect((await call(co, "POST", "/api/activities", { type: "house_mission", title: "เยี่ยม", occurredAt: day, groupId: c.id, participantMemberIds: [mC.id] })).status).toBe(201);
    expect((await call(co, "POST", "/api/follow-ups", { title: "ติดตาม", subjectMemberId: mC.id })).status).toBe(201);
    expect((await call(co, "PUT", `/api/groups/${c.id}`, { meetingLocation: "ศาลา" })).status).toBe(200);

    // denied: an unrelated group, by every route, with direct identifiers
    expect((await call(co, "GET", `/api/members/${mD.id}`)).status).toBe(404);
    expect((await call(co, "PUT", `/api/members/${mD.id}`, { notes: "x" })).status).toBe(404);
    expect((await call(co, "GET", `/api/groups/${d.id}`)).status).toBe(403);
    expect((await call(co, "GET", `/api/groups/${d.id}/members`)).status).toBe(403);
    expect((await call(co, "GET", `/api/care/groups/${d.id}/roster`)).status).toBe(403);
    expect((await call(co, "POST", "/api/attendance/bulk", { date: day, serviceType: "care_group", groupId: d.id, records: [rec(mC.id)] })).status).toBe(403);
    expect((await call(co, "POST", "/api/attendance/bulk", { date: day, serviceType: "care_group", groupId: c.id, records: [rec(mD.id)] })).status).toBe(403);
    expect((await call(co, "POST", "/api/activities", { type: "house_mission", title: "x", occurredAt: day, groupId: d.id })).status).toBe(403);
    expect((await call(co, "POST", "/api/follow-ups", { title: "x", subjectMemberId: mD.id })).status).toBe(403);
    expect((await call(co, "PUT", `/api/groups/${d.id}`, { meetingLocation: "x" })).status).toBe(403);
    // and a co-leader cannot hand the group to someone else or take it over
    expect((await call(co, "PUT", `/api/groups/${c.id}`, { leaderId: leaderA.id })).status).toBe(403);
    expect((await call(co, "PUT", `/api/groups/${c.id}`, { coLeaderId: leaderA.id })).status).toBe(403);
  });

  it("12b. leading one group and co-leading another gives exactly the union", async () => {
    const dual = await newActor("dual", "group_leader");
    const [e, f, g] = await db
      .insert(schema.groups)
      .values([
        { name: "พันธกิจ E", orgLevel: "care", leaderId: dual.id },
        { name: "พันธกิจ F", orgLevel: "care", coLeaderId: dual.id },
        { name: "พันธกิจ G", orgLevel: "care" },
      ])
      .returning();
    const made = await db
      .insert(schema.members)
      .values([{ name: "สมาชิก อี1" }, { name: "สมาชิก เอฟ1" }, { name: "สมาชิก จี1" }])
      .returning();
    await db.insert(schema.groupMembers).values([
      { groupId: e.id, memberId: made[0].id, status: "active" },
      { groupId: f.id, memberId: made[1].id, status: "active" },
      { groupId: g.id, memberId: made[2].id, status: "active" },
    ]);
    expect(ids((await json(await call(dual, "GET", "/api/members?limit=100"))).data)).toEqual([made[0].id, made[1].id].sort());
    expect((await call(dual, "GET", `/api/groups/${e.id}`)).status).toBe(200);
    expect((await call(dual, "GET", `/api/groups/${f.id}`)).status).toBe(200);
    expect((await call(dual, "GET", `/api/groups/${g.id}`)).status).toBe(403);
    expect((await call(dual, "GET", `/api/members/${made[2].id}`)).status).toBe(404);
  });

  it("12c. /admin/users shows leader and co-leader assignments and whether they take effect", async () => {
    const list = await json(await call(superA, "GET", "/api/admin/users"));
    const byEmail = (key: string) => list.data.find((u: { email: string }) => u.email === `${key}@scope-test.local`);

    const dual = byEmail("dual");
    expect(dual.scopeActive).toBe(true);
    expect(dual.ledGroups.map((g: { name: string; as: string }) => `${g.as}:${g.name}`).sort()).toEqual(["co_leader:พันธกิจ F", "leader:พันธกิจ E"]);
    // the picker still edits only the care groups the user leads
    expect(dual.careGroups.map((g: { name: string }) => g.name)).toEqual(["พันธกิจ E"]);

    const co = byEmail("coleader");
    expect(co.ledGroups.map((g: { name: string; as: string }) => `${g.as}:${g.name}`)).toEqual(["co_leader:พันธกิจ C"]);
    expect(co.careGroups).toEqual([]);

    // a name on a group without the group_leader role grants nothing, and the page says so
    const idle = await newActor("idle", "member");
    await db.insert(schema.groups).values({ name: "พันธกิจ H", orgLevel: "care", leaderId: idle.id });
    const again = await json(await call(superA, "GET", "/api/admin/users?search=idle"));
    expect(again.data[0].scopeActive).toBe(false);
    expect(again.data[0].ledGroups).toHaveLength(1);
    expect((await call(idle, "GET", "/api/members?limit=100")).status).toBe(403);

    // conflict rules are unchanged: a different leader of E means 409, a group with only a co-leader does not
    const other = await newActor("other", "group_leader");
    const [eRow] = await db.select().from(schema.groups).where(eq(schema.groups.name, "พันธกิจ E"));
    const [fRow] = await db.select().from(schema.groups).where(eq(schema.groups.name, "พันธกิจ F"));
    expect((await call(superA, "PUT", `/api/admin/users/${other.id}/care-groups`, { groupIds: [eRow.id] })).status).toBe(409);
    expect((await call(superA, "PUT", `/api/admin/users/${other.id}/care-groups`, { groupIds: [fRow.id] })).status).toBe(200);
  });
});
