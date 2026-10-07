import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../app.js";
import { requireRole } from "../middleware/auth.js";
import {
  attendanceInputSchema,
  attendanceQuerySchema,
  bulkAttendanceInputSchema,
  consecutiveAbsenceQuerySchema,
  qrCheckInSchema,
} from "../../shared/validation.js";
import type { UserRole } from "../../shared/schema.js";

describe("Attendance API & Security Tests", () => {
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
    it("returns 401 when accessing GET /api/attendance without token", async () => {
      const res = await fetch(`${baseUrl}/api/attendance`);
      expect(res.status).toBe(401);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 when attempting check-in without token", async () => {
      const res = await fetch(`${baseUrl}/api/attendance/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-09-20",
          memberId: "123e4567-e89b-12d3-a456-426614174000",
          status: "present",
        }),
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 when attempting QR scan without token", async () => {
      const res = await fetch(`${baseUrl}/api/attendance/qr-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "PK-MEM-123" }),
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Attendance Input Validation", () => {
    it("validates single check-in requires valid date and member UUID", () => {
      const invalid = attendanceInputSchema.safeParse({
        date: "not-a-date",
        memberId: "not-a-uuid",
      });
      expect(invalid.success).toBe(false);

      const valid = attendanceInputSchema.safeParse({
        date: "2026-09-21T09:00:00Z",
        serviceType: "sunday_service",
        memberId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        status: "present",
        checkInMethod: "qr_scan",
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.serviceType).toBe("sunday_service");
        expect(valid.data.status).toBe("present");
        expect(valid.data.checkInMethod).toBe("qr_scan");
      }
    });

    it("validates bulk check-in schema rejects empty records array", () => {
      const empty = bulkAttendanceInputSchema.safeParse({
        date: "2026-09-21",
        serviceType: "sunday_service",
        records: [],
      });
      expect(empty.success).toBe(false);

      const valid = bulkAttendanceInputSchema.safeParse({
        date: "2026-09-21",
        serviceType: "sunday_service",
        records: [
          {
            memberId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            status: "present",
            checkInMethod: "manual",
          },
          {
            memberId: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
            status: "absent",
            checkInMethod: "manual",
            notes: "ติดธุระต่างจังหวัด",
          },
        ],
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.records.length).toBe(2);
      }
    });

    it("validates QR check-in input token formats", () => {
      const invalid = qrCheckInSchema.safeParse({ token: "   " });
      expect(invalid.success).toBe(false);

      const validSimple = qrCheckInSchema.safeParse({
        token: "PK-MEM-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        serviceType: "care_group",
      });
      expect(validSimple.success).toBe(true);

      const validJson = qrCheckInSchema.safeParse({
        token: JSON.stringify({ memberId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }),
        serviceType: "sunday_service",
      });
      expect(validJson.success).toBe(true);
    });

    it("validates consecutive absentees threshold parameter", () => {
      const query = consecutiveAbsenceQuerySchema.safeParse({
        threshold: "3",
        serviceType: "sunday_service",
      });
      expect(query.success).toBe(true);
      if (query.success) {
        expect(query.data.threshold).toBe(3);
        expect(query.data.serviceType).toBe("sunday_service");
      }
    });

    it("validates attendance query filters", () => {
      const query = attendanceQuerySchema.safeParse({
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        serviceType: "sunday_service",
        status: "present",
        page: "1",
        limit: "50",
      });
      expect(query.success).toBe(true);
      if (query.success) {
        expect(query.data.page).toBe(1);
        expect(query.data.limit).toBe(50);
      }
    });
  });

  describe("RBAC for Attendance Deletion", () => {
    it("allows super_admin and admin to delete attendance records", () => {
      const middleware = requireRole("super_admin", "admin");
      const next = vi.fn();
      middleware(
        { user: { id: "u-1", email: "admin@test.com", name: "Admin", role: "admin" as UserRole } } as any,
        {} as any,
        next
      );
      expect(next).toHaveBeenCalledWith();
    });

    it("blocks standard member from deleting attendance records with 403 Forbidden", () => {
      const middleware = requireRole("super_admin", "admin");
      const next = vi.fn();
      middleware(
        { user: { id: "u-2", email: "mem@test.com", name: "Member", role: "member" as UserRole } } as any,
        {} as any,
        next
      );
      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("FORBIDDEN");
    });
  });
});
