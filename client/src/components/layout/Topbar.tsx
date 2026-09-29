import { Bell, Menu, Moon, Sun } from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { UserButton } from "@clerk/react";
import { toast } from "sonner";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useTheme } from "@/contexts/ThemeContext";

interface TopbarProps {
  onMenu: () => void;
}

export function Topbar({ onMenu }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-18 w-full items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
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

      <div className="flex items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => toggleTheme?.()}
          className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-slate-200 bg-slate-50/60 text-slate-600 transition-colors hover:bg-slate-100 hover:text-[var(--color-primary)]"
          aria-label={theme === "dark" ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
          title={theme === "dark" ? "โหมดสว่าง" : "โหมดมืด"}
        >
          {theme === "dark" ? <Sun size={ICON_SIZE.md} /> : <Moon size={ICON_SIZE.md} />}
        </button>
        <button
          className="relative flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-slate-200 bg-slate-50/60 text-slate-600 transition-colors hover:bg-slate-100 hover:text-[var(--color-primary)]"
          aria-label="การแจ้งเตือน"
          onClick={() => toast.info("ไม่มีการแจ้งเตือนใหม่")}
        >
          <Bell size={ICON_SIZE.md} />
          <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
            0
          </span>
        </button>
        <UserButton />
      </div>
    </header>
  );
}
