import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Inbox as InboxIcon,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  EmptyState,
  ErrorState,
  Field,
  FormError,
  ListPager,
  Modal,
  PageHeader,
  SectionHeader,
  StatusChip,
  type StatusTone,
} from "@/components/DesignSystem";
import { ListSkeleton } from "@/components/LoadingStates";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, type ApiMeta, withRecheckHint } from "@/lib/api";
import type {
  MissionActivityType,
  MissionSubmissionStatus,
} from "@shared/schema";
import { PRIVILEGED_ROLES as REVIEW_ROLES } from "@shared/roles";
import { usePageTitle } from "@/hooks/usePageTitle";

interface SubmissionRow {
  id: string;
  status: MissionSubmissionStatus;
  source: string;
  rawText: string | null;
  submittedByLabel: string | null;
  publishedActivityId: string | null;
  createdById: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<MissionSubmissionStatus, string> = {
  new: "ใหม่",
  reviewing: "กำลังตรวจสอบ",
  needs_info: "ต้องการข้อมูลเพิ่ม",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
};

const STATUS_TONE: Record<MissionSubmissionStatus, StatusTone> = {
  new: "info",
  reviewing: "warning",
  needs_info: "warning",
  approved: "success",
  rejected: "neutral",
};

const TYPE_LABELS: Record<MissionActivityType, string> = {
  house_mission: "เยี่ยมบ้าน",
  mission_visit: "ออกเยี่ยมพันธกิจ",
  bible_study: "ศึกษาพระคัมภีร์",
  prayer: "อธิษฐาน",
  worship: "นมัสการ",
  fellowship: "สามัคคีธรรม",
  testimony: "คำพยาน",
  evangelism: "ประกาศข่าวประเสริฐ",
  pastoral_visit: "เยี่ยมเยียนอภิบาล",
  outreach: "กิจกรรมชุมชน",
  ministry_update: "อัปเดตฝ่ายงาน",
  other: "อื่นๆ",
};

const CONTROL_CLASS =
  "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-base md:text-sm text-[var(--color-ink)] placeholder:text-[var(--color-body-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";
const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const CANCEL_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const ROW_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] px-3 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const ROW_PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const ROW_DANGER_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-error)]/40 px-3 text-sm font-semibold text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const DASHED_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 self-start rounded-[var(--radius-sm)] border border-dashed border-[var(--color-hairline)] px-3 text-sm font-semibold text-[var(--color-body-muted)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Inbox() {
  usePageTitle("กล่องข้อมูลนำเข้า");
  const { user } = useAuth();
  const isReviewer = user && REVIEW_ROLES.includes(user.role);

  const [items, setItems] = useState<SubmissionRow[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorTechnical, setErrorTechnical] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const loadSeq = useRef(0);

  const [captureOpen, setCaptureOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [rawMediaUrls, setRawMediaUrls] = useState<string[]>([]);
  const [submittedByLabel, setSubmittedByLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const [publishTarget, setPublishTarget] = useState<SubmissionRow | null>(
    null
  );
  const [publishForm, setPublishForm] = useState({
    type: "house_mission" as MissionActivityType,
    title: "",
    occurredAt: new Date().toISOString().slice(0, 16),
  });
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const transitioningIds = useRef(new Set<string>());
  const [transitioningRows, setTransitioningRows] = useState<
    Record<string, boolean>
  >({});

  const load = async (pageToLoad: number = page) => {
    const requestId = ++loadSeq.current;
    setIsLoading(true);
    setError(null);
    setErrorTechnical(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", String(pageToLoad));
      params.set("limit", "50");
      const res = await api.getWithMeta<SubmissionRow[]>(
        `/api/submissions?${params.toString()}`
      );
      if (requestId !== loadSeq.current) return;
      setItems(res.data || []);
      setMeta(res.meta ?? null);
    } catch (err) {
      if (requestId !== loadSeq.current) return;
      setError(
        err instanceof ApiError
          ? err.message
          : "โหลดข้อมูลที่ส่งเข้ามาไม่สำเร็จ"
      );
      setErrorTechnical(
        err instanceof ApiError
          ? (err.serverMessage ?? err.message)
          : String(err)
      );
    } finally {
      if (requestId === loadSeq.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const submitCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    setCaptureError(null);
    if (!rawText.trim() && !rawMediaUrls.some(u => u.trim())) {
      setCaptureError("กรุณากรอกข้อความหรือแนบลิงก์อย่างน้อยหนึ่งอย่าง");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/submissions", {
        rawText: rawText || undefined,
        rawMediaUrls: rawMediaUrls.filter(u => u.trim()),
        submittedByLabel: submittedByLabel || undefined,
      });
      toast.success("บันทึกข้อมูลนำเข้าแล้ว");
      setCaptureOpen(false);
      setRawText("");
      setRawMediaUrls([]);
      setSubmittedByLabel("");
      load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ";
      setCaptureError(withRecheckHint(message, err));
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const transition = async (
    row: SubmissionRow,
    status: MissionSubmissionStatus
  ) => {
    if (transitioningIds.current.has(row.id)) return;
    transitioningIds.current.add(row.id);
    setTransitioningRows(prev => ({ ...prev, [row.id]: true }));
    try {
      await api.put(`/api/submissions/${row.id}/status`, { status });
      toast.success(`เปลี่ยนสถานะเป็น "${STATUS_LABELS[status]}" แล้ว`);
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "เปลี่ยนสถานะไม่สำเร็จ"
      );
    } finally {
      transitioningIds.current.delete(row.id);
      setTransitioningRows(prev => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
    }
  };

  const openPublish = (row: SubmissionRow) => {
    setPublishTarget(row);
    setPublishError(null);
    setPublishForm({
      type: "house_mission",
      title: row.rawText ? row.rawText.slice(0, 80) : "",
      occurredAt: new Date().toISOString().slice(0, 16),
    });
  };

  const submitPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishTarget) return;
    setPublishError(null);
    setPublishing(true);
    try {
      await api.post(`/api/submissions/${publishTarget.id}/publish`, {
        type: publishForm.type,
        title: publishForm.title,
        occurredAt: new Date(publishForm.occurredAt).toISOString(),
        includeRawMedia: true,
      });
      toast.success("เผยแพร่เป็นกิจกรรมพันธกิจแล้ว (ฉบับร่าง)");
      setPublishTarget(null);
      load();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "เผยแพร่ไม่สำเร็จ";
      setPublishError(withRecheckHint(message, err));
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  };

  const countLabel =
    !isLoading && !error
      ? `${items.length.toLocaleString("th-TH")} รายการ`
      : undefined;

  return (
    <AppLayout>
      <PageHeader
        title="ข้อมูลที่ส่งเข้ามา"
        description="สิ่งที่ยังไม่ได้เป็นข้อมูลทางการ — พิมพ์สิ่งที่ได้รับ (เช่นจาก LINE) แล้วตรวจสอบก่อนเผยแพร่"
        primaryAction={{
          label: "บันทึกข้อมูลนำเข้า",
          icon: Plus,
          onClick: () => {
            setCaptureError(null);
            setCaptureOpen(true);
          },
        }}
      />

      <div className="mb-5 w-full sm:w-56">
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

      <section aria-labelledby="inbox-heading">
        <SectionHeader
          id="inbox-heading"
          title="ข้อมูลนำเข้าทั้งหมด"
          description={countLabel}
        />

        {isLoading ? (
          <ListSkeleton count={4} />
        ) : error ? (
          <ErrorState
            title="โหลดข้อมูลที่ส่งเข้ามาไม่สำเร็จ"
            description="ระบบเชื่อมต่อไม่สำเร็จในขณะนี้ กรุณาลองอีกครั้ง"
            technical={errorTechnical ?? undefined}
            onRetry={() => load()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            title="ยังไม่มีข้อมูลนำเข้า"
            description="พิมพ์ข้อความหรือลิงก์รูปที่ได้รับจากทีมภาคสนาม เพื่อตรวจสอบก่อนเผยแพร่เป็นกิจกรรมพันธกิจ"
            action={{
              label: "บันทึกข้อมูลนำเข้า",
              icon: Plus,
              onClick: () => {
                setCaptureError(null);
                setCaptureOpen(true);
              },
            }}
          />
        ) : (
          <>
            <div className="space-y-3">
            {items.map(row => (
              <article
                key={row.id}
                className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4"
              >
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <StatusChip tone={STATUS_TONE[row.status]}>
                      {STATUS_LABELS[row.status]}
                    </StatusChip>
                    <span className="type-fine text-[var(--color-body-muted)]">
                      {formatDateTime(row.createdAt)}
                    </span>
                </div>
                <p className="type-caption whitespace-pre-line text-[var(--color-text-secondary)]">
                  {row.rawText || "(ไม่มีข้อความ)"}
                </p>
                {row.submittedByLabel && (
                    <p className="type-fine mt-1 text-[var(--color-body-muted)]">
                      จาก: {row.submittedByLabel}
                    </p>
                )}

                {isReviewer && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-divider)] pt-3">
                    {row.status === "new" && (
                        <button
                          type="button"
                          className={ROW_BUTTON_CLASS}
                          onClick={() => void transition(row, "reviewing")}
                          disabled={transitioningRows[row.id]}
                          aria-busy={transitioningRows[row.id] || undefined}
                        >
                          <Send size={ICON_SIZE.sm} aria-hidden="true" />{" "}
                          {transitioningRows[row.id]
                            ? "กำลังบันทึก…"
                            : "เริ่มตรวจสอบ"}
                      </button>
                    )}
                    {row.status === "reviewing" && (
                      <>
                        <button
                          type="button"
                          className={ROW_PRIMARY_BUTTON_CLASS}
                            onClick={() => void transition(row, "approved")}
                            disabled={transitioningRows[row.id]}
                            aria-busy={transitioningRows[row.id] || undefined}
                        >
                            <CheckCircle2
                              size={ICON_SIZE.sm}
                              aria-hidden="true"
                            />{" "}
                            {transitioningRows[row.id]
                              ? "กำลังบันทึก…"
                              : "อนุมัติ"}
                        </button>
                        <button
                          type="button"
                          className={ROW_BUTTON_CLASS}
                            onClick={() => void transition(row, "needs_info")}
                            disabled={transitioningRows[row.id]}
                            aria-busy={transitioningRows[row.id] || undefined}
                        >
                            {transitioningRows[row.id]
                              ? "กำลังบันทึก…"
                              : "ต้องการข้อมูลเพิ่ม"}
                        </button>
                        <button
                          type="button"
                          className={ROW_DANGER_BUTTON_CLASS}
                            onClick={() => void transition(row, "rejected")}
                            disabled={transitioningRows[row.id]}
                            aria-busy={transitioningRows[row.id] || undefined}
                        >
                            <X size={ICON_SIZE.sm} aria-hidden="true" />{" "}
                            {transitioningRows[row.id]
                              ? "กำลังบันทึก…"
                              : "ปฏิเสธ"}
                        </button>
                      </>
                    )}
                    {row.status === "needs_info" && (
                        <button
                          type="button"
                          className={ROW_BUTTON_CLASS}
                          onClick={() => void transition(row, "reviewing")}
                          disabled={transitioningRows[row.id]}
                          aria-busy={transitioningRows[row.id] || undefined}
                        >
                          {transitioningRows[row.id]
                            ? "กำลังบันทึก…"
                            : "กลับไปตรวจสอบ"}
                      </button>
                    )}
                      {row.status === "approved" &&
                        !row.publishedActivityId && (
                      <button
                        type="button"
                        className={ROW_PRIMARY_BUTTON_CLASS}
                        onClick={() => openPublish(row)}
                      >
                            <Sparkles size={ICON_SIZE.sm} aria-hidden="true" />{" "}
                            เผยแพร่เป็นกิจกรรม
                      </button>
                    )}
                    {row.publishedActivityId && (
                        <StatusChip tone="success">
                          เผยแพร่เป็นกิจกรรมแล้ว
                        </StatusChip>
                    )}
                  </div>
                )}
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

      <Modal
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        title="บันทึกข้อมูลนำเข้า"
        footer={
          <>
            <button
              type="button"
              className={CANCEL_BUTTON_CLASS}
              onClick={() => setCaptureOpen(false)}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              form="inbox-capture-form"
              className={PRIMARY_BUTTON_CLASS}
              disabled={submitting}
            >
              {submitting ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </>
        }
      >
        <form
          id="inbox-capture-form"
          className="flex flex-col gap-5"
          onSubmit={submitCapture}
        >
          {captureError && <FormError>{captureError}</FormError>}
          <Field label="ข้อความที่ได้รับ">
            {props => (
              <textarea
                {...props}
                className={`${CONTROL_CLASS} resize-y`}
                rows={6}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder="พิมพ์สิ่งที่ได้รับมา เช่น จากข้อความ LINE ของทีมภาคสนาม..."
              />
            )}
          </Field>
          <Field label="ผู้ส่งข้อมูล (ถ้ามี)">
            {props => (
              <input
                {...props}
                className={CONTROL_CLASS}
                value={submittedByLabel}
                onChange={e => setSubmittedByLabel(e.target.value)}
                placeholder="เช่น LINE: ทีมภาคสนามเขต 1"
              />
            )}
          </Field>
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="type-caption-strong text-[var(--color-ink)]">
              รูปภาพ (ลิงก์ URL)
            </legend>
            {rawMediaUrls.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  aria-label={`ลิงก์รูปภาพที่ ${i + 1}`}
                  className={`${CONTROL_CLASS} flex-1`}
                  value={url}
                  onChange={e => {
                    const next = [...rawMediaUrls];
                    next[i] = e.target.value;
                    setRawMediaUrls(next);
                  }}
                  placeholder="https://..."
                />
                <button
                  type="button"
                  aria-label={`ลบรูปภาพที่ ${i + 1}`}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-body-muted)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                  onClick={() =>
                    setRawMediaUrls(rawMediaUrls.filter((_, idx) => idx !== i))
                  }
                >
                  <X size={ICON_SIZE.md} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={DASHED_BUTTON_CLASS}
              onClick={() => setRawMediaUrls([...rawMediaUrls, ""])}
            >
              <Plus size={ICON_SIZE.sm} aria-hidden="true" /> เพิ่มรูปภาพ
            </button>
          </fieldset>
        </form>
      </Modal>

      <Modal
        open={publishTarget !== null}
        onClose={() => setPublishTarget(null)}
        title="เผยแพร่เป็นกิจกรรมพันธกิจ"
        footer={
          <>
            <button
              type="button"
              className={CANCEL_BUTTON_CLASS}
              onClick={() => setPublishTarget(null)}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              form="inbox-publish-form"
              className={PRIMARY_BUTTON_CLASS}
              disabled={publishing}
            >
              {publishing ? "กำลังเผยแพร่…" : "สร้างกิจกรรม (ฉบับร่าง)"}
            </button>
          </>
        }
      >
        <form
          id="inbox-publish-form"
          className="flex flex-col gap-5"
          onSubmit={submitPublish}
        >
          {publishError && <FormError>{publishError}</FormError>}
          <Field label="ประเภทกิจกรรม" required>
            {props => (
              <select
                {...props}
                className={CONTROL_CLASS}
                value={publishForm.type}
                onChange={e =>
                  setPublishForm({
                    ...publishForm,
                    type: e.target.value as MissionActivityType,
                  })
                }
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="หัวข้อ" required>
            {props => (
              <input
                {...props}
                className={CONTROL_CLASS}
                required
                value={publishForm.title}
                onChange={e =>
                  setPublishForm({ ...publishForm, title: e.target.value })
                }
              />
            )}
          </Field>
          <Field label="วันเวลาที่เกิดขึ้น" required>
            {props => (
              <input
                {...props}
                type="datetime-local"
                className={CONTROL_CLASS}
                required
                value={publishForm.occurredAt}
                onChange={e =>
                  setPublishForm({ ...publishForm, occurredAt: e.target.value })
                }
              />
            )}
          </Field>
        </form>
      </Modal>
    </AppLayout>
  );
}
