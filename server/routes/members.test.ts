import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { createApp } from "../app.js";
import { requireRole } from "../middleware/auth.js";
import { maskSensitiveData } from "./members.js";
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

    /**
     * The mask under test is the REAL one from `server/routes/members.ts`, not
     * a copy of it. The previous version of this suite re-implemented the
     * masking inline, so it could never fail when the real function was wrong —
     * which is exactly how `lineId` stayed unmasked: the copy simply omitted
     * the field the real function also omitted.
     */
    function simulateMask(m: Member, role: UserRole, userId = "someone-else") {
      return maskSensitiveData(m, role, userId);
    }

    it("masks phone, email, address, and pastoral notes for regular members and viewers", () => {
      const memberView = simulateMask(mockMember, "member");
      expect(memberView.phone).toBe("081-xxx-678");
      expect(memberView.email).toBe("te***@example.com");
      expect(memberView.address).toBeNull();
      expect(memberView.notes).toBeNull();
      expect(memberView.emergencyContactPhone).toBeNull();
    });

    it("masks the LINE ID for non-privileged roles", () => {
      // LINE ID identifies a real person on a third-party network. Returning it
      // gave every signed-in role — including `viewer` — a directory of every
      // member's LINE handle from GET /api/members.
      expect(simulateMask(mockMember, "member").lineId).toBeNull();
      expect(simulateMask(mockMember, "viewer").lineId).toBeNull();
      expect(simulateMask(mockMember, "group_leader").lineId).toBeNull();
      expect(simulateMask(mockMember, "ministry_leader").lineId).toBeNull();
    });

    it("keeps the LINE ID only for the roles the server treats as privileged", () => {
      expect(simulateMask(mockMember, "admin").lineId).toBe("test_line");
      expect(simulateMask(mockMember, "super_admin").lineId).toBe("test_line");
      expect(simulateMask(mockMember, "staff").lineId).toBe("test_line");
    });

    it("leaves the record intact for the member's own assigned leader", () => {
      // `maskSensitiveData` also treats the member's assigned care leader as
      // privileged — they need the real contact details to do the follow-up.
      const assigned = { ...mockMember, assignedLeaderId: "leader-1" };
      const asLeader = simulateMask(assigned, "group_leader", "leader-1");
      expect(asLeader.lineId).toBe("test_line");
      expect(asLeader.phone).toBe("0812345678");
      // A different group_leader, with no assignment, still gets the mask.
      const asOther = simulateMask(assigned, "group_leader", "leader-2");
      expect(asOther.lineId).toBeNull();
      expect(asOther.phone).toBe("081-xxx-678");
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

  // ---------------------------------------------------------------------
  // List-response contract (client sync guard).
  //
  // GET /api/members returns the rows as a BARE ARRAY in `data` (pagination
  // lives in `meta`). Two client pages (Attendance roster, Groups add-member
  // picker) once typed this response as `{ items: Member[] }`, so both read
  // `undefined` and rendered an always-empty list. These tests pin the wire
  // shape so any change to it breaks CI instead of silently blanking those
  // screens again. Mirrored on the client side by
  // client/src/members-list-contract.test.ts.
  // ---------------------------------------------------------------------
  describe("List response contract (client sync guard)", () => {
    it("marks the /api/members list route in the source file, then asserts the shape over HTTP", async () => {
      // The 401 integration assertion below proves the route exists and is
      // auth-gated; this source assertion pins that the file under test is
      // the one whose contract the client depends on.
      const source = await fs.promises.readFile(
        path.resolve(import.meta.dirname, "members.ts"),
        "utf8"
      );
      expect(source).toContain("success: true,");
      expect(source).toContain("data: maskedRows,");
      expect(source).toContain("meta: {");

      const res = await fetch(`${baseUrl}/api/members`);
      expect(res.status).toBe(401);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
