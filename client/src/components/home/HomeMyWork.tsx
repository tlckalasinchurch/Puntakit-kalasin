import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { BadgeCheck, Camera, ClipboardCheck, ListTodo } from "lucide-react";
import { ErrorState, StatusChip } from "@/components/DesignSystem";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { CREATE_ROLES, MEMBERSHIP_VIEW_ROLES, hasRole } from "@shared/roles";
import { MissionPhotoSheet } from "./MissionPhotoSheet";

interface Overview {
  scopeLabel: string;
  scopeIsWholeChurch: boolean;
  counts: { groups: number; members: number; activitiesLast30Days: number; openFollowUps: number };
  photoGroups: Array<{ id: string; name: string }>;
  membership: { attention: number; trialReview: number; unpaid: number } | null;
  recentPhotos: Array<{ activityId: string; title: string; occurredAt: string; groupName: string | null; url: string }>;
}

const SECONDARY_LINKS: Array<{ href: string; label: string }> = [
  { href: "/members", label: "สมาชิก" },
  { href: "/groups", label: "พันธกิจ" },
  { href: "/attendance", label: "เช็คชื่อวันนมัสการ" },
  { href: "/events", label: "กิจกรรม" },
  { href: "/feed", label: "ฟีดกิจกรรม" },
  { href: "/announcements", label: "การประกาศ" },
  { href: "/map", label: "แผนที่พันธกิจ" },
];

const TILE =
  "group flex min-h-28 flex-col justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4 text-left transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

function Tile({
  icon: Icon,
  title,
  hint,
  badge,
  onClick,
  href,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean | "true" }>;
  title: string;
  hint?: string;
  badge?: string;
  onClick?: () => void;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-accent-soft)] text-[var(--color-primary)]">
          <Icon size={26} aria-hidden="true" />
        </span>
        {badge && <StatusChip tone="warning">{badge}</StatusChip>}
      </span>
      <span>
        <span className="type-body-strong block text-[var(--color-ink)]">{title}</span>
        {hint && <span className="type-fine mt-0.5 block text-[var(--color-body-muted)]">{hint}</span>}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className={TILE}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={TILE}>
      {body}
    </button>
  );
}

/**
 * The top of the home page: the few things this person does most (large,
 * thumb-sized), the numbers for their own scope, and the latest photos they
 * may see. Every number comes from `GET /api/home/overview`, which counts only
 * rows that exist inside the role's scope — there is no weekly-report data in
 * the system yet, so none is implied.
 */
export function HomeMyWork() {
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api.get<Overview>("/api/home/overview"));
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("โหลดข้อมูลหน้าแรกไม่สำเร็จ", 0));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canCheckIn = hasRole(user?.role, CREATE_ROLES);
  const canSeeMembership = hasRole(user?.role, MEMBERSHIP_VIEW_ROLES);
  const canPostPhotos = canCheckIn;

  if (error) {
    return <ErrorState inset title="โหลดข้อมูลของคุณไม่สำเร็จ" description={error.message} technical={error.serverMessage} onRetry={() => void load()} />;
  }

  const attention = data?.membership?.attention ?? 0;

  return (
    <div className="space-y-8">
      <section aria-labelledby="home-quick">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="home-quick" className="type-lead text-[var(--color-ink)]">
            ทำต่อได้เลย
          </h2>
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="home-more-links"
            onClick={() => setMoreOpen((v) => !v)}
            className="type-caption-strong inline-flex min-h-11 items-center px-1 text-[var(--color-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
          >
            {moreOpen ? "ซ่อน" : "ดูทั้งหมด"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {canCheckIn && <Tile icon={ClipboardCheck} title="เช็คชื่อกลุ่มดูแล" hint="ประจำสัปดาห์" href="/care" />}
          {canPostPhotos && <Tile icon={Camera} title="อัปเดตภาพพันธกิจ" hint="ถ่ายหรือเลือกรูป" onClick={() => setSheetOpen(true)} />}
          {canSeeMembership && (
            <Tile icon={BadgeCheck} title="สถานะสมาชิก" hint="วิสามัญ · ต่ออายุ" badge={attention > 0 ? `${attention} ต้องดำเนินการ` : undefined} href="/memberships" />
          )}
          <Tile
            icon={ListTodo}
            title="การติดตาม"
            hint="ที่ต้องดูแลต่อ"
            badge={data && data.counts.openFollowUps > 0 ? `${data.counts.openFollowUps} รายการ` : undefined}
            href="/follow-up"
          />
        </div>
        {moreOpen && (
          <ul id="home-more-links" className="mt-3 flex flex-wrap gap-2" aria-label="ทางลัดอื่น ๆ">
            {SECONDARY_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="type-caption-strong inline-flex min-h-11 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-[var(--color-ink)] hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="home-stats">
        <h2 id="home-stats" className="type-lead mb-1 text-[var(--color-ink)]">
          {data ? data.scopeLabel : "สถิติของฉัน"}
        </h2>
        <p className="type-fine mb-3 text-[var(--color-body-muted)]">
          นับจากทะเบียนสมาชิกและฟีดที่มีอยู่จริงในขอบเขตของคุณ — ระบบยังไม่มีรายงานรายสัปดาห์
        </p>
        {!data ? (
          <div role="status" aria-label="กำลังโหลดสถิติ" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-[var(--radius-lg)]" />
            ))}
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              [
                [data.scopeIsWholeChurch ? "พันธกิจทั้งหมด" : "กลุ่มในความรับผิดชอบ", data.counts.groups, "กลุ่ม"],
                ["สมาชิก", data.counts.members, "คน"],
                ["กิจกรรมใน 30 วัน", data.counts.activitiesLast30Days, "ครั้ง"],
                canSeeMembership ? ["สมาชิกที่ต้องดำเนินการ", attention, "คน"] : ["การติดตามของฉัน", data.counts.openFollowUps, "รายการ"],
              ] as Array<[string, number, string]>
            ).map(([label, value, unit]) => (
              <div key={label} className="rounded-[var(--radius-lg)] bg-[var(--color-canvas-soft)] p-4">
                <dt className="type-caption text-[var(--color-text-secondary)]">{label}</dt>
                <dd className="mt-1 flex items-baseline gap-1.5">
                  <span className="type-display-md tabular-nums text-[var(--color-ink)]">{value.toLocaleString("th-TH")}</span>
                  <span className="type-caption text-[var(--color-body-muted)]">{unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {data && (data.recentPhotos.length > 0 || canPostPhotos) && (
        <section aria-labelledby="home-photos">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 id="home-photos" className="type-lead text-[var(--color-ink)]">
              ภาพพันธกิจล่าสุด
            </h2>
            {data.recentPhotos.length > 0 && (
              <Link href="/feed" className="type-caption-strong inline-flex min-h-11 items-center px-1 text-[var(--color-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]">
                ดูทั้งหมด
              </Link>
            )}
          </div>
          {data.recentPhotos.length === 0 ? (
            <p className="type-caption text-[var(--color-body-muted)]">ยังไม่มีภาพ — กด “อัปเดตภาพพันธกิจ” เพื่อเพิ่มภาพแรก</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {data.recentPhotos.map((p) => (
                <li key={p.activityId}>
                  <Link href="/feed" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] rounded-[var(--radius-lg)]">
                    <img src={p.url} alt={p.title} loading="lazy" className="aspect-square w-full rounded-[var(--radius-lg)] bg-[var(--color-canvas-soft)] object-cover" />
                    <span className="type-fine mt-1 block truncate text-[var(--color-text-secondary)]">{p.groupName ?? p.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {canPostPhotos && <MissionPhotoSheet open={sheetOpen} onClose={() => setSheetOpen(false)} groups={data?.photoGroups ?? []} onSaved={() => void load()} />}
    </div>
  );
}
