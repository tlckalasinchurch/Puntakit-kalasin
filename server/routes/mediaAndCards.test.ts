import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Member photos, mission photos and the membership card data, against a real
 * PGlite database with synthetic data. Images are tiny hand-made byte
 * sequences (no real photo is used anywhere).
 */

const MANAGED_KEYS = [
  "NODE_ENV",
  "DATABASE_DRIVER",
  "DATABASE_URL",
  "USE_LOCAL_DB",
  "PGLITE_DATA_DIR",
  "DB_AUTO_MIGRATE",
  "BLOB_READ_WRITE_TOKEN",
  "PUNTAKIT_MEDIA_DIR",
] as const;
const originalEnv = { ...process.env };
let root: string;

afterAll(() => {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, originalEnv);
  fs.rmSync(root, { recursive: true, force: true });
});

// Minimal valid-looking images: only the signature bytes matter to `sniffImage`.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("fake-jpeg-body-1")]);
const JPEG2 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("fake-jpeg-body-2")]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("fake-png")]);
const NOT_IMAGE = Buffer.from("<script>alert(1)</script>");

describe("media upload, member cards", () => {
  let server: Server;
  let baseUrl: string;
  const cookies: Record<string, string> = {};
  const ids = {} as Record<"m1" | "m2" | "c1" | "c2", string>;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-media-"));
    for (const key of MANAGED_KEYS) delete process.env[key];
    Object.assign(process.env, {
      NODE_ENV: "development",
      DATABASE_DRIVER: "pglite",
      PGLITE_DATA_DIR: path.join(root, ".db_data"),
      PUNTAKIT_MEDIA_DIR: path.join(root, "media"),
    });
    const client = await import("../db/client.js");
    const schema = await import("../../shared/schema.js");
    const authLib = await import("../lib/auth.js");
    const { createApp } = await import("../app.js");
    await (await import("../db/bootstrap.js")).bootstrapDatabase({ logger: { log: () => {}, warn: () => {} } });
    const db = client.getDb();

    const mkUser = async (key: string, role: (typeof schema.USER_ROLES)[number]) => {
      const [u] = await db.insert(schema.users).values({ email: `${key}@md.local`, passwordHash: "x", name: key, role }).returning();
      cookies[key] = `${authLib.AUTH_COOKIE_NAME}=${authLib.signAuthToken({ sub: u.id, email: u.email, role })}`;
      return u;
    };
    await mkUser("admin", "admin");
    await mkUser("staff", "staff");
    await mkUser("viewer", "viewer");
    await mkUser("ministry", "ministry_leader");
    const careA = await mkUser("careA", "group_leader");
    const careB = await mkUser("careB", "group_leader");
    const bodyLead = await mkUser("bodyLead", "group_leader");
    const self = await mkUser("self", "member");

    const [body] = await db.insert(schema.groups).values({ name: "บอดี้ 1", orgLevel: "body", leaderId: bodyLead.id }).returning();
    const [c1] = await db.insert(schema.groups).values({ name: "แคร์ A", orgLevel: "care", parentGroupId: body.id, leaderId: careA.id }).returning();
    const [c2] = await db.insert(schema.groups).values({ name: "แคร์ B", orgLevel: "care", leaderId: careB.id }).returning();
    ids.c1 = c1.id;
    ids.c2 = c2.id;
    await db.insert(schema.churchProfile).values({ id: "main", name: "คริสตจักรทดสอบ" });
    const [m1, m2] = await db
      .insert(schema.members)
      .values([
        { name: "สุรชัย ทดสอบ", nickname: "ชัย", phone: "081-111-1111", email: "chai@example.com", address: "บ้านเลขที่ 1", userId: self.id },
        { name: "สมศรี ตัวอย่าง", phone: "082-222-2222" },
      ])
      .returning();
    ids.m1 = m1.id;
    ids.m2 = m2.id;
    await db.insert(schema.groupMembers).values([
      { groupId: c1.id, memberId: m1.id },
      { groupId: c2.id, memberId: m2.id },
    ]);

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

  const upload = async (role: string | null, query: string, bytes: Buffer, contentType = "image/jpeg") => {
    const res = await fetch(`${baseUrl}/api/media?${query}`, {
      method: "POST",
      headers: { "Content-Type": contentType, ...(role ? { Cookie: cookies[role] } : {}) },
      body: new Uint8Array(bytes),
    });
    return { status: res.status, json: (await res.json()) as { data?: { id: string; url: string }; error?: { message: string } } };
  };
  const fetchImage = async (role: string | null, url: string) => {
    const res = await fetch(`${baseUrl}${url}`, { headers: role ? { Cookie: cookies[role] } : {} });
    return { status: res.status, type: res.headers.get("content-type"), body: Buffer.from(await res.arrayBuffer()), headers: res.headers };
  };
  const getJson = async (role: string, url: string) => {
    const res = await fetch(`${baseUrl}${url}`, { headers: { Cookie: cookies[role] } });
    return { status: res.status, json: (await res.json()) as { data?: any; error?: { message: string } } };
  };

  describe("member photo", () => {
    let firstUrl: string;

    it("rejects unauthenticated, viewer and ministry_leader uploads", async () => {
      expect((await upload(null, `kind=member_avatar&memberId=${ids.m1}`, JPEG)).status).toBe(401);
      expect((await upload("viewer", `kind=member_avatar&memberId=${ids.m1}`, JPEG)).status).toBe(403);
    });

    it("rejects a file that is not an image even when it claims to be one", async () => {
      const res = await upload("admin", `kind=member_avatar&memberId=${ids.m1}`, NOT_IMAGE, "image/jpeg");
      expect(res.status).toBe(400);
    });

    it("rejects an unknown kind and a missing member", async () => {
      expect((await upload("admin", `kind=banner&memberId=${ids.m1}`, JPEG)).status).toBe(400);
      expect((await upload("admin", `kind=member_avatar`, JPEG)).status).toBe(400);
    });

    it("admin uploads: avatarUrl on the register points at the new image and the card reads it", async () => {
      const res = await upload("admin", `kind=member_avatar&memberId=${ids.m1}`, JPEG);
      expect(res.status).toBe(201);
      firstUrl = res.json.data!.url;
      expect(firstUrl).toMatch(/^\/api\/media\/[0-9a-f-]{36}$/);
      const card = await getJson("admin", `/api/member-cards/${ids.m1}`);
      expect(card.json.data.avatarUrl).toBe(firstUrl);
      const img = await fetchImage("admin", firstUrl);
      expect(img.status).toBe(200);
      expect(img.type).toBe("image/jpeg");
      expect(img.body.equals(JPEG)).toBe(true);
      expect(img.headers.get("cache-control")).toContain("private");
    });

    it("a changed photo shows on the very next card load, and the old one is retired", async () => {
      const res = await upload("staff", `kind=member_avatar&memberId=${ids.m1}`, JPEG2);
      expect(res.status).toBe(201);
      const card = await getJson("admin", `/api/member-cards/${ids.m1}`);
      expect(card.json.data.avatarUrl).toBe(res.json.data!.url);
      expect(card.json.data.avatarUrl).not.toBe(firstUrl);
      expect((await fetchImage("admin", firstUrl)).status).toBe(404);
      expect((await fetchImage("admin", res.json.data!.url)).body.equals(JPEG2)).toBe(true);
    });

    it("a care leader changes photos only inside their own group", async () => {
      expect((await upload("careA", `kind=member_avatar&memberId=${ids.m1}`, PNG, "image/png")).status).toBe(201);
      expect((await upload("careA", `kind=member_avatar&memberId=${ids.m2}`, PNG, "image/png")).status).toBe(403);
    });

    it("another care leader cannot read the photo (404, indistinguishable from missing)", async () => {
      const card = await getJson("admin", `/api/member-cards/${ids.m1}`);
      const url = card.json.data.avatarUrl as string;
      expect((await fetchImage("careB", url)).status).toBe(404);
      expect((await fetchImage("careA", url)).status).toBe(200);
      expect((await fetchImage(null, url)).status).toBe(401);
    });

    it("a body leader can load the photos of members in the care groups under their body, and no others", async () => {
      const m1Url = (await getJson("admin", `/api/member-cards/${ids.m1}`)).json.data.avatarUrl as string;
      expect((await fetchImage("bodyLead", m1Url)).status).toBe(200); // care A is under their body
      const up = await upload("admin", `kind=member_avatar&memberId=${ids.m2}`, JPEG2);
      expect((await fetchImage("bodyLead", up.json.data!.url)).status).toBe(404); // care B is not
    });

    it("a member can see their own photo", async () => {
      const card = await getJson("admin", `/api/member-cards/${ids.m1}`);
      expect((await fetchImage("self", card.json.data.avatarUrl)).status).toBe(200);
    });

    it("refuses a path-traversal id and an unknown id", async () => {
      expect((await fetchImage("admin", "/api/media/..%2f..%2fetc%2fpasswd")).status).toBe(404);
      expect((await fetchImage("admin", "/api/media/00000000-0000-4000-8000-000000000000")).status).toBe(404);
    });
  });

  describe("mission photo", () => {
    it("a care leader uploads for their own group only", async () => {
      expect((await upload("careA", `kind=mission_photo&groupId=${ids.c1}`, JPEG)).status).toBe(201);
      expect((await upload("careA", `kind=mission_photo&groupId=${ids.c2}`, JPEG)).status).toBe(403);
      // A group_leader must name a group.
      expect((await upload("careA", `kind=mission_photo`, JPEG)).status).toBe(403);
    });

    it("viewers cannot upload; office roles can", async () => {
      expect((await upload("viewer", `kind=mission_photo&groupId=${ids.c1}`, JPEG)).status).toBe(403);
      expect((await upload("staff", `kind=mission_photo&groupId=${ids.c1}`, JPEG)).status).toBe(201);
    });

    it("the photo can be attached to a mission activity via the existing API and is then listed with its URL", async () => {
      const up = await upload("careA", `kind=mission_photo&groupId=${ids.c1}`, JPEG);
      const url = up.json.data!.url;
      const created = await fetch(`${baseUrl}/api/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookies.careA },
        body: JSON.stringify({
          type: "ministry_update",
          title: "อัปเดตภาพพันธกิจ (ทดสอบ)",
          occurredAt: new Date().toISOString(),
          groupId: ids.c1,
          media: [{ url, kind: "image" }],
        }),
      });
      expect(created.status).toBe(201);
      const detail = (await created.json()) as { data: { id: string; media: Array<{ url: string }> } };
      expect(detail.data.id).toBeTruthy();
      const got = await getJson("careA", `/api/activities/${detail.data.id}`);
      expect(got.json.data.media[0].url).toBe(url);
      // The leader who took it can open it; a leader of another group cannot (draft).
      expect((await fetchImage("careA", url)).status).toBe(200);
      expect((await fetchImage("careB", url)).status).toBe(404);
      expect((await fetchImage("viewer", url)).status).toBe(404); // a draft is not for viewers

      // Once an authorised person publishes the activity, its photo is readable like the Feed itself
      // — by other leaders and viewers, never by the member role.
      const published = await fetch(`${baseUrl}/api/activities/${detail.data.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookies.admin },
        body: JSON.stringify({ status: "published" }),
      });
      expect(published.status).toBe(200);
      expect((await fetchImage("careB", url)).status).toBe(200);
      expect((await fetchImage("viewer", url)).status).toBe(200);
      expect((await fetchImage("self", url)).status).toBe(404);
    });

    it("mission media only accepts http(s) URLs or the app's own /api/media/<uuid> path", async () => {
      const post = (url: string) =>
        fetch(`${baseUrl}/api/activities`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookies.admin },
          body: JSON.stringify({ type: "other", title: "ทดสอบ url", occurredAt: new Date().toISOString(), media: [{ url, kind: "image" }] }),
        });
      expect((await post("/api/members")).status).toBe(400);
      expect((await post("/api/media/not-a-uuid")).status).toBe(400);
      expect((await post("https://example.com/a.jpg")).status).toBe(201);
    });
  });

  describe("membership card data", () => {
    it("is read from the register and never carries contact details", async () => {
      const res = await getJson("admin", `/api/member-cards/${ids.m1}`);
      expect(res.status).toBe(200);
      expect(res.json.data).toMatchObject({ name: "สุรชัย ทดสอบ", nickname: "ชัย", careGroupName: "แคร์ A", churchName: "คริสตจักรทดสอบ" });
      const text = JSON.stringify(res.json.data);
      expect(text).not.toContain("081-111-1111");
      expect(text).not.toContain("chai@example.com");
      expect(text).not.toContain("บ้านเลขที่");
    });

    it("a care leader can open only their own members' cards", async () => {
      expect((await getJson("careA", `/api/member-cards/${ids.m1}`)).status).toBe(200);
      expect((await getJson("careA", `/api/member-cards/${ids.m2}`)).status).toBe(403);
    });

    it("the member role has no access to the card API", async () => {
      expect((await getJson("self", `/api/member-cards/${ids.m1}`)).status).toBe(403);
    });

    it("membership type and validity appear only for people allowed to see membership status", async () => {
      await fetch(`${baseUrl}/api/memberships/members/${ids.m1}/terms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookies.admin },
        body: JSON.stringify({ type: "extraordinary", startsOn: "2026-03-01" }),
      });
      const admin = await getJson("admin", `/api/member-cards/${ids.m1}`);
      expect(admin.json.data.membership).toMatchObject({ type: "extraordinary", endsOn: "2027-03-01" });
      const viewer = await getJson("viewer", `/api/member-cards/${ids.m1}`);
      expect(viewer.json.data.membership).toBeNull();
    });

    it("assigns card numbers: next free number, explicit number, no duplicates", async () => {
      const post = async (role: string, memberId: string, body: unknown = {}) => {
        const res = await fetch(`${baseUrl}/api/member-cards/${memberId}/number`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookies[role] },
          body: JSON.stringify(body),
        });
        return { status: res.status, json: (await res.json()) as { data?: { memberNo: string } } };
      };
      expect((await post("careA", ids.m1)).status).toBe(403); // office roles only
      const first = await post("admin", ids.m1, { memberNo: 304 });
      expect(first.json.data!.memberNo).toBe("00304");
      expect((await post("admin", ids.m1)).status).toBe(409); // already numbered
      const clash = await post("admin", ids.m2, { memberNo: 304 });
      expect(clash.status).toBe(409);
      const next = await post("staff", ids.m2);
      expect(next.json.data!.memberNo).toBe("00305");
      expect((await getJson("admin", `/api/member-cards/${ids.m1}`)).json.data.memberNo).toBe("00304");
      expect((await post("admin", ids.m2, { memberNo: 0 })).status).toBe(400);
    });
  });
});
