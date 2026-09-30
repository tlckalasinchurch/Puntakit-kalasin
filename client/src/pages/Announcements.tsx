import { useState } from "react";
import { AlertCircle, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ListSkeleton } from "@/components/LoadingStates";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { useResource } from "@/hooks/useResource";
import { ApiError } from "@/lib/api";

interface Announcement {
  id: string;
  title: string;
  content: string;
  publishDate: string;
  status: "draft" | "published";
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const EMPTY_FORM = { title: "", content: "", status: "draft" as Announcement["status"] };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export default function Announcements() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { items, isLoading, error, reload, create, update, remove } = useResource<Announcement>("/api/announcements");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({ title: a.title, content: a.content, status: a.status });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        await update(editing.id, form);
        toast.success("บันทึกการแก้ไขประกาศแล้ว");
      } else {
        await create(form);
        toast.success("เพิ่มประกาศแล้ว");
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
      toast.success("ลบประกาศแล้ว");
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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            ANNOUNCEMENTS • ข่าวสารและการประกาศ
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
            การประกาศ
          </h1>
          <p className="text-xs text-slate-500">
            จัดการประกาศข่าวสารและข้อมูลประชาสัมพันธ์สำหรับคริสตจักร
          </p>
        </div>
        {isAdmin && (
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs"
            onClick={openCreate}
          >
            <Plus size={ICON_SIZE.sm} /> เพิ่มประกาศ
          </button>
        )}
      </div>

      <section className="tailadmin-card p-5 sm:p-6">
        {isLoading ? (
          <ListSkeleton count={5} />
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
            <Megaphone size={40} className="mx-auto text-slate-300 mb-2" />
            <h3 className="font-semibold text-slate-700 text-sm">ยังไม่มีประกาศ</h3>
            <p className="text-xs text-slate-400 mt-1">
              {isAdmin ? "เริ่มเพิ่มประกาศแรกของคุณ" : "รอผู้ดูแลระบบเพิ่มประกาศ"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((a) => (
              <div
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                key={a.id}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-slate-800 text-base leading-snug">{a.title}</h3>
                    <span
                      className={`flex-shrink-0 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        a.status === "published"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {a.status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่าง"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-4 whitespace-pre-line leading-relaxed">
                    {a.content}
                  </p>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                    <span>วันที่เผยแพร่: {formatDate(a.publishDate)}</span>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2 pt-3 mt-1">
                      <button
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        onClick={() => openEdit(a)}
                      >
                        <Pencil size={ICON_SIZE.xs} /> แก้ไข
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
                        onClick={() => setDeleteTarget(a)}
                      >
                        <Trash2 size={ICON_SIZE.xs} /> ลบ
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {formOpen && (
        <div className="modal-backdrop" onClick={() => setFormOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 14px" }}>{editing ? "แก้ไขประกาศ" : "เพิ่มประกาศ"}</h3>
            <form className="form-grid" onSubmit={handleSubmit}>
              <label className="full-field">
                หัวข้อ
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="full-field">
                เนื้อหา
                <textarea
                  required
                  rows={5}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </label>
              <label className="full-field">
                สถานะ
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Announcement["status"] })}
                >
                  <option value="draft">ฉบับร่าง</option>
                  <option value="published">เผยแพร่แล้ว</option>
                </select>
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
          title="ยืนยันการลบประกาศ"
          description={`ต้องการลบประกาศ "${deleteTarget.title}" ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`}
          isSubmitting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </AppLayout>
  );
}
