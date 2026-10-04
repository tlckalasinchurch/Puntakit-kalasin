import {
  BarChart3,
  FileSpreadsheet,
  Building2,
  CalendarDays,
  Camera,
  HeartHandshake,
  Home as HomeIcon,
  Inbox as InboxIcon,
  ListChecks,
  ListTodo,
  MapPin,
  Megaphone,
  Network,
  Sparkles,
  UserCheck,
  UserRound,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { CREATE_ROLES, PRIVILEGED_ROLES, hasRole } from "@shared/roles";
import type { UserRole } from "@shared/schema";
import { Logo } from "./Logo";

export interface NavGroup {
  name: string;
  items: {
    label: string;
    path: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    /**
     * Roles allowed to use this destination. Omitted means "every signed-in
     * role". These sets mirror the server gates in `server/routes/` via
     * `shared/roles.ts` — they are a UX affordance only, never the
     * authorization itself (the server still returns 401/403 on its own).
     */
    roles?: readonly UserRole[];
  }[];
}

/**
 * Navigation is only gated where the server itself would deny the role:
 *
 * - `/inbox` needs CREATE_ROLES — `POST /api/submissions` blocks everyone else,
 *   so a `member`/`viewer` would only ever see an empty list.
 * - `/reports` needs PRIVILEGED_ROLES — `server/routes/reports.ts` puts a hard
 *   `requireRole` on the whole router.
 *
 * Deliberately NOT gated: `/follow-up`, because `server/routes/followUps.ts`
 * grants access to the owner and the creator of a follow-up regardless of
 * role — hiding the entry could strand someone who was assigned a task.
 * `/settings` and `/media` are unbuilt stubs (`ComingSoon`), so they are not in the
 * menu: an entry that opens "coming soon" teaches people the menu cannot be trusted.
 * Their routes stay so old links do not 404.
 *
 * Grouping follows what a church team actually does, not the database shape:
 * everyday work with people, talking to the congregation, then church-wide
 * setup. Labels are the shortest unambiguous Thai for each destination — no
 * dual-language slashes, no badges (see docs/PUNTAKIT_UX_UI_AUDIT_2026-10.md §2.1).
 */
export const navGroups: NavGroup[] = [
  {
    name: "หลัก",
    items: [
      { label: "หน้าหลัก", path: "/", icon: HomeIcon },
      { label: "ผังองค์กร", path: "/org", icon: Network, roles: PRIVILEGED_ROLES },
      { label: "สมาชิก", path: "/members", icon: Users },
      { label: "กลุ่มแคร์", path: "/groups", icon: UsersRound },
    ],
  },
  {
    name: "งานดูแล",
    items: [
      { label: "เช็คชื่อแคร์", path: "/care", icon: ListChecks, roles: CREATE_ROLES },
      { label: "เช็คชื่อเข้าร่วม", path: "/attendance", icon: UserCheck },
      { label: "การติดตาม", path: "/follow-up", icon: ListTodo },
      { label: "การนมัสการ", path: "/events", icon: CalendarDays },
    ],
  },
  {
    name: "สื่อสารและกิจกรรม",
    items: [
      { label: "ฟีดกิจกรรม", path: "/feed", icon: Camera },
      { label: "การประกาศ", path: "/announcements", icon: Megaphone },
      { label: "แผนที่กลุ่มแคร์", path: "/map", icon: MapPin },
    ],
  },
  {
    name: "คริสตจักร",
    items: [
      { label: "ข้อมูลคริสตจักร", path: "/church", icon: Building2 },
      { label: "พันธกิจ", path: "/ministries", icon: HeartHandshake },
      {
        label: "รายงาน",
        path: "/reports",
        icon: BarChart3,
        roles: PRIVILEGED_ROLES,
      },
    ],
  },
  {
    name: "ผู้ดูแลระบบ",
    items: [
      {
        label: "ข้อมูลที่ส่งเข้ามา",
        path: "/inbox",
        icon: InboxIcon,
        roles: CREATE_ROLES,
      },
      {
        label: "นำเข้าจาก Excel",
        path: "/import",
        icon: FileSpreadsheet,
        roles: PRIVILEGED_ROLES,
      },
    ],
  },
  {
    name: "บัญชีของฉัน",
    items: [
      { label: "แอพสมาชิก", path: "/app", icon: Sparkles },
      { label: "โปรไฟล์", path: "/profile", icon: UserRound },
    ],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  // Roles arrive with the session; until then `hasRole` denies the gated
  // entries, so a `member` never sees a privileged menu item flash by.
  const visibleGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(
        item => item.roles === undefined || hasRole(user?.role, item.roles)
      ),
    }))
    .filter(group => group.items.length > 0);

  return (
    <>
      {/* Mobile backdrop — tap to dismiss */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-[var(--color-black)]/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-60 max-w-[85vw] flex-col overflow-y-auto bg-[var(--color-dark-surface)] text-[var(--color-on-dark)] transition-transform duration-200 ease-out motion-reduce:transition-none lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="เมนูหลัก"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-on-dark-hairline)] px-5 py-4">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-on-dark-muted)] transition-colors hover:bg-white/10 hover:text-[var(--color-on-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-on-dark)] lg:hidden"
            aria-label="ปิดเมนู"
          >
            <X size={ICON_SIZE.lg} aria-hidden="true" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-5 px-2 py-4">
          {visibleGroups.map(group => (
            <div key={group.name}>
              <h2 className="type-fine mb-1 px-3 font-semibold text-[var(--color-on-dark-muted)]">
                {group.name}
              </h2>
              <ul className="flex flex-col gap-0.5">
                {group.items.map(({ label, path, icon: Icon }) => {
                  // `/worship` renders the same page as `/events`, so the
                  // events entry must also read as current on that route.
                  const isActive =
                    location === path ||
                    (path === "/events" && location === "/worship") ||
                    (path === "/import" && location.startsWith("/import/"));
                  return (
                    <li key={path}>
                      <Link
                        href={path}
                        onClick={onClose}
                        aria-current={isActive ? "page" : undefined}
                        className={`type-caption-strong flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-on-dark)] ${
                          isActive
                            ? "bg-[var(--color-primary-on-dark)]/15 text-[var(--color-primary-on-dark)]"
                            : "text-[var(--color-on-dark-muted)] hover:bg-white/5 hover:text-[var(--color-on-dark)]"
                        }`}
                      >
                        <Icon
                          size={ICON_SIZE.md}
                          aria-hidden="true"
                          className={
                            isActive
                              ? "text-[var(--color-primary-on-dark)]"
                              : "text-[var(--color-on-dark-muted)]"
                          }
                        />
                        <span className="min-w-0 flex-1">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
