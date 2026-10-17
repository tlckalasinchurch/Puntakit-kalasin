import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** `pnpm db:seed` data set on real PGlite: complete on the first run, a no-op on the second. */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let root: string;

afterAll(async () => {
  await (await import("../db/client.js")).closeDatabase();
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
});

describe("seedLocalDemo", () => {
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let seedLocalDemo: typeof import("./demoSeed.js").seedLocalDemo;
  let DEMO_USER_EMAIL: string;
  let schema: typeof import("../../shared/schema.js");

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-demoseed-"));
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });
    schema = await import("../../shared/schema.js");
    ({ seedLocalDemo, DEMO_USER_EMAIL } = await import("./demoSeed.js"));
    await (await import("../db/bootstrap.js")).bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    db = (await import("../db/client.js")).getDb();
  }, 60_000);

  it("creates the demo admin, one body, two care groups and six members", async () => {
    const { created } = await seedLocalDemo(db);
    expect(created).toEqual({ users: 1, groups: 3, members: 6, groupMembers: 6 });

    const { eq } = await import("drizzle-orm");
    const [demo] = await db.select().from(schema.users).where(eq(schema.users.email, DEMO_USER_EMAIL));
    expect(demo.role).toBe("admin");
    expect(demo.status).toBe("active");

    const care = await db.select().from(schema.groups).where(eq(schema.groups.orgLevel, "care"));
    expect(care).toHaveLength(2);
    expect(care.every((g) => g.parentGroupId !== null && g.leaderMemberId !== null)).toBe(true);

    const all = await db.select().from(schema.members);
    expect(all.filter((m) => m.phone === null)).toHaveLength(1);
  });

  it("is idempotent: a second run inserts nothing", async () => {
    const { created } = await seedLocalDemo(db);
    expect(created).toEqual({ users: 0, groups: 0, members: 0, groupMembers: 0 });
    expect(await db.select().from(schema.members)).toHaveLength(6);
    expect(await db.select().from(schema.groups)).toHaveLength(3);
    expect(await db.select().from(schema.groupMembers)).toHaveLength(6);
  });
});
