/**
 * Test-only credential helper used by route integration fixtures.
 * Production requests are authenticated exclusively by Clerk middleware.
 */
import jwt from "jsonwebtoken";
import type { UserRole } from "../../shared/schema.js";

export const AUTH_COOKIE_NAME = "puntakit_session";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  sessionId?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  sessionId?: string;
}

/**
 * Signing secret for the legacy cookie/JWT path.
 *
 * This must never fall back to a constant committed to the repository: the
 * previous `process.env.JWT_SECRET || "puntakit-test-only-secret"` meant that
 * anyone who could read this file could mint a token accepted by `requireAuth`
 * — and because `requireRole()` always lets `super_admin` through, that is a
 * full authorization bypass, not just a session forgery. Failing loudly is the
 * only safe behaviour when the secret is absent.
 */
function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "JWT_SECRET is not set. The legacy cookie/JWT auth path (PUNTAKIT_TEST_AUTH=1) refuses to run without an explicit secret."
    );
  }
  return secret;
}

export function signAuthToken(payload: JwtPayload): string {
  return jwt.sign(payload, requireJwtSecret(), { expiresIn: "7d" });
}

export function verifyAuthToken(token: string): JwtPayload {
  return jwt.verify(token, requireJwtSecret()) as JwtPayload;
}
