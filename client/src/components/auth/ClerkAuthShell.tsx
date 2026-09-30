import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/layout/Logo";

export const clerkAppearance = {
  variables: {
    colorPrimary: "#1f6feb",
    colorBackground: "#ffffff",
    borderRadius: "1rem",
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", maxWidth: "100%" },
  },
};

/** Branded wrapper for Clerk sign-in / sign-up; redirects once signed in. */
export function ClerkAuthShell({
  children,
  testId,
}: {
  children: ReactNode;
  testId: string;
}) {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate(user.role === "member" ? "/app" : "/");
  }, [user, navigate]);

  return (
    <main className="login-shell">
      <div
        className="flex w-full max-w-[400px] flex-col items-center gap-6"
        data-testid={testId}
      >
        <Logo onLight />
        {children}
      </div>
    </main>
  );
}
