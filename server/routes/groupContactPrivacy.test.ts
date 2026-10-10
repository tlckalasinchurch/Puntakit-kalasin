import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Member contact privacy on the two group endpoints (real PGlite Postgres,
 * synthetic data).
 *
 * The approved policy, taken from `shared/roles.ts`:
 *   - `CONTACT_VISIBLE_ROLES` (super_admin, admin, staff) see real phone numbers.
 *   - The member's own `assignedLeaderId` sees that member's real number.
 *   - Every other role gets the masked form, exactly like `/api/members`.
 *
 * Before this change both group endpoints decided contacts from
 * `canViewFullGroupRosterRole`, which also lists `ministry_leader`, and from the
 * group's own leader/co-leader, so those two roles received unmasked numbers
 * while `/api/members` masked them for the same accounts.
 *
 * Leader account email is a separate rule and is deliberately NOT part of this
 * change: it stays with `PRIVILEGED_ROLES` (which includes `ministry_leader`) plus
 * the group's own leader/co-leader.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let root: string;

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
});

const PHONE_ASSIGNED = "081-234-5678";
const PHONE_PLAIN = "0897654321";
const PHONE_LEFT = "082-111-2222";
const REAL_NUMBERS = [PHONE_ASSIGNED, PHONE_PLAIN, PHONE_LEFT];
const MIDDLE_DIGITS = ["2345", "0765", "1112"];

const MASK_ASSIGNED = "081-xxx-678";
const MASK_PLAIN = "089-xxx-321";
const MASK_LEFT = "082-xxx-222";

type Row = {
  memberId: string;
  memberName: string;
  memberPhone: string | null;
  role: string;
  status: string;
  assignedLeaderId?: unknown;
};

describe("group endpoints: member contact privacy", () => {
  let server: Server;
  let baseUrl: string;
  const cookies: Record<string, string> = {};
  const id: Record<string, string> = {};

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-grpcontacts-"));
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
      ["gl_leads", "group_leader"],
      ["gl_other", "group_leader"],
      ["assigned", "viewer"],
      ["viewer", "viewer"],
      ["member_in", "member"],
    ] as const;
    for (const [key, role] of roles) {
      const [u] = await db.insert(schema.users).values({ email: `${key}@contact.local`, passwordHash: "x", name: key, role }).returning();
      id[`user_${key}`] = u.id;
      cookies[key] = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: u.id, email: u.email, role })}`;
    }

    // m1 is assigned to the `assigned` viewer; m2/m3/m4 are not assigned to anyone.
    const [m1] = await db.insert(schema.members).values({ name: "สมาชิกหนึ่ง", phone: PHONE_ASSIGNED, assignedLeaderId: id.user_assigned }).returning();
    const [m2] = await db.insert(schema.members).values({ name: "สมาชิกสอง", phone: PHONE_PLAIN }).returning();
    const [m3] = await db.insert(schema.members).values({ name: "สมาชิกสาม" }).returning(); // no phone
    const [m4] = await db.insert(schema.members).values({ name: "สมาชิกสี่", phone: PHONE_LEFT }).returning();
    id.m1 = m1.id; id.m2 = m2.id; id.m3 = m3.id; id.m4 = m4.id;

    // An active member of the group whose login is the `member` role.
    const [mSelf] = await db.insert(schema.members).values({ name: "สมาชิกในกลุ่ม", phone: "089-000-1111", userId: id.user_member_in }).returning();
    id.mSelf = mSelf.id;

    // The assigned viewer is also an active member of the group, so they reach the
    // roster on both endpoints and the assignedLeaderId rule is observable.
    const [mAssigned] = await db.insert(schema.members).values({ name: "ผู้ดูแลที่ได้รับมอบหมาย", userId: id.user_assigned }).returning();
    id.mAssigned = mAssigned.id;

    const [g] = await db.insert(schema.groups).values({
      name: "กลุ่มทดสอบ",
      privacy: "public",
      area: "พื้นที่ทดสอบ",
      meetingLocation: "วัดกลุ่ม",
      leaderId: id.user_gl_leads,
    }).returning();
    id.group = g.id;

    const [gp] = await db.insert(schema.groups).values({
      name: "กลุ่มส่วนตัวทดสอบ",
      privacy: "private",
      area: "พื้นที่ส่วนตัว",
      meetingLocation: "บ้านทดสอบ",
      leaderId: id.user_gl_leads,
    }).returning();
    id.groupPrivate = gp.id;

    await db.insert(schema.groupMembers).values([
      { groupId: g.id, memberId: m1.id, role: "member", status: "active" },
      { groupId: g.id, memberId: m2.id, role: "leader", status: "active" },
      { groupId: g.id, memberId: m3.id, role: "member", status: "active" },
      { groupId: g.id, memberId: m4.id, role: "member", status: "inactive", leftAt: new Date() },
      { groupId: g.id, memberId: mSelf.id, role: "member", status: "active" },
      { groupId: g.id, memberId: mAssigned.id, role: "member", status: "active" },
      { groupId: gp.id, memberId: m1.id, role: "member", status: "active" },
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

  const byMember = (rows: Row[]) => Object.fromEntries(rows.map((r) => [r.memberId, r]));

  const listRows = async (role: string, groupKey = "group"): Promise<Row[]> => {
    const r = await get(role, `/api/groups/${id[groupKey]}/members`);
    expect(r.status, `${role} list status`).toBe(200);
    return JSON.parse(r.text).data as Row[];
  };
  const detailRows = async (role: string, groupKey = "group"): Promise<Row[]> => {
    const r = await get(role, `/api/groups/${id[groupKey]}`);
    expect(r.status, `${role} detail status`).toBe(200);
    return JSON.parse(r.text).data.members as Row[];
  };

  /** Roster rows a role may legitimately see on `/api/groups/:id` (empty when it may not). */
  const detailOrEmpty = async (role: string): Promise<Row[]> => {
    const r = await get(role, `/api/groups/${id.group}`);
    if (r.status !== 200) return [];
    return JSON.parse(r.text).data.members as Row[];
  };

  for (const [label, rowsFor] of [
    ["GET /api/groups/:id/members", (r: string) => listRows(r)],
    ["GET /api/groups/:id (roster)", (r: string) => detailOrEmpty(r)],
  ] as const) {
    describe(label, () => {
      for (const role of ["super_admin", "admin", "staff"]) {
        it(`${role} receives the real numbers`, async () => {
          const rows = byMember(await rowsFor(role));
          expect(rows[id.m1].memberPhone).toBe(PHONE_ASSIGNED);
          expect(rows[id.m2].memberPhone).toBe(PHONE_PLAIN);
          expect(rows[id.m4].memberPhone).toBe(PHONE_LEFT);
        });
      }

      it("ministry_leader sees the roster but every number is masked", async () => {
        const rows = byMember(await rowsFor("ministry_leader"));
        expect(rows[id.m1], "ministry_leader must see the roster").toBeDefined();
        expect(rows[id.m1].memberPhone).toBe(MASK_ASSIGNED);
        expect(rows[id.m2].memberPhone).toBe(MASK_PLAIN);
        expect(rows[id.m4].memberPhone).toBe(MASK_LEFT);
      });

      it("the group's own leader sees the roster but every number is masked", async () => {
        const rows = byMember(await rowsFor("gl_leads"));
        expect(rows[id.m1], "the leader must see the roster").toBeDefined();
        expect(rows[id.m1].memberPhone).toBe(MASK_ASSIGNED);
        expect(rows[id.m2].memberPhone).toBe(MASK_PLAIN);
        expect(rows[id.m4].memberPhone).toBe(MASK_LEFT);
      });

      it("a group_leader who does not lead the group is refused", async () => {
        const list = await get("gl_other", `/api/groups/${id.group}/members`);
        const detail = await get("gl_other", `/api/groups/${id.group}`);
        expect(list.status, "roster list").toBe(403);
        expect(detail.status, "group detail").toBe(403);
      });

      it("the assigned leader sees the real number of their own member only", async () => {
        const rows = byMember(await rowsFor("assigned"));
        expect(rows[id.m1].memberPhone).toBe(PHONE_ASSIGNED);
        expect(rows[id.m2].memberPhone).toBe(MASK_PLAIN);
        expect(rows[id.m4].memberPhone).toBe(MASK_LEFT);
      });

      it("keeps a missing phone as null for every role", async () => {
        for (const role of ["admin", "staff", "ministry_leader", "gl_leads", "assigned"]) {
          expect(byMember(await rowsFor(role))[id.m3].memberPhone, role).toBeNull();
        }
      });

      it("matches the value /api/members returns for the same role and member", async () => {
        // `member` is excluded: it cannot open /api/members or either group endpoint.
        for (const role of ["super_admin", "admin", "staff", "ministry_leader", "gl_leads", "viewer"]) {
          const res = await get(role, "/api/members?limit=100");
          expect(res.status, `${role} /api/members`).toBe(200);
          const dir = JSON.parse(res.text).data as Array<{ id: string; phone: string | null }>;
          const fromDirectory = Object.fromEntries(dir.map((m) => [m.id, m.phone]));
          const rows = byMember(await listRows(role));
          for (const mid of [id.m1, id.m2, id.m3, id.m4]) {
            // A group_leader's directory scope covers the groups they lead by
            // ACTIVE membership, so the member who already left is absent from
            // /api/members while still listed on the group roster. Compare only
            // members the directory actually returns.
            if (!(mid in fromDirectory)) continue;
            expect(rows[mid].memberPhone, `${role} / ${mid}`).toBe(fromDirectory[mid]);
          }
        }
      });

      it("never returns assignedLeaderId", async () => {
        for (const role of ["super_admin", "admin", "staff", "ministry_leader", "gl_leads", "assigned"]) {
          for (const row of await rowsFor(role)) {
            expect("assignedLeaderId" in row, `assignedLeaderId leaked for ${role}`).toBe(false);
          }
        }
      });

      it("contains no real number anywhere for a masked role", async () => {
        for (const role of ["ministry_leader", "gl_leads", "viewer"]) {
          for (const url of [`/api/groups/${id.group}/members`, `/api/groups/${id.group}`]) {
            const { status, text } = await get(role, url);
            expect(status, `${role} ${url}`).toBe(200);
            for (const n of REAL_NUMBERS) expect(text, `${n} leaked to ${role} at ${url}`).not.toContain(n);
            for (const d of MIDDLE_DIGITS) expect(text, `digits ${d} leaked to ${role} at ${url}`).not.toContain(d);
          }
        }
      });

      it("keeps a member's own contact visible only to the assigned leader", async () => {
        const res = await get("assigned", `/api/groups/${id.group}`);
        expect(res.status).toBe(200);
        expect(res.text).toContain(PHONE_ASSIGNED);
        expect(res.text, PHONE_PLAIN).not.toContain(PHONE_PLAIN);
        expect(res.text, PHONE_LEFT).not.toContain(PHONE_LEFT);
      });
    });
  }

  describe("private group", () => {
    it("masks the roster for ministry_leader and the group's own leader", async () => {
      for (const role of ["ministry_leader", "gl_leads"]) {
        const rows = byMember(await listRows(role, "groupPrivate"));
        expect(rows[id.m1], `${role} sees the private roster`).toBeDefined();
        expect(rows[id.m1].memberPhone, role).toBe(MASK_ASSIGNED);
      }
    });

    it("still hides the meeting location from roles that could not see it before", async () => {
      const detail = JSON.parse((await get("viewer", `/api/groups/${id.groupPrivate}`)).text).data;
      expect(detail.meetingLocation).not.toBe("บ้านทดสอบ");
    });
  });

  describe("leaderEmail is a separate rule and must not change", () => {
    it("stays visible to PRIVILEGED_ROLES including ministry_leader", async () => {
      for (const role of ["super_admin", "admin", "staff", "ministry_leader"]) {
        for (const url of [`/api/groups/${id.group}`, `/api/groups`]) {
          const detail = JSON.parse((await get(role, url)).text).data;
          const rows = Array.isArray(detail) ? detail : [detail];
          const found = rows.find((g) => g.id === id.group);
          expect(found, `${role} ${url}`).toBeDefined();
          expect(found.leaderEmail, `${role} ${url} leaderEmail`).toBeTruthy();
        }
      }
    });

    it("stays hidden from a viewer", async () => {
      for (const url of [`/api/groups/${id.group}`, `/api/groups`]) {
        const detail = JSON.parse((await get("viewer", url)).text).data;
        const rows = Array.isArray(detail) ? detail : [detail];
        const found = rows.find((g) => g.id === id.group);
        expect(found.leaderEmail ?? null, `viewer ${url}`).toBeNull();
      }
    });

    it("stays visible to the group's own leader", async () => {
      for (const url of [`/api/groups/${id.group}`, `/api/groups`]) {
        const detail = JSON.parse((await get("gl_leads", url)).text).data;
        const rows = Array.isArray(detail) ? detail : [detail];
        const found = rows.find((g) => g.id === id.group);
        expect(found.leaderEmail ?? null, `gl_leads ${url}`).toBeTruthy();
      }
    });
  });

  describe("access and shape that must not change", () => {
    it("a plain viewer who is not a group member sees no roster on the detail endpoint", async () => {
      expect(await detailOrEmpty("viewer")).toEqual([]);
    });

    it("a member is refused on both group endpoints", async () => {
      // Both routes are gated by requireRole(...ADMIN_SHELL_ROLES), which excludes
      // `member` (docs/PUNTAKIT_AUTHZ_AUDIT_2026-10-04.md:62). Unchanged here.
      expect((await get("member_in", `/api/groups/${id.group}/members`)).status).toBe(403);
      expect((await get("member_in", `/api/groups/${id.group}`)).status).toBe(403);
    });

    it("answers 401 to an anonymous caller on both endpoints", async () => {
      expect((await fetch(`${baseUrl}/api/groups/${id.group}/members`)).status).toBe(401);
      expect((await fetch(`${baseUrl}/api/groups/${id.group}`)).status).toBe(401);
    });

    it("answers 404 for an unknown group on both endpoints", async () => {
      expect((await get("admin", "/api/groups/does-not-exist/members")).status).toBe(404);
      expect((await get("admin", "/api/groups/does-not-exist")).status).toBe(404);
    });

    it("keeps the roster response shape unchanged", async () => {
      const rows = await listRows("admin");
      for (const row of rows) {
        expect(Object.keys(row).sort()).toEqual(
          [
            "groupId", "id", "joinedAt", "lastAttendedAt", "leftAt",
            "memberAvatarUrl", "memberId", "memberName", "memberNickname", "memberPhone",
            "membershipStatus", "pastoralStatus", "role", "status",
          ].sort(),
        );
      }
    });
  });
});