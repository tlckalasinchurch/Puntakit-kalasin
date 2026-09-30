import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../app.js";
import { requireRole } from "../middleware/auth.js";
import { memberInputSchema, memberQuerySchema } from "../../shared/validation.js";
import type { Member, UserRole } from "../../shared/schema.js";

describe("Members API & Security Integration Tests", () => {
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

  describe("401 Unauthorized Protection", () => {
    it("returns 401 with UNAUTHORIZED code when no session token is provided", async () => {
      const res = await fetch(`${baseUrl}/api/members`);
      expect(res.status).toBe(401);

      const body = (await res.json()) as { success: boolean; error: { code: string; message: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(body.error.message).toContain("กรุณาเข้าสู่ระบบ");
    });

    it("returns 401 when an invalid/tampered token is supplied", async () => {
      const res = await fetch(`${baseUrl}/api/members`, {
        headers: {
          Cookie: "puntakit_session=invalid.tampered.token",
        },
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("404 Not Found Handling", () => {
    it("returns standard 404 with NOT_FOUND code for unknown API endpoints", async () => {
      const res = await fetch(`${baseUrl}/api/non-existent-route`);
      expect(res.status).toBe(404);

      const body = (await res.json()) as { success: boolean; error: { code: string; message: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("403 Forbidden & RBAC Role Enforcement", () => {
    it("allows super_admin access to any role-gated endpoint", () => {
      const middleware = requireRole("admin");
      const req = { user: { id: "1", email: "sa@test.com", name: "Super", role: "super_admin" as UserRole } } as any;
      const next = vi.fn();
      middleware(req, {} as any, next);
      expect(next).toHaveBeenCalledWith();
    });

    it("allows admin access to admin-gated endpoint", () => {
      const middleware = requireRole("admin");
      const req = { user: { id: "2", email: "admin@test.com", name: "Admin", role: "admin" as UserRole } } as any;
      const next = vi.fn();
      middleware(req, {} as any, next);
      expect(next).toHaveBeenCalledWith();
    });

    it("blocks standard member role with 403 Forbidden", () => {
      const middleware = requireRole("admin", "staff");
      const req = { user: { id: "3", email: "user@test.com", name: "Member", role: "member" as UserRole } } as any;
      const next = vi.fn();
      middleware(req, {} as any, next);
      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("FORBIDDEN");
    });

    it("blocks viewer role from mutation routes with 403 Forbidden", () => {
      const middleware = requireRole("super_admin", "admin", "staff");
      const req = { user: { id: "4", email: "view@test.com", name: "Viewer", role: "viewer" as UserRole } } as any;
      const next = vi.fn();
      middleware(req, {} as any, next);
      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("FORBIDDEN");
    });
  });

  describe("Member Input Validation (400 Bad Request / Validation Errors)", () => {
    it("rejects creation when required name is empty", () => {
      const result = memberInputSchema.safeParse({ name: "   " });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("กรุณากรอกชื่อ");
      }
    });

    it("rejects invalid email formats", () => {
      const result = memberInputSchema.safeParse({ name: "ประสิทธิ์", email: "invalid-email" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("อีเมลไม่ถูกต้อง");
      }
    });

    it("accepts valid member with pastoral and emergency contact fields", () => {
      const result = memberInputSchema.safeParse({
        name: "สมชาย รักดี",
        nickname: "ชาย",
        gender: "male",
        birthDate: "1990-05-15",
        phone: "0891234567",
        email: "somchai@gmail.com",
        lineId: "somchai_line",
        address: "99 ม.2 ต.กาฬสินธุ์",
        membershipStatus: "active",
        status: "ติดตามแล้ว",
        emergencyContactName: "สมศรี รักดี",
        emergencyContactPhone: "0897654321",
        emergencyContactRelation: "คู่สมรส",
        consentGiven: true,
        notes: "คำขออธิษฐานเรื่องสุขภาพ",
      });
      expect(result.success).toBe(true);
    });

    it("validates pagination query parameters properly", () => {
      const parsed = memberQuerySchema.parse({ page: "2", limit: "10", search: "สมชาย" });
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(10);
      expect(parsed.search).toBe("สมชาย");
    });
  });

  describe("Data Privacy & Field Masking (PDPA)", () => {
    const mockMember: Member = {
      id: "mem-1",
      name: "นายทดสอบ มั่นคง",
      nickname: "เอก",
      avatarUrl: null,
      gender: "male",
      birthDate: new Date("1992-01-01"),
      phone: "0812345678",
      email: "test.member@example.com",
      lineId: "test_line",
      address: "123 หมู่บ้านสุขใจ จ.กาฬสินธุ์",
      role: "สมาชิก",
      area: "อ.เมือง",
      group: "กลุ่ม 1",
      membershipStatus: "active",
      status: "ติดตามแล้ว",
      assignedLeaderId: null,
      emergencyContactName: "นางทดสอบ มั่นคง",
      emergencyContactPhone: "0899999999",
      emergencyContactRelation: "มารดา",
      consentGiven: true,
      consentDate: new Date(),
      joinedAt: new Date(),
      notes: "ข้อมูลส่วนตัวฝ่ายอภิบาลที่ห้ามเผยแพร่",
      createdById: "admin-1",
      updatedById: "admin-1",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    function simulateMask(m: Member, role: UserRole) {
      const isPrivileged = role === "super_admin" || role === "admin" || role === "staff";
      if (isPrivileged) return m;
      return {
        ...m,
        phone: m.phone ? m.phone.replace(/(\d{3})\d{3,4}(\d{3})/, "$1-xxx-$2") : null,
        email: m.email ? m.email.replace(/(.{2})(.*)(?=@)/, "$1***") : null,
        address: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        emergencyContactRelation: null,
        notes: null,
      };
    }

    it("masks phone, email, address, and pastoral notes for regular members and viewers", () => {
      const memberView = simulateMask(mockMember, "member");
      expect(memberView.phone).toBe("081-xxx-678");
      expect(memberView.email).toBe("te***@example.com");
      expect(memberView.address).toBeNull();
      expect(memberView.notes).toBeNull();
      expect(memberView.emergencyContactPhone).toBeNull();
    });

    it("retains full sensitive information for admin and staff roles", () => {
      const adminView = simulateMask(mockMember, "admin");
      expect(adminView.phone).toBe("0812345678");
      expect(adminView.email).toBe("test.member@example.com");
      expect(adminView.address).toBe("123 หมู่บ้านสุขใจ จ.กาฬสินธุ์");
      expect(adminView.notes).toBe("ข้อมูลส่วนตัวฝ่ายอภิบาลที่ห้ามเผยแพร่");
      expect(adminView.emergencyContactPhone).toBe("0899999999");
    });
  });
});
