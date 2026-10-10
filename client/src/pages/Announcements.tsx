import { useState } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  EmptyState,
  ErrorState,
  Field,
  FormError,
  Modal,
  PageHeader,
  SectionHeader,
  StatusChip,
} from "@/components/DesignSystem";
import { ListSkeleton } from "@/components/LoadingStates";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { useResource } from "@/hooks/useResource";
import { ApiError, withRecheckHint, fieldErrorsFrom, requiredErrors } from "@/lib/api";
import { ADMIN_ROLES, hasRole } from "@shared/roles";
import { usePageTitle } from "@/hooks/usePageTitle";

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

const CONTROL_CLASS =
  "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-base md:text-sm text-[var(--color-ink)] placeholder:text-[var(--color-body-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";
const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const CANCEL_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const DANGER_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-error)]/40 px-4 text-sm font-semibold text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const CARD_ACTION_CLASS =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] px-3 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";
const CARD_DELETE_CLASS =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-error)]/40 px-3 text-sm font-semibold text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export default function Announcements() {
  usePageTitle("การประกาศ");
  const { user } = useAuth();
  // Mirrors the server's `requireAdmin` (shared/roles.ts ADMIN_ROLES).
  const isAdmin = hasRole(user?.role, ADMIN_ROLES);
  const { items, isLoading, error, errorTechnical, reload, create, update, remove } = useResource<Announcement>("/api/announcements");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({ title: a.title, content: a.content, status: a.status });
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    const missing = requiredErrors(form, { title: "กรุณากรอกหัวข้อ", content: "กรุณากรอกเนื้อหา" });
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      return;
    }
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
      const message =
        err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ";
      setFormError(withRecheckHint(message, err));
      setFieldErrors(fieldErrorsFrom(err));
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
      toast.success("ลบประกาศแล้ว");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  };

  const countLabel = !isLoading && !error ? `${items.length.toLocaleString("th-TH")} รายการ` : undefined;

  return (
    <AppLayout>
      <PageHeader
        title="การประกาศ"
        description="จัดการประกาศข่าวสารและข้อมูลประชาสัมพันธ์สำหรับคริสตจักร"
        primaryAction={isAdmin ? { label: "เพิ่มประกาศ", icon: Plus, onClick: openCreate } : undefined}
      />

      <section aria-labelledby="announcements-heading">
        <SectionHeader id="announcements-heading" title="ประกาศทั้งหมด" description={countLabel} />

        {isLoading ? (
          <ListSkeleton count={5} />
        ) : error ? (
          <ErrorState
            title="โหลดประกาศไม่สำเร็จ"
            description="ระบบเชื่อมต่อไม่สำเร็จในขณะนี้ กรุณาลองอีกครั้ง"
            technical={errorTechnical ?? undefined}
            onRetry={reload}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="ยังไม่มีประกาศ"
            description={
              isAdmin
                ? "เริ่มเพิ่มประกาศแรกเพื่อส่งข่าวสารให้สมาชิกในคริสตจักร"
                : "รอผู้ดูแลระบบเพิ่มประกาศ แล้วกลับมาตรวจสอบอีกครั้ง"
            }
            action={
              isAdmin
                ? { label: "เพิ่มประกาศ", icon: Plus, onClick: openCreate }
                : { label: "โหลดใหม่", onClick: reload }
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map(a => (
              <article
                key={a.id}
                className="flex flex-col justify-between pk-surface rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5"
              >
                <div>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="type-body-strong leading-snug text-[var(--color-ink)]">{a.title}</h3>
                    <StatusChip tone={a.status === "published" ? "success" : "neutral"}>
                      {a.status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่าง"}
                    </StatusChip>
                  </div>
                  <p className="type-caption mb-4 whitespace-pre-line text-[var(--color-text-secondary)]">
                    {a.content}
                  </p>
                </div>

                <div>
                  <p className="type-fine border-t border-[var(--color-divider)] pt-2 text-[var(--color-body-muted)]">
                    วันที่เผยแพร่: {formatDate(a.publishDate)}
                  </p>
                  {isAdmin && (
                    <div className="mt-3 flex items-center gap-2">
                      <button type="button" className={CARD_ACTION_CLASS} onClick={() => openEdit(a)}>
                        <Pencil size={ICON_SIZE.sm} aria-hidden="true" /> แก้ไข
                      </button>
                      <button type="button" className={CARD_DELETE_CLASS} onClick={() => setDeleteTarget(a)}>
                        <Trash2 size={ICON_SIZE.sm} aria-hidden="true" /> ลบ
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "แก้ไขประกาศ" : "เพิ่มประกาศ"}
        footer={
          <>
            <button type="button" className={CANCEL_BUTTON_CLASS} onClick={() => setFormOpen(false)}>
              ยกเลิก
            </button>
            <button
              type="submit"
              form="announcement-form"
              className={PRIMARY_BUTTON_CLASS}
              disabled={submitting}
            >
              {submitting ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </>
        }
      >
        <form id="announcement-form" className="flex flex-col gap-5" noValidate onSubmit={handleSubmit}>
          {formError && <FormError>{formError}</FormError>}
          <Field label="หัวข้อ" required error={fieldErrors.title}>
            {props => (
              <input
                {...props}
                className={CONTROL_CLASS}
                required
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            )}
          </Field>
          <Field label="เนื้อหา" required error={fieldErrors.content}>
            {props => (
              <textarea
                {...props}
                className={`${CONTROL_CLASS} resize-y`}
                required
                rows={5}
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
              />
            )}
          </Field>
          <Field label="สถานะ" required>
            {props => (
              <select
                {...props}
                className={CONTROL_CLASS}
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as Announcement["status"] })}
              >
                <option value="draft">ฉบับร่าง</option>
                <option value="published">เผยแพร่แล้ว</option>
              </select>
            )}
          </Field>
        </form>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="ยืนยันการลบประกาศ"
        footer={
          <>
            <button
              type="button"
              className={CANCEL_BUTTON_CLASS}
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              ยกเลิก
            </button>
            <button type="button" className={DANGER_BUTTON_CLASS} onClick={handleDelete} disabled={deleting}>
              {deleting ? "กำลังลบ…" : "ลบประกาศ"}
            </button>
          </>
        }
      >
        <p className="type-caption text-[var(--color-body-muted)]">
          ต้องการลบประกาศ "{deleteTarget?.title}" ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
        </p>
      </Modal>
    </AppLayout>
  );
}
