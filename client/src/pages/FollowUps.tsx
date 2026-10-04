import { useEffect, useState } from "react";
import { CheckCircle2, Clock, ListTodo, RotateCcw, X } from "lucide-react";
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
import { usePageTitle } from "@/hooks/usePageTitle";

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

const STATUS_TONE: Record<FollowUpStatus, StatusTone> = {
  open: "warning",
  in_progress: "info",
  completed: "success",
  cancelled: "neutral",
};

const CONTROL_CLASS =
  "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-sm text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";
const ROW_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] px-3 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const ROW_PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";

function formatDate(iso: string | null) {
  if (!iso) return "ไม่มีกำหนด";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(row: FollowUpRow) {
  return row.dueAt && (row.status === "open" || row.status === "in_progress") && new Date(row.dueAt) < new Date();
}

export default function FollowUps() {
  usePageTitle("รายการติดตาม");
  const [items, setItems] = useState<FollowUpRow[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorTechnical, setErrorTechnical] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  const load = async (pageToLoad: number = page) => {
    setIsLoading(true);
    setError(null);
    setErrorTechnical(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (overdueOnly) params.set("overdue", "true");
      params.set("page", String(pageToLoad));
      params.set("limit", "50");
      const res = await api.getWithMeta<FollowUpRow[]>(`/api/follow-ups?${params.toString()}`);
      setItems(res.data || []);
      setMeta(res.meta ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "โหลดรายการติดตามไม่สำเร็จ");
      setErrorTechnical(err instanceof ApiError ? (err.serverMessage ?? err.message) : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(1);
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
              <select
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
              </select>
            )}
          </Field>
        </div>
        <label className="type-caption inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-[var(--color-ink)]">
          <input
            type="checkbox"
            className="size-4"
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
                  <p className="type-caption mt-0.5 text-[var(--color-text-secondary)]">
                    {[row.subjectMemberName, row.subjectGroupName].filter(Boolean).join(" • ") || "ไม่ระบุเป้าหมาย"}
                    {row.ownerName ? ` • ผู้รับผิดชอบ: ${row.ownerName}` : ""}
                  </p>
                  <p className="type-fine mt-0.5 text-[var(--color-body-muted)]">กำหนด: {formatDate(row.dueAt)}</p>
                </div>

                <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
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
