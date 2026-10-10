import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * `GET /api/home/overview`: counts come only from existing rows and only from
 * the scope the role allows. Synthetic data, real PGlite.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let root: string;

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
});

describe("GET /api/home/overview", () => {
  let server: Server;
  let baseUrl: string;
  const cookies: Record<string, string> = {};
  const g = {} as Record<"b1" | "c1" | "c2" | "c3", string>;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-home-"));
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await (await import("../db/bootstrap.js")).bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    const db = client.getDb();

    const mkUser = async (key: string, role: (typeof schema.USER_ROLES)[number]) => {
      const [u] = await db.insert(schema.users).values({ email: `${key}@hm.local`, passwordHash: "x", name: key, role }).returning();
      cookies[key] = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: u.id, email: u.email, role })}`;
      return u;
    };
    await mkUser("admin", "admin");
    await mkUser("viewer", "viewer");
    await mkUser("member", "member");
    const bodyLead = await mkUser("bodyLead", "group_leader");
    const careA = await mkUser("careA", "group_leader");
    const loner = await mkUser("loner", "group_leader");

    const [b1] = await db.insert(schema.groups).values({ name: "บอดี้ 1", orgLevel: "body", leaderId: bodyLead.id }).returning();
    const [c1] = await db.insert(schema.groups).values({ name: "แคร์ A", orgLevel: "care", parentGroupId: b1.id, leaderId: careA.id }).returning();
    const [c2] = await db.insert(schema.groups).values({ name: "แคร์ B", orgLevel: "care", parentGroupId: b1.id }).returning();
    const [c3] = await db.insert(schema.groups).values({ name: "แคร์ C (อีกบอดี้)", orgLevel: "care" }).returning();
    Object.assign(g, { b1: b1.id, c1: c1.id, c2: c2.id, c3: c3.id });

    const ms = await db.insert(schema.members).values([{ name: "ก" }, { name: "ข" }, { name: "ค" }, { name: "ง" }]).returning();
    await db.insert(schema.groupMembers).values([
      { groupId: c1.id, memberId: ms[0].id },
      { groupId: c1.id, memberId: ms[1].id },
      { groupId: c2.id, memberId: ms[2].id },
      { groupId: c3.id, memberId: ms[3].id },
    ]);
    // An unpaid ordinary term and an overdue trial, in different groups.
    await db.insert(schema.membershipTerms).values([
      { memberId: ms[0].id, type: "ordinary", startsOn: "2026-06-01", endsOn: "2027-06-01", feeBaht: 100, paymentStatus: "unpaid" },
      { memberId: ms[3].id, type: "extraordinary", startsOn: "2025-01-01", endsOn: "2026-01-01" },
    ]);
    const now = new Date();
    const [a1] = await db
      .insert(schema.missionActivities)
      .values({ type: "ministry_update", title: "ภาพ A", occurredAt: now, groupId: c1.id, createdById: careA.id })
      .returning();
    const [a3] = await db.insert(schema.missionActivities).values({ type: "other", title: "ภาพ C", occurredAt: now, groupId: c3.id }).returning();
    await db.insert(schema.missionActivityMedia).values([
      { activityId: a1.id, url: "https://example.com/a.jpg", kind: "image" },
      { activityId: a3.id, url: "https://example.com/c.jpg", kind: "image" },
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

  const overview = async (role: string | null) => {
    const res = await fetch(`${baseUrl}/api/home/overview`, { headers: role ? { Cookie: cookies[role] } : {} });
    return { status: res.status, data: ((await res.json()) as { data?: any }).data };
  };

  it("requires a signed-in admin-shell role (401 / 403)", async () => {
    expect((await overview(null)).status).toBe(401);
    expect((await overview("member")).status).toBe(403);
  });

  it("a care leader sees only their own group's numbers and photos", async () => {
    const { status, data } = await overview("careA");
    expect(status).toBe(200);
    expect(data.scopeLabel).toBe("พันธกิจของฉัน");
    expect(data.counts).toMatchObject({ groups: 1, members: 2, activitiesLast30Days: 1 });
    expect(data.recentPhotos.map((p: { title: string }) => p.title)).toEqual(["ภาพ A"]);
    expect(data.photoGroups).toEqual([{ id: g.c1, name: "แคร์ A" }]);
    expect(data.membership).toMatchObject({ attention: 1, unpaid: 1, trialReview: 0 });
    expect(data.canRecordPayment).toBe(false);
  });

  it("a body leader counts the care groups under their body (not another body's)", async () => {
    const { data } = await overview("bodyLead");
    // body itself + its two care groups
    expect(data.counts.groups).toBe(3);
    expect(data.counts.members).toBe(3);
    expect(data.membership.unpaid).toBe(1);
    expect(data.membership.trialReview).toBe(0); // the overdue trial belongs to the other body
    // Photos can be posted only for groups the leader leads directly — the body, not its care groups.
    expect(data.photoGroups).toEqual([{ id: g.b1, name: "บอดี้ 1" }]);
  });

  it("a body leader's photo list only holds what they can open: published photos of the care groups below, not drafts", async () => {
    const before = await overview("bodyLead");
    expect(before.data.recentPhotos).toEqual([]); // the seeded activity is a draft of a care group they do not lead directly
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const { eq } = await import("drizzle-orm");
    await client.getDb().update(schema.missionActivities).set({ status: "published" }).where(eq(schema.missionActivities.groupId, g.c1));
    const after = await overview("bodyLead");
    expect(after.data.recentPhotos.map((p: { title: string }) => p.title)).toEqual(["ภาพ A"]);
    expect(after.data.counts.activitiesLast30Days).toBe(1);
    await client.getDb().update(schema.missionActivities).set({ status: "draft" }).where(eq(schema.missionActivities.groupId, g.c1));
  });

  it("a group leader who leads nothing gets zeros, not the whole church", async () => {
    const { data } = await overview("loner");
    expect(data.counts).toMatchObject({ groups: 0, members: 0, activitiesLast30Days: 0 });
    expect(data.recentPhotos).toEqual([]);
    expect(data.photoGroups).toEqual([]);
  });

  it("office roles see the whole church and may record payments; viewer sees no membership data", async () => {
    const admin = await overview("admin");
    expect(admin.data.scopeIsWholeChurch).toBe(true);
    expect(admin.data.counts).toMatchObject({ groups: 3, members: 4, activitiesLast30Days: 2 });
    expect(admin.data.membership).toMatchObject({ unpaid: 1, trialReview: 1 });
    expect(admin.data.canRecordPayment).toBe(true);
    const viewer = await overview("viewer");
    expect(viewer.status).toBe(200);
    expect(viewer.data.membership).toBeNull();
    // Both seeded activities are drafts: a viewer must not see drafts (same rule as /api/activities).
    expect(viewer.data.recentPhotos).toEqual([]);
    expect(viewer.data.counts.activitiesLast30Days).toBe(0);
  });
});
