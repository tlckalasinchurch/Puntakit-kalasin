import type { Request } from "express";
import { del, get } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { IMPORT_BLOB_CONTENT_TYPES, IMPORT_BLOB_PREFIX, IMPORT_UPLOAD_MAX_BYTES } from "../../shared/import.js";
import { ValidationError } from "./errors.js";

/**
 * Vercel Blob hand-off for workbooks larger than Vercel's 4.5 MB request limit.
 * Blobs are PRIVATE (they hold member data) and are deleted after the import.
 * Needs BLOB_READ_WRITE_TOKEN; without it every call here fails closed.
 */

function assertBlobConfigured(): void {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new ValidationError("ยังไม่ได้ตั้งค่า BLOB_READ_WRITE_TOKEN สำหรับอัปโหลดไฟล์ขนาดใหญ่");
  }
}

/** Handshake: validates the target path and returns the client upload token. */
export async function createImportUploadToken(req: Request) {
  assertBlobConfigured();
  return handleUpload({
    request: req,
    body: req.body as HandleUploadBody,
    onBeforeGenerateToken: async (pathname) => {
      const lower = pathname.toLowerCase();
      if (!pathname.startsWith(IMPORT_BLOB_PREFIX) || pathname.includes("..") || !lower.endsWith(".xlsx")) {
        throw new ValidationError("อัปโหลดได้เฉพาะไฟล์ .xlsx ใต้ import/");
      }
      return {
        allowedContentTypes: IMPORT_BLOB_CONTENT_TYPES,
        maximumSizeInBytes: IMPORT_UPLOAD_MAX_BYTES,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ userId: req.user?.id ?? null }),
      };
    },
  });
}

/** Reads a private import blob into memory, refusing anything above the size cap. */
export async function readImportBlob(pathname: string): Promise<Buffer> {
  assertBlobConfigured();
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200) {
    throw new ValidationError("ไม่พบไฟล์ที่อัปโหลด — อัปโหลดใหม่อีกครั้ง");
  }
  if (result.blob.size > IMPORT_UPLOAD_MAX_BYTES) {
    throw new ValidationError("ไฟล์ใหญ่เกินกำหนด");
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = result.stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > IMPORT_UPLOAD_MAX_BYTES) {
      await reader.cancel();
      throw new ValidationError("ไฟล์ใหญ่เกินกำหนด");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Best effort: a failed delete must not turn a finished import into an error. */
export async function deleteImportBlob(pathname: string): Promise<void> {
  try {
    await del(pathname);
  } catch (error) {
    console.warn("[import] could not delete blob", pathname, error instanceof Error ? error.message : error);
  }
}
