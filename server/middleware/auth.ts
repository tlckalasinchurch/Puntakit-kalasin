import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { isClerkConfigured, loadClerkUser } from "../lib/clerkAuth.js";
import type { AuthenticatedUser } from "../lib/auth.js";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import type { UserRole } from "../../shared/schema.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function readTestCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie ?? "";
  const pair = raw
    .split(";")
    .map(value => value.trim())
    .find(value => value.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : undefined;
}

/**
 * Authenticate requests with Clerk. The legacy cookie/JWT flow is intentionally
 * unavailable in production. The test-only branch lets existing route tests
 * create local identities without requiring a live Clerk session.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (process.env.PUNTAKIT_DEMO_MODE === "1" && process.env.NODE_ENV !== "production") {
    try {
      const { eq } = await import("drizzle-orm");
      const { getDb } = await import("../db/client.js");
      const { users } = await import("../../shared/schema.js");
      const db = getDb();
      const demoEmail = "demo@puntakit.local";
      let [demoUser] = await db.select().from(users).where(eq(users.email, demoEmail)).limit(1);
      if (!demoUser) {
        [demoUser] = await db
          .insert(users)
          .values({
            email: demoEmail,
            name: "ผู้ดูแลระบบตัวอย่าง",
            role: "admin",
            status: "active",
          })
          .returning();
      }
      if (demoUser.status === "suspended") {
        return next(new ForbiddenError("บัญชีผู้ใช้งานตัวอย่างถูกระงับการใช้งาน"));
      }
      req.user = {
        id: demoUser.id,
        email: demoUser.email,
        name: demoUser.name,
        role: demoUser.role as AuthenticatedUser["role"],
      };
      return next();
    } catch (err) {
      return next(err);
    }
  }

  if (isClerkConfigured()) {
    try {
      if (!getAuth(req).userId) {
        return next(new UnauthorizedError("กรุณาเข้าสู่ระบบก่อนดำเนินการ"));
      }
      req.user = await loadClerkUser({ auth: () => getAuth(req) });
      return next();
    } catch (err) {
      return next(err);
    }
  }

  if (process.env.PUNTAKIT_TEST_AUTH === "1") {
    try {
      const { AUTH_COOKIE_NAME, verifyAuthToken } = await import("../lib/auth.js");
      const { getDb } = await import("../db/client.js");
      const { and, eq, isNull } = await import("drizzle-orm");
      const { users, userSessions } = await import("../../shared/schema.js");
      const token =
        req.cookies?.[AUTH_COOKIE_NAME] ||
        readTestCookie(req, AUTH_COOKIE_NAME) ||
        (req.headers.authorization?.startsWith("Bearer ")
          ? req.headers.authorization.slice(7)
          : null);
      if (!token) return next(new UnauthorizedError("กรุณาเข้าสู่ระบบก่อนดำเนินการ"));
      const payload = verifyAuthToken(token);
      const db = getDb();
      const [dbUser] = await db
        .select({ id: users.id, email: users.email, name: users.name, role: users.role, status: users.status })
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);
      if (!dbUser) return next(new UnauthorizedError("ไม่พบบัญชีผู้ใช้งานในระบบ"));
      if (dbUser.status === "suspended") return next(new ForbiddenError("บัญชีผู้ใช้งานของคุณถูกระงับการใช้งานชั่วคราว"));
      if (payload.sessionId) {
        const [session] = await db
          .select()
          .from(userSessions)
          .where(and(eq(userSessions.id, payload.sessionId), isNull(userSessions.revokedAt)))
          .limit(1);
        if (!session || new Date() > session.expiresAt) {
          return next(new UnauthorizedError("เซสชันนี้ถูกยกเลิกแล้ว กรุณาเข้าสู่ระบบใหม่"));
        }
      }
      req.user = { id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role as AuthenticatedUser["role"], sessionId: payload.sessionId };
      return next();
    } catch {
      return next(new UnauthorizedError("กรุณาเข้าสู่ระบบก่อนดำเนินการ"));
    }
  }

  return next(new UnauthorizedError("ระบบ authentication ยังไม่ได้ตั้งค่า Clerk"));
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError("กรุณาเข้าสู่ระบบ"));
    if (req.user.role === "super_admin" || allowedRoles.includes(req.user.role)) return next();
    return next(new ForbiddenError("คุณไม่มีสิทธิ์ในการเข้าถึงหรือดำเนินการในส่วนนี้"));
  };
}

export const requireAdmin = requireRole("super_admin", "admin");
export const requireStaffOrAdmin = requireRole(
  "super_admin",
  "admin",
  "staff",
  "ministry_leader",
  "group_leader"
);
