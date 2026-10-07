import type { Response } from "express";

/** Leading characters Excel/Sheets treat as formula triggers (CSV injection). */
const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * RFC 4180 field quoting with a CSV-injection guard: a field starting with a
 * formula-trigger character gets a leading apostrophe so spreadsheet apps
 * render it as text instead of evaluating it as a formula.
 */
export function csvField(value: unknown): string {
  let str = value === null || value === undefined ? "" : String(value);
  if (str.length > 0 && FORMULA_TRIGGER_CHARS.has(str[0])) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export function csvRow(fields: unknown[]): string {
  return fields.map(csvField).join(",");
}

/** Joins a header row and data rows into CSV text with CRLF line endings. */
export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [csvRow(headers), ...rows.map(csvRow)];
  return lines.join("\r\n");
}

/**
 * Sends CSV content as a file download. Prepends the UTF-8 BOM so Excel on
 * Windows renders Thai text correctly instead of guessing the wrong codepage.
 */
export function sendCsv(res: Response, filename: string, csvContent: string): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("﻿" + csvContent);
}
