import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { users } from "../../shared/schema.js";
import { hashPin } from "../lib/firstPartyAuth.js";
async function main() {
  const [emailArg, pin] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  if (!email || !/^\d{6}$/.test(pin ?? "")) {
    console.error("Usage: pnpm db:set-pin -- user@example.com 123456");
    process.exit(2);
  }
  const [user] = await getDb().select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) { console.error(`ไม่พบบัญชี ${email}`); process.exit(1); }
  await getDb().update(users).set({ pinHash: await hashPin(pin), pinFailedAttempts: 0, pinLockedUntil: null, pinUpdatedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
  console.log(`ตั้ง PIN สำเร็จสำหรับ ${user.email}`);
}
void main().catch(error => { console.error(error); process.exit(1); });
