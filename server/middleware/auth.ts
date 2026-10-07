import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { isClerkConfigured, loadClerkUser } from "../lib/clerkAuth.js";
import type { AuthenticatedUser } from "../lib/auth.js";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import type { UserRole } from "../../shared/schema.js";
import { ADMIN_ROLES } from "../../shared/roles.js";

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
 * Demo mode is a *development* affordance: it auto-provisions a local admin so
 * the app can be exercised without Clerk credentials.
 *
 * It must never be able to win over an explicit test runtime. Before
 * `PUNTAKIT_TEST_AUTH` was added to this condition, `pnpm test` on any machine
 * that had the documented `.env.local` (which sets NODE_ENV=development and
 * PUNTAKIT_DEMO_MODE=1) auto-authenticated **every** request as the demo admin
 * — so all 46 `expect(401)` / `expect(403)` assertions across nine integration
 * suites silently stopped testing anything, while CI (no `.env.local`) stayed
 * green. `.env.local` overrides NODE_ENV, so the test flag is the only reliable
 * discriminator: vitest.config.ts sets it, and neither `.env.local` nor a
 * deployment ever does.
 */
export function isDemoModeEnabled(): boolean {
  return (
    process.env.PUNTAKIT_DEMO_MODE === "1" &&
    process.env.NODE_ENV !== "production" &&
    process.env.PUNTAKIT_TEST_AUTH !== "1"
  );
}

/**
 * The legacy cookie/JWT path exists solely so route tests can mint local
 * identities. It must never be reachable from a deploy: with it active,
 * `requireAuth` trusts a locally-signed token, and because `requireRole()`
 * always lets `super_admin` through, a forged `role: "super_admin"` claim would
 * pass every gate in the application. Gating on NODE_ENV as well as the flag
 * means no environment variable alone can open it in production, and
 * `createApp()` additionally refuses to boot with the flag set there.
 */
export function isLegacyTestAuthEnabled(): boolean {
  return process.env.PUNTAKIT_TEST_AUTH === "1" && process.env.NODE_ENV !== "production";
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
  if (isDemoModeEnabled()) {
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

  if (isLegacyTestAuthEnabled()) {
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

/** Admin-gated routes. The set lives in `shared/roles.ts` so the client's
 * `isAdmin` flag and this gate are always the same list. */
export const requireAdmin = requireRole(...ADMIN_ROLES);

// `requireStaffOrAdmin` was removed rather than kept: it was never imported,
// and its inline five-role list was byte-for-byte identical to `CREATE_ROLES`
// in `shared/roles.ts`. An unused gate that duplicates a canonical set is the
// exact drift the shared sets exist to prevent — the next caller would have
// added a second definition of "who may create". Use `requireRole(...CREATE_ROLES)`
// when that gate is needed again.
