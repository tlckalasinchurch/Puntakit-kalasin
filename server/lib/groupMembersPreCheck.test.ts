import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Tests the READ-ONLY pre-migration check against a real (embedded) Postgres
 * via PGlite.
 *
 * The scenarios are shaped by what the CURRENT schema actually allows. Today
 * `group_members_group_member_uniq` is a FULL unique index on
 * (group_id, member_id), so a second row for the same pair — a rejoin — is
 * rejected by the database itself. That is why checks 1 and 3 cannot produce
 * a finding yet, and why the swap to a partial index is required for the
 * target behaviour (join → leave → rejoin) at all.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;

const originalEnv = { ...process.env };
const tempDirs: string[] = [];

function setEnv(values: Partial<Record<(typeof MANAGED_KEYS)[number], string | undefined>>): void {
  for (const key of MANAGED_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) process.env[key] = value;
  }
}

function makeTempDataDir(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-precheck-test-"));
  tempDirs.push(root);
  return path.join(root, "nested", ".db_data");
}

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("group_members pre-migration check (read-only)", () => {
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");
  let runCheck: typeof import("./groupMembersPreCheck.js").runGroupMembersPreCheck;

  let group1Id: string;
  let group2Id: string;
  let memberAId: string;
  let memberCId: string;

  beforeAll(async () => {
    setEnv({
      NODE_ENV: "development",
      DATABASE_DRIVER: "pglite",
      PGLITE_DATA_DIR: makeTempDataDir(),
    });

    const client = await import("../db/client.js");
    const bootstrap = await import("../db/bootstrap.js");
    schema = await import("../../shared/schema.js");
    runCheck = (await import("./groupMembersPreCheck.js")).runGroupMembersPreCheck;

    await bootstrap.bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    db = client.getDb();

    const [leader] = await db
      .insert(schema.users)
      .values({ email: "precheck@test.local", passwordHash: "x", name: "Leader", role: "admin" })
      .returning();

    const [group1, group2] = await db
      .insert(schema.groups)
      .values([
        { name: "กลุ่ม ก", leaderId: leader.id },
        { name: "กลุ่ม ข", leaderId: leader.id },
      ])
      .returning();
    group1Id = group1.id;
    group2Id = group2.id;

    const [memberA, , memberC] = await db
      .insert(schema.members)
      .values([
        { name: "สมชาย A", nickname: "สมชาย" },
        { name: "สมหญิง B", nickname: "หญิง" },
        { name: "สมศรี C", nickname: "ศรี" },
      ])
      .returning();
    memberAId = memberA.id;
    memberCId = memberC.id;

    // A healthy current membership.
    await db.insert(schema.groupMembers).values({
      groupId: group1Id,
      memberId: memberAId,
      status: "active",
      joinedAt: new Date("2025-03-01"),
    });

    // Check 4: contradictions between `status` and `left_at`.
    // (Two rows for the same pair are impossible today — see below.)
    await db.insert(schema.groupMembers).values({
      groupId: group2Id,
      memberId: memberCId,
      status: "active",
      joinedAt: new Date("2025-01-01"),
      leftAt: new Date("2025-05-01"),
    });
    const [memberD] = await db
      .insert(schema.members)
      .values({ name: "สมใจ D", nickname: "ใจ", group: "กลุ่ม ก" })
      .returning();
    await db.insert(schema.groupMembers).values({
      groupId: group2Id,
      memberId: memberD.id,
      status: "inactive",
      leftAt: null,
    });
  }, 120_000);

  afterAll(async () => {
    const client = await import("../db/client.js");
    await client.closeDatabase();
  });

  it("counts rows and splits active from historical", async () => {
    const report = await runCheck();
    expect(report.totalRows).toBe(3);
    expect(report.historicalRows).toBe(1);
    expect(report.activeRows).toBe(2);
  });

  it("finds no duplicate pairs and does not block the migration", async () => {
    const report = await runCheck();
    expect(report.duplicatePairsTotal).toBe(0);
    expect(report.duplicatePairRows).toBe(0);
    expect(report.duplicateActivePairs).toBe(0);
    expect(report.migrationBlocked).toBe(false);
  });

  it("counts status contradictions as warnings, not blockers", async () => {
    const report = await runCheck();
    expect(report.activeWithLeftAt).toBe(1);
    expect(report.inactiveWithoutLeftAt).toBe(1);
    expect(report.migrationBlocked).toBe(false);
  });

  it("finds no orphans (FKs hold) and reports legacy group-text rows", async () => {
    const report = await runCheck();
    expect(report.orphanGroupRefs).toBe(0);
    expect(report.orphanMemberRefs).toBe(0);
    expect(report.membersWithLegacyGroupText).toBe(1);
  });

  it("documents why the swap is needed: today rejoin is rejected by the index", async () => {
    // join → leave → rejoin is the target behaviour; today the FULL unique
    // index rejects the second row outright (unique constraint violation).
    let cause = "";
    await expect(
      db
        .insert(schema.groupMembers)
        .values({ groupId: group1Id, memberId: memberAId, status: "active", joinedAt: new Date("2025-09-01") })
    ).rejects.toThrow();
    try {
      await db
        .insert(schema.groupMembers)
        .values({ groupId: group1Id, memberId: memberAId, status: "active", joinedAt: new Date("2025-09-01") });
    } catch (error) {
      cause = String((error as { cause?: { message?: string } }).cause?.message ?? "");
    }
    expect(cause).toMatch(/group_members_group_member_uniq|duplicate key/i);
    const rows = await db.select().from(schema.groupMembers);
    expect(rows.filter((row) => row.memberId === memberAId)).toHaveLength(1);
  });

  it("changes nothing (the check is SELECT-only)", async () => {
    const before = await db.select().from(schema.groupMembers);
    await runCheck();
    const after = await db.select().from(schema.groupMembers);
    expect(after).toHaveLength(before.length);
  });
});