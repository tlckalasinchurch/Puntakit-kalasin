import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Membership lifecycle API against a real PGlite database with synthetic data.
 *
 * Hierarchy: body B1 (led by bodyLead) → care C1 (careA) and care C2 (careB);
 * body B2 → care C3 (careC). One member in each care group, one in none.
 * "หัวหน้าแคร์ / หัวหน้าบอดี้" are `group_leader` users leading a care / body
 * group — no new role exists.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let root: string;

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
});

describe("membership lifecycle API", () => {
  let server: Server;
  let baseUrl: string;
  const cookies: Record<string, string> = {};
  const ids = {} as Record<"m1" | "m2" | "m3" | "m4", string>;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-membership-"));
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await (await import("../db/bootstrap.js")).bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    const db = client.getDb();

    const mkUser = async (key: string, role: (typeof schema.USER_ROLES)[number]) => {
      const [u] = await db.insert(schema.users).values({ email: `${key}@ms.local`, passwordHash: "x", name: key, role }).returning();
      cookies[key] = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: u.id, email: u.email, role })}`;
      return u;
    };
    await mkUser("admin", "admin");
    await mkUser("staff", "staff");
    await mkUser("viewer", "viewer");
    await mkUser("member", "member");
    await mkUser("ministry", "ministry_leader");
    const bodyLead = await mkUser("bodyLead", "group_leader");
    const careA = await mkUser("careA", "group_leader");
    const careB = await mkUser("careB", "group_leader");
    const careC = await mkUser("careC", "group_leader");

    const [b1] = await db.insert(schema.groups).values({ name: "บอดี้ 1", orgLevel: "body", leaderId: bodyLead.id }).returning();
    const [b2] = await db.insert(schema.groups).values({ name: "บอดี้ 2", orgLevel: "body" }).returning();
    const [c1] = await db.insert(schema.groups).values({ name: "แคร์ A", orgLevel: "care", parentGroupId: b1.id, leaderId: careA.id }).returning();
    const [c2] = await db.insert(schema.groups).values({ name: "แคร์ B", orgLevel: "care", parentGroupId: b1.id, leaderId: careB.id }).returning();
    const [c3] = await db.insert(schema.groups).values({ name: "แคร์ C", orgLevel: "care", parentGroupId: b2.id, leaderId: careC.id }).returning();

    const [m1, m2, m3, m4] = await db
      .insert(schema.members)
      .values([
        { name: "สมาชิก หนึ่ง", phone: "081-111-1111", email: "one@example.com" },
        { name: "สมาชิก สอง", phone: "082-222-2222" },
        { name: "สมาชิก สาม", phone: "083-333-3333" },
        { name: "สมาชิก สี่ (ไม่มีกลุ่ม)" },
      ])
      .returning();
    ids.m1 = m1.id;
    ids.m2 = m2.id;
    ids.m3 = m3.id;
    ids.m4 = m4.id;
    await db.insert(schema.groupMembers).values([
      { groupId: c1.id, memberId: m1.id },
      { groupId: c2.id, memberId: m2.id },
      { groupId: c3.id, memberId: m3.id },
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

  type Json = { success: boolean; data?: any; error?: { code: string; message: string } };
  const call = async (role: string | null, method: string, url: string, body?: unknown): Promise<{ status: number; json: Json }> => {
    const res = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { "Content-Type": "application/json", ...(role ? { Cookie: cookies[role] } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as Json };
  };

  describe("who may see membership status", () => {
    it("rejects an unauthenticated request", async () => {
      expect((await call(null, "GET", `/api/memberships/members/${ids.m1}`)).status).toBe(401);
    });

    it.each(["viewer", "member", "ministry"])("%s gets 403 on every membership read", async (role) => {
      expect((await call(role, "GET", `/api/memberships/members/${ids.m1}`)).status).toBe(403);
      expect((await call(role, "GET", "/api/memberships/overview")).status).toBe(403);
    });

    it("office roles see any member; the care leader sees only their own group", async () => {
      for (const role of ["admin", "staff"]) {
        expect((await call(role, "GET", `/api/memberships/members/${ids.m3}`)).status).toBe(200);
      }
      expect((await call("careA", "GET", `/api/memberships/members/${ids.m1}`)).status).toBe(200);
      expect((await call("careA", "GET", `/api/memberships/members/${ids.m2}`)).status).toBe(403);
      expect((await call("careA", "GET", `/api/memberships/members/${ids.m3}`)).status).toBe(403);
    });

    it("the body leader sees members of the care groups under their body, not another body's", async () => {
      expect((await call("bodyLead", "GET", `/api/memberships/members/${ids.m1}`)).status).toBe(200);
      expect((await call("bodyLead", "GET", `/api/memberships/members/${ids.m2}`)).status).toBe(200);
      expect((await call("bodyLead", "GET", `/api/memberships/members/${ids.m3}`)).status).toBe(403);
    });

    it("a member without any group is invisible to leaders and visible to office roles", async () => {
      expect((await call("careA", "GET", `/api/memberships/members/${ids.m4}`)).status).toBe(403);
      expect((await call("admin", "GET", `/api/memberships/members/${ids.m4}`)).status).toBe(200);
    });
  });

  describe("trial (วิสามัญ) → ordinary (สามัญ) lifecycle", () => {
    let trialId: string;

    it("the care leader opens a free one-year trial for their own member", async () => {
      const res = await call("careA", "POST", `/api/memberships/members/${ids.m1}/terms`, { type: "extraordinary", startsOn: "2026-01-10" });
      expect(res.status).toBe(201);
      expect(res.json.data).toMatchObject({ type: "extraordinary", status: "open", startsOn: "2026-01-10", endsOn: "2027-01-10", feeBaht: 0, paymentStatus: "not_required" });
      trialId = res.json.data.id;
    });

    it("refuses a second open term for the same member (409)", async () => {
      const res = await call("careA", "POST", `/api/memberships/members/${ids.m1}/terms`, { type: "ordinary" });
      expect(res.status).toBe(409);
    });

    it("a leader cannot open a term for someone outside their group, and the body leader can only look", async () => {
      expect((await call("careA", "POST", `/api/memberships/members/${ids.m2}/terms`, { type: "extraordinary" })).status).toBe(403);
      expect((await call("bodyLead", "POST", `/api/memberships/members/${ids.m2}/terms`, { type: "extraordinary" })).status).toBe(403);
      expect((await call("viewer", "POST", `/api/memberships/members/${ids.m2}/terms`, { type: "extraordinary" })).status).toBe(403);
    });

    it("rejects a malformed date and an unknown type", async () => {
      expect((await call("admin", "POST", `/api/memberships/members/${ids.m4}/terms`, { type: "extraordinary", startsOn: "2026-02-30" })).status).toBe(400);
      expect((await call("admin", "POST", `/api/memberships/members/${ids.m4}/terms`, { type: "gold" })).status).toBe(400);
    });

    it("nothing converts the trial on its own: the term stays open as a trial", async () => {
      const res = await call("careA", "GET", `/api/memberships/members/${ids.m1}`);
      expect(res.json.data.summary.type).toBe("extraordinary");
      expect(res.json.data.terms).toHaveLength(1);
      expect(res.json.data.permissions).toEqual({ canDecide: true, canRecordPayment: false });
    });

    it("the body leader sees the status but is not offered the decision", async () => {
      const res = await call("bodyLead", "GET", `/api/memberships/members/${ids.m1}`);
      expect(res.json.data.permissions.canDecide).toBe(false);
      expect((await call("bodyLead", "POST", `/api/memberships/terms/${trialId}/decision`, { decision: "convert_to_ordinary" })).status).toBe(403);
    });

    it("another group's leader cannot decide on this trial", async () => {
      expect((await call("careB", "POST", `/api/memberships/terms/${trialId}/decision`, { decision: "convert_to_ordinary" })).status).toBe(403);
    });

    it("a trial cannot be renewed, only converted or not continued", async () => {
      const res = await call("careA", "POST", `/api/memberships/terms/${trialId}/decision`, { decision: "renew" });
      expect(res.status).toBe(400);
    });

    it("the care leader converts the trial: it closes as history and a 100-baht unpaid ordinary term opens", async () => {
      const res = await call("careA", "POST", `/api/memberships/terms/${trialId}/decision`, { decision: "convert_to_ordinary", note: "ผ่านการตรวจสอบ" });
      expect(res.status).toBe(200);
      const terms = res.json.data.terms as Array<{ type: string; status: string; closedReason: string | null; feeBaht: number; paymentStatus: string; decisionNote: string | null }>;
      expect(terms).toHaveLength(2);
      const closed = terms.find((t) => t.status === "closed")!;
      expect(closed).toMatchObject({ type: "extraordinary", closedReason: "converted_to_ordinary", decisionNote: "ผ่านการตรวจสอบ" });
      const open = terms.find((t) => t.status === "open")!;
      expect(open).toMatchObject({ type: "ordinary", feeBaht: 100, paymentStatus: "unpaid" });
      expect(res.json.data.summary.type).toBe("ordinary");
    });

    it("a closed term cannot be decided again (409)", async () => {
      expect((await call("careA", "POST", `/api/memberships/terms/${trialId}/decision`, { decision: "not_continued" })).status).toBe(409);
    });

    it("only office roles record a payment; leaders and viewers cannot (403)", async () => {
      const detail = await call("admin", "GET", `/api/memberships/members/${ids.m1}`);
      const ordinary = (detail.json.data.terms as Array<{ id: string; type: string; status: string }>).find((t) => t.type === "ordinary" && t.status === "open")!;
      for (const role of ["careA", "bodyLead", "viewer", "member", "ministry"]) {
        expect((await call(role, "PATCH", `/api/memberships/terms/${ordinary.id}/payment`, { amountBaht: 100 })).status).toBe(403);
      }
    });

    it("rejects an amount below the fee, then records 100 baht exactly once", async () => {
      const detail = await call("staff", "GET", `/api/memberships/members/${ids.m1}`);
      const ordinary = (detail.json.data.terms as Array<{ id: string; type: string; status: string }>).find((t) => t.type === "ordinary" && t.status === "open")!;
      expect((await call("staff", "PATCH", `/api/memberships/terms/${ordinary.id}/payment`, { amountBaht: 50 })).status).toBe(400);
      expect((await call("staff", "PATCH", `/api/memberships/terms/${ordinary.id}/payment`, { amountBaht: 100.5 })).status).toBe(400);
      const ok = await call("staff", "PATCH", `/api/memberships/terms/${ordinary.id}/payment`, { amountBaht: 100, paidOn: "2026-02-01", note: "รับเงินสด" });
      expect(ok.status).toBe(200);
      expect(ok.json.data).toMatchObject({ paymentStatus: "paid", paidAmountBaht: 100 });
      expect(String(ok.json.data.paidAt)).toContain("2026-02-01");
      expect((await call("admin", "PATCH", `/api/memberships/terms/${ordinary.id}/payment`, { amountBaht: 100 })).status).toBe(409);
    });

    it("a trial has no fee: recording a payment on it is refused", async () => {
      const detail = await call("admin", "GET", `/api/memberships/members/${ids.m1}`);
      const trial = (detail.json.data.terms as Array<{ id: string; type: string }>).find((t) => t.type === "extraordinary")!;
      expect((await call("admin", "PATCH", `/api/memberships/terms/${trial.id}/payment`, { amountBaht: 100 })).status).toBe(400);
    });

    it("renewal closes the paid cycle and opens the next one, keeping every earlier row", async () => {
      const detail = await call("careA", "GET", `/api/memberships/members/${ids.m1}`);
      const ordinary = (detail.json.data.terms as Array<{ id: string; type: string; status: string; endsOn: string }>).find((t) => t.type === "ordinary" && t.status === "open")!;
      const res = await call("careA", "POST", `/api/memberships/terms/${ordinary.id}/decision`, { decision: "renew" });
      expect(res.status).toBe(200);
      const terms = res.json.data.terms as Array<{ type: string; status: string; startsOn: string; endsOn: string; closedReason: string | null; paymentStatus: string }>;
      expect(terms).toHaveLength(3);
      expect(terms.filter((t) => t.status === "open")).toHaveLength(1);
      const next = terms.find((t) => t.status === "open")!;
      expect(next).toMatchObject({ type: "ordinary", paymentStatus: "unpaid", startsOn: ordinary.endsOn });
      expect(terms.find((t) => t.closedReason === "renewed")).toBeTruthy();
      // The earlier paid cycle is still there, still paid.
      expect(terms.find((t) => t.closedReason === "renewed")!.paymentStatus).toBe("paid");
    });

    it("'not continued' closes the open term and leaves the member without a current status", async () => {
      const res = await call("careA", "GET", `/api/memberships/members/${ids.m1}`);
      const open = (res.json.data.terms as Array<{ id: string; status: string }>).find((t) => t.status === "open")!;
      const out = await call("careA", "POST", `/api/memberships/terms/${open.id}/decision`, { decision: "not_continued", note: "ย้ายไปที่อื่น" });
      expect(out.status).toBe(200);
      expect(out.json.data.summary.state).toBe("none");
      expect((out.json.data.terms as unknown[]).length).toBe(3);
    });
  });

  describe("overview", () => {
    it("lists only in-scope members, never contact details, with counts", async () => {
      await call("admin", "POST", `/api/memberships/members/${ids.m2}/terms`, { type: "extraordinary", startsOn: "2025-01-01" });
      await call("admin", "POST", `/api/memberships/members/${ids.m3}/terms`, { type: "ordinary", startsOn: "2026-05-01" });

      const admin = await call("admin", "GET", "/api/memberships/overview?filter=all");
      expect(admin.status).toBe(200);
      const adminIds = (admin.json.data.items as Array<{ memberId: string }>).map((i) => i.memberId);
      expect(adminIds.sort()).toEqual([ids.m2, ids.m3].sort());

      const careB = await call("careB", "GET", "/api/memberships/overview?filter=all");
      expect((careB.json.data.items as Array<{ memberId: string }>).map((i) => i.memberId)).toEqual([ids.m2]);

      const bodyLead = await call("bodyLead", "GET", "/api/memberships/overview?filter=all");
      expect((bodyLead.json.data.items as Array<{ memberId: string }>).map((i) => i.memberId)).toEqual([ids.m2]);

      const text = JSON.stringify(admin.json.data);
      expect(text).not.toContain("081-111-1111");
      expect(text).not.toContain("082-222-2222");
      expect(text).not.toContain("one@example.com");
      expect(text).not.toMatch(/"(phone|email|address)"/);
    });

    it("flags an overdue trial for the care leader and filters by attention", async () => {
      const res = await call("careB", "GET", "/api/memberships/overview?filter=attention");
      const item = (res.json.data.items as Array<{ memberId: string; summary: { state: string; needsAttention: boolean } }>)[0];
      expect(item.summary.state).toBe("trial_review_due");
      expect(item.summary.needsAttention).toBe(true);
      expect(res.json.data.counts.trial_review_due).toBe(1);
    });

    it("tells office roles — and only them — that they can record payments", async () => {
      expect((await call("staff", "GET", "/api/memberships/overview")).json.data.canRecordPayment).toBe(true);
      expect((await call("careB", "GET", "/api/memberships/overview")).json.data.canRecordPayment).toBe(false);
    });

    it("rejects a bad filter", async () => {
      expect((await call("admin", "GET", "/api/memberships/overview?filter=everything")).status).toBe(400);
    });
  });

  it("writes an audit trail for each change", async () => {
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const rows = await client.getDb().select({ action: schema.auditLogs.action }).from(schema.auditLogs);
    const actions = new Set(rows.map((r) => r.action));
    for (const a of ["MEMBERSHIP_TERM_STARTED", "MEMBERSHIP_TERM_DECIDED", "MEMBERSHIP_PAYMENT_RECORDED"]) {
      expect(actions.has(a), a).toBe(true);
    }
  });
});
