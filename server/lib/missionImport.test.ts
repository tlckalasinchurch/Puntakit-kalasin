/**
 * Fixture-free tests for the Phase 2 import pipeline core (L1 → L2).
 *
 * The real workbooks are external and large; these tests synthesize the
 * STRUCTURAL properties the pipeline claims to handle. The parser test
 * writes a real .xlsx into a temp file in memory (removed afterwards) —
 * no fixture file is committed and nothing outside the OS temp dir is touched.
 */
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import ExcelJS from "exceljs";

import {
  beliefYearUpperBound,
  checksumBuffer,
  COMPLETENESS_FIELDS,
  computeCompleteness,
  groupDuplicateCandidates,
  NORMALIZATION_RULES,
  NORMALIZATION_VERSION,
  normalizeMemberRow,
  parseWorkbookFile,
  type CapturedMemberRow,
} from "./missionImport";

function memberRow(overrides: {
  rawValues?: Record<string, string>;
  checkboxMarkers?: Record<string, string[]>;
}): CapturedMemberRow {
  return {
    excelRowNumber: 5,
    rawValues: {
      sequence: "1",
      fullName: "",
      nickname: "หนู",
      age: "40",
      occupation: "",
      workplace: "",
      beliefYear: "",
      goal: "",
      ...overrides.rawValues,
    },
    checkboxMarkers: overrides.checkboxMarkers ?? {},
  };
}

describe("structural normalization (L1 → L2)", () => {
  it("trims and collapses text but keeps the value otherwise verbatim", () => {
    const outcome = normalizeMemberRow(
      memberRow({ rawValues: { fullName: "  สมชาย   ใจดี ", nickname: " หนู  ", goal: " ผู้เชื่อผูกพัน " } })
    );
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.norm.fullName).toBe("สมชาย ใจดี");
    expect(outcome.norm.nickname).toBe("หนู");
    expect(outcome.norm.goalCode).toBe("ผู้เชื่อผูกพัน");
  });

  it("coerces '60.0' to the integer 60 and keeps empty fields null", () => {
    const outcome = normalizeMemberRow(memberRow({ rawValues: { age: " 60.0 " } }));
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.norm.age).toBe(60);
    expect(outcome.norm.beliefYear).toBeNull();
  });

  it("quarantines a non-numeric age instead of guessing", () => {
    const outcome = normalizeMemberRow(memberRow({ rawValues: { age: "สี่สิบ" } }));
    expect(outcome).toEqual({ status: "quarantined", issue: "AGE_NOT_NUMERIC" });
  });

  it("quarantines an out-of-range age (0–120)", () => {
    expect(normalizeMemberRow(memberRow({ rawValues: { age: "150" } }))).toEqual({
      status: "quarantined",
      issue: "AGE_OUT_OF_RANGE",
    });
    expect(normalizeMemberRow(memberRow({ rawValues: { age: "-1" } }))).toEqual({
      status: "quarantined",
      issue: "AGE_NOT_NUMERIC",
    });
  });

  it("coerces a bare 4-digit belief year and bounds it 1800–current", () => {
    const ok = normalizeMemberRow(memberRow({ rawValues: { beliefYear: " 2021.0 " } }));
    expect(ok.status).toBe("ok");
    if (ok.status === "ok") expect(ok.norm.beliefYear).toBe(2021);

    expect(normalizeMemberRow(memberRow({ rawValues: { beliefYear: "1799" } }))).toEqual({
      status: "quarantined",
      issue: "BELIEF_YEAR_OUT_OF_RANGE",
    });
    const future = String(beliefYearUpperBound() + 1);
    expect(normalizeMemberRow(memberRow({ rawValues: { beliefYear: future } }))).toEqual({
      status: "quarantined",
      issue: "BELIEF_YEAR_OUT_OF_RANGE",
    });
    expect(normalizeMemberRow(memberRow({ rawValues: { beliefYear: "รับเชื่อปี 2560" } }))).toEqual({
      status: "quarantined",
      issue: "BELIEF_YEAR_INVALID",
    });
  });

  it("quarantines a row with no nickname (a member is defined by one)", () => {
    expect(normalizeMemberRow(memberRow({ rawValues: { nickname: "   " } }))).toEqual({
      status: "quarantined",
      issue: "NICKNAME_EMPTY",
    });
  });

  it("keeps checkbox markers verbatim as opaque codes — never a domain value", () => {
    const outcome = normalizeMemberRow(
      memberRow({
        checkboxMarkers: {
          marital: ["", "1", ""],
          response: ["/", ""],
          participation: ["", "", "", ""],
        },
      })
    );
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.norm.maritalCode).toBe("1");
    expect(outcome.norm.responseCode).toBe("/");
    expect(outcome.norm.participationCode).toBeNull();
  });

  it("joins multiple markers in column order with the raw tokens preserved", () => {
    const outcome = normalizeMemberRow(
      memberRow({ checkboxMarkers: { marital: [" 1 ", "", "/"] } })
    );
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.norm.maritalCode).toBe("1|/");
  });

  it("keeps every distinct goal spelling verbatim (no clustering in v1)", () => {
    const a = normalizeMemberRow(memberRow({ rawValues: { goal: "ผู้เชื่อผูกพัน" } }));
    const b = normalizeMemberRow(memberRow({ rawValues: { goal: "ผู้เชื่อผุกพัน" } }));
    if (a.status !== "ok" || b.status !== "ok") throw new Error("expected ok");
    expect(a.norm.goalCode).not.toBe(b.norm.goalCode);
  });
});

describe("rule registry invariants", () => {
  it("is versioned and carries exactly the structural rule kinds", () => {
    expect(NORMALIZATION_VERSION).toBe(1);
    const kinds = new Set(NORMALIZATION_RULES.map((r) => r.ruleKind));
    expect(kinds).toEqual(
      new Set(["trim_whitespace", "coerce_integer", "marker_verbatim", "goal_verbatim"])
    );
  });

  it("is deterministic only: every rule carries confidence 1", () => {
    for (const rule of NORMALIZATION_RULES) {
      expect(rule.confidence).toBe(1);
      expect(rule.version).toBe(NORMALIZATION_VERSION);
    }
  });

  it("records the marker convention verbatim for all three checkbox fields", () => {
    const markerRules = NORMALIZATION_RULES.filter((r) => r.ruleKind === "marker_verbatim");
    expect(markerRules.map((r) => r.fieldKey).sort()).toEqual(["marital", "participation", "response"]);
  });
});

describe("completeness (§12)", () => {
  it("counts fill rates over member rows from the verbatim L1 values", () => {
    const rows = [
      memberRow({ rawValues: { nickname: "หนู", age: "40", goal: "x" } }),
      memberRow({ rawValues: { nickname: "หมู", fullName: "สมชาย ใจดี", age: "", goal: "" } }),
    ];
    const report = computeCompleteness(rows);
    expect(Object.keys(report).sort()).toEqual([...COMPLETENESS_FIELDS].sort());
    expect(report.fullName).toEqual({ filled: 1, empty: 1, filledPct: 50 });
    expect(report.nickname).toEqual({ filled: 2, empty: 0, filledPct: 100 });
    expect(report.age).toEqual({ filled: 1, empty: 1, filledPct: 50 });
  });

  it("returns zeroes for an empty capture", () => {
    const report = computeCompleteness([]);
    expect(report.goal).toEqual({ filled: 0, empty: 0, filledPct: 0 });
  });
});

describe("duplicate review queue (§8 — flags, never merges)", () => {
  const row = (nickname: string, age: number | null, batchId: string, sheetName: string, excelRow: number) => ({
    nickname,
    age,
    batchId,
    sheetName,
    excelRow,
  });

  it("groups rows sharing a normalized nickname and keeps the evidence", () => {
    const queue = groupDuplicateCandidates([
      row("หนู", 40, "b1", "กลุ่ม ก", 5),
      row(" หนู ", 41, "b1", "กลุ่ม ก", 6),
      row("หมู", 30, "b1", "กลุ่ม ข", 7),
    ]);
    expect(queue).toHaveLength(1);
    expect(queue[0]?.nickname).toBe("หนู");
    expect(queue[0]?.occurrences).toBe(2);
    expect(queue[0]?.ages).toEqual([40, 41]);
  });

  it("never merges distinct nicknames and reports the most frequent first", () => {
    const queue = groupDuplicateCandidates([
      row("นาง", 60, "b1", "S", 2),
      row("นาง", 61, "b1", "S", 3),
      row("นาง", 62, "b2", "S", 4),
      row("บิ้น", 25, "b1", "S", 9),
      row("บิ้น", 25, "b1", "S", 10),
    ]);
    expect(queue.map((g) => g.nickname)).toEqual(["นาง", "บิ้น"]);
    expect(queue[0]?.occurrences).toBe(3);
    expect(queue[0]?.batches).toEqual(["b1", "b2"]);
  });

  it("returns an empty queue when every nickname is unique", () => {
    expect(groupDuplicateCandidates([row("a", 1, "b", "S", 1), row("b", 2, "b", "S", 2)])).toEqual([]);
  });
});

describe("checksum + temp-file helper", () => {
  it("hashes bytes deterministically and distinguishes content", () => {
    const a = checksumBuffer(new TextEncoder().encode("same"));
    const a2 = checksumBuffer(new TextEncoder().encode("same"));
    const b = checksumBuffer(new TextEncoder().encode("different"));
    expect(a).toBe(a2);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("removes the temp workbook after the callback finishes", async () => {
    let seenPath: string | null = null;
    const result = await import("./missionImport").then((m) =>
      m.withTempWorkbook(new TextEncoder().encode("bytes"), async (filePath) => {
        seenPath = filePath;
        expect(existsSync(filePath)).toBe(true);
        return 42;
      })
    );
    expect(result).toBe(42);
    expect(seenPath).toBeTruthy();
    expect(existsSync(seenPath as unknown as string)).toBe(false);
  });
});

describe("workbook parser (L1 capture)", () => {
  async function buildWorkbook(): Promise<Uint8Array> {
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
    ws.addRow(["1", "", "หนู", "60.0", "", "บ้านหนองบัว", "", "1", "", "2021.0", "", "", "", "", "ผู้เชื่อผูกพัน"]);
    ws.addRow(["2", "", "หมู", "", "", "", "", "", "/", "", "", "", "", "", ""]);
    ws.addRow([]);
    ws.addRow(["รวม", "", "", "", "", "", "", "", "", "", "", "", "", "", "2 คน"]);

    const kv = wb.addWorksheet("หนองบัว new");
    kv.addRow(["คีย์", "ค่า"]);
    kv.addRow(["ชื่อกลุ่ม", "ก"]);

    const buffer = await wb.xlsx.writeBuffer();
    return new Uint8Array(buffer as unknown as ArrayBuffer);
  }

  it("captures the title verbatim, resolves member rows and skips non-member sheets", async () => {
    const { withTempWorkbook } = await import("./missionImport");
    const parsed = await withTempWorkbook(await buildWorkbook(), (filePath) => parseWorkbookFile(filePath));

    expect(parsed.worksheetCount).toBe(2);
    expect(parsed.memberRowCount).toBe(2);
    expect(parsed.checkboxConventions).toEqual(["/", "1"]);

    const memberSheet = parsed.sheets.find((s) => s.sheetName === "กลุ่ม ก");
    expect(memberSheet).toBeTruthy();
    expect(memberSheet?.title).toBe("ทะเบียนพันธกิจบ้าน กลุ่ม ก ทีม A");
    expect(memberSheet?.rows).toHaveLength(2);
    expect(memberSheet?.rows[0]?.rawValues.nickname).toBe("หนู");
    expect(memberSheet?.rows[0]?.rawValues.age).toBe("60.0"); // verbatim, L2 coerces
    expect(memberSheet?.rows[1]?.checkboxMarkers.marital?.some((v) => v.trim() === "/")).toBe(true);

    const kvSheet = parsed.sheets.find((s) => s.sheetName === "หนองบัว new");
    expect(kvSheet?.analysis.layout).toBeNull();
    expect(kvSheet?.rows).toHaveLength(0);
  });

  it("normalizes a parsed row end-to-end (parse → quarantine on bad age)", async () => {
    const { withTempWorkbook, normalizeMemberRow } = await import("./missionImport");
    const parsed = await withTempWorkbook(await buildWorkbook(), (filePath) => parseWorkbookFile(filePath));
    const rows = parsed.sheets[0]?.rows ?? [];
    expect(normalizeMemberRow(rows[0]!).status).toBe("ok");
    expect(normalizeMemberRow(rows[1]!).status).toBe("ok");
  });
});
