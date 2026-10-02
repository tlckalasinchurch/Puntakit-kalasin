import { useEffect } from "react";
import { SignUp } from "@clerk/react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { clerkAppearance } from "@/lib/clerkAppearance";
import { Logo } from "@/components/layout/Logo";

/**
 * Clerk-hosted sign-up rendered on the /signup route.
 *
 * This route exists because `<SignIn/>`'s sign-up link pointed at `/login`
 * before, so "Don't have an account? Sign up" simply reloaded the sign-in card.
 * The product's own Terms tell users to register with their real details, and
 * the Clerk instance has sign-ups enabled, so the link is wired to a real page
 * rather than hidden. If self-registration is not wanted, turn it off in the
 * Clerk dashboard and the link disappears on its own — new accounts there are
 * provisioned with the `member` role and only ever see their own /api/me data.
 *
 * In demo mode there is no `<ClerkProvider/>` (see App.tsx), so rendering
 * `<SignUp/>` would throw "SignUp can only be used within the ClerkProvider".
 * Mirror the /login page: show the demo notice and let the sign-in redirect
 * carry the already-authenticated demo admin home, instead of a raw error.
 */
export default function ClerkSignUpPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isDemoMode = import.meta.env.VITE_PUNTAKIT_DEMO_MODE === "1";

  useEffect(() => {
    if (user) navigate(user.role === "member" ? "/app" : "/");
  }, [user, navigate]);

  return (
    <div className="login-shell">
      <div className="login-card" data-testid="clerk-sign-up">
        <div className="login-logo">
          <Logo tone="onLight" />
        </div>
        {isDemoMode ? (
          <div className="space-y-4 p-6 text-center">
            <h1 className="text-xl font-semibold">โหมดสาธิตสำหรับการพัฒนา</h1>
            <p className="text-sm text-muted-foreground">
              ระบบกำลังเข้าสู่ระบบด้วยผู้ดูแลตัวอย่างใน local database
            </p>
          </div>
        ) : (
          <SignUp
            routing="hash"
            signInUrl="/login"
            fallbackRedirectUrl="/"
            appearance={clerkAppearance}
          />
        )}
      </div>
    </div>
  );
}
