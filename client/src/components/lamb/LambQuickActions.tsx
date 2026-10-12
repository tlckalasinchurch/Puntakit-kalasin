import { Link } from "wouter";
import {
  Bell,
  ChevronRight,
  FileText,
  Settings,
  UsersRound,
} from "lucide-react";

interface QuickAction {
  href: string;
  icon: typeof Bell;
  title: string;
  detail: string;
  badge?: number;
}

const ACTIONS: QuickAction[] = [
  {
    href: "/app/events",
    icon: Bell,
    title: "ข่าวสาร",
    detail: "ประกาศและกิจกรรม",
  },
  {
    href: "/app/reports",
    icon: FileText,
    title: "รายงาน",
    detail: "บันทึกและติดตามงาน",
  },
  {
    href: "/app/group",
    icon: UsersRound,
    title: "กลุ่มของฉัน",
    detail: "สมาชิกและการเติบโต",
  },
  {
    href: "/app/profile",
    icon: Settings,
    title: "ตั้งค่า",
    detail: "ข้อมูลส่วนตัวและแอป",
  },
];

/**
 * Four quick-action cards — news, reports, group, and settings.
 * Every card links to a real member-app destination.
 */
export function LambQuickActions({
  notificationCount = 0,
}: {
  notificationCount?: number;
}) {
  return (
    <section aria-label="ทางลัดด่วน">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {ACTIONS.map(({ href, icon: Icon, title, detail }) => (
          <li key={href}>
            <Link
              href={href}
              className="group relative flex min-h-[120px] flex-col justify-between rounded-2xl bg-white p-4 shadow-sm transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C7C82] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E4F7F2] text-[#0C7C82] transition-transform duration-200 ease-out group-hover:scale-105 group-active:scale-95 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-active:scale-100">
                <Icon size={22} aria-hidden="true" />
                {title === "ข่าวสาร" && notificationCount > 0 && (
                  <span
                    aria-label={`${notificationCount} การแจ้งเตือนใหม่`}
                    aria-live="polite"
                    className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-error)] px-1 text-xs font-bold text-white shadow-sm motion-safe:animate-pulse motion-reduce:animate-none"
                  >
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </span>
              <span>
                <span className="block font-semibold text-[var(--color-ink)]">
                  {title}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--color-body-muted)]">
                  {detail}
                </span>
              </span>
              <ChevronRight
                size={16}
                aria-hidden="true"
                className="absolute right-3 bottom-3 text-[var(--color-text-quaternary)]"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
