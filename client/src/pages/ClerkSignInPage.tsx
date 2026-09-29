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
    <div className="login-shell">
      <div className="login-card" data-testid="clerk-sign-in">
        <div className="login-logo">
          <Logo />
        </div>
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
      </div>
    </div>
  );
}
