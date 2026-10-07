/**
 * `pnpm db:relink-clerk` — repair a local account pinned to a dead Clerk id.
 *
 * Why this exists: `provisionClerkUser` refuses to relink an email already
 * stamped with a *different* `users.clerk_id`, and answers
 * ACCOUNT_LINK_CONFLICT. That is correct — silently stealing an account from
 * another identity is a security hole. But it strands real users: an account
 * first used through a previous Clerk instance keeps the old `user_...` id
 * forever, so every later sign-in fails, which surfaced to users as
 * "ล็อกอินแล้วเด้งออก".
 *
 * The check is therefore explicit and verified: the stored id must actually NOT
 * exist in Clerk before it is cleared. If Clerk still knows that user, the
 * script refuses — a live identity is signed in as that user, so this is not a
 * stale row.
 *
 * Usage (against production, where the real database lives):
 *   DATABASE_DRIVER=neon DATABASE_URL=... pnpm db:relink-clerk -- <email> --apply
 *
 * Without `--apply` it is a dry run and prints what it would change.
 */
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { closeDatabase, getDb, getDatabaseConfig } from "../db/client.js";
import { DatabaseConfigurationError } from "../db/config.js";
import { users } from "../../shared/schema.js";

function fail(message: string): never {
  console.error(`[db:relink-clerk] ${message}`);
  process.exit(1);
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const email = args.find(arg => !arg.startsWith("--"))?.trim().toLowerCase();

  if (!email) {
    console.error(
      "[db:relink-clerk] usage: pnpm db:relink-clerk -- <email> [--apply]\n" +
        "  omit --apply for a dry run"
    );
    return 1;
  }

  if (!process.env.CLERK_SECRET_KEY) {
    fail("CLERK_SECRET_KEY is required — it is used to verify the old id is gone.");
  }

  const config = getDatabaseConfig();
  console.log(
    `[db:relink-clerk] driver=${config.driver} mode=${apply ? "APPLY" : "dry-run"}`
  );

  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!row) {
    fail(`no local account for ${email}. Nothing to repair.`);
  }
  if (!row.clerkId) {
    console.log(
      `[db:relink-clerk] ${email} has no clerk_id — it links by email on first sign-in. Nothing to do.`
    );
    return 0;
  }

  console.log(`[db:relink-clerk] current clerk_id=${row.clerkId} role=${row.role}`);

  let stillExists = true;
  try {
    await clerkClient.users.getUser(row.clerkId);
  } catch (err) {
    stillExists = false;
    console.log(
      `[db:relink-clerk] Clerk no longer knows that user (${String(err).slice(0, 120)}) — safe to relink.`
    );
  }

  if (stillExists) {
    fail(
      `${row.clerkId} still exists in Clerk. Refusing to overwrite it: that identity ` +
        `is live, and this is not a stale row. Sign the user out of Clerk, delete ` +
        `that Clerk user, then re-run.`
    );
  }

  // Clear the stale stamp. `provisionClerkUser` then links by email on the
  // user's next sign-in — the one path that verifies the live id.
  if (!apply) {
    console.log(
      `[db:relink-clerk] dry run only. Re-run with --apply to clear clerk_id for ${email}.`
    );
    return 0;
  }

  await db
    .update(users)
    .set({ clerkId: null, updatedAt: new Date() })
    .where(eq(users.id, row.id));

  console.log(
    `[db:relink-clerk] cleared clerk_id for ${email}. The next sign-in links this ` +
      `account to the current Clerk id.`
  );
  return 0;
}

main()
  .then(async code => {
    await closeDatabase();
    process.exitCode = code;
  })
  .catch(async error => {
    if (error instanceof DatabaseConfigurationError) {
      console.error(`[db:relink-clerk] configuration error: ${error.message}`);
    } else {
      console.error("[db:relink-clerk] failed:", error);
    }
    await closeDatabase();
    process.exitCode = 1;
  });