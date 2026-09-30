import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, ListTodo, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { ListSkeleton } from "@/components/LoadingStates";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { api, ApiError } from "@/lib/api";
import type { FollowUpStatus } from "@shared/schema";

interface FollowUpRow {
  id: string;
  status: FollowUpStatus;
  title: string;
  subjectMemberId: string | null;
  subjectMemberName: string | null;
  subjectGroupId: string | null;
  subjectGroupName: string | null;
  activityId: string | null;
  ownerId: string | null;
  ownerName: string | null;
  dueAt: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<FollowUpStatus, string> = {
  open: "รอดำเนินการ",
  in_progress: "กำลังติดตาม",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
};

const STATUS_BADGE_CLASS: Record<FollowUpStatus, string> = {
  open: "bg-amber-50 text-amber-700",
  in_progress: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-400",
};

function formatDate(iso: string | null) {
  if (!iso) return "ไม่มีกำหนด";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(row: FollowUpRow) {
  return row.dueAt && (row.status === "open" || row.status === "in_progress") && new Date(row.dueAt) < new Date();
}

export default function FollowUps() {
  const [items, setItems] = useState<FollowUpRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (overdueOnly) params.set("overdue", "true");
      params.set("limit", "50");
      const data = await api.get<FollowUpRow[]>(`/api/follow-ups?${params.toString()}`);
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "โหลดรายการติดตามไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, overdueOnly]);

  const transition = async (row: FollowUpRow, status: FollowUpStatus) => {
    setTransitioningId(row.id);
    try {
      await api.put(`/api/follow-ups/${row.id}/status`, { status });
      toast.success(`เปลี่ยนสถานะเป็น "${STATUS_LABELS[status]}" แล้ว`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setTransitioningId(null);
    }
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">FOLLOW-UP • การติดตาม</span>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">รายการติดตาม</h1>
        <p className="text-xs text-slate-500">อะไรต้องทำต่อ กับใคร ภายในเมื่อไร — สร้างจากหน้ากิจกรรมพันธกิจหรือโปรไฟล์สมาชิก</p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
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
        <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
          เลยกำหนดเท่านั้น
        </label>
      </div>

      {isLoading ? (
        <ListSkeleton count={5} />
      ) : error ? (
        <div className="tailadmin-card p-10 text-center text-rose-600">
          <AlertCircle size={ICON_SIZE.xl} className="mx-auto mb-2 text-rose-500" />
          <h3 className="font-bold text-sm">โหลดรายการติดตามไม่สำเร็จ</h3>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
          <button className="mt-4 rounded-xl bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100" onClick={load}>
            ลองใหม่
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="tailadmin-card p-12 text-center text-slate-400">
          <ListTodo size={40} className="mx-auto text-slate-300 mb-2" />
          <h3 className="font-semibold text-slate-700 text-sm">ไม่มีรายการติดตาม</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((row) => (
            <div
              key={row.id}
              className={`rounded-2xl border bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center gap-3 ${
                isOverdue(row) ? "border-rose-200" : "border-slate-200/80"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE_CLASS[row.status]}`}>
                    {STATUS_LABELS[row.status]}
                  </span>
                  {isOverdue(row) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                      <Clock size={10} /> เลยกำหนด
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800">{row.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {[row.subjectMemberName, row.subjectGroupName].filter(Boolean).join(" • ") || "ไม่ระบุเป้าหมาย"}
                  {row.ownerName ? ` • ผู้รับผิดชอบ: ${row.ownerName}` : ""}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">กำหนด: {formatDate(row.dueAt)}</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {row.status === "open" && (
                  <button
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    disabled={transitioningId === row.id}
                    onClick={() => transition(row, "in_progress")}
                  >
                    กำลังติดตาม
                  </button>
                )}
                {(row.status === "open" || row.status === "in_progress") && (
                  <>
                    <button
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                      disabled={transitioningId === row.id}
                      onClick={() => transition(row, "completed")}
                    >
                      <CheckCircle2 size={12} /> เสร็จสิ้น
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                      disabled={transitioningId === row.id}
                      onClick={() => transition(row, "cancelled")}
                    >
                      <X size={12} /> ยกเลิก
                    </button>
                  </>
                )}
                {(row.status === "completed" || row.status === "cancelled") && (
                  <button
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                    disabled={transitioningId === row.id}
                    onClick={() => transition(row, "open")}
                  >
                    <RotateCcw size={12} /> เปิดใหม่
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
