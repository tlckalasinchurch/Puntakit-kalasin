import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import ExcelJS from "exceljs";
import { count as sqlCount } from "drizzle-orm";

/**
 * Mission import API integration test against a real (embedded) PostgreSQL
 * via PGlite. Proves the whole Phase 2 loop: admin uploads a workbook ->
 * L1 verbatim + L2 opaque rows persist, a quarantined row stays in L1 with
 * no L2 row, a second upload of the same bytes is refused, readers can
 * preview/report/queue duplicates, and rule confirmation is admin-gated.
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-import-test-"));
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

/** A workbook shaped like the real sheets: title row, merged group headers,
 *  a good row, a row whose age is not numeric (quarantine), and a blank tail. */
async function buildWorkbookBytes(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("กลุ่ม ก");
  ws.addRow(["ทะเบียนพันธกิจบ้าน กลุ่ม ก ทีม A"]);
  ws.addRow([]);
  ws.addRow([
    "ที่",
    "ชื่อ-สกุล",
    "ชื่อเล่น",
    "อายุ",
    "อาชีพ",
    "สถานที่ทำงาน",
    "สถานภาพครอบครัว",
    "",
    "",
    "วันรับเชื่อ",
    "ท่าทีการตอบสนอง",
    "",
    "การเข้าร่วมกลุ่ม",
    "",
    "เป้าหมายในการสร้าง",
  ]);
  ws.addRow(["1", "สมชาย ใจดี", "หนู", "60.0", "รับราชการ", "บ้านหนองบัว", "", "1", "", "2021.0", "", "", "", "", "ผู้เชื่อผูกพัน"]);
  ws.addRow(["2", "", "หมู", "สี่สิบ", "", "", "", "", "/", "", "", "", "", "", ""]); // bad age → quarantined
  ws.addRow(["3", "", "หนู", "25", "", "", "", "", "", "", "", "", "", "", "ผู้ประสานงาน"]); // duplicate nickname
  ws.addRow(["4", "", "บิ้น", "", "", "", "", "", "", "", "", "", "", "", ""]);
  ws.addRow([]);
  ws.addRow(["รวม", "", "", "", "", "", "", "", "", "", "", "", "", "", "4 คน"]);

  const kv = wb.addWorksheet("หนองบัว new");
  kv.addRow(["คีย์", "ค่า"]);
  kv.addRow(["ชื่อกลุ่ม", "ก"]);

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as unknown as ArrayBuffer);
}

describe("Mission import API — Phase 2 L1/L2 (real PGlite Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");

  let adminCookie: string;
  let staffCookie: string;
  let outsiderCookie: string;

  let workbookBytes: Uint8Array;
  let batchId: string;

  beforeAll(async () => {
    setEnv({
      NODE_ENV: "development",
      DATABASE_DRIVER: "pglite",
      PGLITE_DATA_DIR: makeTempDataDir(),
    });

    const client = await import("../db/client.js");
    const bootstrap = await import("../db/bootstrap.js");
    schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
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
      .values({ email: "admin@import-test.local", passwordHash: "x", name: "Admin", role: "admin" })
      .returning();
    const [staff] = await db
      .insert(schema.users)
      .values({ email: "staff@import-test.local", passwordHash: "x", name: "Staff", role: "staff" })
      .returning();
    const [outsider] = await db
      .insert(schema.users)
      .values({ email: "member@import-test.local", passwordHash: "x", name: "Member", role: "member" })
      .returning();

    adminCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: admin.id, email: admin.email, role: "admin" })}`;
    staffCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: staff.id, email: staff.email, role: "staff" })}`;
    outsiderCookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: outsider.id, email: outsider.email, role: "member" })}`;

    workbookBytes = await buildWorkbookBytes();
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const client = await import("../db/client.js");
    await client.closeDatabase();
  });

  function upload(cookie: string, bytes: Uint8Array = workbookBytes, fileName = "workbook.xlsx") {
    return fetch(`${baseUrl}/api/import/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        Cookie: cookie,
        "x-source-filename": fileName,
      },
      body: bytes,
    });
  }

  describe("401/403 gates", () => {
    it("rejects listing batches without a session", async () => {
      expect((await fetch(`${baseUrl}/api/import/batches`)).status).toBe(401);
    });

    it("rejects upload from a non-admin (staff is a reader, not an importer)", async () => {
      const res = await upload(staffCookie);
      expect(res.status).toBe(403);
    });

    it("rejects reading batches from a plain member", async () => {
      const res = await fetch(`${baseUrl}/api/import/batches`, { headers: { Cookie: outsiderCookie } });
      expect(res.status).toBe(403);
    });
  });

  describe("upload → L1 + L2", () => {
    it("captures every member row verbatim, flags the bad age, and seeds rules", async () => {
      const res = await upload(adminCookie);
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        data: { batch: { id: string; checkboxConventions: string[]; quarantinedCount: number }; counts: Record<string, number> };
      };
      batchId = body.data.batch.id;

      expect(body.data.counts.memberRows).toBe(4);
      expect(body.data.counts.normalized).toBe(3);
      expect(body.data.counts.quarantined).toBe(1);
      expect(body.data.counts.skipped).toBe(0); // nothing is ever silently dropped
      expect(body.data.batch.checkboxConventions).toEqual(["/", "1"]);

      const { eq: eqOp } = await import("drizzle-orm");
      const sourceRows = await db
        .select()
        .from(schema.importSourceRows)
        .where(eqOp(schema.importSourceRows.batchId, batchId));
      expect(sourceRows).toHaveLength(4);

      const good = sourceRows.find((row) => row.rawNickname === "หนู" && row.rawAge === "60.0");
      expect(good?.rawAge).toBe("60.0"); // L1 stays verbatim: not coerced
      expect(good?.team).toBe("ทะเบียนพันธกิจบ้าน กลุ่ม ก ทีม A");

      const quarantined = sourceRows.find((row) => row.normStatus === "quarantined");
      expect(quarantined?.normIssue).toBe("AGE_NOT_NUMERIC");
      expect(quarantined?.rawNickname).toBe("หมู"); // still in L1

      const normRows = await db
        .select({
          nickname: schema.importRowNorm.nickname,
          age: schema.importRowNorm.age,
          maritalCode: schema.importRowNorm.maritalCode,
        })
        .from(schema.importRowNorm)
        .innerJoin(schema.importSourceRows, eqOp(schema.importRowNorm.sourceRowId, schema.importSourceRows.id))
        .where(eqOp(schema.importSourceRows.batchId, batchId));
      expect(normRows).toHaveLength(3); // the quarantined row gets no L2 row
      const norm = normRows.find((row) => row.nickname === "หนู");
      expect(norm?.age).toBe(60); // L2 coerced
      expect(norm?.maritalCode).toBe("1"); // opaque raw token, not a domain value

      const rules = await db.select().from(schema.normalizationRules);
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every((rule) => rule.confirmedById === null)).toBe(true); // unconfirmed until a human says so
    });

    it("refuses a second upload of the same bytes with 409 and the existing batch id", async () => {
      const res = await upload(adminCookie);
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: { details: Array<{ field: string; message: string }> } };
      const detail = body.error.details.find((d) => d.field === "existingBatchId");
      expect(detail?.message).toBe(batchId);
    });

    it("rejects a non-.xlsx filename", async () => {
      const res = await upload(adminCookie, workbookBytes, "workbook.csv");
      expect(res.status).toBe(400);
    });
  });

  describe("reads (staff)", () => {
    it("lists the batch with counts", async () => {
      const res = await fetch(`${baseUrl}/api/import/batches`, { headers: { Cookie: staffCookie } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string }>; meta: { total: number } };
      expect(body.data.map((b) => b.id)).toContain(batchId);
      expect(body.meta.total).toBe(1);
    });

    it("previews raw beside normalized, and marks blocked fields", async () => {
      const res = await fetch(`${baseUrl}/api/import/batches/${batchId}/preview`, {
        headers: { Cookie: staffCookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { rows: Array<Record<string, any>>; blockedFields: Array<{ key: string }> };
      };
      expect(body.data.rows.length).toBe(4);
      expect(body.data.blockedFields.map((f) => f.key)).toEqual(["marital", "response", "participation", "goal"]);

      const quarantined = body.data.rows.find((row) => row.normStatus === "quarantined");
      expect(quarantined?.normIssue).toBe("AGE_NOT_NUMERIC");
      expect(quarantined?.norm).toBeNull(); // no L2 row for a quarantined row
    });

    it("returns a completeness report with skipped: 0 and the duplicate flagged", async () => {
      const res = await fetch(`${baseUrl}/api/import/batches/${batchId}/report`, {
        headers: { Cookie: staffCookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          counts: { skipped: number; quarantined: number; flaggedDuplicates: number };
          quarantinedIssues: Array<{ issue: string; rows: number }>;
          completeness: Record<string, { filled: number }>;
          duplicates: Array<{ nickname: string; occurrences: number }>;
        };
      };
      expect(body.data.counts.skipped).toBe(0);
      expect(body.data.counts.quarantined).toBe(1);
      expect(body.data.quarantinedIssues).toEqual([{ issue: "AGE_NOT_NUMERIC", rows: 1 }]);
      expect(body.data.completeness.nickname?.filled).toBe(4);
      expect(body.data.duplicates.map((d) => d.nickname)).toEqual(["หนู"]); // flagged, never merged
      expect(body.data.duplicates[0]?.occurrences).toBe(2);
    });

    it("exposes the duplicate review queue globally (with the never-merge note)", async () => {
      const res = await fetch(`${baseUrl}/api/import/duplicates`, { headers: { Cookie: staffCookie } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { duplicates: Array<{ nickname: string }>; note: string } };
      expect(body.data.duplicates.map((d) => d.nickname)).toEqual(["หนู"]);
      expect(body.data.note).toContain("ไม่รวมบันทึกอัตโนมัติ");
    });

    it("lists every occurrence of a flagged nickname with its verbatim L1 values", async () => {
      const res = await fetch(`${baseUrl}/api/import/duplicates`, { headers: { Cookie: staffCookie } });
      const body = (await res.json()) as {
        data: {
          duplicates: Array<{
            nickname: string;
            occurrences: number;
            members: Array<{ sheetName: string; excelRow: number; sourceFileName: string; rawAge: string | null; age: number | null }>;
          }>;
        };
      };
      const group = body.data.duplicates[0];
      expect(group.members).toHaveLength(group.occurrences);
      expect(group.members.every((m) => m.sourceFileName === "workbook.xlsx")).toBe(true);
      expect(group.members.map((m) => m.excelRow)).toEqual([...group.members.map((m) => m.excelRow)].sort((a, b) => a - b));
      expect(group.members.every((m) => typeof m.rawAge === "string" || m.rawAge === null)).toBe(true);
    });
  });

  describe("rule confirmation (admin only)", () => {
    it("rejects confirmation from a non-admin", async () => {
      const [rule] = await db.select().from(schema.normalizationRules).limit(1);
      const res = await fetch(`${baseUrl}/api/import/rules/${rule!.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: staffCookie },
        body: "{}",
      });
      expect(res.status).toBe(403);
    });

    it("records who confirmed a rule and when", async () => {
      const [rule] = await db.select().from(schema.normalizationRules).limit(1);
      const res = await fetch(`${baseUrl}/api/import/rules/${rule!.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: "{}",
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { confirmedById: string; confirmedAt: string } };
      expect(body.data.confirmedById).toBeTruthy();
      expect(body.data.confirmedAt).toBeTruthy();
    });

    it("404s an unknown rule id", async () => {
      const res = await fetch(`${baseUrl}/api/import/rules/00000000-0000-4000-8000-000000000000/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: "{}",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("duplicate decisions (append-only human judgement)", () => {
    type DupGroup = {
      nickname: string;
      members: Array<{ sourceRowId: string }>;
      decisions: Array<{ decision: string; note: string | null; matchesCurrentRows: boolean; decidedByName: string | null }>;
    };

    async function loadGroup(): Promise<DupGroup> {
      const res = await fetch(`${baseUrl}/api/import/duplicates`, { headers: { Cookie: adminCookie } });
      const body = (await res.json()) as { data: { duplicates: DupGroup[] } };
      return body.data.duplicates.find((g) => g.nickname === "หนู")!;
    }

    function decide(cookie: string | null, payload: unknown) {
      return fetch(`${baseUrl}/api/import/duplicates/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(payload),
      });
    }

    it("gates the write: 401 without a session, 403 for staff", async () => {
      const group = await loadGroup();
      const payload = { nickname: "หนู", sourceRowIds: group.members.map((m) => m.sourceRowId), decision: "same_person" };
      expect((await decide(null, payload)).status).toBe(401);
      expect((await decide(staffCookie, payload)).status).toBe(403);
    });

    it("starts with no decision on the group", async () => {
      expect((await loadGroup()).decisions).toEqual([]);
    });

    it("records a decision with who decided it, and it matches the current rows", async () => {
      const group = await loadGroup();
      const res = await decide(adminCookie, {
        nickname: "หนู",
        sourceRowIds: group.members.map((m) => m.sourceRowId),
        decision: "same_person",
        note: "ชื่อ-สกุลและอายุตรงกัน",
      });
      expect(res.status).toBe(201);

      const after = await loadGroup();
      expect(after.decisions).toHaveLength(1);
      expect(after.decisions[0]).toMatchObject({
        decision: "same_person",
        note: "ชื่อ-สกุลและอายุตรงกัน",
        matchesCurrentRows: true,
        decidedByName: "Admin",
      });
    });

    it("does not add a row for an identical repeated decision", async () => {
      const group = await loadGroup();
      const res = await decide(adminCookie, {
        nickname: "หนู",
        sourceRowIds: group.members.map((m) => m.sourceRowId),
        decision: "same_person",
        note: "ชื่อ-สกุลและอายุตรงกัน",
      });
      expect(res.status).toBe(200);
      expect((await loadGroup()).decisions).toHaveLength(1);
    });

    it("keeps history when the reviewer changes their mind (newest first)", async () => {
      const group = await loadGroup();
      const res = await decide(adminCookie, {
        nickname: "หนู",
        sourceRowIds: group.members.map((m) => m.sourceRowId),
        decision: "different_people",
      });
      expect(res.status).toBe(201);
      const after = await loadGroup();
      expect(after.decisions.map((d) => d.decision)).toEqual(["different_people", "same_person"]);
      expect(after.decisions.every((d) => d.matchesCurrentRows)).toBe(true);
    });

    it("rejects rows that do not share the nickname, unknown ids and a single row", async () => {
      const group = await loadGroup();
      const ids = group.members.map((m) => m.sourceRowId);
      const other = await db.select({ id: schema.importSourceRows.id, nickname: schema.importRowNorm.nickname })
        .from(schema.importSourceRows)
        .innerJoin(schema.importRowNorm, (await import("drizzle-orm")).eq(schema.importRowNorm.sourceRowId, schema.importSourceRows.id));
      const stranger = other.find((row) => row.nickname !== "หนู")!;

      expect((await decide(adminCookie, { nickname: "หนู", sourceRowIds: [ids[0], stranger.id], decision: "same_person" })).status).toBe(400);
      expect((await decide(adminCookie, { nickname: "หนู", sourceRowIds: [ids[0], "00000000-0000-4000-8000-000000000000"], decision: "same_person" })).status).toBe(400);
      expect((await decide(adminCookie, { nickname: "หนู", sourceRowIds: [ids[0]], decision: "same_person" })).status).toBe(400);
      expect((await decide(adminCookie, { nickname: "หนู", sourceRowIds: ids, decision: "merge" })).status).toBe(400);
    });

    it("stops matching once a later import adds a row to the group", async () => {
      const { eq: eqOp } = await import("drizzle-orm");
      const [batch] = await db
        .insert(schema.importBatches)
        .values({
          sourceFileName: "later.xlsx",
          fileChecksum: "later-upload-checksum",
          layoutVariants: [],
          checkboxConventions: [],
          worksheetCount: 1,
          rowCount: 1,
          memberCount: 1,
          normalizationVersion: 1,
        })
        .returning();
      const [row] = await db
        .insert(schema.importSourceRows)
        .values({ batchId: batch.id, sheetName: "กลุ่ม ข", excelRow: 4, rawNickname: "หนู", normStatus: "ok" })
        .returning();
      await db.insert(schema.importRowNorm).values({ sourceRowId: row.id, nickname: "หนู" });

      const group = await loadGroup();
      expect(group.members).toHaveLength(3);
      expect(group.decisions.length).toBeGreaterThan(0);
      expect(group.decisions.every((d) => d.matchesCurrentRows === false)).toBe(true);

      await db.delete(schema.importBatches).where(eqOp(schema.importBatches.id, batch.id));
    });

    it("never changes the import layers (L1/L2 row counts stay the same)", async () => {
      const [{ n: sourceBefore }] = await db.select({ n: sqlCount() }).from(schema.importSourceRows);
      const group = await loadGroup();
      await decide(adminCookie, {
        nickname: "หนู",
        sourceRowIds: group.members.map((m) => m.sourceRowId),
        decision: "same_person",
        note: "ตรวจซ้ำ",
      });
      const [{ n: sourceAfter }] = await db.select({ n: sqlCount() }).from(schema.importSourceRows);
      expect(Number(sourceAfter)).toBe(Number(sourceBefore));
    });
  });

  describe("group_members pre-check (Q2 gate, admin only, read-only)", () => {
    it("rejects the pre-check without a session", async () => {
      expect((await fetch(`${baseUrl}/api/import/precheck/group-members`)).status).toBe(401);
    });

    it("rejects the pre-check for a non-admin import reader", async () => {
      const res = await fetch(`${baseUrl}/api/import/precheck/group-members`, {
        headers: { Cookie: staffCookie },
      });
      expect(res.status).toBe(403);
    });

    it("rejects the pre-check for a plain member", async () => {
      const res = await fetch(`${baseUrl}/api/import/precheck/group-members`, {
        headers: { Cookie: outsiderCookie },
      });
      expect(res.status).toBe(403);
    });

    it("lets an admin read the report and a verdict", async () => {
      const res = await fetch(`${baseUrl}/api/import/precheck/group-members`, {
        headers: { Cookie: adminCookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: {
          report: {
            totalRows: number;
            activeRows: number;
            historicalRows: number;
            duplicateActivePairs: number;
            migrationBlocked: boolean;
          };
          gate: { verdict: string; migrationBlocked: boolean };
          note: string;
        };
      };
      expect(body.success).toBe(true);
      expect(body.data.note).toContain("read-only");
      expect(["CLEAR", "BLOCKED"]).toContain(body.data.gate.verdict);
      // The counts must add up: an inconsistent report must not authorise DDL.
      expect(body.data.report.totalRows).toBe(
        body.data.report.activeRows + body.data.report.historicalRows,
      );
      expect(body.data.gate.migrationBlocked).toBe(body.data.report.duplicateActivePairs > 0);
      expect(body.data.gate.migrationBlocked).toBe(body.data.report.migrationBlocked);
    });

    it("reports the rows it actually found, so an empty database is distinguishable", async () => {
      const res = await fetch(`${baseUrl}/api/import/precheck/group-members`, {
        headers: { Cookie: adminCookie },
      });
      const body = (await res.json()) as {
        data: { report: { totalRows: number }; gate: { verdict: string } };
      };
      const [row] = await db.select({ total: sqlCount() }).from(schema.groupMembers);
      expect(body.data.report.totalRows).toBe(Number(row?.total ?? 0));
      // No duplicate active pair can exist yet: the FULL unique index forbids it.
      expect(body.data.gate.verdict).toBe("CLEAR");
    });
  });
});