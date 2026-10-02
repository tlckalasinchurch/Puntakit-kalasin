import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";

/**
 * Login-loop regression guard.
 *
 * The bug: signing in bounced the user straight back out. `/api/auth/me` failed
 * for a reason that had nothing to do with the session (403, 5xx, dropped
 * connection), `AuthContext` caught *every* failure and set `user = null`, and
 * `ProtectedRoute` read that as "signed out" and redirected to /login. Clerk
 * still held a valid session, so its `fallbackRedirectUrl="/"` pushed the user
 * back to `/` — and the two fought each other indefinitely.
 *
 * The three states that must stay distinct:
 *   signed out → redirect to /login
 *   loading→ skeleton
 *   error      → explain, never redirect
 *
 * These are static assertions on purpose: the loop was invisible to the
 * existing suite because route tests run with PUNTAKIT_TEST_AUTH=1 and never
 * touch Clerk, so the only place this can be caught is at the source level.
 */

const CLIENT_SRC = path.resolve(import.meta.dirname);
const REPO_ROOT = path.resolve(CLIENT_SRC, "..", "..");

function read(relative: string): string {
  return readFileSync(path.resolve(CLIENT_SRC, relative), "utf8");
}

describe("auth: signed-out and failed-profile-load stay distinct", () => {
  it("AuthContext exposes an error and a retry, not just user | null", () => {
    const source = read("contexts/AuthContext.tsx");
    expect(source).toMatch(/error:\s*ApiError\s*\|\s*null/);
    expect(source).toMatch(/retry:\s*\(\)\s*=>\s*void/);
  });

  it("AuthContext only treats a 401 as signed out", () => {
    const source = read("contexts/AuthContext.tsx");
    // A single predicate owns the decision, so both auth modes share it.
    expect(source).toMatch(/status\s*===\s*401/);
    // The old blanket swallow is what caused the loop.
    expect(
      source,
      "a bare .catch(() => setUser(null)) is what made every failure look like a logout"
    ).not.toMatch(/\.catch\(\(\)\s*=>\s*\{?\s*(?:if\s*\(!cancelled\)\s*)?setUser\(null\)/);
  });

  it("ProtectedRoute does not redirect while an error is present", () => {
    const source = read("components/ProtectedRoute.tsx");
    // The guard must include `!error` in the same condition as `!user`.
    expect(source).toMatch(/if\s*\(\s*!isLoading\s*&&\s*!user\s*&&\s*!error\s*\)/);
    expect(source, "error state must render, not return null").toMatch(
      /if\s*\(error\)\s*\{/
    );
    expect(source).toMatch(/data-testid="auth-error"/);
  });

  it("the login page does not render Clerk's SignIn card over a known error", () => {
    const source = read("pages/ClerkSignInPage.tsx");
    // `<SignIn/>` must sit in the final `else` branch, after the error branch,
    // otherwise Clerk keeps redirecting a signed-in user to fallbackRedirectUrl.
    const errorBranch = source.indexOf(") : error ? (");
    const signIn = source.indexOf("<SignIn");
    expect(errorBranch).toBeGreaterThan(-1);
    expect(signIn).toBeGreaterThan(errorBranch);
  });
});

describe("auth: the server names why an account cannot be used", () => {
  it("errors.ts declares the two account-level codes", () => {
    const source = readFileSync(
      path.join(REPO_ROOT, "server", "lib", "errors.ts"),
      "utf8"
    );
    expect(source).toContain("ACCOUNT_SUSPENDED");
    expect(source).toContain("ACCOUNT_LINK_CONFLICT");
  });

  it("clerkAuth raises the specific code instead of a bare 403", () => {
    const source = readFileSync(
      path.join(REPO_ROOT, "server", "lib", "clerkAuth.ts"),
      "utf8"
    );
    expect(source).toContain("AccountLinkConflictError");
    expect(source).toContain("AccountSuspendedError");
  });

  it("the client has a Thai message for each code", () => {
    const source = read("lib/api.ts");
    expect(source).toMatch(/case\s+"ACCOUNT_SUSPENDED"/);
    expect(source).toMatch(/case\s+"ACCOUNT_LINK_CONFLICT"/);
  });
});