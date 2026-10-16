import { Home as HomeIcon, ListChecks, ListTodo, Menu, Users, UsersRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { CREATE_ROLES, hasRole } from "@shared/roles";

interface MobileBottomNavProps {
  onMenu: () => void;
  menuOpen: boolean;
}

/**
 * Bottom navigation for phones (hidden from `lg`, where the sidebar is
 * always visible). It carries only the destinations used every week: home,
 * care-group check-in (for roles that can record attendance), members and
 * groups, plus a button that opens the full menu. Reports and everything else
 * stay in the drawer so this bar never grows past five targets.
 */
export function MobileBottomNav({ onMenu, menuOpen }: MobileBottomNavProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const canCheckIn = hasRole(user?.role, CREATE_ROLES);
  const isGroupLeader = user?.role === "group_leader";

  // Phase 1: group leaders get a focused bottom nav — their weekly work first.
  // "งานวันนี้" (today's work) is the primary destination, not a generic home.
  const items = isGroupLeader
    ? [
        { label: "งานวันนี้", path: "/care", icon: ListChecks },
        { label: "ติดตาม", path: "/follow-up", icon: ListTodo },
        { label: "สมาชิก", path: "/members", icon: Users },
      ]
    : [
        { label: "หน้าหลัก", path: "/", icon: HomeIcon },
        ...(canCheckIn ? [{ label: "เช็คชื่อ", path: "/care", icon: ListChecks }] : []),
        { label: "สมาชิก", path: "/members", icon: Users },
        { label: "พันธกิจ", path: "/groups", icon: UsersRound },
      ];

  return (
    <nav
      aria-label="เมนูล่าง"
      className="pk-nav fixed inset-x-0 bottom-0 z-30 flex pb-[var(--safe-b)] pl-[var(--safe-l)] pr-[var(--safe-r)] lg:hidden"
    >
      {items.map(({ label, path, icon: Icon }) => {
        const active = location === path;
        return (
          <Link
            key={path}
            href={path}
            aria-current={active ? "page" : undefined}
            className="pk-nav-item flex-1"
          >
            {/* Shape cue (icon pill), so the active item is never carried by
                colour alone — design.md §8.1 status rule, applied to nav. */}
            <span aria-hidden="true" className="pk-nav-item__icon">
              <Icon size={ICON_SIZE.md} />
            </span>
            <span className="type-fine">{label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMenu}
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
        className="pk-nav-item flex-1"
      >
        <span aria-hidden="true" className="pk-nav-item__icon">
          <Menu size={ICON_SIZE.md} />
        </span>
        <span className="type-fine">เมนู</span>
      </button>
    </nav>
  );
}
