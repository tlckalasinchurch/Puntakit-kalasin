import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { auditLogs, userSessions, users } from "../../shared/schema.js";
import type { AuthenticatedUser } from "./auth.js";
import { AccountSuspendedError, RateLimitError, UnauthorizedError } from "./errors.js";

function deriveKey(value: string, salt: Buffer, length: number, params: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCallback(value, salt, length, { ...params, maxmem: 64 * 1024 * 1024 }, (error, derived) => error ? reject(error) : resolve(derived as Buffer)));
}
export const AUTH_COOKIE_NAME = "puntakit_session";
export const CSRF_COOKIE_NAME = "puntakit_csrf";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;
const GENERIC_LOGIN_ERROR = "ข้อมูลเข้าสู่ระบบไม่ถูกต้อง หรือบัญชีนี้ยังไม่ได้ลงทะเบียน PIN";
const attempts = new Map<string, { count: number; resetAt: number }>();

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await deriveKey(pin, salt, 64, { N: 32768, r: 8, p: 1 });
  return `scrypt$32768$8$1$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPin(pin: string, encoded: string | null): Promise<boolean> {
  if (!encoded?.startsWith("scrypt$")) return false;
  const [, n, r, p, saltText, hashText] = encoded.split("$");
  if (!n || !r || !p || !saltText || !hashText) return false;
  try {
    const expected = Buffer.from(hashText, "base64url");
    const actual = await deriveKey(pin, Buffer.from(saltText, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function requestKey(req: Request, identity: string): string {
  return `${req.ip}:${identity.trim().toLowerCase()}`;
}
function checkSourceLimit(key: string): void {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }
  current.count += 1;
  if (current.count > 12) throw new RateLimitError();
}
function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    maxAge: SESSION_TTL_MS, path: "/",
  });
}
export function setCsrfCookie(res: Response): string {
  const token = randomBytes(32).toString("base64url");
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    maxAge: SESSION_TTL_MS, path: "/",
  });
  return token;
}
export function csrfMatches(req: Request): boolean {
  const cookie = req.cookies?.[CSRF_COOKIE_NAME];
  const header = req.get("x-csrf-token");
  return Boolean(cookie && header && cookie.length === header.length && timingSafeEqual(Buffer.from(cookie), Buffer.from(header)));
}

export function csrfProtection(req: Request, _res: Response, next: (error?: unknown) => void): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || process.env.PUNTAKIT_TEST_AUTH === "1" || process.env.PUNTAKIT_DEMO_MODE === "1") {
    next();
    return;
  }
  if (!csrfMatches(req)) {
    next(new UnauthorizedError("คำขอนี้ไม่ปลอดภัย กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง"));
    return;
  }
  next();
}

export async function createSession(req: Request, res: Response, userId: string): Promise<void> {
  const db = getDb();
  const raw = randomBytes(32).toString("base64url");
  await db.insert(userSessions).values({
    userId, tokenHash: hashToken(raw), userAgent: req.get("user-agent")?.slice(0, 500),
    ipAddress: req.ip?.slice(0, 100), expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  setAuthCookie(res, raw);
  setCsrfCookie(res);
}

export async function revokeSession(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (token) await getDb().update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.tokenHash, hashToken(token)));
  res.clearCookie(AUTH_COOKIE_NAME, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
}

export async function loadSessionUser(req: Request): Promise<AuthenticatedUser> {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) throw new UnauthorizedError("กรุณาเข้าสู่ระบบก่อนดำเนินการ");
  const now = new Date();
  const [row] = await getDb().select({ session: userSessions, user: users }).from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(and(eq(userSessions.tokenHash, hashToken(token)), isNull(userSessions.revokedAt), gt(userSessions.expiresAt, now))).limit(1);
  if (!row) throw new UnauthorizedError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  if (row.user.status === "suspended") throw new AccountSuspendedError();
  return { id: row.user.id, email: row.user.email, name: row.user.name, role: row.user.role as AuthenticatedUser["role"], sessionId: row.session.id };
}

export async function authenticateWithPin(req: Request, res: Response, identity: string, pin: string): Promise<AuthenticatedUser> {
  const normalized = identity.trim().toLowerCase();
  checkSourceLimit(requestKey(req, normalized));
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  const locked = user?.pinLockedUntil && user.pinLockedUntil > new Date();
  const valid = Boolean(user && !locked && user.status === "active" && await verifyPin(pin, user.pinHash));
  if (!valid) {
    if (user) {
      const nextAttempts = (user.pinFailedAttempts ?? 0) + 1;
      await db.update(users).set({ pinFailedAttempts: nextAttempts >= PIN_MAX_ATTEMPTS ? 0 : nextAttempts, pinLockedUntil: nextAttempts >= PIN_MAX_ATTEMPTS ? new Date(Date.now() + PIN_LOCK_MS) : null, updatedAt: new Date() }).where(eq(users.id, user.id));
      await db.insert(auditLogs).values({ userId: user.id, action: nextAttempts >= PIN_MAX_ATTEMPTS ? "auth.lockout" : "auth.login_failed", entityType: "user", entityId: user.id, ipAddress: req.ip?.slice(0, 100), userAgent: req.get("user-agent")?.slice(0, 500) });
    }
    throw new UnauthorizedError(GENERIC_LOGIN_ERROR);
  }
  await db.update(users).set({ pinFailedAttempts: 0, pinLockedUntil: null, updatedAt: new Date() }).where(eq(users.id, user.id));
  await db.insert(auditLogs).values({ userId: user.id, action: "auth.login_success", entityType: "user", entityId: user.id, ipAddress: req.ip?.slice(0, 100), userAgent: req.get("user-agent")?.slice(0, 500) });
  await createSession(req, res, user.id);
  return { id: user.id, email: user.email, name: user.name, role: user.role as AuthenticatedUser["role"] };
}

export function genericLoginError(): string { return GENERIC_LOGIN_ERROR; }
