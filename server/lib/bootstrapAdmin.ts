import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { users } from "../../shared/schema.js";
import { ADMIN_ROLES } from "../../shared/roles.js";
import { logAudit } from "./audit.js";

/**
 * First-admin bootstrap. The app has no role-management screen yet, and a new
 * Clerk user is provisioned as `member`, so nobody could become the first
 * admin without editing the database.
 *
 * `BOOTSTRAP_ADMIN_EMAILS` (comma-separated) names the email addresses that
 * become `super_admin` on sign-in. Guards:
 *  - the email must be the Clerk PRIMARY address AND verified by Clerk, so a
 *    stranger cannot claim it by typing it into a sign-up form;
 *  - it only promotes: an account that is already admin or super_admin is
 *    left alone, and nothing is ever demoted;
 *  - empty or unset means the feature is off.
 * Remove the variable once real admins exist.
 */
export function parseBootstrapAdminEmails(raw: string | undefined = process.env.BOOTSTRAP_ADMIN_EMAILS): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function applyBootstrapAdmin(
  user: typeof users.$inferSelect,
  opts: { emailVerified: boolean; allowList?: Set<string> }
): Promise<typeof users.$inferSelect> {
  const allow = opts.allowList ?? parseBootstrapAdminEmails();
  if (allow.size === 0 || !opts.emailVerified) return user;
  if (!allow.has(user.email.trim().toLowerCase())) return user;
  if ((ADMIN_ROLES as readonly string[]).includes(user.role)) return user;

  const [promoted] = await getDb()
    .update(users)
    .set({ role: "super_admin", updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();
  await logAudit({
    userId: user.id,
    action: "BOOTSTRAP_ADMIN_GRANTED",
    entityType: "user",
    entityId: user.id,
    details: { from: user.role, to: "super_admin" },
  });
  return promoted ?? user;
}
