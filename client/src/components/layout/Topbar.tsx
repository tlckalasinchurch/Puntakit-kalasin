import { Bell, Menu, Moon, Sun } from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { UserButton } from "@clerk/react";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

interface TopbarProps {
  onMenu: () => void;
  menuOpen: boolean;
}

/**
 * Polls a collection endpoint and exposes its total count, or null when the
 * endpoint isn't available for this role (no request is made).
 */
function useUnreadCount(path: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!path) {
      setCount(0);
      return;
    }
    let active = true;
    const read = () => {
      api
        .get<unknown[]>(path)
        .then(rows => {
          if (active) setCount(Array.isArray(rows) ? rows.length : 0);
        })
        .catch(() => {
          /* bell stays quiet on errors — never a fake alert */
        });
    };
    read();
    const interval = setInterval(read, 60_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [path]);

  return count;
}

/**
 * Sticky chrome. 76px tall per brand-spec.md §Composition.
 *
 * The notification bell reports a real pending-work count (submissions
 * awaiting review) for reviewer roles, and stays badge-free otherwise —
 * never the old hard-coded "0" badge.
 */
export function Topbar({ onMenu, menuOpen }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const isDemoMode = import.meta.env.VITE_PUNTAKIT_DEMO_MODE === "1";

  // Real pending-work count for the bell badge (submissions awaiting review).
  // Reviewers only — other roles keep a quiet bell with no badge.
  const REVIEW_ROLES = ["super_admin", "admin", "staff", "ministry_leader"];
  const unreadCount = useUnreadCount(
    user && REVIEW_ROLES.includes(user.role) ? "/api/submissions?status=new&limit=50" : null
  );

  return (
    <header className="sticky top-0 z-30 flex min-h-19 w-full items-center justify-between gap-3 overflow-hidden border-b border-[var(--color-hairline)] pk-glass px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-hairline)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] lg:hidden"
        >
          <Menu size={ICON_SIZE.lg} aria-hidden="true" />
        </button>
        {/* Below sm the search field cannot fit next to the menu, theme and
            account controls without pushing them off-screen (verified at
            360px), so the topbar does not carry it there. `/` renders the
            prominent search on the page itself, which is where a phone user
            actually searches. */}
        <div className="hidden min-w-0 flex-1 sm:block">
          <GlobalSearch variant="compact" />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => toggleTheme?.()}
          className="flex size-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-hairline)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
          aria-label={
            theme === "dark" ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"
          }
        >
          {theme === "dark" ? (
            <Sun size={ICON_SIZE.md} aria-hidden="true" />
          ) : (
            <Moon size={ICON_SIZE.md} aria-hidden="true" />
          )}
        </button>
        {/* Notification bell: badge only renders when there is a real count. */}
        <button
          type="button"
          className="relative flex size-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-hairline)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
          aria-label="การแจ้งเตือน"
        >
          <Bell size={ICON_SIZE.md} aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[var(--color-error)] px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
        {isDemoMode ? (
          <div
            className="type-caption-strong flex size-11 items-center justify-center rounded-[var(--radius-circle)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
            title={user?.name ?? "ผู้ดูแลระบบตัวอย่าง"}
          >
            <span className="sr-only">
              เข้าสู่ระบบในชื่อ {user?.name ?? "ผู้ดูแลระบบตัวอย่าง"}
            </span>
            <span aria-hidden="true">
              {(user?.name ?? "ผด").slice(0, 2)}
            </span>
          </div>
        ) : (
          <UserButton />
        )}
      </div>
    </header>
  );
}
