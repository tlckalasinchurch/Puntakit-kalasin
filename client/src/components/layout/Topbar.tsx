import { Bell, Menu, Moon, Sun } from "lucide-react";
import { Link } from "wouter";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useState, useEffect, useRef } from "react";
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
 * The notification bell reports a real pending-work count (new submissions,
 * `status=new`) for reviewer roles, and stays badge-free otherwise —
 * never the old hard-coded "0" badge.
 */
export function Topbar({ onMenu, menuOpen }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  // The avatar used to log out on a single tap, right beside the theme and inbox buttons. It now asks first.
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  // `loggingOut` only disables the button after a re-render; the ref stops a second activation before that.
  const loggingOutRef = useRef(false);

  // Pending submissions are review work, not general notifications. Only roles
  // that can review them see the shortcut; it opens the matching Inbox screen.
  const REVIEW_ROLES = ["super_admin", "admin", "staff", "ministry_leader"];
  const canReviewSubmissions = Boolean(user && REVIEW_ROLES.includes(user.role));
  const unreadCount = useUnreadCount(
    canReviewSubmissions ? "/api/submissions?status=new&limit=50" : null
  );

  return (
    <>
      <header
        className="sticky top-0 z-30 flex w-full items-center justify-between gap-3 overflow-hidden border-b border-[var(--color-hairline)] pk-glass px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] sm:px-6 lg:px-8"
        style={{ minHeight: "calc(var(--shell-chrome-h) + var(--safe-t))" }}
      >
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
            className="flex size-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-hairline)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-primary-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
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
          {/* Inbox shortcut. The badge counts submissions with status "new" only, while the home
              attention row ("ข้อมูลที่รอตรวจสอบ") also counts reviewing and needs-info ones, so
              the two numbers differ by design. The label says "ใหม่" so they do not read as one. */}
          {canReviewSubmissions && (
            <Link
              href="/inbox"
              title="เปิดกล่องข้อมูล"
              aria-label={
                unreadCount > 0
                  ? "เปิดกล่องข้อมูล มีรายการใหม่ " + unreadCount + " รายการ"
                  : "เปิดกล่องข้อมูล"
              }
              className="relative flex size-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-hairline)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-primary-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
            >
              <Bell size={ICON_SIZE.md} aria-hidden="true" />
              {unreadCount > 0 && (
                <span aria-hidden="true" className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[var(--color-error)] px-1 type-fine font-bold text-[var(--color-on-primary)]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setConfirmingLogout(true)}
            aria-haspopup="dialog"
            // Deliberately NOT a solid primary fill. This avatar sits in the
            // chrome on every single admin page; painting it in the interactive
            // colour would make it the loudest thing on screen and compete with
            // the page's one primary action (design.md §8.2 action hierarchy).
            className="type-caption-strong flex size-11 items-center justify-center rounded-[var(--radius-circle)] border border-[var(--color-hairline)] bg-[var(--color-canvas-soft)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary-focus)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
            title="ออกจากระบบ"
            aria-label="ออกจากระบบ"
          >
            {(user?.name ?? "ผู้ใช้").slice(0, 2)}
          </button>
        </div>
      </header>
      {/* A sibling of the header, not a child: the header clips overflow and has a backdrop filter,
          either of which would trap the dialog's fixed overlay. Modal handles Escape, the focus
          trap and giving focus back to the avatar; focus starts on "ยกเลิก", the safe choice. */}
      {confirmingLogout && (
        <ConfirmDialog
          title="ออกจากระบบ?"
          description="คุณจะต้องเข้าสู่ระบบอีกครั้งเมื่อกลับมาใช้งาน"
          confirmLabel="ออกจากระบบ"
          busyLabel="กำลังออกจากระบบ…"
          tone="primary"
          isSubmitting={loggingOut}
          onCancel={() => {
            if (!loggingOut) setConfirmingLogout(false);
          }}
          onConfirm={() => {
            if (loggingOutRef.current) return;
            loggingOutRef.current = true;
            setLoggingOut(true);
            // logout() never rejects (an expired session already counts as signed out). Normally the
            // app moves to /login and this unmounts; if the session survives, do not leave the
            // dialog stuck on "กำลังออกจากระบบ…".
            void logout().finally(() => {
              loggingOutRef.current = false;
              setLoggingOut(false);
              setConfirmingLogout(false);
            });
          }}
        />
      )}
    </>
  );
}
