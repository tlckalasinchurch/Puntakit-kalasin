import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import ExcelJS from "exceljs";
import { count as sqlCount, eq } from "drizzle-orm";

/**
 * Large-workbook path: /upload/token + /upload/from-blob. @vercel/blob is
 * mocked (no network); the import itself runs for real on PGlite.
 */

const blobs = new Map<string, Uint8Array>();
const deleted: string[] = [];
/** What happened, in order: "get:<path>" then "del:<path>". */
const events: string[] = [];
const readFailures = new Set<string>();
const deleteFailures = new Set<string>();
/** Set by the tests: how many import_batches rows exist right now. */
const probe = { batchCount: async () => 0 };
/** import_batches rows that existed at the moment each blob was deleted. */
const batchesWhenDeleted: Record<string, number> = {};

vi.mock("@vercel/blob", () => ({
  get: vi.fn(async (pathname: string) => {
    events.push(`get:${pathname}`);
    if (readFailures.has(pathname)) {
      return {
        statusCode: 200,
        stream: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.error(new Error("connection reset while reading the blob"));
          },
        }),
        headers: new Headers(),
        blob: { size: 10, contentType: "application/octet-stream" },
      };
    }
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
    events.push(`del:${pathname}`);
    batchesWhenDeleted[pathname] = await probe.batchCount();
    if (deleteFailures.has(pathname)) throw new Error("blob service unavailable");
    deleted.push(pathname);
    blobs.delete(pathname);
  }),
}));

vi.mock("@vercel/blob/client", () => ({
  handleUpload: vi.fn(async (options: { onBeforeGenerateToken: (p: string) => Promise<unknown> }) => {
    const pathname = (options as unknown as { body: { pathname: string } }).body.pathname;
    const config = await options.onBeforeGenerateToken(pathname);
    return { type: "blob.generate-client-token", clientToken: "test-token", config };
  }),
}));

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE", "BLOB_READ_WRITE_TOKEN"] as const;
const originalEnv = { ...process.env };
let tempRoot: string;

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
});

async function buildWorkbookBytes(seed = "x"): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("กลุ่ม ก");
  ws.addRow(["ทะเบียนพันธกิจบ้าน กลุ่ม ก ทีม A"]);
  ws.addRow([]);
  ws.addRow(["ที่", "ชื่อ-สกุล", "ชื่อเล่น", "อายุ", "อาชีพ", "สถานที่ทำงาน", "สถานภาพครอบครัว", "", "", "", "", "", "", "", "", ""]);
  ws.addRow([1, "สมชาย ใจดี", `ชาย${seed}`, 40, "ครู", "โรงเรียน", "1"]);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

describe("import via Vercel Blob", () => {
  let server: Server;
  let baseUrl: string;
  let adminCookie: string;
  let staffCookie: string;
  let workbookBytes: Uint8Array;
  let db: ReturnType<typeof import("../db/client.js").getDb>;
  let schema: typeof import("../../shared/schema.js");

  beforeAll(async () => {
    for (const key of MANAGED_KEYS) delete process.env[key];
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-import-blob-"));
    process.env.NODE_ENV = "development";
    process.env.DATABASE_DRIVER = "pglite";
    process.env.PGLITE_DATA_DIR = path.join(tempRoot, ".db_data");
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";

    const client = await import("../db/client.js");
    const bootstrap = await import("../db/bootstrap.js");
    schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await bootstrap.bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    db = client.getDb();
    probe.batchCount = async () => Number((await db.select({ n: sqlCount() }).from(schema.importBatches))[0].n);

    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (typeof address === "object" && address !== null) baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    const [admin] = await db.insert(schema.users).values({ email: "admin@blob-test.local", passwordHash: "x", name: "Admin", role: "admin" }).returning();
    const [staff] = await db.insert(schema.users).values({ email: "staff@blob-test.local", passwordHash: "x", name: "Staff", role: "staff" }).returning();
    adminCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: admin.id, email: admin.email, role: "admin" })}`;
    staffCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: staff.id, email: staff.email, role: "staff" })}`;
    workbookBytes = await buildWorkbookBytes();
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const client = await import("../db/client.js");
    await client.closeDatabase();
  });

  beforeEach(() => {
    blobs.clear();
    deleted.length = 0;
    events.length = 0;
    readFailures.clear();
    deleteFailures.clear();
  });

  const audits = (action: string) => db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, action));

  const post = (route: string, cookie: string | null, body: unknown) =>
    fetch(`${baseUrl}/api/import/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    });

  it("gates both routes: 401 without a session, 403 for staff", async () => {
    expect((await post("upload/token", null, {})).status).toBe(401);
    expect((await post("upload/token", staffCookie, {})).status).toBe(403);
    expect((await post("upload/from-blob", staffCookie, { pathname: "import/a.xlsx", fileName: "a.xlsx" })).status).toBe(403);
  });

  it("issues a token only for .xlsx paths under import/", async () => {
    const ok = await post("upload/token", adminCookie, { pathname: "import/book.xlsx" });
    expect(ok.status).toBe(200);
    const config = ((await ok.json()) as { config: { maximumSizeInBytes: number; addRandomSuffix: boolean } }).config;
    expect(config.addRandomSuffix).toBe(true);
    expect(config.maximumSizeInBytes).toBeGreaterThan(27 * 1024 * 1024);

    expect((await post("upload/token", adminCookie, { pathname: "other/book.xlsx" })).status).toBe(400);
    expect((await post("upload/token", adminCookie, { pathname: "import/book.csv" })).status).toBe(400);
    expect((await post("upload/token", adminCookie, { pathname: "import/../book.xlsx" })).status).toBe(400);
  });

  it("rejects a pathname outside import/ and never touches storage", async () => {
    const res = await post("upload/from-blob", adminCookie, { pathname: "secrets/a.xlsx", fileName: "a.xlsx" });
    expect(res.status).toBe(400);
    expect(deleted).toEqual([]);
  });

  it("imports the blob, then deletes it; a repeat is refused with 409 and also deletes", async () => {
    blobs.set("import/book-abc.xlsx", workbookBytes);
    const res = await post("upload/from-blob", adminCookie, { pathname: "import/book-abc.xlsx", fileName: "book.xlsx" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { counts: { memberRows: number } } };
    expect(body.data.counts.memberRows).toBe(1);
    expect(deleted).toEqual(["import/book-abc.xlsx"]);

    blobs.set("import/book-def.xlsx", workbookBytes);
    const again = await post("upload/from-blob", adminCookie, { pathname: "import/book-def.xlsx", fileName: "book.xlsx" });
    expect(again.status).toBe(409);
    expect(deleted).toEqual(["import/book-abc.xlsx", "import/book-def.xlsx"]);
  });

  it("returns 400 and deletes the blob when the blob is missing or not a workbook", async () => {
    const missing = await post("upload/from-blob", adminCookie, { pathname: "import/none.xlsx", fileName: "none.xlsx" });
    expect(missing.status).toBe(400);

    blobs.set("import/junk.xlsx", new Uint8Array([1, 2, 3]));
    const junk = await post("upload/from-blob", adminCookie, { pathname: "import/junk.xlsx", fileName: "junk.xlsx" });
    expect(junk.status).toBe(400);
    expect(deleted).toContain("import/junk.xlsx");
  });

  it("deletes the blob only AFTER its bytes were fully read, and BEFORE the workbook is written", async () => {
    const before = await probe.batchCount();
    blobs.set("import/order.xlsx", await buildWorkbookBytes("order"));

    const res = await post("upload/from-blob", adminCookie, { pathname: "import/order.xlsx", fileName: "order.xlsx" });

    expect(res.status).toBe(201);
    expect(events).toEqual(["get:import/order.xlsx", "del:import/order.xlsx"]); // read first, delete second
    expect(batchesWhenDeleted["import/order.xlsx"]).toBe(before); // nothing was imported yet at delete time
    expect(await probe.batchCount()).toBe(before + 1); // the import still completed afterwards
  });

  it("records the blob and its deletion in the audit log of a successful import", async () => {
    blobs.set("import/audit.xlsx", await buildWorkbookBytes("audit"));
    const res = await post("upload/from-blob", adminCookie, { pathname: "import/audit.xlsx", fileName: "audit.xlsx" });
    expect(res.status).toBe(201);

    const created = (await audits("IMPORT_BATCH_CREATED")).find((row) => JSON.parse(row.details!).blobPathname === "import/audit.xlsx");
    expect(JSON.parse(created!.details!)).toMatchObject({ source: "blob", sourceFileName: "audit.xlsx", blobDeleted: true });
  });

  it("a failed import still removes the blob (re-upload needed) and says so in the audit log", async () => {
    blobs.set("import/broken.xlsx", new Uint8Array([9, 9, 9]));
    const res = await post("upload/from-blob", adminCookie, { pathname: "import/broken.xlsx", fileName: "broken.xlsx" });

    expect(res.status).toBe(400);
    expect(deleted).toContain("import/broken.xlsx");
    const failure = (await audits("IMPORT_BATCH_FAILED")).find((row) => JSON.parse(row.details!).blobPathname === "import/broken.xlsx");
    expect(JSON.parse(failure!.details!)).toMatchObject({ stage: "parse", source: "blob", blobDeleted: true, sourceFileName: "broken.xlsx" });
  });

  it("if the delete itself fails the import still succeeds and the leftover blob is audited", async () => {
    blobs.set("import/stuck.xlsx", await buildWorkbookBytes("stuck"));
    deleteFailures.add("import/stuck.xlsx");

    const res = await post("upload/from-blob", adminCookie, { pathname: "import/stuck.xlsx", fileName: "stuck.xlsx" });

    expect(res.status).toBe(201);
    expect(blobs.has("import/stuck.xlsx")).toBe(true); // still in storage
    const leftover = (await audits("IMPORT_BLOB_DELETE_FAILED")).find((row) => JSON.parse(row.details!).pathname === "import/stuck.xlsx");
    expect(leftover).toBeDefined();
    const created = (await audits("IMPORT_BATCH_CREATED")).find((row) => JSON.parse(row.details!).blobPathname === "import/stuck.xlsx");
    expect(JSON.parse(created!.details!)).toMatchObject({ blobDeleted: false });
  });

  it("if the read breaks midway the blob is NOT deleted (it is still the only copy) and the audit log keeps the reference", async () => {
    blobs.set("import/halfread.xlsx", await buildWorkbookBytes("half"));
    readFailures.add("import/halfread.xlsx");

    const res = await post("upload/from-blob", adminCookie, { pathname: "import/halfread.xlsx", fileName: "halfread.xlsx" });

    expect(res.status).toBe(500);
    expect(events).toEqual(["get:import/halfread.xlsx"]); // no delete was attempted
    expect(blobs.has("import/halfread.xlsx")).toBe(true);
    const retained = (await audits("IMPORT_BLOB_RETAINED")).find((row) => JSON.parse(row.details!).pathname === "import/halfread.xlsx");
    expect(JSON.parse(retained!.details!)).toMatchObject({ reason: "READ_FAILED", sourceFileName: "halfread.xlsx" });
    const failure = (await audits("IMPORT_BATCH_FAILED")).find((row) => JSON.parse(row.details!).blobPathname === "import/halfread.xlsx");
    expect(JSON.parse(failure!.details!)).toMatchObject({ stage: "read-blob" });
  });
});
