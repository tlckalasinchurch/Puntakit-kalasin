import { api } from "@/lib/api";
import { planImageSize, type PrepareOptions } from "@/lib/imageSizing";

/**
 * Phone photos are several MB; the API caps an image at 4 MB (Vercel's request
 * limit). Resizing in the browser keeps uploads fast on mobile data and strips
 * EXIF (including GPS) because the pixels are redrawn on a canvas.
 */

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

export class ImageUploadError extends Error {}

export async function prepareImage(file: File, options: PrepareOptions): Promise<PreparedImage> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new ImageUploadError("รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP");
  }
  if (file.size > MAX_SOURCE_BYTES) throw new ImageUploadError("ไฟล์ใหญ่เกินไป (เกิน 30 MB)");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageUploadError("เปิดรูปนี้ไม่ได้ ลองเลือกรูปอื่น");
  }
  const plan = planImageSize(bitmap.width, bitmap.height, options);
  const canvas = document.createElement("canvas");
  canvas.width = plan.dw;
  canvas.height = plan.dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageUploadError("เบราว์เซอร์นี้ย่อรูปไม่ได้");
  ctx.drawImage(bitmap, plan.sx, plan.sy, plan.sw, plan.sh, 0, 0, plan.dw, plan.dh);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", options.quality ?? 0.82));
  if (!blob) throw new ImageUploadError("แปลงรูปไม่สำเร็จ");
  return { blob, width: plan.dw, height: plan.dh };
}

export interface UploadedImage {
  id: string;
  url: string;
}

export function uploadMemberAvatar(memberId: string, image: PreparedImage): Promise<UploadedImage> {
  return api.postBody<UploadedImage>(`/api/media?kind=member_avatar&memberId=${encodeURIComponent(memberId)}`, image.blob, {
    "Content-Type": "image/jpeg",
  });
}

export function uploadMissionPhoto(groupId: string, image: PreparedImage): Promise<UploadedImage> {
  return api.postBody<UploadedImage>(`/api/media?kind=mission_photo&groupId=${encodeURIComponent(groupId)}`, image.blob, {
    "Content-Type": "image/jpeg",
  });
}
