import { useEffect } from "react";
import { SignIn } from "@clerk/react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/layout/Logo";

/** Clerk-hosted sign-in rendered on the /login route. */
export default function ClerkSignInPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate(user.role === "member" ? "/app" : "/");
  }, [user, navigate]);

  return (
    <main className="login-shell">
      <div
        className="flex w-full max-w-[400px] flex-col items-center gap-6"
        data-testid="clerk-sign-in"
      >
        <Logo onLight />
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
            elements: {
              rootBox: { width: "100%" },
              cardBox: { width: "100%", maxWidth: "100%" },
            },
          }}
        />
      </div>
    </main>
  );
}
