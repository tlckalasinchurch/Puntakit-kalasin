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

describe("page-level headings", () => {
  it("the route-denied screen renders its title as an h1", () => {
    expect(read("client/src/components/ProtectedRoute.tsx")).toMatch(/headingLevel=\{1\}/);
    expect(read("client/src/components/DesignSystem.tsx")).toMatch(/headingLevel\?: 1 \| 2 \| 3/);
  });

  it("the member home hero title is the page h1", () => {
    expect(read("client/src/components/lamb/LambHero.tsx")).toMatch(/<h1\s+id="lamb-hero-title"/);
  });
});
