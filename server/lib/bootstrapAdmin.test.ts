import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { eq } from "drizzle-orm";

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE", "BOOTSTRAP_ADMIN_EMAILS"] as const;
const originalEnv = { ...process.env };
let root: string;

afterAll(async () => {
  await (await import("../db/client.js")).closeDatabase();
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
});

describe("first-admin bootstrap", () => {
  let schema: typeof import("../../shared/schema.js");
  let lib: typeof import("./bootstrapAdmin.js");
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-boot-admin-"));
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });
    const client = await import("../db/client.js");
    schema = await import("../../shared/schema.js");
    lib = await import("./bootstrapAdmin.js");
    await (await import("../db/bootstrap.js")).bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    db = client.getDb();
  }, 120_000);

  const make = async (email: string, role: "member" | "admin" | "staff") =>
    (await db.insert(schema.users).values({ email, passwordHash: "x", name: "T", role }).returning())[0];
  const allow = (...e: string[]) => new Set(e);

  it("parses a comma-separated list, trimmed and lower-cased", () => {
    expect([...lib.parseBootstrapAdminEmails(" A@x.com, b@y.com ,,")]).toEqual(["a@x.com", "b@y.com"]);
    expect(lib.parseBootstrapAdminEmails(undefined).size).toBe(0);
  });

  it("promotes a verified, listed member to super_admin and audits it", async () => {
    const u = await make("first@boot.local", "member");
    const out = await lib.applyBootstrapAdmin(u, { emailVerified: true, allowList: allow("FIRST@boot.local".toLowerCase()) });
    expect(out.role).toBe("super_admin");
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    expect(row.role).toBe("super_admin");
    const audits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, "BOOTSTRAP_ADMIN_GRANTED"));
    expect(audits).toHaveLength(1);
  });

  it("does nothing when the email is unverified, unlisted, or the list is empty", async () => {
    const a = await make("unverified@boot.local", "member");
    expect((await lib.applyBootstrapAdmin(a, { emailVerified: false, allowList: allow(a.email) })).role).toBe("member");
    const b = await make("unlisted@boot.local", "staff");
    expect((await lib.applyBootstrapAdmin(b, { emailVerified: true, allowList: allow("other@boot.local") })).role).toBe("staff");
    const c = await make("empty@boot.local", "member");
    expect((await lib.applyBootstrapAdmin(c, { emailVerified: true, allowList: allow() })).role).toBe("member");
  });

  it("never changes an account that is already admin", async () => {
    const a = await make("admin@boot.local", "admin");
    const out = await lib.applyBootstrapAdmin(a, { emailVerified: true, allowList: allow(a.email) });
    expect(out.role).toBe("admin");
  });
});
