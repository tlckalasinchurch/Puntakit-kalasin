import { ADMIN_SHELL_ROLES, CREATE_ROLES, MEMBERSHIP_VIEW_ROLES, PRIVILEGED_ROLES, hasRole } from "@shared/roles";
import type { UserRole } from "@shared/schema";

/**
 * Pages that work in the same context share one segmented tab bar
 * (`PageViewTabs`). Every route and URL stays as it was: a tab is a link to an
 * existing page, and each tab's `roles` is the SAME set `App.tsx` passes to that
 * route's `ProtectedRoute` (pinned by page-view-tabs-contract.test.ts), so a tab
 * is only shown to someone who can actually open it. The first tab of a group is
 * its head: the one entry the sidebar keeps for the whole group.
 */
export interface PageViewTab {
  path: string;
  label: string;
  roles: readonly UserRole[];
}

export interface PageViewGroup {
  id: string;
  tabs: readonly PageViewTab[];
}

export const PAGE_VIEW_GROUPS: readonly PageViewGroup[] = [
  {
    id: "structure",
    tabs: [
      { path: "/groups", label: "พันธกิจ", roles: ADMIN_SHELL_ROLES },
      { path: "/org", label: "ผังองค์กร", roles: PRIVILEGED_ROLES },
      { path: "/ministries", label: "ฝ่ายงาน", roles: ADMIN_SHELL_ROLES },
      { path: "/map", label: "แผนที่", roles: ADMIN_SHELL_ROLES },
    ],
  },
  {
    id: "registry",
    tabs: [
      { path: "/members", label: "สมาชิกทั้งหมด", roles: ADMIN_SHELL_ROLES },
      { path: "/memberships", label: "สถานะรายปี", roles: MEMBERSHIP_VIEW_ROLES },
    ],
  },
  {
    id: "check-in",
    tabs: [
      { path: "/attendance", label: "เช็คชื่อวันนมัสการ", roles: ADMIN_SHELL_ROLES },
      { path: "/care", label: "เช็คชื่อกลุ่มดูแล", roles: CREATE_ROLES },
    ],
  },
  {
    id: "feed",
    tabs: [
      { path: "/feed", label: "ฟีดกิจกรรม", roles: ADMIN_SHELL_ROLES },
      { path: "/announcements", label: "ข่าวประกาศ", roles: ADMIN_SHELL_ROLES },
    ],
  },
];

export function pageViewGroupFor(location: string): PageViewGroup | undefined {
  return PAGE_VIEW_GROUPS.find((group) => group.tabs.some((tab) => tab.path === location));
}

/**
 * The tabs to show on `location` for `role`. Fewer than two reachable tabs means
 * there is nothing to switch between, so the bar is not shown at all.
 */
export function pageViewTabsFor(role: UserRole | undefined, location: string): PageViewTab[] {
  const group = pageViewGroupFor(location);
  if (!group) return [];
  const tabs = group.tabs.filter((tab) => hasRole(role, tab.roles));
  return tabs.length >= 2 ? tabs : [];
}

/** True when `path` is a group's head entry and `location` is any page of that group. */
export function isGroupHeadActive(path: string, location: string): boolean {
  const group = pageViewGroupFor(location);
  return group !== undefined && group.tabs[0].path === path;
}
