import { and, asc, eq, isNull } from "drizzle-orm";
import { bootstrapDatabase } from "../db/bootstrap.js";
import { closeDatabase, getDb } from "../db/client.js";
import { groups, users } from "../../shared/schema.js";
import { hashPin } from "../lib/firstPartyAuth.js";

const BODY_PINS = ["111111", "222222", "333333", "444444", "555555", "666666"] as const;

/**
 * `pnpm db:setup-body-pins` — ensures 6 body groups exist, assigns a
 * `group_leader` account to each body, and sets their 6-digit login PINs
 * to 111111..666666. Idempotent.
 */
async function main(): Promise<number> {
  try {
    await bootstrapDatabase();
    const db = getDb();

    const existingBodies = await db
      .select({
        id: groups.id,
        name: groups.name,
        leaderId: groups.leaderId,
      })
      .from(groups)
      .where(and(eq(groups.orgLevel, "body"), isNull(groups.deletedAt)))
      .orderBy(asc(groups.name));

    const results: { body: string; email: string; name: string; pin: string }[] = [];

    for (let index = 0; index < BODY_PINS.length; index++) {
      const slot = index + 1;
      const pin = BODY_PINS[index];
      let body = existingBodies[index];

      if (!body) {
        const [createdBody] = await db
          .insert(groups)
          .values({
            name: `บอดี้ ${slot}`,
            orgLevel: "body",
            category: "cell",
            status: "active",
          })
          .returning({ id: groups.id, name: groups.name, leaderId: groups.leaderId });
        body = createdBody;
      }

      const pinHash = await hashPin(pin);
      const now = new Date();
      let leaderEmail = `body${slot}@puntakit.local`;
      let leaderName = `หัวหน้า${body.name}`;

      if (body.leaderId) {
        const [existingLeader] = await db
          .select({ id: users.id, email: users.email, name: users.name })
          .from(users)
          .where(eq(users.id, body.leaderId))
          .limit(1);

        if (existingLeader) {
          await db
            .update(users)
            .set({
              pinHash,
              pinFailedAttempts: 0,
              pinLockedUntil: null,
              pinUpdatedAt: now,
              updatedAt: now,
            })
            .where(eq(users.id, existingLeader.id));
          leaderEmail = existingLeader.email;
          leaderName = existingLeader.name;
          results.push({ body: body.name, email: leaderEmail, name: leaderName, pin });
          continue;
        }
      }

      const [existingByEmail] = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.email, leaderEmail))
        .limit(1);

      let leaderId: string;
      if (existingByEmail) {
        await db
          .update(users)
          .set({
            role: "group_leader",
            pinHash,
            pinFailedAttempts: 0,
            pinLockedUntil: null,
            pinUpdatedAt: now,
            updatedAt: now,
          })
          .where(eq(users.id, existingByEmail.id));
        leaderId = existingByEmail.id;
        leaderName = existingByEmail.name;
      } else {
        const [createdUser] = await db
          .insert(users)
          .values({
            email: leaderEmail,
            name: leaderName,
            role: "group_leader",
            pinHash,
            pinUpdatedAt: now,
          })
          .returning({ id: users.id });
        leaderId = createdUser.id;
      }

      await db
        .update(groups)
        .set({ leaderId, updatedAt: now })
        .where(eq(groups.id, body.id));

      results.push({ body: body.name, email: leaderEmail, name: leaderName, pin });
    }

    console.table(results);
    return 0;
  } catch (error) {
    console.error("[db:setup-body-pins] failed:", error);
    return 1;
  } finally {
    await closeDatabase();
  }
}

main().then((exitCode) => {
  process.exitCode = exitCode;
});
