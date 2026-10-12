import { Link } from "wouter";
import {
  Bell,
  ChevronRight,
  FileImage,
  NotebookPen,
  Settings,
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
    href: "/app/notifications",
    icon: Bell,
    title: "แจ้งเตือน",
    detail: "ข่าวสารและกิจกรรม",
  },
  {
    href: "/app/notes",
    icon: NotebookPen,
    title: "โน้ต / บันทึก",
    detail: "บันทึกส่วนตัวของฉัน",
  },
  {
    href: "/app/files",
    icon: FileImage,
    title: "ไฟล์ / รูป",
    detail: "รูปภาพจากพันธกิจ",
  },
  {
    href: "/app/profile",
    icon: Settings,
    title: "ตั้งค่า",
    detail: "ข้อมูลส่วนตัวและแอป",
  },
];

/**
 * Four quick-action cards — notifications, notes, files, settings.
 * Each links to a real destination or a truthful unavailable state.
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
              className="relative flex min-h-[120px] flex-col justify-between rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C7C82]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E4F7F2] text-[#0C7C82]">
                <Icon size={22} aria-hidden="true" />
                {title === "แจ้งเตือน" && notificationCount > 0 && (
                  <span
                    aria-label={`${notificationCount} การแจ้งเตือนใหม่`}
                    className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white"
                  >
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </span>
              <span>
                <span className="block font-semibold text-slate-800">
                  {title}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {detail}
                </span>
              </span>
              <ChevronRight
                size={16}
                aria-hidden="true"
                className="absolute right-3 bottom-3 text-slate-300"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
