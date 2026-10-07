/**
 * Fixture-free tests for the read-only workbook audit logic.
 *
 * No .xlsx fixture is committed: the workbooks are external, large, and would
 * make the suite depend on files outside the repository. These tests instead
 * synthesize row arrays that reproduce the STRUCTURAL properties the audit
 * claims to handle (merged group headers, a title row above the table, both
 * documented marker tokens, blank trailing rows).
 */
import { describe, expect, it } from "vitest";

import {
  analyzeSheet,
  buildAuditReport,
  buildEffectiveHeader,
  cellText,
  columnVariantKey,
  detectLayout,
  extractMemberRows,
  isMemberRow,
  normalizeHeaderText,
  resolveHeader,
  sumCheckboxFillRates,
  sumFillRates,
  type FileAudit,
  type SheetAnalysis,
} from "./missionExcel";

/** A header band shaped like the real sheets: group headers span options. */
const HEADER_A = [
  "ที่",
  "ชื่อ-สกุล",
  "ชื่อเล่น",
  "อายุ",
  "อาชีพ (ระบุ)",
  "สถานที่เรียน / ทำงาน",
  "สถานภาพครอบครัว",
  "",
  "",
  "วันรับเชื่อ",
  "ท่าทีการตอบสนอง",
  "",
  "การเข้าร่วมกลุ่ม",
  "",
  "เป้าหมายในการสร้าง",
];

function memberRow(
  seq: string,
  fullName: string,
  nickname: string,
  age: string,
  goal: string,
  markers: Record<number, string>
): string[] {
  const row = new Array(HEADER_A.length).fill("");
  row[0] = seq;
  row[1] = fullName;
  row[2] = nickname;
  row[3] = age;
  row[6] = "";
  row[9] = "";
  row[14] = goal;
  for (const [index, value] of Object.entries(markers)) {
    row[Number(index)] = value;
  }
  return row;
}

describe("header resolution", () => {
  it("resolves fields by header text, not by column letter", () => {
    const layout = resolveHeader([HEADER_A], 0);
    expect(layout.columns.nickname).toBe(2);
    expect(layout.columns.goal).toBe(14);
    expect(layout.resolvedFieldCount).toBeGreaterThanOrEqual(9);
  });

  it("resolves the same fields when the table is shifted to different columns", () => {
    const shifted = ["", "", "", "", ...HEADER_A];
    const layout = resolveHeader([shifted], 0);
    // Same field set, different column index — that is the whole point.
    expect(layout.signature).toBe(resolveHeader([HEADER_A], 0).signature);
    expect(layout.columns.nickname).toBe(6);
  });

  it("carries a merged group header forward across its blank option columns", () => {
    const effective = buildEffectiveHeader([HEADER_A]);
    expect(effective[6]).toBe("สถานภาพครอบครัว");
    expect(effective[7]).toBe("สถานภาพครอบครัว");
    expect(effective[8]).toBe("สถานภาพครอบครัว");
  });

  it("groups every option column of a checkbox field", () => {
    const layout = resolveHeader([HEADER_A], 0);
    expect(layout.checkboxColumns.marital).toEqual([6, 7, 8]);
    expect(layout.checkboxColumns.response).toEqual([10, 11]);
    expect(layout.checkboxColumns.participation).toEqual([12, 13]);
  });

  it("never lets a nickname column be claimed as the legal-name column", () => {
    const layout = resolveHeader([HEADER_A], 0);
    expect(layout.columns.fullName).toBe(1);
    expect(layout.columns.nickname).toBe(2);
  });

  it("keeps unmatched header labels instead of discarding them", () => {
    const layout = resolveHeader([HEADER_A, ["หมายเหตุเพิ่มเติม"]], 1);
    expect(layout.unmatchedLabels).toContain("หมายเหตุเพิ่มเติม");
  });

  it("finds the member table below a title row", () => {
    const rows = [["ทะเบียนพันธกิจบ้าน"], ["กลุ่ม ก"], HEADER_A, memberRow("1", "", "หนู", "40", "ผู้เชื่อผูกพัน", {})];
    const layout = detectLayout(rows);
    expect(layout?.headerRowIndex).toBe(2);
  });

  it("returns null when no header field matches at all", () => {
    expect(detectLayout([["บันทึกรายงาน"], ["สรุปปี 2568"]])).toBeNull();
  });
});

describe("raw value preservation", () => {
  it("keeps checkbox markers verbatim and never maps them to meaning", () => {
    const rows = [
      HEADER_A,
      memberRow("1", "", "หนู", "40", "ผู้เชื่อผูกพัน", { 7: "1" }),
      memberRow("2", "", "หมู", "50", "ผู้ประสานงาน", { 11: "/" }),
    ];
    const [first, second] = extractMemberRows(rows);
    expect(first?.checkboxMarkers.marital).toEqual(["", "1", ""]);
    // `response` spans columns 10–11, so a marker at index 11 is its 2nd option.
    expect(second?.checkboxMarkers.response).toEqual(["", "/"]);
  });

  it("records a marker token exactly as written, whitespace included", () => {
    const rows = [HEADER_A, memberRow("1", "", "หนู", "40", "x", { 6: " 1 " })];
    const analysis = analyzeSheet("S1", rows);
    expect(analysis.checkboxValueCounts["1"]).toBe(1);
  });

  it("preserves raw age text instead of coercing it to a number", () => {
    const rows = [HEADER_A, memberRow("1", "", "หนู", " 60.0 ", "x", {})];
    const [first] = extractMemberRows(rows);
    expect(first?.rawValues.age).toBe(" 60.0 ");
  });

  it("never turns a nickname into a full name", () => {
    const rows = [HEADER_A, memberRow("1", "", "หนู", "40", "x", {})];
    const [first] = extractMemberRows(rows);
    expect(first?.rawValues.fullName).toBe("");
    expect(first?.rawValues.nickname).toBe("หนู");
  });

  it("keeps every distinct goal spelling as its own entry", () => {
    const rows = [
      HEADER_A,
      memberRow("1", "", "หนู", "40", "ผู้เชื่อผูกพัน", {}),
      memberRow("2", "", "หมู", "40", "ผู้เชื่อผุกพัน", {}),
      memberRow("3", "", "บิ้น", "40", "ผู้เชื่อผูกพัน", {}),
    ];
    const analysis = analyzeSheet("S1", rows);
    expect(Object.keys(analysis.goalVariants).sort()).toEqual(["ผู้เชื่อผุกพัน", "ผู้เชื่อผูกพัน"]);
    expect(analysis.goalVariants["ผู้เชื่อผูกพัน"]).toBe(2);
  });
});

describe("member row detection", () => {
  it("counts a row as a member only when the nickname cell is non-empty", () => {
    const layout = resolveHeader([HEADER_A], 0);
    expect(isMemberRow(memberRow("1", "", "หนู", "40", "x", {}), layout)).toBe(true);
    expect(isMemberRow(memberRow("2", "สมชาย ใจดี", "", "40", "x", {}), layout)).toBe(false);
  });

  it("ignores blank and footer rows below the table", () => {
    const rows = [
      HEADER_A,
      memberRow("1", "", "หนู", "40", "x", {}),
      new Array(HEADER_A.length).fill(""),
      ["รวม", "", "", "", "", "", "", "", "", "", "", "", "", "", "10 คน"],
    ];
    expect(analyzeSheet("S1", rows).memberRowCount).toBe(1);
  });

  it("reports data rows including blanks, separately from member rows", () => {
    const rows = [
      HEADER_A,
      memberRow("1", "", "หนู", "40", "x", {}),
      new Array(HEADER_A.length).fill(""),
      new Array(HEADER_A.length).fill(""),
    ];
    const analysis = analyzeSheet("S1", rows);
    expect(analysis.memberRowCount).toBe(1);
    expect(analysis.dataRowCount).toBe(3);
  });
});

describe("fill rates and checkbox tallies", () => {
  const rows = [
    HEADER_A,
    memberRow("1", "สมชาย ใจดี", "หนู", "40", "ผู้เชื่อผูกพัน", { 7: "1" }),
    memberRow("2", "", "หมู", "", "ผู้เชื่อผูกพัน", { 11: "/" }),
    memberRow("3", "", "บิ้น", "25", "", { 7: "1", 13: "?" }),
  ];

  it("computes fill rates over member rows only", () => {
    const analysis = analyzeSheet("S1", rows);
    expect(analysis.memberRowCount).toBe(3);
    expect(analysis.fillRates.nickname).toEqual({ filled: 3, empty: 0, filledPct: 100 });
    expect(analysis.fillRates.fullName).toEqual({ filled: 1, empty: 2, filledPct: 33.3 });
    expect(analysis.fillRates.age).toEqual({ filled: 2, empty: 1, filledPct: 66.7 });
    expect(analysis.fillRates.goal).toEqual({ filled: 2, empty: 1, filledPct: 66.7 });
  });

  it("tallies both documented marker tokens without assigning meaning", () => {
    const analysis = analyzeSheet("S1", rows);
    expect(analysis.checkboxValueCounts["1"]).toBe(2);
    expect(analysis.checkboxValueCounts["/"]).toBe(1);
  });

  it("flags an unrecognised token instead of silently dropping it", () => {
    const analysis = analyzeSheet("S1", rows);
    expect(analysis.unrecognizedCheckboxValues["?"]).toBe(1);
    expect(analysis.unrecognizedCheckboxValues["1"]).toBeUndefined();
    expect(analysis.unrecognizedCheckboxValues["/"]).toBeUndefined();
  });

  it("returns an empty analysis for a sheet with no resolvable header", () => {
    const analysis = analyzeSheet("หนองบัว new", [["คีย์", "ค่า"], ["ชื่อกลุ่ม", "ก"]]);
    expect(analysis.layout).toBeNull();
    expect(analysis.memberRowCount).toBe(0);
  });

  it("sums fill rates across sheets", () => {
    const a = analyzeSheet("A", rows);
    const b = analyzeSheet("B", [HEADER_A, memberRow("1", "", "หนู", "40", "x", {})]);
    const totals = sumFillRates([a, b] as SheetAnalysis[]);
    expect(totals.nickname).toEqual({ filled: 4, empty: 0, filledPct: 100 });
    expect(totals.fullName?.filled).toBe(1);
  });

  it("counts a checkbox group as filled when any option column has a marker", () => {
    const analysis = analyzeSheet("S1", rows);
    // marital: row1 and row3 marked; response: row2 marked.
    expect(analysis.checkboxFillRates.marital).toEqual({ filled: 2, empty: 1, filledPct: 66.7 });
    expect(analysis.checkboxFillRates.response).toEqual({ filled: 1, empty: 2, filledPct: 33.3 });
  });

  it("counts a marker in any option column, not only the first", () => {
    const rows2 = [HEADER_A, memberRow("1", "", "หนู", "40", "x", { 8: "1" })];
    expect(analyzeSheet("S1", rows2).checkboxFillRates.marital?.filled).toBe(1);
  });

  it("sums checkbox group fill rates across sheets", () => {
    const a = analyzeSheet("A", rows);
    const b = analyzeSheet("B", [HEADER_A, memberRow("1", "", "หนู", "40", "x", { 7: "1" })]);
    const totals = sumCheckboxFillRates([a, b] as SheetAnalysis[]);
    expect(totals.marital?.filled).toBe(3);
  });
});

describe("duplicate file detection", () => {
  const sheet = (name: string) => analyzeSheet(name, [HEADER_A, memberRow("1", "", "หนู", "40", "x", {})]);

  function fileAudit(fileName: string, contentHash: string, sheets: SheetAnalysis[]): FileAudit {
    return {
      fileName,
      fileSizeBytes: 1000,
      contentHash,
      duplicateOf: [],
      isDuplicate: false,
      worksheetCount: sheets.length,
      worksheetNames: sheets.map((s) => s.sheetName),
      sheets,
      memberRowCount: sheets.reduce((sum, s) => sum + s.memberRowCount, 0),
    };
  }

  it("groups files that share identical bytes", () => {
    const report = buildAuditReport([
      fileAudit("a.xlsx", "hash-1", [sheet("S1")]),
      fileAudit("b.xlsx", "hash-1", [sheet("S1")]),
      fileAudit("c.xlsx", "hash-2", [sheet("S1")]),
    ]);
    expect(report.duplicateGroups).toEqual([["a.xlsx", "b.xlsx"]]);
    expect(report.totals.uniqueFiles).toBe(2);
  });

  it("counts member rows per unique file so a duplicate is not double counted", () => {
    const report = buildAuditReport([
      fileAudit("a.xlsx", "hash-1", [sheet("S1")]),
      fileAudit("b.xlsx", "hash-1", [sheet("S1")]),
    ]);
    expect(report.totals.memberRowsAllFiles).toBe(2);
    expect(report.totals.memberRowsUniqueFiles).toBe(1);
  });

  it("marks each member of a duplicate group", () => {
    const report = buildAuditReport([
      fileAudit("a.xlsx", "hash-1", [sheet("S1")]),
      fileAudit("b.xlsx", "hash-1", [sheet("S1")]),
    ]);
    expect(report.files[0]?.isDuplicate).toBe(true);
    expect(report.files[0]?.duplicateOf).toEqual(["b.xlsx"]);
  });

  it("lists every distinct structural signature actually observed", () => {
    const report = buildAuditReport([
      fileAudit("a.xlsx", "hash-1", [sheet("S1")]),
      fileAudit("b.xlsx", "hash-2", [analyzeSheet("S2", [["บันทึก"], ["รวม 10"]]) ]),
    ]);
    expect(report.totals.layoutsObserved).toHaveLength(1);
    expect(report.totals.sheetsWithoutLayout).toEqual(["S2"]);
  });

  it("reports a distinct column-position variant for a shifted table", () => {
    const shifted = ["", "", "", "", ...HEADER_A];
    const sameOffset = buildAuditReport([fileAudit("a.xlsx", "h1", [sheet("S1")])]);
    const differentOffset = buildAuditReport([
      fileAudit("a.xlsx", "h1", [sheet("S1")]),
      fileAudit("b.xlsx", "h2", [analyzeSheet("S2", [shifted, memberRow("1", "", "หนู", "40", "x", {})])]),
    ]);
    expect(sameOffset.totals.columnVariantsObserved).toHaveLength(1);
    expect(differentOffset.totals.columnVariantsObserved).toHaveLength(2);
    // Both still share ONE structural signature — detection is header-driven.
    expect(differentOffset.totals.layoutsObserved).toHaveLength(1);
  });
});

describe("value helpers", () => {
  it("collapses whitespace for header comparison", () => {
    expect(normalizeHeaderText("  ชื่อ   เล่น  ")).toBe("ชื่อ เล่น");
  });

  it("renders null, undefined and Date cells as text without mutating them", () => {
    expect(cellText(null)).toBe("");
    expect(cellText(undefined)).toBe("");
    expect(cellText(42)).toBe("42");
    expect(cellText(new Date("2020-01-02T03:04:05.000Z"))).toBe("2020-01-02T03:04:05.000Z");
  });

  it("reads the visible text of rich text, hyperlink, formula and error cells (never \"[object Object]\")", () => {
    expect(cellText({ richText: [{ text: "ปุก" }, { text: "กี้", font: { bold: true } }] })).toBe("ปุกกี้");
    expect(cellText({ text: "ลิงก์", hyperlink: "https://example.com" })).toBe("ลิงก์");
    expect(cellText({ formula: "A1+1", result: 5 })).toBe("5");
    expect(cellText({ sharedFormula: "A1", result: "ผล" })).toBe("ผล");
    expect(cellText({ error: "#N/A" })).toBe("#N/A");
    expect(cellText({ richText: [] })).toBe("");
    expect(cellText({ something: "else" })).toBe("");
    expect(cellText({ richText: [{ text: "a" }] })).not.toContain("[object");
  });

  it("gives the same column variant key for identical column maps", () => {
    const a = resolveHeader([HEADER_A], 0);
    const b = resolveHeader([HEADER_A], 0);
    expect(columnVariantKey(a)).toBe(columnVariantKey(b));
  });

  it("gives a different column variant key when the table is shifted", () => {
    const a = resolveHeader([HEADER_A], 0);
    const b = resolveHeader([["", "", "", "", ...HEADER_A]], 0);
    expect(columnVariantKey(a)).not.toBe(columnVariantKey(b));
  });
});