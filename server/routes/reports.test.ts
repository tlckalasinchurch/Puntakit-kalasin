import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../app.js";
import { requireRole } from "../middleware/auth.js";
import { reportsDateRangeQuerySchema } from "../../shared/validation.js";
import { buildCsv, csvField, csvRow, sendCsv } from "../lib/csv.js";
import type { UserRole } from "../../shared/schema.js";

describe("Reports API & CSV Export Tests", () => {
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
    it("returns 401 for /api/reports/summary without a session", async () => {
      const res = await fetch(`${baseUrl}/api/reports/summary`);
      expect(res.status).toBe(401);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 for each CSV export without a session", async () => {
      for (const key of ["members", "attendance", "groups", "events"]) {
        const res = await fetch(`${baseUrl}/api/reports/export/${key}.csv`);
        expect(res.status).toBe(401);
      }
    });
  });

  describe("RBAC Role Enforcement (Reports = Operations role set)", () => {
    const REPORT_ROLES: UserRole[] = ["super_admin", "admin", "staff", "ministry_leader"];

    it.each(REPORT_ROLES)("allows %s through the reports gate", (role) => {
      const middleware = requireRole(...REPORT_ROLES);
      const req = { user: { id: "1", email: "u@test.com", name: "U", role } } as any;
      const next = vi.fn();
      middleware(req, {} as any, next);
      expect(next).toHaveBeenCalledWith();
    });

    it("blocks group_leader with 403 Forbidden", () => {
      const middleware = requireRole(...REPORT_ROLES);
      const req = { user: { id: "2", email: "gl@test.com", name: "GL", role: "group_leader" as UserRole } } as any;
      const next = vi.fn();
      middleware(req, {} as any, next);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("FORBIDDEN");
    });

    it("blocks plain member with 403 Forbidden", () => {
      const middleware = requireRole(...REPORT_ROLES);
      const req = { user: { id: "3", email: "m@test.com", name: "M", role: "member" as UserRole } } as any;
      const next = vi.fn();
      middleware(req, {} as any, next);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("FORBIDDEN");
    });
  });

  describe("reportsDateRangeQuerySchema validation", () => {
    it("accepts an empty query (no range filter)", () => {
      const result = reportsDateRangeQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts trimmed startDate/endDate strings", () => {
      const result = reportsDateRangeQuerySchema.safeParse({ startDate: " 2026-01-01 ", endDate: "2026-12-31" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startDate).toBe("2026-01-01");
      }
    });
  });

  describe("csv.ts helper", () => {
    it("quotes fields and doubles internal quotes (RFC 4180)", () => {
      expect(csvField('มี "คำพูด" ในนี้')).toBe('"มี ""คำพูด"" ในนี้"');
      expect(csvField(null)).toBe('""');
      expect(csvField(undefined)).toBe('""');
      expect(csvField(42)).toBe('"42"');
    });

    it("guards against CSV/formula injection by prefixing a leading apostrophe", () => {
      expect(csvField("=SUM(A1:A9)")).toBe('"\'=SUM(A1:A9)"');
      expect(csvField("+1234")).toBe('"\'+1234"');
      expect(csvField("-1234")).toBe('"\'-1234"');
      expect(csvField("@mention")).toBe('"\'@mention"');
    });

    it("joins a row with commas", () => {
      expect(csvRow(["a", 1, null])).toBe('"a","1",""');
    });

    it("builds full CSV text with CRLF between rows", () => {
      const csv = buildCsv(["ชื่อ", "อายุ"], [["สมชาย", 30], ["สมหญิง", 25]]);
      expect(csv).toBe('"ชื่อ","อายุ"\r\n"สมชาย","30"\r\n"สมหญิง","25"');
    });

    it("sendCsv prepends the UTF-8 BOM and sets CSV response headers", () => {
      const headers: Record<string, string> = {};
      let sentBody = "";
      const res = {
        setHeader: (name: string, value: string) => {
          headers[name] = value;
        },
        send: (body: string) => {
          sentBody = body;
        },
      } as any;

      sendCsv(res, "report-test.csv", '"a","b"');

      expect(headers["Content-Type"]).toBe("text/csv; charset=utf-8");
      expect(headers["Content-Disposition"]).toBe('attachment; filename="report-test.csv"');
      expect(sentBody.charCodeAt(0)).toBe(0xfeff);
      expect(sentBody.slice(1)).toBe('"a","b"');
    });
  });
});
