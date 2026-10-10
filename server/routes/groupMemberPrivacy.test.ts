import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * D54 regression: member phone numbers on the group endpoints.
 *
 * `GET /api/groups/:id/members` and `GET /api/groups/:id` (which embeds the same
 * member rows) used to return `memberPhone` unmasked to every signed-in role.
 * They must follow the rule `/api/members` already applies
 * (`maskSensitiveData`): super_admin, admin, staff — and the member's own
 * `assignedLeaderId` — see the real number; every other role gets the masked
 * form. Real PGlite Postgres, synthetic data only.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let root: string;

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
});

const PHONE_ASSIGNED = "081-234-5678"; // member whose assignedLeaderId is the "assigned" user
const PHONE_PLAIN = "089-765-4321";
const PHONE_LEFT = "082-111-2222"; // a member who has left the group (inactive row)
const REAL_NUMBERS = [PHONE_ASSIGNED, PHONE_PLAIN, PHONE_LEFT];
// Digits from the middle of each number: present in a real number, absent from its mask.
const MIDDLE_DIGITS = ["2345", "7654", "1112"];

type Row = {
  memberId: string;
  memberName: string;
  memberNickname: string | null;
  memberPhone: string | null;
  role: string;
  status: string;
  membershipStatus: string;
  pastoralStatus: string;
  assignedLeaderId?: unknown;
};

describe("group endpoints: member phone privacy (D54)", () => {
  let server: Server;
  let baseUrl: string;
  const cookies: Record<string, string> = {};
  const id: Record<string, string> = {};

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-grpprivacy-"));
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await (await import("../db/bootstrap.js")).bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    const db = client.getDb();

    const roles = [
      ["super_admin", "super_admin"],
      ["admin", "admin"],
      ["staff", "staff"],
      ["ministry_leader", "ministry_leader"],
      ["group_leader", "group_leader"], // leads the private group below
      ["other_leader", "group_leader"], // leads nothing
      ["assigned", "viewer"], // viewer who is assignedLeaderId of one member
      ["viewer", "viewer"],
      ["member", "member"],
    ] as const;
    for (const [key, role] of roles) {
      const [u] = await db.insert(schema.users).values({ email: `${key}@d54.local`, passwordHash: "x", name: key, role }).returning();
      id[`user_${key}`] = u.id;
      cookies[key] = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: u.id, email: u.email, role })}`;
    }

    const [m1] = await db.insert(schema.members).values({ name: "สมาชิก หนึ่ง", nickname: "หนึ่ง", phone: PHONE_ASSIGNED, email: "one@example.test", assignedLeaderId: id.user_assigned }).returning();
    const [m2] = await db.insert(schema.members).values({ name: "สมาชิก สอง", phone: PHONE_PLAIN }).returning();
    const [m3] = await db.insert(schema.members).values({ name: "สมาชิก สาม" }).returning(); // no phone at all
    const [m4] = await db.insert(schema.members).values({ name: "สมาชิก สี่ (ออกแล้ว)", phone: PHONE_LEFT }).returning();
    id.m1 = m1.id; id.m2 = m2.id; id.m3 = m3.id; id.m4 = m4.id;

    const [g] = await db.insert(schema.groups).values({ name: "กลุ่มส่วนตัวทดสอบ", privacy: "private", area: "พื้นที่ทดสอบ", meetingLocation: "บ้านทดสอบ", leaderId: id.user_group_leader }).returning();
    id.group = g.id;
    await db.insert(schema.groupMembers).values([
      { groupId: g.id, memberId: m1.id, role: "member", status: "active" },
      { groupId: g.id, memberId: m2.id, role: "leader", status: "active" },
      { groupId: g.id, memberId: m3.id, role: "member", status: "active" },
      { groupId: g.id, memberId: m4.id, role: "member", status: "inactive", leftAt: new Date() },
    ]);

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

  const get = async (role: string, url: string) => {
    const res = await fetch(`${baseUrl}${url}`, { headers: { Cookie: cookies[role] } });
    return { status: res.status, text: await res.text() };
  };
  const rowsOf = (role: Promise<{ text: string }> | { text: string }, pick: (b: any) => Row[]) =>
    Promise.resolve(role).then(r => pick(JSON.parse(r.text)));

  const byMember = (rows: Row[]) => Object.fromEntries(rows.map(r => [r.memberId, r]));
  const listRows = async (role: string): Promise<Row[]> =>
    rowsOf(get(role, `/api/groups/${id.group}/members`), b => b.data);
  const detailRows = async (role: string): Promise<Row[]> =>
    rowsOf(get(role, `/api/groups/${id.group}`), b => b.data.members);

  /** Same policy as `maskSensitiveData` in routes/members.ts: A, S and the assigned leader see the real number. */
  const CONTACT_ROLES = ["super_admin", "admin", "staff"];
  const MASKED_ROLES = ["ministry_leader", "group_leader", "other_leader", "viewer", "member"];

  for (const [label, rowsFor] of [
    ["GET /api/groups/:id/members", listRows],
    ["GET /api/groups/:id (embedded members)", detailRows],
  ] as const) {
    describe(label, () => {
      for (const role of CONTACT_ROLES) {
        it(`${role} receives the real numbers`, async () => {
          const rows = byMember(await rowsFor(role));
          expect(rows[id.m1].memberPhone).toBe(PHONE_ASSIGNED);
          expect(rows[id.m2].memberPhone).toBe(PHONE_PLAIN);
          expect(rows[id.m4].memberPhone).toBe(PHONE_LEFT);
        });
      }

      for (const role of MASKED_ROLES) {
        it(`${role} never receives a real number, in any row (including members who left)`, async () => {
          const rows = byMember(await rowsFor(role));
          expect(rows[id.m1].memberPhone).toBe("081-xxx-678");
          expect(rows[id.m2].memberPhone).toBe("089-xxx-321");
          expect(rows[id.m4].memberPhone).toBe("082-xxx-222");
        });
      }

      it("the assigned leader sees the real number of their own member only", async () => {
        const rows = byMember(await rowsFor("assigned"));
        expect(rows[id.m1].memberPhone).toBe(PHONE_ASSIGNED);
        expect(rows[id.m2].memberPhone).toBe("089-xxx-321");
        expect(rows[id.m4].memberPhone).toBe("082-xxx-222");
      });

      it("keeps a missing phone as null", async () => {
        for (const role of ["admin", "viewer", "member"]) {
          expect((byMember(await rowsFor(role)))[id.m3].memberPhone).toBeNull();
        }
      });

      it("returns the same phone value as /api/members for the same role and member", async () => {
        for (const role of ["super_admin", "admin", "staff", "ministry_leader", "group_leader", "viewer", "member", "assigned"]) {
          const list = JSON.parse((await get(role, "/api/members?limit=100")).text).data as Array<{ id: string; phone: string | null }>;
          const fromMembers = Object.fromEntries(list.map(m => [m.id, m.phone]));
          const rows = byMember(await rowsFor(role));
          for (const mid of [id.m1, id.m2, id.m3, id.m4]) {
            expect(rows[mid].memberPhone, `${role} / member ${mid}`).toBe(fromMembers[mid]);
          }
        }
      });

      it("keeps the other fields and does not add any new one", async () => {
        const rows = byMember(await rowsFor("viewer"));
        expect(rows[id.m1]).toMatchObject({ memberName: "สมาชิก หนึ่ง", memberNickname: "หนึ่ง", role: "member", status: "active" });
        expect(rows[id.m2]).toMatchObject({ role: "leader", status: "active" });
        expect(rows[id.m4]).toMatchObject({ status: "inactive" });
        for (const row of Object.values(rows)) {
          expect("assignedLeaderId" in row, "assignedLeaderId must not leak into the response").toBe(false);
          expect(Object.keys(row).sort()).toEqual(
            ["groupId", "id", "joinedAt", "lastAttendedAt", "leftAt", "memberAvatarUrl", "memberId", "memberName", "memberNickname", "memberPhone", "membershipStatus", "pastoralStatus", "role", "status"].sort()
          );
        }
      });
    });
  }

  describe("whole-response check: no real number anywhere in what a masked role receives", () => {
    for (const role of MASKED_ROLES) {
      for (const [label, url] of [
        ["members list", () => `/api/groups/${id.group}/members`],
        ["group detail", () => `/api/groups/${id.group}`],
      ] as const) {
        it(`${role} / ${label}`, async () => {
          const { status, text } = await get(role, url());
          expect(status).toBe(200);
          for (const n of REAL_NUMBERS) expect(text, `${n} leaked`).not.toContain(n);
          for (const d of MIDDLE_DIGITS) expect(text, `digits ${d} leaked`).not.toContain(d);
        });
      }
    }

    it("the assigned leader's response contains only their own member's real number", async () => {
      const { text } = await get("assigned", `/api/groups/${id.group}`);
      expect(text).toContain(PHONE_ASSIGNED);
      expect(text).not.toContain(PHONE_PLAIN);
      expect(text).not.toContain(PHONE_LEFT);
    });
  });

  describe("behaviour that must not change", () => {
    it("still hides a private group's location from roles that could not see it before", async () => {
      const detail = JSON.parse((await get("viewer", `/api/groups/${id.group}`)).text).data;
      expect(detail.meetingLocation).not.toBe("บ้านทดสอบ");
      expect(detail.meetingLocation).toContain("สงวนสิทธิ์");
    });

    it("still shows the location to the group's own leader", async () => {
      const detail = JSON.parse((await get("group_leader", `/api/groups/${id.group}`)).text).data;
      expect(detail.meetingLocation).toBe("บ้านทดสอบ");
    });

    it("keeps the member counts", async () => {
      const detail = JSON.parse((await get("viewer", `/api/groups/${id.group}`)).text).data;
      expect(detail.activeMemberCount).toBe(3);
      expect(detail.totalMemberCount).toBe(4);
    });

    it("answers 404 for an unknown group on both endpoints", async () => {
      expect((await get("viewer", "/api/groups/does-not-exist/members")).status).toBe(404);
      expect((await get("viewer", "/api/groups/does-not-exist")).status).toBe(404);
    });

    it("answers 401 to an anonymous caller on both endpoints", async () => {
      expect((await fetch(`${baseUrl}/api/groups/${id.group}/members`)).status).toBe(401);
      expect((await fetch(`${baseUrl}/api/groups/${id.group}`)).status).toBe(401);
    });
  });
});
