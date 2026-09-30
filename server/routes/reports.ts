import { Router } from "express";
import { and, count, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  attendanceRecords,
  events,
  groupMembers,
  groups,
  members,
  users,
} from "../../shared/schema.js";
import { reportsDateRangeQuerySchema, type ReportsDateRangeQuery } from "../../shared/validation.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { buildCsv, sendCsv } from "../lib/csv.js";
import { ValidationError } from "../lib/errors.js";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

const REPORT_ROLES = ["super_admin", "admin", "staff", "ministry_leader"] as const;
reportsRouter.use(requireRole(...REPORT_ROLES));

interface ParsedDateRange {
  startDate?: Date;
  endDate?: Date;
}

/** Parses and validates the shared startDate/endDate query pair used by every report. */
function parseDateRange(query: unknown): ParsedDateRange {
  const parsed = reportsDateRangeQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new ValidationError(
      "ช่วงวันที่ไม่ถูกต้อง",
      parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }))
    );
  }
  return toDateRange(parsed.data);
}

function toDateRange(query: ReportsDateRangeQuery): ParsedDateRange {
  const range: ParsedDateRange = {};
  if (query.startDate) {
    const startDate = new Date(query.startDate);
    if (Number.isNaN(startDate.getTime())) {
      throw new ValidationError("วันที่เริ่มต้นไม่ถูกต้อง");
    }
    range.startDate = startDate;
  }
  if (query.endDate) {
    const endDate = new Date(query.endDate);
    if (Number.isNaN(endDate.getTime())) {
      throw new ValidationError("วันที่สิ้นสุดไม่ถูกต้อง");
    }
    range.endDate = endDate;
  }
  return range;
}

/**
 * GET /api/reports/summary — headline counts for the reporting dashboard.
 * startDate/endDate scope "new members", attendance, and events; membership
 * and group totals are always as-of-now.
 */
reportsRouter.get("/summary", async (req, res, next) => {
  try {
    const { startDate, endDate } = parseDateRange(req.query);
    const db = getDb();

    const memberRangeConditions = [isNull(members.deletedAt)];
    if (startDate) memberRangeConditions.push(gte(members.joinedAt, startDate));
    if (endDate) memberRangeConditions.push(lte(members.joinedAt, endDate));

    const [totalMembersResult] = await db
      .select({ count: count() })
      .from(members)
      .where(isNull(members.deletedAt));

    const [newMembersResult] = await db
      .select({ count: count() })
      .from(members)
      .where(and(...memberRangeConditions));

    const membersByStatus = await db
      .select({ status: members.status, count: count() })
      .from(members)
      .where(isNull(members.deletedAt))
      .groupBy(members.status);

    const [totalGroupsResult] = await db
      .select({ count: count() })
      .from(groups)
      .where(isNull(groups.deletedAt));

    const groupsByStatus = await db
      .select({ status: groups.status, count: count() })
      .from(groups)
      .where(isNull(groups.deletedAt))
      .groupBy(groups.status);

    const attendanceConditions = [];
    if (startDate) attendanceConditions.push(gte(attendanceRecords.date, startDate));
    if (endDate) attendanceConditions.push(lte(attendanceRecords.date, endDate));
    const attendanceWhere = attendanceConditions.length > 0 ? and(...attendanceConditions) : undefined;

    const [totalAttendanceResult] = await db
      .select({ count: count() })
      .from(attendanceRecords)
      .where(attendanceWhere);

    const attendanceByStatus = await db
      .select({ status: attendanceRecords.status, count: count() })
      .from(attendanceRecords)
      .where(attendanceWhere)
      .groupBy(attendanceRecords.status);

    const eventConditions = [];
    if (startDate) eventConditions.push(gte(events.eventDate, startDate));
    if (endDate) eventConditions.push(lte(events.eventDate, endDate));
    const eventsWhere = eventConditions.length > 0 ? and(...eventConditions) : undefined;

    const [totalEventsResult] = await db
      .select({ count: count() })
      .from(events)
      .where(eventsWhere);

    const eventsByStatus = await db
      .select({ status: events.status, count: count() })
      .from(events)
      .where(eventsWhere)
      .groupBy(events.status);

    const totalAttendance = Number(totalAttendanceResult?.count ?? 0);
    const presentCount = Number(
      attendanceByStatus.find((row) => row.status === "present")?.count ?? 0
    );

    res.json({
      success: true,
      data: {
        range: { startDate: startDate?.toISOString() ?? null, endDate: endDate?.toISOString() ?? null },
        members: {
          total: Number(totalMembersResult?.count ?? 0),
          newInRange: Number(newMembersResult?.count ?? 0),
          byStatus: membersByStatus.map((row) => ({ status: row.status, count: Number(row.count) })),
        },
        groups: {
          total: Number(totalGroupsResult?.count ?? 0),
          byStatus: groupsByStatus.map((row) => ({ status: row.status, count: Number(row.count) })),
        },
        attendance: {
          total: totalAttendance,
          byStatus: attendanceByStatus.map((row) => ({ status: row.status, count: Number(row.count) })),
          attendanceRate: totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 1000) / 10 : 0,
        },
        events: {
          total: Number(totalEventsResult?.count ?? 0),
          byStatus: eventsByStatus.map((row) => ({ status: row.status, count: Number(row.count) })),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/reports/export/members.csv — members, optionally scoped by joinedAt range. */
reportsRouter.get("/export/members.csv", async (req, res, next) => {
  try {
    const { startDate, endDate } = parseDateRange(req.query);
    const db = getDb();

    const conditions = [isNull(members.deletedAt)];
    if (startDate) conditions.push(gte(members.joinedAt, startDate));
    if (endDate) conditions.push(lte(members.joinedAt, endDate));

    const rows = await db
      .select({
        name: members.name,
        nickname: members.nickname,
        area: members.area,
        group: members.group,
        membershipStatus: members.membershipStatus,
        status: members.status,
        joinedAt: members.joinedAt,
      })
      .from(members)
      .where(and(...conditions))
      .orderBy(members.name);

    const headers = ["ชื่อ-นามสกุล", "ชื่อเล่น", "พื้นที่", "กลุ่ม", "สถานะสมาชิก", "สถานะการติดตาม", "วันที่เข้าร่วม"];
    const csvRows = rows.map((m) => [
      m.name,
      m.nickname ?? "",
      m.area ?? "",
      m.group ?? "",
      m.membershipStatus,
      m.status,
      new Date(m.joinedAt).toLocaleDateString("th-TH"),
    ]);

    await logAudit({ req, action: "REPORTS_EXPORT_CSV", entityType: "report", details: { report: "members", count: rows.length } });

    sendCsv(res, `report-members-${Date.now()}.csv`, buildCsv(headers, csvRows));
  } catch (err) {
    next(err);
  }
});

/** GET /api/reports/export/attendance.csv — attendance records scoped by date range. */
reportsRouter.get("/export/attendance.csv", async (req, res, next) => {
  try {
    const { startDate, endDate } = parseDateRange(req.query);
    const db = getDb();

    const conditions = [];
    if (startDate) conditions.push(gte(attendanceRecords.date, startDate));
    if (endDate) conditions.push(lte(attendanceRecords.date, endDate));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        date: attendanceRecords.date,
        serviceType: attendanceRecords.serviceType,
        status: attendanceRecords.status,
        memberName: members.name,
        groupName: groups.name,
      })
      .from(attendanceRecords)
      .innerJoin(members, eq(attendanceRecords.memberId, members.id))
      .leftJoin(groups, eq(attendanceRecords.groupId, groups.id))
      .where(where)
      .orderBy(desc(attendanceRecords.date))
      .limit(5000);

    const headers = ["วันที่", "รอบการนมัสการ", "ชื่อ-นามสกุล", "กลุ่มแคร์", "สถานะการมา"];
    const csvRows = rows.map((r) => [
      new Date(r.date).toLocaleDateString("th-TH"),
      r.serviceType,
      r.memberName,
      r.groupName ?? "",
      r.status,
    ]);

    await logAudit({ req, action: "REPORTS_EXPORT_CSV", entityType: "report", details: { report: "attendance", count: rows.length } });

    sendCsv(res, `report-attendance-${Date.now()}.csv`, buildCsv(headers, csvRows));
  } catch (err) {
    next(err);
  }
});

/** GET /api/reports/export/groups.csv — groups with current member counts. */
reportsRouter.get("/export/groups.csv", async (req, res, next) => {
  try {
    const db = getDb();

    const rows = await db
      .select({
        name: groups.name,
        category: groups.category,
        status: groups.status,
        area: groups.area,
        leaderName: users.name,
        memberCount: count(groupMembers.id),
      })
      .from(groups)
      .leftJoin(users, eq(groups.leaderId, users.id))
      .leftJoin(
        groupMembers,
        and(eq(groupMembers.groupId, groups.id), eq(groupMembers.status, "active"))
      )
      .where(isNull(groups.deletedAt))
      .groupBy(groups.id, users.name)
      .orderBy(groups.name);

    const headers = ["ชื่อกลุ่ม", "ประเภท", "สถานะ", "พื้นที่", "ผู้นำกลุ่ม", "จำนวนสมาชิก"];
    const csvRows = rows.map((g) => [
      g.name,
      g.category,
      g.status,
      g.area ?? "",
      g.leaderName ?? "",
      Number(g.memberCount),
    ]);

    await logAudit({ req, action: "REPORTS_EXPORT_CSV", entityType: "report", details: { report: "groups", count: rows.length } });

    sendCsv(res, `report-groups-${Date.now()}.csv`, buildCsv(headers, csvRows));
  } catch (err) {
    next(err);
  }
});

/** GET /api/reports/export/events.csv — events scoped by eventDate range. */
reportsRouter.get("/export/events.csv", async (req, res, next) => {
  try {
    const { startDate, endDate } = parseDateRange(req.query);
    const db = getDb();

    const conditions = [];
    if (startDate) conditions.push(gte(events.eventDate, startDate));
    if (endDate) conditions.push(lte(events.eventDate, endDate));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        title: events.title,
        eventDate: events.eventDate,
        location: events.location,
        category: events.category,
        status: events.status,
      })
      .from(events)
      .where(where)
      .orderBy(desc(events.eventDate))
      .limit(5000);

    const headers = ["ชื่องาน", "วันที่จัดงาน", "สถานที่", "ประเภท", "สถานะ"];
    const csvRows = rows.map((e) => [
      e.title,
      new Date(e.eventDate).toLocaleDateString("th-TH"),
      e.location ?? "",
      e.category,
      e.status,
    ]);

    await logAudit({ req, action: "REPORTS_EXPORT_CSV", entityType: "report", details: { report: "events", count: rows.length } });

    sendCsv(res, `report-events-${Date.now()}.csv`, buildCsv(headers, csvRows));
  } catch (err) {
    next(err);
  }
});
