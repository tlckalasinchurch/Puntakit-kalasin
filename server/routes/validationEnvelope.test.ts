import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Rejected input on the admin content routes must use the standard error
 * envelope (`error.code`, `error.message`, `error.details`). A bare string made
 * the browser show "ดำเนินการไม่สำเร็จ" and hide which field was wrong.
 */

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let root: string;

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
});

describe("validation error envelope (real PGlite Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let cookie: string;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-validation-"));
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await (await import("../db/bootstrap.js")).bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    const [admin] = await client.getDb().insert(schema.users).values({ email: "a@env.local", passwordHash: "x", name: "A", role: "admin" }).returning();
    cookie = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: admin.id, email: admin.email, role: "admin" })}`;
    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        const a = server.address();
        if (typeof a === "object" && a !== null) baseUrl = `http://127.0.0.1:${a.port}`;
        resolve();
      });
    });
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await (await import("../db/client.js")).closeDatabase();
  });

  const send = async (method: string, url: string, body: unknown) => {
    const res = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as { success: boolean; error: { code: string; message: string; details: Array<{ field: string; message: string }> } } };
  };

  it.each([
    ["POST", "/api/ministries", { name: "  " }, "name", "กรุณากรอกชื่อฝ่ายงาน"],
    ["POST", "/api/events", { title: "", eventDate: "2026-10-10T10:00" }, "title", "กรุณากรอกชื่องาน"],
    ["POST", "/api/announcements", { title: "", content: "x" }, "title", undefined],
    ["PUT", "/api/church-profile", { name: "โบสถ์", phone: "xyz" }, "phone", "เบอร์โทรใช้ได้เฉพาะตัวเลขและเครื่องหมาย + - ( )"],
  ])("%s %s returns VALIDATION_ERROR with the field", async (method, url, body, field, message) => {
    const { status, json } = await send(method, url, body);
    expect(status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    const detail = json.error.details.find((d) => d.field === field);
    expect(detail, `details for ${field}`).toBeDefined();
    if (message) expect(detail!.message).toBe(message);
  });
});
