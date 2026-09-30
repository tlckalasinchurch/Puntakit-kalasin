import { useState } from "react";
import { HeartHandshake, Lock, Send, X } from "lucide-react";
import { toast } from "sonner";
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

export function PrayerRequestModal({ open, onClose, onSuccess }: PrayerRequestModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<PrayerCategory>("spiritual");
  const [isConfidential, setIsConfidential] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px" }}>
        <div className="modal-heading">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#f0e8ff",
                color: "#7950d8",
                display: "grid",
                placeItems: "center",
              }}
            >
              <HeartHandshake size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "17px", margin: 0, color: "var(--ink)" }}>ส่งคำขออธิษฐาน</h2>
              <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                พระเจ้าทรงฟังและตอบคำอธิษฐานของท่าน
              </small>
            </div>
          </div>
          <button onClick={onClose} aria-label="ปิด">
            <X size={ICON_SIZE.sm} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <label>
              <span>หัวข้อคำอธิษฐาน *</span>
              <input
                type="text"
                required
                placeholder="เช่น ขอการทรงรักษาโรค, ขอสติปัญญาในการสอบ"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <label>
              <span>หมวดหมู่</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PrayerCategory)}
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>รายละเอียด *</span>
              <textarea
                rows={4}
                required
                placeholder="แบ่งปันรายละเอียดหรือสิ่งที่ท่านต้องการให้อธิษฐานเผื่อ..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </label>

            <label
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                background: "#f7f9fc",
                borderRadius: "10px",
                border: "1px solid #e5edf5",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={isConfidential}
                onChange={(e) => setIsConfidential(e.target.checked)}
                style={{ width: "auto" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--ink)", fontWeight: 600 }}>
                  <Lock size={12} style={{ color: "#d97706" }} />
                  <span>เป็นความลับเฉพาะศิษยาภิบาล</span>
                </div>
                <small style={{ display: "block", fontSize: "10px", color: "#6e8297", marginTop: "2px" }}>
                  หากเปิดตัวเลือกนี้ เฉพาะศิษยาภิบาลเท่านั้นที่จะเห็นคำขอนี้ (ไม่ประกาศในทีมอธิษฐานทั่วไป)
                </small>
              </div>
            </label>
          </div>

          <div className="modal-actions" style={{ marginTop: "18px" }}>
            <button type="button" className="cancel-button" onClick={onClose} disabled={submitting}>
              ยกเลิก
            </button>
            <button
              type="submit"
              className="primary-action"
              disabled={submitting || !title.trim() || !content.trim()}
              style={{ background: "#7950d8" }}
            >
              <Send size={ICON_SIZE.sm} />
              <span>{submitting ? "กำลังส่ง..." : "ส่งคำขออธิษฐาน"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
