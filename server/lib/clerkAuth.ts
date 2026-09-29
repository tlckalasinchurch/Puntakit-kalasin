import { and, eq, isNull } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { getDb } from "../db/client.js";
import { users } from "../../shared/schema.js";
import type { AuthenticatedUser } from "./auth.js";
import { ForbiddenError, UnauthorizedError } from "./errors.js";

/**
 * Clerk authentication helpers.
 *
 * Valid Clerk sessions are mapped onto the local `users` table via
 * `users.clerk_id` (auto-provision on first login, matched by `clerk_id`, then
 * by email). Clerk is the only authentication provider.
 */

/** True when Clerk credentials are configured in the environment. */
export function isClerkConfigured(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY);
}

export interface ClerkProvisionResult {
  /** Local `users` row, linked (clerk_id set) or newly provisioned. */
  user: typeof users.$inferSelect;
  /** True when a new local account was created for this Clerk user. */
  created: boolean;
  /** True when an existing account was linked by matching email. */
  linkedByEmail: boolean;
}

/**
 * Map a Clerk user onto the local `users` table.
 *
 * Resolution order: exact `clerk_id` match → email match (one-time link, only
 * when the row has no clerk_id yet) → provision a new row.
 */
export async function provisionClerkUser(
  clerkUser: { id: string; email: string | null; name: string | null },
  options: { logger?: Pick<Console, "log" | "warn"> } = {}
): Promise<ClerkProvisionResult> {
  const { logger = console } = options;
  const db = getDb();

  const [byClerkId] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUser.id))
    .limit(1);
  if (byClerkId) {
    return { user: byClerkId, created: false, linkedByEmail: false };
  }

  const email = clerkUser.email?.trim().toLowerCase() || null;

  if (email) {
    const [byEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (byEmail) {
      if (byEmail.clerkId && byEmail.clerkId !== clerkUser.id) {
        throw new ForbiddenError(
          "บัญชีอีเมลนี้ถูกเชื่อมกับบัญชี Clerk อื่นอยู่แล้ว"
        );
      }
      // One-time link: stamp the Clerk id on the legacy account.
      const [linked] = await db
        .update(users)
        .set({ clerkId: clerkUser.id, updatedAt: new Date() })
        .where(and(eq(users.id, byEmail.id), isNull(users.clerkId)))
        .returning();
      if (!linked) {
        // Raced with another request; re-read the row.
        const [reread] = await db
          .select()
          .from(users)
          .where(eq(users.id, byEmail.id))
          .limit(1);
        if (!reread) {
          throw new ForbiddenError(
            "ไม่สามารถเชื่อมบัญชีได้ กรุณาลองใหม่อีกครั้ง"
          );
        }
        return { user: reread, created: false, linkedByEmail: true };
      }
      logger.log(
        `[clerk] linked existing account ${linked.email} to ${clerkUser.id}`
      );
      return { user: linked, created: false, linkedByEmail: true };
    }
  }

  // First login with no matching legacy account — provision a local row.
  const [createdRow] = await db
    .insert(users)
    .values({
      email: email ?? `${clerkUser.id}@clerk.invalid`,
      name: clerkUser.name || "ผู้ใช้ใหม่",
      role: "member",
      status: "active",
      clerkId: clerkUser.id,
    })
    .returning();
  logger.log(
    `[clerk] provisioned new account ${createdRow.email} (${clerkUser.id})`
  );
  return { user: createdRow, created: true, linkedByEmail: false };
}

/**
 * Resolve the local `AuthenticatedUser` for an authenticated Clerk request.
 * Throws Unauthorized/Forbidden errors that map onto the API error contract.
 */
export async function loadClerkUser(req: {
  auth: () => { userId?: string | null };
}): Promise<AuthenticatedUser> {
  const clerkUserId = req.auth().userId;
  if (!clerkUserId) {
    throw new UnauthorizedError("กรุณาเข้าสู่ระบบก่อนดำเนินการ");
  }

  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const primaryEmail =
    clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    null;

  const { user } = await provisionClerkUser({
    id: clerkUser.id,
    email: primaryEmail,
    name:
      [clerkUser.firstName, clerkUser.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || null,
  });

  if (user.status === "suspended") {
    throw new ForbiddenError("บัญชีผู้ใช้งานของคุณถูกระงับการใช้งานชั่วคราว");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as AuthenticatedUser["role"],
  };
}
