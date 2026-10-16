import { useState } from "react";
import { MobileBottomNav } from "./MobileBottomNav";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * The admin shell: graphite sidebar + sticky topbar + the page surface.
 *
 * The `#app-main` target exists so the skip link rendered here is the first
 * focusable thing on every private page — a keyboard user can jump the whole
 * 15-item sidebar in one tab.
 */
export function AppLayout({ children }: AppLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="pk-premium pk-atmosphere flex h-dvh overflow-hidden font-sans text-[var(--color-ink)] antialiased">
      <a
        href="#app-main"
        className="type-caption-strong sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[var(--radius-sm)] focus:bg-[var(--color-canvas)] focus:px-4 focus:py-3 focus:text-[var(--color-ink)] focus:shadow-[var(--shadow)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus)]"
      >
        ข้ามไปที่เนื้อหาหลัก
      </a>

      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Safe-area insets go on THIS wrapper, not on .pk-route: the route
          carries `px-4 sm:px-6 lg:px-8`, and an inline padding-left/right here
          would win over those classes and pin the gutter to 1rem at every
          breakpoint. This element has no responsive padding of its own. */}
      <div
        className="relative flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
        style={{ paddingLeft: "var(--safe-l)", paddingRight: "var(--safe-r)" }}
      >
        <Topbar onMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />

        <main id="app-main" className="w-full flex-1">
          <div className="pk-route mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-8">
            <RouteErrorBoundary>{children}</RouteErrorBoundary>
          </div>
        </main>
      </div>

      <MobileBottomNav onMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />
    </div>
  );
}
