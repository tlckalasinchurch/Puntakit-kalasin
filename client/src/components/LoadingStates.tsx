import { Skeleton } from "@/components/ui/skeleton";

/**
 * LoadingStates — standard skeleton components (see design.md §8).
 *
 * Rules:
 * - Skeleton = page content loading (tables, cards, forms)
 * - Spinner  = short actions only (submit buttons, refresh)
 * - Never use "..." text as a loading substitute
 * - Empty state / error state must be separate from loading
 */

/** Table skeleton — for Members, Attendance roster */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4" data-testid="skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-3.5">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
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
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** List skeleton — for announcement/event/attendance lists (single column) */
export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" data-testid="skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
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
    <div className="space-y-5" data-testid="skeleton">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded-xl" />
    </div>
  );
}

/** KPI stat skeleton — for Dashboard metric numbers */
export function KPISkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="tailadmin-card flex items-center gap-4 p-5" data-testid="skeleton">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="flex-1 space-y-2">
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
    <div className="profile-page" data-testid="skeleton">
      <div className="page-heading">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-3.5 w-72" />
        </div>
      </div>
      <section className="profile-hero card-surface">
        <Skeleton className="profile-avatar" />
        <div className="profile-identity space-y-2.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3.5 w-64" />
        </div>
      </section>
      <div className="profile-grid">
        <section className="profile-panel card-surface space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </section>
        <section className="profile-panel card-surface space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24 w-full" />
        </section>
      </div>
    </div>
  );
}

/** Dashboard skeleton — top metrics + chart placeholder */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" data-testid="skeleton">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPISkeleton count={4} />
      </div>
      <div className="tailadmin-card p-6 space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
