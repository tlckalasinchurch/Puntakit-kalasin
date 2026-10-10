import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedUser } from "../lib/auth.js";
import { loadSessionUser } from "../lib/firstPartyAuth.js";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import type { UserRole } from "../../shared/schema.js";
import { ADMIN_ROLES } from "../../shared/roles.js";

declare global { namespace Express { interface Request { user?: AuthenticatedUser } } }

function readTestCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie ?? "";
  const pair = raw.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : undefined;
}
export function isDemoModeEnabled(): boolean {
  return process.env.PUNTAKIT_DEMO_MODE === "1" && process.env.NODE_ENV !== "production" && process.env.PUNTAKIT_TEST_AUTH !== "1";
}
export function isLegacyTestAuthEnabled(): boolean {
  return process.env.PUNTAKIT_TEST_AUTH === "1" && process.env.NODE_ENV !== "production";
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (isDemoModeEnabled()) {
    try {
      const { eq } = await import("drizzle-orm");
      const { getDb } = await import("../db/client.js");
      const { users } = await import("../../shared/schema.js");
      const [demoUser] = await getDb().select().from(users).where(eq(users.email, "demo@puntakit.local")).limit(1);
      if (!demoUser || demoUser.status === "suspended") return next(new ForbiddenError("บัญชีผู้ใช้งานตัวอย่างถูกระงับการใช้งาน"));
      req.user = { id: demoUser.id, email: demoUser.email, name: demoUser.name, role: demoUser.role as AuthenticatedUser["role"] };
      return next();
    } catch (err) { return next(err); }
  }
  if (isLegacyTestAuthEnabled()) {
    try {
      const { and, eq, isNull } = await import("drizzle-orm");
      const { AUTH_COOKIE_NAME, verifyAuthToken } = await import("../lib/auth.js");
      const { getDb } = await import("../db/client.js");
      const { users, userSessions } = await import("../../shared/schema.js");
      const token = req.cookies?.[AUTH_COOKIE_NAME] || readTestCookie(req, AUTH_COOKIE_NAME) || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined);
      if (!token) return next(new UnauthorizedError("กรุณาเข้าสู่ระบบก่อนดำเนินการ"));
      const payload = verifyAuthToken(token);
      const [dbUser] = await getDb().select({ id: users.id, email: users.email, name: users.name, role: users.role, status: users.status }).from(users).where(eq(users.id, payload.sub)).limit(1);
      if (!dbUser) return next(new UnauthorizedError("ไม่พบบัญชีผู้ใช้งานในระบบ"));
      if (dbUser.status === "suspended") return next(new ForbiddenError("บัญชีผู้ใช้งานของคุณถูกระงับการใช้งานชั่วคราว"));
      if (payload.sessionId) {
        const [session] = await getDb().select().from(userSessions).where(and(eq(userSessions.id, payload.sessionId), isNull(userSessions.revokedAt))).limit(1);
        if (!session || new Date() > session.expiresAt) return next(new UnauthorizedError("เซสชันนี้ถูกยกเลิกแล้ว กรุณาเข้าสู่ระบบใหม่"));
      }
      req.user = { id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role as AuthenticatedUser["role"], sessionId: payload.sessionId };
      return next();
    } catch { return next(new UnauthorizedError("กรุณาเข้าสู่ระบบก่อนดำเนินการ")); }
  }
  try { req.user = await loadSessionUser(req); return next(); } catch (err) { return next(err); }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError("กรุณาเข้าสู่ระบบ"));
    if (req.user.role === "super_admin" || allowedRoles.includes(req.user.role)) return next();
    return next(new ForbiddenError("คุณไม่มีสิทธิ์ในการเข้าถึงหรือดำเนินการในส่วนนี้"));
  };
}
export const requireAdmin = requireRole(...ADMIN_ROLES);
