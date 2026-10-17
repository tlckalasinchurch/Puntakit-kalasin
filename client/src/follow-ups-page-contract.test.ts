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

describe("Follow-ups page: ways forward from a row", () => {
  it("links a member to the real /members deep link and a care group to /care?group=", () => {
    expect(src).toMatch(/href=\{`\/members\?member=\$\{encodeURIComponent\(row\.subjectMemberId\)\}`\}/);
    expect(src).toMatch(/href=\{`\/care\?group=\$\{encodeURIComponent\(row\.subjectGroupId\)\}`\}/);
    // /care is gated by CREATE_ROLES and only care-level groups are rosters, so everything else stays text
    expect(src).toMatch(/row\.subjectGroupOrgLevel === "care" && canOpenCare/);
    expect(src).toMatch(/canOpenCare = hasRole\(user\?\.role, CREATE_ROLES\)/);
    const routes = readFileSync(path.resolve(import.meta.dirname, "App.tsx"), "utf8");
    expect(routes).toMatch(/path="\/care">\s*<ProtectedRoute allow=\{CREATE_ROLES\}>/);
  });

  it("subject links are 44px touch targets", () => {
    expect(src).toMatch(/SUBJECT_LINK_CLASS =\s*"inline-flex min-h-11/);
  });

  it("shows a tel: button only for open work with a visible number, and says when the number is hidden", () => {
    expect(src).toMatch(/row\.status === "open" \|\| row\.status === "in_progress"\) &&\s*\(row\.subjectMemberPhone \?/);
    expect(src).toMatch(/href=\{`tel:\$\{row\.subjectMemberPhone\}`\}/);
    expect(src).toContain("เบอร์ถูกปิดบัง");
  });

  it("the page reads the phone from the API row; it never fetches members itself", () => {
    expect(src).not.toMatch(/api\.(get|getWithMeta)<[^>]*>\(`\/api\/members/);
  });
});
