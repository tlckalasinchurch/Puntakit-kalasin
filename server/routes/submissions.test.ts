import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { eq } from "drizzle-orm";

/**
 * Full-loop Mission Inbox integration test, against a real (embedded)
 * PostgreSQL instance via PGlite — mirrors activities.test.ts /
 * followUps.test.ts. Proves: submit -> review lifecycle -> approve ->
 * publish (promotes into a real, draft Mission Activity) -> audit.
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-submissions-test-"));
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

describe("Mission Inbox API — full loop (real PGlite Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");
  let authLib: typeof import("../lib/auth.js");

  let staffCookie: string;
  let fieldWorkerCookie: string; // group_leader: can submit, cannot review/publish
  let outsiderCookie: string;

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

    const [staff] = await db
      .insert(schema.users)
      .values({ email: "staff@inbox-test.local", passwordHash: "x", name: "Staff", role: "staff" })
      .returning();
    const [fieldWorker] = await db
      .insert(schema.users)
      .values({ email: "field@inbox-test.local", passwordHash: "x", name: "Field Worker", role: "group_leader" })
      .returning();
    const [outsider] = await db
      .insert(schema.users)
      .values({ email: "outsider@inbox-test.local", passwordHash: "x", name: "Outsider", role: "member" })
      .returning();

    staffCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: staff.id, email: staff.email, role: "staff" })}`;
    fieldWorkerCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: fieldWorker.id, email: fieldWorker.email, role: "group_leader" })}`;
    outsiderCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: outsider.id, email: outsider.email, role: "member" })}`;
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const client = await import("../db/client.js");
    await client.closeDatabase();
  });

  describe("401/403", () => {
    it("rejects GET /api/submissions without a session", async () => {
      const res = await fetch(`${baseUrl}/api/submissions`);
      expect(res.status).toBe(401);
    });

    it("rejects create from a role outside CREATE_ROLES", async () => {
      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: outsiderCookie },
        body: JSON.stringify({ rawText: "x" }),
      });
      expect(res.status).toBe(403);
    });
  });

  let submissionId: string;

  describe("Submit -> Persist -> Fetch -> Authorization", () => {
    it("lets a field worker (group_leader) submit raw field input", async () => {
      const res = await fetch(`${baseUrl}/api/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: fieldWorkerCookie },
        body: JSON.stringify({
          rawText: "วันนี้ไปเยี่ยมครอบครัวคุณสมชาย มีคนมาร่วม 5 คน ถ่ายรูปไว้ด้วย",
          rawMediaUrls: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
          submittedByLabel: "LINE: ทีมภาคสนาม",
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { data: any };
      expect(body.data.status).toBe("new");
      expect(body.data.rawMediaUrls).toEqual([
        "https://example.com/photo1.jpg",
        "https://example.com/photo2.jpg",
      ]);
      submissionId = body.data.id;

      const [row] = await db.select().from(schema.missionSubmissions).where(eq(schema.missionSubmissions.id, submissionId));
      expect(row).toBeTruthy();
      expect(row!.source).toBe("manual");
    });

    it("hides the submission from an uninvolved non-reviewer", async () => {
      const res = await fetch(`${baseUrl}/api/submissions/${submissionId}`, { headers: { Cookie: outsiderCookie } });
      expect(res.status).toBe(404);
    });

    it("lets the submitter see their own submission", async () => {
      const res = await fetch(`${baseUrl}/api/submissions/${submissionId}`, { headers: { Cookie: fieldWorkerCookie } });
      expect(res.status).toBe(200);
    });

    it("lets a reviewer (staff) see it even though they didn't submit it", async () => {
      const res = await fetch(`${baseUrl}/api/submissions/${submissionId}`, { headers: { Cookie: staffCookie } });
      expect(res.status).toBe(200);
    });
  });

  describe("Review lifecycle", () => {
    it("rejects a field worker trying to move it to reviewing (not their gate)", async () => {
      const res = await fetch(`${baseUrl}/api/submissions/${submissionId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: fieldWorkerCookie },
        body: JSON.stringify({ status: "reviewing" }),
      });
      expect(res.status).toBe(403);
    });

    it("lets staff move new -> reviewing", async () => {
      const res = await fetch(`${baseUrl}/api/submissions/${submissionId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: staffCookie },
        body: JSON.stringify({ status: "reviewing" }),
      });
      expect(res.status).toBe(200);
    });

    it("rejects an invalid transition (reviewing -> foo)", async () => {
      const res = await fetch(`${baseUrl}/api/submissions/${submissionId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: staffCookie },
        body: JSON.stringify({ status: "not_a_real_status" }),
      });
      expect(res.status).toBe(400);
    });

    it("moves reviewing -> approved", async () => {
      const res = await fetch(`${baseUrl}/api/submissions/${submissionId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: staffCookie },
        body: JSON.stringify({ status: "approved" }),
      });
      expect(res.status).toBe(200);
    });
  });

  let publishedActivityId: string;

  describe("Publish -> promotes into a real Mission Activity", () => {
    it("rejects publish from a field worker (review-gated action)", async () => {
      const res = await fetch(`${baseUrl}/api/submissions/${submissionId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: fieldWorkerCookie },
        body: JSON.stringify({ type: "house_mission", title: "x", occurredAt: new Date().toISOString() }),
      });
      expect(res.status).toBe(403);
    });

    it("publishes as a reviewer, creating a draft Mission Activity with the raw media attached", async () => {
      const res = await fetch(`${baseUrl}/api/submissions/${submissionId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: staffCookie },
        body: JSON.stringify({
          type: "house_mission",
          title: "เยี่ยมบ้านครอบครัวคุณสมชาย",
          story: "มีคนมาร่วม 5 คน",
          occurredAt: new Date().toISOString(),
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { submission: any; activity: any } };
      expect(body.data.activity.status).toBe("draft");
      publishedActivityId = body.data.activity.id;

      const [activityRow] = await db
        .select()
        .from(schema.missionActivities)
        .where(eq(schema.missionActivities.id, publishedActivityId));
      expect(activityRow).toBeTruthy();
      expect(activityRow!.status).toBe("draft");

      const mediaRows = await db
        .select()
        .from(schema.missionActivityMedia)
        .where(eq(schema.missionActivityMedia.activityId, publishedActivityId));
      expect(mediaRows).toHaveLength(2);

      const [submissionRow] = await db
        .select()
        .from(schema.missionSubmissions)
        .where(eq(schema.missionSubmissions.id, submissionId));
      expect(submissionRow!.publishedActivityId).toBe(publishedActivityId);
    });

    it("refuses to publish the same submission twice", async () => {
      const res = await fetch(`${baseUrl}/api/submissions/${submissionId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: staffCookie },
        body: JSON.stringify({ type: "house_mission", title: "x2", occurredAt: new Date().toISOString() }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("Audit trail", () => {
    it("recorded audit rows for create, each status change, and publish", async () => {
      const rows = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.entityId, submissionId));
      const actions = rows.map((r) => r.action);
      expect(actions).toContain("MISSION_SUBMISSION_CREATED");
      expect(actions).toContain("MISSION_SUBMISSION_PUBLISHED");
      expect(actions.filter((a) => a === "MISSION_SUBMISSION_STATUS_CHANGED").length).toBeGreaterThanOrEqual(2);
    });
  });
});
