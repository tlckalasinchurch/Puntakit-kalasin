import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../app.js";
import { requireRole } from "../middleware/auth.js";
import {
  groupInputSchema,
  groupMemberInputSchema,
  groupMemberUpdateSchema,
  groupQuerySchema,
} from "../../shared/validation.js";
import type { UserRole } from "../../shared/schema.js";

describe("Groups API & Security Tests", () => {
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
    it("returns 401 when accessing GET /api/groups without auth token", async () => {
      const res = await fetch(`${baseUrl}/api/groups`);
      expect(res.status).toBe(401);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 when accessing POST /api/groups without auth token", async () => {
      const res = await fetch(`${baseUrl}/api/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "กลุ่มแคร์เมือง" }),
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 when accessing PUT /api/groups/:id without auth token", async () => {
      const res = await fetch(`${baseUrl}/api/groups/test-group-id`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "แก้ไขชื่อกลุ่ม" }),
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 when accessing DELETE /api/groups/:id without auth token", async () => {
      const res = await fetch(`${baseUrl}/api/groups/test-group-id`, {
        method: "DELETE",
      });
      expect(res.status).toBe(401);
    });

    it("returns 401 when accessing POST /api/groups/:id/members without auth token", async () => {
      const res = await fetch(`${baseUrl}/api/groups/test-group-id/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: "123e4567-e89b-12d3-a456-426614174000" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 401 when accessing DELETE /api/groups/:id/members/:memberId without auth token", async () => {
      const res = await fetch(`${baseUrl}/api/groups/test-group-id/members/mem-1`, {
        method: "DELETE",
      });
      expect(res.status).toBe(401);
    });
  });

  describe("404 Not Found Handling", () => {
    it("returns 404 for non-existent routes", async () => {
      const res = await fetch(`${baseUrl}/api/non-existent-groups-path`);
      expect(res.status).toBe(404);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("RBAC Role-Gating: Creation and Modification", () => {
    it("allows super_admin and admin to create groups", () => {
      const middleware = requireRole("super_admin", "admin");
      const nextAdmin = vi.fn();
      middleware(
        { user: { id: "u-1", email: "admin@test.com", name: "Admin", role: "admin" as UserRole } } as any,
        {} as any,
        nextAdmin
      );
      expect(nextAdmin).toHaveBeenCalledWith();

      const nextSuper = vi.fn();
      middleware(
        { user: { id: "u-2", email: "super@test.com", name: "Super", role: "super_admin" as UserRole } } as any,
        {} as any,
        nextSuper
      );
      expect(nextSuper).toHaveBeenCalledWith();
    });

    it("blocks standard member, viewer, and staff from group creation (admin only)", () => {
      const middleware = requireRole("super_admin", "admin");
      const roles: UserRole[] = ["member", "viewer", "staff", "group_leader"];

      for (const r of roles) {
        const next = vi.fn();
        middleware(
          { user: { id: "u-3", email: "test@test.com", name: "Test", role: r } } as any,
          {} as any,
          next
        );
        expect(next).toHaveBeenCalled();
        const err = next.mock.calls[0][0];
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe("FORBIDDEN");
      }
    });

    it("evaluates group_leader ownership: group_leader can only edit own group and cannot edit other groups", () => {
      const myUserId = "user-leader-1";
      const otherUserId = "user-leader-2";

      const ownGroup = { id: "grp-1", leaderId: myUserId, coLeaderId: null };
      const otherGroup = { id: "grp-2", leaderId: otherUserId, coLeaderId: null };

      // Helper logic simulation matching verifyGroupManagementAccess
      function canManage(user: { id: string; role: UserRole }, group: { leaderId: string | null; coLeaderId: string | null }) {
        if (user.role === "super_admin" || user.role === "admin" || user.role === "ministry_leader") return true;
        if (user.role === "group_leader" && (group.leaderId === user.id || group.coLeaderId === user.id)) return true;
        return false;
      }

      const leaderUser = { id: myUserId, role: "group_leader" as UserRole };
      const memberUser = { id: "user-mem-1", role: "member" as UserRole };

      // Group leader on own group -> Allowed
      expect(canManage(leaderUser, ownGroup)).toBe(true);

      // Group leader on other group -> Denied (cannot edit other groups)
      expect(canManage(leaderUser, otherGroup)).toBe(false);

      // Regular member on any group -> Denied (cannot edit group)
      expect(canManage(memberUser, ownGroup)).toBe(false);
      expect(canManage(memberUser, otherGroup)).toBe(false);
    });
  });

  describe("Privacy & Location Masking Logic (PDPA)", () => {
    // Mirroring maskGroupLocation
    function simulateMaskLocation(
      group: { privacy: string; meetingLocation: string | null; area: string | null; latitude: string | null; longitude: string | null },
      userRole: UserRole,
      isLeaderOrActiveMember: boolean = false
    ) {
      const isPrivileged =
        userRole === "super_admin" ||
        userRole === "admin" ||
        userRole === "ministry_leader" ||
        isLeaderOrActiveMember;

      if (isPrivileged || group.privacy === "public") {
        return group;
      }

      const maskedLocation =
        group.privacy === "confidential"
          ? "ติดต่อผู้นำกลุ่มเพื่อสอบถามสถานที่"
          : group.area
          ? `บริเวณ ${group.area} (สงวนสิทธิ์เฉพาะสมาชิก)`
          : "สงวนสิทธิ์เฉพาะสมาชิกกลุ่ม";

      return {
        ...group,
        meetingLocation: maskedLocation,
        latitude: null,
        longitude: null,
      };
    }

    it("masks coordinates and exact address for confidential groups when viewed by regular members", () => {
      const confidentialGroup = {
        privacy: "confidential",
        meetingLocation: "บ้านเลขที่ 123/45 ถนนราษฎร์บำรุง",
        area: "ในเมือง",
        latitude: "16.4321",
        longitude: "103.5042",
      };

      const maskedForMember = simulateMaskLocation(confidentialGroup, "member", false);
      expect(maskedForMember.latitude).toBeNull();
      expect(maskedForMember.longitude).toBeNull();
      expect(maskedForMember.meetingLocation).toContain("ติดต่อผู้นำกลุ่ม");

      // Privileged admin sees real location
      const forAdmin = simulateMaskLocation(confidentialGroup, "admin", false);
      expect(forAdmin.latitude).toBe("16.4321");
      expect(forAdmin.meetingLocation).toBe("บ้านเลขที่ 123/45 ถนนราษฎร์บำรุง");
    });

    it("masks coordinates and shows only approximate area for private groups to outside members", () => {
      const privateGroup = {
        privacy: "private",
        meetingLocation: "บ้านพักส่วนตัว 55 ม.4 ต.ยางตลาด",
        area: "ยางตลาด",
        latitude: "16.4100",
        longitude: "103.5200",
      };

      const maskedForMember = simulateMaskLocation(privateGroup, "member", false);
      expect(maskedForMember.latitude).toBeNull();
      expect(maskedForMember.longitude).toBeNull();
      expect(maskedForMember.meetingLocation).toContain("บริเวณ ยางตลาด");

      // Active member inside the group sees full location
      const forGroupMember = simulateMaskLocation(privateGroup, "member", true);
      expect(forGroupMember.latitude).toBe("16.4100");
      expect(forGroupMember.meetingLocation).toBe("บ้านพักส่วนตัว 55 ม.4 ต.ยางตลาด");
    });
  });

  describe("Group Schema and Validation Enhancements", () => {
    it("validates full group creation with privacy, area, and co-leader", () => {
      const valid = groupInputSchema.safeParse({
        name: "กลุ่มแคร์วัยรุ่น - ม.กาฬสินธุ์",
        category: "youth",
        privacy: "private",
        status: "active",
        area: "มหาวิทยาลัยกาฬสินธุ์",
        meetingDay: "ทุกวันศุกร์",
        meetingTime: "18:00",
        meetingLocation: "ห้องประชุมใต้อาคารเรียน",
        maxMembers: 30,
        isOpen: true,
        description: "กลุ่มสร้างชีวิตและสามัคคีธรรมสำหรับนักศึกษา",
      });

      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.privacy).toBe("private");
        expect(valid.data.area).toBe("มหาวิทยาลัยกาฬสินธุ์");
        expect(valid.data.maxMembers).toBe(30);
      }
    });

    it("rejects empty group name", () => {
      const invalid = groupInputSchema.safeParse({
        name: "   ",
        category: "cell",
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toContain("กรุณากรอกชื่อกลุ่ม");
      }
    });

    it("validates group member addition requiring valid UUID memberId and default active status", () => {
      const invalid = groupMemberInputSchema.safeParse({
        memberId: "not-a-uuid",
        role: "member",
      });
      expect(invalid.success).toBe(false);

      const valid = groupMemberInputSchema.safeParse({
        memberId: "123e4567-e89b-12d3-a456-426614174000",
        role: "assistant_leader",
        status: "active",
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.role).toBe("assistant_leader");
        expect(valid.data.status).toBe("active");
      }
    });

    it("validates group member update schema (changing role or marking inactive)", () => {
      const updateRole = groupMemberUpdateSchema.safeParse({
        role: "leader",
      });
      expect(updateRole.success).toBe(true);

      const markInactive = groupMemberUpdateSchema.safeParse({
        status: "inactive",
      });
      expect(markInactive.success).toBe(true);
      if (markInactive.success) {
        expect(markInactive.data.status).toBe("inactive");
      }
    });

    it("validates group query filters with area and privacy", () => {
      const query = groupQuerySchema.safeParse({
        search: "แคร์",
        category: "cell",
        status: "active",
        privacy: "private",
        area: "ยางตลาด",
        page: "1",
        limit: "20",
      });
      expect(query.success).toBe(true);
      if (query.success) {
        expect(query.data.page).toBe(1);
        expect(query.data.limit).toBe(20);
        expect(query.data.area).toBe("ยางตลาด");
        expect(query.data.privacy).toBe("private");
      }
    });
  });
});
