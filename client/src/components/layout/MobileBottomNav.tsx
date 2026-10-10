import { Home as HomeIcon, ListChecks, Menu, Users, UsersRound } from "lucide-react";
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

  const items = [
    { label: "หน้าหลัก", path: "/", icon: HomeIcon },
    ...(canCheckIn ? [{ label: "เช็คชื่อ", path: "/care", icon: ListChecks }] : []),
    { label: "สมาชิก", path: "/members", icon: Users },
    { label: "พันธกิจ", path: "/groups", icon: UsersRound },
  ];

  const base =
    "type-fine flex min-h-14 flex-1 pb-1 flex-col items-center justify-center gap-1 px-1 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-focus)]";

  return (
    <nav
      aria-label="เมนูล่าง"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--color-hairline)] pk-glass pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {items.map(({ label, path, icon: Icon }) => {
        const active = location === path;
        return (
          <Link
            key={path}
            href={path}
            aria-current={active ? "page" : undefined}
            className={`${base} ${active ? "text-[var(--color-primary)]" : "text-[var(--color-body-muted)]"}`}
          >
            {/* Shape cue (icon pill), so the active item is never carried by
                colour alone — design.md §8.1 status rule, applied to nav. */}
            <span
              aria-hidden="true"
              className={`flex size-9 items-center justify-center rounded-[var(--radius-md)] transition-colors motion-reduce:transition-none ${
                active ? "bg-[var(--color-accent-soft)]" : ""
              }`}
            >
              <Icon size={ICON_SIZE.md} />
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMenu}
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
        className={`${base} text-[var(--color-body-muted)]`}
      >
        <span aria-hidden="true" className="flex size-9 items-center justify-center">
          <Menu size={ICON_SIZE.md} />
        </span>
        <span>เมนู</span>
      </button>
    </nav>
  );
}
