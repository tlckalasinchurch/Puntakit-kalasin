import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  ListTodo,
  MapPin,
  Plus,
  RotateCcw,
  Send,
  Users,
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
  FilterDisclosure,
} from "@/components/DesignSystem";
import { CardGridSkeleton } from "@/components/LoadingStates";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, type ApiMeta } from "@/lib/api";
import { fetchAllMembers } from "@/lib/fetchAll";
import type { MissionActivityStatus, MissionActivityType } from "@shared/schema";
import { CREATE_ROLES } from "@shared/roles";
import { usePageTitle } from "@/hooks/usePageTitle";

interface FeedActivity {
  id: string;
  type: MissionActivityType;
  status: MissionActivityStatus;
  title: string;
  story: string | null;
  occurredAt: string;
  groupId: string | null;
  groupName: string | null;
  placeLabel: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  thumbnailUrl: string | null;
}

interface GroupOption {
  id: string;
  name: string;
}

interface MemberOption {
  id: string;
  name: string;
  nickname: string | null;
}

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

const STATUS_LABELS: Record<MissionActivityStatus, string> = {
  draft: "ฉบับร่าง",
  pending_review: "รอตรวจสอบ",
  published: "เผยแพร่แล้ว",
  archived: "เก็บถาวร",
};

const STATUS_TONE: Record<MissionActivityStatus, StatusTone> = {
  draft: "neutral",
  pending_review: "warning",
  published: "success",
  archived: "neutral",
};

const EMPTY_FORM = {
  type: "house_mission" as MissionActivityType,
  title: "",
  story: "",
  occurredAt: new Date().toISOString().slice(0, 16),
  groupId: "",
  placeLabel: "",
  participantMemberIds: [] as string[],
  media: [] as { url: string }[],
};

const CONTROL_CLASS =
  "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-body-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";
const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const CANCEL_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const ROW_BUTTON_CLASS =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] px-2 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const ROW_PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-2 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const DASHED_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-hairline)] px-3 text-sm font-semibold text-[var(--color-body-muted)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Feed() {
  usePageTitle("ฟีดกิจกรรมพันธกิจ");
  const { user } = useAuth();

  const [items, setItems] = useState<FeedActivity[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorTechnical, setErrorTechnical] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  // True when the groups dropdown failed to load: the form must say so instead
  // of silently showing "no groups".
  const [groupsError, setGroupsError] = useState(false);
  const [participantQuery, setParticipantQuery] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  const canCreate = user && CREATE_ROLES.includes(user.role);

  const load = async (pageToLoad: number = page) => {
    setIsLoading(true);
    setError(null);
    setErrorTechnical(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", String(pageToLoad));
      params.set("limit", "30");
      const res = await api.getWithMeta<FeedActivity[]>(`/api/activities?${params.toString()}`);
      setItems(res.data || []);
      setMeta(res.meta ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "โหลดฟีดไม่สำเร็จ");
      setErrorTechnical(err instanceof ApiError ? (err.serverMessage ?? err.message) : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter]);

  const loadGroups = () => {
    api
      .get<GroupOption[]>("/api/groups")
      .then(groups => {
        setGroups(groups);
        setGroupsError(false);
      })
      .catch(() => {
        // A failed option fetch must not masquerade as "no groups": say so,
        // keep the form usable (group binding is optional), and offer retry.
        setGroups([]);
        setGroupsError(true);
        toast.error("โหลดรายชื่อกลุ่มไม่สำเร็จ กิจกรรมจะยังไม่ผูกกับกลุ่ม");
      });
  };

  useEffect(() => {
    if (!canCreate) return;
    loadGroups();
    fetchAllMembers<MemberOption>()
      .then(setMembers)
      .catch(() => {
        setMembers([]);
        toast.error("โหลดรายชื่อสมาชิกไม่สำเร็จ เลือกผู้เข้าร่วมไม่ได้ในตอนนี้");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCreate]);

  const openCreate = () => {
    setParticipantQuery("");
    setForm(EMPTY_FORM);
    setFormError(null);
    setTitleError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setTitleError(null);
    if (!form.title.trim()) {
      setTitleError("กรุณากรอกหัวข้อกิจกรรม");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/activities", {
        type: form.type,
        title: form.title,
        story: form.story || undefined,
        occurredAt: new Date(form.occurredAt).toISOString(),
        groupId: form.groupId || null,
        placeLabel: form.placeLabel || undefined,
        participantMemberIds: form.participantMemberIds,
        media: form.media.filter((m) => m.url.trim()).map((m) => ({ url: m.url.trim(), kind: "image" as const })),
      });
      toast.success("บันทึกกิจกรรมพันธกิจแล้ว (ฉบับร่าง)");
      setFormOpen(false);
      load();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ";
      setFormError(`${message} กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง`);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const transition = async (activity: FeedActivity, status: MissionActivityStatus) => {
    setTransitioningId(activity.id);
    try {
      await api.put(`/api/activities/${activity.id}/status`, { status });
      toast.success(`เปลี่ยนสถานะเป็น "${STATUS_LABELS[status]}" แล้ว`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setTransitioningId(null);
    }
  };

  const createFollowUp = async (activity: FeedActivity) => {
    try {
      await api.post("/api/follow-ups", {
        title: `ติดตามหลัง: ${activity.title}`,
        activityId: activity.id,
        subjectGroupId: activity.groupId || undefined,
      });
      toast.success("สร้างรายการติดตามแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "สร้างรายการติดตามไม่สำเร็จ");
    }
  };

  const toggleParticipant = (memberId: string) => {
    setForm((f) => ({
      ...f,
      participantMemberIds: f.participantMemberIds.includes(memberId)
        ? f.participantMemberIds.filter((id) => id !== memberId)
        : [...f.participantMemberIds, memberId],
    }));
  };

  const typeOptions = useMemo(() => Object.entries(TYPE_LABELS), []);
  const statusOptions = useMemo(() => Object.entries(STATUS_LABELS), []);

  const countLabel = !isLoading && !error ? `${items.length.toLocaleString("th-TH")} กิจกรรม` : undefined;

  const pq = participantQuery.trim().toLowerCase();
  const visibleMembers = pq
    ? members.filter((m) => `${m.name} ${m.nickname ?? ""}`.toLowerCase().includes(pq) || form.participantMemberIds.includes(m.id))
    : members;

  return (
    <AppLayout>
      <PageHeader
        title="ฟีดกิจกรรมพันธกิจ"
        description="อะไรเกิดขึ้น ที่ไหน กับใคร — บันทึกและติดตามกิจกรรมพันธกิจทั้งหมด"
        primaryAction={canCreate ? { label: "บันทึกกิจกรรม", icon: Camera, onClick: openCreate } : undefined}
      />

      <div className="mb-5 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
        <FilterDisclosure activeCount={[typeFilter, statusFilter].filter(Boolean).length}>
        <Field label="ประเภทกิจกรรม">
          {(props) => (
            <select {...props} className={CONTROL_CLASS} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">ทุกประเภทกิจกรรม</option>
              {typeOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="สถานะ">
          {(props) => (
            <select {...props} className={CONTROL_CLASS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">ทุกสถานะ</option>
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
        </FilterDisclosure>
      </div>

      <section aria-labelledby="feed-heading">
        <SectionHeader id="feed-heading" title="กิจกรรมในฟีด" description={countLabel} />

        {isLoading ? (
          <CardGridSkeleton count={6} />
        ) : error ? (
          <ErrorState
            title="โหลดฟีดกิจกรรมไม่สำเร็จ"
            description="ระบบเชื่อมต่อไม่สำเร็จในขณะนี้ กรุณาลองอีกครั้ง"
            technical={errorTechnical ?? undefined}
            onRetry={() => load()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Camera}
            title="ยังไม่มีกิจกรรมในฟีด"
            description={
              canCreate
                ? "เริ่มบันทึกกิจกรรมพันธกิจแรก เพื่อให้ทีมเห็นว่าพระเจ้าทำอะไรอยู่"
                : "รอทีมงานบันทึกกิจกรรม แล้วกลับมาตรวจสอบอีกครั้ง"
            }
            action={
              canCreate ? { label: "บันทึกกิจกรรม", icon: Camera, onClick: openCreate } : { label: "โหลดใหม่", onClick: () => load() }
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((activity) => {
              const isMine = user?.id === activity.createdById;
              const canAdvance = isMine || (user && CREATE_ROLES.includes(user.role));
              return (
                <article
                  key={activity.id}
                  className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] transition-shadow hover:shadow-[var(--shadow)] motion-reduce:transition-none"
                >
                  {activity.thumbnailUrl ? (
                    <img src={activity.thumbnailUrl} alt="" className="h-40 w-full object-cover" />
                  ) : (
                    <div className="flex h-24 w-full items-center justify-center bg-[var(--color-canvas-soft)]">
                      <ImageIcon size={ICON_SIZE["2xl"]} aria-hidden="true" className="text-[var(--color-body-muted)]" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <StatusChip tone="neutral">{TYPE_LABELS[activity.type]}</StatusChip>
                      <StatusChip tone={STATUS_TONE[activity.status]}>{STATUS_LABELS[activity.status]}</StatusChip>
                    </div>
                    <h3 className="type-body-strong mb-1 leading-snug text-[var(--color-ink)]">{activity.title}</h3>
                    {activity.story && (
                      <p className="type-caption mb-3 line-clamp-2 text-[var(--color-text-secondary)]">{activity.story}</p>
                    )}
                    <div className="mt-auto space-y-1">
                      <p className="type-fine text-[var(--color-body-muted)]">{formatDateTime(activity.occurredAt)}</p>
                      {(activity.groupName || activity.placeLabel) && (
                        <p className="type-fine flex items-center gap-1 text-[var(--color-body-muted)]">
                          <MapPin size={ICON_SIZE.xs} aria-hidden="true" />
                          {activity.groupName ?? activity.placeLabel}
                        </p>
                      )}
                      {activity.createdByName && (
                        <p className="type-fine flex items-center gap-1 text-[var(--color-body-muted)]">
                          <Users size={ICON_SIZE.xs} aria-hidden="true" />
                          {activity.createdByName}
                        </p>
                      )}
                    </div>

                    {canAdvance && activity.status !== "archived" && (
                      <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-divider)] pt-3">
                        {activity.status === "draft" && (
                          <button
                            type="button"
                            className={ROW_BUTTON_CLASS}
                            disabled={transitioningId === activity.id}
                            onClick={() => transition(activity, "pending_review")}
                          >
                            <Send size={ICON_SIZE.sm} aria-hidden="true" /> ส่งตรวจสอบ
                          </button>
                        )}
                        {(activity.status === "draft" || activity.status === "pending_review") && (
                          <button
                            type="button"
                            className={ROW_PRIMARY_BUTTON_CLASS}
                            disabled={transitioningId === activity.id}
                            onClick={() => transition(activity, "published")}
                          >
                            <CheckCircle2 size={ICON_SIZE.sm} aria-hidden="true" /> เผยแพร่
                          </button>
                        )}
                        {activity.status === "published" && (
                          <button
                            type="button"
                            className={ROW_BUTTON_CLASS}
                            disabled={transitioningId === activity.id}
                            onClick={() => transition(activity, "archived")}
                          >
                            <Archive size={ICON_SIZE.sm} aria-hidden="true" /> เก็บถาวร
                          </button>
                        )}
                      </div>
                    )}
                    {activity.status === "archived" && canAdvance && (
                      <div className="mt-3 border-t border-[var(--color-divider)] pt-3">
                        <button
                          type="button"
                          className={`${ROW_BUTTON_CLASS} w-full`}
                          disabled={transitioningId === activity.id}
                          onClick={() => transition(activity, "draft")}
                        >
                          <RotateCcw size={ICON_SIZE.sm} aria-hidden="true" /> กู้คืนเป็นฉบับร่าง
                        </button>
                      </div>
                    )}
                    {canAdvance && activity.groupId && (
                      <button
                        type="button"
                        className={`${DASHED_BUTTON_CLASS} mt-2 w-full`}
                        onClick={() => createFollowUp(activity)}
                      >
                        <ListTodo size={ICON_SIZE.sm} aria-hidden="true" /> สร้างรายการติดตามจากกิจกรรมนี้
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
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
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="บันทึกกิจกรรมพันธกิจ"
        footer={
          <>
            <button type="button" className={CANCEL_BUTTON_CLASS} onClick={() => setFormOpen(false)}>
              ยกเลิก
            </button>
            <button type="submit" form="feed-activity-form" className={PRIMARY_BUTTON_CLASS} disabled={submitting}>
              {submitting ? "กำลังบันทึก…" : "บันทึกเป็นฉบับร่าง"}
            </button>
          </>
        }
      >
        <form id="feed-activity-form" className="flex flex-col gap-5" onSubmit={handleSubmit}>
          {formError && <FormError>{formError}</FormError>}
          <Field label="ประเภทกิจกรรม" required>
            {(props) => (
              <select
                {...props}
                className={CONTROL_CLASS}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as MissionActivityType })}
              >
                {typeOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="หัวข้อ" required error={titleError ?? undefined}>
            {(props) => (
              <input
                {...props}
                className={CONTROL_CLASS}
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="เช่น เยี่ยมบ้านครอบครัวคุณสมชาย"
              />
            )}
          </Field>

          <Field label="เรื่องราว">
            {(props) => (
              <textarea
                {...props}
                className={`${CONTROL_CLASS} resize-y`}
                rows={4}
                value={form.story}
                onChange={(e) => setForm({ ...form, story: e.target.value })}
                placeholder="เกิดอะไรขึ้นบ้าง..."
              />
            )}
          </Field>

          <Field label="วันเวลาที่เกิดขึ้น" required>
            {(props) => (
              <input
                {...props}
                type="datetime-local"
                className={CONTROL_CLASS}
                required
                value={form.occurredAt}
                onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
              />
            )}
          </Field>

          {groupsError && (
            <div
              role="alert"
              className="type-caption flex items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-[var(--color-warning)]/10 p-3 text-[var(--color-ink)]"
            >
              <span>โหลดรายชื่อกลุ่มไม่สำเร็จ จะบันทึกโดยไม่ผูกกลุ่มได้</span>
              <button
                type="button"
                onClick={loadGroups}
                className="type-caption-strong inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
              >
                ลองอีกครั้ง
              </button>
            </div>
          )}
          <Field label="กลุ่ม (ถ้ามี)">
            {(props) => (
              <select
                {...props}
                className={CONTROL_CLASS}
                value={form.groupId}
                onChange={(e) => setForm({ ...form, groupId: e.target.value })}
              >
                <option value="">ไม่ระบุกลุ่ม</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="สถานที่ (ถ้ามี)">
            {(props) => (
              <input
                {...props}
                className={CONTROL_CLASS}
                value={form.placeLabel}
                onChange={(e) => setForm({ ...form, placeLabel: e.target.value })}
                placeholder="เช่น บ้านเลขที่ 12 หมู่ 3"
              />
            )}
          </Field>

          <fieldset className="min-w-0">
            <legend className="type-caption-strong text-[var(--color-ink)]">
              ผู้เกี่ยวข้อง ({form.participantMemberIds.length} คน)
            </legend>
            <input
              type="search"
              aria-label="ค้นหาผู้เกี่ยวข้อง"
              placeholder="ค้นหาด้วยชื่อหรือชื่อเล่น"
              value={participantQuery}
              onChange={(e) => setParticipantQuery(e.target.value)}
              className={`${CONTROL_CLASS} mt-1.5`}
            />
            <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-hairline)] p-2">
              {members.length === 0 && (
                <p className="type-fine p-2 text-[var(--color-body-muted)]">ไม่มีข้อมูลสมาชิก</p>
              )}
              {members.length > 0 && visibleMembers.length === 0 && (
                <p className="type-fine p-2 text-[var(--color-body-muted)]">ไม่พบสมาชิกที่ค้นหา</p>
              )}
              {visibleMembers.map((m) => (
                <label
                  key={m.id}
                  className="type-caption flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] px-2 text-[var(--color-ink)] hover:bg-[var(--color-canvas-soft)]"
                >
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={form.participantMemberIds.includes(m.id)}
                    onChange={() => toggleParticipant(m.id)}
                  />
                  {m.nickname ? `${m.name} (${m.nickname})` : m.name}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="type-caption-strong text-[var(--color-ink)]">รูปภาพ (ลิงก์ URL)</legend>
            {form.media.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  aria-label={`ลิงก์รูปภาพที่ ${i + 1}`}
                  className={`${CONTROL_CLASS} flex-1`}
                  value={m.url}
                  onChange={(e) => {
                    const media = [...form.media];
                    media[i] = { url: e.target.value };
                    setForm({ ...form, media });
                  }}
                  placeholder="https://..."
                />
                <button
                  type="button"
                  aria-label={`ลบรูปภาพที่ ${i + 1}`}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-body-muted)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                  onClick={() => setForm({ ...form, media: form.media.filter((_, idx) => idx !== i) })}
                >
                  <X size={ICON_SIZE.md} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={`${DASHED_BUTTON_CLASS} self-start`}
              onClick={() => setForm({ ...form, media: [...form.media, { url: "" }] })}
            >
              <Plus size={ICON_SIZE.sm} aria-hidden="true" /> เพิ่มรูปภาพ
            </button>
          </fieldset>
        </form>
      </Modal>
    </AppLayout>
  );
}
