import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import ExcelJS from "exceljs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { count as sqlCount, eq } from "drizzle-orm";

import { createFakeNeon, type FakeNeon } from "../test/fakeNeon.js";

/**
 * Import on the NEON HTTP path (the production driver).
 *
 * The real `drizzle-orm/neon-http` driver runs here, answering from PGlite via
 * a fake `neon()` (see server/test/fakeNeon.ts). On that driver `db.transaction`
 * throws, which is what made every production import fail before. These tests
 * fail if the import code calls `db.transaction()` on this path again, and they
 * prove the writes are still all-or-nothing through `db.batch`.
 */

const harness = vi.hoisted(() => ({ fake: null as null | { sql: unknown } }));

vi.mock("@neondatabase/serverless", () => ({ neon: () => harness.fake!.sql }));

const blobs = new Map<string, Uint8Array>();
const deleted: string[] = [];

vi.mock("@vercel/blob", () => ({
  get: vi.fn(async (pathname: string) => {
    const bytes = blobs.get(pathname);
    if (!bytes) return null;
    return {
      statusCode: 200,
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
      headers: new Headers(),
      blob: { size: bytes.length, contentType: "application/octet-stream" },
    };
  }),
  del: vi.fn(async (pathname: string) => {
    deleted.push(pathname);
    blobs.delete(pathname);
  }),
}));
vi.mock("@vercel/blob/client", () => ({ handleUpload: vi.fn() }));

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE", "BLOB_READ_WRITE_TOKEN"] as const;
const originalEnv = { ...process.env };
let tempRoot: string;
let pg: PGlite;
let neonFake: FakeNeon;

afterAll(async () => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  if (pg && !pg.closed) await pg.close();
  if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
});

async function workbook(seed: string): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("กลุ่ม ก");
  ws.addRow([`ทะเบียนพันธกิจบ้าน กลุ่ม ก ${seed}`]);
  ws.addRow([]);
  ws.addRow(["ที่", "ชื่อ-สกุล", "ชื่อเล่น", "อายุ", "อาชีพ", "สถานที่ทำงาน", "สถานภาพครอบครัว", "", "", "", "", "", "", "", "", ""]);
  ws.addRow([1, "สมชาย ใจดี", `หนู${seed}`, 40, "ครู", "โรงเรียน", "1"]);
  ws.addRow([2, "สมหญิง รักดี", `ตุ๊ก${seed}`, 35, "พยาบาล", "โรงพยาบาล", "1"]);
  ws.addRow([3, "สมศรี มั่นคง", "ตัวอย่าง", "abc", "ค้าขาย", "ตลาด", "1"]); // quarantined: age not numeric
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

describe("import on the Neon HTTP driver", () => {
  let server: Server;
  let baseUrl: string;
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");
  let handleDriver: () => string;
  let adminCookie: string;

  const upload = (bytes: Uint8Array, name = "neon.xlsx") =>
    fetch(`${baseUrl}/api/import/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", Cookie: adminCookie, "x-source-filename": name },
      body: bytes,
    });
  const fromBlob = (pathname: string, fileName: string) =>
    fetch(`${baseUrl}/api/import/upload/from-blob`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ pathname, fileName }),
    });

  const counts = async () => {
    const one = async (table: Parameters<typeof db.select>[0] extends never ? never : unknown) => table;
    void one;
    const [{ n: batches }] = await db.select({ n: sqlCount() }).from(schema.importBatches);
    const [{ n: source }] = await db.select({ n: sqlCount() }).from(schema.importSourceRows);
    const [{ n: norm }] = await db.select({ n: sqlCount() }).from(schema.importRowNorm);
    return { batches: Number(batches), source: Number(source), norm: Number(norm) };
  };
  const audits = async (action: string) => db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, action));

  beforeAll(async () => {
    for (const key of MANAGED_KEYS) delete process.env[key];
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-import-neon-"));

    // The database behind the fake Neon: a migrated PGlite.
    pg = new PGlite(path.join(tempRoot, "db"));
    await migrate(drizzle(pg), { migrationsFolder: path.join(import.meta.dirname, "..", "db", "migrations") });
    neonFake = createFakeNeon(pg);
    harness.fake = neonFake;

    process.env.NODE_ENV = "development";
    process.env.DATABASE_DRIVER = "neon";
    process.env.DATABASE_URL = "postgresql://user:pass@ep-test-123.neon.tech/neondb";
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";

    const client = await import("../db/client.js");
    schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    db = client.getDb();
    handleDriver = () => client.getDatabaseHandle().driver;

    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (typeof address === "object" && address !== null) baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    const [admin] = await db.insert(schema.users).values({ email: "admin@neon-test.local", passwordHash: "x", name: "Admin", role: "admin" }).returning();
    adminCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: admin.id, email: admin.email, role: "admin" })}`;
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    neonFake.failWhen = null;
    blobs.clear();
    deleted.length = 0;
  });

  it("is really the Neon driver, where db.transaction() is unsupported (the original production failure)", async () => {
    expect(handleDriver()).toBe("neon");
    await expect(db.transaction(async () => undefined)).rejects.toThrow(/No transactions support in neon-http driver/);
  });

  it("imports a workbook: L1 + L2 written through ONE batch, db.transaction never called", async () => {
    const transactionSpy = vi.spyOn(db, "transaction");
    const batchesBefore = neonFake.batchCalls();

    const res = await upload(await workbook("a"));

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { batch: { id: string }; counts: { memberRows: number; normalized: number; quarantined: number } } };
    expect(body.data.counts).toMatchObject({ memberRows: 3, normalized: 2, quarantined: 1 });
    expect(transactionSpy).not.toHaveBeenCalled();
    expect(neonFake.batchCalls() - batchesBefore).toBe(1);
    expect(await counts()).toEqual({ batches: 1, source: 3, norm: 2 });

    // batch order: the batch row, then every source row, then the L2 rows
    const statements = neonFake.lastBatch().map((q) => q.match(/insert into "(\w+)"/i)?.[1]);
    expect(statements).toEqual(["import_batches", "import_source_rows", "import_row_norm"]);

    const created = await audits("IMPORT_BATCH_CREATED");
    expect(created).toHaveLength(1);
    expect(created[0].entityId).toBe(body.data.batch.id);
    transactionSpy.mockRestore();
  });

  it("a failure inside the batch rolls EVERYTHING back (no half-written import), then the same file can be re-imported", async () => {
    const before = await counts();
    const file = await workbook("b");
    // the failure hits the LAST statement, after the batch row and all source rows already ran
    neonFake.failWhen = (query) => /insert into "import_row_norm"/i.test(query);

    const failed = await upload(file);

    expect(failed.status).toBe(500);
    expect(await counts()).toEqual(before); // atomic: nothing from this file survived
    const failures = await audits("IMPORT_BATCH_FAILED");
    expect(failures.at(-1)).toBeDefined();
    expect(JSON.parse(failures.at(-1)!.details!)).toMatchObject({ stage: "write", errorCode: "UNEXPECTED", sourceFileName: "neon.xlsx" });

    // nothing was left behind, so the same bytes import cleanly afterwards
    neonFake.failWhen = null;
    const retry = await upload(file);
    expect(retry.status).toBe(201);
    expect((await counts()).batches).toBe(before.batches + 1);
  });

  it("Blob path on Neon: bytes loaded, blob deleted, then the import is written by batch", async () => {
    const transactionSpy = vi.spyOn(db, "transaction");
    blobs.set("import/neon-blob.xlsx", await workbook("c"));
    const before = await counts();

    const res = await fromBlob("import/neon-blob.xlsx", "from-blob.xlsx");

    expect(res.status).toBe(201);
    expect(deleted).toEqual(["import/neon-blob.xlsx"]);
    expect(transactionSpy).not.toHaveBeenCalled();
    expect(await counts()).toEqual({ batches: before.batches + 1, source: before.source + 3, norm: before.norm + 2 });
    const created = (await audits("IMPORT_BATCH_CREATED")).at(-1)!;
    expect(JSON.parse(created.details!)).toMatchObject({ source: "blob", blobPathname: "import/neon-blob.xlsx", blobDeleted: true });
    transactionSpy.mockRestore();
  });

  it("Blob path on Neon: a failed write leaves nothing in the database; the blob is already gone, and the audit log says so", async () => {
    blobs.set("import/neon-fail.xlsx", await workbook("d"));
    const before = await counts();
    neonFake.failWhen = (query) => /insert into "import_row_norm"/i.test(query);

    const res = await fromBlob("import/neon-fail.xlsx", "failing.xlsx");

    expect(res.status).toBe(500);
    expect(await counts()).toEqual(before);
    expect(deleted).toEqual(["import/neon-fail.xlsx"]); // documented: a failed import needs a re-upload
    const failure = (await audits("IMPORT_BATCH_FAILED")).at(-1)!;
    expect(JSON.parse(failure.details!)).toMatchObject({ stage: "write", source: "blob", blobPathname: "import/neon-fail.xlsx", blobDeleted: true });
  });
});
