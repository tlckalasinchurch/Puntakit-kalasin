/**
 * Read-only probe: which local accounts are linked to a Clerk id, and does
 * that id still exist in Clerk?
 *
 * This answers the question the browser cannot: the login loop happens because
 * `/api/auth/me` fails *after* Clerk authenticates, and the two ways that can
 * happen here are a stale `clerk_id` (the email was first used through another
 * Clerk instance) or a suspended account. The client cannot tell them apart,
 * so this lists the accounts and marks the ones that need repair.
 *
 * Read-only by construction: a SELECT and nothing else. Run it with
 * production credentials:
 *   dotenv -e .env.prod.local -- tsx server/scripts/inspect-clerk-links.ts
 */
import { eq, isNotNull } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { closeDatabase, getDb } from "../db/client.js";
import { users } from "../../shared/schema.js";

async function main(): Promise<number> {
  if (!process.env.CLERK_SECRET_KEY) {
    console.error("[inspect] CLERK_SECRET_KEY is required to verify the ids.");
    return 1;
  }

  const db = getDb();
  const rows = await db
    .select({
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
      clerkId: users.clerkId,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);

  console.log(`[inspect] ${rows.length} account(s)\n`);

  const header = ["email", "role", "status", "clerk_id", "clerk? สถานะ"];
  console.log(header.join("  |  "));
  console.log("-".repeat(80));

  let needsRepair = 0;

  for (const row of rows) {
    if (!row.clerkId) {
      // No stamp: provisionClerkUser links by email on first sign-in. Fine.
      console.log(`${row.email}  |  ${row.role}  |  ${row.status}  |  (ยังไม่ผูก)  |  ผูกอัตโนมัติตอนเข้าครั้งแรก`);
      continue;
    }

    let state: string;
    try {
      await clerkClient.users.getUser(row.clerkId);
      state = "มีอยู่จริง";
    } catch {
      state = "ไม่มีใน Clerk แล้ว -> ต้องรัน db:relink-clerk";
      needsRepair += 1;
    }

    console.log(`${row.email}  |  ${row.role}  |  ${row.status}  |  ${row.clerkId}  |  ${state}`);
  }

  console.log(
    needsRepair === 0
      ? "\n[inspect] ไม่พบบัญชีที่ต้องซ่อม — ถ้ายังเข้าไม่ได้ สาเหตุอยู่ที่อื่น (ดู log ของ /api/auth/me)"
      : `\n[inspect] พบ ${needsRepair} บัญชีที่ต้องซ่อมด้วย:\n` +
          "  DATABASE_DRIVER=... DATABASE_URL=... pnpm db:relink-clerk:env -- <อีเมล> --apply"
  );

  return 0;
}

main()
  .then(async code => {
    await closeDatabase();
    process.exitCode = code;
  })
  .catch(async error => {
    console.error("[inspect] failed:", error);
    await closeDatabase();
    process.exitCode = 1;
  });