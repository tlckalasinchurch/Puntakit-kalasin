import { useState } from "react";
import { CalendarDays, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
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
  type StatusTone,
} from "@/components/DesignSystem";
import { CardGridSkeleton } from "@/components/LoadingStates";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { useResource } from "@/hooks/useResource";
import { ApiError, withRecheckHint } from "@/lib/api";
import { ADMIN_ROLES, hasRole } from "@shared/roles";
import { usePageTitle } from "@/hooks/usePageTitle";

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

const STATUS_TONE: Record<Event["status"], StatusTone> = {
  scheduled: "info",
  cancelled: "error",
  completed: "success",
};

const CONTROL_CLASS =
  "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-base md:text-sm text-[var(--color-ink)] placeholder:text-[var(--color-body-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";
const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const CANCEL_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const DANGER_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-error)]/40 px-4 text-sm font-semibold text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const CARD_ACTION_CLASS =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] px-3 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";
const CARD_DELETE_CLASS =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-error)]/40 px-3 text-sm font-semibold text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

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
  usePageTitle("การนมัสการ / กิจกรรม");
  const { user } = useAuth();
  // Mirrors the server's `requireAdmin` (shared/roles.ts ADMIN_ROLES).
  const isAdmin = hasRole(user?.role, ADMIN_ROLES);
  const { items, isLoading, error, errorTechnical, reload, create, update, remove } = useResource<Event>("/api/events");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
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
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
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
      const message =
        err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ";
      setFormError(withRecheckHint(message, err));
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
      toast.success("ลบกิจกรรมแล้ว");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  };

  const countLabel = !isLoading && !error ? `${items.length.toLocaleString("th-TH")} กิจกรรม` : undefined;

  return (
    <AppLayout>
      <PageHeader
        title="การนมัสการ / กิจกรรม"
        description="ดูกิจกรรมล่าสุดและวางแผนการมีส่วนร่วมของคริสตจักรในมุมมองเดียว"
        primaryAction={isAdmin ? { label: "เพิ่มกิจกรรม", icon: Plus, onClick: openCreate } : undefined}
      />

      <section aria-labelledby="events-heading">
        <SectionHeader id="events-heading" title="รายการกิจกรรม" description={countLabel} />

        {isLoading ? (
          <CardGridSkeleton count={6} />
        ) : error ? (
          <ErrorState
            title="โหลดกิจกรรมไม่สำเร็จ"
            description="ระบบเชื่อมต่อไม่สำเร็จในขณะนี้ กรุณาลองอีกครั้ง"
            technical={errorTechnical ?? undefined}
            onRetry={reload}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="ยังไม่มีกิจกรรม"
            description={
              isAdmin
                ? "เริ่มเพิ่มกิจกรรมแรกเพื่อวางแผนการนมัสการและพันธกิจของคริสตจักร"
                : "รอผู้ดูแลระบบเพิ่มกิจกรรม แล้วกลับมาตรวจสอบอีกครั้ง"
            }
            action={
              isAdmin
                ? { label: "เพิ่มกิจกรรม", icon: Plus, onClick: openCreate }
                : { label: "โหลดใหม่", onClick: reload }
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map(ev => (
              <article
                key={ev.id}
                className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5 transition-shadow hover:shadow-[var(--shadow)] motion-reduce:transition-none"
              >
                <div>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <StatusChip tone="neutral" className="mb-2">
                        {CATEGORY_LABEL[ev.category]}
                      </StatusChip>
                      <h3 className="type-body-strong leading-snug text-[var(--color-ink)]">{ev.title}</h3>
                    </div>
                    <StatusChip tone={STATUS_TONE[ev.status]}>{STATUS_LABEL[ev.status]}</StatusChip>
                  </div>
                  {ev.description && (
                    <p className="type-caption mb-4 line-clamp-3 text-[var(--color-text-secondary)]">
                      {ev.description}
                    </p>
                  )}
                  <div className="mb-4 space-y-1.5">
                    <p className="type-caption flex items-center gap-2 text-[var(--color-text-secondary)]">
                      <CalendarDays size={ICON_SIZE.sm} aria-hidden="true" className="shrink-0 text-[var(--color-primary)]" />
                      <span>{formatDateTime(ev.eventDate)}</span>
                    </p>
                    {ev.location && (
                      <p className="type-caption flex items-center gap-2 text-[var(--color-text-secondary)]">
                        <MapPin size={ICON_SIZE.sm} aria-hidden="true" className="shrink-0 text-[var(--color-body-muted)]" />
                        <span className="truncate">{ev.location}</span>
                      </p>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="mt-2 flex items-center gap-2 border-t border-[var(--color-divider)] pt-3">
                    <button type="button" className={CARD_ACTION_CLASS} onClick={() => openEdit(ev)}>
                      <Pencil size={ICON_SIZE.sm} aria-hidden="true" /> แก้ไข
                    </button>
                    <button type="button" className={CARD_DELETE_CLASS} onClick={() => setDeleteTarget(ev)}>
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
        title={editing ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"}
        size="wide"
        footer={
          <>
            <button type="button" className={CANCEL_BUTTON_CLASS} onClick={() => setFormOpen(false)}>
              ยกเลิก
            </button>
            <button
              type="submit"
              form="event-form"
              className={PRIMARY_BUTTON_CLASS}
              disabled={submitting}
            >
              {submitting ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </>
        }
      >
        <form id="event-form" className="grid grid-cols-1 gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
          {formError && <FormError>{formError}</FormError>}
          <div className="sm:col-span-2">
            <Field label="ชื่อกิจกรรม" required>
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
          </div>
          <Field label="วันเวลา" required>
            {props => (
              <input
                {...props}
                type="datetime-local"
                className={CONTROL_CLASS}
                required
                value={form.eventDate}
                onChange={e => setForm({ ...form, eventDate: e.target.value })}
              />
            )}
          </Field>
          <Field label="สถานที่">
            {props => (
              <input
                {...props}
                className={CONTROL_CLASS}
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
              />
            )}
          </Field>
          <Field label="ประเภท" required>
            {props => (
              <select
                {...props}
                className={CONTROL_CLASS}
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value as Event["category"] })}
              >
                <option value="worship">นมัสการ</option>
                <option value="activity">กิจกรรม</option>
                <option value="meeting">ประชุม</option>
                <option value="other">อื่นๆ</option>
              </select>
            )}
          </Field>
          <Field label="สถานะ" required>
            {props => (
              <select
                {...props}
                className={CONTROL_CLASS}
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as Event["status"] })}
              >
                <option value="scheduled">กำหนดการ</option>
                <option value="cancelled">ยกเลิก</option>
                <option value="completed">เสร็จสิ้น</option>
              </select>
            )}
          </Field>
          <div className="sm:col-span-2">
            <Field label="รายละเอียด">
              {props => (
                <textarea
                  {...props}
                  className={`${CONTROL_CLASS} resize-y`}
                  rows={4}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              )}
            </Field>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="ยืนยันการลบกิจกรรม"
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
              {deleting ? "กำลังลบ…" : "ลบกิจกรรม"}
            </button>
          </>
        }
      >
        <p className="type-caption text-[var(--color-body-muted)]">
          ต้องการลบ "{deleteTarget?.title}" ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
        </p>
      </Modal>
    </AppLayout>
  );
}
