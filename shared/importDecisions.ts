import { z } from "zod";

// Duplicate-review decisions. Zod and constants only, with no dependency on
// shared/schema.ts at runtime, so the browser bundle can import this file
// (schema.ts pulls in node:crypto).

/**
 * What a reviewer concluded about a group of rows that share a nickname.
 * Neither value merges anything: the decision is a recorded human judgement
 * (§8). Promotion into members (L3) is a separate, later phase.
 */
export const IMPORT_DUPLICATE_DECISIONS = ["same_person", "different_people"] as const;
export type ImportDuplicateDecision = (typeof IMPORT_DUPLICATE_DECISIONS)[number];

export const IMPORT_DUPLICATE_DECISION_LABELS: Record<ImportDuplicateDecision, string> = {
  same_person: "คนเดียวกัน",
  different_people: "คนละคน",
};

export const IMPORT_DUPLICATE_NOTE_MAX = 500;

export const importDuplicateDecisionBodySchema = z.object({
  /** The L2 nickname that put these rows in the review queue. */
  nickname: z.string().trim().min(1).max(200),
  /** Every `import_source_rows.id` the reviewer compared (the whole group). */
  sourceRowIds: z.array(z.string().uuid()).min(2).max(200),
  decision: z.enum(IMPORT_DUPLICATE_DECISIONS),
  note: z
    .string()
    .trim()
    .max(IMPORT_DUPLICATE_NOTE_MAX)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});
export type ImportDuplicateDecisionBody = z.infer<typeof importDuplicateDecisionBodySchema>;
