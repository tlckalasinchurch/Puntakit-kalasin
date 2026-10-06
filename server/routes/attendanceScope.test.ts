import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Group ownership on attendance and the care roster (real PGlite Postgres,
 * synthetic data). A `group_leader` writes and reads attendance only for the
 * groups it leads: groups.leader_id, groups.co_leader_id, or an ACTIVE
 * group_members row with role leader / assistant_leader. groups.leader_member_id
 * is not an ownership source.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let root: string;

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
});

const MISSING_GROUP = "00000000-0000-4000-8000-00000000dead";

describe("attendance group ownership", () => {
  let server: Server;
  let baseUrl: string;
  const cookie: Record<string, string> = {};
  const g: Record<string, string> = {};
  const m: Record<string, string> = {};

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-attscope-"));
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await (await import("../db/bootstrap.js")).bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    const db = client.getDb();

    const u: Record<string, string> = {};
    const mkUser = async (key: string, role: (typeof schema.USER_ROLES)[number]) => {
      const [row] = await db.insert(schema.users).values({ email: `${key}@scope.local`, passwordHash: "x", name: key, role }).returning();
      u[key] = row.id;
      cookie[key] = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: row.id, email: row.email, role })}`;
    };
    for (const role of ["admin", "staff", "ministry_leader", "viewer", "member"] as const) await mkUser(role, role);
    // group_leader accounts, one per ownership source (and the ones that own nothing).
    for (const key of ["leaderA", "leaderB", "coLeader", "memLeader", "asstLeader", "inactiveLeader", "deletedMemberLeader", "deletedGroupLeader", "nobody"]) {
      await mkUser(key, "group_leader");
    }

    const mkGroup = async (key: string, values: Partial<typeof schema.groups.$inferInsert> = {}) => {
      const [row] = await db.insert(schema.groups).values({ name: `กลุ่ม ${key}`, ...values }).returning();
      g[key] = row.id;
    };
    await mkGroup("A", { leaderId: u.leaderA, orgLevel: "care" });
    await mkGroup("B", { leaderId: u.leaderB, orgLevel: "care" });
    await mkGroup("C", { coLeaderId: u.coLeader });
    await mkGroup("D");
    await mkGroup("E");
    await mkGroup("F");
    await mkGroup("G");
    await mkGroup("H", { leaderId: u.deletedGroupLeader, deletedAt: new Date() });

    const mkMember = async (key: string, values: Partial<typeof schema.members.$inferInsert> = {}) => {
      const [row] = await db
        .insert(schema.members)
        .values({ name: `สมาชิก ${key}`, phone: `081-000-${String(Object.keys(m).length).padStart(4, "0")}`, lineId: `line-${key}`, ...values })
        .returning();
      m[key] = row.id;
    };
    // Members that are the leaders' own linked records.
    await mkMember("linkD", { userId: u.memLeader });
    await mkMember("linkE", { userId: u.asstLeader });
    await mkMember("linkF", { userId: u.inactiveLeader });
    await mkMember("linkG", { userId: u.deletedMemberLeader, deletedAt: new Date() });
    // Group A and B members.
    await mkMember("a1");
    await mkMember("a2", { assignedLeaderId: u.admin });
    await mkMember("b1");
    await mkMember("b2");
    await mkMember("loose", { assignedLeaderId: u.admin });

    const link = (group: string, member: string, role: "member" | "leader" | "assistant_leader", status: "active" | "inactive" = "active") =>
      db.insert(schema.groupMembers).values({ groupId: g[group], memberId: m[member], role, status });
    await link("D", "linkD", "leader");
    await link("E", "linkE", "assistant_leader");
    await link("F", "linkF", "leader", "inactive");
    await link("G", "linkG", "leader");
    await link("A", "a1", "member");
    await link("A", "a2", "member");
    await link("B", "b1", "member");
    await link("B", "b2", "member");

    // Attendance: a1 and b1 attended; a2, b2 and loose did not.
    const rec = (group: string | null, member: string, date: string, serviceType: "care_group" | "sunday_service", notes: string | null) =>
      db.insert(schema.attendanceRecords).values({
        date: new Date(date),
        serviceType,
        groupId: group ? g[group] : null,
        memberId: m[member],
        status: "present",
        checkedInBy: u.admin,
        notes,
      });
    await rec("A", "a1", "2026-10-04T03:00:00Z", "care_group", "note-A");
    await rec("B", "b1", "2026-10-04T03:00:00Z", "care_group", "note-B");
    await rec(null, "a2", "2026-09-27T03:00:00Z", "sunday_service", "note-none");

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

  const call = (who: string | null, method: string, url: string, body?: unknown) =>
    fetch(`${baseUrl}${url}`, {
      method,
      headers: { ...(who ? { Cookie: cookie[who] } : {}), "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const checkIn = (who: string, groupId: string | undefined, extra: Record<string, unknown> = {}) =>
    call(who, "POST", "/api/attendance/check-in", { memberId: m.a1, serviceType: "care_group", status: "present", date: "2026-10-11", groupId, ...extra });
  type Rows = { data: Array<{ groupId: string | null; notes: string | null; memberPhone: string | null; memberId: string }> };
  type Absent = { data: Array<{ id: string; phone: string | null; leaderEmail: string | null; lastAttendedDate: string | null }> };

  describe("write: who owns the group", () => {
    it.each([
      ["groups.leader_id", "leaderA", "A"],
      ["groups.co_leader_id", "coLeader", "C"],
      ["active group_members role=leader", "memLeader", "D"],
      ["active group_members role=assistant_leader", "asstLeader", "E"],
    ])("allows a group_leader through %s", async (_label, who, group) => {
      expect([200, 201]).toContain((await checkIn(who, g[group])).status);
    });

    it("denies a group_leader a group it does not lead (403) on every write route", async () => {
      expect((await checkIn("leaderA", g.B)).status).toBe(403);
      const bulk = await call("leaderA", "POST", "/api/attendance/bulk", { date: "2026-10-11", serviceType: "care_group", groupId: g.B, records: [{ memberId: m.b1, status: "present" }] });
      expect(bulk.status).toBe(403);
      expect((await call("leaderA", "POST", "/api/attendance/qr-scan", { token: m.b1, serviceType: "care_group", groupId: g.B })).status).toBe(403);
    });

    it("denies a leader with no group, and a leader whose link is inactive, deleted, or on a deleted group", async () => {
      expect((await checkIn("nobody", g.A)).status).toBe(403);
      expect((await checkIn("inactiveLeader", g.F)).status).toBe(403); // group_members.status = inactive
      expect((await checkIn("deletedMemberLeader", g.G)).status).toBe(403); // member row deleted
      // The group itself is deleted: it no longer exists for anyone.
      expect((await checkIn("deletedGroupLeader", g.H)).status).toBe(404);
    });

    it("denies a group_leader a write with no group id (403) on every write route", async () => {
      expect((await checkIn("leaderA", undefined, { serviceType: "sunday_service" })).status).toBe(403);
      expect((await checkIn("leaderA", "", { serviceType: "sunday_service" })).status).toBe(403);
      const bulk = await call("leaderA", "POST", "/api/attendance/bulk", { date: "2026-10-11", serviceType: "sunday_service", records: [{ memberId: m.a1, status: "present" }] });
      expect(bulk.status).toBe(403);
      expect((await call("leaderA", "POST", "/api/attendance/qr-scan", { token: m.a1, serviceType: "sunday_service" })).status).toBe(403);
    });

    it("answers 404 for a group that does not exist, for every role that can write", async () => {
      for (const who of ["leaderA", "admin", "staff", "ministry_leader"]) {
        expect((await checkIn(who, MISSING_GROUP)).status, who).toBe(404);
      }
      const bulk = await call("leaderA", "POST", "/api/attendance/bulk", { date: "2026-10-11", serviceType: "care_group", groupId: MISSING_GROUP, records: [{ memberId: m.a1, status: "present" }] });
      expect(bulk.status).toBe(404);
      expect((await call("staff", "POST", "/api/attendance/qr-scan", { token: m.a1, serviceType: "care_group", groupId: MISSING_GROUP })).status).toBe(404);
    });

    it("keeps admin, staff and ministry_leader able to write any group, and without a group id", async () => {
      for (const who of ["admin", "staff", "ministry_leader"]) {
        expect([200, 201], who).toContain((await checkIn(who, g.B)).status);
        expect([200, 201], `${who} no group`).toContain((await checkIn(who, undefined, { serviceType: "sunday_service" })).status);
      }
    });

    it("still answers 401 to anonymous and 403 to a member and a viewer", async () => {
      expect((await call(null, "POST", "/api/attendance/check-in", {})).status).toBe(401);
      expect((await checkIn("member", g.A)).status).toBe(403);
      expect((await checkIn("viewer", g.A)).status).toBe(403);
    });
  });

  describe("GET /api/attendance: read scope", () => {
    it("limits a group_leader to the rows of its own groups", async () => {
      const body = (await (await call("leaderA", "GET", "/api/attendance?limit=100")).json()) as Rows;
      expect(body.data.length).toBeGreaterThan(0);
      expect(new Set(body.data.map((r) => r.groupId))).toEqual(new Set([g.A]));
      expect(body.data.some((r) => r.notes === "note-A")).toBe(true);
      expect(body.data.some((r) => r.notes === "note-B" || r.notes === "note-none")).toBe(false);
    });

    it("denies a group_leader an explicit group filter it does not lead (403), and 404s a missing group", async () => {
      expect((await call("leaderA", "GET", `/api/attendance?groupId=${g.B}`)).status).toBe(403);
      expect((await call("leaderA", "GET", `/api/attendance?groupId=${MISSING_GROUP}`)).status).toBe(404);
    });

    it("returns no rows to a group_leader that leads nothing", async () => {
      const res = await call("nobody", "GET", "/api/attendance");
      expect(res.status).toBe(200);
      expect(((await res.json()) as Rows).data).toEqual([]);
    });

    it("keeps admin and staff reading every group, with contacts only for MEMBER_CONTACT_ROLES", async () => {
      for (const who of ["admin", "staff"]) {
        const body = (await (await call(who, "GET", "/api/attendance?limit=100")).json()) as Rows;
        const groupsSeen = new Set(body.data.map((r) => r.groupId));
        expect(groupsSeen.has(g.A) && groupsSeen.has(g.B) && groupsSeen.has(null as unknown as string), who).toBe(true);
        expect(body.data.some((r) => r.notes === "note-B"), who).toBe(true);
        expect(body.data.every((r) => r.memberPhone), who).toBe(true);
      }
    });

    it("keeps ministry_leader reading every group and its notes, phone masked as before", async () => {
      const body = (await (await call("ministry_leader", "GET", "/api/attendance?limit=100")).json()) as Rows;
      expect(body.data.some((r) => r.notes === "note-B")).toBe(true);
      expect(body.data.every((r) => r.memberPhone === null)).toBe(true);
    });

    it("keeps viewer read access, with phone and notes null", async () => {
      const res = await call("viewer", "GET", "/api/attendance?limit=100");
      expect(res.status).toBe(200);
      const body = (await res.json()) as Rows;
      expect(new Set(body.data.map((r) => r.groupId)).size).toBeGreaterThan(1);
      expect(body.data.every((r) => r.notes === null && r.memberPhone === null)).toBe(true);
    });

    it("answers 401 to anonymous and 403 to a member", async () => {
      expect((await call(null, "GET", "/api/attendance")).status).toBe(401);
      expect((await call("member", "GET", "/api/attendance")).status).toBe(403);
    });
  });

  describe("GET /api/attendance/absentees", () => {
    const url = "/api/attendance/absentees?serviceType=care_group&threshold=1";

    it("limits a group_leader to absent members of its own groups, with no contact data", async () => {
      const res = await call("leaderA", "GET", url);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Absent;
      expect(body.data.map((a) => a.id)).toEqual([m.a2]);
      expect(body.data[0].phone).toBeNull();
      expect(body.data[0].leaderEmail).toBeNull();
    });

    it("denies a group_leader another group (403) and returns nothing when it leads none", async () => {
      expect((await call("leaderA", "GET", `${url}&groupId=${g.B}`)).status).toBe(403);
      expect((await call("leaderA", "GET", `${url}&groupId=${MISSING_GROUP}`)).status).toBe(404);
      const none = (await (await call("nobody", "GET", url)).json()) as Absent;
      expect(none.data).toEqual([]);
    });

    it("keeps viewer read access with phone and leaderEmail null", async () => {
      const res = await call("viewer", "GET", url);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Absent;
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data.every((a) => a.phone === null && a.leaderEmail === null)).toBe(true);
    });

    it("keeps church-wide reach for admin and staff, with phone and leaderEmail intact", async () => {
      for (const who of ["admin", "staff"]) {
        const body = (await (await call(who, "GET", url)).json()) as Absent;
        const ids = body.data.map((a) => a.id);
        expect(ids, who).toEqual(expect.arrayContaining([m.a2, m.b2, m.loose]));
        const withLeader = body.data.find((a) => a.id === m.loose)!;
        expect(withLeader.phone, who).toBeTruthy();
        expect(withLeader.leaderEmail, who).toBe("admin@scope.local");
        // last attended date comes from one grouped query: a2 attended a sunday service.
        expect(body.data.find((a) => a.id === m.a2)!.lastAttendedDate, who).toBeTruthy();
        expect(withLeader.lastAttendedDate, who).toBeNull();
      }
    });

    it("keeps ministry_leader reading the leader email it could read before, phone masked", async () => {
      const body = (await (await call("ministry_leader", "GET", url)).json()) as Absent;
      expect(body.data.find((a) => a.id === m.loose)!.leaderEmail).toBe("admin@scope.local");
      expect(body.data.every((a) => a.phone === null)).toBe(true);
    });

    it("answers 401 to anonymous and 403 to a member", async () => {
      expect((await call(null, "GET", url)).status).toBe(401);
      expect((await call("member", "GET", url)).status).toBe(403);
    });
  });

  describe("GET /api/care/groups/:id/roster: contacts", () => {
    type Roster = { data: { members: Array<{ id: string; phone: string | null; lineId: string | null }> } };
    const roster = (who: string | null, group: string) => call(who, "GET", `/api/care/groups/${g[group]}/roster?date=2026-10-11`);

    it("gives the leader of the group raw phone and LINE ID", async () => {
      const res = await roster("leaderA", "A");
      expect(res.status).toBe(200);
      const body = (await res.json()) as Roster;
      expect(body.data.members.length).toBe(2);
      expect(body.data.members.every((p) => p.lineId && p.phone && !p.phone.includes("*"))).toBe(true);
    });

    it("masks phone and nulls LINE ID for the leader of another group", async () => {
      const res = await roster("leaderB", "A");
      expect(res.status).toBe(200);
      const body = (await res.json()) as Roster;
      expect(body.data.members.length).toBe(2);
      expect(body.data.members.every((p) => p.lineId === null && (p.phone === null || p.phone.includes("-xxx-")))).toBe(true);
    });

    it("keeps admin, staff and ministry_leader reading raw contacts, as before", async () => {
      for (const who of ["admin", "staff", "ministry_leader"]) {
        const body = (await (await roster(who, "A")).json()) as Roster;
        expect(body.data.members.every((p) => p.lineId && p.phone), who).toBe(true);
      }
    });

    it("answers 401 to anonymous and 403 to a member and a viewer", async () => {
      expect((await roster(null, "A")).status).toBe(401);
      expect((await roster("member", "A")).status).toBe(403);
      expect((await roster("viewer", "A")).status).toBe(403);
    });
  });
});
