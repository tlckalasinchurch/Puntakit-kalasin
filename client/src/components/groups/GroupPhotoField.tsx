import { useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { ACCEPTED_IMAGE_TYPES, ImageUploadError, prepareImage, uploadGroupPhoto } from "@/lib/imageUpload";
import { ICON_SIZE } from "@/lib/icon-sizes";

interface GroupPhotoFieldProps {
  groupId: string;
  groupName: string;
  /** The stored place photo (`/api/media/<id>`), or null. */
  url: string | null;
  /** Show the change / remove controls. The server still decides who may actually save. */
  canEdit: boolean;
  onChange: (url: string | null) => void;
}

/**
 * The place photo of a group (shown on its map card). Photos are resized in the browser
 * (EXIF/GPS is stripped when the pixels are redrawn), stored privately, and served only to
 * people who may see the group's location. Without a photo and without edit rights it
 * renders nothing, so a card never shows an empty frame.
 */
export function GroupPhotoField({ groupId, groupName, url, canEdit, onChange }: GroupPhotoFieldProps) {
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [failed, setFailed] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy("upload");
    try {
      const image = await prepareImage(file, { maxEdge: 1280, aspect: 4 / 3, quality: 0.85 });
      const uploaded = await uploadGroupPhoto(groupId, image);
      setFailed(false);
      onChange(uploaded.url);
      toast.success("บันทึกรูปสถานที่แล้ว");
    } catch (err) {
      toast.error(err instanceof ImageUploadError || err instanceof ApiError ? err.message : "อัปโหลดรูปไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setBusy(null);
      if (pick.current) pick.current.value = "";
      if (camera.current) camera.current.value = "";
    }
  };

  const remove = async () => {
    setBusy("remove");
    try {
      await api.put(`/api/groups/${groupId}`, { coverUrl: "" });
      onChange(null);
      toast.success("ลบรูปสถานที่แล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบรูปไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  const hasPhoto = Boolean(url) && !failed;
  if (!hasPhoto && !canEdit) return null;

  return (
    <div className="space-y-2">
      {hasPhoto ? (
        <img
          src={url!}
          alt={`รูปสถานที่ของ ${groupName}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="aspect-[4/3] w-full rounded-[var(--radius-tile)] border border-[var(--color-hairline)] bg-[var(--color-canvas-soft)] object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-[var(--radius-tile)] border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas-soft)] text-center">
          <ImagePlus size={ICON_SIZE.xl} aria-hidden="true" className="text-[var(--color-body-muted)]" />
          <p className="type-caption text-[var(--color-body-muted)]">ยังไม่มีรูปสถานที่ เช่น หน้าบ้านหรือจุดสังเกต</p>
        </div>
      )}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <input ref={pick} type="file" accept={ACCEPTED_IMAGE_TYPES} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void onFile(e.target.files?.[0])} />
          <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button type="button" variant="outline" disabled={busy !== null} onClick={() => pick.current?.click()}>
            <ImagePlus size={ICON_SIZE.sm} aria-hidden="true" />
            {busy === "upload" ? "กำลังอัปโหลด…" : hasPhoto ? "เปลี่ยนรูป" : "เพิ่มรูป"}
          </Button>
          <Button type="button" variant="outline" disabled={busy !== null} onClick={() => camera.current?.click()}>
            <Camera size={ICON_SIZE.sm} aria-hidden="true" />
            ถ่ายรูป
          </Button>
          {hasPhoto && (
            <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void remove()}>
              <Trash2 size={ICON_SIZE.sm} aria-hidden="true" />
              {busy === "remove" ? "กำลังลบ…" : "ลบรูป"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
