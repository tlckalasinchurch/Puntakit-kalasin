import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { eq } from "drizzle-orm";

/**
 * A partial `PUT /api/groups/:id` must change only the fields it sends. The map's location dialog
 * sends coordinates and place text, and removing a photo sends only `coverUrl`; neither may reset
 * the group's privacy, status, category or open flag. Real PGlite Postgres, synthetic data.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
const tempDirs: string[] = [];

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe("partial group update keeps the fields it does not send (real PGlite Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let cookie: string;
  let db: Awaited<ReturnType<typeof import("../db/client.js").getDb>>;
  let schema: typeof import("../../shared/schema.js");

  beforeAll(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-group-put-"));
    tempDirs.push(root);
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });
    const client = await import("../db/client.js");
    const bootstrap = await import("../db/bootstrap.js");
    schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await bootstrap.bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    db = client.getDb();
    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        const a = server.address();
        if (typeof a === "object" && a !== null) baseUrl = `http://127.0.0.1:${a.port}`;
        resolve();
      });
    });
    const [admin] = await db.insert(schema.users).values({ email: "a@group-put.local", passwordHash: "x", name: "A", role: "admin" }).returning();
    cookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: admin.id, email: admin.email, role: "admin" })}`;
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await (await import("../db/client.js")).closeDatabase();
  });

  const put = (id: string, body: unknown) =>
    fetch(`${baseUrl}/api/groups/${id}`, { method: "PUT", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body) });
  const makeGroup = async () => {
    const [g] = await db
      .insert(schema.groups)
      .values({ name: "พันธกิจตัวอย่าง", privacy: "confidential", status: "paused", category: "prayer", isOpen: false, area: "เมือง" })
      .returning();
    return g;
  };
  const reload = async (id: string) => (await db.select().from(schema.groups).where(eq(schema.groups.id, id)))[0];

  it("saving coordinates and place text leaves privacy, status, category and the open flag alone", async () => {
    const group = await makeGroup();
    const res = await put(group.id, {
      latitude: "16.432200",
      longitude: "103.506100",
      description: "ซอยข้างวัด",
      meetingDay: "ทุกวันพุธ",
      meetingTime: "19:00",
      meetingLocation: "บ้านตัวอย่าง",
    });
    expect(res.status).toBe(200);
    const after = await reload(group.id);
    expect(after).toMatchObject({
      latitude: "16.432200",
      longitude: "103.506100",
      description: "ซอยข้างวัด",
      meetingDay: "ทุกวันพุธ",
      meetingTime: "19:00",
      meetingLocation: "บ้านตัวอย่าง",
    });
    expect(after).toMatchObject({ privacy: "confidential", status: "paused", category: "prayer", isOpen: false, area: "เมือง" });
  });

  it("removing the photo (only coverUrl) changes nothing else", async () => {
    const group = await makeGroup();
    await db.update(schema.groups).set({ coverUrl: "/api/media/00000000-0000-4000-8000-000000000001" }).where(eq(schema.groups.id, group.id));
    expect((await put(group.id, { coverUrl: "" })).status).toBe(200);
    const after = await reload(group.id);
    expect(after.coverUrl).toBe("");
    expect(after).toMatchObject({ privacy: "confidential", status: "paused", category: "prayer", isOpen: false });
  });

  it("a field that IS sent still changes, including privacy when an admin sends it", async () => {
    const group = await makeGroup();
    expect((await put(group.id, { privacy: "public", status: "active" })).status).toBe(200);
    const after = await reload(group.id);
    expect(after).toMatchObject({ privacy: "public", status: "active", category: "prayer", isOpen: false });
  });

  it("an empty string clears a text field", async () => {
    const group = await makeGroup();
    await put(group.id, { description: "เดิม" });
    expect((await put(group.id, { description: "" })).status).toBe(200);
    expect((await reload(group.id)).description).toBe("");
  });
});
