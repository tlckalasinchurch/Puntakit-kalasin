import { useEffect } from "react";
import { SignIn } from "@clerk/react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
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
          <Logo />
        </div>
        {isDemoMode ? (
          <div className="space-y-4 p-6 text-center">
            <h1 className="text-xl font-semibold">โหมดสาธิตสำหรับการพัฒนา</h1>
            <p className="text-sm text-muted-foreground">ระบบกำลังเข้าสู่ระบบด้วยผู้ดูแลตัวอย่างใน local database</p>
          </div>
        ) : (
          <SignIn
            routing="hash"
            signUpUrl="/login"
            fallbackRedirectUrl="/"
            appearance={{
              variables: {
                colorPrimary: "#1f6feb",
                colorBackground: "#ffffff",
                borderRadius: "1rem",
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
