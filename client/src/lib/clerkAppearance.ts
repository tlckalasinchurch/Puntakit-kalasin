import type { ComponentProps } from "react";
import { SignIn } from "@clerk/react";

/**
 * The exact shape Clerk accepts for `appearance`, derived from the component
 * itself: `@clerk/react` v6 does not re-export an `Appearance` type, and
 * `satisfies` still rejects unknown element keys or bad variable values.
 */
type ClerkAppearance = NonNullable<ComponentProps<typeof SignIn>["appearance"]>;

/**
 * Shared styling for the Clerk-hosted components (`<SignIn/>`, `<SignUp/>`).
 *
 * `colorPrimary` references the brand token rather than a literal, because
 * `client/src/index.css` is the source of truth for colour. The value that used
 * to live here was the hardcoded blue `#1f6feb`, which contradicted the app:
 * brand-spec.md retires navy/blue and makes olive `--color-primary` the only
 * chromatic UI colour, so the Continue button was the one blue thing in a green
 * app. Clerk injects these as CSS custom properties on its own root, so a
 * `var()` reference resolves normally.
 *
 * The `elements` overrides remove Clerk's own card chrome. Both auth pages
 * already render a `.login-card` shell (see index.css) around the component,
 * and letting Clerk draw a second card inside it is what produced the doubled
 * border, radius and shadow on /login.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--color-primary)",
    colorBackground: "var(--color-canvas)",
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: { boxShadow: "none", border: "none", background: "transparent", width: "100%" },
    card: { boxShadow: "none", border: "none", background: "transparent", padding: 0 },
    footer: { background: "transparent" },
    footerAction: { background: "transparent" },
  },
} satisfies ClerkAppearance;

/**
 * Sign-in only. `ClerkSignInPage` already renders the page title and welcome
 * line, so Clerk's own header repeated "เข้าสู่ระบบ / ยินดีต้อนรับ" a second
 * time right under it. Controls get a 44px target and 16px text (iOS Safari
 * zooms into smaller fields on focus). Sign-up keeps `clerkAppearance`, which
 * leaves Clerk's header in place because that page has no title of its own.
 */
export const clerkSignInAppearance = {
  variables: clerkAppearance.variables,
  elements: {
    ...clerkAppearance.elements,
    header: { display: "none" },
    formFieldLabel: { fontWeight: 600 },
    formFieldInput: {
      minHeight: "44px",
      fontSize: "16px",
      borderRadius: "var(--radius-sm)",
      boxShadow: "none",
      border: "1px solid var(--color-hairline)",
    },
    formButtonPrimary: {
      minHeight: "44px",
      fontSize: "16px",
      borderRadius: "var(--radius-pill)",
      boxShadow: "none",
    },
    footerActionLink: { fontWeight: 600 },
  },
} satisfies ClerkAppearance;
