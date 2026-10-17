import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ErrorState } from "@/components/DesignSystem";
import { isPageWideFailure } from "./homeFailureRules";

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

interface HomeFailures {
  failures: Record<string, Failure>;
  report: (key: string, failure: Failure | null) => void;
}

const HomeFailuresContext = createContext<HomeFailures | null>(null);

export function HomeFailuresProvider({ children }: { children: ReactNode }) {
  const [failures, setFailures] = useState<Record<string, Failure>>({});

  const report = useCallback((key: string, failure: Failure | null) => {
    setFailures((current) => {
      if (failure === null) {
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key];
        return next;
      }
      // `retry` is a stable wrapper, so an identical report changes nothing and cannot loop.
      if (current[key] && current[key].technical === failure.technical) return current;
      return { ...current, [key]: failure };
    });
  }, []);

  const value = useMemo(() => ({ failures, report }), [failures, report]);
  return <HomeFailuresContext.Provider value={value}>{children}</HomeFailuresContext.Provider>;
}

/**
 * Tells the page whether this query is currently failed. Call it once per
 * query, next to the code that fetches it. Outside the provider it does nothing.
 */
export function useReportFailure(key: string, failed: boolean, retry: () => void, technical?: string): void {
  const report = useContext(HomeFailuresContext)?.report;
  const retryRef = useRef(retry);
  retryRef.current = retry;

  useEffect(() => {
    if (!report) return;
    report(key, failed ? { retry: () => retryRef.current(), technical } : null);
    return () => report(key, null);
  }, [report, key, failed, technical]);
}

/** True while the page-wide banner is showing, i.e. sections should not draw their own error box. */
export function usePageWideFailure(): boolean {
  const ctx = useContext(HomeFailuresContext);
  return ctx ? isPageWideFailure(Object.keys(ctx.failures)) : false;
}

/** The single alert for a page-wide failure, with one retry for every failed query. */
export function HomeFailureBanner() {
  const ctx = useContext(HomeFailuresContext);
  // A retry that has been asked for but whose queries have not yet left the failed state: a second
  // activation would send every request twice. The ref covers two clicks before React re-renders.
  const retryingRef = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const failedKeys = ctx ? Object.keys(ctx.failures).join(",") : "";
  useEffect(() => {
    retryingRef.current = false;
    setRetrying(false);
  }, [failedKeys]);
  if (!ctx || !isPageWideFailure(Object.keys(ctx.failures))) return null;

  const failed = Object.values(ctx.failures);
  const technical = Array.from(new Set(failed.map((f) => f.technical).filter((t): t is string => Boolean(t)))).join(" · ");
  return (
    <ErrorState
      title="โหลดข้อมูลหน้าแรกไม่สำเร็จหลายส่วน"
      description="ระบบเชื่อมต่อไม่สำเร็จในขณะนี้ ส่วนที่โหลดไม่ได้จะแสดงข้อความสั้น ๆ แทน กรุณาลองอีกครั้ง"
      technical={technical || undefined}
      retryLabel="ลองอีกครั้งทั้งหมด"
      retryDisabled={retrying}
      onRetry={() => {
        if (retryingRef.current) return;
        retryingRef.current = true;
        setRetrying(true);
        failed.forEach((f) => f.retry());
      }}
    />
  );
}

/** What a section shows in place of its own error box while the banner is up. Not an alert. */
export function SectionHeldByBanner({ className = "px-6 py-5" }: { className?: string }) {
  return <p className={`type-caption text-[var(--color-body-muted)] ${className}`}>ยังแสดงข้อมูลส่วนนี้ไม่ได้ — ดูข้อความด้านบน</p>;
}
