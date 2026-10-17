import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { BadgeCheck, Camera, ClipboardCheck, ListTodo } from "lucide-react";
import { ErrorState, StatusChip } from "@/components/DesignSystem";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { CREATE_ROLES, MEMBERSHIP_VIEW_ROLES, hasRole } from "@shared/roles";
import type { HomeLink } from "@/lib/homeLinks";
import { HOME_TILE_HREF, homeTilesFor, homeMoreLinksFor, type HomeTileId } from "@/lib/homeTiles";
import { MissionPhotoSheet } from "./MissionPhotoSheet";
import { SectionHeldByBanner, usePageWideFailure, useReportFailure } from "./homeFailures";

interface Overview {
  scopeLabel: string;
  scopeIsWholeChurch: boolean;
  counts: { groups: number; members: number; activitiesLast30Days: number; openFollowUps: number };
  photoGroups: Array<{ id: string; name: string }>;
  membership: { attention: number; trialReview: number; unpaid: number } | null;
  recentPhotos: Array<{ activityId: string; title: string; occurredAt: string; groupName: string | null; url: string }>;
}

// Look and sizing live in the `.pk-home-tile*` block at the end of index.css.
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
      <span aria-hidden="true" className="pk-home-tile__icon">
        <Icon size={32} aria-hidden="true" />
      </span>
      <span className="pk-home-tile__text">
        <span className="pk-home-tile__title">{title}</span>
        {hint && <span className="pk-home-tile__hint">{hint}</span>}
      </span>
      {badge && (
        <StatusChip tone="warning" className="pk-home-tile__badge">
          {/* "3 ต้องดำเนินการ": the line may break after the number, never inside the words. */}
          <span>{badge.split(" ")[0]}</span>
          <span className="whitespace-nowrap">{badge.split(" ").slice(1).join(" ")}</span>
        </StatusChip>
      )}
    </>
  );
  return href ? (
    <Link href={href} className="pk-home-tile">
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className="pk-home-tile">
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
export function HomeMyWork({ extraLinks = [] }: { extraLinks?: HomeLink[] }) {
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

  // Lets Home tell "this one query failed" from "several failed together" (one banner then).
  const pageWideFailure = usePageWideFailure();
  useReportFailure("overview", error !== null, () => void load(), error ? (error.serverMessage ?? error.message) : undefined);

  const canSeeMembership = hasRole(user?.role, MEMBERSHIP_VIEW_ROLES);
  const canPostPhotos = hasRole(user?.role, CREATE_ROLES);
  const { primary: tiles } = homeTilesFor(user?.role);
  const moreLinks = homeMoreLinksFor(user?.role);

  const attention = data?.membership?.attention ?? 0;
  const openFollowUps = data?.counts.openFollowUps ?? 0;
  const tileView: Record<HomeTileId, { icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" }>; title: string; hint: string; badge?: string; onClick?: () => void }> = {
    care: { icon: ClipboardCheck, title: "เช็คชื่อกลุ่มดูแล", hint: "ประจำสัปดาห์" },
    photo: { icon: Camera, title: "อัปเดตภาพพันธกิจ", hint: "ถ่ายหรือเลือกรูป", onClick: () => setSheetOpen(true) },
    membership: { icon: BadgeCheck, title: "สถานะสมาชิก", hint: "วิสามัญ · ต่ออายุ", badge: attention > 0 ? `${attention} ต้องดำเนินการ` : undefined },
    followUp: { icon: ListTodo, title: "การติดตาม", hint: "ที่ต้องดูแลต่อ", badge: openFollowUps > 0 ? `${openFollowUps} รายการ` : undefined },
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="home-quick">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="home-quick" className="type-lead text-[var(--color-ink)]">
            ทำต่อได้เลย
          </h2>
          {moreLinks.length > 0 && (
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-controls="home-more-links"
              onClick={() => setMoreOpen((v) => !v)}
              className="type-caption-strong inline-flex min-h-11 items-center px-1 text-[var(--color-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
            >
              {moreOpen ? "ซ่อน" : "ดูทั้งหมด"}
            </button>
          )}
        </div>
        <div className="pk-home-tiles" data-count={tiles.length}>
          {tiles.map((id) => (
            <Tile key={id} {...tileView[id]} href={HOME_TILE_HREF[id] ?? undefined} />
          ))}
        </div>
        {moreOpen && moreLinks.length > 0 && (
          <ul id="home-more-links" className="mt-3 flex flex-wrap gap-2" aria-label="ทางลัดอื่น ๆ">
            {moreLinks.map((l) => (
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

      {error ? (
        pageWideFailure ? (
          <SectionHeldByBanner className="px-0 py-2" />
        ) : (
          <ErrorState inset title="โหลดข้อมูลของคุณไม่สำเร็จ" description={error.message} technical={error.serverMessage} onRetry={() => void load()} />
        )
      ) : (
        <>

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
        </>
      )}

      {canPostPhotos && <MissionPhotoSheet open={sheetOpen} onClose={() => setSheetOpen(false)} groups={data?.photoGroups ?? []} onSaved={() => void load()} />}
    </div>
  );
}
