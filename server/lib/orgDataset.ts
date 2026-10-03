import { createHash } from "node:crypto";
import { inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { getDatabaseHandle } from "../db/client.js";
import { groupMembers, groups, members } from "../../shared/schema.js";

/**
 * Org dataset loader: body -> care group -> member rows from a prepared
 * dataset file (see the prepared-dataset README, kept outside the repository
 * because it holds personal data). Every id comes from the dataset, so a
 * re-load is a no-op (onConflictDoNothing) and a rollback can name exactly
 * the rows a load created.
 */

const text = z.string().max(2000).default("");
const uuid = z.string().uuid();

export const orgDatasetSchema = z.object({
  org_hierarchy: z
    .array(
      z.object({
        id: uuid,
        level: z.number().int().min(0).max(2),
        title: text,
        name: text,
        body_code: text.optional(),
      })
    )
    .min(1)
    .max(500),
  care_groups: z
    .array(
      z.object({
        id: uuid,
        body_id: uuid,
        sheet_name: z.string().min(1).max(200),
        village: text,
        tambon: text,
        amphoe: text,
        province: text,
        care_code: text,
        care_leader_raw: text,
        coordinator_raw: text,
        declared_member_count: z.union([z.string(), z.number()]).default(""),
      })
    )
    .max(500),
  members: z
    .array(
      z.object({
        id: uuid,
        care_group_id: uuid,
        sheet_name: z.string().max(200).default(""),
        excel_row: z.coerce.number().int(),
        full_name_raw: text,
        nickname_raw: text,
        age_raw: z.coerce.string().max(100).default(""),
        occupation_raw: text,
        workplace_raw: text,
        belief_year_raw: z.coerce.string().max(100).default(""),
        goal_raw: text,
        goal_q1: text,
        goal_q2: text,
        goal_q3: text,
        goal_q4: text,
        builder_raw: text,
        marital_marks: text,
        response_marks: text,
        participation_marks: text,
        flags: text,
      })
    )
    .max(5000),
});
export type OrgDataset = z.infer<typeof orgDatasetSchema>;

/** Deterministic uuid-shaped id for rows the dataset does not carry an id for. */
export function derivedId(key: string): string {
  const h = createHash("sha256").update(`puntakit-seed-v1|${key}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

const clean = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : String(v ?? "").trim());
const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

export type OrgRows = {
  people: Array<typeof members.$inferInsert>;
  bodies: Array<typeof groups.$inferInsert>;
  careGroups: Array<typeof groups.$inferInsert>;
  members: Array<typeof members.$inferInsert>;
  groupMembers: Array<typeof groupMembers.$inferInsert>;
  memberIds: string[];
  groupIds: string[];
  nameFromNickname: number;
};

export function buildOrgRows(dataset: OrgDataset): OrgRows {
  const head = dataset.org_hierarchy.find((o) => o.level === 0);
  const bodyNodes = dataset.org_hierarchy.filter((o) => o.level === 1);
  const careById = new Map(dataset.care_groups.map((g) => [g.id, g]));
  const bodyIds = new Set(bodyNodes.map((b) => b.id));
  for (const g of dataset.care_groups) {
    if (!bodyIds.has(g.body_id)) throw new Error(`care group ${g.id} points to an unknown body`);
  }
  for (const m of dataset.members) {
    if (!careById.has(m.care_group_id)) throw new Error(`member ${m.id} points to an unknown care group`);
  }

  const people: OrgRows["people"] = [];
  if (head?.name) {
    people.push({
      id: derivedId("person|head"),
      name: clean(head.name),
      role: "ศบ.อาจารย์ / หัวหน้าทีม",
      membershipStatus: "active",
      notes: "ผู้นำจังหวัด",
    });
  }
  const bodyHead = new Map<string, string>();
  for (const b of bodyNodes) {
    if (!clean(b.name)) continue;
    const id = derivedId(`person|bodyhead|${b.id}`);
    bodyHead.set(b.id, id);
    people.push({
      id,
      name: clean(b.name),
      role: "หนบ. (หัวหน้าบอดี้)",
      membershipStatus: "active",
      notes: `หัวหน้า${clean(b.title).replace(/^หนบ\.\s*/, "")}`,
    });
  }

  const bodies: OrgRows["bodies"] = bodyNodes.map((b) => ({
    id: b.id,
    name: clean(b.title).replace(/^หนบ\.\s*/, ""),
    orgLevel: "body",
    category: "general",
    leaderMemberId: bodyHead.get(b.id) ?? null,
    description: "บอดี้ (นำเข้าจากข้อมูลต้นฉบับ)",
  }));

  const careGroups: OrgRows["careGroups"] = dataset.care_groups.map((g) => {
    const where = [
      g.village && `หมู่บ้าน${clean(g.village)}`,
      g.tambon && `ตำบล${clean(g.tambon)}`,
      g.amphoe && `อำเภอ${clean(g.amphoe)}`,
      g.province && `จังหวัด${clean(g.province)}`,
    ]
      .filter(Boolean)
      .join(" ");
    const description = [
      g.care_leader_raw && `หนค. (ต้นฉบับ): ${clean(g.care_leader_raw)}`,
      g.coordinator_raw && `ผู้ประสานงาน (ต้นฉบับ): ${clean(g.coordinator_raw)}`,
      g.care_code && `รหัสแคร์: ${clean(g.care_code)}`,
      String(g.declared_member_count) && `จำนวนสมาชิกที่ระบุ: ${g.declared_member_count}`,
    ]
      .filter((x) => x && !String(x).endsWith(": "))
      .join("\n");
    return {
      id: g.id,
      name: clean(g.sheet_name),
      orgLevel: "care" as const,
      parentGroupId: g.body_id,
      category: "cell" as const,
      area: clean(g.amphoe) || null,
      meetingLocation: where || null,
      description: description || null,
    };
  });

  let nameFromNickname = 0;
  const memberRows: OrgRows["members"] = [];
  const gmRows: OrgRows["groupMembers"] = [];
  for (const m of dataset.members) {
    const care = careById.get(m.care_group_id)!;
    const full = clean(m.full_name_raw);
    const nick = clean(m.nickname_raw);
    const name = full || nick || `ไม่ระบุชื่อ (${clean(care.sheet_name)} แถว ${m.excel_row})`;
    if (!full) nameFromNickname += 1;
    const quarters = [m.goal_q1, m.goal_q2, m.goal_q3, m.goal_q4].map(clean);
    const notes = [
      !full && "ไม่มีชื่อ-สกุลในต้นฉบับ (ใช้ชื่อเล่นแทน)",
      clean(m.age_raw) && `อายุ (ต้นฉบับ): ${clean(m.age_raw)}`,
      clean(m.occupation_raw) && `อาชีพ: ${clean(m.occupation_raw)}`,
      clean(m.workplace_raw) && `สถานที่เรียน/ทำงาน: ${clean(m.workplace_raw)}`,
      clean(m.belief_year_raw) && `ปีรับเชื่อ (ต้นฉบับ): ${clean(m.belief_year_raw)}`,
      clean(m.goal_raw) && `เป้าหมายในการสร้าง: ${clean(m.goal_raw)}`,
      quarters.some(Boolean) && `Q1-Q4: ${quarters.join(" | ")}`,
      clean(m.builder_raw) && `ผู้รับผิดชอบสร้าง: ${clean(m.builder_raw)}`,
      `เครื่องหมายช่อง (ตำแหน่งดิบ, ความหมายยังไม่ยืนยัน): สถานภาพ[${m.marital_marks}] ท่าที[${m.response_marks}] เข้าร่วม[${m.participation_marks}]`,
      clean(m.flags) && `ธงตรวจข้อมูล: ${clean(m.flags)}`,
      `แหล่งที่มา: ชีต ${clean(m.sheet_name)} แถว ${m.excel_row}`,
    ]
      .filter(Boolean)
      .join("\n");
    memberRows.push({
      id: m.id,
      name,
      nickname: nick || null,
      role: "สมาชิก",
      area: clean(care.amphoe) || null,
      group: clean(care.sheet_name),
      membershipStatus: "active",
      notes,
    });
    gmRows.push({ id: derivedId(`gm|${m.id}`), groupId: m.care_group_id, memberId: m.id, role: "member", status: "active" });
  }

  return {
    people,
    bodies,
    careGroups,
    members: memberRows,
    groupMembers: gmRows,
    memberIds: [...people, ...memberRows].map((r) => r.id!),
    groupIds: [...bodies, ...careGroups].map((r) => r.id!),
    nameFromNickname,
  };
}

/**
 * Runs the statements as ONE unit: neon-http has no transactions, but
 * db.batch() sends the statements in one request that commits or rolls back
 * together; the other drivers use a normal transaction.
 */
async function runAtomically(build: (db: Database) => unknown[]): Promise<void> {
  const handle = getDatabaseHandle();
  if (handle.driver === "neon") {
    const statements = build(handle.db as unknown as Database);
    if (statements.length) await handle.db.batch(statements as unknown as Parameters<typeof handle.db.batch>[0]);
    return;
  }
  await (handle.db as unknown as Database).transaction(async (tx) => {
    for (const statement of build(tx as unknown as Database)) await statement;
  });
}

export async function describeOrgLoad(db: Database, rows: OrgRows) {
  const present = async (table: typeof members | typeof groups, ids: string[]) => {
    let n = 0;
    for (const c of chunk(ids, 500)) n += (await db.select({ id: table.id }).from(table).where(inArray(table.id, c))).length;
    return n;
  };
  const [{ c: totalMembers }] = await db.select({ c: sql<number>`cast(count(*) as int)` }).from(members);
  const [{ c: totalGroups }] = await db.select({ c: sql<number>`cast(count(*) as int)` }).from(groups);
  return {
    plan: {
      people: rows.people.length,
      bodies: rows.bodies.length,
      careGroups: rows.careGroups.length,
      members: rows.members.length,
      groupMembers: rows.groupMembers.length,
      nameFromNickname: rows.nameFromNickname,
    },
    alreadyPresent: { members: await present(members, rows.memberIds), groups: await present(groups, rows.groupIds) },
    targetBefore: { members: totalMembers, groups: totalGroups },
  };
}

export async function applyOrgLoad(rows: OrgRows): Promise<void> {
  await runAtomically((db) => [
    ...chunk(rows.people, 150).map((c) => db.insert(members).values(c).onConflictDoNothing()),
    ...chunk(rows.bodies, 150).map((c) => db.insert(groups).values(c).onConflictDoNothing()),
    ...chunk(rows.careGroups, 150).map((c) => db.insert(groups).values(c).onConflictDoNothing()),
    ...chunk(rows.members, 150).map((c) => db.insert(members).values(c).onConflictDoNothing()),
    ...chunk(rows.groupMembers, 150).map((c) => db.insert(groupMembers).values(c).onConflictDoNothing()),
  ]);
}

/** Deletes exactly the rows a load of this dataset would create (cascades remove group_members). */
export async function rollbackOrgLoad(rows: OrgRows): Promise<void> {
  await runAtomically((db) => [
    ...chunk(rows.memberIds, 500).map((c) => db.delete(members).where(inArray(members.id, c))),
    ...chunk(rows.groupIds, 500).map((c) => db.delete(groups).where(inArray(groups.id, c))),
  ]);
}
