import { useEffect } from "react";
import { SignIn } from "@clerk/react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { clerkAppearance } from "@/lib/clerkAppearance";
import { Logo } from "@/components/layout/Logo";
import { ErrorState } from "@/components/DesignSystem";
import { LegalLinks } from "@/components/LegalLinks";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { ICON_SIZE } from "@/lib/icon-sizes";

/** Clerk-hosted sign-in rendered on the /login route. */
export default function ClerkSignInPage() {
  const [, navigate] = useLocation();
  const { user, error, retry, logout } = useAuth();
  const isDemoMode = import.meta.env.VITE_PUNTAKIT_DEMO_MODE === "1";

  useEffect(() => {
    if (user) navigate(user.role === "member" ? "/app" : "/");
  }, [user, navigate]);

  return (
    <div className="login-shell">
      <div className="login-card" data-testid="clerk-sign-in">
        <div className="login-logo">
          <Logo tone="onLight" />
        </div>
        {isDemoMode ? (
          <div className="space-y-4 p-6 text-center">
            <h1 className="text-xl font-semibold">โหมดสาธิตสำหรับการพัฒนา</h1>
            <p className="text-sm text-muted-foreground">ระบบกำลังเข้าสู่ระบบด้วยผู้ดูแลตัวอย่างใน local database</p>
          </div>
        ) : error ? (
          // Clerk already has a valid session but /api/auth/me failed. Rendering
          // <SignIn/> here is what produced the loop: Clerk redirects a signed-in
          // visitor to fallbackRedirectUrl, the app cannot load the profile, and
          // the user is bounced between the two forever. Show the real reason
          // and give a way out instead.
          <div className="space-y-4">
            <h1 className="text-xl font-semibold">เข้าสู่ระบบไม่สำเร็จ</h1>
            <ErrorState
              inset
              title="ไม่สามารถโหลดข้อมูลบัญชีของคุณได้"
              description="คุณล็อกอินเรียบร้อยแล้ว แต่ระบบยังเชื่อมต่อข้อมูลบัญชีไม่ได้ กรุณาลองอีกครั้ง หรือแจ้งผู้ดูแลระบบหากยังพั้งอยู่"
              technical={error.serverMessage ?? `รหัสข้อผิดพลาด: ${error.status || "เครือข่าย"}`}
              onRetry={retry}
              retryLabel="ลองอีกครั้ง"
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              onClick={() => {
                void logout();
              }}
            >
              <LogOut size={ICON_SIZE.sm} aria-hidden="true" />
              ออกจากระบบแล้วเข้าใหม่
            </Button>
          </div>
        ) : (
          // Thai localization is set once on <ClerkProvider> in App.tsx — Clerk
          // v6 dropped the per-component `localization` prop. `signUpUrl`
          // points at the real /signup route; it used to point back at /login,
          // so "Sign up" was a dead end. The Development-mode watermark is
          // Clerk's own: it appears while the deployment runs against a
          // development instance, and only the Clerk dashboard (production
          // instance) can remove it.
          <SignIn
            routing="hash"
            signUpUrl="/signup"
            fallbackRedirectUrl="/"
            appearance={clerkAppearance}
          />
        )}
        <LegalLinks />
      </div>
    </div>
  );
}
