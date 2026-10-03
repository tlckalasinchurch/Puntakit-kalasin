import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { sql } from "drizzle-orm";

/**
 * Proves the dry-run SQL in server/db/pending/ works on a real (embedded)
 * Postgres, without applying it anywhere else. The file is NOT part of the
 * migration chain; this test is the only thing that runs it.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let tempRoot: string;

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe("pending migration 0010_group_members_history (dry-run SQL)", () => {
  let db: Awaited<ReturnType<typeof import("./client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");
  let groupId: string;
  let memberId: string;

  beforeAll(async () => {
    for (const key of MANAGED_KEYS) delete process.env[key];
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-pending0010-"));
    process.env.NODE_ENV = "development";
    process.env.DATABASE_DRIVER = "pglite";
    process.env.PGLITE_DATA_DIR = path.join(tempRoot, ".db_data");

    const client = await import("./client.js");
    const bootstrap = await import("./bootstrap.js");
    schema = await import("../../shared/schema.js");
    await bootstrap.bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    db = client.getDb();

    const [leader] = await db
      .insert(schema.users)
      .values({ email: "pending0010@test.local", passwordHash: "x", name: "Leader", role: "admin" })
      .returning();
    const [group] = await db.insert(schema.groups).values({ name: "กลุ่ม ก", leaderId: leader.id }).returning();
    const [member] = await db.insert(schema.members).values({ name: "สมชาย", nickname: "ชาย" }).returning();
    groupId = group.id;
    memberId = member.id;
  });

  it("rejects a rejoin before the swap, allows it after, and still blocks two current rows", async () => {
    await db.insert(schema.groupMembers).values({ groupId, memberId, leftAt: new Date() });
    await expect(db.insert(schema.groupMembers).values({ groupId, memberId })).rejects.toThrow();

    const file = fs.readFileSync(path.join(__dirname, "pending", "0010_group_members_history.sql"), "utf8");
    for (const statement of file.split("--> statement-breakpoint")) {
      await db.execute(sql.raw(statement));
    }

    await db.insert(schema.groupMembers).values({ groupId, memberId });
    await expect(db.insert(schema.groupMembers).values({ groupId, memberId })).rejects.toThrow();
  });
});
