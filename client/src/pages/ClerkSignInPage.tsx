import { useEffect } from "react";
import { SignIn } from "@clerk/react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { clerkAppearance } from "@/lib/clerkAppearance";
import { Logo } from "@/components/layout/Logo";

/** Clerk-hosted sign-in rendered on the /login route. */
export default function ClerkSignInPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
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
      </div>
    </div>
  );
}
