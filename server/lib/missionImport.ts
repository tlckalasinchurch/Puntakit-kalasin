import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import ExcelJS from "exceljs";

import { analyzeSheet, cellText, normalizeHeaderText, type SheetAnalysis } from "./missionExcel.js";

/**
 * Phase 2 mission import pipeline core: L1 capture + L2 structural
 * normalization.
 *
 * Layer contract (docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md §1, §6, §12):
 *
 *  - L1 (`import_source_rows`) stores verbatim cells. This module is the only
 *    writer and it never edits what it captured.
 *  - L2 (`import_row_norm`) applies STRUCTURAL cleanup only: trim/collapse,
 *    integer coercion, marker recording. No business meaning is assigned —
 *    every `*Code` output is the raw token(s), opaque until a human confirms
 *    a rule (Q5/Q6). The goal spelling is kept verbatim; clustering needs a
 *    human decision (§ Out of scope).
 *  - A row that fails a structural rule is QUARANTINED: it stays in L1, gets
 *    no L2 row, and appears in the report. Nothing is silently dropped (§12:
 *    "Skipped: 0").
 */

export const NORMALIZATION_VERSION = 1;

/** Current-year bound for belief-year validation, evaluated at run time. */
export function beliefYearUpperBound(now: Date = new Date()): number {
  return now.getUTCFullYear();
}

/** The deterministic structural rule set behind L2, versioned (§6). */
export type NormalizationRuleSeed = {
  version: number;
  fieldKey: string;
  layoutVariant: string;
  ruleKind: string;
  fromPattern: string | null;
  toCode: string | null;
  confidence: number;
};

export const NORMALIZATION_RULES: readonly NormalizationRuleSeed[] = [
  // Trim + collapse inner whitespace on every text field (the ONLY text
  // transformation the Phase 1 module performs, applied here for L2).
  {
    version: NORMALIZATION_VERSION,
    fieldKey: "*",
    layoutVariant: "*",
    ruleKind: "trim_whitespace",
    fromPattern: "\\s+",
    toCode: " ",
    confidence: 1,
  },
  // Age: "60.0" → 60; anything non-numeric or out of 0–120 quarantines (§12).
  {
    version: NORMALIZATION_VERSION,
    fieldKey: "age",
    layoutVariant: "*",
    ruleKind: "coerce_integer",
    fromPattern: "^\\d+(\\.0+)?$",
    toCode: "integer",
    confidence: 1,
  },
  // Belief year: bare 4-digit year, 1800–current; never a fabricated date.
  {
    version: NORMALIZATION_VERSION,
    fieldKey: "beliefYear",
    layoutVariant: "*",
    ruleKind: "coerce_integer",
    fromPattern: "^\\d{4}(\\.0+)?$",
    toCode: "integer",
    confidence: 1,
  },
  // Checkbox markers are recorded VERBATIM per convention (§6). The token
  // stays the token: `1` and `/` never become domain values.
  {
    version: NORMALIZATION_VERSION,
    fieldKey: "marital",
    layoutVariant: "*",
    ruleKind: "marker_verbatim",
    fromPattern: "^(1|/)$",
    toCode: "verbatim",
    confidence: 1,
  },
  {
    version: NORMALIZATION_VERSION,
    fieldKey: "response",
    layoutVariant: "*",
    ruleKind: "marker_verbatim",
    fromPattern: "^(1|/)$",
    toCode: "verbatim",
    confidence: 1,
  },
  {
    version: NORMALIZATION_VERSION,
    fieldKey: "participation",
    layoutVariant: "*",
    ruleKind: "marker_verbatim",
    fromPattern: "^(1|/)$",
    toCode: "verbatim",
    confidence: 1,
  },
  // Goal spellings are kept verbatim. Clustering variants needs a human
  // decision, so there is deliberately no similarity rule in v1.
  {
    version: NORMALIZATION_VERSION,
    fieldKey: "goal",
    layoutVariant: "*",
    ruleKind: "goal_verbatim",
    fromPattern: "^.+$",
    toCode: "verbatim",
    confidence: 1,
  },
];

/** The verbatim member row as captured from a worksheet (Phase 1 shape). */
export type CapturedMemberRow = {
  excelRowNumber: number;
  rawValues: Record<string, string>;
  checkboxMarkers: Record<string, string[]>;
};

/** A sheet's captured context: verbatim title + the Phase 1 analysis. */
export type CapturedSheet = {
  sheetName: string;
  /** Verbatim first non-empty cell above the resolved header. Never parsed. */
  title: string | null;
  analysis: SheetAnalysis;
  rows: CapturedMemberRow[];
};

export type ParsedWorkbook = {
  sheets: CapturedSheet[];
  checkboxConventions: string[];
  worksheetCount: number;
  dataRowCount: number;
  memberRowCount: number;
};

export type NormalizedRow = {
  fullName: string | null;
  nickname: string | null;
  age: number | null;
  occupation: string | null;
  workplace: string | null;
  beliefYear: number | null;
  maritalCode: string | null;
  responseCode: string | null;
  participationCode: string | null;
  goalCode: string | null;
};

export type NormalizationOutcome =
  | { status: "ok"; norm: NormalizedRow }
  | { status: "quarantined"; issue: string };

const AGE_PATTERN = /^\d+(\.0+)?$/;
const YEAR_PATTERN = /^\d{4}(\.0+)?$/;

function trimmedOrNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = normalizeHeaderText(value);
  return trimmed === "" ? null : trimmed;
}

/**
 * Joins a group's per-option markers into one opaque L2 code. Only non-empty
 * tokens are joined (the L1 checkbox array preserves positions), and the
 * tokens stay exactly as written.
 */
function opaqueMarkerCode(markers: string[] | undefined): string | null {
  if (!markers) return null;
  const tokens = markers.map((m) => m.trim()).filter((m) => m !== "");
  if (tokens.length === 0) return null;
  return tokens.join("|");
}

/**
 * Structural L1 → L2. Deterministic; no meaning is decided here.
 */
export function normalizeMemberRow(row: CapturedMemberRow, now: Date = new Date()): NormalizationOutcome {
  const nickname = trimmedOrNull(row.rawValues.nickname);
  if (!nickname) {
    // §12: a row without a nickname is not a member row; the capture layer
    // should never hand one over, so treat it as a quarantine, not a crash.
    return { status: "quarantined", issue: "NICKNAME_EMPTY" };
  }

  // Age coercion (§6: "60.0" → 60; reject non-numeric).
  let age: number | null = null;
  const rawAge = trimmedOrNull(row.rawValues.age);
  if (rawAge !== null) {
    if (!AGE_PATTERN.test(rawAge)) return { status: "quarantined", issue: "AGE_NOT_NUMERIC" };
    age = Number.parseInt(rawAge, 10);
    if (age < 0 || age > 120) return { status: "quarantined", issue: "AGE_OUT_OF_RANGE" };
  }

  // Belief year coercion: a bare year, never a fabricated date.
  let beliefYear: number | null = null;
  const rawYear = trimmedOrNull(row.rawValues.beliefYear);
  if (rawYear !== null) {
    if (!YEAR_PATTERN.test(rawYear)) return { status: "quarantined", issue: "BELIEF_YEAR_INVALID" };
    beliefYear = Number.parseInt(rawYear, 10);
    if (beliefYear < 1800 || beliefYear > beliefYearUpperBound(now)) {
      return { status: "quarantined", issue: "BELIEF_YEAR_OUT_OF_RANGE" };
    }
  }

  return {
    status: "ok",
    norm: {
      fullName: trimmedOrNull(row.rawValues.fullName),
      nickname,
      age,
      occupation: trimmedOrNull(row.rawValues.occupation),
      workplace: trimmedOrNull(row.rawValues.workplace),
      beliefYear,
      maritalCode: opaqueMarkerCode(row.checkboxMarkers.marital),
      responseCode: opaqueMarkerCode(row.checkboxMarkers.response),
      participationCode: opaqueMarkerCode(row.checkboxMarkers.participation),
      // The goal spelling stays verbatim — L2 never clusters (needs a human).
      goalCode: trimmedOrNull(row.rawValues.goal),
    },
  };
}

/** Verbatim first non-empty cell above the resolved header (the title row). */
function sheetTitle(rows: string[][], headerRowIndex: number): string | null {
  for (let r = 0; r < headerRowIndex; r += 1) {
    for (const cell of rows[r] ?? []) {
      const text = cellText(cell).trim();
      if (text !== "") return text;
    }
  }
  return null;
}

function toCapturedRows(analysis: SheetAnalysis, rows: string[][]): CapturedMemberRow[] {
  // Re-extract with the sheet's own resolved layout so the captured rows and
  // the analysis agree even when detectLayout picked a non-final band.
  const layout = analysis.layout;
  if (!layout) return [];
  const out: CapturedMemberRow[] = [];
  for (let r = layout.headerRowIndex + 1; r < rows.length; r += 1) {
    const row = rows[r];
    const nicknameCol = layout.columns.nickname;
    if (nicknameCol === undefined || normalizeHeaderText(row[nicknameCol]) === "") continue;
    const rawValues: Record<string, string> = {};
    for (const [field, col] of Object.entries(layout.columns)) {
      if (col === undefined) continue;
      rawValues[field] = cellText(row[col]);
    }
    const checkboxMarkers: Record<string, string[]> = {};
    for (const [key, cols] of Object.entries(layout.checkboxColumns)) {
      if (!cols) continue;
      checkboxMarkers[key] = cols.map((c) => cellText(row[c]));
    }
    out.push({ excelRowNumber: r + 1, rawValues, checkboxMarkers });
  }
  return out;
}

/** One worksheet reduced to plain string rows, indexed by Excel row number. */
type ReadSheet = { name: string; rows: string[][] };

/**
 * STREAMING reader — the memory-bounded path. This is what reads the real
 * workbooks (all 8 files in the Phase 1 audit), because they store
 * `xl/workbook.xml` before the worksheets.
 *
 * Row indices are padded from each row's own Excel row number, so a blank row
 * that the reader skips still leaves `rows[i]` aligned with spreadsheet row
 * i+1. Without that, L1 `excelRow` would drift and stop meaning "the row a
 * human sees in Excel".
 */
async function readSheetsStreaming(filePath: string): Promise<ReadSheet[]> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {});
  await reader.read();

  const sheets: ReadSheet[] = [];
  for await (const worksheet of reader) {
    const name = (worksheet as { name?: string }).name ?? `sheet-${sheets.length + 1}`;
    const rows: string[][] = [];
    for await (const row of worksheet as AsyncIterable<unknown>) {
      const values = (row as { values?: unknown[] }).values ?? [];
      const rowNumber = (row as { number?: number }).number;
      const mapped = values.map(cellText);
      if (typeof rowNumber !== "number" || rowNumber <= rows.length + 1) {
        rows.push(mapped);
        continue;
      }
      while (rows.length < rowNumber - 1) rows.push([]);
      rows.push(mapped);
    }
    sheets.push({ name, rows });
  }
  return sheets;
}

/**
 * BUFFERED reader — the correctness fallback.
 *
 * ExcelJS's streaming reader throws `Cannot read properties of undefined
 * (reading 'sheets')` on multi-sheet workbooks whose zip lists the
 * worksheets before `xl/workbook.xml` (which is exactly what ExcelJS's own
 * writer produces). Such a file is a perfectly valid .xlsx, so refusing it
 * would reject real uploads. The buffered reader has no such ordering
 * assumption; it costs memory proportional to the file, which is why it is
 * the second attempt rather than the first.
 */
async function readSheetsBuffered(filePath: string): Promise<ReadSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook.worksheets.map((worksheet) => {
    const rows: string[][] = [];
    // getRow(1..rowCount) instead of eachRow(): eachRow skips empty rows and
    // would shift every index below the first blank line.
    for (let r = 1; r <= worksheet.rowCount; r += 1) {
      const values = (worksheet.getRow(r).values as unknown[] | undefined) ?? [];
      rows.push(values.map(cellText));
    }
    return { name: worksheet.name, rows };
  });
}

/**
 * Reads one workbook file and captures every sheet's member rows verbatim.
 * Layout detection is by header text (Phase 1 logic reused unchanged).
 */
export async function parseWorkbookFile(filePath: string): Promise<ParsedWorkbook> {
  let read: ReadSheet[];
  try {
    read = await readSheetsStreaming(filePath);
  } catch (error) {
    read = await readSheetsBuffered(filePath).catch(() => {
      throw error;
    });
  }

  const sheets: CapturedSheet[] = read.map(({ name, rows }) => {
    const analysis = analyzeSheet(name, rows);
    return {
      sheetName: name,
      title: analysis.layout ? sheetTitle(rows, analysis.layout.headerRowIndex) : null,
      analysis,
      rows: toCapturedRows(analysis, rows),
    };
  });

  const conventions = new Set<string>();
  let dataRowCount = 0;
  let memberRowCount = 0;
  for (const sheet of sheets) {
    for (const token of Object.keys(sheet.analysis.checkboxValueCounts)) conventions.add(token);
    dataRowCount += sheet.analysis.dataRowCount;
    memberRowCount += sheet.rows.length;
  }

  return {
    sheets,
    checkboxConventions: Array.from(conventions).sort(),
    worksheetCount: sheets.length,
    dataRowCount,
    memberRowCount,
  };
}

/** sha256 of the uploaded bytes — the identity used for duplicate batches. */
export function checksumBuffer(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Writes the uploaded bytes to a private temp file so the streaming reader
 * (which takes a path) can consume it, then removes it. The bytes are never
 * stored anywhere else.
 */
export async function withTempWorkbook<T>(bytes: Uint8Array, use: (filePath: string) => Promise<T>): Promise<T> {
  const dir = path.join(tmpdir(), "puntakit-import-");
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `upload-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
  try {
    await writeFile(filePath, bytes);
    return await use(filePath);
  } finally {
    await rm(filePath, { force: true });
  }
}

// ── Report helpers (§12 completeness, §8 duplicate review queue) ─────────

export const COMPLETENESS_FIELDS = [
  "nickname",
  "sequence",
  "fullName",
  "age",
  "occupation",
  "workplace",
  "beliefYear",
  "goal",
] as const;

export type CompletenessRow = { filled: number; empty: number; filledPct: number };

/**
 * Completeness over member rows, computed from the verbatim L1 values so the
 * report describes the SOURCE, not the normalized layer.
 */
export function computeCompleteness(rows: CapturedMemberRow[]): Record<string, CompletenessRow> {
  const out: Record<string, CompletenessRow> = {};
  const total = rows.length;
  for (const field of COMPLETENESS_FIELDS) {
    let filled = 0;
    for (const row of rows) {
      if (normalizeHeaderText(row.rawValues[field]) !== "") filled += 1;
    }
    out[field] = {
      filled,
      empty: total - filled,
      filledPct: total === 0 ? 0 : Math.round((filled / total) * 1000) / 10,
    };
  }
  return out;
}

export type DuplicateCandidate = {
  nickname: string;
  occurrences: number;
  ages: (number | null)[];
  batches: string[];
  sheets: string[];
  excelRows: number[];
};

/**
 * Duplicate REVIEW QUEUE (§8): same normalized nickname is the entry signal.
 * This flags candidates with their evidence; it NEVER merges anything and it
 * never decides that two people are the same person.
 */
export function groupDuplicateCandidates(
  rows: Array<{
    nickname: string | null;
    age: number | null;
    batchId: string;
    sheetName: string;
    excelRow: number;
  }>,
  limit = 50
): DuplicateCandidate[] {
  const groups = new Map<string, DuplicateCandidate>();
  for (const row of rows) {
    const nickname = (row.nickname ?? "").trim();
    if (nickname === "") continue;
    const group = groups.get(nickname) ?? {
      nickname,
      occurrences: 0,
      ages: [],
      batches: [],
      sheets: [],
      excelRows: [],
    };
    group.occurrences += 1;
    group.ages.push(row.age);
    if (!group.batches.includes(row.batchId)) group.batches.push(row.batchId);
    if (!group.sheets.includes(row.sheetName)) group.sheets.push(row.sheetName);
    group.excelRows.push(row.excelRow);
    groups.set(nickname, group);
  }
  const candidates = Array.from(groups.values()).filter((g) => g.occurrences > 1);
  candidates.sort((a, b) => b.occurrences - a.occurrences || a.nickname.localeCompare(b.nickname));
  return candidates.slice(0, limit);
}
