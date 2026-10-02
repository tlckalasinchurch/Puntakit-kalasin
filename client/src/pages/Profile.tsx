import { CalendarDays, CheckCircle2, ChevronRight, FileText, Lock, LogOut, Mail, ShieldCheck, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProfileSkeleton } from "@/components/LoadingStates";
import { EmptyState, PageHeader, StatusChip } from "@/components/DesignSystem";
import { useAuth } from "@/contexts/AuthContext";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { ROLE_LABELS } from "@shared/labels";

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
        <div className="profile-page" data-testid="profile-empty">
          <EmptyState
            icon={Users}
            title="ไม่พบข้อมูลบัญชีผู้ใช้"
            description="เซสชันของคุณหมดอายุหรือยังไม่ได้เข้าสู่ระบบ"
            action={{ label: "กลับไปเข้าสู่ระบบ", icon: LogOut, onClick: () => navigate("/login") }}
          />
        </div>
      </AppLayout>
    );
  }

  const roleLabel = ROLE_LABELS[user.role] ?? user.role;
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
        <PageHeader
          title="โปรไฟล์ส่วนตัว"
          description="ข้อมูลบัญชีของคุณมาจากเซสชันการเข้าสู่ระบบจริงของระบบ"
        />

        <section className="profile-hero card-surface">
          <div className="profile-avatar" aria-hidden="true">{initial}</div>
          <div className="profile-identity">
            <div className="profile-name-row">
              <h2>{user.name}</h2>
              <StatusChip tone="success">
                <CheckCircle2 size={12} aria-hidden="true" /> เข้าสู่ระบบแล้ว
              </StatusChip>
            </div>
            <p>{roleLabel}</p>
            <small>{user.email}</small>
          </div>
          <div className="profile-hero-mark" aria-hidden="true">
            <ShieldCheck size={34} />
          </div>
        </section>

        <div className="profile-grid">
          <section className="profile-panel card-surface">
            <div className="section-heading">
              <div>
                <span className="mini-icon" aria-hidden="true">
                  <Users size={ICON_SIZE.sm} />
                </span>
                <h2>ข้อมูลบัญชี</h2>
              </div>
            </div>
            <div className="profile-details">
              {details.map(({ label, value, icon: Icon }) => (
                <div className="profile-detail" key={label}>
                  <span className="profile-detail-icon" aria-hidden="true">
                    <Icon size={ICON_SIZE.sm} />
                  </span>
                  <div>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/app/profile" className="profile-link-button min-h-11">
              แก้ไขข้อมูลส่วนตัวของฉัน <ChevronRight size={ICON_SIZE.sm} aria-hidden="true" />
            </Link>
          </section>

          <section className="profile-panel card-surface">
            <div className="section-heading">
              <div>
                <span className="mini-icon green" aria-hidden="true">
                  <CalendarDays size={ICON_SIZE.sm} />
                </span>
                <h2>ความเป็นส่วนตัว</h2>
              </div>
            </div>
            <div className="profile-details" data-testid="privacy-links">
              <Link href="/privacy" className="profile-detail min-h-11">
                <span className="profile-detail-icon" aria-hidden="true">
                  <Lock size={ICON_SIZE.sm} />
                </span>
                <div>
                  <small>นโยบาย</small>
                  <strong>ความเป็นส่วนตัว</strong>
                </div>
              </Link>
              <Link href="/terms" className="profile-detail min-h-11">
                <span className="profile-detail-icon" aria-hidden="true">
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
            <span className="profile-footer-icon" aria-hidden="true">
              <ShieldCheck size={ICON_SIZE.md} />
            </span>
            <div>
              <strong>บัญชีของคุณได้รับการปกป้อง</strong>
              <small>ระบบตรวจสอบสิทธิ์ด้วยเซสชันและตรวจ audit log ทุกครั้งที่เข้าถึงข้อมูล</small>
            </div>
          </div>
          <button className="profile-logout min-h-11" type="button" onClick={handleLogout}>
            <LogOut size={ICON_SIZE.sm} aria-hidden="true" /> ออกจากระบบ
          </button>
        </section>
      </div>
    </AppLayout>
  );
}

export { Profile };
