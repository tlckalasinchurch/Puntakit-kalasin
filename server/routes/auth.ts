import { Router } from "express";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../db/client.js";
import { users, userSessions, type UserRole } from "../../shared/schema.js";
import {
  AUTH_COOKIE_NAME,
  hashPassword,
  hashToken,
  signAuthToken,
  verifyPassword,
} from "../lib/auth.js";
import { loginInputSchema } from "../../shared/validation.js";
import { loginRateLimiter } from "../middleware/rateLimit.js";
import { logAudit } from "../lib/audit.js";
import { requireAuth } from "../middleware/auth.js";
import { ForbiddenError, UnauthorizedError, ValidationError } from "../lib/errors.js";

/**
 * Legacy auth routes.
 *
 * `/login` and `/logout` accept email + password and mint the same
 * `puntakit_session` JWT cookie the dual-mode `requireAuth` middleware
 * already consumes (Clerk session first, legacy JWT fallback). `/me`
 * accepts both identity sources. `change-password` was removed when the
 * project moved to Clerk.
 *
 * History note: these endpoints were deleted in c1b8871 during the Clerk
 * migration, but the client (`AuthContext`) still calls them in
 * non-Clerk builds, which left the legacy flow unable to sign in at all.
 * They are restored here unchanged in behaviour so local/dev/no-Clerk
 * deployments work again.
 */
export const authRouter = Router();

const isProd = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

authRouter.post("/login", loginRateLimiter, async (req, res, next) => {
  try {
    const parsed = loginInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);

    // Accounts linked to Clerk have no local password hash — treat as a normal
    // failed credential check instead of crashing the request.
    const passwordMatches =
      user?.passwordHash != null &&
      (await verifyPassword(parsed.data.password, user.passwordHash));

    if (!passwordMatches) {
      await logAudit({
        req,
        action: "LOGIN_FAILED",
        entityType: "user",
        details: { email: parsed.data.email },
      });
      throw new UnauthorizedError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }

    if (user.status === "suspended") {
      await logAudit({
        req,
        userId: user.id,
        action: "LOGIN_BLOCKED_SUSPENDED",
        entityType: "user",
        entityId: user.id,
      });
      throw new ForbiddenError("บัญชีนี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ");
    }

    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = signAuthToken({
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      sessionId,
    });

    // Record session in user_sessions (revocable, hashed token at rest).
    await db.insert(userSessions).values({
      id: sessionId,
      userId: user.id,
      tokenHash: hashToken(token),
      userAgent: (req.headers["user-agent"] as string) || null,
      ipAddress: req.ip || req.socket.remoteAddress || null,
      expiresAt,
    });

    await logAudit({
      req,
      userId: user.id,
      action: "LOGIN_SUCCESS",
      entityType: "user",
      entityId: user.id,
    });

    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (token) {
      const db = getDb();
      const tokenHashVal = hashToken(token);
      await db
        .update(userSessions)
        .set({ revokedAt: new Date() })
        .where(eq(userSessions.tokenHash, tokenHashVal));

      await logAudit({
        req,
        action: "LOGOUT",
        entityType: "user",
      });
    }

    res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = req.user!;
  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

// Exposed only for the seed script (server/scripts/seed-admin.ts). Creates a
// local admin account (legacy bcrypt login continues to work via the fallback
// until the account is linked to Clerk by email).
export async function createUser(
  email: string,
  password: string,
  name: string,
  role: UserRole
) {
  const db = getDb();
  const passwordHash = await hashPassword(password);
  const [created] = await db
    .insert(users)
    .values({ email, passwordHash, name, role, status: "active" })
    .returning();
  return created;
}
