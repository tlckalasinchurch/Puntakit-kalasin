import { and, eq, isNull } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { getDb } from "../db/client.js";
import { users } from "../../shared/schema.js";
import type { AuthenticatedUser } from "./auth.js";
import { applyBootstrapAdmin } from "./bootstrapAdmin.js";
import { AccountLinkConflictError, AccountSuspendedError, ForbiddenError, UnauthorizedError } from "./errors.js";

/**
 * Clerk authentication helpers.
 *
 * Valid Clerk sessions are mapped onto the local `users` table via
 * `users.clerk_id` (auto-provision on first login, matched by `clerk_id`, then
 * by email). Clerk is the only authentication provider.
 */

/**
 * The Clerk publishable key, under whichever name this project sets it.
 *
 * The browser build reads `VITE_CLERK_PUBLISHABLE_KEY`, and deployments hold
 * the value under that name only — but `clerkMiddleware()` looks up
 * `CLERK_PUBLISHABLE_KEY` in the environment and throws
 * "Publishable key is missing" when it cannot find it, which fails every
 * request behind it with a 500. Accepting either name keeps the single
 * documented variable sufficient (MASTER_PROMPT.md requires
 * `VITE_CLERK_PUBLISHABLE_KEY` and explicitly rules out the Next.js name);
 * the server-side name wins when both are present.
 */
export function resolveClerkPublishableKey(): string | undefined {
  return process.env.CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY;
}

/**
 * True when Clerk credentials are configured in the environment. Both halves
 * are required: the secret key authenticates backend calls, and the publishable
 * key is what `clerkMiddleware()` needs in order to authenticate a request.
 */
export function isClerkConfigured(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY && resolveClerkPublishableKey());
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
    const [synced] = await db
      .update(users)
      .set({
        email: clerkUser.email?.trim().toLowerCase() || byClerkId.email,
        name: clerkUser.name?.trim() || byClerkId.name,
        updatedAt: new Date(),
      })
      .where(eq(users.id, byClerkId.id))
      .returning();
    return { user: synced ?? byClerkId, created: false, linkedByEmail: false };
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
        // Permanent, data-level conflict: this email is stamped with a
        // different Clerk user id (usually from a previous Clerk instance).
        // Retrying cannot fix it and it must not be reported as a plain 403,
        // because the browser then treats it as "signed out" and bounces the
        // user back to /login. Repaired with `pnpm db:relink-clerk`.
        throw new AccountLinkConflictError(
          "อีเมลนี้ถูกเชื่อมไว้กับบัญชี Clerk อื่นอยู่แล้ว กรุณาติดต่อผู้ดูแลระบบเพื่อแก้ไข"
        );
      }
      // One-time link: stamp the Clerk id on the legacy account.
      const [linked] = await db
        .update(users)
        .set({
          clerkId: clerkUser.id,
          email: email ?? byEmail.email,
          name: clerkUser.name?.trim() || byEmail.name,
          updatedAt: new Date(),
        })
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
  const primaryAddress = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId);
  const primaryEmail =
    primaryAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? null;

  const { user: provisioned } = await provisionClerkUser({
    id: clerkUser.id,
    email: primaryEmail,
    name:
      [clerkUser.firstName, clerkUser.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || null,
  });

  if (provisioned.status === "suspended") {
    throw new AccountSuspendedError();
  }

  // Only the verified PRIMARY address can trigger the first-admin bootstrap.
  const user = await applyBootstrapAdmin(provisioned, {
    emailVerified: primaryAddress?.verification?.status === "verified",
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as AuthenticatedUser["role"],
  };
}

/** Mark a locally linked account inactive when Clerk permanently deletes it. */
export async function suspendClerkUser(clerkUserId: string): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(users)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(eq(users.clerkId, clerkUserId))
    .returning({ id: users.id });
  return updated.length > 0;
}
