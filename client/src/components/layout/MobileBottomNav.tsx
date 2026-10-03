import { BarChart3, Home as HomeIcon, Menu, UserCheck, Users, UsersRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { PRIVILEGED_ROLES, hasRole } from "@shared/roles";

interface MobileBottomNavProps {
  onMenu: () => void;
  menuOpen: boolean;
}

/**
 * Bottom navigation for phones (hidden from `lg`, where the sidebar is
 * always visible). It carries only the destinations used every week —
 * home, groups, members, and reports (or check-in for roles that cannot read
 * reports) — and a fifth button that opens the full menu. Everything else
 * stays in the drawer so this bar never grows past five targets.
 */
export function MobileBottomNav({ onMenu, menuOpen }: MobileBottomNavProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const canSeeReports = hasRole(user?.role, PRIVILEGED_ROLES);

  const items = [
    { label: "หน้าหลัก", path: "/", icon: HomeIcon },
    { label: "กลุ่ม", path: "/groups", icon: UsersRound },
    { label: "สมาชิก", path: "/members", icon: Users },
    canSeeReports
      ? { label: "รายงาน", path: "/reports", icon: BarChart3 }
      : { label: "เช็คชื่อ", path: "/attendance", icon: UserCheck },
  ];

  const base =
    "type-fine flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-focus)]";

  return (
    <nav
      aria-label="เมนูล่าง"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--color-hairline)] bg-[var(--color-canvas)] pb-[env(safe-area-inset-bottom)] lg:hidden"
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
            <Icon size={ICON_SIZE.md} aria-hidden="true" />
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
        <Menu size={ICON_SIZE.md} aria-hidden="true" />
        <span>เมนู</span>
      </button>
    </nav>
  );
}
