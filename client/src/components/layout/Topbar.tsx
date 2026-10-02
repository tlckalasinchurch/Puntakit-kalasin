import { Menu, Moon, Sun } from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { UserButton } from "@clerk/react";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

interface TopbarProps {
  onMenu: () => void;
  menuOpen: boolean;
}

/**
 * Sticky chrome. 76px tall per brand-spec.md §Composition.
 *
 * The notification bell that used to live here was removed: its badge was the
 * literal number 0 and clicking it toasted "ไม่มีการแจ้งเตือนใหม่". Notifications
 * are not implemented, so the control was UI noise with no purpose (audit §2.2);
 * it comes back when there is something real to report.
 */
export function Topbar({ onMenu, menuOpen }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const isDemoMode = import.meta.env.VITE_PUNTAKIT_DEMO_MODE === "1";

  return (
    <header className="sticky top-0 z-30 flex min-h-19 w-full items-center justify-between gap-3 overflow-hidden border-b border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 py-2 sm:px-6 lg:px-8">
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
        {isDemoMode ? (
          <div
            className="type-caption-strong flex size-11 items-center justify-center rounded-[var(--radius-circle)] bg-[var(--color-primary)] text-[var(--color-on-dark)]"
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
