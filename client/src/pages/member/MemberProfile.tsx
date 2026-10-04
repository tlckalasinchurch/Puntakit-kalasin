import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  User,
  Phone,
  MessageSquare,
  Heart,
  Lock,
  FileText,
  Bell,
  LogOut,
  Save,
  KeyRound,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MemberAppLayout } from "@/components/layout/MemberAppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { MembershipStatus } from "@shared/schema";
import { api, ApiError } from "@/lib/api";
import { FormSkeleton } from "@/components/LoadingStates";
import {
  EmptyState,
  ErrorState,
  Field,
  FormError,
  StatusChip,
} from "@/components/DesignSystem";
import { subscribeToPushNotifications } from "@/lib/pwa";
import { MEMBERSHIP_STATUS_LABELS, ROLE_LABELS } from "@shared/labels";
import { usePageTitle } from "@/hooks/usePageTitle";

interface MemberProfileData {
  id: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
  email: string | null;
  lineId: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  membershipStatus: string;
  consentDate: string | null;
}

/** Token-based form control, 44px tall. */
const inputBase =
  "type-caption min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] placeholder:text-[var(--color-text-quaternary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus)]";

export default function MemberProfile() {
  usePageTitle("โปรไฟล์และข้อมูลส่วนตัว");
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  const [profile, setProfile] = useState<MemberProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states for profile
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [emergencyContactRelation, setEmergencyContactRelation] = useState("");
  const [consentGiven, setConsentGiven] = useState(true);

  // Form states for password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // Push notification state
  const [subscribingPush, setSubscribingPush] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  const fetchProfile = async () => {
    setError(null);
    try {
      const res = await api.get<MemberProfileData | null>("/api/me/profile");
      if (res) {
        setProfile(res);
        setNickname(res.nickname || "");
        setPhone(res.phone || "");
        setLineId(res.lineId || "");
        setAddress(res.address || "");
        setEmergencyContactName(res.emergencyContactName || "");
        setEmergencyContactPhone(res.emergencyContactPhone || "");
        setEmergencyContactRelation(res.emergencyContactRelation || "");
        setConsentGiven(!!res.consentDate);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "โหลดข้อมูลโปรไฟล์ไม่สำเร็จ"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await api.put("/api/me/profile", {
        nickname: nickname.trim(),
        phone: phone.trim(),
        lineId: lineId.trim(),
        address: address.trim(),
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        emergencyContactRelation: emergencyContactRelation.trim(),
        consentGiven,
      });

      toast.success("บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว");
      fetchProfile();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "บันทึกข้อมูลไม่สำเร็จ";
      setFormError(`${message} กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง`);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // Password management moved to Clerk (the legacy /api/auth/change-password
  // endpoint was removed). Members manage their password from the Clerk
  // account button in the top bar.
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.info("กรุณาจัดการรหัสผ่านจากปุ่มบัญชีมุมขวาบน (Clerk)");
  };

  const handleSubscribePush = async () => {
    setSubscribingPush(true);
    try {
      const ok = await subscribeToPushNotifications();
      if (ok) {
        toast.success("เปิดรับการแจ้งเตือนสำเร็จแล้ว");
      } else {
        toast.error(
          "ไม่สามารถลงทะเบียนการแจ้งเตือนได้ กรุณาตรวจสอบสิทธิ์ของเบราว์เซอร์"
        );
      }
    } finally {
      setSubscribingPush(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestingPush(true);
    try {
      const res = await api.post<{ success: boolean; sentCount: number }>(
        "/api/me/push/send-test",
        {}
      );
      if (res.sentCount > 0) {
        toast.success("ส่งการแจ้งเตือนทดสอบแล้ว ตรวจสอบบนหน้าจอของคุณ");
      } else {
        toast.info(
          "ยังไม่มีอุปกรณ์ที่ลงทะเบียนรับแจ้งเตือน กรุณากดปุ่มเปิดรับการแจ้งเตือนก่อน"
        );
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่งการแจ้งเตือนไม่สำเร็จ");
    } finally {
      setTestingPush(false);
    }
  };

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login");
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const pageHeading = (
    <header>
      <h1 className="type-lead font-semibold text-[var(--color-ink)]">
        โปรไฟล์และข้อมูลส่วนตัว
      </h1>
      <p className="type-caption mt-1 text-[var(--color-body-muted)]">
        จัดการข้อมูลติดต่อ การแจ้งเตือน และความเป็นส่วนตัวของคุณ
      </p>
    </header>
  );

  if (loading) {
    return (
      <MemberAppLayout title="โปรไฟล์และข้อมูลส่วนตัว">
        {pageHeading}
        <FormSkeleton />
      </MemberAppLayout>
    );
  }

  const membershipLabel = profile
    ? MEMBERSHIP_STATUS_LABELS[
        profile.membershipStatus as MembershipStatus
      ] ?? profile.membershipStatus
    : "-";
  const roleLabel = user ? ROLE_LABELS[user.role] ?? user.role : "-";

  return (
    <MemberAppLayout title="โปรไฟล์และข้อมูลส่วนตัว">
      {pageHeading}

      {/* Identity */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
        <div className="flex items-center gap-4">
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={`รูปโปรไฟล์ของ ${profile.name}`}
              className="size-16 shrink-0 rounded-[var(--radius-circle)] border-2 border-[var(--color-primary)] object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="type-body-strong flex size-16 shrink-0 items-center justify-center rounded-[var(--radius-circle)] bg-[var(--color-dark-surface)] text-[var(--color-on-dark)]"
            >
              {getInitials(user?.name || "PK")}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="type-body-strong truncate text-[var(--color-ink)]">
              {profile?.name || user?.name}
            </p>
            {profile?.nickname && (
              <p className="type-fine text-[var(--color-body-muted)]">
                ({profile.nickname})
              </p>
            )}
            <p className="type-fine mt-0.5 truncate text-[var(--color-body-muted)]">
              {user?.email}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusChip tone="neutral">{membershipLabel}</StatusChip>
              <StatusChip tone="neutral">{roleLabel}</StatusChip>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <ErrorState
          title="โหลดข้อมูลโปรไฟล์ไม่สำเร็จ"
          description="ระบบยังเชื่อมต่อข้อมูลโปรไฟล์ของคุณไม่ได้ในขณะนี้ กรุณาลองอีกครั้ง"
          technical={error}
          retryLabel="ลองอีกครั้ง"
          onRetry={() => {
            setLoading(true);
            void fetchProfile();
          }}
        />
      )}

      {!error && !profile && (
        <EmptyState
          icon={User}
          title="ยังไม่มีข้อมูลสมาชิกที่ผูกกับบัญชีนี้"
          description="บัญชีนี้ยังไม่ได้เชื่อมกับทะเบียนสมาชิกของคริสตจักร จึงยังแก้ไขข้อมูลติดต่อไม่ได้ กรุณาติดต่อฝ่ายต้อนรับเพื่อเชื่อมข้อมูล"
          action={{
            label: "ติดต่อฝ่ายต้อนรับคริสตจักร",
            href: "tel:043811800",
          }}
        />
      )}

      {/* Profile edit form */}
      {!error && profile && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-divider)] pb-3">
            <h2 className="type-body-strong flex items-center gap-2 text-[var(--color-ink)]">
              <User
                size={ICON_SIZE.sm}
                aria-hidden="true"
                className="text-[var(--color-primary)]"
              />
              แก้ไขข้อมูลติดต่อ
            </h2>
            <span className="type-fine text-[var(--color-body-muted)]">
              อัปเดตข้อมูลให้เป็นปัจจุบัน
            </span>
          </div>

          <form onSubmit={handleSaveProfile} className="mt-4 flex flex-col gap-3.5">
            {formError && <FormError>{formError}</FormError>}
            <Field
              label="ชื่อเล่น"
              hint="ชื่อที่ให้ทีมศิษยาภิบาลเรียกคุณ"
            >
              {fieldProps => (
                <input
                  {...fieldProps}
                  type="text"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="เช่น บอย, แนน, อาร์ต"
                  className={`${inputBase} px-3.5 py-2.5`}
                />
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="เบอร์โทรศัพท์">
                {fieldProps => (
                  <div className="relative">
                    <input
                      {...fieldProps}
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="08X-XXX-XXXX"
                      className={`${inputBase} py-2.5 pl-10 pr-3`}
                    />
                    <Phone
                      size={ICON_SIZE.sm}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-quaternary)]"
                    />
                  </div>
                )}
              </Field>

              <Field label="ไลน์ไอดี">
                {fieldProps => (
                  <div className="relative">
                    <input
                      {...fieldProps}
                      type="text"
                      value={lineId}
                      onChange={e => setLineId(e.target.value)}
                      placeholder="ไลน์ไอดีของคุณ"
                      className={`${inputBase} py-2.5 pl-10 pr-3`}
                    />
                    <MessageSquare
                      size={ICON_SIZE.sm}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-quaternary)]"
                    />
                  </div>
                )}
              </Field>
            </div>

            <Field label="ที่อยู่ปัจจุบัน">
              {fieldProps => (
                <textarea
                  {...fieldProps}
                  rows={2}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="บ้านเลขที่ ตำบล อำเภอ จังหวัด..."
                  className={`${inputBase} resize-none px-3.5 py-2.5`}
                />
              )}
            </Field>

            <div className="border-t border-[var(--color-divider)] pt-3">
              <h3 className="type-caption-strong mb-2 flex items-center gap-1.5 text-[var(--color-ink)]">
                <Heart
                  size={ICON_SIZE.sm}
                  aria-hidden="true"
                  className="text-[var(--color-error)]"
                />
                บุคคลติดต่อกรณีฉุกเฉิน
              </h3>

              <div className="flex flex-col gap-3">
                <Field label="ชื่อ-นามสกุล">
                  {fieldProps => (
                    <input
                      {...fieldProps}
                      type="text"
                      value={emergencyContactName}
                      onChange={e => setEmergencyContactName(e.target.value)}
                      placeholder="ชื่อ-นามสกุล บุคคลติดต่อฉุกเฉิน"
                      className={`${inputBase} px-3.5 py-2.5`}
                    />
                  )}
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="เบอร์โทรฉุกเฉิน">
                    {fieldProps => (
                      <input
                        {...fieldProps}
                        type="tel"
                        value={emergencyContactPhone}
                        onChange={e =>
                          setEmergencyContactPhone(e.target.value)
                        }
                        placeholder="08X-XXX-XXXX"
                        className={`${inputBase} px-3.5 py-2.5`}
                      />
                    )}
                  </Field>
                  <Field label="ความสัมพันธ์">
                    {fieldProps => (
                      <input
                        {...fieldProps}
                        type="text"
                        value={emergencyContactRelation}
                        onChange={e =>
                          setEmergencyContactRelation(e.target.value)
                        }
                        placeholder="เช่น บิดา, คู่สมรส"
                        className={`${inputBase} px-3.5 py-2.5`}
                      />
                    )}
                  </Field>
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--color-divider)] pt-3">
              <label className="flex min-h-11 cursor-pointer select-none items-start gap-3 py-1">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={e => setConsentGiven(e.target.checked)}
                  className="mt-0.5 size-5 shrink-0 rounded accent-[var(--color-primary)]"
                />
                <span className="type-fine text-[var(--color-body-muted)]">
                  ยินยอมให้คริสตจักรชีวิตสุขสันต์กาฬสินธุ์ จัดเก็บและใช้ข้อมูลส่วนบุคคลนี้เพื่อการอภิบาล
                  การติดต่อประสานงาน และการดำเนินพันธกิจตามนโยบาย PDPA
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="type-caption-strong mt-1 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50 motion-reduce:transition-none"
            >
              {saving ? (
                <>
                  <Loader2
                    size={ICON_SIZE.sm}
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                  <span>กำลังบันทึก…</span>
                </>
              ) : (
                <>
                  <Save size={ICON_SIZE.sm} aria-hidden="true" />
                  <span>บันทึกการเปลี่ยนแปลง</span>
                </>
              )}
            </button>
          </form>
        </section>
      )}

      {/* Push notifications */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
        <h2 className="type-body-strong flex items-center gap-2 text-[var(--color-ink)]">
          <Bell
            size={ICON_SIZE.sm}
            aria-hidden="true"
            className="text-[var(--color-primary)]"
          />
          การแจ้งเตือน
        </h2>
        <p className="type-caption mt-2 text-[var(--color-body-muted)]">
          รับประกาศเร่งด่วน กิจกรรมสำคัญ และการแจ้งเตือนคำขออธิษฐานผ่านโทรศัพท์มือถือ
        </p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleSubscribePush}
            disabled={subscribingPush}
            className="type-caption-strong inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50 motion-reduce:transition-none"
          >
            <Bell size={ICON_SIZE.sm} aria-hidden="true" />
            <span>
              {subscribingPush
                ? "กำลังตั้งค่า…"
                : "เปิดรับการแจ้งเตือนบนเครื่องนี้"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleSendTestPush}
            disabled={testingPush}
            className="type-caption-strong inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-hairline)] px-4 text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50 motion-reduce:transition-none"
          >
            {testingPush ? "กำลังส่ง…" : "ทดสอบการแจ้งเตือน"}
          </button>
        </div>
      </section>

      {/* Security */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="type-body-strong flex items-center gap-2 text-[var(--color-ink)]">
            <KeyRound
              size={ICON_SIZE.sm}
              aria-hidden="true"
              className="text-[var(--color-primary)]"
            />
            ความปลอดภัยและรหัสผ่าน
          </h2>
          <button
            type="button"
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            aria-expanded={showPasswordSection}
            aria-controls="password-section"
            className="type-caption-strong inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-sm)] px-2 text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
          >
            {showPasswordSection ? "ยกเลิก" : "เปลี่ยนรหัสผ่าน"}
          </button>
        </div>

        {showPasswordSection && (
          <form
            id="password-section"
            onSubmit={handleChangePassword}
            className="mt-3 flex flex-col gap-3 border-t border-[var(--color-divider)] pt-3"
          >
            <Field label="รหัสผ่านปัจจุบัน">
              {fieldProps => (
                <input
                  {...fieldProps}
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  placeholder="รหัสผ่านเดิมของคุณ"
                  className={`${inputBase} px-3.5 py-2.5`}
                />
              )}
            </Field>

            <Field
              label="รหัสผ่านใหม่"
              help="อย่างน้อย 8 ตัวอักษร"
            >
              {fieldProps => (
                <input
                  {...fieldProps}
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  placeholder="รหัสผ่านใหม่"
                  className={`${inputBase} px-3.5 py-2.5`}
                />
              )}
            </Field>

            <Field label="ยืนยันรหัสผ่านใหม่">
              {fieldProps => (
                <input
                  {...fieldProps}
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                  className={`${inputBase} px-3.5 py-2.5`}
                />
              )}
            </Field>

            <button
              type="submit"
              disabled={changingPassword}
              className="type-caption-strong inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-dark-surface)] px-4 text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-dark-surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50 motion-reduce:transition-none"
            >
              {changingPassword ? "กำลังเปลี่ยนรหัสผ่าน…" : "บันทึกรหัสผ่านใหม่"}
            </button>
          </form>
        )}
      </section>

      {/* Privacy & legal */}
      <section
        className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5"
        data-testid="privacy-links"
      >
        <h2 className="type-body-strong flex items-center gap-2 text-[var(--color-ink)]">
          <Lock
            size={ICON_SIZE.sm}
            aria-hidden="true"
            className="text-[var(--color-primary)]"
          />
          ความเป็นส่วนตัวและข้อกำหนด
        </h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/privacy"
            className="type-caption-strong inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-hairline)] px-4 text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] motion-reduce:transition-none"
          >
            <Lock size={ICON_SIZE.sm} aria-hidden="true" />
            <span>นโยบายความเป็นส่วนตัว</span>
          </Link>
          <Link
            href="/terms"
            className="type-caption-strong inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-hairline)] px-4 text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] motion-reduce:transition-none"
          >
            <FileText size={ICON_SIZE.sm} aria-hidden="true" />
            <span>เงื่อนไขการใช้งาน</span>
          </Link>
        </div>
      </section>

      <div className="pt-1">
        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          className="type-caption-strong inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-error)] bg-[var(--color-canvas)] px-4 text-[var(--color-error)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] motion-reduce:transition-none"
        >
          <LogOut size={ICON_SIZE.sm} aria-hidden="true" />
          <span>ออกจากระบบ</span>
        </button>
      </div>

      {confirmLogout && (
        <ConfirmDialog
          title="ออกจากระบบ"
          description="คุณต้องการออกจากระบบใช่หรือไม่? ครั้งหน้าต้องเข้าสู่ระบบใหม่"
          confirmLabel="ออกจากระบบ"
          busyLabel="กำลังออกจากระบบ…"
          isSubmitting={loggingOut}
          onConfirm={() => void handleLogout()}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
    </MemberAppLayout>
  );
}
