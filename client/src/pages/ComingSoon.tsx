import { ArrowLeft, Bell, BookOpen, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { usePageTitle } from "@/hooks/usePageTitle";

// Only routes that are still genuinely unbuilt live here. /announcements,
// /worship, /church and /ministries used to be listed but now render real
// pages — see the route table in client/src/App.tsx.
const pages: Record<string, { title: string; description: string; icon: typeof Bell }> = {
  "/media": { title: "สื่อ/เอกสาร", description: "จัดเก็บและค้นหาสื่อสำหรับการทำพันธกิจ", icon: BookOpen },
  "/settings": { title: "ตั้งค่า", description: "จัดการการตั้งค่าของระบบและบัญชีผู้ใช้", icon: Settings },
};

export default function ComingSoon() {
  const [location, navigate] = useLocation();
  const page = pages[location] ?? pages["/settings"];
  usePageTitle(page.title);
  const Icon = page.icon;
  return (
    <AppLayout>
      <div className="coming-soon-page">
        <div className="coming-soon-card card-surface">
          <span className="coming-soon-icon" aria-hidden="true">
            <Icon size={32} />
          </span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
          <p className="type-caption text-[var(--color-body-muted)]">
            หน้านี้กำลังเตรียมข้อมูลให้พร้อมใช้งาน
          </p>
          <button
            type="button"
            className="primary-action min-h-11"
            onClick={() => navigate("/")}
          >
            <ArrowLeft size={ICON_SIZE.sm} aria-hidden="true" /> กลับหน้าหลัก
          </button>
        </div>
      </div>
    </AppLayout>
  );
}

export { pages };
