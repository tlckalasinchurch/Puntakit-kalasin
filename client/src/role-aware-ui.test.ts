import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("role-aware member UI", () => {
  it("the member home map card is limited to roles that can open /map", () => {
    const src = read("client/src/components/lamb/LambSecondaryCards.tsx");
    // /map is gated by ADMIN_SHELL_ROLES in App.tsx; a member would be bounced back to /app.
    expect(read("client/src/App.tsx")).toMatch(/path="\/map">\s*<ProtectedRoute allow=\{ADMIN_SHELL_ROLES\}>/);
    expect(src).toMatch(/href: "\/map"[\s\S]*?roles: ADMIN_SHELL_ROLES/);
    expect(src).toMatch(/hasRole\(user\?\.role, card\.roles/);
  });

  it("no member page links to the unbuilt /app/reports/new route", () => {
    for (const rel of [
      "client/src/components/lamb/LambHero.tsx",
      "client/src/pages/member/MemberReports.tsx",
      "client/src/pages/member/MemberHome.tsx",
    ]) {
      expect(read(rel)).not.toContain("/app/reports/new");
    }
    expect(read("client/src/App.tsx")).not.toContain("/app/reports/new");
  });
});

describe("toasts", () => {
  it("mobile toasts are lifted above the fixed bottom nav", () => {
    expect(read("client/src/App.tsx")).toMatch(/<Toaster mobileOffset=\{\{ bottom: "calc\(env\(safe-area-inset-bottom\) \+ 80px\)"/);
  });
});

describe("date picker", () => {
  it("overrides rdp's blue chevrons and 36px nav so the calendar is 44px and on-brand", () => {
    expect(read("client/src/index.css")).toMatch(/\.rdp-root \.rdp-chevron\s*\{\s*fill:\s*none;/);
    const field = read("client/src/components/DateField.tsx");
    for (const v of ["--rdp-nav_button-width", "--rdp-day_button-height", "--rdp-today-color"]) {
      expect(field).toContain(v);
    }
  });
});

describe("page-level headings", () => {
  it("the route-denied screen renders its title as an h1", () => {
    expect(read("client/src/components/ProtectedRoute.tsx")).toMatch(/headingLevel=\{1\}/);
    expect(read("client/src/components/DesignSystem.tsx")).toMatch(/headingLevel\?: 1 \| 2 \| 3/);
  });

  it("the member home hero title is the page h1", () => {
    expect(read("client/src/components/lamb/LambHero.tsx")).toMatch(/<h1\s+id="lamb-hero-title"/);
  });
});

describe("user-facing copy", () => {
  it("import page buttons do not expose database table names", () => {
    expect(read("client/src/pages/ImportData.tsx")).not.toMatch(/ตรวจสอบ group_members/);
  });
});

describe("home quick actions contract (RBP-01)", () => {
  it("HomeMyWork delegates tile and secondary link computation to lib/homeTiles without inline role lists", () => {
    const src = read("client/src/components/home/HomeMyWork.tsx");
    expect(src).toContain("homeTilesFor(user?.role)");
    expect(src).toContain("homeMoreLinksFor(user?.role)");
    // Role names live in shared/roles.ts sets, never in the component or in lib/homeTiles.
    const roleLiteral = /"(super_admin|admin|staff|ministry_leader|group_leader|viewer|member)"/;
    expect(src).not.toMatch(roleLiteral);
    expect(read("client/src/lib/homeTiles.ts")).not.toMatch(roleLiteral);
    // Does not call un-scoped summary API
    expect(src).not.toContain("/api/dashboard/summary");
    // Only relies on /api/home/overview
    expect(src).toContain("/api/home/overview");
  });
});
