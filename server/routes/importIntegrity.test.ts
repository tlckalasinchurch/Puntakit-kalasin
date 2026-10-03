import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import ExcelJS from "exceljs";
import { count as sqlCount, eq } from "drizzle-orm";

/**
 * Import integrity on the standard (PGlite) driver: races that must become 409,
 * and the audit trail of successful and failed imports.
 *
 * Two mocks make the races deterministic instead of lucky:
 *  - `withTempWorkbook` waits at a barrier until N uploads have all passed the
 *    duplicate pre-check, so they genuinely race into the write;
 *  - `isUniqueViolation` is wrapped to record which constraint it recognised,
 *    proving the 409 came from the 23505 mapping and not from the pre-check.
 */

const makeGate = vi.hoisted(() => () => {
  const state = { target: 0, arrived: 0, release: null as null | (() => void), open: null as null | Promise<void> };
  return {
    arm(target: number) {
      state.target = target;
      state.arrived = 0;
      state.open = new Promise<void>((resolve) => {
        state.release = resolve;
      });
    },
    disarm() {
      state.target = 0;
      state.release?.();
    },
    async wait() {
      if (state.target === 0) return;
      state.arrived += 1;
      if (state.arrived >= state.target) state.release?.();
      await state.open;
    },
  };
});
/** Holds uploads after their duplicate pre-check, until N have arrived. */
const gate = vi.hoisted(() => makeGate());
const recognised = vi.hoisted(() => [] as Array<{ constraint: string; matched: boolean }>);

vi.mock("../lib/missionImport.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/missionImport.js")>();
  return {
    ...actual,
    withTempWorkbook: async (bytes: Uint8Array, run: (filePath: string) => Promise<unknown>) => {
      await gate.wait();
      return actual.withTempWorkbook(bytes, run as never);
    },
  };
});
vi.mock("../lib/dbErrors.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/dbErrors.js")>();
  return {
    ...actual,
    isUniqueViolation: (error: unknown, constraint: string) => {
      const matched = actual.isUniqueViolation(error, constraint);
      recognised.push({ constraint, matched });
      return matched;
    },
  };
});

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let tempRoot: string;

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
});

async function workbook(seed: string, withDuplicates = false): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("กลุ่ม ก");
  ws.addRow([`ทะเบียนพันธกิจบ้าน กลุ่ม ก ${seed}`]);
  ws.addRow([]);
  ws.addRow(["ที่", "ชื่อ-สกุล", "ชื่อเล่น", "อายุ", "อาชีพ", "สถานที่ทำงาน", "สถานภาพครอบครัว", "", "", "", "", "", "", "", "", ""]);
  ws.addRow([1, "สมชาย ใจดี", `หนู${seed}`, 40, "ครู", "โรงเรียน", "1"]);
  ws.addRow([2, "สมหญิง รักดี", withDuplicates ? `หนู${seed}` : `ตุ๊ก${seed}`, 35, "พยาบาล", "โรงพยาบาล", "1"]);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

describe("import integrity", () => {
  let server: Server;
  let baseUrl: string;
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");
  let adminCookie: string;

  const upload = (bytes: Uint8Array, name = "integrity.xlsx") =>
    fetch(`${baseUrl}/api/import/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", Cookie: adminCookie, "x-source-filename": name },
      body: bytes,
    });
  const post = (route: string, body: unknown) =>
    fetch(`${baseUrl}/api/import/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify(body),
    });
  const batchCount = async () => Number((await db.select({ n: sqlCount() }).from(schema.importBatches))[0].n);
  const audits = (action: string) => db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, action));

  beforeAll(async () => {
    for (const key of MANAGED_KEYS) delete process.env[key];
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-import-integrity-"));
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

    const [admin] = await db.insert(schema.users).values({ email: "admin@integrity-test.local", passwordHash: "x", name: "Admin", role: "admin" }).returning();
    adminCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: admin.id, email: admin.email, role: "admin" })}`;
  }, 120_000);

  afterAll(async () => {
    gate.disarm();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const client = await import("../db/client.js");
    await client.closeDatabase();
  });

  it("a normal import writes the batch and records IMPORT_BATCH_CREATED", async () => {
    const res = await upload(await workbook("ok"), "ok.xlsx");
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { batch: { id: string }; counts: { memberRows: number } } };
    expect(body.data.counts.memberRows).toBe(2);

    const created = (await audits("IMPORT_BATCH_CREATED")).find((row) => row.entityId === body.data.batch.id);
    expect(created).toBeDefined();
    expect(JSON.parse(created!.details!)).toMatchObject({ sourceFileName: "ok.xlsx", memberCount: 2 });
  });

  it("a failed import writes nothing and records IMPORT_BATCH_FAILED with its stage", async () => {
    const before = await batchCount();
    const res = await upload(new Uint8Array([1, 2, 3, 4]), "broken.xlsx");

    expect(res.status).toBe(400);
    expect(await batchCount()).toBe(before);
    const failure = (await audits("IMPORT_BATCH_FAILED")).find((row) => JSON.parse(row.details!).sourceFileName === "broken.xlsx");
    expect(failure).toBeDefined();
    expect(JSON.parse(failure!.details!)).toMatchObject({ stage: "parse", errorCode: "VALIDATION_ERROR", sizeBytes: 4 });
  });

  it("re-uploading a file that is already imported is a 409 from the pre-check", async () => {
    const bytes = await workbook("seq");
    expect((await upload(bytes, "seq.xlsx")).status).toBe(201);
    const again = await upload(bytes, "seq.xlsx");
    expect(again.status).toBe(409);

    const failures = (await audits("IMPORT_BATCH_FAILED")).filter((row) => JSON.parse(row.details!).sourceFileName === "seq.xlsx");
    expect(failures).toHaveLength(1);
    expect(JSON.parse(failures[0].details!)).toMatchObject({ stage: "precheck", errorCode: "CONFLICT" });
  });

  it("two identical uploads that race past the pre-check: one 201, one 409 (not 500), one batch", async () => {
    const bytes = await workbook("race");
    const before = await batchCount();
    recognised.length = 0;
    gate.arm(2); // both uploads pass the checksum pre-check before either one writes

    let responses: Response[];
    try {
      responses = await Promise.all([upload(bytes, "race.xlsx"), upload(bytes, "race.xlsx")]);
    } finally {
      gate.disarm();
    }

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await batchCount()).toBe(before + 1);

    const winner = (await (responses.find((r) => r.status === 201)!.json())) as { data: { batch: { id: string } } };
    const loser = (await (responses.find((r) => r.status === 409)!.json())) as { error: { details: Array<{ field: string; message: string }> } };
    expect(loser.error.details).toContainEqual({ field: "existingBatchId", message: winner.data.batch.id });

    // the 409 came from the 23505 mapping at the WRITE stage, not from the pre-check
    expect(recognised).toContainEqual({ constraint: "import_batches_file_checksum_unique", matched: true });
    const failure = (await audits("IMPORT_BATCH_FAILED")).find(
      (row) => JSON.parse(row.details!).sourceFileName === "race.xlsx"
    );
    expect(JSON.parse(failure!.details!)).toMatchObject({ stage: "write", errorCode: "CONFLICT" });
  });

  it("proposals for the same duplicate group that race: one 201, the rest 409 (not 500), one open plan", async () => {
    const res = await upload(await workbook("plan", true), "plan.xlsx");
    expect(res.status).toBe(201);
    const dup = (await (await fetch(`${baseUrl}/api/import/duplicates`, { headers: { Cookie: adminCookie } })).json()) as {
      data: { duplicates: Array<{ nickname: string; members: Array<{ sourceRowId: string }> }> };
    };
    const group = dup.data.duplicates.find((g) => g.nickname === "หนูplan")!;
    const ids = group.members.map((m) => m.sourceRowId);
    expect((await post("duplicates/decisions", { nickname: group.nickname, sourceRowIds: ids, decision: "same_person" })).status).toBe(201);

    const plan = {
      nickname: group.nickname,
      sourceRowIds: ids,
      primarySourceRowId: ids[0],
      fieldChoices: { fullName: ids[0], age: ids[0], occupation: ids[0], workplace: ids[0] },
    };
    recognised.length = 0;

    // Hold every INSERT into import_merge_plans until all 5 requests reached it.
    // Each request has already passed its "is a plan open?" pre-check by then,
    // so they genuinely race into the unique index. (The query is intercepted on
    // the embedded database client; no test hook exists in the route.)
    const insertGate = makeGate();
    const handle = (await import("../db/client.js")).getDatabaseHandle();
    if (handle.driver !== "pglite") throw new Error("this race test needs the PGlite driver");
    const originalQuery = handle.client.query.bind(handle.client);
    (handle.client as { query: unknown }).query = async (sql: string, ...rest: unknown[]) => {
      if (/insert into "import_merge_plans"/i.test(sql)) await insertGate.wait();
      return (originalQuery as (...args: unknown[]) => Promise<unknown>)(sql, ...rest);
    };
    insertGate.arm(5);
    let responses: Response[];
    try {
      responses = await Promise.all(Array.from({ length: 5 }, () => post("merge-plans", plan)));
    } finally {
      insertGate.disarm();
      (handle.client as { query: unknown }).query = originalQuery;
    }

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    const open = await db.select().from(schema.importMergePlans).where(eq(schema.importMergePlans.status, "proposed"));
    expect(open).toHaveLength(1);

    // at least one request was stopped by the unique index (23505), not by the pre-check
    expect(recognised).toContainEqual({ constraint: "import_merge_plans_one_open_per_group", matched: true });
  });
});
