import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/DesignSystem";
import { api, ApiError } from "@/lib/api";
import { ICON_SIZE } from "@/lib/icon-sizes";
import {
  ACCEPTED_IMAGE_TYPES,
  ImageUploadError,
  prepareImage,
  uploadMissionPhoto,
  type PreparedImage,
} from "@/lib/imageUpload";

const MAX_PHOTOS = 6;

const BTN =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const BTN_PRIMARY = `${BTN} bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-focus)]`;
const BTN_OUTLINE = `${BTN} border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-canvas-soft)]`;
const INPUT =
  "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-base md:text-sm text-[var(--color-ink)] placeholder:text-[var(--color-body-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

interface Picked {
  key: string;
  preview: string;
  image: PreparedImage;
}

type Stage = "idle" | "preparing" | "uploading" | "saving";

/**
 * "อัปเดตภาพพันธกิจ": pick (or take) photos for a group the user may post for,
 * add a line of text, save. Photos are resized in the browser, stored
 * privately via `POST /api/media`, then attached to a new mission activity
 * through the existing `POST /api/activities` — so the Feed, the group page and
 * the Home strip all show the same record. Nothing is shown as saved until the
 * server confirms it.
 */
export function MissionPhotoSheet({
  open,
  onClose,
  groups,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  groups: Array<{ id: string; name: string }>;
  onSaved: () => void;
}) {
  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const busy = stage !== "idle";

  // Reset whenever the sheet is opened fresh.
  useEffect(() => {
    if (!open) return;
    setGroupId(groups.length === 1 ? groups[0].id : "");
    setTitle("");
    setStory("");
    setPicked((old) => {
      old.forEach((p) => URL.revokeObjectURL(p.preview));
      return [];
    });
    setStage("idle");
    setProgress(0);
    setError(null);
  }, [open, groups]);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setStage("preparing");
    try {
      const room = MAX_PHOTOS - picked.length;
      const next: Picked[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        const image = await prepareImage(file, { maxEdge: 1600, quality: 0.82 });
        next.push({ key: `${file.name}-${file.size}-${file.lastModified}-${next.length}`, preview: URL.createObjectURL(image.blob), image });
      }
      setPicked((old) => [...old, ...next]);
      if (files.length > room) setError(`เลือกได้สูงสุด ${MAX_PHOTOS} รูปต่อครั้ง`);
    } catch (err) {
      setError(err instanceof ImageUploadError ? err.message : "เตรียมรูปไม่สำเร็จ ลองรูปอื่น");
    } finally {
      setStage("idle");
      if (pickRef.current) pickRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  const removeAt = (key: string) => {
    setPicked((old) => {
      const gone = old.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return old.filter((p) => p.key !== key);
    });
  };

  const groupName = groups.find((g) => g.id === groupId)?.name ?? "";

  const save = async () => {
    if (busy) return;
    if (!groupId) return setError("เลือกพันธกิจที่จะอัปเดตภาพ");
    if (picked.length === 0) return setError("เลือกหรือถ่ายรูปอย่างน้อย 1 รูป");
    setError(null);
    try {
      setStage("uploading");
      const urls: string[] = [];
      for (let i = 0; i < picked.length; i++) {
        setProgress(i);
        const up = await uploadMissionPhoto(groupId, picked[i].image);
        urls.push(up.url);
      }
      setProgress(picked.length);
      setStage("saving");
      await api.post("/api/activities", {
        type: "ministry_update",
        title: title.trim() || `อัปเดตภาพพันธกิจ ${groupName}`,
        story: story.trim() || undefined,
        occurredAt: new Date().toISOString(),
        groupId,
        media: urls.map((url) => ({ url, kind: "image" })),
      });
      toast.success(`บันทึกภาพพันธกิจแล้ว (${urls.length} รูป)`);
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof ImageUploadError
          ? `${err.message} — รูปที่เลือกยังอยู่ กดบันทึกอีกครั้งได้`
          : "บันทึกไม่สำเร็จ รูปที่เลือกยังอยู่ กดบันทึกอีกครั้งได้"
      );
    } finally {
      setStage("idle");
    }
  };

  const status =
    stage === "preparing"
      ? "กำลังเตรียมรูป…"
      : stage === "uploading"
        ? `กำลังอัปโหลดรูป ${Math.min(progress + 1, picked.length)} จาก ${picked.length}…`
        : stage === "saving"
          ? "กำลังบันทึก…"
          : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="อัปเดตภาพพันธกิจ"
      description="ถ่ายหรือเลือกรูปจากกิจกรรมของกลุ่ม แล้วบันทึกเข้าฟีดพันธกิจ"
      discardGuard={picked.length > 0 && !busy}
      footer={
        <>
          <button type="button" className={BTN_OUTLINE} onClick={onClose} disabled={busy}>
            ยกเลิก
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={() => void save()} disabled={busy || picked.length === 0 || !groupId}>
            {busy ? status || "กำลังทำงาน…" : `บันทึกภาพ${picked.length > 0 ? ` (${picked.length})` : ""}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {groups.length === 0 ? (
          <p role="alert" className="type-caption rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] p-3 text-[var(--color-ink)]">
            คุณยังไม่ได้เป็นผู้ดูแลพันธกิจใดในระบบ จึงอัปเดตภาพไม่ได้ — แจ้งผู้ดูแลระบบให้กำหนดกลุ่มที่คุณนำ
          </p>
        ) : (
          <>
            {groups.length > 1 ? (
              <label className="block">
                <span className="type-caption-strong text-[var(--color-ink)]">พันธกิจ</span>
                <select className={`${INPUT} mt-1`} value={groupId} onChange={(e) => setGroupId(e.target.value)} disabled={busy}>
                  <option value="">เลือกพันธกิจ</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="type-caption text-[var(--color-text-secondary)]">
                พันธกิจ: <strong className="text-[var(--color-ink)]">{groups[0].name}</strong>
              </p>
            )}

            <div>
              <input ref={pickRef} type="file" accept={ACCEPTED_IMAGE_TYPES} multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void addFiles(e.target.files)} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void addFiles(e.target.files)} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className={BTN_OUTLINE} disabled={busy || picked.length >= MAX_PHOTOS} onClick={() => cameraRef.current?.click()}>
                  <Camera size={ICON_SIZE.sm} aria-hidden="true" />
                  ถ่ายรูป
                </button>
                <button type="button" className={BTN_OUTLINE} disabled={busy || picked.length >= MAX_PHOTOS} onClick={() => pickRef.current?.click()}>
                  <ImagePlus size={ICON_SIZE.sm} aria-hidden="true" />
                  เลือกรูป
                </button>
              </div>
              {picked.length > 0 && (
                <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="รูปที่เลือก">
                  {picked.map((p, index) => (
                    <li key={p.key} className="relative aspect-square overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-canvas-soft)]">
                      <img src={p.preview} alt={`รูปที่ ${index + 1}`} className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeAt(p.key)}
                        disabled={busy}
                        aria-label={`เอารูปที่ ${index + 1} ออก`}
                        className="absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-full bg-[var(--color-black)]/60 text-[var(--color-on-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50"
                      >
                        <X size={ICON_SIZE.sm} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="block">
              <span className="type-caption-strong text-[var(--color-ink)]">หัวข้อ (ไม่บังคับ)</span>
              <input className={`${INPUT} mt-1`} value={title} maxLength={300} placeholder={groupName ? `อัปเดตภาพพันธกิจ ${groupName}` : "เช่น เยี่ยมสมาชิกที่บ้าน"} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
            </label>
            <label className="block">
              <span className="type-caption-strong text-[var(--color-ink)]">เล่าสั้น ๆ (ไม่บังคับ)</span>
              <textarea className={`${INPUT} mt-1 py-2`} rows={3} value={story} maxLength={5000} onChange={(e) => setStory(e.target.value)} disabled={busy} />
            </label>
            <p className="type-fine text-[var(--color-body-muted)]">ภาพจะถูกบันทึกเป็นฉบับร่าง เห็นได้เฉพาะคุณและผู้ดูแลจนกว่าจะเผยแพร่ในฟีด</p>
          </>
        )}

        {status && (
          <p role="status" className="type-caption text-[var(--color-text-secondary)]">
            {status}
          </p>
        )}
        {error && (
          <p role="alert" className="type-caption text-[var(--color-error)]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
