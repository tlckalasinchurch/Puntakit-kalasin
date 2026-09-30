import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { eq } from "drizzle-orm";

/**
 * Full-loop Mission Activity integration test, run against a real (embedded)
 * PostgreSQL instance via PGlite — not a mock. Proves the Phase 1 definition
 * of done end to end:
 *
 *   Create -> Persist (PostgreSQL) -> Fetch -> Authorization
 *   -> Relate Group -> Relate Person -> Audit -> (this test)
 *
 * Follows the same isolated-env-and-modules pattern as
 * server/db/bootstrap.test.ts, since this is the first route test file that
 * needs a migrated schema and real writes rather than just 401/404 checks.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;

const originalEnv = { ...process.env };
const tempDirs: string[] = [];

function setEnv(values: Partial<Record<(typeof MANAGED_KEYS)[number], string | undefined>>): void {
  for (const key of MANAGED_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) process.env[key] = value;
  }
}

function makeTempDataDir(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-activities-test-"));
  tempDirs.push(root);
  return path.join(root, "nested", ".db_data");
}

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("Mission Activity API — full loop (real PGlite Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");
  let authLib: typeof import("../lib/auth.js");

  let superAdminCookie: string;
  let groupLeaderCookie: string;
  let outsiderCookie: string;
  let leaderOfGroupCookie: string;

  let groupId: string;
  let leaderGroupId: string;
  let memberId: string;

  beforeAll(async () => {
    setEnv({
      NODE_ENV: "development",
      DATABASE_DRIVER: "pglite",
      PGLITE_DATA_DIR: makeTempDataDir(),
    });

    const client = await import("../db/client.js");
    const bootstrap = await import("../db/bootstrap.js");
    schema = await import("../../shared/schema.js");
    authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");

    await bootstrap.bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    db = client.getDb();

    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (typeof address === "object" && address !== null) {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });

    // Seed users covering the roles exercised below.
    const [superAdmin] = await db
      .insert(schema.users)
      .values({ email: "super@test.local", passwordHash: "x", name: "Super Admin", role: "super_admin" })
      .returning();
    const [groupLeaderUser] = await db
      .insert(schema.users)
      .values({ email: "leader@test.local", passwordHash: "x", name: "Leaderless Group Leader", role: "group_leader" })
      .returning();
    const [outsiderUser] = await db
      .insert(schema.users)
      .values({ email: "member@test.local", passwordHash: "x", name: "Regular Member", role: "member" })
      .returning();
    const [leaderOfGroupUser] = await db
      .insert(schema.users)
      .values({ email: "leader2@test.local", passwordHash: "x", name: "Real Group Leader", role: "group_leader" })
      .returning();

    superAdminCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: superAdmin.id, email: superAdmin.email, role: "super_admin" })}`;
    groupLeaderCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: groupLeaderUser.id, email: groupLeaderUser.email, role: "group_leader" })}`;
    outsiderCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: outsiderUser.id, email: outsiderUser.email, role: "member" })}`;
    leaderOfGroupCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: leaderOfGroupUser.id, email: leaderOfGroupUser.email, role: "group_leader" })}`;

    // A group the "leaderless" group_leader does NOT lead.
    const [group] = await db
      .insert(schema.groups)
      .values({ name: "กลุ่มทดสอบ A", createdById: superAdmin.id })
      .returning();
    groupId = group.id;

    // A group the second group_leader DOES lead.
    const [leaderGroup] = await db
      .insert(schema.groups)
      .values({ name: "กลุ่มทดสอบ B", leaderId: leaderOfGroupUser.id, createdById: superAdmin.id })
      .returning();
    leaderGroupId = leaderGroup.id;

    const [member] = await db.insert(schema.members).values({ name: "สมาชิกทดสอบ" }).returning();
    memberId = member.id;
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const client = await import("../db/client.js");
    await client.closeDatabase();
  });

  describe("401 Unauthorized", () => {
    it("rejects GET /api/activities without a session", async () => {
      const res = await fetch(`${baseUrl}/api/activities`);
      expect(res.status).toBe(401);
    });

    it("rejects POST /api/activities without a session", async () => {
      const res = await fetch(`${baseUrl}/api/activities`, { method: "POST" });
      expect(res.status).toBe(401);
    });
  });

  describe("403 role gating", () => {
    it("rejects create from a role not in CREATE_ROLES", async () => {
      const res = await fetch(`${baseUrl}/api/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: outsiderCookie },
        body: JSON.stringify({ type: "prayer", title: "x", occurredAt: new Date().toISOString() }),
      });
      expect(res.status).toBe(403);
    });
  });

  let activityId: string;

  describe("Create -> Persist -> Fetch -> Relate Group -> Relate Person", () => {
    it("creates a draft activity linked to a group and a participant member", async () => {
      const res = await fetch(`${baseUrl}/api/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: groupLeaderCookie },
        body: JSON.stringify({
          type: "house_mission",
          title: "เยี่ยมบ้านครอบครัวทดสอบ",
          story: "เรื่องราวการเยี่ยมบ้าน",
          occurredAt: new Date().toISOString(),
          groupId,
          participantMemberIds: [memberId],
          media: [{ url: "https://example.com/photo.jpg", kind: "image" }],
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { success: boolean; data: any };
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("draft");
      expect(body.data.groupId).toBe(groupId);
      expect(body.data.groupName).toBe("กลุ่มทดสอบ A");
      expect(body.data.participants).toHaveLength(1);
      expect(body.data.participants[0].memberId).toBe(memberId);
      expect(body.data.media).toHaveLength(1);
      activityId = body.data.id;

      // Verify it is really in PostgreSQL, not just in the HTTP response.
      const [row] = await db.select().from(schema.missionActivities).where(eq(schema.missionActivities.id, activityId));
      expect(row).toBeTruthy();
      expect(row!.title).toBe("เยี่ยมบ้านครอบครัวทดสอบ");
    });

    it("lets the creator fetch their own draft", async () => {
      const res = await fetch(`${baseUrl}/api/activities/${activityId}`, {
        headers: { Cookie: groupLeaderCookie },
      });
      expect(res.status).toBe(200);
    });

    it("hides an unpublished activity from an unrelated non-privileged user", async () => {
      const res = await fetch(`${baseUrl}/api/activities/${activityId}`, {
        headers: { Cookie: outsiderCookie },
      });
      expect(res.status).toBe(404);
    });

    it("lets a privileged role see it regardless of status", async () => {
      const res = await fetch(`${baseUrl}/api/activities/${activityId}`, {
        headers: { Cookie: superAdminCookie },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("Lifecycle transitions", () => {
    it("rejects an invalid transition (draft -> archived is valid, draft -> foo is not a real status)", async () => {
      const res = await fetch(`${baseUrl}/api/activities/${activityId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: groupLeaderCookie },
        body: JSON.stringify({ status: "not_a_real_status" }),
      });
      expect(res.status).toBe(400);
    });

    it("lets the creator move draft -> pending_review", async () => {
      const res = await fetch(`${baseUrl}/api/activities/${activityId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: groupLeaderCookie },
        body: JSON.stringify({ status: "pending_review" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { status: string } };
      expect(body.data.status).toBe("pending_review");
    });

    it("does NOT let the creator (a group_leader who does not lead this group) self-publish", async () => {
      const res = await fetch(`${baseUrl}/api/activities/${activityId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: groupLeaderCookie },
        body: JSON.stringify({ status: "published" }),
      });
      expect(res.status).toBe(403);
    });

    it("lets a privileged role publish it", async () => {
      const res = await fetch(`${baseUrl}/api/activities/${activityId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: superAdminCookie },
        body: JSON.stringify({ status: "published" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { status: string } };
      expect(body.data.status).toBe("published");
    });

    it("now shows the published activity to any authenticated user", async () => {
      const res = await fetch(`${baseUrl}/api/activities/${activityId}`, {
        headers: { Cookie: outsiderCookie },
      });
      expect(res.status).toBe(200);
    });

    it("rejects publishing straight back to pending_review (not an allowed transition from published)", async () => {
      const res = await fetch(`${baseUrl}/api/activities/${activityId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: superAdminCookie },
        body: JSON.stringify({ status: "pending_review" }),
      });
      expect(res.status).toBe(400);
    });

    it("lets a group_leader who genuinely leads the activity's group self-publish", async () => {
      const createRes = await fetch(`${baseUrl}/api/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: leaderOfGroupCookie },
        body: JSON.stringify({
          type: "bible_study",
          title: "ศึกษาพระคัมภีร์กลุ่ม B",
          occurredAt: new Date().toISOString(),
          groupId: leaderGroupId,
        }),
      });
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { data: { id: string } };

      const publishRes = await fetch(`${baseUrl}/api/activities/${created.data.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: leaderOfGroupCookie },
        body: JSON.stringify({ status: "published" }),
      });
      expect(publishRes.status).toBe(200);
    });
  });

  describe("Audit trail", () => {
    it("recorded an audit log row for creation and for every status change", async () => {
      const rows = await db
        .select()
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.entityId, activityId));
      const actions = rows.map((r) => r.action);
      expect(actions).toContain("MISSION_ACTIVITY_CREATED");
      expect(actions.filter((a) => a === "MISSION_ACTIVITY_STATUS_CHANGED").length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Soft delete", () => {
    it("rejects delete from a role outside DELETE_ROLES", async () => {
      const res = await fetch(`${baseUrl}/api/activities/${activityId}`, {
        method: "DELETE",
        headers: { Cookie: groupLeaderCookie },
      });
      expect(res.status).toBe(403);
    });

    it("soft-deletes as an admin-level role and then hides it from GET", async () => {
      const del = await fetch(`${baseUrl}/api/activities/${activityId}`, {
        method: "DELETE",
        headers: { Cookie: superAdminCookie },
      });
      expect(del.status).toBe(200);

      const get = await fetch(`${baseUrl}/api/activities/${activityId}`, {
        headers: { Cookie: superAdminCookie },
      });
      expect(get.status).toBe(404);

      const [row] = await db.select().from(schema.missionActivities).where(eq(schema.missionActivities.id, activityId));
      expect(row!.deletedAt).not.toBeNull();
    });
  });
});
