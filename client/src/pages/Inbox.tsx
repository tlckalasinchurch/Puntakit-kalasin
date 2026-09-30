import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Inbox as InboxIcon, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { ListSkeleton } from "@/components/LoadingStates";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import type { MissionActivityType, MissionSubmissionStatus } from "@shared/schema";

interface SubmissionRow {
  id: string;
  status: MissionSubmissionStatus;
  source: string;
  rawText: string | null;
  submittedByLabel: string | null;
  publishedActivityId: string | null;
  createdById: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<MissionSubmissionStatus, string> = {
  new: "ใหม่",
  reviewing: "กำลังตรวจสอบ",
  needs_info: "ต้องการข้อมูลเพิ่ม",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
};

const STATUS_BADGE_CLASS: Record<MissionSubmissionStatus, string> = {
  new: "bg-blue-50 text-blue-700",
  reviewing: "bg-amber-50 text-amber-700",
  needs_info: "bg-orange-50 text-orange-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-slate-100 text-slate-400",
};

const TYPE_LABELS: Record<MissionActivityType, string> = {
  house_mission: "เยี่ยมบ้าน",
  mission_visit: "ออกเยี่ยมพันธกิจ",
  bible_study: "ศึกษาพระคัมภีร์",
  prayer: "อธิษฐาน",
  worship: "นมัสการ",
  fellowship: "สามัคคีธรรม",
  testimony: "คำพยาน",
  evangelism: "ประกาศข่าวประเสริฐ",
  pastoral_visit: "เยี่ยมเยียนอภิบาล",
  outreach: "กิจกรรมชุมชน",
  ministry_update: "อัปเดตพันธกิจ",
  other: "อื่นๆ",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const REVIEW_ROLES = ["super_admin", "admin", "staff", "ministry_leader"];

export default function Inbox() {
  const { user } = useAuth();
  const isReviewer = user && REVIEW_ROLES.includes(user.role);

  const [items, setItems] = useState<SubmissionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [captureOpen, setCaptureOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [rawMediaUrls, setRawMediaUrls] = useState<string[]>([]);
  const [submittedByLabel, setSubmittedByLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [publishTarget, setPublishTarget] = useState<SubmissionRow | null>(null);
  const [publishForm, setPublishForm] = useState({
    type: "house_mission" as MissionActivityType,
    title: "",
    occurredAt: new Date().toISOString().slice(0, 16),
  });
  const [publishing, setPublishing] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "50");
      const data = await api.get<SubmissionRow[]>(`/api/submissions?${params.toString()}`);
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "โหลดกล่องข้อมูลนำเข้าไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const submitCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/api/submissions", {
        rawText: rawText || undefined,
        rawMediaUrls: rawMediaUrls.filter((u) => u.trim()),
        submittedByLabel: submittedByLabel || undefined,
      });
      toast.success("บันทึกข้อมูลนำเข้าแล้ว");
      setCaptureOpen(false);
      setRawText("");
      setRawMediaUrls([]);
      setSubmittedByLabel("");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const transition = async (row: SubmissionRow, status: MissionSubmissionStatus) => {
    try {
      await api.put(`/api/submissions/${row.id}/status`, { status });
      toast.success(`เปลี่ยนสถานะเป็น "${STATUS_LABELS[status]}" แล้ว`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เปลี่ยนสถานะไม่สำเร็จ");
    }
  };

  const openPublish = (row: SubmissionRow) => {
    setPublishTarget(row);
    setPublishForm({
      type: "house_mission",
      title: row.rawText ? row.rawText.slice(0, 80) : "",
      occurredAt: new Date().toISOString().slice(0, 16),
    });
  };

  const submitPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishTarget) return;
    setPublishing(true);
    try {
      await api.post(`/api/submissions/${publishTarget.id}/publish`, {
        type: publishForm.type,
        title: publishForm.title,
        occurredAt: new Date(publishForm.occurredAt).toISOString(),
        includeRawMedia: true,
      });
      toast.success("เผยแพร่เป็นกิจกรรมพันธกิจแล้ว (ฉบับร่าง)");
      setPublishTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เผยแพร่ไม่สำเร็จ");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">INBOX • ข้อมูลนำเข้า</span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">กล่องข้อมูลนำเข้า</h1>
          <p className="text-xs text-slate-500">สิ่งที่ยังไม่ได้เป็นข้อมูลทางการ — พิมพ์สิ่งที่ได้รับ (เช่นจาก LINE) แล้วตรวจสอบก่อนเผยแพร่</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs"
          onClick={() => setCaptureOpen(true)}
        >
          <Sparkles size={ICON_SIZE.sm} /> บันทึกข้อมูลนำเข้า
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">ทุกสถานะ</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : error ? (
        <div className="tailadmin-card p-10 text-center text-rose-600">
          <AlertCircle size={ICON_SIZE.xl} className="mx-auto mb-2 text-rose-500" />
          <h3 className="font-bold text-sm">โหลดไม่สำเร็จ</h3>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="tailadmin-card p-12 text-center text-slate-400">
          <InboxIcon size={40} className="mx-auto text-slate-300 mb-2" />
          <h3 className="font-semibold text-slate-700 text-sm">ไม่มีข้อมูลนำเข้า</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((row) => (
            <div key={row.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE_CLASS[row.status]}`}>
                  {STATUS_LABELS[row.status]}
                </span>
                <span className="text-[11px] text-slate-400">{formatDateTime(row.createdAt)}</span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-line">{row.rawText || "(ไม่มีข้อความ)"}</p>
              {row.submittedByLabel && <p className="text-[11px] text-slate-400 mt-1">จาก: {row.submittedByLabel}</p>}

              {isReviewer && (
                <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-slate-100">
                  {row.status === "new" && (
                    <button
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => transition(row, "reviewing")}
                    >
                      <Send size={12} /> เริ่มตรวจสอบ
                    </button>
                  )}
                  {row.status === "reviewing" && (
                    <>
                      <button
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                        onClick={() => transition(row, "approved")}
                      >
                        <CheckCircle2 size={12} /> อนุมัติ
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                        onClick={() => transition(row, "needs_info")}
                      >
                        ต้องการข้อมูลเพิ่ม
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-100"
                        onClick={() => transition(row, "rejected")}
                      >
                        <X size={12} /> ปฏิเสธ
                      </button>
                    </>
                  )}
                  {row.status === "needs_info" && (
                    <button
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => transition(row, "reviewing")}
                    >
                      กลับไปตรวจสอบ
                    </button>
                  )}
                  {row.status === "approved" && !row.publishedActivityId && (
                    <button
                      className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                      onClick={() => openPublish(row)}
                    >
                      <Sparkles size={12} /> เผยแพร่เป็นกิจกรรม
                    </button>
                  )}
                  {row.publishedActivityId && (
                    <span className="text-[11px] text-emerald-600 font-semibold">เผยแพร่เป็นกิจกรรมแล้ว</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Sheet open={captureOpen} onOpenChange={setCaptureOpen}>
        <SheetContent side="right" className="w-full bg-white sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>บันทึกข้อมูลนำเข้า</SheetTitle>
          </SheetHeader>
          <form className="flex flex-col gap-4 px-4 pb-24" onSubmit={submitCapture}>
            <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1.5">
              ข้อความที่ได้รับ
              <textarea
                rows={6}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="พิมพ์สิ่งที่ได้รับมา เช่น จากข้อความ LINE ของทีมภาคสนาม..."
              />
            </label>
            <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1.5">
              ผู้ส่งข้อมูล (ถ้ามี)
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal"
                value={submittedByLabel}
                onChange={(e) => setSubmittedByLabel(e.target.value)}
                placeholder="เช่น LINE: ทีมภาคสนามเขต 1"
              />
            </label>
            <div className="text-xs font-semibold text-slate-600 flex flex-col gap-1.5">
              รูปภาพ (ลิงก์ URL)
              {rawMediaUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal"
                    value={url}
                    onChange={(e) => {
                      const next = [...rawMediaUrls];
                      next[i] = e.target.value;
                      setRawMediaUrls(next);
                    }}
                    placeholder="https://..."
                  />
                  <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" onClick={() => setRawMediaUrls(rawMediaUrls.filter((_, idx) => idx !== i))}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-1 self-start rounded-xl border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                onClick={() => setRawMediaUrls([...rawMediaUrls, ""])}
              >
                + เพิ่มรูปภาพ
              </button>
            </div>
            <SheetFooter className="px-0">
              <button type="submit" className="primary-action" disabled={submitting}>
                {submitting ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={!!publishTarget} onOpenChange={(open) => !open && setPublishTarget(null)}>
        <SheetContent side="right" className="w-full bg-white sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>เผยแพร่เป็นกิจกรรมพันธกิจ</SheetTitle>
          </SheetHeader>
          <form className="flex flex-col gap-4 px-4 pb-24" onSubmit={submitPublish}>
            <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1.5">
              ประเภทกิจกรรม
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={publishForm.type}
                onChange={(e) => setPublishForm({ ...publishForm, type: e.target.value as MissionActivityType })}
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1.5">
              หัวข้อ
              <input
                required
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={publishForm.title}
                onChange={(e) => setPublishForm({ ...publishForm, title: e.target.value })}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1.5">
              วันเวลาที่เกิดขึ้น
              <input
                type="datetime-local"
                required
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={publishForm.occurredAt}
                onChange={(e) => setPublishForm({ ...publishForm, occurredAt: e.target.value })}
              />
            </label>
            <SheetFooter className="px-0">
              <button type="submit" className="primary-action" disabled={publishing}>
                {publishing ? "กำลังเผยแพร่..." : "สร้างกิจกรรม (ฉบับร่าง)"}
              </button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
