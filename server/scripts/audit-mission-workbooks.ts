/**
 * READ-ONLY audit of the external "ทะเบียนพันธกิจบ้าน" workbooks.
 *
 * This script is Phase 1 of the mission-domain work and is deliberately
 * incapable of mutating anything:
 *  - it opens the workbooks read-only;
 *  - it never connects to a database (no `db` import anywhere);
 *  - it only prints a report to stdout.
 *
 * Usage:
 *   pnpm exec tsx server/scripts/audit-mission-workbooks.ts [directory] [--json]
 *
 * The default directory is the documented external source location, resolved
 * relative to the repository root. It is an INPUT location only — nothing is
 * ever copied into the repository by this script.
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

import {
  analyzeSheet,
  buildAuditReport,
  cellText,
  type AuditReport,
  type FileAudit,
} from "../lib/missionExcel";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Documented external source location (sibling of the repo). */
const DEFAULT_SOURCE_DIR = path.resolve(
  REPO_ROOT,
  "..",
  "mission-20260930T143403Z-1-001",
  "mission"
);

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", resolve)
      .on("error", reject);
  });
  return hash.digest("hex");
}

/**
 * Reads one workbook with ExcelJS's STREAMING reader.
 *
 * Streaming matters: the largest workbook is ~28 MB across many worksheets and
 * must not be materialised in memory. Rows are yielded one at a time and
 * converted to plain string arrays immediately, so only one worksheet's worth
 * of raw rows is ever held.
 */
async function auditWorkbook(filePath: string): Promise<FileAudit> {
  const fileName = path.basename(filePath);
  const fileStat = await stat(filePath);
  const contentHash = await sha256File(filePath);

  // ExcelJS's STREAMING reader: worksheets and rows are yielded one at a
  // time, so the ~28 MB workbook is never fully materialised in memory.
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {});
  await reader.read();

  const sheetNames: string[] = [];
  const sheets: FileAudit["sheets"] = [];

  for await (const worksheet of reader) {
    const sheetName = (worksheet as { name?: string }).name ?? `sheet-${sheets.length + 1}`;
    sheetNames.push(sheetName);
    const rows: string[][] = [];
    for await (const row of worksheet) {
      const values = (row as { values?: unknown[] }).values ?? [];
      rows.push(values.map(cellText));
    }
    sheets.push(analyzeSheet(sheetName, rows));
  }

  return {
    fileName,
    fileSizeBytes: fileStat.size,
    contentHash,
    duplicateOf: [],
    isDuplicate: false,
    worksheetCount: sheetNames.length,
    worksheetNames: sheetNames,
    sheets,
    memberRowCount: sheets.reduce((sum, s) => sum + s.memberRowCount, 0),
  };
}

function printReport(report: AuditReport, sourceDir: string): void {
  const t = report.totals;
  const rule = (label: string) => `${label} ${"-".repeat(Math.max(3, 78 - label.length))}`;
  console.log("=".repeat(78));
  console.log("PUNTAKIT — MISSION WORKBOOK AUDIT (READ-ONLY, Phase 1)");
  console.log("=".repeat(78));
  console.log(`Source directory : ${sourceDir}`);
  console.log(`Files read       : ${t.files}  (unique content: ${t.uniqueFiles})`);
  console.log(`Worksheets       : ${t.worksheets}`);
  console.log(`Member rows      : ${t.memberRowsAllFiles} across all files`);
  console.log(`                   ${t.memberRowsUniqueFiles} across unique files only`);
  console.log("");

  console.log(rule("-- FILES"));
  for (const file of report.files) {
    const sizeMb = (file.fileSizeBytes / 1024 / 1024).toFixed(2);
    console.log(file.fileName);
    console.log(`   size ${sizeMb} MB · sheets ${file.worksheetCount} · member rows ${file.memberRowCount}`);
    console.log(`   sha256 ${file.contentHash}`);
    if (file.isDuplicate) console.log(`   DUPLICATE of: ${file.duplicateOf.join(", ")}`);
  }

  if (report.duplicateGroups.length > 0) {
    console.log("");
    console.log(rule("-- DUPLICATE CONTENT GROUPS"));
    for (const group of report.duplicateGroups) {
      console.log(`  ${group.length} files, identical bytes:`);
      for (const name of group) console.log(`    - ${name}`);
    }
  }

  console.log("");
  console.log(rule("-- PER-SHEET"));
  for (const file of report.files) {
    console.log(`[${file.fileName}]`);
    for (const sheet of file.sheets) {
      const layout = sheet.layout;
      console.log(`  · ${sheet.sheetName} — members ${sheet.memberRowCount}, data rows ${sheet.dataRowCount}`);
      if (!layout) {
        console.log("      layout: UNRESOLVED (no header field matched)");
        continue;
      }
      console.log(`      layout  : ${layout.signature}`);
      console.log(`      columns : ${JSON.stringify(layout.columns)}`);
      console.log(`      checkbox: ${JSON.stringify(layout.checkboxColumns)}`);
      if (layout.unmatchedLabels.length > 0) {
        console.log(`      unmatched headers: ${layout.unmatchedLabels.join(" | ")}`);
      }
    }
  }

  console.log("");
  console.log(rule("-- FIELD FILL RATES (member rows only)"));
  for (const [field, stats] of Object.entries(t.fillRates)) {
    console.log(
      `  ${field.padEnd(16)} filled ${String(stats.filled).padStart(5)}  empty ${String(stats.empty).padStart(5)}  ${stats.filledPct}%`
    );
  }

  console.log("");
  console.log(rule("-- CHECKBOX GROUP FILL RATES (any option column carries a marker)"));
  for (const [field, stats] of Object.entries(t.checkboxFillRates)) {
    console.log(
      `  ${field.padEnd(16)} filled ${String(stats.filled).padStart(5)}  empty ${String(stats.empty).padStart(5)}  ${stats.filledPct}%`
    );
  }

  console.log("");
  console.log(rule("-- CHECKBOX VALUE CONVENTIONS (recorded, NOT interpreted)"));
  const tokens = Object.entries(t.checkboxValueCounts).sort((a, b) => b[1] - a[1]);
  if (tokens.length === 0) console.log("  (none found)");
  for (const [token, count] of tokens) {
    const known = token === "1" || token === "/";
    const note = known ? "documented token" : "UNRECOGNISED — semantics UNKNOWN";
    console.log(`  ${JSON.stringify(token).padEnd(10)} ${String(count).padStart(6)}   ${note}`);
  }

  console.log("");
  console.log(rule("-- LAYOUTS OBSERVED"));
  console.log(`  structural signatures (field order): ${t.layoutsObserved.length}`);
  t.layoutsObserved.forEach((sig, i) => console.log(`    ${i + 1}. ${sig}`));
  console.log(`  column-position variants: ${t.columnVariantsObserved.length}`);
  t.columnVariantsObserved.forEach((v, i) => console.log(`    ${i + 1}. ${v}`));

  console.log("");
  console.log(rule("-- MISCELLANEOUS"));
  console.log(`  distinct goal values  : ${t.goalVariantCount}`);
  console.log(`  sheets without layout : ${t.sheetsWithoutLayout.length === 0 ? "(none)" : t.sheetsWithoutLayout.join(", ")}`);

  console.log("");
  console.log("=".repeat(78));
  console.log("No database was contacted. No file was modified. No meaning was inferred.");
  console.log("Checkbox tokens above are raw observations; their semantics remain UNKNOWN");
  console.log("until a human confirms them.");
  console.log("=".repeat(78));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const dirArg = args.find((a) => !a.startsWith("--"));
  const sourceDir = dirArg ? path.resolve(dirArg) : DEFAULT_SOURCE_DIR;

  const entries = await readdir(sourceDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".xlsx"))
    .map((e) => path.join(sourceDir, e.name))
    .sort();

  if (files.length === 0) {
    console.error(`No .xlsx files found in ${sourceDir}`);
    process.exitCode = 1;
    return;
  }

  console.error(`Reading ${files.length} workbook(s) from ${sourceDir} …`);
  const audits: FileAudit[] = [];
  for (const file of files) {
    console.error(`  · ${path.basename(file)}`);
    audits.push(await auditWorkbook(file));
  }

  const report = buildAuditReport(audits);
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report, sourceDir);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});