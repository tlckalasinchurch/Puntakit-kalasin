import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ErrorState } from "@/components/DesignSystem";
import { PAGE_WIDE_FAILURES, isPageWideFailure } from "./homeFailureRules";
import { useRetryZone } from "./useRetryZone";

/**
 * Home loads several independent things (summary, events, operations, the
 * "my work" overview, the org snapshot) and each section used to draw its own
 * error box. With the API down that was eight identical alerts and eight retry
 * buttons. This keeps the sections independent when ONE query fails, and swaps
 * the pile for a single banner when several fail together.
 */

/** One failed query, as reported by the component that owns it. */
interface Failure {
  retry: () => void;
  technical?: string;
}

/** What one query says about itself. Reported in one piece so "loading" and "failed" never disagree. */
interface QueryReport {
  pending: boolean;
  failure?: Failure;
}

interface HomeFailures {
  failures: Record<string, Failure>;
  /** Queries that are in flight right now. */
  pending: Record<string, true>;
  report: (key: string, entry: QueryReport | null) => void;
}

const HomeFailuresContext = createContext<HomeFailures | null>(null);

export function HomeFailuresProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<Record<string, QueryReport>>({});

  const report = useCallback((key: string, entry: QueryReport | null) => {
    setReports((current) => {
      if (entry === null) {
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key];
        return next;
      }
      // `retry` is a stable wrapper, so an identical report changes nothing and cannot loop.
      const before = current[key];
      if (before && before.pending === entry.pending && Boolean(before.failure) === Boolean(entry.failure) && before.failure?.technical === entry.failure?.technical) {
        return current;
      }
      return { ...current, [key]: entry };
    });
  }, []);

  const value = useMemo<HomeFailures>(() => {
    const failures: Record<string, Failure> = {};
    const pending: Record<string, true> = {};
    for (const [key, entry] of Object.entries(reports)) {
      if (entry.failure) failures[key] = entry.failure;
      if (entry.pending) pending[key] = true;
    }
    return { failures, pending, report };
  }, [reports, report]);
  return <HomeFailuresContext.Provider value={value}>{children}</HomeFailuresContext.Provider>;
}

/**
 * Tells the page whether this query is currently failed (or still in flight). Call it once per
 * query, next to the code that fetches it. Outside the provider it does nothing.
 */
export function useReportFailure(key: string, failed: boolean, retry: () => void, technical?: string, pending = false): void {
  const report = useContext(HomeFailuresContext)?.report;
  const retryRef = useRef(retry);
  retryRef.current = retry;

  useEffect(() => {
    if (!report) return;
    if (!failed && !pending) report(key, null);
    else report(key, { pending, failure: failed ? { retry: () => retryRef.current(), technical } : undefined });
    return () => report(key, null);
  }, [report, key, failed, technical, pending]);
}

/** True while the page-wide banner is showing, i.e. sections should not draw their own error box. */
export function usePageWideFailure(): boolean {
  const ctx = useContext(HomeFailuresContext);
  return ctx ? isPageWideFailure(Object.keys(ctx.failures)) : false;
}

/**
 * The line a finished retry leaves behind. It takes focus (so it is read out once) only when focus
 * was still in the retry area, and goes away when focus leaves it. Not a live region.
 */
export function RecoveredNote({ zone, className = "" }: { zone: Pick<ReturnType<typeof useRetryZone>, "messageRef" | "dismiss">; className?: string }) {
  return (
    <p
      ref={zone.messageRef}
      tabIndex={-1}
      onBlur={zone.dismiss}
      className={`type-caption-strong rounded-[var(--radius-sm)] bg-[var(--color-canvas-soft)] px-3 py-2 text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] ${className}`}
    >
      โหลดสำเร็จแล้ว
    </p>
  );
}

/** The single alert for a page-wide failure, with one retry for every failed query. */
export function HomeFailureBanner() {
  const ctx = useContext(HomeFailuresContext);
  const failedKeys = ctx ? Object.keys(ctx.failures) : [];
  const pageWide = isPageWideFailure(failedKeys);

  // The queries this retry started. The banner is finished when none of them is in flight.
  const retriedRef = useRef<string[]>([]);
  // The banner outlives the failures while the retry runs, so what it shows is remembered.
  const shownRef = useRef<string | undefined>(undefined);
  const loading = ctx ? retriedRef.current.some((key) => key in ctx.pending) : false;

  const zone = useRetryZone({ loading, failed: failedKeys.length }, ({ failed, focusInside, root }) => {
    // One section is still failing, so the banner goes away and its own retry button takes over:
    // hand it the focus rather than leaving it on the banner that is about to unmount.
    if (focusInside && failed > 0 && failed < PAGE_WIDE_FAILURES) {
      // The banner's own button is also an alert's retry button and comes first in the page; skip it.
      const buttons = Array.from(document.querySelectorAll<HTMLElement>('main [role="alert"] button[data-retry]'));
      buttons.find((button) => !root?.contains(button))?.focus();
    }
  });

  if (!ctx) return null;
  if (zone.recovered) {
    return (
      <div ref={zone.rootRef}>
        <RecoveredNote zone={zone} />
      </div>
    );
  }
  if (!pageWide && !zone.busy) return null;

  const failed = Object.values(ctx.failures);
  if (pageWide && !zone.busy) {
    shownRef.current = Array.from(new Set(failed.map((f) => f.technical).filter((t): t is string => Boolean(t)))).join(" · ") || undefined;
  }
  return (
    <div ref={zone.rootRef}>
      <ErrorState
        title="โหลดข้อมูลหน้าแรกไม่สำเร็จหลายส่วน"
        description="ระบบเชื่อมต่อไม่สำเร็จในขณะนี้ ส่วนที่โหลดไม่ได้จะแสดงข้อความสั้น ๆ แทน กรุณาลองอีกครั้ง"
        technical={shownRef.current}
        retryLabel="ลองอีกครั้งทั้งหมด"
        retryBusy={zone.busy}
        onRetry={() => {
          // begin() refuses a second press before React has re-rendered, so requests are not doubled.
          if (!zone.begin()) return;
          retriedRef.current = Object.keys(ctx.failures);
          failed.forEach((f) => f.retry());
        }}
      />
    </div>
  );
}

/** What a section shows in place of its own error box while the banner is up. Not an alert. */
export function SectionHeldByBanner({ className = "px-6 py-5" }: { className?: string }) {
  return <p className={`type-caption text-[var(--color-body-muted)] ${className}`}>ยังแสดงข้อมูลส่วนนี้ไม่ได้ — ดูข้อความด้านบน</p>;
}
