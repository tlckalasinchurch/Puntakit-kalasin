import { useState } from "react";
import { AlertCircle, HeartHandshake, Pencil, Plus, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CardGridSkeleton } from "@/components/LoadingStates";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { useResource } from "@/hooks/useResource";
import { ApiError } from "@/lib/api";

interface Ministry {
  id: string;
  name: string;
  description: string | null;
  leader: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

const EMPTY_FORM = { name: "", description: "", leader: "", status: "active" as Ministry["status"] };

export default function Ministries() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { items, isLoading, error, reload, create, update, remove } = useResource<Ministry>("/api/ministries");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ministry | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Ministry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (m: Ministry) => {
    setEditing(m);
    setForm({ name: m.name, description: m.description ?? "", leader: m.leader ?? "", status: m.status });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        await update(editing.id, form);
        toast.success("บันทึกการแก้ไขพันธกิจแล้ว");
      } else {
        await create(form);
        toast.success("เพิ่มพันธกิจแล้ว");
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
      toast.success("ลบพันธกิจแล้ว");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="page-heading">
        <div>
          <span className="eyebrow blue-eyebrow">MINISTRY</span>
          <h1>พันธกิจ</h1>
          <p>จัดการทีมพันธกิจและผู้รับผิดชอบ</p>
        </div>
        {isAdmin && (
          <button className="primary-action" onClick={openCreate}>
            <Plus size={ICON_SIZE.sm} /> เพิ่มพันธกิจ
          </button>
        )}
      </div>

      <section className="member-panel card-surface">
        {isLoading ? (
          <CardGridSkeleton count={6} />
        ) : error ? (
          <div className="state-panel error-panel">
            <AlertCircle size={ICON_SIZE["2xl"]} />
            <h3>โหลดข้อมูลไม่สำเร็จ</h3>
            <p>{error}</p>
            <button className="retry-button" onClick={reload}>
              ลองใหม่
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="state-panel">
            <HeartHandshake size={ICON_SIZE["2xl"]} />
            <h3>ยังไม่มีพันธกิจ</h3>
            <p>{isAdmin ? "เริ่มเพิ่มพันธกิจแรกของคุณ" : "รอผู้ดูแลระบบเพิ่มพันธกิจ"}</p>
          </div>
        ) : (
          <div className="ministry-grid" style={{ padding: 16 }}>
            {items.map((m) => (
              <div className="entity-card" key={m.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <h3>{m.name}</h3>
                  <span className={`status-chip ${m.status === "active" ? "good" : "attention"}`}>
                    {m.status === "active" ? "ดำเนินการอยู่" : "หยุดชั่วคราว"}
                  </span>
                </div>
                {m.description && <p>{m.description}</p>}
                {m.leader && (
                  <div className="entity-meta">
                    <span>
                      <User size={ICON_SIZE.xs} /> ผู้นำ: {m.leader}
                    </span>
                  </div>
                )}
                {isAdmin && (
                  <div className="entity-actions">
                    <button className="cancel-button" onClick={() => openEdit(m)}>
                      <Pencil size={ICON_SIZE.sm} /> แก้ไข
                    </button>
                    <button className="danger-button" onClick={() => setDeleteTarget(m)}>
                      <Trash2 size={ICON_SIZE.sm} /> ลบ
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
            <h3 style={{ margin: "0 0 14px" }}>{editing ? "แก้ไขพันธกิจ" : "เพิ่มพันธกิจ"}</h3>
            <form className="form-grid" onSubmit={handleSubmit}>
              <label className="full-field">
                ชื่อพันธกิจ
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>
                ผู้นำ
                <input value={form.leader} onChange={(e) => setForm({ ...form, leader: e.target.value })} />
              </label>
              <label>
                สถานะ
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Ministry["status"] })}>
                  <option value="active">ดำเนินการอยู่</option>
                  <option value="inactive">หยุดชั่วคราว</option>
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
          title="ยืนยันการลบพันธกิจ"
          description={`ต้องการลบ "${deleteTarget.name}" ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`}
          isSubmitting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </AppLayout>
  );
}
