/**
 * Read-only analysis of the external "ทะเบียนพันธกิจบ้าน" workbooks.
 *
 * SCOPE — this module is deliberately inert:
 *  - it performs no I/O (the CLI in `server/scripts/audit-mission-workbooks.ts`
 *    owns file access and streaming);
 *  - it writes nothing to any database;
 *  - it normalizes nothing and interprets nothing.
 *
 * Every cell value that leaves this module is the verbatim string as it
 * appears in the workbook. In particular a checkbox marker is recorded as the
 * literal token found (`"1"`, `"/"`, …) and is NEVER mapped onto a business
 * meaning — see docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md §5–§7.
 *
 * Layout detection is by header TEXT, never by column letter: a workbook that
 * gains or loses a column still resolves.
 */

/** Business fields this audit can resolve from a sheet's header band. */
export type FieldKey =
  | "sequence"
  | "fullName"
  | "nickname"
  | "age"
  | "occupation"
  | "workplace"
  | "marital"
  | "beliefYear"
  | "response"
  | "participation"
  | "goal";

/**
 * Fields the source renders as a group of checkbox columns rather than one
 * value. The audit records which columns belong to the group and what each
 * column literally contains; it does not decide what a marker means.
 */
export const CHECKBOX_FIELD_KEYS = ["marital", "response", "participation"] as const;
export type CheckboxFieldKey = (typeof CHECKBOX_FIELD_KEYS)[number];

/**
 * Ordered: the first spec whose pattern matches a column label claims that
 * column. `nickname` deliberately precedes `fullName` so the shared `ชื่อ`
 * prefix cannot make a nickname column look like a legal-name column.
 */
const FIELD_SPECS: ReadonlyArray<{
  key: FieldKey;
  kind: "scalar" | "checkbox";
  pattern: RegExp;
}> = [
  { key: "sequence", kind: "scalar", pattern: /^ที่$/ },
  { key: "nickname", kind: "scalar", pattern: /^ชื่อเล่น/ },
  { key: "fullName", kind: "scalar", pattern: /^ชื่อ[\s\-]*สกุล/ },
  { key: "age", kind: "scalar", pattern: /^อายุ/ },
  { key: "occupation", kind: "scalar", pattern: /^อาชีพ/ },
  { key: "workplace", kind: "scalar", pattern: /^(สถานที่)?(เรียน|ทำงาน)/ },
  { key: "marital", kind: "checkbox", pattern: /สถานภาพ/ },
  { key: "beliefYear", kind: "scalar", pattern: /^วันรับเชื่อ/ },
  { key: "response", kind: "checkbox", pattern: /ท่าที.*ตอบสนอง|ตอบสนอง/ },
  { key: "participation", kind: "checkbox", pattern: /การเข้าร่วม/ },
  { key: "goal", kind: "scalar", pattern: /เป้าหมาย/ },
];

/**
 * Trim and collapse inner whitespace. This is the ONLY transformation applied
 * to a value anywhere in this module, and it is applied for comparison and
 * reporting only — `rawValues` always carries the untouched original.
 */
export function normalizeHeaderText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

/** Renders any cell as text without altering its content. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return objectCellText(value as Record<string, unknown>);
  return String(value);
}

/**
 * ExcelJS hands back an object, not a string, for rich text, hyperlinks and
 * formulas. `String(object)` is "[object Object]", which silently replaced a
 * real nickname in a source workbook. Read the visible text instead:
 *  - rich text   { richText: [{ text }] }   -> the runs joined
 *  - hyperlink   { text, hyperlink }        -> the link text
 *  - formula     { formula, result }        -> the cached result
 *  - error       { error }                  -> the error code, e.g. "#N/A"
 * Anything else yields "" rather than a misleading placeholder.
 */
function objectCellText(value: Record<string, unknown>): string {
  if (Array.isArray(value.richText)) {
    return value.richText.map((run) => (run && typeof run === "object" ? cellText((run as { text?: unknown }).text) : "")).join("");
  }
  if ("text" in value && value.text !== undefined) return cellText(value.text);
  if ("result" in value) return cellText(value.result);
  if (typeof value.error === "string") return value.error;
  return "";
}

/**
 * Effective header label per column.
 *
 * The source workbooks use a merged group header ("สถานภาพครอบครัว") spanning
 * several option columns, leaving those columns blank on the header row.
 * Carrying the last non-empty label forward attributes each option column to
 * its group without hardcoding any column position.
 */
export function buildEffectiveHeader(band: string[][]): string[] {
  const width = band.reduce((max, row) => Math.max(max, row.length), 0);
  const labels: string[] = new Array(width).fill("");
  const explicitlySet: boolean[] = new Array(width).fill(false);

  for (const row of band) {
    // `lastLabel` is the most recent non-empty label seen so far, in this row
    // or an earlier one. A blank column inherits it, which is how a merged
    // group header comes to label each of its option columns.
    let lastLabel = "";
    for (let i = 0; i < width; i += 1) {
      const cell = normalizeHeaderText(row[i]);
      if (cell !== "") {
        lastLabel = cell;
        labels[i] = cell;
        explicitlySet[i] = true;
      } else {
        labels[i] = lastLabel;
      }
    }
  }

  // Blank columns AFTER the final label are past the end of the table, not
  // part of any group. Leaving them labelled would invent header fields.
  let lastExplicit = width - 1;
  while (lastExplicit >= 0 && !explicitlySet[lastExplicit]) lastExplicit -= 1;
  for (let i = lastExplicit + 1; i < width; i += 1) labels[i] = "";

  return labels;
}

export type HeaderResolution = {
  /** Row index within the sheet that produced this resolution. */
  headerRowIndex: number;
  /** Ordered resolved field keys — the sheet's structural signature. */
  signature: string;
  /** Scalar fields → the column that holds the value. */
  columns: Partial<Record<FieldKey, number>>;
  /** Checkbox groups → every column belonging to the group. */
  checkboxColumns: Partial<Record<CheckboxFieldKey, number[]>>;
  /** Header labels that matched no field. Retained, never dropped. */
  unmatchedLabels: string[];
  resolvedFieldCount: number;
};

/**
 * Resolves a candidate header band. `layout` is derived from the structural
 * signature, i.e. WHICH fields appear and in what order — not where.
 */
export function resolveHeader(band: string[][], headerRowIndex: number): HeaderResolution {
  const effective = buildEffectiveHeader(band);
  const columns: Partial<Record<FieldKey, number>> = {};
  const checkboxColumns: Partial<Record<CheckboxFieldKey, number[]>> = {};
  const unmatchedLabels: string[] = [];
  const order: FieldKey[] = [];

  for (let i = 0; i < effective.length; i += 1) {
    const label = effective[i];
    if (label === "") continue;
    const spec = FIELD_SPECS.find((s) => s.pattern.test(label));
    if (!spec) {
      unmatchedLabels.push(label);
      continue;
    }
    if (spec.kind === "checkbox") {
      const key = spec.key as CheckboxFieldKey;
      const existing = checkboxColumns[key];
      if (existing) existing.push(i);
      else checkboxColumns[key] = [i];
      if (!order.includes(spec.key)) order.push(spec.key);
      continue;
    }
    if (columns[spec.key] === undefined) {
      columns[spec.key] = i;
      order.push(spec.key);
    }
  }

  return {
    headerRowIndex,
    signature: order.join(">"),
    columns,
    checkboxColumns,
    unmatchedLabels,
    resolvedFieldCount: order.length,
  };
}

/**
 * Picks the band that resolves the most fields. Sheets in this source put the
 * member table a few rows below a title, so every leading row is a candidate.
 */
export function detectLayout(rows: string[][], maxHeaderScanRows = 15): HeaderResolution | null {
  let best: HeaderResolution | null = null;
  const limit = Math.min(rows.length, maxHeaderScanRows);
  for (let r = 0; r < limit; r += 1) {
    // Merge look-back so a group header on an earlier row still labels the
    // blank option columns of the chosen row.
    const withLookBack = resolveHeader(rows.slice(0, r + 1), r);
    if (!best || withLookBack.resolvedFieldCount > best.resolvedFieldCount) best = withLookBack;
  }
  return best && best.resolvedFieldCount > 0 ? best : null;
}

/** One member row, every value verbatim. */
export type MemberRow = {
  /** 1-based row number in the worksheet, as a human would see it in Excel. */
  excelRowNumber: number;
  rawValues: Partial<Record<FieldKey, string>>;
  /** Raw markers per checkbox group, one entry per option column. */
  checkboxMarkers: Partial<Record<CheckboxFieldKey, string[]>>;
};

export type SheetAnalysis = {
  sheetName: string;
  layout: HeaderResolution | null;
  /** Rows that define a member: the nickname column is non-empty. */
  memberRowCount: number;
  /** Rows physically present below the header, including blanks. */
  dataRowCount: number;
  /** Per-field filled/empty counts over member rows only (scalar fields). */
  fillRates: Record<string, { filled: number; empty: number; filledPct: number }>;
  /**
   * Per-checkbox-GROUP filled counts. A group counts as filled when at least
   * one of its option columns carries a marker. This is a presence measure
   * only — it never says what the marker means.
   */
  checkboxFillRates: Record<string, { filled: number; empty: number; filledPct: number }>;
  /** Marker token → occurrences, across every checkbox column. */
  checkboxValueCounts: Record<string, number>;
  /** Marker tokens that are neither `1` nor `/`. Reported, never interpreted. */
  unrecognizedCheckboxValues: Record<string, number>;
  /** Distinct raw goal values, verbatim. */
  goalVariants: Record<string, number>;
  /** Header labels no field claimed. */
  unmatchedLabels: string[];
};

/**
 * A row is a member row iff its nickname cell is non-empty.
 *
 * This is an observation about the data, not a business rule about identity:
 * nickname is NOT unique and does not identify a person. A human row that
 * repeats across sheets and files is counted once per source occurrence here
 * and resolved only in a later, explicit duplicate-review step.
 */
export function isMemberRow(row: string[], layout: HeaderResolution): boolean {
  const col = layout.columns.nickname;
  return col !== undefined && normalizeHeaderText(row[col]) !== "";
}

function pct(filled: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((filled / total) * 1000) / 10;
}

/** Marker tokens the documented audit claims exist. Reported as a fact only. */
export const DOCUMENTED_MARKER_TOKENS = ["1", "/"] as const;

/** Extracts the member rows of a sheet. Values stay verbatim. */
export function extractMemberRows(rows: string[][]): MemberRow[] {
  const layout = detectLayout(rows);
  if (!layout) return [];
  const out: MemberRow[] = [];
  for (let r = layout.headerRowIndex + 1; r < rows.length; r += 1) {
    const row = rows[r];
    if (!isMemberRow(row, layout)) continue;
    const rawValues: Partial<Record<FieldKey, string>> = {};
    for (const [field, col] of Object.entries(layout.columns)) {
      if (col === undefined) continue;
      // Verbatim: no trimming, no number coercion, no case change.
      rawValues[field as FieldKey] = cellText(row[col]);
    }
    const checkboxMarkers: Partial<Record<CheckboxFieldKey, string[]>> = {};
    for (const key of CHECKBOX_FIELD_KEYS) {
      const cols = layout.checkboxColumns[key];
      if (!cols) continue;
      checkboxMarkers[key] = cols.map((c) => cellText(row[c]));
    }
    out.push({ excelRowNumber: r + 1, rawValues, checkboxMarkers });
  }
  return out;
}

export function analyzeSheet(sheetName: string, rows: string[][]): SheetAnalysis {
  const layout = detectLayout(rows);
  if (!layout) {
    return {
      sheetName,
      layout: null,
      memberRowCount: 0,
      dataRowCount: 0,
      fillRates: {},
      checkboxFillRates: {},
      checkboxValueCounts: {},
      unrecognizedCheckboxValues: {},
      goalVariants: {},
      unmatchedLabels: [],
    };
  }

  const memberRows = extractMemberRows(rows);

  const fillRates: SheetAnalysis["fillRates"] = {};
  for (const field of Object.keys(layout.columns) as FieldKey[]) {
    let filled = 0;
    for (const m of memberRows) {
      if (normalizeHeaderText(m.rawValues[field]) !== "") filled += 1;
    }
    fillRates[field] = {
      filled,
      empty: memberRows.length - filled,
      filledPct: pct(filled, memberRows.length),
    };
  }

  // A checkbox group is "filled" when ANY option column holds a marker. The
  // marker itself stays uninterpreted.
  const checkboxFillRates: SheetAnalysis["checkboxFillRates"] = {};
  for (const key of CHECKBOX_FIELD_KEYS) {
    if (!layout.checkboxColumns[key]) continue;
    let filled = 0;
    for (const m of memberRows) {
      const markers = m.checkboxMarkers[key] ?? [];
      if (markers.some((v) => v.trim() !== "")) filled += 1;
    }
    checkboxFillRates[key] = {
      filled,
      empty: memberRows.length - filled,
      filledPct: pct(filled, memberRows.length),
    };
  }

  const checkboxValueCounts: Record<string, number> = {};
  const goalVariants: Record<string, number> = {};
  for (const m of memberRows) {
    for (const key of CHECKBOX_FIELD_KEYS) {
      for (const marker of m.checkboxMarkers[key] ?? []) {
        const token = marker.trim();
        if (token === "") continue;
        checkboxValueCounts[token] = (checkboxValueCounts[token] ?? 0) + 1;
      }
    }
    const goal = (m.rawValues.goal ?? "").trim();
    if (goal !== "") goalVariants[goal] = (goalVariants[goal] ?? 0) + 1;
  }

  const unrecognized: Record<string, number> = {};
  for (const [token, count] of Object.entries(checkboxValueCounts)) {
    if (!(DOCUMENTED_MARKER_TOKENS as readonly string[]).includes(token)) {
      unrecognized[token] = count;
    }
  }

  return {
    sheetName,
    layout,
    memberRowCount: memberRows.length,
    dataRowCount: Math.max(0, rows.length - layout.headerRowIndex - 1),
    fillRates,
    checkboxFillRates,
    checkboxValueCounts,
    unrecognizedCheckboxValues: unrecognized,
    goalVariants,
    unmatchedLabels: layout.unmatchedLabels,
  };
}

export function mergeCounters(target: Record<string, number>, source: Record<string, number>): void {
  for (const [key, count] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + count;
  }
}

export function sumFillRates(
  sheets: SheetAnalysis[]
): Record<string, { filled: number; empty: number; filledPct: number }> {
  const totals: Record<string, { filled: number; empty: number }> = {};
  for (const sheet of sheets) {
    for (const [field, stats] of Object.entries(sheet.fillRates)) {
      const acc = totals[field] ?? { filled: 0, empty: 0 };
      acc.filled += stats.filled;
      acc.empty += stats.empty;
      totals[field] = acc;
    }
  }
  const out: Record<string, { filled: number; empty: number; filledPct: number }> = {};
  const total = sheets.reduce((sum, s) => sum + s.memberRowCount, 0);
  for (const [field, acc] of Object.entries(totals)) {
    out[field] = { ...acc, filledPct: pct(acc.filled, total) };
  }
  return out;
}

/** Sums checkbox-group fill rates across sheets. */
export function sumCheckboxFillRates(
  sheets: SheetAnalysis[]
): Record<string, { filled: number; empty: number; filledPct: number }> {
  const totals: Record<string, { filled: number; empty: number }> = {};
  for (const sheet of sheets) {
    for (const [field, stats] of Object.entries(sheet.checkboxFillRates)) {
      const acc = totals[field] ?? { filled: 0, empty: 0 };
      acc.filled += stats.filled;
      acc.empty += stats.empty;
      totals[field] = acc;
    }
  }
  const out: Record<string, { filled: number; empty: number; filledPct: number }> = {};
  const total = sheets.reduce((sum, s) => sum + s.memberRowCount, 0);
  for (const [field, acc] of Object.entries(totals)) {
    out[field] = { ...acc, filledPct: pct(acc.filled, total) };
  }
  return out;
}

/**
 * Column-position variant: the resolved field→column map rendered as a stable
 * string.
 *
 * Header-text detection deliberately ignores WHERE a column sits, so every
 * member sheet shares one structural signature even when the table sits at a
 * different offset. This variant key records that offset so the difference
 * between the documented "layout A/B/C" stays visible as an observation
 * instead of being silently normalised away.
 */
export function columnVariantKey(layout: HeaderResolution): string {
  return JSON.stringify({ columns: layout.columns, checkboxColumns: layout.checkboxColumns });
}

export type FileAudit = {
  fileName: string;
  fileSizeBytes: number;
  /** sha256 of the file bytes — the identity used for duplicate detection. */
  contentHash: string;
  /** Other file names in this run sharing the identical content hash. */
  duplicateOf: string[];
  isDuplicate: boolean;
  worksheetCount: number;
  worksheetNames: string[];
  sheets: SheetAnalysis[];
  memberRowCount: number;
};

export type AuditReport = {
  files: FileAudit[];
  /** Groups of ≥2 files sharing a content hash. */
  duplicateGroups: string[][];
  totals: {
    files: number;
    uniqueFiles: number;
    worksheets: number;
    /** Member rows across every file, including duplicated ones. */
    memberRowsAllFiles: number;
    /** Member rows across one representative per content hash. */
    memberRowsUniqueFiles: number;
    /** Distinct structural signatures actually observed. */
    layoutsObserved: string[];
    /** Distinct column-position variants actually observed. */
    columnVariantsObserved: string[];
    checkboxValueCounts: Record<string, number>;
    unrecognizedCheckboxValues: Record<string, number>;
    goalVariantCount: number;
    fillRates: Record<string, { filled: number; empty: number; filledPct: number }>;
    checkboxFillRates: Record<string, { filled: number; empty: number; filledPct: number }>;
    sheetsWithoutLayout: string[];
  };
};

export function buildAuditReport(files: FileAudit[]): AuditReport {
  const byHash = new Map<string, string[]>();
  for (const f of files) {
    const group = byHash.get(f.contentHash) ?? [];
    group.push(f.fileName);
    byHash.set(f.contentHash, group);
  }

  for (const f of files) {
    const group = byHash.get(f.contentHash) ?? [f.fileName];
    f.duplicateOf = group.filter((n) => n !== f.fileName);
    f.isDuplicate = f.duplicateOf.length > 0;
  }

  // Array.from rather than spread: this package compiles with a downlevel
  // target that does not allow iterating a Map/Set directly.
  const duplicateGroups = Array.from(byHash.values()).filter((g) => g.length > 1);

  const allSheets = files.flatMap((f) => f.sheets);
  // One representative per content hash — the duplicate contributes nothing new.
  const seenHashes = new Set<string>();
  const uniqueFiles = files.filter((f) => {
    if (seenHashes.has(f.contentHash)) return false;
    seenHashes.add(f.contentHash);
    return true;
  });

  const checkboxValueCounts: Record<string, number> = {};
  const unrecognized: Record<string, number> = {};
  const goalVariants: Record<string, number> = {};
  const layouts = new Set<string>();
  const columnVariants = new Set<string>();

  for (const sheet of allSheets) {
    mergeCounters(checkboxValueCounts, sheet.checkboxValueCounts);
    mergeCounters(unrecognized, sheet.unrecognizedCheckboxValues);
    mergeCounters(goalVariants, sheet.goalVariants);
    if (sheet.layout) {
      layouts.add(sheet.layout.signature);
      columnVariants.add(columnVariantKey(sheet.layout));
    }
  }

  return {
    files,
    duplicateGroups,
    totals: {
      files: files.length,
      uniqueFiles: uniqueFiles.length,
      worksheets: files.reduce((sum, f) => sum + f.worksheetCount, 0),
      memberRowsAllFiles: files.reduce((sum, f) => sum + f.memberRowCount, 0),
      memberRowsUniqueFiles: uniqueFiles.reduce((sum, f) => sum + f.memberRowCount, 0),
      layoutsObserved: Array.from(layouts).sort(),
      columnVariantsObserved: Array.from(columnVariants).sort(),
      checkboxValueCounts,
      unrecognizedCheckboxValues: unrecognized,
      goalVariantCount: Object.keys(goalVariants).length,
      fillRates: sumFillRates(allSheets),
      checkboxFillRates: sumCheckboxFillRates(allSheets),
      sheetsWithoutLayout: allSheets.filter((s) => !s.layout).map((s) => s.sheetName),
    },
  };
}