import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { groupMembers, groups, members, users } from "../../shared/schema.js";

/** Local-dev demo account; demo mode (PUNTAKIT_DEMO_MODE=1) looks the user up by this email. */
export const DEMO_USER_EMAIL = "demo@puntakit.local";

const BODY_NAME = "บอดี้ตัวอย่าง";

/** Fictional people with obviously fake phone numbers; one has no phone on purpose. */
const CARE_GROUPS: ReadonlyArray<{ name: string; people: ReadonlyArray<{ name: string; nickname: string | null; phone: string | null }> }> = [
  {
    name: "พันธกิจตัวอย่าง 1",
    people: [
      { name: "สมชาย ใจดี", nickname: "ชาย", phone: "0800000001" },
      { name: "เอกชัย รักษา", nickname: "เอก", phone: "0800000002" },
      { name: "แพรวา สุขสม", nickname: "แพร", phone: "0800000003" },
    ],
  },
  {
    name: "พันธกิจตัวอย่าง 2",
    people: [
      { name: "โบนัส ศรีสวัสดิ์", nickname: "โบ", phone: null },
      { name: "ไพรินทร์ มีสุข", nickname: "ไก่", phone: "0800000005" },
      { name: "อรทัย บุญมา", nickname: null, phone: "0800000006" },
    ],
  },
];

export interface DemoSeedResult {
  /** Rows inserted by this run; all zero on a re-run. */
  created: { users: number; groups: number; members: number; groupMembers: number };
}

/**
 * Idempotent: every row is looked up by its natural key (email, group name,
 * member name, group+member) and only inserted when missing, so re-running
 * never duplicates anything and never overwrites edits.
 */
export async function seedLocalDemo(db: Database): Promise<DemoSeedResult> {
  const created = { users: 0, groups: 0, members: 0, groupMembers: 0 };

  const insertedUser = await db
    .insert(users)
    .values({ email: DEMO_USER_EMAIL, name: "Demo", role: "admin" })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  created.users = insertedUser.length;

  const findGroup = async (name: string, orgLevel: "body" | "care") =>
    (await db.select().from(groups).where(and(eq(groups.name, name), eq(groups.orgLevel, orgLevel), isNull(groups.deletedAt))).limit(1))[0];

  let body = await findGroup(BODY_NAME, "body");
  if (!body) {
    [body] = await db.insert(groups).values({ name: BODY_NAME, orgLevel: "body" }).returning();
    created.groups++;
  }

  for (const def of CARE_GROUPS) {
    let care = await findGroup(def.name, "care");
    if (!care) {
      [care] = await db.insert(groups).values({ name: def.name, orgLevel: "care", parentGroupId: body.id }).returning();
      created.groups++;
    }

    let leaderMemberId: string | null = care.leaderMemberId;
    for (let index = 0; index < def.people.length; index++) {
      const person = def.people[index];
      let member = (await db.select().from(members).where(and(eq(members.name, person.name), isNull(members.deletedAt))).limit(1))[0];
      if (!member) {
        [member] = await db.insert(members).values({ ...person, membershipStatus: "active" }).returning();
        created.members++;
      }
      if (index === 0 && !leaderMemberId) leaderMemberId = member.id;

      const link = await db
        .insert(groupMembers)
        .values({ groupId: care.id, memberId: member.id, role: index === 0 ? "leader" : "member" })
        .onConflictDoNothing({ target: [groupMembers.groupId, groupMembers.memberId] })
        .returning({ id: groupMembers.id });
      created.groupMembers += link.length;
    }

    if (leaderMemberId && leaderMemberId !== care.leaderMemberId) {
      await db.update(groups).set({ leaderMemberId }).where(eq(groups.id, care.id));
    }
  }

  return { created };
}
