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

  it("the banner exists only when the failure is page-wide, and retries every failed query", () => {
    const banner = failures.slice(failures.indexOf("export function HomeFailureBanner"));
    expect(banner).toMatch(/if \(!ctx \|\| !isPageWideFailure\(Object\.keys\(ctx\.failures\)\)\) return null;/);
    expect(banner).toContain("failed.forEach((f) => f.retry())");
    expect(banner).toContain("<ErrorState");
  });

  it("a section shows its own ErrorState (with retry) unless the banner is up, then a short note", () => {
    // Home's QueryView: the page-wide check comes first, the section's own box stays as the default
    expect(home).toMatch(/state\.status === "error" && pageWide\) return <SectionHeldByBanner \/>;\s*if \(state\.status === "error"\)\s*return \(\s*<ErrorState/);
    expect(home).toMatch(/onRetry=\{retry\}/);
    // HomeMyWork and OrgSnapshot: same shape
    expect(myWork).toMatch(/pageWideFailure \? \(\s*<SectionHeldByBanner[\s\S]*?\) : \(\s*<ErrorState inset[\s\S]*?onRetry=\{\(\) => void load\(\)\}/);
    expect(org).toMatch(/if \(pageWideFailure\) return <SectionHeldByBanner[^>]*\/>;\s*return <ErrorState[^>]*onRetry=/);
  });

  it("the note is not an alert, so the page has one alert for the failure, not one per section", () => {
    const note = failures.slice(failures.indexOf("export function SectionHeldByBanner"));
    expect(note).not.toContain('role="alert"');
    expect(note).toContain("ดูข้อความด้านบน");
  });

  it("reporting cannot loop: an unchanged failure leaves the state untouched", () => {
    expect(failures).toMatch(/current\[key\]\.technical === failure\.technical\) return current;/);
    expect(failures).toMatch(/if \(!\(key in current\)\) return current;/);
  });
});
