import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { eq } from "drizzle-orm";

/**
 * Full-loop Follow-up integration test, against a real (embedded)
 * PostgreSQL instance via PGlite — mirrors server/routes/activities.test.ts.
 * Proves: create -> persist -> fetch -> authorization -> relate person ->
 * relate group -> relate activity -> lifecycle transition -> audit.
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-followups-test-"));
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

describe("Follow-up API — full loop (real PGlite Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");
  let authLib: typeof import("../lib/auth.js");

  let adminCookie: string;
  let staffCookie: string;
  let outsiderCookie: string;

  let groupId: string;
  let memberId: string;
  let activityId: string;
  let staffUserId: string;

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

    const [admin] = await db
      .insert(schema.users)
      .values({ email: "admin@followup-test.local", passwordHash: "x", name: "Admin", role: "admin" })
      .returning();
    const [staff] = await db
      .insert(schema.users)
      .values({ email: "staff@followup-test.local", passwordHash: "x", name: "Staff", role: "staff" })
      .returning();
    const [outsider] = await db
      .insert(schema.users)
      .values({ email: "member@followup-test.local", passwordHash: "x", name: "Member", role: "member" })
      .returning();
    staffUserId = staff.id;

    adminCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: admin.id, email: admin.email, role: "admin" })}`;
    staffCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: staff.id, email: staff.email, role: "staff" })}`;
    outsiderCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: outsider.id, email: outsider.email, role: "member" })}`;

    const [group] = await db.insert(schema.groups).values({ name: "กลุ่มทดสอบติดตาม", createdById: admin.id }).returning();
    groupId = group.id;
    const [member] = await db.insert(schema.members).values({ name: "สมาชิกทดสอบติดตาม" }).returning();
    memberId = member.id;
    const [activity] = await db
      .insert(schema.missionActivities)
      .values({
        type: "pastoral_visit",
        title: "เยี่ยมเยียนอภิบาลทดสอบ",
        occurredAt: new Date(),
        groupId,
        createdById: admin.id,
      })
      .returning();
    activityId = activity.id;
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const client = await import("../db/client.js");
    await client.closeDatabase();
  });

  describe("401/403", () => {
    it("rejects GET /api/follow-ups without a session", async () => {
      const res = await fetch(`${baseUrl}/api/follow-ups`);
      expect(res.status).toBe(401);
    });

    it("rejects create from a role outside CREATE_ROLES", async () => {
      const res = await fetch(`${baseUrl}/api/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: outsiderCookie },
        body: JSON.stringify({ title: "x", subjectMemberId: memberId }),
      });
      expect(res.status).toBe(403);
    });

    it("rejects a follow-up with neither a subject person nor a subject group", async () => {
      const res = await fetch(`${baseUrl}/api/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: staffCookie },
        body: JSON.stringify({ title: "ไม่มีเป้าหมาย" }),
      });
      expect(res.status).toBe(400);
    });
  });

  let followUpId: string;

  describe("Create -> Persist -> Fetch -> Relate person/group/activity", () => {
    it("creates a follow-up linked to a person, a group, and the activity that raised it", async () => {
      const res = await fetch(`${baseUrl}/api/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: staffCookie },
        body: JSON.stringify({
          title: "ติดตามหลังเยี่ยมบ้าน",
          note: "โทรติดตามภายในสัปดาห์นี้",
          subjectMemberId: memberId,
          subjectGroupId: groupId,
          activityId,
          dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { data: any };
      expect(body.data.status).toBe("open");
      expect(body.data.subjectMemberName).toBe("สมาชิกทดสอบติดตาม");
      expect(body.data.subjectGroupName).toBe("กลุ่มทดสอบติดตาม");
      expect(body.data.activityTitle).toBe("เยี่ยมเยียนอภิบาลทดสอบ");
      expect(body.data.ownerId).toBe(staffUserId);
      followUpId = body.data.id;

      const [row] = await db.select().from(schema.followUps).where(eq(schema.followUps.id, followUpId));
      expect(row).toBeTruthy();
      expect(row!.title).toBe("ติดตามหลังเยี่ยมบ้าน");
    });

    it("hides the follow-up from an uninvolved non-privileged user", async () => {
      const res = await fetch(`${baseUrl}/api/follow-ups/${followUpId}`, { headers: { Cookie: outsiderCookie } });
      expect(res.status).toBe(404);
    });

    it("lets a privileged role (not the owner) see it", async () => {
      const res = await fetch(`${baseUrl}/api/follow-ups/${followUpId}`, { headers: { Cookie: adminCookie } });
      expect(res.status).toBe(200);
    });

    it("lets the owner see it", async () => {
      const res = await fetch(`${baseUrl}/api/follow-ups/${followUpId}`, { headers: { Cookie: staffCookie } });
      expect(res.status).toBe(200);
    });
  });

  describe("Lifecycle transitions", () => {
    it("rejects an invalid transition (open -> foo)", async () => {
      const res = await fetch(`${baseUrl}/api/follow-ups/${followUpId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: staffCookie },
        body: JSON.stringify({ status: "not_a_real_status" }),
      });
      expect(res.status).toBe(400);
    });

    it("moves open -> in_progress", async () => {
      const res = await fetch(`${baseUrl}/api/follow-ups/${followUpId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: staffCookie },
        body: JSON.stringify({ status: "in_progress" }),
      });
      expect(res.status).toBe(200);
    });

    it("moves in_progress -> completed and stamps completedAt", async () => {
      const res = await fetch(`${baseUrl}/api/follow-ups/${followUpId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: staffCookie },
        body: JSON.stringify({ status: "completed" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { completedAt: string | null } };
      expect(body.data.completedAt).not.toBeNull();
    });

    it("rejects completed -> in_progress (not a listed transition)", async () => {
      const res = await fetch(`${baseUrl}/api/follow-ups/${followUpId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: staffCookie },
        body: JSON.stringify({ status: "in_progress" }),
      });
      expect(res.status).toBe(400);
    });

    it("allows reopening completed -> open, clearing completedAt", async () => {
      const res = await fetch(`${baseUrl}/api/follow-ups/${followUpId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: staffCookie },
        body: JSON.stringify({ status: "open" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { completedAt: string | null } };
      expect(body.data.completedAt).toBeNull();
    });
  });

  describe("Audit trail", () => {
    it("recorded audit rows for creation and each status change", async () => {
      const rows = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.entityId, followUpId));
      const actions = rows.map((r) => r.action);
      expect(actions).toContain("FOLLOW_UP_CREATED");
      expect(actions.filter((a) => a === "FOLLOW_UP_STATUS_CHANGED").length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Overdue filter", () => {
    it("finds an overdue open follow-up via the overdue=true filter", async () => {
      const [overdue] = await db
        .insert(schema.followUps)
        .values({
          title: "เลยกำหนดแล้ว",
          subjectMemberId: memberId,
          ownerId: staffUserId,
          createdById: staffUserId,
          dueAt: new Date(Date.now() - 86_400_000),
        })
        .returning();

      const res = await fetch(`${baseUrl}/api/follow-ups?overdue=true`, { headers: { Cookie: staffCookie } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { id: string }[] };
      expect(body.data.some((f) => f.id === overdue.id)).toBe(true);
    });
  });
});
