import { useId, useState } from "react";
import { HeartHandshake, Pencil, Plus, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CardGridSkeleton } from "@/components/LoadingStates";
import {
  EmptyState,
  ErrorState,
  Field,
  FormError,
  Modal,
  PageHeader,
  StatusChip,
} from "@/components/DesignSystem";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { useResource } from "@/hooks/useResource";
import { ApiError } from "@/lib/api";
import { ADMIN_ROLES, hasRole } from "@shared/roles";

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

const CONTROL_CLASS =
  "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-body-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";

const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";

const DANGER_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-error)] bg-[var(--color-canvas)] px-4 text-sm font-semibold text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)] disabled:opacity-50";

export default function Ministries() {
  const { user } = useAuth();
  // Mirrors the server's `requireAdmin` (shared/roles.ts ADMIN_ROLES).
  const isAdmin = hasRole(user?.role, ADMIN_ROLES);
  const { items, isLoading, error, reload, create, update, remove } = useResource<Ministry>("/api/ministries");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ministry | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ministry | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Modal footer buttons submit the form by id.
  const formId = `ministry-form-${useId().replace(/:/g, "")}`;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (m: Ministry) => {
    setEditing(m);
    setForm({ name: m.name, description: m.description ?? "", leader: m.leader ?? "", status: m.status });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      if (editing) {
        await update(editing.id, form);
        toast.success("บันทึกการแก้ไขฝ่ายงานแล้ว");
      } else {
        await create(form);
        toast.success("เพิ่มฝ่ายงานแล้ว");
      }
      setFormOpen(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ";
      setFormError(`${message} กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง`);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      toast.success("ลบฝ่ายงานแล้ว");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="ฝ่ายงาน"
        description="จัดการฝ่ายงานและผู้รับผิดชอบ"
        primaryAction={isAdmin ? { label: "เพิ่มฝ่ายงาน", icon: Plus, onClick: openCreate } : undefined}
      />

      <section className="card-surface p-4 sm:p-5">
        {isLoading ? (
          <CardGridSkeleton count={6} />
        ) : error ? (
          <ErrorState technical={error} onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState
            inset
            icon={HeartHandshake}
            title="ยังไม่มีฝ่ายงาน"
            description={
              isAdmin
                ? "เริ่มเพิ่มฝ่ายงานแรกของคริสตจักร เพื่อให้ทีมเห็นผู้รับผิดชอบและสถานะได้ชัดเจน"
                : "รอผู้ดูแลระบบเพิ่มฝ่ายงาน"
            }
            action={isAdmin ? { label: "เพิ่มฝ่ายงาน", icon: Plus, onClick: openCreate } : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((m) => (
              <article
                key={m.id}
                className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="type-body-strong min-w-0 text-[var(--color-ink)]">{m.name}</h2>
                  <StatusChip tone={m.status === "active" ? "success" : "neutral"}>
                    {m.status === "active" ? "ดำเนินการอยู่" : "หยุดชั่วคราว"}
                  </StatusChip>
                </div>
                {m.description && (
                  <p className="type-caption text-[var(--color-body-muted)]">{m.description}</p>
                )}
                {m.leader && (
                  <p className="type-fine flex items-center gap-1.5 text-[var(--color-body-muted)]">
                    <User size={ICON_SIZE.xs} aria-hidden="true" /> ผู้นำ: {m.leader}
                  </p>
                )}
                {isAdmin && (
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => openEdit(m)}>
                      <Pencil size={ICON_SIZE.sm} aria-hidden="true" /> แก้ไข
                    </button>
                    <button type="button" className={DANGER_BUTTON_CLASS} onClick={() => setDeleteTarget(m)}>
                      <Trash2 size={ICON_SIZE.sm} aria-hidden="true" /> ลบ
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "แก้ไขฝ่ายงาน" : "เพิ่มฝ่ายงาน"}
        footer={
          <>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setFormOpen(false)}
              disabled={submitting}
            >
              ยกเลิก
            </button>
            <button type="submit" form={formId} className={PRIMARY_BUTTON_CLASS} disabled={submitting}>
              {submitting ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && <FormError>{formError}</FormError>}
          <Field label="ชื่อฝ่ายงาน" required>
            {(props) => (
              <input
                id={props.id}
                aria-describedby={props["aria-describedby"]}
                aria-invalid={props["aria-invalid"]}
                required
                className={CONTROL_CLASS}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            )}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="ผู้นำ">
              {(props) => (
                <input
                  id={props.id}
                  aria-describedby={props["aria-describedby"]}
                  aria-invalid={props["aria-invalid"]}
                  className={CONTROL_CLASS}
                  value={form.leader}
                  onChange={(e) => setForm({ ...form, leader: e.target.value })}
                />
              )}
            </Field>
            <Field label="สถานะ">
              {(props) => (
                <select
                  id={props.id}
                  aria-describedby={props["aria-describedby"]}
                  aria-invalid={props["aria-invalid"]}
                  className={CONTROL_CLASS}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Ministry["status"] })}
                >
                  <option value="active">ดำเนินการอยู่</option>
                  <option value="inactive">หยุดชั่วคราว</option>
                </select>
              )}
            </Field>
          </div>
          <Field label="รายละเอียด">
            {(props) => (
              <textarea
                id={props.id}
                aria-describedby={props["aria-describedby"]}
                aria-invalid={props["aria-invalid"]}
                rows={4}
                className={CONTROL_CLASS}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            )}
          </Field>
        </form>
      </Modal>

      {deleteTarget && (
        <ConfirmDialog
          title="ยืนยันการลบฝ่ายงาน"
          description={`ต้องการลบ "${deleteTarget.name}" ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`}
          isSubmitting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </AppLayout>
  );
}
