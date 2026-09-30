import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Activity,
  ArrowRight,
  CalendarDays,
  Camera,
  ChevronRight,
  Clock,
  Compass,
  Database,
  HeartHandshake,
  Inbox as InboxIcon,
  ListTodo,
  Megaphone,
  RotateCw,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PRIVILEGED_ROLES as OPERATIONS_ROLES } from "@shared/roles";

// ---------------------------------------------------------------------------
// Types (shapes of existing API responses)
// ---------------------------------------------------------------------------

interface RecentMember {
  id: string;
  name: string;
  nickname: string | null;
  role: string;
  area: string | null;
  status: string;
  joinedAt: string;
}

interface RecentAnnouncement {
  id: string;
  title: string;
  publishDate: string;
  status: string;
}

interface DashboardSummary {
  totalMembers: number;
  newThisMonth: number;
  needFollowUp: number;
  followedUp: number;
  activeMembers: number;
  recentMembers?: RecentMember[];
  recentAnnouncements?: RecentAnnouncement[];
}

interface ChurchEvent {
  id: string;
  title: string;
  eventDate: string;
  category: "worship" | "activity" | "meeting" | "other";
  status: string;
}

// Same labels as the Events page.
const EVENT_CATEGORY_LABEL: Record<ChurchEvent["category"], string> = {
  worship: "นมัสการ",
  activity: "กิจกรรม",
  meeting: "ประชุม",
  other: "อื่นๆ",
};

interface Ministry {
  id: string;
  name: string;
  description: string | null;
  leader: string | null;
  status: "active" | "inactive";
}

interface OperationsSubmission {
  id: string;
  status: string;
  rawText: string | null;
  createdAt: string;
}

interface OperationsFollowUp {
  id: string;
  title: string;
  dueAt: string | null;
  subjectMemberName: string | null;
  subjectGroupName: string | null;
}

interface OperationsInactiveGroup {
  id: string;
  name: string;
}

interface OperationsActivity {
  id: string;
  title: string;
  status: string;
  occurredAt: string;
  groupName: string | null;
}

interface OperationsData {
  pendingSubmissionsCount: number;
  pendingSubmissions: OperationsSubmission[];
  openFollowUpsCount: number;
  overdueFollowUpsCount: number;
  overdueFollowUps: OperationsFollowUp[];
  inactiveGroups: OperationsInactiveGroup[];
  recentActivity: OperationsActivity[];
}

interface HealthStatus {
  status: string;
  database?: string;
  timestamp?: string;
}

const MINISTRY_PREVIEW_LIMIT = 6;
const IDENTITY_IMAGE = "/manus-storage/puntakit-hero_d9170436.png";

/** Whole days past `dueAt`, or null if the date is missing/unparseable. */
function daysOverdue(dueAt: string | null): number | null {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return null;
  return Math.max(0, Math.floor((Date.now() - due) / 86_400_000));
}

// ---------------------------------------------------------------------------
// Data loading: each section owns loading / error / success separately, so a
// failed request is shown as an error and never disguised as zero or empty.
// ---------------------------------------------------------------------------

type QueryState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };

function useHomeQuery<T>(path: string | null) {
  const [state, setState] = useState<QueryState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!path) return;
    let active = true;
    setState({ status: "loading" });
    api.get<T>(path).then(
      data => {
        if (active) setState({ status: "success", data });
      },
      err => {
        if (active) {
          setState({
            status: "error",
            message:
              err instanceof ApiError ? err.message : "โหลดข้อมูลไม่สำเร็จ",
          });
        }
      }
    );
    return () => {
      active = false;
    };
  }, [path, attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);
  return [state, retry] as const;
}

function QueryView<T>({
  state,
  retry,
  skeleton,
  children,
}: {
  state: QueryState<T>;
  retry: () => void;
  skeleton: React.ReactNode;
  children: (data: T) => React.ReactNode;
}) {
  if (state.status === "loading") {
    return (
      <div role="status" aria-label="กำลังโหลดข้อมูล">
        {skeleton}
      </div>
    );
  }
  if (state.status === "error")
    return <ErrorState message={state.message} onRetry={retry} />;
  return <>{children(state.data)}</>;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Section building blocks
// ---------------------------------------------------------------------------

function SectionHeader({
  id,
  title,
  description,
  action,
}: {
  id: string;
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h2 id={id} className="type-lead font-semibold text-[var(--color-ink)]">
          {title}
        </h2>
        {description && (
          <p className="type-caption mt-1 text-[var(--color-body-muted)]">
            {description}
          </p>
        )}
      </div>
      {action && (
        <Button
          asChild
          variant="link"
          className="h-11 self-start px-2 sm:self-auto"
        >
          <Link href={action.href}>
            {action.label}
            <ArrowRight size={ICON_SIZE.sm} aria-hidden="true" />
          </Link>
        </Button>
      )}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-4 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          size={ICON_SIZE.lg}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-[var(--color-error)]"
        />
        <div>
          <p className="type-body-strong text-[var(--color-ink)]">
            โหลดข้อมูลส่วนนี้ไม่สำเร็จ
          </p>
          <p className="type-caption text-[var(--color-body-muted)]">
            {message}
          </p>
        </div>
      </div>
      <Button variant="outline" onClick={onRetry}>
        <RotateCw aria-hidden="true" />
        ลองใหม่
      </Button>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  inset = false,
}: {
  icon: React.ComponentType<{
    size?: number;
    className?: string;
    "aria-hidden"?: boolean | "true";
  }>;
  title: string;
  description?: string;
  action?: { href: string; label: string };
  inset?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 px-6 py-10 text-center ${
        inset
          ? "bg-[var(--color-canvas)]"
          : "rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]"
      }`}
    >
      <Icon
        size={ICON_SIZE["2xl"]}
        aria-hidden="true"
        className="text-[var(--color-body-muted)]"
      />
      <p className="type-body-strong text-[var(--color-ink)]">{title}</p>
      {description && (
        <p className="type-caption max-w-sm text-[var(--color-body-muted)]">
          {description}
        </p>
      )}
      {action && (
        <Button asChild variant="link" className="h-11 px-2">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}

function TileSkeleton({
  count,
  className,
}: {
  count: number;
  className: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6"
        >
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="divide-y divide-[var(--color-divider)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <Skeleton className="h-11 w-11 shrink-0 rounded-[var(--radius-circle)]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The contact gap, drawn from real data only.
 *
 * There is no "last contacted" timestamp anywhere in the schema, so this does
 * NOT claim to show one. What it shows is what the database can actually
 * answer: how the member list splits between `ติดตามแล้ว` and `ต้องติดตาม`
 * (both are real columns on `members.status`), and — for the follow-up queue —
 * how far past `dueAt` each open item has gone, which is a real timestamp.
 *
 * The bar length is the datum; no invented trend, no fabricated "days since".
 */
function ContactGap({
  followedUp,
  needFollowUp,
  overdue,
}: {
  followedUp: number;
  needFollowUp: number;
  overdue: OperationsFollowUp[];
}) {
  const total = followedUp + needFollowUp;
  const needPct = total > 0 ? (needFollowUp / total) * 100 : 0;
  const maxDays = overdue.reduce((max, item) => {
    const days = daysOverdue(item.dueAt);
    return days === null ? max : Math.max(max, days);
  }, 0);

  return (
    <div className="px-6 py-5">
      <p className="type-caption text-[var(--color-body-muted)]">
        สมาชิกที่ยังต้องติดตามดูแล
        <span className="type-body-strong ml-2 text-[var(--color-ink)]">
          {needFollowUp.toLocaleString("th-TH")}
        </span>
        <span className="text-[var(--color-body-muted)]">
          {" "}
          จาก {total.toLocaleString("th-TH")} คน
        </span>
      </p>

      {/* One bar, two real segments. The needs-follow-up portion carries the
          ink weight because it is the part that still needs a person; it also
          inverts correctly in dark mode, unlike a fixed graphite. */}
      <div
        className="mt-3 flex h-2 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-canvas-soft)]"
        role="img"
        aria-label={`ติดตามแล้ว ${followedUp.toLocaleString(
          "th-TH"
        )} คน ต้องติดตาม ${needFollowUp.toLocaleString("th-TH")} คน`}
      >
        <div
          className="bg-[var(--color-hairline)] transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${100 - needPct}%` }}
        />
        <div
          className="bg-[var(--color-ink)] transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${needPct}%` }}
        />
      </div>

      {maxDays > 0 && (
        <>
          <p className="type-caption-strong mt-6 text-[var(--color-ink)]">
            เลยกำหนดนานที่สุด
          </p>
          <ul className="mt-3 space-y-3">
            {overdue.slice(0, 3).map(followUp => {
              const days = daysOverdue(followUp.dueAt);
              if (days === null) return null;
              return (
                <li key={followUp.id}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="type-caption truncate text-[var(--color-ink)]">
                      {followUp.title}
                    </span>
                    <span className="type-fine shrink-0 font-semibold text-[var(--color-error)]">
                      {days} วัน
                    </span>
                  </div>
                  {/* Bar length is proportional to how overdue, against the
                      worst item in the queue, so the longest is always full. */}
                  <div className="mt-1.5 h-1 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-canvas-soft)]">
                    <div
                      className="h-full rounded-[var(--radius-pill)] bg-[var(--color-ink)]"
                      style={{ width: `${(days / maxDays) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: "success" | "warning" | "neutral";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
      : tone === "warning"
        ? "bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
        : "bg-[var(--color-canvas-soft)] text-[var(--color-body-muted)]";
  return (
    <span
      className={`type-fine shrink-0 rounded-[var(--radius-xs)] px-2 py-1 font-semibold ${toneClass}`}
    >
      {children}
    </span>
  );
}

function IconBadge({
  icon: Icon,
  tone = "primary",
}: {
  icon: React.ComponentType<{
    size?: number;
    "aria-hidden"?: boolean | "true";
  }>;
  tone?: "primary" | "alert";
}) {
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-circle)] bg-[var(--color-canvas-soft)] ${
        tone === "alert"
          ? "text-[var(--color-error)]"
          : "text-[var(--color-primary)]"
      }`}
    >
      <Icon size={ICON_SIZE.lg} aria-hidden="true" />
    </span>
  );
}

function AttentionRow({
  href,
  icon,
  label,
  count,
  detail,
  alert = false,
}: {
  href: string;
  icon: React.ComponentType<{
    size?: number;
    "aria-hidden"?: boolean | "true";
  }>;
  label: string;
  count: number;
  detail?: string;
  alert?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-11 items-center gap-4 px-6 py-4 outline-none transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-focus)]"
      >
        <IconBadge icon={icon} tone={alert ? "alert" : "primary"} />
        <span className="min-w-0 flex-1">
          <span className="type-body-strong block text-[var(--color-ink)]">
            {label}
          </span>
          {detail && (
            <span
              className={`type-caption block ${alert ? "text-[var(--color-error)]" : "text-[var(--color-body-muted)]"}`}
            >
              {detail}
            </span>
          )}
        </span>
        <span
          className={`type-body-strong tabular-nums ${
            count > 0
              ? "text-[var(--color-ink)]"
              : "text-[var(--color-body-muted)]"
          }`}
        >
          {count.toLocaleString("th-TH")}
        </span>
        <ChevronRight
          size={ICON_SIZE.lg}
          aria-hidden="true"
          className="shrink-0 text-[var(--color-body-muted)]"
        />
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Static editorial content
// ---------------------------------------------------------------------------

const DISCOVERY_LINKS = [
  {
    href: "/members",
    icon: Users,
    title: "สมาชิก",
    detail: "ดูแลความสัมพันธ์และการติดตาม",
  },
  {
    href: "/groups",
    icon: Compass,
    title: "กลุ่มแคร์",
    detail: "เชื่อมโยงผู้คนในชุมชน",
  },
  {
    href: "/events",
    icon: CalendarDays,
    title: "กิจกรรมและการนมัสการ",
    detail: "ตารางและสิ่งที่กำลังจะเกิดขึ้น",
  },
];

// Church's discipleship framework. Editorial guidance only: no member-stage data exists behind it.
const DISCIPLESHIP_PATHWAY = [
  { title: "พบคน", detail: "สร้างความสัมพันธ์และมิตรภาพ" },
  { title: "ประกาศ", detail: "แบ่งปันข่าวประเสริฐด้วยความรัก" },
  { title: "นำรับเชื่อ", detail: "ต้อนรับและติดตามดูแลใกล้ชิด" },
  { title: "นมัสการ", detail: "ร่วมสามัคคีธรรมที่คริสตจักร" },
  { title: "เข้ากลุ่มแคร์", detail: "ผูกพันในครอบครัวแห่งความเชื่อ" },
  { title: "สร้างสาวก", detail: "เติบโตและพร้อมส่งต่อพระพร" },
];

function OperationalPulse({
  health,
  ready,
  retry,
}: {
  health: QueryState<HealthStatus>;
  ready: QueryState<HealthStatus>;
  retry: () => void;
}) {
  const online = health.status === "success" && health.data.status === "ok";
  const databaseReady = ready.status === "success" && ready.data.status === "ready";
  const checkedAt = health.status === "success" && health.data.timestamp
    ? new Date(health.data.timestamp).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
    : "กำลังตรวจสอบ";

  return (
    <section aria-labelledby="system-pulse-title" className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4 shadow-[var(--shadow)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-primary)]">
            <Activity size={ICON_SIZE.lg} aria-hidden="true" />
          </span>
          <div>
            <p className="type-caption-strong text-[var(--color-primary)]">SYSTEM PULSE</p>
            <h2 id="system-pulse-title" className="type-body-strong text-[var(--color-ink)]">ภาพรวมระบบพร้อมทำงาน</h2>
            <p className="type-caption text-[var(--color-body-muted)]">ตรวจล่าสุด {checkedAt} · ข้อมูลจาก API จริง</p>
          </div>
        </div>
        <button type="button" onClick={retry} className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-4 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]">
          <RotateCw size={ICON_SIZE.sm} aria-hidden="true" /> ตรวจอีกครั้ง
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-canvas-soft)] p-3">
          <ShieldCheck size={ICON_SIZE.md} className={online ? "text-[var(--color-success)]" : "text-[var(--color-error)]"} aria-hidden="true" />
          <div className="min-w-0"><p className="type-caption text-[var(--color-body-muted)]">API service</p><p className="type-body-strong text-[var(--color-ink)]">{online ? "ทำงานปกติ" : "ต้องตรวจสอบ"}</p></div>
          <span className={`ml-auto h-2.5 w-2.5 rounded-full ${online ? "bg-[var(--color-success)]" : "bg-[var(--color-error)]"}`} aria-label={online ? "API ปกติ" : "API มีปัญหา"} />
        </div>
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-canvas-soft)] p-3">
          <Database size={ICON_SIZE.md} className={databaseReady ? "text-[var(--color-success)]" : "text-[var(--color-warning)]"} aria-hidden="true" />
          <div className="min-w-0"><p className="type-caption text-[var(--color-body-muted)]">ฐานข้อมูล</p><p className="type-body-strong text-[var(--color-ink)]">{databaseReady ? "เชื่อมต่อแล้ว" : ready.status === "error" ? "ยังไม่พร้อม" : "กำลังตรวจสอบ"}</p></div>
          <span className={`ml-auto h-2.5 w-2.5 rounded-full ${databaseReady ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"}`} aria-label={databaseReady ? "ฐานข้อมูลพร้อม" : "ฐานข้อมูลยังไม่พร้อม"} />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const canSeeOperations = Boolean(
    user && OPERATIONS_ROLES.includes(user.role)
  );
  const [identityImageFailed, setIdentityImageFailed] = useState(false);

  // Redirect member role directly to Member PWA
  useEffect(() => {
    if (user?.role === "member") {
      navigate("/app");
    }
  }, [user, navigate]);

  const [summary, retrySummary] = useHomeQuery<DashboardSummary>(
    "/api/dashboard/summary"
  );
  const [events, retryEvents] = useHomeQuery<ChurchEvent[]>("/api/events");
  const [ministries, retryMinistries] =
    useHomeQuery<Ministry[]>("/api/ministries");
  const [operations, retryOperations] = useHomeQuery<OperationsData>(
    canSeeOperations ? "/api/dashboard/operations" : null
  );
  const [health, retryHealth] = useHomeQuery<HealthStatus>("/api/health");
  const [ready, retryReady] = useHomeQuery<HealthStatus>("/api/ready");
  const retrySystemStatus = useCallback(() => {
    retryHealth();
    retryReady();
  }, [retryHealth, retryReady]);

  return (
    <AppLayout>
      <div className="home-editorial space-y-12 lg:space-y-20">
        {/* Identity + Global Search */}
        <section
          aria-labelledby="home-title"
          className={`grid gap-6 lg:gap-12 ${
            identityImageFailed
              ? ""
              : "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
          }`}
        >
          <div className="flex flex-col justify-center lg:py-8">
            <p className="type-caption-strong text-[var(--color-primary)]">
              PUNTAKIT KALASIN
            </p>
            <h1
              id="home-title"
              className="type-display-md mt-3 text-[var(--color-ink)]"
            >
              ค้นพบผู้คนและพันธกิจ
              <span className="block">ที่กำลังเติบโตไปด้วยกัน</span>
            </h1>
            <p className="type-body mt-4 max-w-xl text-[var(--color-body-muted)]">
              สวัสดีครับ {user?.name ?? "ทีมงานพันธกิจ"} —
              ดูสิ่งที่กำลังเกิดขึ้นในพันธกิจ
              และผู้คนที่ต้องการการดูแลได้จากหน้านี้
            </p>
            <GlobalSearch variant="prominent" className="mt-8 max-w-xl" />
          </div>
          {!identityImageFailed && (
            <img
              src={IDENTITY_IMAGE}
              alt=""
              onError={() => setIdentityImageFailed(true)}
              className="h-40 w-full rounded-[var(--radius-lg)] bg-[var(--color-canvas-soft)] object-cover sm:h-56 lg:h-full lg:min-h-[320px]"
            />
          )}
        </section>

        <OperationalPulse health={health} ready={ready} retry={retrySystemStatus} />

        {/* Context / discovery */}
        <nav aria-label="ทางลัดสำรวจพันธกิจ">
          <ul className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {DISCOVERY_LINKS.map(({ href, icon: Icon, title, detail }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex min-h-11 items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4 outline-none transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-circle)] bg-[var(--color-canvas-soft)] text-[var(--color-primary)]">
                    <Icon size={ICON_SIZE.lg} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="type-body-strong block text-[var(--color-ink)]">
                      {title}
                    </span>
                    <span className="type-caption block truncate text-[var(--color-body-muted)]">
                      {detail}
                    </span>
                  </span>
                  <ChevronRight
                    size={ICON_SIZE.lg}
                    aria-hidden="true"
                    className="shrink-0 text-[var(--color-body-muted)]"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Active ministry: the one canonical upcoming-events presentation */}
        <section aria-labelledby="home-upcoming">
          <SectionHeader
            id="home-upcoming"
            title="กิจกรรมที่กำลังจะมาถึง"
            description="การนมัสการและกิจกรรมที่อยู่ในกำหนดการ"
            action={{ href: "/events", label: "ดูตารางทั้งหมด" }}
          />
          <QueryView
            state={events}
            retry={retryEvents}
            skeleton={
              <TileSkeleton count={3} className="grid gap-4 sm:grid-cols-3" />
            }
          >
            {data => {
              const upcoming = data
                .filter(e => e.status === "scheduled")
                .slice(0, 3);
              if (upcoming.length === 0) {
                return (
                  <EmptyState
                    icon={CalendarDays}
                    title="ยังไม่มีกิจกรรมในกำหนดการ"
                    description="เมื่อเพิ่มกิจกรรมหรือการนมัสการในกำหนดการ รายการจะแสดงที่นี่"
                    action={{ href: "/events", label: "ไปที่หน้ากิจกรรม" }}
                  />
                );
              }
              return (
                <ul className="grid gap-4 sm:grid-cols-3">
                  {upcoming.map(event => (
                    <li key={event.id}>
                      <Link
                        href="/events"
                        className="block h-full rounded-[var(--radius-lg)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                      >
                        <Card className="h-full gap-3 px-6 transition-colors hover:bg-[var(--color-canvas-soft)]">
                          <p className="type-caption-strong flex items-center gap-2 text-[var(--color-primary)]">
                            <CalendarDays
                              size={ICON_SIZE.sm}
                              aria-hidden="true"
                            />
                            {formatDateTime(event.eventDate)}
                          </p>
                          <p className="type-body-strong line-clamp-2 text-[var(--color-ink)]">
                            {event.title}
                          </p>
                          <p className="type-caption text-[var(--color-body-muted)]">
                            {EVENT_CATEGORY_LABEL[event.category] ??
                              event.category}
                          </p>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              );
            }}
          </QueryView>
        </section>

        {/* Recent activities + the one canonical announcements presentation */}
        <section aria-labelledby="home-recent">
          <SectionHeader
            id="home-recent"
            title="ความเคลื่อนไหวล่าสุด"
            description="สิ่งที่เกิดขึ้นในพันธกิจและข่าวสารจากคริสตจักร"
          />
          <div
            className={`grid gap-4 ${canSeeOperations ? "lg:grid-cols-2" : ""}`}
          >
            {canSeeOperations && (
              <Card className="gap-0 py-0">
                <div className="flex items-center justify-between gap-4 border-b border-[var(--color-divider)] px-6 py-4">
                  <h3 className="type-body-strong flex items-center gap-2 text-[var(--color-ink)]">
                    <Camera
                      size={ICON_SIZE.sm}
                      aria-hidden="true"
                      className="text-[var(--color-primary)]"
                    />
                    กิจกรรมพันธกิจล่าสุด
                  </h3>
                  <Button asChild variant="link" className="h-11 px-2">
                    <Link href="/feed">ดูฟีดทั้งหมด</Link>
                  </Button>
                </div>
                <QueryView
                  state={operations}
                  retry={retryOperations}
                  skeleton={<RowsSkeleton rows={3} />}
                >
                  {data =>
                    data.recentActivity.length === 0 ? (
                      <EmptyState
                        inset
                        icon={Camera}
                        title="ยังไม่มีกิจกรรมพันธกิจที่บันทึกไว้"
                        description="กิจกรรมที่ทีมบันทึกผ่านฟีดจะแสดงที่นี่"
                      />
                    ) : (
                      <ul className="divide-y divide-[var(--color-divider)]">
                        {data.recentActivity.slice(0, 4).map(activity => (
                          <li key={activity.id} className="px-6 py-4">
                            <p className="type-body-strong truncate text-[var(--color-ink)]">
                              {activity.title}
                            </p>
                            <p className="type-caption text-[var(--color-body-muted)]">
                              {activity.groupName ?? "ไม่ระบุกลุ่ม"} ·{" "}
                              {formatDate(activity.occurredAt)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )
                  }
                </QueryView>
              </Card>
            )}

            <Card className="gap-0 py-0">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--color-divider)] px-6 py-4">
                <h3 className="type-body-strong flex items-center gap-2 text-[var(--color-ink)]">
                  <Megaphone
                    size={ICON_SIZE.sm}
                    aria-hidden="true"
                    className="text-[var(--color-primary)]"
                  />
                  ประกาศและข่าวสาร
                </h3>
                <Button asChild variant="link" className="h-11 px-2">
                  <Link href="/announcements">ดูทั้งหมด</Link>
                </Button>
              </div>
              <QueryView
                state={summary}
                retry={retrySummary}
                skeleton={<RowsSkeleton rows={3} />}
              >
                {data =>
                  !data.recentAnnouncements?.length ? (
                    <EmptyState
                      inset
                      icon={Megaphone}
                      title="ยังไม่มีประกาศในขณะนี้"
                      description="ประกาศที่เผยแพร่จะแสดงที่นี่"
                    />
                  ) : (
                    <ul className="divide-y divide-[var(--color-divider)]">
                      {data.recentAnnouncements
                        .slice(0, 4)
                        .map(announcement => (
                          <li key={announcement.id}>
                            <Link
                              href="/announcements"
                              className="flex min-h-11 items-center gap-4 px-6 py-4 outline-none transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-focus)]"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="type-body-strong block truncate text-[var(--color-ink)]">
                                  {announcement.title}
                                </span>
                                <span className="type-caption flex items-center gap-1 text-[var(--color-body-muted)]">
                                  <Clock
                                    size={ICON_SIZE.xs}
                                    aria-hidden="true"
                                  />
                                  {formatDate(announcement.publishDate)}
                                </span>
                              </span>
                              {announcement.status !== "published" && (
                                <StatusChip tone="neutral">ร่าง</StatusChip>
                              )}
                              <ChevronRight
                                size={ICON_SIZE.lg}
                                aria-hidden="true"
                                className="shrink-0 text-[var(--color-body-muted)]"
                              />
                            </Link>
                          </li>
                        ))}
                    </ul>
                  )
                }
              </QueryView>
            </Card>
          </div>
        </section>

        {/* Ministry areas, from the existing /api/ministries resource */}
        <section aria-labelledby="home-ministries">
          <SectionHeader
            id="home-ministries"
            title="พื้นที่พันธกิจ"
            description="พันธกิจที่กำลังดำเนินอยู่และผู้นำที่รับผิดชอบ"
            action={{ href: "/ministries", label: "ดูพันธกิจทั้งหมด" }}
          />
          <QueryView
            state={ministries}
            retry={retryMinistries}
            skeleton={
              <TileSkeleton
                count={3}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              />
            }
          >
            {data => {
              const active = data.filter(m => m.status === "active");
              if (active.length === 0) {
                return (
                  <EmptyState
                    icon={HeartHandshake}
                    title="ยังไม่มีพันธกิจที่เปิดดำเนินการ"
                    description="พันธกิจที่มีสถานะเปิดใช้งานจะแสดงที่นี่"
                    action={{ href: "/ministries", label: "ไปที่หน้าพันธกิจ" }}
                  />
                );
              }
              return (
                <>
                  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {active.slice(0, MINISTRY_PREVIEW_LIMIT).map(ministry => (
                      <li
                        key={ministry.id}
                        className="flex gap-4 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6"
                      >
                        <IconBadge icon={HeartHandshake} />
                        <div className="min-w-0 flex-1">
                          <p className="type-body-strong text-[var(--color-ink)]">
                            {ministry.name}
                          </p>
                          {ministry.leader && (
                            <p className="type-caption text-[var(--color-body-muted)]">
                              ผู้นำ: {ministry.leader}
                            </p>
                          )}
                          {ministry.description && (
                            <p className="type-caption mt-2 line-clamp-2 text-[var(--color-body-muted)]">
                              {ministry.description}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {active.length > MINISTRY_PREVIEW_LIMIT && (
                    <p className="type-caption mt-4 text-[var(--color-body-muted)]">
                      แสดง {MINISTRY_PREVIEW_LIMIT} จาก {active.length} พันธกิจ
                    </p>
                  )}
                </>
              );
            }}
          </QueryView>
        </section>

        {/* People / groups needing attention: decision-oriented counts only */}
        <section aria-labelledby="home-attention">
          <SectionHeader
            id="home-attention"
            title="ผู้คนและกลุ่มที่ต้องดูแล"
            description="รายการที่รอการตัดสินใจหรือการติดตามจากทีม"
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="gap-0 py-0">
              <h3 className="type-body-strong border-b border-[var(--color-divider)] px-6 py-4 text-[var(--color-ink)]">
                สิ่งที่ต้องดูแล
              </h3>
              {canSeeOperations && (
                <QueryView
                  state={operations}
                  retry={retryOperations}
                  skeleton={<RowsSkeleton rows={3} />}
                >
                  {data => (
                    <>
                      <ul className="divide-y divide-[var(--color-divider)] border-b border-[var(--color-divider)]">
                        <AttentionRow
                          href="/inbox"
                          icon={InboxIcon}
                          label="รอตรวจสอบในกล่องข้อมูลนำเข้า"
                          count={data.pendingSubmissionsCount}
                        />
                        <AttentionRow
                          href="/follow-up"
                          icon={ListTodo}
                          label="การติดตามที่ยังไม่เสร็จ"
                          count={data.openFollowUpsCount}
                          detail={
                            data.overdueFollowUpsCount > 0
                              ? `เลยกำหนด ${data.overdueFollowUpsCount.toLocaleString("th-TH")} รายการ`
                              : undefined
                          }
                          alert={data.overdueFollowUpsCount > 0}
                        />
                        <AttentionRow
                          href="/groups"
                          icon={Clock}
                          label="กลุ่มที่ไม่มีกิจกรรมใน 14 วัน"
                          count={data.inactiveGroups.length}
                        />
                      </ul>
                      {data.overdueFollowUps.length > 0 && (
                        <div className="border-b border-[var(--color-divider)] px-6 py-4">
                          <p className="type-caption-strong text-[var(--color-error)]">
                            รายการที่เลยกำหนด
                          </p>
                          <ul className="mt-2 space-y-2">
                            {data.overdueFollowUps.slice(0, 4).map(followUp => (
                              <li
                                key={followUp.id}
                                className="flex items-baseline justify-between gap-4"
                              >
                                <span className="type-caption truncate text-[var(--color-ink)]">
                                  {followUp.title}
                                </span>
                                <span className="type-caption shrink-0 text-[var(--color-body-muted)]">
                                  {followUp.subjectMemberName ??
                                    followUp.subjectGroupName ??
                                    "-"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </QueryView>
              )}
              <QueryView
                state={summary}
                retry={retrySummary}
                skeleton={<RowsSkeleton rows={1} />}
              >
                {data => (
                  <ContactGap
                    followedUp={data.followedUp}
                    needFollowUp={data.needFollowUp}
                    /* The operations endpoint is role-gated, and the query is
                       not even issued for other roles, so its state stays
                       "loading" forever. The member split is still real, so
                       render the bar and just skip the overdue list. */
                    overdue={
                      canSeeOperations && operations.status === "success"
                        ? operations.data.overdueFollowUps
                        : []
                    }
                  />
                )}
              </QueryView>
            </Card>

            <Card className="gap-0 py-0">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--color-divider)] px-6 py-4">
                <h3 className="type-body-strong text-[var(--color-ink)]">
                  สมาชิกใหม่ล่าสุด
                </h3>
                <Button asChild variant="link" className="h-11 px-2">
                  <Link href="/members">ดูทั้งหมด</Link>
                </Button>
              </div>
              <QueryView
                state={summary}
                retry={retrySummary}
                skeleton={<RowsSkeleton rows={4} />}
              >
                {data =>
                  !data.recentMembers?.length ? (
                    <EmptyState
                      inset
                      icon={UserRound}
                      title="ยังไม่มีสมาชิกใหม่"
                      description="สมาชิกที่ลงทะเบียนล่าสุดจะแสดงที่นี่"
                    />
                  ) : (
                    <ul className="divide-y divide-[var(--color-divider)]">
                      {data.recentMembers.map(member => (
                        <li
                          key={member.id}
                          className="flex items-center gap-4 px-6 py-4"
                        >
                          <span
                            aria-hidden="true"
                            className="type-body-strong flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-circle)] bg-[var(--color-canvas-soft)] text-[var(--color-ink)]"
                          >
                            {member.name.slice(0, 1)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="type-body-strong block truncate text-[var(--color-ink)]">
                              {member.name}{" "}
                              {member.nickname ? `(${member.nickname})` : ""}
                            </span>
                            <span className="type-caption block truncate text-[var(--color-body-muted)]">
                              {member.area
                                ? `พื้นที่: ${member.area}`
                                : member.role}
                            </span>
                          </span>
                          <StatusChip
                            tone={
                              member.status === "ติดตามแล้ว"
                                ? "success"
                                : "warning"
                            }
                          >
                            {member.status}
                          </StatusChip>
                        </li>
                      ))}
                    </ul>
                  )
                }
              </QueryView>
            </Card>
          </div>
        </section>

        {/* Discipleship pathway: editorial framework, not analytics */}
        <section aria-labelledby="home-pathway">
          <SectionHeader
            id="home-pathway"
            title="เส้นทางการสร้างสาวก"
            description="กรอบการเดินไปกับผู้คนของคริสตจักร 6 ขั้น — เป็นแนวทาง ไม่ใช่สถิติของสมาชิก"
          />
          <ol className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {DISCIPLESHIP_PATHWAY.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="type-body-strong flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-circle)] border border-[var(--color-primary)] text-[var(--color-primary)]"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 pt-2">
                  <p className="type-body-strong text-[var(--color-ink)]">
                    {step.title}
                  </p>
                  <p className="type-caption text-[var(--color-body-muted)]">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Next action */}
        <section
          aria-labelledby="home-next"
          className="rounded-[var(--radius-lg)] bg-[var(--color-dark-surface)] px-6 py-12 text-[var(--color-on-dark)] sm:px-12"
        >
          <p className="type-caption-strong text-[var(--color-primary-on-dark)]">
            นิมิตและพันธกิจคริสตจักร
          </p>
          <h2 id="home-next" className="type-display-md mt-3 max-w-2xl">
            1 คน นำ 2 คน สู่พระคริสต์ และคริสตจักร
          </h2>
          <p className="type-body mt-4 max-w-2xl text-[var(--color-on-dark)]/70">
            "เพราะคริสตจักร คือ บ้านของทุกคน
            ร่วมสร้างสาวกให้เติบโตในพระวจนะและความรัก"
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              className="bg-[var(--color-primary-on-dark)] text-[var(--color-dark-surface)] hover:bg-[var(--color-primary-on-dark)]/90"
            >
              <Link href="/members">
                <UserPlus aria-hidden="true" />
                เพิ่มสมาชิกใหม่
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-[var(--color-on-dark)]/40 text-[var(--color-on-dark)] hover:bg-[var(--color-on-dark)]/10"
            >
              <Link href="/attendance">
                <UserCheck aria-hidden="true" />
                เช็คชื่อการเข้าร่วม
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
