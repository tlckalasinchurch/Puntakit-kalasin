import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  User,
  Phone,
  MessageSquare,
  MapPin,
  Heart,
  Lock,
  FileText,
  Bell,
  LogOut,
  Save,
  CheckCircle2,
  ShieldCheck,
  KeyRound,
  Sparkles,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { MemberAppLayout } from "@/components/layout/MemberAppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { MembershipStatus } from "@shared/schema";
import { api, ApiError } from "@/lib/api";
import { FormSkeleton } from "@/components/LoadingStates";
import { subscribeToPushNotifications } from "@/lib/pwa";
import { MEMBERSHIP_STATUS_LABELS, ROLE_LABELS } from "@shared/labels";

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

export default function MemberProfile() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  const [profile, setProfile] = useState<MemberProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      toast.error(err instanceof ApiError ? err.message : "โหลดข้อมูลโปรไฟล์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast.error(err instanceof ApiError ? err.message : "บันทึกข้อมูลไม่สำเร็จ");
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
        toast.error("ไม่สามารถลงทะเบียนการแจ้งเตือนได้ กรุณาตรวจสอบสิทธิ์ของเบราว์เซอร์");
      }
    } finally {
      setSubscribingPush(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestingPush(true);
    try {
      const res = await api.post<{ success: boolean; sentCount: number }>("/api/me/push/send-test", {});
      if (res.sentCount > 0) {
        toast.success("ส่งการแจ้งเตือนทดสอบแล้ว ตรวจสอบบนหน้าจอของคุณ");
      } else {
        toast.info("ยังไม่มีอุปกรณ์ที่ลงทะเบียนรับแจ้งเตือน กรุณากดปุ่มเปิดรับการแจ้งเตือนก่อน");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่งการแจ้งเตือนไม่สำเร็จ");
    } finally {
      setTestingPush(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      await logout();
      navigate("/login");
    }
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <MemberAppLayout title="โปรไฟล์และข้อมูลส่วนตัว">
        <FormSkeleton />
      </MemberAppLayout>
    );
  }

  return (
    <MemberAppLayout title="โปรไฟล์และข้อมูลส่วนตัว">
      <div className="space-y-4">
        {/* User Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-xs">
          <div className="flex items-center space-x-4">
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-[var(--color-primary)]"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[var(--color-dark-surface)] text-white flex items-center justify-center font-bold text-xl shadow-xs">
                {getInitials(user?.name || "PK")}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                  {profile?.name || user?.name}
                </h2>
                {profile?.nickname && (
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">
                    ({profile.nickname})
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {user?.email}
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {profile ?
                    MEMBERSHIP_STATUS_LABELS[profile.membershipStatus as MembershipStatus] ??
                    profile.membershipStatus
                    : "-"}
                </span>
                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 capitalize">
                  {user ? ROLE_LABELS[user.role] ?? user.role : "-"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Edit Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
            <div className="flex items-center space-x-2">
              <User size={ICON_SIZE.sm} className="text-[var(--color-primary)] dark:text-blue-400" />
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                แก้ไขข้อมูลติดต่อ
              </h3>
            </div>
            <span className="text-xs text-gray-400">อัปเดตข้อมูลให้เป็นปัจจุบัน</span>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                ชื่อเล่น
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="เช่น บอย, แนน, อาร์ต"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  เบอร์โทรศัพท์
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08X-XXX-XXXX"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-hidden"
                  />
                  <Phone size={14} className="absolute left-3 top-3.5 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  LINE ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={lineId}
                    onChange={(e) => setLineId(e.target.value)}
                    placeholder="Line ID"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-hidden"
                  />
                  <MessageSquare size={14} className="absolute left-3 top-3.5 text-gray-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                ที่อยู่ปัจจุบัน
              </label>
              <div className="relative">
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="บ้านเลขที่ ตำบล อำเภอ จังหวัด..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-hidden resize-none"
                />
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center space-x-1.5">
                <Heart size={13} className="text-rose-500" />
                <span>บุคคลติดต่อกรณีฉุกเฉิน</span>
              </p>

              <div className="space-y-2.5">
                <div>
                  <input
                    type="text"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="ชื่อ-นามสกุล บุคคลติดต่อฉุกเฉิน"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="tel"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="เบอร์โทรฉุกเฉิน"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-hidden"
                  />
                  <input
                    type="text"
                    value={emergencyContactRelation}
                    onChange={(e) => setEmergencyContactRelation(e.target.value)}
                    placeholder="ความสัมพันธ์ (เช่น บิดา, คู่สมรส)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* PDPA Consent Checkbox */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <label className="flex items-start space-x-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="w-4 h-4 rounded mt-0.5 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  ยินยอมให้คริสตจักรพันธกิจกาฬสินธุ์ จัดเก็บและใช้ข้อมูลส่วนบุคคลนี้เพื่อการอภิบาล การติดต่อประสานงาน และการดำเนินพันธกิจตามนโยบาย PDPA
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full mt-2 py-3 rounded-xl bg-[var(--color-dark-surface)] text-white font-medium text-sm flex items-center justify-center space-x-2 hover:bg-[var(--color-dark-surface-3)] active:scale-98 transition-all shadow-xs disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>บันทึกการเปลี่ยนแปลง</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Push Notification Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-xs space-y-3">
          <div className="flex items-center space-x-2">
            <Bell size={ICON_SIZE.sm} className="text-[var(--color-primary)] dark:text-blue-400" />
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              การแจ้งเตือน Push Notification
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            รับข่าวสารประกาศเร่งด่วน กิจกรรมสำคัญ และการแจ้งเตือนคำขออธิษฐานโดยตรงผ่านโทรศัพท์มือถือ
          </p>

          <div className="flex items-center space-x-2 pt-1">
            <button
              type="button"
              onClick={handleSubscribePush}
              disabled={subscribingPush}
              className="flex-1 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-[var(--color-primary)] dark:text-blue-300 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <Bell size={14} />
              <span>{subscribingPush ? "กำลังตั้งค่า..." : "เปิดรับแจ้งเตือนบนเครื่องนี้"}</span>
            </button>

            <button
              type="button"
              onClick={handleSendTestPush}
              disabled={testingPush}
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {testingPush ? "กำลังส่ง..." : "ทดสอบ"}
            </button>
          </div>
        </div>

        {/* Security & Password Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <KeyRound size={ICON_SIZE.sm} className="text-[var(--color-primary)] dark:text-blue-400" />
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                ความปลอดภัยและรหัสผ่าน
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="text-xs text-[var(--color-primary)] dark:text-blue-400 font-medium"
            >
              {showPasswordSection ? "ยกเลิก" : "เปลี่ยนรหัสผ่าน"}
            </button>
          </div>

          {showPasswordSection && (
            <form onSubmit={handleChangePassword} className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  รหัสผ่านปัจจุบัน
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  placeholder="รหัสผ่านเดิมของคุณ"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="รหัสผ่านใหม่"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ยืนยันรหัสผ่านใหม่
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={changingPassword}
                className="w-full py-2.5 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium text-xs hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {changingPassword ? "กำลังเปลี่ยนรหัสผ่าน..." : "บันทึกรหัสผ่านใหม่"}
              </button>
            </form>
          )}
        </div>

        {/* Privacy & Legal Links */}
        <div
          className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-xs space-y-3"
          data-testid="privacy-links"
        >
          <div className="flex items-center space-x-2">
            <Lock size={ICON_SIZE.sm} className="text-[var(--navy)] dark:text-blue-400" />
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              ความเป็นส่วนตัวและข้อกำหนด
            </h3>
          </div>
          <div className="flex items-center space-x-2 pt-1">
            <Link
              href="/privacy"
              className="flex-1 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Lock size={14} />
              <span>นโยบายความเป็นส่วนตัว</span>
            </Link>
            <Link
              href="/terms"
              className="flex-1 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
            >
              <FileText size={14} />
              <span>เงื่อนไขการใช้งาน</span>
            </Link>
          </div>
        </div>

        {/* Logout Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-3 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-semibold text-sm flex items-center justify-center space-x-2 hover:bg-rose-100/50 active:scale-98 transition-all"
          >
            <LogOut size={16} />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </MemberAppLayout>
  );
}
