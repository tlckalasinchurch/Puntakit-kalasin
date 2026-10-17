import { useEffect, useState } from "react";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Link, useLocation } from "wouter";
import {
  CalendarDays,
  Download,
  FileText,
  Home as HomeIcon,
  LayoutDashboard,
  User,
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
  { label: "รายงาน", path: "/app/reports", icon: FileText },
  { label: "กลุ่ม", path: "/app/group", icon: UsersRound },
  { label: "กิจกรรม", path: "/app/events", icon: CalendarDays },
  { label: "ฉัน", path: "/app/profile", icon: User },
] as const;

/**
 * The width the member app is allowed to occupy, as one value used by BOTH the
 * scroll container and the fixed bottom nav. They used to be written out twice;
 * on a tablet that let the nav drift narrower than the content.
 *
 * Phone 600 → tablet widens so the content is not a thin ribbon on an 8" screen
 * → desktop caps again, because this is a member PWA, not a dashboard.
 */
function shellWidthClass(isMemberHome: boolean): string {
  return isMemberHome
    ? "max-w-[1440px]"
    : "max-w-[600px] sm:max-w-[680px] md:max-w-[760px] lg:max-w-[720px]";
}

export function MemberAppLayout({ children }: MemberAppLayoutProps) {
  const [location] = useLocation();
  const isMemberHome = location === "/app";
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
    <div
      className={`lamb-theme relative mx-auto flex min-h-[var(--app-vh)] w-full flex-col bg-[var(--color-canvas)] ${
        shellWidthClass(isMemberHome)
      }`}
      style={{
        // Notch-safe on every edge when the shell runs edge-to-edge
        // (`viewport-fit=cover` + black-translucent status bar).
        paddingLeft: "var(--safe-l)",
        paddingRight: "var(--safe-r)",
      }}
    >
      <a
        href="#member-app-main"
        className="type-caption-strong sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[var(--radius-sm)] focus:bg-[var(--color-canvas)] focus:px-4 focus:py-3 focus:text-[var(--color-ink)] focus:shadow-[var(--shadow)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus)]"
      >
        ข้ามไปที่เนื้อหาหลัก
      </a>

      {/* Mobile app header — compact chrome, the same height the admin bottom
          nav uses, so both shells share one vertical rhythm. */}
      <header
        className={`${
          isMemberHome
            ? "hidden"
            : "sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-[var(--shell-nav-line)] bg-[var(--shell-nav-surface)] px-4 pt-[var(--safe-t)]"
        }`}
        style={{ height: "calc(var(--shell-chrome-h-compact) + var(--safe-t))" }}
      >
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
      <main id="member-app-main" className={`flex flex-1 flex-col gap-3.5 px-4 pb-[88px] pt-4 ${isMemberHome ? "sm:px-6 lg:px-8 lg:pt-6" : ""}`}>
        <RouteErrorBoundary>{children}</RouteErrorBoundary>
      </main>

      {/* Bottom navigation — 5 real links, >= 44px tall each. */}
      <nav
        aria-label="เมนูหลักของแอพสมาชิก"
        className={`pk-nav fixed bottom-0 left-1/2 z-30 w-full ${shellWidthClass(isMemberHome)} -translate-x-1/2 pb-[var(--safe-b)] pl-[var(--safe-l)] pr-[var(--safe-r)]`}
      >
        <ul className="flex items-stretch justify-around">
          {NAV_ITEMS.map(item => {
            // Treat nested destinations as part of their parent tab (e.g. /app/reports/123).
            const isActive =
              location === item.path ||
              (item.path !== "/app" && location.startsWith(`${item.path}/`));
            const Icon = item.icon;
            return (
              <li key={item.path} className="flex-1">
                <Link
                  href={item.path}
                  aria-current={isActive ? "page" : undefined}
                  className="pk-nav-item"
                >
                  <span aria-hidden="true" className="pk-nav-item__icon">
                    <Icon size={ICON_SIZE.lg} strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  <span className="type-fine">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
