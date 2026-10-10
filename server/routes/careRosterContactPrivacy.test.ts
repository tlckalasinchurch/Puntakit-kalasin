import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Member contact privacy on `GET /api/care/groups/:id/roster` (real PGlite
 * Postgres, synthetic data).
 *
 * Same rule as `/api/members` and the two group endpoints
 * (`groupContactPrivacy.test.ts`): real phone and LINE ID only for
 * `CONTACT_VISIBLE_ROLES` (super_admin, admin, staff) or the member's own
 * `assignedLeaderId`; everyone else gets the masked phone and no LINE ID.
 * Before this, `ministry_leader` and the group's leader received every
 * member's real phone and LINE ID from this endpoint.
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
const LINE_ASSIGNED = "line-assigned";
const LINE_PLAIN = "line-plain";
const MASK_ASSIGNED = "081-xxx-678";
const MASK_PLAIN = "089-xxx-321";

type RosterRow = { id: string; name: string; phone: string | null; lineId: string | null; contactMasked: boolean; assignedLeaderId?: unknown };

describe("GET /api/care/groups/:id/roster contact privacy", () => {
  let server: Server;
  let baseUrl: string;
  const cookies: Record<string, string> = {};
  let careId: string;
  let otherCareId: string;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-careprivacy-"));
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await (await import("../db/bootstrap.js")).bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    const db = client.getDb();

    const mk = async (key: string, role: (typeof schema.USER_ROLES)[number]) => {
      const [u] = await db.insert(schema.users).values({ email: `${key}@care.local`, passwordHash: "x", name: key, role }).returning();
      cookies[key] = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: u.id, email: u.email, role })}`;
      return u;
    };
    await mk("admin", "admin");
    await mk("staff", "staff");
    await mk("ministry", "ministry_leader");
    await mk("viewer", "viewer");
    await mk("member", "member");
    const lead = await mk("lead", "group_leader"); // leads the care group, is NOT anyone's assigned leader
    const assigned = await mk("assigned", "group_leader"); // leads the group AND is assigned to one member
    const stranger = await mk("stranger", "group_leader"); // leads nothing here

    const [care] = await db.insert(schema.groups).values({ name: "แคร์ ทดสอบ", orgLevel: "care", leaderId: lead.id, coLeaderId: assigned.id }).returning();
    const [other] = await db.insert(schema.groups).values({ name: "แคร์ อื่น", orgLevel: "care", leaderId: stranger.id }).returning();
    careId = care.id;
    otherCareId = other.id;

    const [mAssigned, mPlain] = await db
      .insert(schema.members)
      .values([
        { name: "สมาชิก มอบหมาย", phone: PHONE_ASSIGNED, lineId: LINE_ASSIGNED, assignedLeaderId: assigned.id },
        { name: "สมาชิก ทั่วไป", phone: PHONE_PLAIN, lineId: LINE_PLAIN },
      ])
      .returning();
    await db.insert(schema.groupMembers).values([
      { groupId: care.id, memberId: mAssigned.id },
      { groupId: care.id, memberId: mPlain.id },
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

  const roster = async (role: string | null, id = careId) => {
    const res = await fetch(`${baseUrl}/api/care/groups/${id}/roster`, { headers: role ? { Cookie: cookies[role] } : {} });
    const body = (await res.json()) as { data?: { members: RosterRow[] } };
    return { status: res.status, rows: body.data?.members ?? [], raw: JSON.stringify(body) };
  };
  const byName = (rows: RosterRow[], name: string) => rows.find((r) => r.name === name)!;

  it.each(["admin", "staff"])("%s receives real phone and LINE ID for every member", async (role) => {
    const { status, rows } = await roster(role);
    expect(status).toBe(200);
    expect(byName(rows, "สมาชิก มอบหมาย")).toMatchObject({ phone: PHONE_ASSIGNED, lineId: LINE_ASSIGNED, contactMasked: false });
    expect(byName(rows, "สมาชิก ทั่วไป")).toMatchObject({ phone: PHONE_PLAIN, lineId: LINE_PLAIN, contactMasked: false });
  });

  it("ministry_leader sees the roster but every number is masked and no LINE ID", async () => {
    const { status, rows, raw } = await roster("ministry");
    expect(status).toBe(200);
    expect(rows).toHaveLength(2);
    expect(byName(rows, "สมาชิก มอบหมาย")).toMatchObject({ phone: MASK_ASSIGNED, lineId: null, contactMasked: true });
    expect(byName(rows, "สมาชิก ทั่วไป")).toMatchObject({ phone: MASK_PLAIN, lineId: null, contactMasked: true });
    for (const real of [PHONE_ASSIGNED, PHONE_PLAIN, LINE_ASSIGNED, LINE_PLAIN, "2345", "0765"]) expect(raw).not.toContain(real);
  });

  it("the group's leader sees everyone masked, because leading the group is not the same as being assigned", async () => {
    const { status, rows } = await roster("lead");
    expect(status).toBe(200);
    expect(rows.every((r) => r.contactMasked && r.lineId === null)).toBe(true);
    expect(byName(rows, "สมาชิก ทั่วไป").phone).toBe(MASK_PLAIN);
  });

  it("a leader sees the real contact of the member assigned to them, and only that member", async () => {
    const { rows } = await roster("assigned");
    expect(byName(rows, "สมาชิก มอบหมาย")).toMatchObject({ phone: PHONE_ASSIGNED, lineId: LINE_ASSIGNED, contactMasked: false });
    expect(byName(rows, "สมาชิก ทั่วไป")).toMatchObject({ phone: MASK_PLAIN, lineId: null, contactMasked: true });
  });

  it("never returns assignedLeaderId", async () => {
    for (const role of ["admin", "ministry", "assigned"]) {
      const { rows, raw } = await roster(role);
      expect(rows.every((r) => !("assignedLeaderId" in r))).toBe(true);
      expect(raw).not.toContain("assignedLeaderId");
    }
  });

  it("keeps a missing phone as null for every role", async () => {
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const { eq } = await import("drizzle-orm");
    await client.getDb().update(schema.members).set({ phone: null }).where(eq(schema.members.name, "สมาชิก ทั่วไป"));
    for (const role of ["admin", "ministry", "lead"]) {
      expect(byName((await roster(role)).rows, "สมาชิก ทั่วไป").phone).toBeNull();
    }
    await client.getDb().update(schema.members).set({ phone: PHONE_PLAIN }).where(eq(schema.members.name, "สมาชิก ทั่วไป"));
  });

  it("access rules are unchanged: a leader of another group, a viewer and a member are refused; anonymous is 401", async () => {
    expect((await roster("stranger")).status).toBe(403);
    expect((await roster("viewer")).status).toBe(403);
    expect((await roster("member")).status).toBe(403);
    expect((await roster(null)).status).toBe(401);
    expect((await roster("admin", otherCareId)).status).toBe(200);
  });

  it("keeps the response shape the page depends on", async () => {
    const { rows } = await roster("admin");
    for (const key of ["id", "name", "nickname", "phone", "lineId", "status", "missed", "lastSeen", "contactMasked"]) {
      expect(rows[0], key).toHaveProperty(key);
    }
  });
});
