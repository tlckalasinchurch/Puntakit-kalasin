import { describe, expect, it } from "vitest";
import {
  announcementInputSchema,
  changePasswordInputSchema,
  checkDuplicateMemberSchema,
  churchProfileInputSchema,
  eventInputSchema,
  loginInputSchema,
  memberInputSchema,
  memberQuerySchema,
  ministryInputSchema,
  registerInputSchema,
} from "./validation.js";

describe("memberInputSchema", () => {
  it("accepts a minimal valid member", () => {
    const result = memberInputSchema.safeParse({ name: "สมชาย ใจดี" });
    expect(result.success).toBe(true);
  });

  it("accepts a full valid member with new fields", () => {
    const result = memberInputSchema.safeParse({
      name: "สมหญิง งามยิ่ง",
      nickname: "หญิง",
      gender: "female",
      birthDate: "1995-04-12",
      phone: "081-234-5678",
      email: "somying@example.com",
      lineId: "somying_line",
      address: "123 ต.ในเมือง อ.เมือง จ.กาฬสินธุ์",
      membershipStatus: "active",
      status: "ติดตามแล้ว",
      emergencyContactName: "นายสมศักดิ์ งามยิ่ง",
      emergencyContactPhone: "089-876-5432",
      emergencyContactRelation: "บิดา",
      consentGiven: true,
      notes: "สนใจเข้าร่วมทีมดนตรีนมัสการ",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = memberInputSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = memberInputSchema.safeParse({ name: "สมชาย", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status enum", () => {
    const result = memberInputSchema.safeParse({ name: "สมชาย", status: "unknown" });
    expect(result.success).toBe(false);
  });

  it("defaults status and membershipStatus when omitted", () => {
    const result = memberInputSchema.parse({ name: "สมชาย" });
    expect(result.status).toBe("ต้องติดตาม");
    expect(result.membershipStatus).toBe("visitor");
  });
});

describe("memberQuerySchema", () => {
  it("provides defaults for pagination and sorting", () => {
    const result = memberQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.sortBy).toBe("createdAt");
    expect(result.sortOrder).toBe("desc");
  });

  it("transforms includeDeleted string correctly", () => {
    const res1 = memberQuerySchema.parse({ includeDeleted: "true" });
    expect(res1.includeDeleted).toBe(true);

    const res2 = memberQuerySchema.parse({ includeDeleted: "false" });
    expect(res2.includeDeleted).toBe(false);
  });
});

describe("checkDuplicateMemberSchema", () => {
  it("accepts valid phone or email query", () => {
    const result = checkDuplicateMemberSchema.safeParse({ phone: "0812345678" });
    expect(result.success).toBe(true);
  });
});

describe("changePasswordInputSchema", () => {
  it("requires current and 8+ char new password", () => {
    expect(
      changePasswordInputSchema.safeParse({ currentPassword: "old", newPassword: "short" }).success
    ).toBe(false);
    expect(
      changePasswordInputSchema.safeParse({ currentPassword: "old", newPassword: "longenough123" }).success
    ).toBe(true);
  });
});

describe("announcementInputSchema", () => {
  it("requires title and content", () => {
    expect(announcementInputSchema.safeParse({ title: "", content: "" }).success).toBe(false);
    expect(announcementInputSchema.safeParse({ title: "หัวข้อ", content: "เนื้อหา" }).success).toBe(true);
  });

  it("rejects an invalid status", () => {
    const result = announcementInputSchema.safeParse({ title: "a", content: "b", status: "archived" });
    expect(result.success).toBe(false);
  });
});

describe("eventInputSchema", () => {
  it("requires an eventDate", () => {
    const result = eventInputSchema.safeParse({ title: "นมัสการ" });
    expect(result.success).toBe(false);
  });

  it("accepts a full valid payload", () => {
    const result = eventInputSchema.safeParse({
      title: "นมัสการวันอาทิตย์",
      eventDate: new Date().toISOString(),
      category: "worship",
      status: "scheduled",
    });
    expect(result.success).toBe(true);
  });
});

describe("ministryInputSchema", () => {
  it("requires a name", () => {
    expect(ministryInputSchema.safeParse({ name: "" }).success).toBe(false);
    expect(ministryInputSchema.safeParse({ name: "ทีมนมัสการ" }).success).toBe(true);
  });
});

describe("churchProfileInputSchema", () => {
  it("requires a name and validates email", () => {
    expect(churchProfileInputSchema.safeParse({ name: "" }).success).toBe(false);
    expect(churchProfileInputSchema.safeParse({ name: "คริสตจักร", email: "bad" }).success).toBe(false);
    expect(churchProfileInputSchema.safeParse({ name: "คริสตจักร", email: "a@b.com" }).success).toBe(true);
  });
});

describe("auth schemas", () => {
  it("rejects a short password on register", () => {
    const result = registerInputSchema.safeParse({ email: "a@b.com", password: "short", name: "A" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid register payload", () => {
    const result = registerInputSchema.safeParse({ email: "a@b.com", password: "longenough", name: "A" });
    expect(result.success).toBe(true);
  });

  it("requires email and password on login", () => {
    expect(loginInputSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
    expect(loginInputSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });
});
