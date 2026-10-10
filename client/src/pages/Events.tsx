import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Clock, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  EmptyState,
  ErrorState,
  Field,
  FormError,
  Modal,
  PageHeader,
  StatusChip,
  type StatusTone,
} from "@/components/DesignSystem";
import { CardGridSkeleton } from "@/components/LoadingStates";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { useResource } from "@/hooks/useResource";
import { daysUntil, groupEvents } from "@/lib/eventGroups";
import { ApiError, withRecheckHint, fieldErrorsFrom, requiredErrors } from "@/lib/api";
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
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
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

const PAST_PREVIEW = 6;

function dateParts(iso: string) {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString("th-TH", { weekday: "short" }),
    day: d.toLocaleDateString("th-TH", { day: "numeric" }),
    month: d.toLocaleDateString("th-TH", { month: "short" }),
    time: d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
  };
}

function countdownLabel(iso: string) {
  const days = daysUntil(iso);
  if (days <= 0) return "วันนี้";
  if (days === 1) return "พรุ่งนี้";
  return `อีก ${days.toLocaleString("th-TH")} วัน`;
}

const ICON_BUTTON_CLASS =
  "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";
const ICON_DANGER_CLASS =
  "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-error-soft)] hover:text-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

/**
 * One event as an agenda row. The date is the anchor (a block the eye can scan
 * down), the title and place come next, and the two icon actions are quiet but
 * keep their 44px targets. A status chip appears only when it adds
 * information: on rows that are not simply "scheduled and upcoming".
 */
function EventRow({
  ev,
  showStatus,
  canManage,
  muted,
  onEdit,
  onDelete,
}: {
  ev: Event;
  showStatus: boolean;
  canManage: boolean;
  muted?: boolean;
  onEdit: (ev: Event) => void;
  onDelete: (ev: Event) => void;
}) {
  const d = dateParts(ev.eventDate);
  return (
    <li className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
      <time
        dateTime={ev.eventDate}
        className={`flex w-14 shrink-0 flex-col items-center rounded-[var(--radius-md)] py-2 ${
          muted
            ? "bg-[var(--color-canvas-sunken)] text-[var(--color-text-secondary)]"
            : "bg-[var(--color-accent-soft)] text-[var(--color-primary)]"
        }`}
      >
        <span className="type-fine font-semibold text-[var(--color-ink)]">{d.weekday}</span>
        <span className="type-display-md">{d.day}</span>
        <span className="type-fine font-semibold text-[var(--color-ink)]">{d.month}</span>
      </time>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="type-body-strong min-w-0 text-[var(--color-ink)]">{ev.title}</h3>
          {showStatus && (
            <StatusChip tone={STATUS_TONE[ev.status]}>{STATUS_LABEL[ev.status]}</StatusChip>
          )}
        </div>
        <p className="type-caption mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--color-text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={ICON_SIZE.xs} aria-hidden="true" className="shrink-0 text-[var(--color-body-muted)]" />
            {d.time} น.
          </span>
          {ev.location && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin size={ICON_SIZE.xs} aria-hidden="true" className="shrink-0 text-[var(--color-body-muted)]" />
              <span className="truncate">{ev.location}</span>
            </span>
          )}
          <span className="text-[var(--color-body-muted)]">{CATEGORY_LABEL[ev.category]}</span>
        </p>
        {ev.description && (
          <p className="type-caption mt-2 line-clamp-2 text-[var(--color-body-muted)]">{ev.description}</p>
        )}
      </div>

      {canManage && (
        <div className="-mr-2 flex shrink-0 items-center">
          <button type="button" className={ICON_BUTTON_CLASS} onClick={() => onEdit(ev)} aria-label={`แก้ไขกิจกรรม ${ev.title}`}>
            <Pencil size={ICON_SIZE.sm} aria-hidden="true" />
          </button>
          <button type="button" className={ICON_DANGER_CLASS} onClick={() => onDelete(ev)} aria-label={`ลบกิจกรรม ${ev.title}`}>
            <Trash2 size={ICON_SIZE.sm} aria-hidden="true" />
          </button>
        </div>
      )}
    </li>
  );
}

function EventGroupList({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="type-body-strong mb-3 flex items-baseline gap-2 text-[var(--color-ink)]">
        {title}
        <span className="type-caption font-normal text-[var(--color-body-muted)]">{count.toLocaleString("th-TH")} รายการ</span>
      </h2>
      <ul className="pk-surface divide-y divide-[var(--color-divider)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        {children}
      </ul>
    </section>
  );
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFieldErrors({});
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
    setFieldErrors({});
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    const missing = requiredErrors(form, { title: "กรุณากรอกชื่อกิจกรรม", eventDate: "กรุณาเลือกวันและเวลา" });
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      return;
    }
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
      toast.success("ลบกิจกรรมแล้ว");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  };

  const groups = useMemo(() => groupEvents(items), [items]);
  const upcomingCount = (groups.next ? 1 : 0) + groups.upcoming.length;
  const visiblePast = showAllPast ? groups.past : groups.past.slice(0, PAST_PREVIEW);
  const nextParts = groups.next ? dateParts(groups.next.eventDate) : null;

  return (
    <AppLayout>
      <PageHeader
        title="การนมัสการ / กิจกรรม"
        description="ดูกิจกรรมล่าสุดและวางแผนการมีส่วนร่วมของคริสตจักรในมุมมองเดียว"
        primaryAction={isAdmin ? { label: "เพิ่มกิจกรรม", icon: Plus, onClick: openCreate } : undefined}
      />

      {!isLoading && !error && items.length > 0 && (
        <p className="type-caption mb-5 text-[var(--color-body-muted)]" role="status">
          ทั้งหมด {items.length.toLocaleString("th-TH")} กิจกรรม · กำลังจะมาถึง {upcomingCount.toLocaleString("th-TH")} · ผ่านมาแล้ว {groups.past.length.toLocaleString("th-TH")} · ยกเลิก {groups.cancelled.length.toLocaleString("th-TH")}
        </p>
      )}

      <div>
        <h2 id="events-heading" className="sr-only">รายการกิจกรรม</h2>

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
          <>
            {groups.next && nextParts ? (
              <article aria-labelledby="event-next-title" className="pk-hero p-6 sm:p-8">
                <div className="flex items-start justify-between gap-8">
                <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="type-caption-strong text-[var(--color-primary-on-dark)]">กิจกรรมถัดไป</p>
                  <p className="type-caption-strong rounded-[var(--radius-pill)] border border-[var(--color-on-dark-hairline)] px-3 py-1 text-[var(--color-on-dark)]">
                    {countdownLabel(groups.next.eventDate)}
                  </p>
                </div>
                <h2 id="event-next-title" className="type-display-md mt-3 text-[var(--color-on-dark)]">
                  {groups.next.title}
                </h2>
                <dl className="type-body mt-4 space-y-2 text-[var(--color-on-dark-muted)]">
                  <div className="flex items-center gap-2.5">
                    <dt className="sr-only">วันและเวลา</dt>
                    <CalendarDays size={ICON_SIZE.sm} aria-hidden="true" className="shrink-0 text-[var(--color-primary-on-dark)]" />
                    <dd>
                      <span className="sm:hidden">
                        {nextParts.weekday} {nextParts.day} {nextParts.month} ·{" "}
                      </span>
                      {nextParts.time} น.
                    </dd>
                  </div>
                  {groups.next.location && (
                    <div className="flex items-center gap-2.5">
                      <dt className="sr-only">สถานที่</dt>
                      <MapPin size={ICON_SIZE.sm} aria-hidden="true" className="shrink-0 text-[var(--color-primary-on-dark)]" />
                      <dd className="min-w-0">{groups.next.location}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="sr-only">ประเภท</dt>
                    <dd className="type-caption text-[var(--color-on-dark-muted)]">{CATEGORY_LABEL[groups.next.category]}</dd>
                  </div>
                </dl>
                {groups.next.description && (
                  <p className="type-caption mt-4 line-clamp-3 max-w-2xl text-[var(--color-on-dark-muted)]">
                    {groups.next.description}
                  </p>
                )}
                {isAdmin && (
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(groups.next!)}
                      className="type-caption-strong inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-on-dark-hairline)] px-4 text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-on-dark)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-on-dark)]"
                    >
                      <Pencil size={ICON_SIZE.sm} aria-hidden="true" /> แก้ไข
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(groups.next)}
                      aria-label={`ลบกิจกรรม ${groups.next.title}`}
                      className="type-caption-strong inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-pill)] px-4 text-[var(--color-on-dark-muted)] transition-colors hover:bg-[var(--color-on-dark)]/10 hover:text-[var(--color-on-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-on-dark)]"
                    >
                      <Trash2 size={ICON_SIZE.sm} aria-hidden="true" /> ลบ
                    </button>
                  </div>
                )}
                </div>
                <time
                  dateTime={groups.next.eventDate}
                  className="hidden shrink-0 flex-col items-center rounded-[var(--radius-md)] border border-[var(--color-on-dark-hairline)] px-7 py-4 text-[var(--color-on-dark)] sm:flex"
                >
                  <span className="type-caption-strong text-[var(--color-primary-on-dark)]">{nextParts.weekday}</span>
                  <span className="type-hero">{nextParts.day}</span>
                  <span className="type-caption-strong text-[var(--color-on-dark-muted)]">{nextParts.month}</span>
                </time>
                </div>
              </article>
            ) : (
              <p className="type-caption rounded-[var(--radius-lg)] border border-dashed border-[var(--color-hairline)] px-4 py-5 text-[var(--color-body-muted)]">
                ยังไม่มีกิจกรรมที่กำลังจะมาถึง
                {isAdmin ? " — เพิ่มกิจกรรมใหม่ได้จากปุ่ม “เพิ่มกิจกรรม” ด้านบน" : ""}
              </p>
            )}

            {groups.upcoming.length > 0 && (
              <EventGroupList id="events-upcoming" title="หลังจากนั้น" count={groups.upcoming.length}>
                {groups.upcoming.map(ev => (
                  <EventRow key={ev.id} ev={ev} showStatus={false} canManage={isAdmin} onEdit={openEdit} onDelete={setDeleteTarget} />
                ))}
              </EventGroupList>
            )}

            {groups.past.length > 0 && (
              <EventGroupList id="events-past" title="ผ่านมาแล้ว" count={groups.past.length}>
                {visiblePast.map(ev => (
                  <EventRow key={ev.id} ev={ev} showStatus muted canManage={isAdmin} onEdit={openEdit} onDelete={setDeleteTarget} />
                ))}
                {groups.past.length > PAST_PREVIEW && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setShowAllPast(v => !v)}
                      aria-expanded={showAllPast}
                      className="type-caption-strong flex min-h-11 w-full items-center justify-center gap-2 text-[var(--color-primary)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-focus)]"
                    >
                      {showAllPast ? "แสดงน้อยลง" : `แสดงทั้งหมด ${groups.past.length.toLocaleString("th-TH")} รายการ`}
                      <ChevronDown size={ICON_SIZE.sm} aria-hidden="true" className={showAllPast ? "rotate-180" : ""} />
                    </button>
                  </li>
                )}
              </EventGroupList>
            )}

            {groups.cancelled.length > 0 && (
              <EventGroupList id="events-cancelled" title="ยกเลิก" count={groups.cancelled.length}>
                {groups.cancelled.map(ev => (
                  <EventRow key={ev.id} ev={ev} showStatus muted canManage={isAdmin} onEdit={openEdit} onDelete={setDeleteTarget} />
                ))}
              </EventGroupList>
            )}
          </>
        )}
      </div>

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
        <form id="event-form" className="grid grid-cols-1 gap-5 sm:grid-cols-2" noValidate onSubmit={handleSubmit}>
          {formError && <FormError>{formError}</FormError>}
          <div className="sm:col-span-2">
            <Field label="ชื่อกิจกรรม" required error={fieldErrors.title}>
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
          <Field label="วันเวลา" required error={fieldErrors.eventDate}>
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
