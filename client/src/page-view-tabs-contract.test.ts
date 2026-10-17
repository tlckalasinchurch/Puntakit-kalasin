import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as roleSets from "@shared/roles";
import { USER_ROLES } from "@shared/schema";
import { PAGE_VIEW_GROUPS, isGroupHeadActive, pageViewGroupFor, pageViewTabsFor } from "./lib/pageViews";

const root = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("page-view tab groups", () => {
  it("are exactly the four agreed groups, in order", () => {
    expect(PAGE_VIEW_GROUPS.map((g) => g.tabs.map((t) => t.path))).toEqual([
      ["/groups", "/org", "/ministries", "/map"],
      ["/members", "/memberships"],
      ["/attendance", "/care"],
      ["/feed", "/announcements"],
    ]);
    expect(PAGE_VIEW_GROUPS.map((g) => g.tabs.map((t) => t.label))).toEqual([
      ["พันธกิจ", "ผังองค์กร", "ฝ่ายงาน", "แผนที่"],
      ["สมาชิกทั้งหมด", "สถานะรายปี"],
      ["เช็คชื่อวันนมัสการ", "เช็คชื่อกลุ่มดูแล"],
      ["ฟีดกิจกรรม", "ข่าวประกาศ"],
    ]);
  });

  it("every tab uses the SAME role set as its route's ProtectedRoute in App.tsx (no drift, no new permission)", () => {
    const app = read("client/src/App.tsx");
    const guards = new Map<string, string | undefined>();
    for (const m of app.matchAll(/<Route path="([^"]+)">\s*<ProtectedRoute(?: allow=\{(\w+)\})?>/g)) guards.set(m[1], m[2]);
    for (const group of PAGE_VIEW_GROUPS) {
      for (const tab of group.tabs) {
        expect(guards.has(tab.path), `${tab.path} must be a guarded route in App.tsx`).toBe(true);
        const name = guards.get(tab.path)!;
        expect(name, `${tab.path} must pass an explicit allow set`).toBeDefined();
        expect(tab.roles, `${tab.path} tab roles vs allow={${name}}`).toBe((roleSets as Record<string, unknown>)[name]);
      }
    }
  });
});

describe("pageViewTabsFor", () => {
  const paths = (role: (typeof USER_ROLES)[number], loc: string) => pageViewTabsFor(role, loc).map((t) => t.path);
  const FULL_STRUCTURE = ["/groups", "/org", "/ministries", "/map"];

  it.each(["super_admin", "admin", "staff", "ministry_leader"] as const)("%s sees all four structure tabs", (role) => {
    for (const loc of FULL_STRUCTURE) expect(paths(role, loc)).toEqual(FULL_STRUCTURE);
  });

  it.each(["group_leader", "viewer"] as const)("%s sees the structure tabs without /org (PRIVILEGED_ROLES only)", (role) => {
    expect(paths(role, "/groups")).toEqual(["/groups", "/ministries", "/map"]);
  });

  it("registry tabs need MEMBERSHIP_VIEW_ROLES for the second tab; others get no bar", () => {
    for (const role of ["super_admin", "admin", "staff", "group_leader"] as const) {
      expect(paths(role, "/members")).toEqual(["/members", "/memberships"]);
      expect(paths(role, "/memberships")).toEqual(["/members", "/memberships"]);
    }
    for (const role of ["ministry_leader", "viewer"] as const) expect(paths(role, "/members")).toEqual([]);
  });

  it("check-in tabs need CREATE_ROLES for /care; a viewer gets no bar", () => {
    for (const role of ["super_admin", "admin", "staff", "ministry_leader", "group_leader"] as const) {
      expect(paths(role, "/attendance")).toEqual(["/attendance", "/care"]);
    }
    expect(paths("viewer", "/attendance")).toEqual([]);
  });

  it("feed tabs show for every admin-shell role", () => {
    for (const role of ["super_admin", "admin", "staff", "ministry_leader", "group_leader", "viewer"] as const) {
      expect(paths(role, "/feed")).toEqual(["/feed", "/announcements"]);
    }
  });

  it("never shows a bar to a member, a missing role (session loading) or a page outside every group", () => {
    expect(paths("member", "/groups")).toEqual([]);
    expect(pageViewTabsFor(undefined, "/groups")).toEqual([]);
    expect(paths("admin", "/church")).toEqual([]);
    expect(paths("admin", "/")).toEqual([]);
    expect(pageViewGroupFor("/church")).toBeUndefined();
  });

  it("never returns a single tab: fewer than two reachable pages hides the bar", () => {
    for (const role of USER_ROLES) {
      for (const group of PAGE_VIEW_GROUPS) {
        for (const tab of group.tabs) expect(pageViewTabsFor(role, tab.path).length).not.toBe(1);
      }
    }
  });
});

describe("sidebar active state", () => {
  it("a group head is current on every page of its group, and only that group", () => {
    for (const loc of ["/groups", "/org", "/ministries", "/map"]) expect(isGroupHeadActive("/groups", loc)).toBe(true);
    expect(isGroupHeadActive("/members", "/memberships")).toBe(true);
    expect(isGroupHeadActive("/attendance", "/care")).toBe(true);
    expect(isGroupHeadActive("/feed", "/announcements")).toBe(true);
    expect(isGroupHeadActive("/groups", "/members")).toBe(false);
    expect(isGroupHeadActive("/org", "/org")).toBe(false); // only heads match as groups
  });
});

describe("wiring", () => {
  it("AppLayout renders the bar above the routed page, and the bar renders nothing without tabs", () => {
    const layout = read("client/src/components/layout/AppLayout.tsx");
    expect(layout.indexOf("<PageViewTabs />")).toBeGreaterThan(-1);
    expect(layout.indexOf("<PageViewTabs />")).toBeLessThan(layout.indexOf("<RouteErrorBoundary>{children}"));
    const tabs = read("client/src/components/layout/PageViewTabs.tsx");
    expect(tabs).toMatch(/tabs\.length === 0\) return null/);
    expect(tabs).toContain('aria-current={tab.path === location ? "page" : undefined}');
  });

  it("the bar scrolls inside itself, never the page, and its tabs are >= 44px tall", () => {
    const css = read("client/src/index.css");
    const bar = css.slice(css.indexOf(".pk-view-tabs {"), css.indexOf(".pk-view-tabs::-webkit-scrollbar"));
    expect(bar).toMatch(/overflow-x:\s*auto/);
    expect(bar).toMatch(/max-width:\s*100%/);
    const tab = css.slice(css.indexOf(".pk-view-tab {"), css.indexOf(".pk-view-tab:hover"));
    expect(tab).toMatch(/min-height:\s*44px/);
  });
});
