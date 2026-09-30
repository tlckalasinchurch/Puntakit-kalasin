import { CalendarDays, CheckCircle2, ChevronRight, FileText, Lock, LogOut, Mail, ShieldCheck, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProfileSkeleton } from "@/components/LoadingStates";
import { useAuth } from "@/contexts/AuthContext";
import { ICON_SIZE } from "@/lib/icon-sizes";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "ผู้ดูแลระบบสูงสุด",
  admin: "ผู้ดูแลระบบ",
  ministry_leader: "ผู้นำพันธกิจ",
  group_leader: "ผู้นำกลุ่มแคร์",
  staff: "เจ้าหน้าที่",
  member: "สมาชิก",
  viewer: "ผู้ชมข้อมูล",
};

export default function Profile() {
  const { user, isLoading, logout } = useAuth();
  const [, navigate] = useLocation();

  // Loading state (data comes from GET /api/auth/me via AuthContext)
  if (isLoading) {
    return (
      <AppLayout>
        <ProfileSkeleton />
      </AppLayout>
    );
  }

  // Empty state — never substitute with hardcoded data
  if (!user) {
    return (
      <AppLayout>
        <div className="profile-page">
          <section className="profile-panel card-surface state-panel" data-testid="profile-empty">
            <Users size={ICON_SIZE["2xl"]} />
            <h3>ไม่พบข้อมูลบัญชีผู้ใช้</h3>
            <p>เซสชันของคุณหมดอายุหรือยังไม่ได้เข้าสู่ระบบ</p>
            <button className="primary-action" type="button" onClick={() => navigate("/login")}>
              <LogOut size={ICON_SIZE.sm} /> กลับไปเข้าสู่ระบบ
            </button>
          </section>
        </div>
      </AppLayout>
    );
  }

  const roleLabel = ROLE_LABEL[user.role] ?? "สมาชิก";
  const initial = user.name.trim().slice(0, 1) || "?";

  const handleLogout = async () => {
    await logout();
    toast.success("ออกจากระบบแล้ว");
    navigate("/login");
  };

  const details = [
    { label: "อีเมล", value: user.email, icon: Mail },
    { label: "บทบาท", value: roleLabel, icon: ShieldCheck },
  ];

  return (
    <AppLayout>
      <div className="profile-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">ACCOUNT CENTER</span>
            <h1>โปรไฟล์ส่วนตัว</h1>
            <p>ข้อมูลบัญชีของคุณมาจากเซสชันการเข้าสู่ระบบจริงของระบบ</p>
          </div>
        </div>

        <section className="profile-hero card-surface">
          <div className="profile-avatar">{initial}</div>
          <div className="profile-identity">
            <div className="profile-name-row">
              <h2>{user.name}</h2>
              <span className="status-chip good">
                <CheckCircle2 size={12} /> เข้าสู่ระบบแล้ว
              </span>
            </div>
            <p>{roleLabel}</p>
            <small>{user.email}</small>
          </div>
          <div className="profile-hero-mark">
            <ShieldCheck size={34} />
          </div>
        </section>

        <div className="profile-grid">
          <section className="profile-panel card-surface">
            <div className="section-heading">
              <div>
                <span className="mini-icon">
                  <Users size={ICON_SIZE.sm} />
                </span>
                <h2>ข้อมูลบัญชี</h2>
              </div>
            </div>
            <div className="profile-details">
              {details.map(({ label, value, icon: Icon }) => (
                <div className="profile-detail" key={label}>
                  <span className="profile-detail-icon">
                    <Icon size={ICON_SIZE.sm} />
                  </span>
                  <div>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/app/profile" className="profile-link-button">
              แก้ไขข้อมูลส่วนตัวของฉัน <ChevronRight size={ICON_SIZE.sm} />
            </Link>
          </section>

          <section className="profile-panel card-surface">
            <div className="section-heading">
              <div>
                <span className="mini-icon green">
                  <CalendarDays size={ICON_SIZE.sm} />
                </span>
                <h2>ความเป็นส่วนตัว</h2>
              </div>
            </div>
            <div className="profile-details" data-testid="privacy-links">
              <Link href="/privacy" className="profile-detail">
                <span className="profile-detail-icon">
                  <Lock size={ICON_SIZE.sm} />
                </span>
                <div>
                  <small>นโยบาย</small>
                  <strong>ความเป็นส่วนตัว</strong>
                </div>
              </Link>
              <Link href="/terms" className="profile-detail">
                <span className="profile-detail-icon">
                  <FileText size={ICON_SIZE.sm} />
                </span>
                <div>
                  <small>ข้อกำหนด</small>
                  <strong>เงื่อนไขการใช้งาน</strong>
                </div>
              </Link>
            </div>
          </section>
        </div>

        <section className="profile-footer card-surface">
          <div>
            <span className="profile-footer-icon">
              <ShieldCheck size={ICON_SIZE.md} />
            </span>
            <div>
              <strong>บัญชีของคุณได้รับการปกป้อง</strong>
              <small>ระบบตรวจสอบสิทธิ์ด้วยเซสชันและตรวจ audit log ทุกครั้งที่เข้าถึงข้อมูล</small>
            </div>
          </div>
          <button className="profile-logout" type="button" onClick={handleLogout}>
            <LogOut size={ICON_SIZE.sm} /> ออกจากระบบ
          </button>
        </section>
      </div>
    </AppLayout>
  );
}

export { Profile };
