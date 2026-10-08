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
import { usePageTitle } from "@/hooks/usePageTitle";

/** Clerk-hosted sign-in rendered on the /login route.
 *
 * Phase 1 redesign: split-screen layout. Left side carries the church identity
 * (name, verse) on graphite; right side holds the form on white. On mobile the
 * brand stacks on top. Clerk authentication logic is untouched — only the
 * presentation around the sign-in component changed.
 */
export default function ClerkSignInPage() {
  usePageTitle("เข้าสู่ระบบ");
  const [, navigate] = useLocation();
  const { user, error, retry, logout } = useAuth();
  const isDemoMode = import.meta.env.VITE_PUNTAKIT_DEMO_MODE === "1";

  useEffect(() => {
    if (user) navigate(user.role === "member" ? "/app" : "/");
  }, [user, navigate]);

  return (
    <div className="login-shell" data-testid="clerk-sign-in">
      {/* Brand panel — church identity, hidden on small screens (stacked layout uses the compact header instead) */}
      <div className="login-brand" aria-hidden="false">
        <div className="login-brand-inner">
          <Logo tone="onDark" />
          <p className="type-display-md login-brand-name">คริสตจักรชีวิตสุขสันต์กาฬสินธุ์</p>
          <p className="type-body login-brand-tagline">ระบบดูแลสมาชิกและพันธกิจ</p>
          <blockquote className="login-verse">
            <p className="type-body">“จงดูแลฝูงแกะของพระเจ้าที่อยู่ท่ามกลางพวกท่าน”</p>
            <cite className="type-caption">— 1 เปโตร 5:2</cite>
          </blockquote>
        </div>
      </div>

      {/* Form panel */}
      <div className="login-form-panel">
        {/* Compact brand header for mobile (the split-screen brand panel is hidden) */}
        <div className="login-brand-compact">
          <Logo tone="onLight" />
          <p className="type-body-strong">คริสตจักรชีวิตสุขสันต์กาฬสินธุ์</p>
        </div>

        <div className="login-form-card">
          <h1 className="type-display-md login-title">เข้าสู่ระบบ</h1>
          <p className="type-body login-sub">ยินดีต้อนรับกลับมา กรุณาเข้าสู่ระบบเพื่อใช้งาน</p>

          {isDemoMode ? (
            <div className="space-y-4 p-6 text-center">
              <h2 className="text-xl font-semibold">โหมดสาธิตสำหรับการพัฒนา</h2>
              <p className="text-sm text-muted-foreground">ระบบกำลังเข้าสู่ระบบด้วยผู้ดูแลตัวอย่างใน local database</p>
            </div>
          ) : error ? (
            // Clerk already has a valid session but /api/auth/me failed. Rendering
            // the sign-in component here is what produced the loop: Clerk redirects
            // a signed-in visitor to fallbackRedirectUrl, the app cannot load the
            // profile, and the user is bounced between the two forever. Show the
            // real reason and give a way out instead.
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">เข้าสู่ระบบไม่สำเร็จ</h2>
              <ErrorState
                inset
                title="ไม่สามารถโหลดข้อมูลบัญชีของคุณได้"
                description="คุณล็อกอินเรียบร้อยแล้ว แต่ระบบยังเชื่อมต่อข้อมูลบัญชีไม่ได้ กรุณาลองอีกครั้ง หรือแจ้งผู้ดูแลระบบหากยังใช้งานไม่ได้"
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
    </div>
  );
}
