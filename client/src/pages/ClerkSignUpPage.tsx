import { SignUp } from "@clerk/react";
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
 */
export default function ClerkSignUpPage() {
  return (
    <div className="login-shell">
      <div className="login-card" data-testid="clerk-sign-up">
        <div className="login-logo">
          <Logo />
        </div>
        <SignUp
          routing="hash"
          signInUrl="/login"
          fallbackRedirectUrl="/"
          appearance={clerkAppearance}
        />
      </div>
    </div>
  );
}
