import { SignUp } from "@clerk/react";
import {
  ClerkAuthShell,
  clerkAppearance,
} from "@/components/auth/ClerkAuthShell";

/** Clerk-hosted sign-up rendered on the /sign-up route. */
export default function ClerkSignUpPage() {
  return (
    <ClerkAuthShell testId="clerk-sign-up">
      <SignUp
        routing="hash"
        signInUrl="/login"
        fallbackRedirectUrl="/"
        appearance={clerkAppearance}
      />
    </ClerkAuthShell>
  );
}
