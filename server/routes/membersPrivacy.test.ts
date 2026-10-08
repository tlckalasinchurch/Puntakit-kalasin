import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { maskEmail, maskPhone } from "./members.js";

/**
 * Contact privacy on the member directory (real PGlite Postgres, synthetic data).
 *
 * Covers the three leaks found in the 2026-10 audit: the phone mask missed
 * formatted numbers, phone/email search worked for roles that only see masked
 * contacts, and `check-duplicate` answered any signed-in role.
 */

describe("maskPhone / maskEmail", () => {
  it.each([
    ["0812345678", "081-xxx-678"],
    ["081-234-5678", "081-xxx-678"],
    ["+66 81 234 5678", "668-xxx-678"],
    ["043 811 800", "043-xxx-800"],
    ["(043) 811800", "043-xxx-800"],
  ])("masks %s", (input, expected) => {
    expect(maskPhone(input)).toBe(expected);
  });

  it("hides a value with too few digits entirely", () => {
    expect(maskPhone("abc")).toBe("xxx");
    expect(maskPhone("12345")).toBe("xxx");
  });

  it.each([
    ["test.member@example.com", "te***@example.com"],
    ["ab@example.com", "a***@example.com"],
    ["a@example.com", "a***@example.com"],
    ["not-an-email", "***"],
  ])("masks %s", (input, expected) => {
    expect(maskEmail(input)).toBe(expected);
  });
});

const MANAGED_KEYS = ["NODE_ENV", "DATABASE_DRIVER", "DATABASE_URL", "USE_LOCAL_DB", "PGLITE_DATA_DIR", "DB_AUTO_MIGRATE"] as const;
const originalEnv = { ...process.env };
let root: string;

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
});

describe("GET /api/members contact privacy", () => {
  let server: Server;
  let baseUrl: string;
  const cookies: Record<string, string> = {};

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-memberspriv-"));
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_DRIVER: "pglite", PGLITE_DATA_DIR: path.join(root, ".db_data") });
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await (await import("../db/bootstrap.js")).bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    const db = client.getDb();
    await db.insert(schema.members).values([
      { name: "สมชาย ทดสอบ", phone: "081-234-5678", email: "somchai@example.com" },
      { name: "สมหญิง ตัวอย่าง", phone: "0899999999" },
    ]);
    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        const a = server.address();
        if (typeof a === "object" && a !== null) baseUrl = `http://127.0.0.1:${a.port}`;
        resolve();
      });
    });
    for (const role of ["admin", "staff", "member", "viewer", "group_leader"] as const) {
      const [u] = await db.insert(schema.users).values({ email: `${role}@priv.local`, passwordHash: "x", name: role, role }).returning();
      cookies[role] = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: u.id, email: u.email, role })}`;
    }
  }, 120_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await (await import("../db/client.js")).closeDatabase();
  });

  const list = async (role: string, qs = "") => {
    const res = await fetch(`${baseUrl}/api/members${qs}`, { headers: { Cookie: cookies[role] } });
    return { status: res.status, body: (await res.json()) as { data: Array<{ name: string; phone: string | null; email: string | null }> } };
  };

  it("masks a formatted phone number and the email for a viewer-role account", async () => {
    const { status, body } = await list("viewer");
    expect(status).toBe(200);
    const row = body.data.find((m) => m.name === "สมชาย ทดสอบ")!;
    expect(row.phone).toBe("081-xxx-678");
    expect(row.email).toBe("so***@example.com");
  });

  it("member role cannot access the admin members API (403)", async () => {
    const { status } = await list("member");
    expect(status).toBe(403);
  });

  it("returns real contacts to staff and admin", async () => {
    const { body } = await list("staff");
    expect(body.data.find((m) => m.name === "สมชาย ทดสอบ")!.phone).toBe("081-234-5678");
  });

  it.each(["viewer", "group_leader"])("%s cannot find a member by phone or email", async (role) => {
    expect((await list(role, "?search=234-5678")).body.data).toHaveLength(0);
    expect((await list(role, "?search=somchai@example.com")).body.data).toHaveLength(0);
  });

  it("viewer can still search by name", async () => {
    expect((await list("viewer", `?search=${encodeURIComponent("สมชาย")}`)).body.data).toHaveLength(1);
  });

  it("admin and staff can search by phone and email", async () => {
    for (const role of ["admin", "staff"]) {
      expect((await list(role, "?search=234-5678")).body.data).toHaveLength(1);
      expect((await list(role, "?search=somchai@example.com")).body.data).toHaveLength(1);
    }
  });

  it("check-duplicate answers staff-level roles only", async () => {
    const url = `${baseUrl}/api/members/check-duplicate?phone=${encodeURIComponent("081-234-5678")}`;
    for (const role of ["member", "viewer"]) {
      expect((await fetch(url, { headers: { Cookie: cookies[role] } })).status).toBe(403);
    }
    const res = await fetch(url, { headers: { Cookie: cookies.admin } });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: { isDuplicate: boolean } }).data.isDuplicate).toBe(true);
  });
});
