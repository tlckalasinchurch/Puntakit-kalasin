import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  CalendarDays,
  Download,
  Home as HomeIcon,
  LayoutDashboard,
  User,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { Logo } from "./Logo";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { isInstallPromptAvailable, promptInstall } from "@/lib/pwa";
import { toast } from "sonner";

/**
 * Member PWA shell — Design System V2.
 *
 * One interactive colour (`--color-primary`), neutral elevation (`--shadow`),
 * graphite-free chrome. The phone frame stays centred at a 600px max width
 * with a sticky 60px header; the bottom nav is real wouter links so
 * ⌘/middle-click and screen-reader navigation landmarks work.
 */

interface MemberAppLayoutProps {
  children: React.ReactNode;
  /**
   * Accepted for call-site compatibility. Pages render their own `<h1>` so the
   * layout never competes with the page heading for the single-h1 rule.
   */
  title?: string;
}

const NAV_ITEMS = [
  { label: "หน้าแรก", path: "/app", icon: HomeIcon },
  { label: "กิจกรรม", path: "/app/events", icon: CalendarDays },
  { label: "พันธกิจ", path: "/app/group", icon: UsersRound },
  { label: "เข้าโบสถ์", path: "/app/attendance", icon: UserCheck },
  { label: "โปรไฟล์", path: "/app/profile", icon: User },
] as const;

export function MemberAppLayout({ children }: MemberAppLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [canInstall, setCanInstall] = useState(false);

  const isStaffOrAdmin =
    user?.role === "super_admin" ||
    user?.role === "admin" ||
    user?.role === "staff" ||
    user?.role === "ministry_leader" ||
    user?.role === "group_leader";

  useEffect(() => {
    setCanInstall(isInstallPromptAvailable());
    const handler = () => setCanInstall(true);
    window.addEventListener("pwa-install-ready", handler);
    return () => window.removeEventListener("pwa-install-ready", handler);
  }, []);

  const handleInstallClick = async () => {
    const installed = await promptInstall();
    if (installed) {
      toast.success("ติดตั้งแอปพลิเคชันลงหน้าจอหลักเรียบร้อยแล้ว");
      setCanInstall(false);
    }
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[600px] flex-col bg-[var(--color-canvas-soft)] shadow-[var(--shadow)]">
      {/* Mobile app header — 60px sticky, token surfaces, no blue tint. */}
      <header className="sticky top-0 z-40 flex h-[60px] items-center justify-between gap-2 border-b border-[var(--color-divider)] bg-[var(--color-canvas)] px-4">
        <Link
          href="/app"
          aria-label="กลับไปหน้าแรกของแอพสมาชิก"
          className="flex min-h-11 min-w-0 items-center overflow-hidden rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
        >
          <Logo tone="onLight" />
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          {canInstall && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="type-fine inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] motion-reduce:transition-none"
            >
              <Download size={ICON_SIZE.sm} aria-hidden="true" />
              <span>ติดตั้ง</span>
            </button>
          )}

          {isStaffOrAdmin && (
            <Link
              href="/"
              title="สลับไปยังแดชบอร์ดเจ้าหน้าที่"
              aria-label="สลับไปยังแดชบอร์ดเจ้าหน้าที่"
              className="flex size-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] motion-reduce:transition-none"
            >
              <LayoutDashboard size={ICON_SIZE.md} aria-hidden="true" />
            </Link>
          )}
        </div>
      </header>

      {/* Main content — bottom padding clears the fixed nav + safe area. */}
      <main className="flex flex-1 flex-col gap-3.5 px-4 pb-[88px] pt-4">
        {children}
      </main>

      {/* Bottom navigation — 5 real links, >= 44px tall each. */}
      <nav
        aria-label="เมนูหลักของแอพสมาชิก"
        className="fixed bottom-0 left-1/2 z-30 w-full max-w-[600px] -translate-x-1/2 border-t border-[var(--color-divider)] bg-[var(--color-canvas)] pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_18px_rgba(29,29,31,0.06)]"
      >
        <ul className="flex items-stretch justify-around">
          {NAV_ITEMS.map(item => {
            const isActive = location === item.path;
            const Icon = item.icon;
            return (
              <li key={item.path} className="flex-1">
                <Link
                  href={item.path}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] motion-reduce:transition-none ${
                    isActive
                      ? "text-[var(--color-primary)]"
                      : "text-[var(--color-body-muted)]"
                  }`}
                >
                  <span
                    className={`flex h-8 w-12 items-center justify-center rounded-[var(--radius-md)] ${
                      isActive ? "bg-[var(--color-accent-soft)]" : ""
                    }`}
                  >
                    <Icon
                      size={ICON_SIZE.lg}
                      strokeWidth={isActive ? 2.5 : 2}
                      aria-hidden="true"
                    />
                  </span>
                  <span
                    className={`type-fine ${
                      isActive ? "font-bold" : "font-medium"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
