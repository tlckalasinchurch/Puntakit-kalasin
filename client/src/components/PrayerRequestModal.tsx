import { useId, useState } from "react";
import { HeartHandshake, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { Field, Modal } from "@/components/DesignSystem";
import { api, ApiError } from "@/lib/api";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { PrayerCategory } from "@shared/schema";

interface PrayerRequestModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CATEGORY_LABELS: Record<PrayerCategory, string> = {
  spiritual: "ฝ่ายวิญญาณ / ความเชื่อ",
  health: "สุขภาพ / การรักษาโรค",
  family: "ครอบครัว / ความสัมพันธ์",
  work: "การงาน / การเรียน / การเงิน",
  thanksgiving: "ขอบพระคุณพระเจ้า",
  other: "เรื่องอื่นๆ",
};

const CONTROL_CLASS =
  "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-body-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

const SUBMIT_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";

export function PrayerRequestModal({ open, onClose, onSuccess }: PrayerRequestModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<PrayerCategory>("spiritual");
  const [isConfidential, setIsConfidential] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // The submit button lives in the Modal footer (outside the <form>), so it
  // submits the form by id. Strip React's colons to keep the id selector-safe.
  const formId = `prayer-request-${useId().replace(/:/g, "")}`;

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("กรุณากรอกหัวข้อและรายละเอียดคำขออธิษฐาน");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/me/prayer-requests", {
        title: title.trim(),
        content: content.trim(),
        category,
        isConfidential,
      });

      toast.success("ส่งคำขออธิษฐานเรียบร้อยแล้ว ทีมศิษยาภิบาลจะร่วมอธิษฐานเผื่อท่าน");
      setTitle("");
      setContent("");
      setIsConfidential(false);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่งคำขออธิษฐานไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ส่งคำขออธิษฐาน"
      description="พระเจ้าทรงฟังและตอบคำอธิษฐานของท่าน"
      footer={
        <>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50"
            onClick={onClose}
            disabled={submitting}
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            form={formId}
            className={SUBMIT_BUTTON_CLASS}
            disabled={submitting || !title.trim() || !content.trim()}
          >
            <Send size={ICON_SIZE.sm} aria-hidden="true" />
            <span>{submitting ? "กำลังส่ง..." : "ส่งคำขออธิษฐาน"}</span>
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-[var(--color-primary)]">
          <HeartHandshake size={ICON_SIZE.md} aria-hidden="true" />
          <span className="type-caption-strong">แบ่งปันคำอธิษฐานกับทีมศิษยาภิบาล</span>
        </div>

        <Field label="หัวข้อคำอธิษฐาน" required>
          {(props) => (
            <input
              id={props.id}
              aria-describedby={props["aria-describedby"]}
              aria-invalid={props["aria-invalid"]}
              type="text"
              required
              placeholder="เช่น ขอการทรงรักษาโรค, ขอสติปัญญาในการสอบ"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={CONTROL_CLASS}
            />
          )}
        </Field>

        <Field label="หมวดหมู่">
          {(props) => (
            <select
              id={props.id}
              aria-describedby={props["aria-describedby"]}
              aria-invalid={props["aria-invalid"]}
              value={category}
              onChange={(e) => setCategory(e.target.value as PrayerCategory)}
              className={CONTROL_CLASS}
            >
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="รายละเอียด" required>
          {(props) => (
            <textarea
              id={props.id}
              aria-describedby={props["aria-describedby"]}
              aria-invalid={props["aria-invalid"]}
              rows={4}
              required
              placeholder="แบ่งปันรายละเอียดหรือสิ่งที่ท่านต้องการให้อธิษฐานเผื่อ..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={CONTROL_CLASS}
            />
          )}
        </Field>

        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas-soft)] px-3 py-3">
          <input
            type="checkbox"
            checked={isConfidential}
            onChange={(e) => setIsConfidential(e.target.checked)}
            className="mt-0.5 size-5 accent-[var(--color-primary)]"
          />
          <span className="min-w-0">
            <span className="type-caption-strong flex items-center gap-1.5 text-[var(--color-ink)]">
              <Lock size={ICON_SIZE.xs} aria-hidden="true" className="text-[var(--color-warning)]" />
              เป็นความลับเฉพาะศิษยาภิบาล
            </span>
            <span className="type-fine mt-0.5 block text-[var(--color-body-muted)]">
              หากเปิดตัวเลือกนี้ เฉพาะศิษยาภิบาลเท่านั้นที่จะเห็นคำขอนี้ (ไม่ประกาศในทีมอธิษฐานทั่วไป)
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
}
