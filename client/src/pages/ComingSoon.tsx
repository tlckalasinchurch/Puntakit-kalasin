import { ArrowLeft, Bell, BookOpen, Building2, Church, Megaphone, Settings, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { ICON_SIZE } from "@/lib/icon-sizes";

const pages: Record<string, { title: string; description: string; icon: typeof Bell }> = {
  "/announcements": { title: "การประกาศ", description: "จัดการข่าวสารและประกาศสำคัญของคริสตจักร", icon: Megaphone },
  "/worship": { title: "การนมัสการ", description: "วางแผนและติดตามการนมัสการร่วมกัน", icon: Church },
  "/church": { title: "คริสตจักร", description: "ดูข้อมูลภาพรวมและรายละเอียดของคริสตจักร", icon: Building2 },
  "/ministries": { title: "พันธกิจ", description: "ติดตามงานพันธกิจและการสร้างสาวก", icon: Sparkles },
  "/media": { title: "สื่อ/เอกสาร", description: "จัดเก็บและค้นหาสื่อสำหรับการทำพันธกิจ", icon: BookOpen },
  "/settings": { title: "ตั้งค่า", description: "จัดการการตั้งค่าของระบบและบัญชีผู้ใช้", icon: Settings },
};

export default function ComingSoon() {
  const [location] = useLocation();
  const page = pages[location] ?? pages["/announcements"];
  const Icon = page.icon;
  return (
    <AppLayout>
      <div className="coming-soon-page">
        <div className="coming-soon-card card-surface">
          <span className="coming-soon-icon"><Icon size={32} /></span>
          <span className="eyebrow">PUNTAKIT WORKSPACE</span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
          <div className="coming-soon-note"><Sparkles size={ICON_SIZE.sm} /> หน้านี้กำลังเตรียมข้อมูลให้พร้อมใช้งาน</div>
          <Link href="/" className="primary-action"><ArrowLeft size={ICON_SIZE.sm} /> กลับหน้าหลัก</Link>
        </div>
      </div>
    </AppLayout>
  );
}

export { pages };
