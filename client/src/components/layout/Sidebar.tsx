import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  Camera,
  HeartHandshake,
  Home as HomeIcon,
  Inbox as InboxIcon,
  ListTodo,
  Megaphone,
  MapPin,
  Settings,
  Sparkles,
  UserCheck,
  UserRound,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { Logo } from "./Logo";

export interface NavGroup {
  name: string;
  items: {
    label: string;
    path: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    badge?: string;
  }[];
}

export const navGroups: NavGroup[] = [
  {
    name: "เมนูหลัก",
    items: [
      { label: "หน้าหลัก", path: "/", icon: HomeIcon },
      { label: "ฟีดกิจกรรม", path: "/feed", icon: Camera, badge: "ใหม่" },
      { label: "แอพสมาชิก (PWA)", path: "/app", icon: Sparkles, badge: "PWA" },
      { label: "สมาชิก", path: "/members", icon: Users },
      { label: "กลุ่มแคร์", path: "/groups", icon: UsersRound },
      { label: "แผนที่กลุ่มแคร์", path: "/map", icon: MapPin },
      { label: "เช็คชื่อ/เข้าร่วม", path: "/attendance", icon: UserCheck },
      { label: "การติดตาม", path: "/follow-up", icon: ListTodo },
      { label: "กล่องข้อมูลนำเข้า", path: "/inbox", icon: InboxIcon },
      { label: "การนมัสการ", path: "/events", icon: CalendarDays },
      { label: "การประกาศ", path: "/announcements", icon: Megaphone },
    ],
  },
  {
    name: "การจัดการและรายงาน",
    items: [
      { label: "คริสตจักร", path: "/church", icon: Building2 },
      { label: "พันธกิจ", path: "/ministries", icon: HeartHandshake },
      { label: "รายงาน", path: "/reports", icon: BarChart3 },
      { label: "สื่อ/เอกสาร", path: "/media", icon: BookOpen },
    ],
  },
  {
    name: "ผู้ใช้และระบบ",
    items: [
      { label: "โปรไฟล์", path: "/profile", icon: UserRound },
      { label: "ตั้งค่า", path: "/settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const [location, navigate] = useLocation();

  return (
    <>
      {/* Mobile backdrop overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col overflow-y-auto bg-[var(--color-dark-surface)] text-slate-300 transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          open ? "translate-x-0 shadow-lg" : "-translate-x-full"
        }`}
        aria-label="เมนูหลัก"
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-6 py-5.5 lg:py-6 border-b border-slate-800/80">
          <Logo />
          <button
            onClick={onClose}
            className="flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
            aria-label="ปิดเมนู"
          >
            <X size={ICON_SIZE.lg} />
          </button>
        </div>

        {/* Navigation Groups */}
        <div className="flex flex-col flex-1 px-4 py-4 space-y-6">
          {navGroups.map(group => (
            <div key={group.name}>
              <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {group.name}
              </h3>
              <nav className="flex flex-col space-y-1">
                {group.items.map(({ label, path, icon: Icon, badge }) => {
                  const isActive = location === path;
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        onClose();
                        navigate(path);
                      }}
                      className={`group relative flex items-center justify-between rounded-[var(--radius-sm)] px-3.5 py-2.5 text-sm font-medium transition-all duration-200 text-left ${
                        isActive
                          ? "bg-[var(--color-primary-on-dark)]/15 text-[var(--color-primary-on-dark)] font-semibold border-l-4 border-[var(--color-primary-on-dark)] pl-2.5"
                          : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          size={ICON_SIZE.md}
                          className={`transition-colors ${
                            isActive
                              ? "text-[var(--color-primary-on-dark)]"
                              : "text-slate-400 group-hover:text-white"
                          }`}
                        />
                        <span>{label}</span>
                      </div>
                      {badge && (
                        <span className="rounded-[var(--radius-xs)] bg-[var(--color-primary-on-dark)]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-primary-on-dark)]">
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Sidebar Footer Motto */}
        <div className="p-4 border-t border-slate-800/80">
          <div className="rounded-xl bg-slate-800/60 p-3.5 text-center border border-slate-700/50">
            <div className="flex items-center justify-center gap-1.5 text-amber-400 mb-1">
              <Sparkles size={ICON_SIZE.xs} />
              <span className="text-[11px] font-semibold tracking-wide">
                PUNTAKIT KALASIN
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-light italic">
              "รักพระเจ้า • รักผู้คน • เปลี่ยนแปลงชุมชน"
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
