import { z } from "zod";

import { IMPORT_BLOCKED_FIELD_KEYS, IMPORT_NORM_STATUSES } from "./schema.js";

/**
 * Shared contracts for the mission import pipeline (Phase 2, L1/L2).
 * See docs/PUNTAKIT_MISSION_DOMAIN_PLAN.md §1–§2, §12, §18.
 *
 * The four blocked fields (marital / response / participation / goal) keep
 * raw marker tokens as opaque codes until a human confirms semantics (Q5).
 * This list is the single source both the API responses and any future UI
 * read, so the "ยังไม่ยืนยัน semantic meaning" note can never drift.
 */
export { IMPORT_BLOCKED_FIELD_KEYS, IMPORT_NORM_STATUSES };
export type { ImportBlockedFieldKey, ImportNormStatus } from "./schema.js";

/** Pagination over batches. */
export const importBatchQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ImportBatchQuery = z.infer<typeof importBatchQuerySchema>;

/** Row preview of one batch. */
export const importPreviewQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** "all" | "ok" | "quarantined" — filter by the structural norm outcome. */
  status: z.enum(["all", ...IMPORT_NORM_STATUSES]).default("all"),
});
export type ImportPreviewQuery = z.infer<typeof importPreviewQuerySchema>;

/** Duplicate review queue (§8 — flags, never merges). */
export const importDuplicatesQuerySchema = z.object({
  /** Restrict the review queue to one batch, or omit for all batches. */
  batchId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ImportDuplicatesQuery = z.infer<typeof importDuplicatesQuerySchema>;

/** Confirming a normalization rule records WHO confirmed it and WHEN. */
export const importRuleConfirmSchema = z.object({});
export type ImportRuleConfirm = z.infer<typeof importRuleConfirmSchema>;

/**
 * Upload metadata travels in headers (the workbook bytes are the body):
 * `x-source-filename` must name an .xlsx file. Sanitized server-side.
 */
export const IMPORT_UPLOAD_FILENAME_HEADER = "x-source-filename";
export const IMPORT_UPLOAD_MAX_BYTES = 120 * 1024 * 1024; // largest observed workbook: ~27 MB
