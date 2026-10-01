import { useState } from "react";
import { AlertCircle, CalendarDays, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CardGridSkeleton } from "@/components/LoadingStates";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { useResource } from "@/hooks/useResource";
import { ApiError } from "@/lib/api";
import { ADMIN_ROLES, hasRole } from "@shared/roles";

interface Event {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  location: string | null;
  category: "worship" | "activity" | "meeting" | "other";
  status: "scheduled" | "cancelled" | "completed";
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_LABEL: Record<Event["category"], string> = {
  worship: "นมัสการ",
  activity: "กิจกรรม",
  meeting: "ประชุม",
  other: "อื่นๆ",
};

const STATUS_LABEL: Record<Event["status"], string> = {
  scheduled: "กำหนดการ",
  cancelled: "ยกเลิก",
  completed: "เสร็จสิ้น",
};

function toLocalInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  eventDate: "",
  location: "",
  category: "worship" as Event["category"],
  status: "scheduled" as Event["status"],
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Events() {
  const { user } = useAuth();
  // Mirrors the server's `requireAdmin` (shared/roles.ts ADMIN_ROLES).
  const isAdmin = hasRole(user?.role, ADMIN_ROLES);
  const { items, isLoading, error, reload, create, update, remove } = useResource<Event>("/api/events");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (ev: Event) => {
    setEditing(ev);
    setForm({
      title: ev.title,
      description: ev.description ?? "",
      eventDate: toLocalInput(ev.eventDate),
      location: ev.location ?? "",
      category: ev.category,
      status: ev.status,
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form, eventDate: new Date(form.eventDate).toISOString() };
      if (editing) {
        await update(editing.id, payload);
        toast.success("บันทึกการแก้ไขกิจกรรมแล้ว");
      } else {
        await create(payload);
        toast.success("เพิ่มกิจกรรมแล้ว");
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      toast.success("ลบกิจกรรมแล้ว");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout>
      {/* Page Heading */}
      <div className="events-page-hero mb-6 flex flex-col gap-5 rounded-[24px] border border-blue-100 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700">
            <CalendarDays size={13} /> ACTIVITY PULSE
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--color-primary)] sm:text-3xl">
            การนมัสการ / กิจกรรม
          </h1>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-600 sm:text-sm">
            ดูกิจกรรมล่าสุดและวางแผนการมีส่วนร่วมของคริสตจักรในมุมมองเดียว
          </p>
        </div>
        {isAdmin && (
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs"
            onClick={openCreate}
          >
            <Plus size={ICON_SIZE.sm} /> เพิ่มกิจกรรม
          </button>
        )}
      </div>

      <section className="tailadmin-card overflow-hidden border-blue-100 p-5 shadow-[0_12px_32px_rgba(36,92,146,0.07)] sm:p-6">
        {isLoading ? (
          <CardGridSkeleton count={6} />
        ) : error ? (
          <div className="p-10 text-center text-rose-600">
            <AlertCircle size={ICON_SIZE.xl} className="mx-auto mb-2 text-rose-500" />
            <h3 className="font-bold text-sm">โหลดข้อมูลไม่สำเร็จ</h3>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button
              className="mt-4 rounded-xl bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100"
              onClick={reload}
            >
              ลองใหม่
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CalendarDays size={40} className="mx-auto text-slate-300 mb-2" />
            <h3 className="font-semibold text-slate-700 text-sm">ยังไม่มีกิจกรรม</h3>
            <p className="text-xs text-slate-400 mt-1">
              {isAdmin ? "เริ่มเพิ่มกิจกรรมแรกของคุณ" : "รอผู้ดูแลระบบเพิ่มกิจกรรม"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((ev) => (
              <div
                className="event-surface group flex flex-col justify-between rounded-2xl border border-blue-100 bg-white p-5 shadow-[0_8px_24px_rgba(36,92,146,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_14px_30px_rgba(36,92,146,0.12)]"
                key={ev.id}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0"><span className="mb-2 inline-flex rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">{CATEGORY_LABEL[ev.category]}</span><h3 className="font-bold text-slate-800 text-base leading-snug">{ev.title}</h3></div>
                    <span
                      className={`flex-shrink-0 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        ev.status === "cancelled"
                          ? "bg-rose-50 text-rose-600"
                          : ev.status === "completed"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      {STATUS_LABEL[ev.status]}
                    </span>
                  </div>
                  {ev.description && (
                    <p className="text-xs text-slate-500 mb-4 line-clamp-3 leading-relaxed">
                      {ev.description}
                    </p>
                  )}
                  <div className="space-y-1.5 text-xs text-slate-500 mb-4">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={ICON_SIZE.xs} className="text-blue-500" />
                      <span>{formatDateTime(ev.eventDate)}</span>
                    </div>
                    {ev.location && (
                      <div className="flex items-center gap-2">
                        <MapPin size={ICON_SIZE.xs} className="text-amber-500" />
                        <span className="truncate">{ev.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100 mt-2">
                    <button
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      onClick={() => openEdit(ev)}
                    >
                      <Pencil size={ICON_SIZE.xs} /> แก้ไข
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
                      onClick={() => setDeleteTarget(ev)}
                    >
                      <Trash2 size={ICON_SIZE.xs} /> ลบ
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {formOpen && (
        <div className="modal-backdrop" onClick={() => setFormOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 14px" }}>{editing ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"}</h3>
            <form className="form-grid" onSubmit={handleSubmit}>
              <label className="full-field">
                ชื่อกิจกรรม
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label>
                วันเวลา
                <input
                  type="datetime-local"
                  required
                  value={form.eventDate}
                  onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                />
              </label>
              <label>
                สถานที่
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </label>
              <label>
                ประเภท
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as Event["category"] })}
                >
                  <option value="worship">นมัสการ</option>
                  <option value="activity">กิจกรรม</option>
                  <option value="meeting">ประชุม</option>
                  <option value="other">อื่นๆ</option>
                </select>
              </label>
              <label>
                สถานะ
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Event["status"] })}>
                  <option value="scheduled">กำหนดการ</option>
                  <option value="cancelled">ยกเลิก</option>
                  <option value="completed">เสร็จสิ้น</option>
                </select>
              </label>
              <label className="full-field">
                รายละเอียด
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
              <div className="modal-actions full-field">
                <button type="button" className="cancel-button" onClick={() => setFormOpen(false)}>
                  ยกเลิก
                </button>
                <button type="submit" className="primary-action" disabled={submitting}>
                  {submitting ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="ยืนยันการลบกิจกรรม"
          description={`ต้องการลบ "${deleteTarget.title}" ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`}
          isSubmitting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </AppLayout>
  );
}
