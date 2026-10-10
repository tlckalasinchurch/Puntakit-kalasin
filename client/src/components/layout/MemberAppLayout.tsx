import { useEffect, useState } from "react";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
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

/** Bottom nav height in px, excluding the home-indicator inset. Single source. */
const NAV_HEIGHT = 72;

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

  // The sticky header and the fixed nav both cover the viewport edges, so a
  // keyboard-focused control scrolled "into view" can land underneath them
  // (WCAG 2.4.11). Scroll-padding lives on the root scroller; restore on leave.
  useEffect(() => {
    const root = document.documentElement;
    root.style.scrollPaddingTop = "calc(60px + env(safe-area-inset-top, 0px) + 8px)";
    root.style.scrollPaddingBottom = `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px) + 8px)`;
    return () => {
      root.style.scrollPaddingTop = "";
      root.style.scrollPaddingBottom = "";
    };
  }, []);

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
    <div
      // One source for the nav height: the nav is exactly this tall (plus the
      // home-indicator inset) and <main> reserves the same amount, so the two
      // can never drift apart again.
      style={{ "--member-nav-h": `${NAV_HEIGHT}px` } as React.CSSProperties}
      className="relative mx-auto flex min-h-dvh w-full max-w-[600px] flex-col bg-[var(--color-canvas-soft)] shadow-[var(--shadow)]"
    >
      <a
        href="#member-app-main"
        className="type-caption-strong sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[var(--radius-sm)] focus:bg-[var(--color-canvas)] focus:px-4 focus:py-3 focus:text-[var(--color-ink)] focus:shadow-[var(--shadow)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus)]"
      >
        ข้ามไปที่เนื้อหาหลัก
      </a>

      {/* Mobile app header — 60px sticky, token surfaces, no blue tint. */}
      <header className="sticky top-0 z-40 flex h-[calc(60px+env(safe-area-inset-top,0px))] items-center pt-[env(safe-area-inset-top,0px)] justify-between gap-2 border-b border-[var(--color-divider)] bg-[var(--color-canvas)] px-4">
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

      {/* Main content — bottom padding = nav height + home-indicator inset + breathing room. */}
      <main id="member-app-main"
        className="flex flex-1 flex-col gap-4 px-4 pb-[calc(var(--member-nav-h)+env(safe-area-inset-bottom,0px)+16px)] pt-4 scroll-mt-20"
      >
        <RouteErrorBoundary>{children}</RouteErrorBoundary>
      </main>

      {/* Bottom navigation — 5 real links, >= 44px tall each. Hairline, no shadow. */}
      <nav
        aria-label="เมนูหลักของแอพสมาชิก"
        className="fixed bottom-0 left-1/2 z-30 h-[calc(var(--member-nav-h)+env(safe-area-inset-bottom,0px))] w-full max-w-[600px] -translate-x-1/2 border-t border-[var(--color-divider)] bg-[var(--color-canvas)] pb-[env(safe-area-inset-bottom,0px)]"
      >
        <ul className="flex h-full items-stretch justify-around">
          {NAV_ITEMS.map(item => {
            const isActive = location === item.path;
            const Icon = item.icon;
            return (
              <li key={item.path} className="flex-1">
                <Link
                  href={item.path}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-1 px-1 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] motion-reduce:transition-none ${
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
                    className={`type-caption ${
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
