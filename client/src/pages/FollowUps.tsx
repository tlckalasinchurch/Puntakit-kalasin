import { ResponsiveSelect } from "@/components/ResponsiveSelect";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { CheckCircle2, Clock, ListTodo, Phone, RotateCcw, SearchX, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  EmptyState,
  ErrorState,
  Field,
  ListPager,
  PageHeader,
  SectionHeader,
  StatusChip,
  type StatusTone,
} from "@/components/DesignSystem";
import { ListSkeleton } from "@/components/LoadingStates";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { api, ApiError, type ApiMeta } from "@/lib/api";
import type { FollowUpStatus } from "@shared/schema";
import { CREATE_ROLES, hasRole } from "@shared/roles";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";

interface FollowUpRow {
  id: string;
  status: FollowUpStatus;
  title: string;
  subjectMemberId: string | null;
  subjectMemberName: string | null;
  /** Real number only when the viewer may see this member's contacts; otherwise null. */
  subjectMemberPhone: string | null;
  /** A number exists but is hidden from this viewer (members contact policy). */
  subjectMemberContactMasked: boolean;
  subjectGroupId: string | null;
  subjectGroupName: string | null;
  subjectGroupOrgLevel: "body" | "care" | null;
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

const STATUS_TONE: Record<FollowUpStatus, StatusTone> = {
  open: "warning",
  in_progress: "info",
  completed: "success",
  cancelled: "neutral",
};

const CONTROL_CLASS =
  "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-base md:text-sm text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";
const ROW_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] px-3 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const ROW_PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";

const SUBJECT_LINK_CLASS =
  "inline-flex min-h-11 items-center rounded-[var(--radius-xs)] font-semibold text-[var(--color-primary-ink)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

/**
 * Who the follow-up is about, as links: a member opens their detail dialog on /members; a care
 * group opens its roster and call list on /care (a screen only CREATE_ROLES can reach, so other
 * roles and body-level groups stay plain text). There is no group detail page to link to.
 */
function SubjectLine({ row, canOpenCare }: { row: FollowUpRow; canOpenCare: boolean }) {
  const parts: ReactNode[] = [];
  if (row.subjectMemberName) {
    parts.push(
      row.subjectMemberId ? (
        <Link href={`/members?member=${encodeURIComponent(row.subjectMemberId)}`} className={SUBJECT_LINK_CLASS}>
          {row.subjectMemberName}
        </Link>
      ) : (
        <span>{row.subjectMemberName}</span>
      )
    );
  }
  if (row.subjectGroupName) {
    parts.push(
      row.subjectGroupId && row.subjectGroupOrgLevel === "care" && canOpenCare ? (
        <Link href={`/care?group=${encodeURIComponent(row.subjectGroupId)}`} className={SUBJECT_LINK_CLASS}>
          {row.subjectGroupName}
        </Link>
      ) : (
        <span>{row.subjectGroupName}</span>
      )
    );
  }
  if (parts.length === 0) parts.push(<span>ไม่ระบุเป้าหมาย</span>);
  if (row.ownerName) parts.push(<span>ผู้รับผิดชอบ: {row.ownerName}</span>);

  return (
    <p className="type-caption mt-0.5 flex flex-wrap items-center gap-x-2 text-[var(--color-text-secondary)]">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden="true">•</span>}
          {part}
        </Fragment>
      ))}
    </p>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "ไม่มีกำหนด";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(row: FollowUpRow) {
  return row.dueAt && (row.status === "open" || row.status === "in_progress") && new Date(row.dueAt) < new Date();
}

export default function FollowUps() {
  usePageTitle("รายการติดตาม");
  const { user } = useAuth();
  const canOpenCare = hasRole(user?.role, CREATE_ROLES);
  const [items, setItems] = useState<FollowUpRow[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorTechnical, setErrorTechnical] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  // `background` refreshes in place after a status change: the list stays on screen (no skeleton
  // flash, no scroll jump) and a failed refresh keeps the rows and says so in a toast.
  const load = async (pageToLoad: number = page, { background = false } = {}) => {
    if (!background) {
      setIsLoading(true);
      setError(null);
      setErrorTechnical(null);
    }
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (overdueOnly) params.set("overdue", "true");
      params.set("page", String(pageToLoad));
      params.set("limit", "50");
      const res = await api.getWithMeta<FollowUpRow[]>(`/api/follow-ups?${params.toString()}`);
      if (!res.data?.length && pageToLoad > 1) {
        // The last row of this page just left it (status change under a filter): step back a page.
        setPage(pageToLoad - 1);
        return load(pageToLoad - 1, { background });
      }
      setItems(res.data || []);
      setMeta(res.meta ?? null);
    } catch (err) {
      if (background) {
        toast.error("รีเฟรชรายการไม่สำเร็จ ข้อมูลที่เห็นอาจไม่ใช่ล่าสุด — กด “โหลดใหม่”");
      } else {
        setError(err instanceof ApiError ? err.message : "โหลดรายการติดตามไม่สำเร็จ");
        setErrorTechnical(err instanceof ApiError ? (err.serverMessage ?? err.message) : String(err));
      }
    } finally {
      if (!background) setIsLoading(false);
    }
  };

  useEffect(() => {
    // A new filter starts from page 1; the pager must say so too.
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, overdueOnly]);

  const transition = async (row: FollowUpRow, status: FollowUpStatus) => {
    setTransitioningId(row.id);
    try {
      await api.put(`/api/follow-ups/${row.id}/status`, { status });
      toast.success(`เปลี่ยนสถานะเป็น "${STATUS_LABELS[status]}" แล้ว`);
      await load(page, { background: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setTransitioningId(null);
    }
  };

  const countLabel =
    !isLoading && !error && meta
      ? `${meta.total.toLocaleString("th-TH")} รายการ`
      : undefined;

  return (
    <AppLayout>
      <PageHeader
        title="รายการติดตาม"
        description="อะไรต้องทำต่อ กับใคร ภายในเมื่อไร — สร้างจากหน้ากิจกรรมพันธกิจหรือโปรไฟล์สมาชิก"
        secondaryActions={[{ label: "โหลดใหม่", icon: RotateCcw, onClick: () => load() }]}
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <Field label="สถานะ">
            {props => (
              <ResponsiveSelect
                {...props}
                className={CONTROL_CLASS}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="">ทุกสถานะ</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </ResponsiveSelect>
            )}
          </Field>
        </div>
        <label className="type-caption inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-[var(--color-ink)]">
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-[var(--color-primary)]"
            checked={overdueOnly}
            onChange={e => setOverdueOnly(e.target.checked)}
          />
          เลยกำหนดเท่านั้น
        </label>
      </div>

      <section aria-labelledby="follow-ups-heading">
        <SectionHeader id="follow-ups-heading" title="คิวการติดตาม" description={countLabel} />

        {isLoading ? (
          <ListSkeleton count={5} />
        ) : error ? (
          <ErrorState
            title="โหลดรายการติดตามไม่สำเร็จ"
            description="ระบบเชื่อมต่อไม่สำเร็จในขณะนี้ กรุณาลองอีกครั้ง"
            technical={errorTechnical ?? undefined}
            onRetry={() => load()}
          />
        ) : items.length === 0 && (statusFilter || overdueOnly) ? (
          <EmptyState
            icon={SearchX}
            title="ไม่มีรายการที่ตรงกับตัวกรอง"
            description="ลองเปลี่ยนสถานะ หรือเอาตัวกรองออกเพื่อดูรายการทั้งหมด"
            action={{
              label: "ล้างตัวกรอง",
              onClick: () => {
                setStatusFilter("");
                setOverdueOnly(false);
              },
            }}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="ยังไม่มีรายการติดตาม"
            description="รายการติดตามถูกสร้างจากหน้ากิจกรรมพันธกิจ หรือจากโปรไฟล์สมาชิกที่ต้องดูแลต่อ"
            action={{ href: "/feed", label: "ไปที่ฟีดกิจกรรม" }}
          />
        ) : (
          <>
            <div className="space-y-3">
            {items.map(row => (
              <article
                key={row.id}
                className={`flex flex-col gap-3 rounded-[var(--radius-md)] border bg-[var(--color-canvas)] p-4 sm:flex-row sm:items-center ${
                  isOverdue(row) ? "border-[var(--color-error)]/50" : "border-[var(--color-hairline)]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <StatusChip tone={STATUS_TONE[row.status]}>{STATUS_LABELS[row.status]}</StatusChip>
                    {isOverdue(row) && (
                      <StatusChip tone="error">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={ICON_SIZE.xs} aria-hidden="true" /> เลยกำหนด
                        </span>
                      </StatusChip>
                    )}
                  </div>
                  <h3 className="type-caption-strong text-[var(--color-ink)]">{row.title}</h3>
                  <SubjectLine row={row} canOpenCare={canOpenCare} />
                  <p className="type-fine mt-0.5 text-[var(--color-body-muted)]">กำหนด: {formatDate(row.dueAt)}</p>
                </div>

                <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                  {(row.status === "open" || row.status === "in_progress") &&
                    (row.subjectMemberPhone ? (
                      <a className={ROW_BUTTON_CLASS} href={`tel:${row.subjectMemberPhone}`}>
                        <Phone size={ICON_SIZE.sm} aria-hidden="true" /> โทร {row.subjectMemberPhone}
                      </a>
                    ) : row.subjectMemberContactMasked ? (
                      <span className="type-caption text-[var(--color-body-muted)]">เบอร์ถูกปิดบัง</span>
                    ) : null)}
                  {row.status === "open" && (
                    <button
                      type="button"
                      className={ROW_BUTTON_CLASS}
                      disabled={transitioningId === row.id}
                      onClick={() => transition(row, "in_progress")}
                    >
                      กำลังติดตาม
                    </button>
                  )}
                  {(row.status === "open" || row.status === "in_progress") && (
                    <>
                      <button
                        type="button"
                        className={ROW_PRIMARY_BUTTON_CLASS}
                        disabled={transitioningId === row.id}
                        onClick={() => transition(row, "completed")}
                      >
                        <CheckCircle2 size={ICON_SIZE.sm} aria-hidden="true" /> เสร็จสิ้น
                      </button>
                      <button
                        type="button"
                        className={ROW_BUTTON_CLASS}
                        disabled={transitioningId === row.id}
                        onClick={() => transition(row, "cancelled")}
                      >
                        <X size={ICON_SIZE.sm} aria-hidden="true" /> ยกเลิก
                      </button>
                    </>
                  )}
                  {(row.status === "completed" || row.status === "cancelled") && (
                    <button
                      type="button"
                      className={ROW_BUTTON_CLASS}
                      disabled={transitioningId === row.id}
                      onClick={() => transition(row, "open")}
                    >
                      <RotateCcw size={ICON_SIZE.sm} aria-hidden="true" /> เปิดใหม่
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!isLoading && !error && (
            <ListPager
              page={page}
              totalPages={meta?.totalPages ?? 1}
              onPageChange={p => {
                setPage(p);
                load(p);
              }}
            />
          )}
          </>
        )}
      </section>
    </AppLayout>
  );
}
