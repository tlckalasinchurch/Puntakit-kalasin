import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";

/**
 * Navigation contract for the admin shell. Source-level on purpose, like the
 * other contract tests: it pins the decisions that must not drift silently.
 *
 * - Menu visibility is a UX affordance only; route authorization stays on the
 *   server and in `ProtectedRoute` (hiding an entry never protects a route).
 * - Role-specific menus (group_leader) and the super_admin-only
 *   "ผู้ใช้และสิทธิ์" entry predate this contract and must survive restyling.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), "utf8");
const sidebar = read("client/src/components/layout/Sidebar.tsx");
const bottomNav = read("client/src/components/layout/MobileBottomNav.tsx");

/** The object literal that declares a nav destination by its path. */
const entry = (src: string, route: string): string => {
  const at = src.indexOf(`path: "${route}"`);
  expect(at, `${route} entry missing`).toBeGreaterThan(-1);
  const start = src.lastIndexOf("{", at);
  const end = src.indexOf("}", at);
  return src.slice(start, end + 1);
};

describe("admin navigation contract", () => {
  it("uses distinct labels for the two check-in destinations", () => {
    expect(entry(sidebar, "/care")).toContain('label: "เช็คชื่อกลุ่มดูแล"');
    expect(entry(sidebar, "/attendance")).toContain('label: "เช็คชื่อวันนมัสการ"');
    // The old, easily confused labels are gone from the admin menu.
    expect(sidebar).not.toContain('label: "เช็คชื่อพันธกิจ"');
    expect(sidebar).not.toContain('label: "เช็คชื่อนมัสการ"');
  });

  it("labels /events as กิจกรรม and keeps the /worship alias active", () => {
    expect(entry(sidebar, "/events")).toContain('label: "กิจกรรม"');
    expect(sidebar).toMatch(/path === "\/events" && location === "\/worship"/);
  });

  it("shows the member app entry to admin roles only (menu visibility, not authorization)", () => {
    expect(entry(sidebar, "/app")).toContain("roles: ADMIN_ROLES");
    expect(sidebar).toMatch(/import \{[^}]*\bADMIN_ROLES\b[^}]*\} from "@shared\/roles"/);
  });

  it("keeps the existing role gates on /care, /attendance and /admin/users", () => {
    expect(entry(sidebar, "/care")).toContain("roles: CREATE_ROLES");
    expect(entry(sidebar, "/attendance")).not.toContain("roles:");
    expect(entry(sidebar, "/admin/users")).toContain("roles: SUPER_ADMIN_ROLES");
  });

  it("names the member app entry แอปสมาชิก", () => {
    expect(entry(sidebar, "/app")).toContain('label: "แอปสมาชิก"');
  });

  it("titles each page the same way its menu entry names it", () => {
    const care = read("client/src/pages/CareToday.tsx");
    expect(care).toContain('usePageTitle("เช็คชื่อกลุ่มดูแล")');
    expect(care).toContain('<PageHeader title="เช็คชื่อกลุ่มดูแล"');
    const attendance = read("client/src/pages/Attendance.tsx");
    expect(attendance).toContain('usePageTitle("เช็คชื่อวันนมัสการ")');
    expect(attendance).toContain('title="เช็คชื่อวันนมัสการ"');
    const events = read("client/src/pages/Events.tsx");
    expect(events).toContain('usePageTitle("กิจกรรม")');
    expect(events).toMatch(/<PageHeader\s+title="กิจกรรม"/);
    expect(events).not.toContain("การนมัสการ / กิจกรรม");
  });

  it("keeps the focused group_leader menu and bottom nav", () => {
    expect(sidebar).toMatch(/export const groupLeaderNavGroups/);
    expect(sidebar).toMatch(
      /user\?\.role === "group_leader" \? groupLeaderNavGroups : navGroups/
    );
    expect(bottomNav).toMatch(/isGroupLeader/);
    expect(bottomNav).toContain('"งานวันนี้"');
  });
});
