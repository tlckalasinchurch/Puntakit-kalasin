import { z } from "zod";

// Upload constants and schemas with no dependency on shared/schema.ts, so the
// browser bundle can import them (schema.ts pulls in node:crypto).

/**
 * Upload metadata travels in headers (the workbook bytes are the body):
 * `x-source-filename` must name an .xlsx file. Sanitized server-side.
 */
export const IMPORT_UPLOAD_FILENAME_HEADER = "x-source-filename";
export const IMPORT_UPLOAD_MAX_BYTES = 120 * 1024 * 1024; // largest observed workbook: ~27 MB

/**
 * Large workbooks bypass the 4.5 MB Vercel request limit: the browser uploads
 * to a private Vercel Blob under this prefix, then asks the API to import it.
 */
export const IMPORT_BLOB_PREFIX = "import/";
export const IMPORT_BLOB_CONTENT_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
];

export const importFromBlobBodySchema = z.object({
  pathname: z
    .string()
    .min(1)
    .max(512)
    .refine((v) => v.startsWith(IMPORT_BLOB_PREFIX) && !v.includes(".."), "pathname must be under import/"),
  fileName: z.string().min(1).max(255),
});
export type ImportFromBlobBody = z.infer<typeof importFromBlobBodySchema>;
