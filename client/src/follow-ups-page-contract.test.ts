import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const src = readFileSync(path.resolve(import.meta.dirname, "pages", "FollowUps.tsx"), "utf8");

describe("Follow-ups page list behaviour", () => {
  it("a new filter resets the pager to page 1 as well as reloading page 1", () => {
    expect(src).toMatch(/useEffect\(\(\) => \{[\s\S]*?setPage\(1\);\s*load\(1\);[\s\S]*?\}, \[statusFilter, overdueOnly\]\)/);
  });

  it("filtered-out results get their own empty state with a way to clear the filters", () => {
    expect(src).toMatch(/items\.length === 0 && \(statusFilter \|\| overdueOnly\)/);
    expect(src).toContain("ไม่มีรายการที่ตรงกับตัวกรอง");
    expect(src).toMatch(/label: "ล้างตัวกรอง"[\s\S]*?setStatusFilter\(""\);[\s\S]*?setOverdueOnly\(false\)/);
  });

  it("a status change refreshes in the background instead of swapping the list for a skeleton", () => {
    expect(src).toMatch(/await load\(page, \{ background: true \}\)/);
    expect(src).toMatch(/if \(!background\) \{\s*setIsLoading\(true\)/);
    // a failed background refresh must not wipe the rows
    expect(src).toMatch(/if \(background\) \{\s*toast\.error\(/);
  });

  it("emptying the last page steps back a page instead of showing an empty list", () => {
    expect(src).toMatch(/!res\.data\?\.length && pageToLoad > 1/);
  });
});
