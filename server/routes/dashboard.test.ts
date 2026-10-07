import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Operations dashboard integration test, against a real (embedded)
 * PostgreSQL instance via PGlite. Proves the aggregates are real: a
 * pending submission, an overdue follow-up, and an inactive group all
 * show up because the underlying rows exist — not because of fabricated
 * numbers.
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-operations-test-"));
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

describe("Operations dashboard API — real aggregates (real PGlite Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");
  let authLib: typeof import("../lib/auth.js");

  let adminCookie: string;
  let memberCookie: string;

  let inactiveGroupId: string;
  let activeGroupId: string;

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
      .values({ email: "admin@ops-test.local", passwordHash: "x", name: "Admin", role: "admin" })
      .returning();
    const [member] = await db
      .insert(schema.users)
      .values({ email: "member@ops-test.local", passwordHash: "x", name: "Member", role: "member" })
      .returning();

    adminCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: admin.id, email: admin.email, role: "admin" })}`;
    memberCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: member.id, email: member.email, role: "member" })}`;

    // Pending submission
    await db.insert(schema.missionSubmissions).values({ rawText: "ทดสอบ operations", createdById: admin.id });

    // Two groups: one with recent activity, one without.
    const [inactiveGroup] = await db.insert(schema.groups).values({ name: "กลุ่มเงียบ (ทดสอบ)", createdById: admin.id }).returning();
    inactiveGroupId = inactiveGroup.id;
    const [activeGroup] = await db.insert(schema.groups).values({ name: "กลุ่มมีชีวิต (ทดสอบ)", createdById: admin.id }).returning();
    activeGroupId = activeGroup.id;

    await db.insert(schema.missionActivities).values({
      type: "bible_study",
      title: "กิจกรรมล่าสุดของกลุ่มมีชีวิต",
      occurredAt: new Date(),
      groupId: activeGroupId,
      createdById: admin.id,
    });

    // Overdue follow-up
    await db.insert(schema.followUps).values({
      title: "ติดตามเลยกำหนด (ทดสอบ)",
      subjectGroupId: inactiveGroupId,
      ownerId: admin.id,
      createdById: admin.id,
      dueAt: new Date(Date.now() - 86_400_000),
    });
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const client = await import("../db/client.js");
    await client.closeDatabase();
  });

  it("rejects GET /api/dashboard/operations without a session", async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/operations`);
    expect(res.status).toBe(401);
  });

  it("rejects a non-privileged role", async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/operations`, { headers: { Cookie: memberCookie } });
    expect(res.status).toBe(403);
  });

  it("returns real aggregates for a privileged role", async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/operations`, { headers: { Cookie: adminCookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: any };

    expect(body.data.pendingSubmissionsCount).toBeGreaterThanOrEqual(1);
    expect(body.data.pendingSubmissions.some((s: any) => s.rawText === "ทดสอบ operations")).toBe(true);

    expect(body.data.overdueFollowUpsCount).toBeGreaterThanOrEqual(1);
    expect(body.data.overdueFollowUps.some((f: any) => f.title === "ติดตามเลยกำหนด (ทดสอบ)")).toBe(true);

    const inactiveNames = body.data.inactiveGroups.map((g: any) => g.name);
    expect(inactiveNames).toContain("กลุ่มเงียบ (ทดสอบ)");
    expect(inactiveNames).not.toContain("กลุ่มมีชีวิต (ทดสอบ)");

    expect(body.data.recentActivity.some((a: any) => a.title === "กิจกรรมล่าสุดของกลุ่มมีชีวิต")).toBe(true);
  });
});
