import { Skeleton } from "@/components/ui/skeleton";

/**
 * LoadingStates — standard skeleton components (see design.md §8).
 *
 * Rules:
 * - Skeleton = page content loading (tables, cards, forms)
 * - Spinner  = short actions only (submit buttons, refresh)
 * - Never use "..." text as a loading substitute
 * - Empty state / error state must be separate from loading
 *
 * Every skeleton here mirrors the token surfaces it stands in for
 * (`--color-canvas` / `--color-hairline`), so the placeholder does not jump
 * colour when the real content arrives, and dark mode needs no special case.
 */

const CARD =
  "rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]";

/** Table skeleton — for Members, Attendance roster */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4" data-testid="skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5`}
        >
          <Skeleton className="size-11 shrink-0 rounded-[var(--radius-circle)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 rounded-[var(--radius-pill)]" />
        </div>
      ))}
    </div>
  );
}

/** Card grid skeleton — for Groups, Events, Announcements, Ministries */
export function CardGridSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 ${className ?? ""}`}
      data-testid="skeleton"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${CARD} space-y-3 p-5`}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 shrink-0 rounded-[var(--radius-md)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-6 w-16 rounded-[var(--radius-pill)]" />
            <Skeleton className="h-6 w-20 rounded-[var(--radius-pill)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** List skeleton — for announcement/event/attendance lists (single column) */
export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" data-testid="skeleton" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${CARD} flex items-start gap-3 p-4`}>
          <Skeleton className="size-11 shrink-0 rounded-[var(--radius-md)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Form skeleton — for Church profile, settings-like pages */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-5" data-testid="skeleton" aria-hidden="true">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-11 w-full rounded-[var(--radius-md)]" />
        </div>
      ))}
      <Skeleton className="h-11 w-32 rounded-[var(--radius-pill)]" />
    </div>
  );
}

/** KPI stat skeleton — for Dashboard metric numbers */
export function KPISkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${CARD} flex items-center gap-4 p-5`}
          data-testid="skeleton"
          aria-hidden="true"
        >
          <Skeleton className="size-11 shrink-0 rounded-[var(--radius-md)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
      ))}
    </>
  );
}

/** Profile skeleton — for Profile page (hero + details panels) */
export function ProfileSkeleton() {
  return (
    <div className="space-y-6" data-testid="skeleton" aria-hidden="true">
      <div className="space-y-3">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </div>
      <div className={`${CARD} flex flex-col items-center gap-4 p-6 sm:flex-row`}>
        <Skeleton className="size-20 shrink-0 rounded-[var(--radius-circle)]" />
        <div className="w-full space-y-2.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3.5 w-64 max-w-full" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${CARD} space-y-4 p-6`}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-11 w-full rounded-[var(--radius-md)]" />
          <Skeleton className="h-11 w-full rounded-[var(--radius-md)]" />
          <Skeleton className="h-11 w-full rounded-[var(--radius-md)]" />
        </div>
        <div className={`${CARD} space-y-4 p-6`}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24 w-full rounded-[var(--radius-md)]" />
        </div>
      </div>
    </div>
  );
}

/** Dashboard skeleton — top metrics + chart placeholder */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" data-testid="skeleton" aria-hidden="true">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPISkeleton count={4} />
      </div>
      <div className={`${CARD} space-y-4 p-6`}>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-64 w-full rounded-[var(--radius-md)]" />
      </div>
    </div>
  );
}
