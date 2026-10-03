import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import ExcelJS from "exceljs";
import { count as sqlCount } from "drizzle-orm";

/**
 * Merge plans and their four-eyes approval, against a real (embedded)
 * PostgreSQL via PGlite. Proves: a plan needs a "same person" decision, the
 * proposer cannot approve their own plan, approval is re-checked against the
 * decision, and nothing here ever writes to members or the import layers.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let tempRoot: string;

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
});

async function buildWorkbookBytes(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("กลุ่ม ก");
  ws.addRow(["ทะเบียนพันธกิจบ้าน กลุ่ม ก ทีม A"]);
  ws.addRow([]);
  ws.addRow(["ที่", "ชื่อ-สกุล", "ชื่อเล่น", "อายุ", "อาชีพ", "สถานที่ทำงาน", "สถานภาพครอบครัว", "", "", "", "", "", "", "", "", ""]);
  ws.addRow([1, "สมชาย ใจดี", "หนู", 40, "ครู", "โรงเรียน", "1"]);
  ws.addRow([2, "สมชาย ใจดี", "หนู", 41, "", "โรงเรียนบ้านนา", "1"]);
  ws.addRow([3, "สมศรี มั่นคง", "ตุ๊ก", 50, "ค้าขาย", "ตลาด", "1"]);
  ws.addRow([4, "สมศรี มั่นคง", "ตุ๊ก", 50, "ค้าขาย", "ตลาด", "1"]);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

type Member = { sourceRowId: string; rawAge: string | null; rawOccupation: string | null; rawWorkplace: string | null };
type Group = { nickname: string; members: Member[]; mergePlan: { id: string; status: string } | null };
type Plan = {
  id: string;
  status: string;
  proposedByName: string | null;
  reviewedByName: string | null;
  result: Record<string, { fromRowId: string; value: string | null }>;
};

describe("merge plans (four-eyes approval, no merge executed)", () => {
  let server: Server;
  let baseUrl: string;
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");
  let admin1: string;
  let admin2: string;
  let staff: string;

  const api = (route: string, cookie: string | null, init: { method?: string; body?: unknown } = {}) =>
    fetch(`${baseUrl}/api/import/${route}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

  async function groupOf(nickname: string): Promise<Group> {
    const res = await api("duplicates", admin1);
    const body = (await res.json()) as { data: { duplicates: Group[] } };
    return body.data.duplicates.find((g) => g.nickname === nickname)!;
  }

  async function decide(group: Group, decision: "same_person" | "different_people") {
    return api("duplicates/decisions", admin1, {
      body: { nickname: group.nickname, sourceRowIds: group.members.map((m) => m.sourceRowId), decision },
    });
  }

  function planBody(group: Group, primaryIndex = 0, overrides: Record<string, string> = {}) {
    const ids = group.members.map((m) => m.sourceRowId);
    const primary = ids[primaryIndex];
    return {
      nickname: group.nickname,
      sourceRowIds: ids,
      primarySourceRowId: primary,
      fieldChoices: { fullName: primary, age: primary, occupation: primary, workplace: primary, ...overrides },
    };
  }

  beforeAll(async () => {
    for (const key of MANAGED_KEYS) delete process.env[key];
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-merge-plans-"));
    process.env.NODE_ENV = "development";
    process.env.DATABASE_DRIVER = "pglite";
    process.env.PGLITE_DATA_DIR = path.join(tempRoot, ".db_data");

    const client = await import("../db/client.js");
    const bootstrap = await import("../db/bootstrap.js");
    schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await bootstrap.bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    db = client.getDb();

    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (typeof address === "object" && address !== null) baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    const make = async (email: string, name: string, role: "admin" | "staff") => {
      const [row] = await db.insert(schema.users).values({ email, passwordHash: "x", name, role }).returning();
      return `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: row.id, email: row.email, role })}`;
    };
    admin1 = await make("a1@merge-test.local", "Admin One", "admin");
    admin2 = await make("a2@merge-test.local", "Admin Two", "admin");
    staff = await make("s@merge-test.local", "Staff", "staff");

    const upload = await fetch(`${baseUrl}/api/import/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", Cookie: admin1, "x-source-filename": "merge.xlsx" },
      body: await buildWorkbookBytes(),
    });
    expect(upload.status).toBe(201);
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const client = await import("../db/client.js");
    await client.closeDatabase();
  });

  it("gates by role: 401 without a session; staff may read but not propose or review", async () => {
    const group = await groupOf("หนู");
    expect((await api("merge-plans", null)).status).toBe(401);
    expect((await api("merge-plans", staff)).status).toBe(200);
    expect((await api("merge-plans", staff, { body: planBody(group) })).status).toBe(403);
    expect(
      (await api("merge-plans/00000000-0000-4000-8000-000000000000/review", staff, { body: { outcome: "approved" } })).status
    ).toBe(403);
  });

  it("refuses a plan until the group is decided 'same person'", async () => {
    const group = await groupOf("หนู");
    expect((await api("merge-plans", admin1, { body: planBody(group) })).status).toBe(400);

    await decide(group, "different_people");
    expect((await api("merge-plans", admin1, { body: planBody(group) })).status).toBe(400);
  });

  it("proposes a plan whose result takes each field from the chosen row", async () => {
    const group = await groupOf("หนู");
    expect((await decide(group, "same_person")).status).toBe(201);

    // surviving row = first; but the workplace comes from the second row
    const second = group.members[1].sourceRowId;
    const res = await api("merge-plans", admin1, { body: planBody(group, 0, { workplace: second }) });
    expect(res.status).toBe(201);
    const plan = ((await res.json()) as { data: Plan }).data;
    expect(plan.status).toBe("proposed");
    expect(plan.proposedByName).toBe("Admin One");
    expect(plan.result.workplace.fromRowId).toBe(second);
    expect(plan.result.workplace.value).toBe(group.members[1].rawWorkplace);
    expect(plan.result.age.value).toBe(group.members[0].rawAge);

    expect((await groupOf("หนู")).mergePlan).toMatchObject({ id: plan.id, status: "proposed" });
  });

  it("allows one open plan per group", async () => {
    const group = await groupOf("หนู");
    expect((await api("merge-plans", admin1, { body: planBody(group) })).status).toBe(409);
  });

  it("rejects row ids that are not in the compared group", async () => {
    const other = await groupOf("ตุ๊ก");
    const group = await groupOf("หนู");
    const foreign = other.members[0].sourceRowId;
    expect((await api("merge-plans", admin1, { body: planBody(group, 0, { age: foreign }) })).status).toBe(400);
  });

  it("does not let the proposer approve or reject their own plan", async () => {
    const [plan] = (((await (await api("merge-plans?status=proposed", admin1)).json()) as { data: { plans: Plan[] } }).data.plans);
    expect((await api(`merge-plans/${plan.id}/review`, admin1, { body: { outcome: "approved" } })).status).toBe(403);
    expect((await api(`merge-plans/${plan.id}/review`, admin1, { body: { outcome: "rejected", note: "x" } })).status).toBe(403);
  });

  it("requires a reason to reject, then a second admin can approve", async () => {
    const [plan] = (((await (await api("merge-plans?status=proposed", admin2)).json()) as { data: { plans: Plan[] } }).data.plans);
    expect((await api(`merge-plans/${plan.id}/review`, admin2, { body: { outcome: "rejected" } })).status).toBe(400);

    const res = await api(`merge-plans/${plan.id}/review`, admin2, { body: { outcome: "approved", note: "ตรวจแล้ว" } });
    expect(res.status).toBe(200);
    const approved = ((await res.json()) as { data: Plan }).data;
    expect(approved.status).toBe("approved");
    expect(approved.reviewedByName).toBe("Admin Two");

    // a plan is decided once
    expect((await api(`merge-plans/${plan.id}/review`, admin2, { body: { outcome: "rejected", note: "เปลี่ยนใจ" } })).status).toBe(409);
    expect((await groupOf("หนู")).mergePlan).toMatchObject({ status: "approved" });
  });

  it("will not approve once the group is no longer decided 'same person'", async () => {
    const group = await groupOf("ตุ๊ก");
    await decide(group, "same_person");
    const created = await api("merge-plans", admin1, { body: planBody(group) });
    expect(created.status).toBe(201);
    const plan = ((await created.json()) as { data: Plan }).data;

    await decide(group, "different_people"); // the reviewer changed their mind
    expect((await api(`merge-plans/${plan.id}/review`, admin2, { body: { outcome: "approved" } })).status).toBe(409);

    const rejected = await api(`merge-plans/${plan.id}/review`, admin2, { body: { outcome: "rejected", note: "ผลตรวจเปลี่ยน" } });
    expect(rejected.status).toBe(200);
    expect(((await rejected.json()) as { data: Plan }).data.status).toBe("rejected");
  });

  it("lets only the proposer withdraw an open plan, and then a new one can be proposed", async () => {
    const group = await groupOf("ตุ๊ก");
    await decide(group, "same_person");
    const created = await api("merge-plans", admin1, { body: planBody(group) });
    expect(created.status).toBe(201);
    const plan = ((await created.json()) as { data: Plan }).data;

    expect((await api(`merge-plans/${plan.id}/withdraw`, admin2, { method: "POST", body: {} })).status).toBe(403);
    const withdrawn = await api(`merge-plans/${plan.id}/withdraw`, admin1, { method: "POST", body: {} });
    expect(withdrawn.status).toBe(200);
    expect(((await withdrawn.json()) as { data: Plan }).data.status).toBe("withdrawn");

    expect((await api("merge-plans", admin1, { body: planBody(group, 1) })).status).toBe(201);
  });

  it("filters the list by status and never writes to members or the import layers", async () => {
    const approved = (await (await api("merge-plans?status=approved", admin1)).json()) as { data: { plans: Plan[] } };
    expect(approved.data.plans.every((p) => p.status === "approved")).toBe(true);
    expect(approved.data.plans.length).toBe(1);

    const [{ n: members }] = await db.select({ n: sqlCount() }).from(schema.members);
    const [{ n: sourceRows }] = await db.select({ n: sqlCount() }).from(schema.importSourceRows);
    expect(Number(members)).toBe(0);
    expect(Number(sourceRows)).toBe(4);
  });
});
