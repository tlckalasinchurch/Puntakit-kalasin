import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Role gates and contact privacy on /api/attendance (real PGlite Postgres,
 * synthetic data). Before this, the router needed only `requireAuth`: a
 * `member` could write check-ins and download the CSV with phone numbers.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let root: string;

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
});

describe("/api/attendance access", () => {
  let server: Server;
  let baseUrl: string;
  let memberId: string;
  let ownGroupId: string;
  const cookies: Record<string, string> = {};

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-attaccess-"));
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await (await import("../db/bootstrap.js")).bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    const db = client.getDb();
    const [m] = await db.insert(schema.members).values({ name: "สมชาย ทดสอบ", phone: "081-234-5678" }).returning();
    memberId = m.id;
    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        const a = server.address();
        if (typeof a === "object" && a !== null) baseUrl = `http://127.0.0.1:${a.port}`;
        resolve();
      });
    });
    for (const role of ["admin", "staff", "group_leader", "viewer", "member"] as const) {
      const [u] = await db.insert(schema.users).values({ email: `${role}@att.local`, passwordHash: "x", name: role, role }).returning();
      cookies[role] = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: u.id, email: u.email, role })}`;
      if (role === "group_leader") {
        const [g] = await db.insert(schema.groups).values({ name: "กลุ่มของผู้นำทดสอบ", leaderId: u.id }).returning();
        ownGroupId = g.id;
      }
    }
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await (await import("../db/client.js")).closeDatabase();
  });

  const call = (role: string, method: string, url: string, body?: unknown) =>
    fetch(`${baseUrl}/api/attendance${url}`, {
      method,
      headers: { Cookie: cookies[role], "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const checkIn = () => ({ memberId, serviceType: "sunday_service", status: "present", date: "2026-10-04" });

  it("answers 401 to an anonymous caller on every attendance route", async () => {
    for (const [method, url] of [["GET", "/"], ["GET", "/export"], ["GET", "/absentees"], ["GET", "/summary"], ["POST", "/check-in"], ["POST", "/bulk"], ["POST", "/qr-scan"]] as const) {
      const res = await fetch(`${baseUrl}/api/attendance${url}`, { method, headers: { "Content-Type": "application/json" }, body: method === "POST" ? "{}" : undefined });
      expect(res.status, `${method} ${url}`).toBe(401);
    }
  });

  it("lets privileged roles read, write and export", async () => {
    for (const role of ["admin", "staff"]) {
      expect((await call(role, "GET", "/")).status).toBe(200);
      expect((await call(role, "GET", "/summary")).status).toBe(200);
      // 201 for a new record, 200 when the same member and day are marked again.
      expect([200, 201]).toContain((await call(role, "POST", "/check-in", checkIn())).status);
      expect((await call(role, "GET", "/export")).status).toBe(200);
    }
  });

  it("blocks a member-role account from every attendance route", async () => {
    expect((await call("member", "GET", "/")).status).toBe(403);
    expect((await call("member", "GET", "/export")).status).toBe(403);
    expect((await call("member", "GET", "/absentees")).status).toBe(403);
    expect((await call("member", "GET", "/summary")).status).toBe(403);
    expect((await call("member", "POST", "/check-in", checkIn())).status).toBe(403);
    expect((await call("member", "POST", "/bulk", { date: "2026-10-04", serviceType: "care_group", records: [{ memberId, status: "present" }] })).status).toBe(403);
    expect((await call("member", "POST", "/qr-scan", { token: memberId })).status).toBe(403);
  });

  it("lets a viewer read but not write", async () => {
    expect((await call("viewer", "GET", "/")).status).toBe(200);
    expect((await call("viewer", "POST", "/check-in", checkIn())).status).toBe(403);
  });

  it("lets a group_leader write a check-in for a group it leads, and only with a group id", async () => {
    expect([200, 201]).toContain((await call("group_leader", "POST", "/check-in", { ...checkIn(), serviceType: "care_group", groupId: ownGroupId })).status);
    expect((await call("group_leader", "POST", "/check-in", checkIn())).status).toBe(403);
  });

  it("restricts the CSV export (phone numbers) to contact roles", async () => {
    expect((await call("group_leader", "GET", "/export")).status).toBe(403);
    expect((await call("viewer", "GET", "/export")).status).toBe(403);
    const res = await call("staff", "GET", "/export");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("081-234-5678");
  });

  it("masks the phone in the list for roles without contact access", async () => {
    type Rows = { data: Array<{ memberPhone: string | null }> };
    const staff = (await (await call("staff", "GET", "/")).json()) as Rows;
    expect(staff.data[0]?.memberPhone).toBe("081-234-5678");
    const viewer = (await (await call("viewer", "GET", "/")).json()) as Rows;
    expect(viewer.data[0]?.memberPhone).toBeNull();
    const leader = (await (await call("group_leader", "GET", "/")).json()) as Rows;
    expect(leader.data.length).toBeGreaterThan(0);
    expect(leader.data[0]?.memberPhone).toBeNull();
  });
});
