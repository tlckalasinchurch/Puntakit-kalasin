import { z } from "zod";

// Merge PLANS for duplicate-review groups. Zod and constants only, with no
// runtime dependency on shared/schema.ts, so the browser bundle can import it.
//
// A plan says WHICH row would survive and WHERE each field value would come
// from. Approving a plan records a second person's agreement. It does NOT
// merge anything: members/groups (L3) do not exist for imported rows yet, and
// nothing in this layer writes to them.

/** Fields a plan chooses a source row for (the fields the review screen compares). */
export const IMPORT_MERGE_FIELDS = ["fullName", "age", "occupation", "workplace"] as const;
export type ImportMergeField = (typeof IMPORT_MERGE_FIELDS)[number];

export const IMPORT_MERGE_FIELD_LABELS: Record<ImportMergeField, string> = {
  fullName: "ชื่อ-สกุล",
  age: "อายุ",
  occupation: "อาชีพ",
  workplace: "สถานที่ทำงาน",
};

export const IMPORT_MERGE_PLAN_STATUSES = ["proposed", "approved", "rejected", "withdrawn"] as const;
export type ImportMergePlanStatus = (typeof IMPORT_MERGE_PLAN_STATUSES)[number];

export const IMPORT_MERGE_PLAN_STATUS_LABELS: Record<ImportMergePlanStatus, string> = {
  proposed: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
  withdrawn: "ถอนแผนแล้ว",
};

/**
 * Four-eyes rule: the person who proposed a plan cannot approve or reject it.
 * With only one admin account, no plan can be approved until a second admin exists.
 */
export const IMPORT_MERGE_REQUIRES_SECOND_REVIEWER = true;

export const IMPORT_MERGE_NOTE_MAX = 500;

const noteField = z
  .string()
  .trim()
  .max(IMPORT_MERGE_NOTE_MAX)
  .optional()
  .transform((value) => (value === "" ? undefined : value));

export const importMergePlanBodySchema = z.object({
  nickname: z.string().trim().min(1).max(200),
  /** The whole group the reviewer compared (same set the decision was made on). */
  sourceRowIds: z.array(z.string().uuid()).min(2).max(200),
  /** The row that would survive as the record. */
  primarySourceRowId: z.string().uuid(),
  /** For every field, the row its value would be taken from. */
  fieldChoices: z.object({
    fullName: z.string().uuid(),
    age: z.string().uuid(),
    occupation: z.string().uuid(),
    workplace: z.string().uuid(),
  }),
  note: noteField,
});
export type ImportMergePlanBody = z.infer<typeof importMergePlanBodySchema>;

export const importMergeReviewBodySchema = z
  .object({
    outcome: z.enum(["approved", "rejected"]),
    note: noteField,
  })
  .refine((value) => value.outcome === "approved" || value.note !== undefined, {
    message: "ต้องระบุเหตุผลเมื่อปฏิเสธแผน",
    path: ["note"],
  });
export type ImportMergeReviewBody = z.infer<typeof importMergeReviewBodySchema>;

export const importMergePlanQuerySchema = z.object({
  status: z.enum(["all", ...IMPORT_MERGE_PLAN_STATUSES]).default("all"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
