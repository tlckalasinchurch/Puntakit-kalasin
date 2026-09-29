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

const TEST_SECRET = "puntakit-test-only-secret";

export function signAuthToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET || TEST_SECRET, { expiresIn: "7d" });
}

export function verifyAuthToken(token: string): JwtPayload {
  return jwt.verify(token, process.env.JWT_SECRET || TEST_SECRET) as JwtPayload;
}
