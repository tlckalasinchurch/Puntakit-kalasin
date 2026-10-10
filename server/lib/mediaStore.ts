import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { del, get, put } from "@vercel/blob";
import { ValidationError } from "./errors.js";

/**
 * Where uploaded images (member photos, mission photos) actually live.
 *
 * - With `BLOB_READ_WRITE_TOKEN`: a PRIVATE Vercel Blob. Nothing is ever
 *   public — every read goes through `GET /api/media/:id`, which authorises it.
 * - Without a token, outside production (local dev, tests): files under
 *   `PUNTAKIT_MEDIA_DIR` (default `<cwd>/.db_data/media`).
 * - Production without a token fails closed, like the import blob does; it
 *   never falls back to local disk (a serverless function's disk is ephemeral).
 *
 * Callers validate the bytes first (`sniffImage`); this module only stores.
 */

export type StorageKind = "blob" | "local";

export interface StoredMedia {
  storage: StorageKind;
  pathname: string;
}

export const MEDIA_MAX_BYTES = 4 * 1024 * 1024; // Vercel's request body limit is 4.5 MB

const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type ImageContentType = keyof typeof IMAGE_TYPES;
export const IMAGE_CONTENT_TYPES = Object.keys(IMAGE_TYPES) as ImageContentType[];

/** Detects the real image type from the first bytes; the declared type is not trusted. */
export function sniffImage(bytes: Buffer): ImageContentType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") {
    return "image/webp";
  }
  return null;
}

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function localDir(): string {
  return process.env.PUNTAKIT_MEDIA_DIR || path.join(process.cwd(), ".db_data", "media");
}

function pickStorage(): StorageKind {
  if (blobConfigured()) return "blob";
  if (process.env.NODE_ENV === "production") {
    throw new ValidationError("ยังไม่ได้ตั้งค่าที่เก็บรูปภาพ (BLOB_READ_WRITE_TOKEN) — อัปโหลดรูปไม่ได้");
  }
  return "local";
}

export async function storeImage(folder: "avatars" | "mission", bytes: Buffer, contentType: ImageContentType): Promise<StoredMedia> {
  const storage = pickStorage();
  const name = `${randomUUID()}.${IMAGE_TYPES[contentType]}`;
  if (storage === "blob") {
    const result = await put(`media/${folder}/${name}`, bytes, {
      access: "private",
      contentType,
      addRandomSuffix: true,
    });
    return { storage, pathname: result.pathname };
  }
  const dir = path.join(localDir(), folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), bytes);
  return { storage, pathname: `${folder}/${name}` };
}

/** Reads a stored image fully into memory (images are capped at `MEDIA_MAX_BYTES`). */
export async function readImage(media: StoredMedia): Promise<Buffer | null> {
  if (media.storage === "blob") {
    if (!blobConfigured()) return null;
    const result = await get(media.pathname, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = result.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MEDIA_MAX_BYTES * 2) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  }
  const root = path.resolve(localDir());
  const full = path.resolve(root, media.pathname);
  if (!full.startsWith(root + path.sep)) return null; // never read outside the media directory
  try {
    return await fs.readFile(full);
  } catch {
    return null;
  }
}

/** Best effort: a leftover file is harmless, a failed request is not. */
export async function deleteImage(media: StoredMedia): Promise<void> {
  try {
    if (media.storage === "blob") {
      if (blobConfigured()) await del(media.pathname);
      return;
    }
    const root = path.resolve(localDir());
    const full = path.resolve(root, media.pathname);
    if (full.startsWith(root + path.sep)) await fs.rm(full, { force: true });
  } catch (error) {
    console.warn("[media] could not delete", media.pathname, error instanceof Error ? error.message : error);
  }
}
