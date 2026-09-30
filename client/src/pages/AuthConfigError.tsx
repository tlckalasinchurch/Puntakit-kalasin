import { Logo } from "@/components/layout/Logo";

/** Shown instead of a blank screen when the Clerk publishable key is missing. */
export default function AuthConfigError() {
  return (
    <main className="login-shell">
      <div className="login-card" role="alert" data-testid="auth-config-error">
        <div className="login-logo">
          <Logo />
        </div>
        <h1>ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน</h1>
        <p className="login-sub">
          ไม่พบค่า VITE_CLERK_PUBLISHABLE_KEY ในสภาพแวดล้อมนี้ กรุณาให้ผู้ดูแลระบบตั้งค่าคีย์ของ Clerk แล้วโหลดหน้านี้ใหม่
        </p>
      </div>
    </main>
  );
}
