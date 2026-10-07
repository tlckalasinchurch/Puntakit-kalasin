import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../app.js";
import {
  eventRegistrationSchema,
  memberProfileUpdateSchema,
  prayerRequestInputSchema,
  pushSubscriptionSchema,
} from "../../shared/validation.js";

describe("Member Portal & PWA Security Tests", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (typeof address === "object" && address !== null) {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe("401 Unauthorized Protection on Member Portal Routes", () => {
    it("rejects GET /api/me/portal without auth", async () => {
      const res = await fetch(`${baseUrl}/api/me/portal`);
      expect(res.status).toBe(401);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects PUT /api/me/profile without auth", async () => {
      const res = await fetch(`${baseUrl}/api/me/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: "ต้น" }),
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects GET /api/me/attendance without auth", async () => {
      const res = await fetch(`${baseUrl}/api/me/attendance`);
      expect(res.status).toBe(401);
    });

    it("rejects POST /api/me/prayer-requests without auth", async () => {
      const res = await fetch(`${baseUrl}/api/me/prayer-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "อธิษฐานเผื่อสุขภาพ", content: "ขอพระเจ้ารักษาโรค" }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects POST /api/me/events/event-123/register without auth", async () => {
      const res = await fetch(`${baseUrl}/api/me/events/event-123/register`, {
        method: "POST",
      });
      expect(res.status).toBe(401);
    });
  });

  describe("Member Self Profile Update Validation", () => {
    it("allows updating personal fields (nickname, phone, emergency contact)", () => {
      const result = memberProfileUpdateSchema.safeParse({
        nickname: "ต้นกล้า",
        phone: "0812345678",
        lineId: "tonkla_line",
        address: "123 หมู่ 4 ต.ในเมือง อ.เมือง จ.กาฬสินธุ์",
        emergencyContactName: "มาลี รักพระเจ้า",
        emergencyContactPhone: "0898765432",
        emergencyContactRelation: "มารดา",
        consentGiven: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nickname).toBe("ต้นกล้า");
        expect(result.data.consentGiven).toBe(true);
      }
    });

    it("strips or ignores sensitive administrative fields (role, membershipStatus)", () => {
      const inputWithAdminFields = {
        nickname: "ทดสอบ",
        role: "super_admin", // Attempt privilege escalation
        membershipStatus: "active",
        assignedLeaderId: "other-user",
      };
      const result = memberProfileUpdateSchema.safeParse(inputWithAdminFields);
      expect(result.success).toBe(true);
      if (result.success) {
        // Zod strips unspecified keys
        expect((result.data as any).role).toBeUndefined();
        expect((result.data as any).membershipStatus).toBeUndefined();
      }
    });
  });

  describe("Prayer Request Input Validation", () => {
    it("rejects prayer request with empty title or content", () => {
      const invalid = prayerRequestInputSchema.safeParse({
        title: "   ",
        content: "",
      });
      expect(invalid.success).toBe(false);
    });

    it("accepts valid prayer request with confidential flag", () => {
      const valid = prayerRequestInputSchema.safeParse({
        title: "ขอการทรงนำในการสอบสัมภาษณ์งาน",
        content: "สัปดาห์หน้าจะมีการสัมภาษณ์งานใหม่ ขอสติปัญญาจากพระเจ้า",
        category: "work",
        isConfidential: true,
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.isConfidential).toBe(true);
        expect(valid.data.category).toBe("work");
      }
    });
  });

  describe("Event Registration Validation", () => {
    it("accepts optional notes for event registration", () => {
      const valid = eventRegistrationSchema.safeParse({
        notes: "ขอที่นั่งแถวหน้าสำหรับผู้สูงอายุ",
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("Web Push Subscription Validation", () => {
    it("validates push subscription format", () => {
      const invalid = pushSubscriptionSchema.safeParse({
        endpoint: "not-a-url",
        p256dh: "",
        auth: "",
      });
      expect(invalid.success).toBe(false);

      const valid = pushSubscriptionSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/test-token-123",
        p256dh: "BMjR0...==",
        auth: "5aB...==",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
      });
      expect(valid.success).toBe(true);
    });
  });
});
