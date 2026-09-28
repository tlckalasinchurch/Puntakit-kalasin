import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { UserButton } from "@clerk/react";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

// Clerk mode renders <UserButton /> (sign-out, profile, sessions); the legacy
// dropdown below stays for builds without a Clerk publishable key.
const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

interface TopbarProps {
  onMenu: () => void;
}

/**
 * Polls a collection endpoint and exposes its total count, or null when the
 * endpoint isn't available for this role (no request is made). Uses the
 * API's X-Total-Count header when present, falling back to the array length.
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

// Role keys mirror shared/schema.ts USER_ROLES. The previous map used
// "pastor"/"leader" keys that don't exist in the schema, so every account
// fell back to the generic "ผู้ใช้งาน" label (bug: wrong role shown).
const ROLE_LABEL: Record<string, string> = {
  super_admin: "ผู้ดูแลสูงสุด",
  admin: "ผู้ดูแลระบบ",
  ministry_leader: "ผู้นำพันธกิจ",
  group_leader: "ผู้นำกลุ่มแคร์",
  staff: "เจ้าหน้าที่",
  member: "สมาชิก",
  viewer: "ผู้ชม",
};

export function Topbar({ onMenu }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, navigate] = useLocation();

  // Real pending-work count for the bell badge (submissions awaiting review).
  // Reviewers only — other roles keep a quiet bell with no badge.
  const REVIEW_ROLES = ["super_admin", "admin", "staff", "ministry_leader"];
  const unreadCount = useUnreadCount(
    user && REVIEW_ROLES.includes(user.role) ? "/api/submissions?status=new&limit=50" : null
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success("ออกจากระบบแล้ว");
    setMenuOpen(false);
    navigate("/login");
  };

  const roleText = (user?.role && ROLE_LABEL[user.role]) || "ผู้ใช้งาน";

  return (
    <header className="sticky top-0 z-30 flex h-18 w-full items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
      {/* Left section: Hamburger toggle on mobile + search bar */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-xl">
        <button
          onClick={onMenu}
          className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          aria-label="เปิดเมนู"
        >
          <Menu size={ICON_SIZE.lg} />
        </button>

        <GlobalSearch variant="compact" />
      </div>

      {/* Right section: Notifications + Profile */}
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => toggleTheme?.()}
          className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-slate-200 bg-slate-50/60 text-slate-600 transition-colors hover:bg-slate-100 hover:text-[var(--color-primary)]"
          aria-label={
            theme === "dark" ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"
          }
          title={theme === "dark" ? "โหมดสว่าง" : "โหมดมืด"}
        >
          {theme === "dark" ? (
            <Sun size={ICON_SIZE.md} />
          ) : (
            <Moon size={ICON_SIZE.md} />
          )}
        </button>
        {/* Notification bell: badge only renders when there is a real count.
            The old hard-coded red "0" badge implied missed notifications (bug). */}
        <button
          className="relative flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-slate-200 bg-slate-50/60 text-slate-600 transition-colors hover:bg-slate-100 hover:text-[var(--color-primary)]"
          aria-label="การแจ้งเตือน"
          onClick={() => toast.info("ไม่มีการแจ้งเตือนใหม่")}
        >
          <Bell size={ICON_SIZE.md} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* User Profile (Clerk) */}
        {clerkEnabled ? (
          <UserButton />
        ) : (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-2.5 rounded-[var(--radius-sm)] p-1.5 transition-colors hover:bg-slate-100 sm:px-3 sm:py-2"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-circle)] bg-[var(--color-primary)] text-sm font-bold text-white">
              {user?.name?.trim().slice(0, 1) || "?"}
            </div>
            <div className="hidden text-left sm:block">
              <span className="block text-xs font-semibold text-slate-800 leading-tight">
                {user?.name ?? "ผู้ใช้งาน"}
              </span>
              <span className="block text-[11px] font-medium text-slate-500">
                {roleText}
              </span>
            </div>
            <ChevronDown
              size={ICON_SIZE.xs}
              className={`hidden text-slate-400 transition-transform sm:block ${
                menuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* TailAdmin Dropdown Popover */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-[var(--radius-md)] border border-slate-200 bg-white p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              {/* User Info Header */}
              <div className="border-b border-slate-100 px-3 py-2.5">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {user?.name ?? "ผู้ใช้งาน"}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {user?.email ?? ""}
                </p>
                <span className="mt-1 inline-block rounded-[var(--radius-xs)] bg-[var(--color-canvas-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
                  {roleText}
                </span>
              </div>

              {/* Menu Links */}
              <div className="py-1">
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <UserRound size={ICON_SIZE.sm} className="text-slate-500" />
                  <span>โปรไฟล์ส่วนตัว</span>
                </Link>

                <Link
                  href="/app"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-canvas-soft)] transition-colors"
                >
                  <Sparkles
                    size={ICON_SIZE.sm}
                    className="text-[var(--color-primary)]"
                  />
                  <span>สลับไปหน้าแอพสมาชิก (PWA)</span>
                </Link>
              </div>

              {/* Logout Button */}
              <div className="border-t border-slate-100 pt-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut size={ICON_SIZE.sm} className="text-rose-500" />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </header>
  );
}
