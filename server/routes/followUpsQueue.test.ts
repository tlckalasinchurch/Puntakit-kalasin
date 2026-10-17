import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Follow-up queue (GET /api/follow-ups) on real PGlite: open work sorts first by due date with
 * finished/cancelled rows last, and the subject's phone obeys the members contact policy.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let root: string;
afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
});

interface Row {
  title: string;
  subjectMemberPhone: string | null;
  subjectMemberContactMasked: boolean;
  subjectGroupOrgLevel: "body" | "care" | null;
  subjectMemberName: string | null;
}

describe("follow-up queue: ordering and subject contact", () => {
  let server: Server;
  let baseUrl: string;
  const cookie: Record<string, string> = {};

  const list = async (who: string, qs = ""): Promise<Row[]> => {
    const res = await fetch(`${baseUrl}/api/follow-ups?limit=100${qs}`, { headers: { Cookie: cookie[who] } });
    expect(res.status).toBe(200);
    return ((await res.json()) as { data: Row[] }).data;
  };

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-fuqueue-"));
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await (await import("../db/bootstrap.js")).bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    const db = client.getDb();

    const uid: Record<string, string> = {};
    const mkUser = async (key: string, role: "admin" | "staff" | "ministry_leader" | "group_leader") => {
      const [u] = await db.insert(schema.users).values({ email: `${key}@queue.local`, passwordHash: "x", name: key, role }).returning();
      uid[key] = u.id;
      cookie[key] = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: u.id, email: u.email, role })}`;
    };
    await mkUser("admin", "admin");
    await mkUser("staff", "staff");
    await mkUser("ministry", "ministry_leader");
    await mkUser("assignedLeader", "group_leader");
    await mkUser("otherLeader", "group_leader");

    const [body] = await db.insert(schema.groups).values({ name: "บอดี้คิว", orgLevel: "body" }).returning();
    const [care] = await db.insert(schema.groups).values({ name: "แคร์คิว", orgLevel: "care", parentGroupId: body.id }).returning();
    const [withPhone] = await db
      .insert(schema.members)
      .values({ name: "มีเบอร์", phone: "0811111111", assignedLeaderId: uid.assignedLeader })
      .returning();
    const [noPhone] = await db.insert(schema.members).values({ name: "ไม่มีเบอร์" }).returning();

    const day = (d: number) => new Date(Date.now() + d * 864e5);
    const mk = (title: string, status: "open" | "in_progress" | "completed" | "cancelled", dueAt: Date | null, updatedAt: Date, extra: Record<string, unknown> = {}) =>
      db.insert(schema.followUps).values({ title, status, dueAt, updatedAt, ownerId: uid.admin, createdById: uid.admin, subjectGroupId: care.id, ...extra });

    // Inserted in a scrambled order on purpose.
    await mk("closed-newer", "completed", day(-10), day(-1));
    await mk("open-future", "open", day(5), day(-3));
    await mk("open-undated", "open", null, day(-3));
    await mk("closed-older", "cancelled", null, day(-2));
    await mk("progress-soon", "in_progress", day(1), day(-3));
    await mk("open-overdue", "open", day(-3), day(-3));
    // Subject-contact rows, due later than everything above so they sort together.
    await mk("call-phone", "open", day(20), day(-3), { subjectMemberId: withPhone.id, subjectGroupId: null, ownerId: uid.assignedLeader });
    await mk("call-phone-other", "open", day(21), day(-3), { subjectMemberId: withPhone.id, subjectGroupId: null, ownerId: uid.otherLeader });
    await mk("call-nophone", "open", day(22), day(-3), { subjectMemberId: noPhone.id, subjectGroupId: null });
    await mk("body-subject", "open", day(23), day(-3), { subjectGroupId: body.id });

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

  it("lists open and in-progress work first by due date (undated last), then closed rows newest-changed first", async () => {
    const titles = (await list("admin")).map((r) => r.title);
    expect(titles).toEqual([
      "open-overdue",
      "progress-soon",
      "open-future",
      "call-phone",
      "call-phone-other",
      "call-nophone",
      "body-subject",
      "open-undated",
      "closed-newer",
      "closed-older",
    ]);
  });

  it("the order holds when a status filter narrows the queue", async () => {
    const closed = (await list("admin", "&status=completed")).map((r) => r.title);
    expect(closed).toEqual(["closed-newer"]);
  });

  it("returns the subject group's org level so the page can tell care groups from bodies", async () => {
    const rows = await list("admin");
    expect(rows.find((r) => r.title === "open-future")?.subjectGroupOrgLevel).toBe("care");
    expect(rows.find((r) => r.title === "body-subject")?.subjectGroupOrgLevel).toBe("body");
  });

  it("admin and staff get the real phone; no 'masked' flag", async () => {
    for (const who of ["admin", "staff"]) {
      const row = (await list(who)).find((r) => r.title === "call-phone")!;
      expect(row.subjectMemberPhone).toBe("0811111111");
      expect(row.subjectMemberContactMasked).toBe(false);
    }
  });

  it("ministry_leader is masked like /api/members: no number, flagged as masked", async () => {
    const row = (await list("ministry")).find((r) => r.title === "call-phone")!;
    expect(row.subjectMemberPhone).toBeNull();
    expect(row.subjectMemberContactMasked).toBe(true);
  });

  it("only the member's assigned leader among group leaders sees the number", async () => {
    const own = (await list("assignedLeader")).find((r) => r.title === "call-phone")!;
    expect(own.subjectMemberPhone).toBe("0811111111");
    expect(own.subjectMemberContactMasked).toBe(false);

    const other = (await list("otherLeader")).find((r) => r.title === "call-phone-other")!;
    expect(other.subjectMemberPhone).toBeNull();
    expect(other.subjectMemberContactMasked).toBe(true);
  });

  it("a member without a phone is neither callable nor 'masked', and assignedLeaderId never leaks", async () => {
    const rows = await list("admin");
    const row = rows.find((r) => r.title === "call-nophone")!;
    expect(row.subjectMemberPhone).toBeNull();
    expect(row.subjectMemberContactMasked).toBe(false);
    for (const r of rows) expect(r).not.toHaveProperty("subjectMemberAssignedLeaderId");
  });
});
