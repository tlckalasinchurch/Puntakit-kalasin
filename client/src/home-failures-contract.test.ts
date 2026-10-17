import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PAGE_WIDE_FAILURES, isPageWideFailure } from "./components/home/homeFailureRules";

const root = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const home = read("client/src/pages/Home.tsx");
const myWork = read("client/src/components/home/HomeMyWork.tsx");
const org = read("client/src/components/OrgSnapshot.tsx");
const failures = read("client/src/components/home/homeFailures.tsx");

describe("Home failures: when does a failure become page-wide", () => {
  it("one failing query stays a section's own problem; two different ones are the page's", () => {
    expect(PAGE_WIDE_FAILURES).toBe(2);
    expect(isPageWideFailure([])).toBe(false);
    expect(isPageWideFailure(["summary"])).toBe(false);
    expect(isPageWideFailure(["summary", "events"])).toBe(true);
    expect(isPageWideFailure(["operations", "org", "overview"])).toBe(true);
  });

  it("counts distinct queries, not the sections that read them (summary feeds three sections)", () => {
    expect(isPageWideFailure(["summary", "summary", "summary"])).toBe(false);
  });
});

describe("Home failures: every Home query reports, once", () => {
  it("the three page queries report under their own keys", () => {
    expect(home).toMatch(/useHomeQuery<DashboardSummary>\(\s*"\/api\/dashboard\/summary",\s*"summary"\s*\)/);
    expect(home).toMatch(/useHomeQuery<ChurchEvent\[\]>\("\/api\/events", "events"\)/);
    expect(home).toMatch(/"\/api\/dashboard\/operations" : null,\s*"operations"/);
    // reported inside the hook, i.e. once per query, not once per section that reads it
    expect(home).toMatch(/useReportFailure\(key, state\.status === "error"/);
    expect(home).toContain('path !== null && state.status === "loading"');
  });

  it("the my-work overview and the org snapshot report too", () => {
    expect(myWork).toContain('useReportFailure("overview"');
    expect(org).toContain('useReportFailure("org"');
  });
});

describe("Home failures: one banner for several failures, section errors for one", () => {
  it("Home puts its content inside the provider and renders the banner first", () => {
    expect(home).toMatch(/<HomeFailuresProvider>\s*<HomeContent \/>\s*<\/HomeFailuresProvider>/);
    expect(home.indexOf("<HomeFailureBanner />")).toBeGreaterThan(home.indexOf('className="home-editorial'));
    expect(home.indexOf("<HomeFailureBanner />")).toBeLessThan(home.indexOf('aria-labelledby="home-title"'));
  });

  it("the banner exists only when the failure is page-wide (or its retry is running), and retries every failed query", () => {
    const banner = failures.slice(failures.indexOf("export function HomeFailureBanner"));
    expect(banner).toContain("const pageWide = isPageWideFailure(failedKeys);");
    expect(banner).toContain("if (!pageWide && !zone.busy) return null;");
    expect(banner).toContain("failed.forEach((f) => f.retry())");
    expect(banner).toContain("<ErrorState");
  });

  it("a section shows its own ErrorState (with retry) unless the banner is up, then a short note", () => {
    // Home's QueryView: the page-wide check comes first, the section's own box stays as the default
    expect(home).toMatch(/state\.status === "error" && pageWide\) return <SectionHeldByBanner \/>;\s*if \(state\.status === "error"\) return errorBox\(state\);/);
    expect(home).toMatch(/onRetry=\{\(\) => \{\s*if \(zone\.begin\(\)\) retry\(\);/);
    // HomeMyWork and OrgSnapshot: same shape
    expect(myWork).toMatch(/pageWideFailure \? <SectionHeldByBanner[^>]*\/> : errorBox\(error\)/);
    expect(org).toMatch(/if \(pageWideFailure\) return <SectionHeldByBanner[^>]*\/>;\s*return errorBox\(error\);/);
  });

  it("the note is not an alert, so the page has one alert for the failure, not one per section", () => {
    const note = failures.slice(failures.indexOf("export function SectionHeldByBanner"));
    expect(note).not.toContain('role="alert"');
    expect(note).toContain("ดูข้อความด้านบน");
  });

  it("reporting cannot loop: an unchanged report leaves the state untouched", () => {
    expect(failures).toMatch(/before\.pending === entry\.pending[\s\S]*?before\.failure\?\.technical === entry\.failure\?\.technical\) \{\s*return current;/);
    expect(failures).toMatch(/if \(!\(key in current\)\) return current;/);
  });

  it("'loading' and 'failed' are reported in one piece, so the banner never reads a half-updated query", () => {
    expect(failures).toMatch(/report\(key, \{ pending, failure: failed \? \{ retry: \(\) => retryRef\.current\(\), technical \} : undefined \}\)/);
    // no separate report channel for pending
    expect(failures).not.toMatch(/reportPending|setPending/);
  });
});

describe("Home failures: retry cannot fire twice, and focus is kept (P3-2, R1)", () => {
  it("every retry area goes through useRetryZone().begin(), which refuses a second press", () => {
    const hook = read("client/src/components/home/useRetryZone.ts");
    expect(hook).toMatch(/if \(phaseRef\.current !== "idle"\) return false;\s*phaseRef\.current = WAITING;/);
    expect(failures).toMatch(/if \(!zone\.begin\(\)\) return;\s*retriedRef\.current = Object\.keys\(ctx\.failures\);\s*failed\.forEach\(\(f\) => f\.retry\(\)\)/);
    expect(home).toMatch(/if \(zone\.begin\(\)\) retry\(\);/);
    expect(myWork).toMatch(/if \(zone\.begin\(\)\) void load\(\);/);
    expect(org).toMatch(/if \(zone\.begin\(\)\) setAttempt\(\(n\) => n \+ 1\);/);
  });

  it("the retry button stays focusable while busy (aria-disabled, never disabled) and ignores presses", () => {
    const ds = read("client/src/components/DesignSystem.tsx");
    expect(ds).toContain("aria-disabled={retryBusy || undefined}");
    expect(ds).toMatch(/if \(!retryBusy\) onRetry\(\);/);
    expect(ds).not.toContain("disabled={retryDisabled}");
    expect(failures).toContain("retryBusy={zone.busy}");
  });

  it("the retry area stays mounted while the retry runs, then hands focus to the recovered note", () => {
    expect(home).toContain("if (zone.busy && lastError.current) return errorBox(lastError.current);");
    expect(myWork).toContain("zone.busy && lastError.current ? (");
    expect(org).toContain("if (zone.busy && lastError.current) return errorBox(lastError.current);");
    const hook = read("client/src/components/home/useRetryZone.ts");
    expect(hook).toMatch(/if \(phase === "recovered"\) messageRef\.current\?\.focus\(\);/);
    // decided in a layout effect, while the button that has focus is still in the DOM
    expect(hook).toContain("useLayoutEffect(");
    expect(hook).toContain("rootRef.current?.contains(document.activeElement)");
  });

  it("announces success once: the note is focused, and no new live region is added", () => {
    // the one mention of role="alert" is the selector that finds an existing alert's retry button
    const withoutSelector = failures.replace(/main \[role="alert"\] button\[data-retry\]/, "");
    for (const source of [withoutSelector, read("client/src/components/home/useRetryZone.ts")]) {
      expect(source).not.toMatch(/aria-live|role="status"|role="alert"/);
    }
    expect(failures).toContain("โหลดสำเร็จแล้ว");
    expect(failures).toMatch(/tabIndex=\{-1\}\s*onBlur=\{zone\.dismiss\}/);
  });

  it("when one failure is left the banner hands focus to that section's retry button", () => {
    expect(failures).toMatch(/focusInside && failed > 0 && failed < PAGE_WIDE_FAILURES/);
    expect(failures).toContain(`main [role="alert"] button[data-retry]`);
    expect(read("client/src/components/DesignSystem.tsx")).toContain("data-retry");
  });
});
