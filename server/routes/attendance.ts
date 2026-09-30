import { Router, type Request } from "express";
import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  attendanceRecords,
  groups,
  members,
  users,
  type AttendanceRecord,
  type AttendanceStatus,
  type ServiceType,
} from "../../shared/schema.js";
import {
  attendanceInputSchema,
  attendanceQuerySchema,
  bulkAttendanceInputSchema,
  consecutiveAbsenceQuerySchema,
  qrCheckInSchema,
} from "../../shared/validation.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);

// 1. GET / - List attendance records with filtering and pagination
attendanceRouter.get("/", async (req, res, next) => {
  try {
    const parsed = attendanceQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(
        "พารามิเตอร์การค้นหาไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const { startDate, endDate, serviceType, groupId, memberId, status, page, limit } = parsed.data;
    const offset = (page - 1) * limit;
    const db = getDb();
    const conditions = [];

    if (startDate) {
      conditions.push(gte(attendanceRecords.date, new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(attendanceRecords.date, end));
    }
    if (serviceType) {
      conditions.push(eq(attendanceRecords.serviceType, serviceType));
    }
    if (groupId) {
      conditions.push(eq(attendanceRecords.groupId, groupId));
    }
    if (memberId) {
      conditions.push(eq(attendanceRecords.memberId, memberId));
    }
    if (status) {
      conditions.push(eq(attendanceRecords.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ total: sql<number>`cast(count(*) as int)` })
      .from(attendanceRecords)
      .where(whereClause);

    const total = countResult?.total || 0;

    const rows = await db
      .select({
        id: attendanceRecords.id,
        date: attendanceRecords.date,
        serviceType: attendanceRecords.serviceType,
        groupId: attendanceRecords.groupId,
        eventId: attendanceRecords.eventId,
        memberId: attendanceRecords.memberId,
        status: attendanceRecords.status,
        checkInMethod: attendanceRecords.checkInMethod,
        checkedInBy: attendanceRecords.checkedInBy,
        checkedInAt: attendanceRecords.checkedInAt,
        notes: attendanceRecords.notes,
        createdAt: attendanceRecords.createdAt,
        memberName: members.name,
        memberNickname: members.nickname,
        memberAvatarUrl: members.avatarUrl,
        memberPhone: members.phone,
        groupName: groups.name,
        checkerName: users.name,
      })
      .from(attendanceRecords)
      .innerJoin(members, eq(attendanceRecords.memberId, members.id))
      .leftJoin(groups, eq(attendanceRecords.groupId, groups.id))
      .leftJoin(users, eq(attendanceRecords.checkedInBy, users.id))
      .where(whereClause)
      .orderBy(desc(attendanceRecords.date), desc(attendanceRecords.checkedInAt))
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 2. POST /check-in - Single member check-in (Manual or Staff scanner)
attendanceRouter.post("/check-in", async (req, res, next) => {
  try {
    const parsed = attendanceInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        "ข้อมูลการเช็คชื่อไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const { date, serviceType, groupId, eventId, memberId, status, checkInMethod, notes } = parsed.data;
    const db = getDb();

    // Verify member exists
    const [member] = await db
      .select({ id: members.id, name: members.name })
      .from(members)
      .where(and(eq(members.id, memberId), isNull(members.deletedAt)))
      .limit(1);

    if (!member) {
      throw new NotFoundError("ไม่พบข้อมูลสมาชิกในระบบ");
    }

    // Set date boundaries to match same calendar day
    const checkDate = new Date(date);
    const dayStart = new Date(checkDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(checkDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Check if record exists for same member, service type, and day
    const existingConditions = [
      eq(attendanceRecords.memberId, memberId),
      eq(attendanceRecords.serviceType, serviceType),
      gte(attendanceRecords.date, dayStart),
      lte(attendanceRecords.date, dayEnd),
    ];
    if (groupId) {
      existingConditions.push(eq(attendanceRecords.groupId, groupId));
    }

    const [existingRecord] = await db
      .select()
      .from(attendanceRecords)
      .where(and(...existingConditions))
      .limit(1);

    let savedRecord: AttendanceRecord;

    if (existingRecord) {
      // Update existing record
      const [updated] = await db
        .update(attendanceRecords)
        .set({
          status,
          checkInMethod,
          checkedInBy: req.user!.id,
          checkedInAt: new Date(),
          notes: notes || existingRecord.notes,
        })
        .where(eq(attendanceRecords.id, existingRecord.id))
        .returning();
      savedRecord = updated;
    } else {
      // Insert new record
      const [inserted] = await db
        .insert(attendanceRecords)
        .values({
          date: checkDate,
          serviceType,
          groupId: groupId || null,
          eventId: eventId || null,
          memberId,
          status,
          checkInMethod,
          checkedInBy: req.user!.id,
          checkedInAt: new Date(),
          notes: notes || null,
        })
        .returning();
      savedRecord = inserted;
    }

    await logAudit({
      userId: req.user!.id,
      action: "ATTENDANCE_CHECKIN",
      entityType: "attendance_record",
      entityId: savedRecord.id,
      details: {
        memberId,
        memberName: member.name,
        serviceType,
        status,
        checkInMethod,
      },
      req,
    });

    res.status(existingRecord ? 200 : 201).json({
      success: true,
      data: savedRecord,
      message: `บันทึกการเข้าร่วมของ ${member.name} (${status}) เรียบร้อยแล้ว`,
    });
  } catch (err) {
    next(err);
  }
});

// 3. POST /bulk - Bulk check-in for group or service session
attendanceRouter.post("/bulk", async (req, res, next) => {
  try {
    const parsed = bulkAttendanceInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        "ข้อมูลการเช็คชื่อแบบกลุ่มไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const { date, serviceType, groupId, eventId, records } = parsed.data;
    const db = getDb();
    const checkDate = new Date(date);
    const dayStart = new Date(checkDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(checkDate);
    dayEnd.setHours(23, 59, 59, 999);

    const results = [];

    for (const item of records) {
      const existingConditions = [
        eq(attendanceRecords.memberId, item.memberId),
        eq(attendanceRecords.serviceType, serviceType),
        gte(attendanceRecords.date, dayStart),
        lte(attendanceRecords.date, dayEnd),
      ];
      if (groupId) {
        existingConditions.push(eq(attendanceRecords.groupId, groupId));
      }

      const [existing] = await db
        .select()
        .from(attendanceRecords)
        .where(and(...existingConditions))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(attendanceRecords)
          .set({
            status: item.status,
            checkInMethod: item.checkInMethod,
            checkedInBy: req.user!.id,
            checkedInAt: new Date(),
            notes: item.notes || existing.notes,
          })
          .where(eq(attendanceRecords.id, existing.id))
          .returning();
        results.push(updated);
      } else {
        const [inserted] = await db
          .insert(attendanceRecords)
          .values({
            date: checkDate,
            serviceType,
            groupId: groupId || null,
            eventId: eventId || null,
            memberId: item.memberId,
            status: item.status,
            checkInMethod: item.checkInMethod,
            checkedInBy: req.user!.id,
            checkedInAt: new Date(),
            notes: item.notes || null,
          })
          .returning();
        results.push(inserted);
      }
    }

    await logAudit({
      userId: req.user!.id,
      action: "BULK_ATTENDANCE_CHECKIN",
      entityType: "attendance_record",
      entityId: groupId || serviceType,
      details: { count: results.length, serviceType, groupId: groupId || null },
      req,
    });

    res.json({
      success: true,
      data: results,
      message: `บันทึกการเช็คชื่อจำนวน ${results.length} คนเรียบร้อยแล้ว`,
    });
  } catch (err) {
    next(err);
  }
});

// 4. POST /qr-scan - Process QR check-in
attendanceRouter.post("/qr-scan", async (req, res, next) => {
  try {
    const parsed = qrCheckInSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        "รหัส QR ไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const { token, serviceType, groupId, eventId, date } = parsed.data;
    const db = getDb();

    // Extract member ID from token (Supports formats: "PK-MEM-{uuid}" or raw "{uuid}")
    let targetMemberId = token.trim();
    if (targetMemberId.startsWith("PK-MEM-")) {
      targetMemberId = targetMemberId.replace("PK-MEM-", "");
    }

    // Try parsing JSON if token was encoded as JSON string
    if (targetMemberId.startsWith("{") && targetMemberId.endsWith("}")) {
      try {
        const json = JSON.parse(targetMemberId);
        targetMemberId = json.memberId || json.id || targetMemberId;
      } catch {
        // ignore parse error
      }
    }

    // Find member
    const [member] = await db
      .select({
        id: members.id,
        name: members.name,
        nickname: members.nickname,
        phone: members.phone,
        avatarUrl: members.avatarUrl,
        membershipStatus: members.membershipStatus,
      })
      .from(members)
      .where(and(eq(members.id, targetMemberId), isNull(members.deletedAt)))
      .limit(1);

    if (!member) {
      throw new NotFoundError("ไม่พบข้อมูลสมาชิกจากรหัส QR ที่สแกน");
    }

    const checkDate = date ? new Date(date) : new Date();
    const dayStart = new Date(checkDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(checkDate);
    dayEnd.setHours(23, 59, 59, 999);

    const existingConditions = [
      eq(attendanceRecords.memberId, member.id),
      eq(attendanceRecords.serviceType, serviceType),
      gte(attendanceRecords.date, dayStart),
      lte(attendanceRecords.date, dayEnd),
    ];
    if (groupId) {
      existingConditions.push(eq(attendanceRecords.groupId, groupId));
    }

    const [existing] = await db
      .select()
      .from(attendanceRecords)
      .where(and(...existingConditions))
      .limit(1);

    let record: AttendanceRecord;

    if (existing) {
      const [updated] = await db
        .update(attendanceRecords)
        .set({
          status: "present",
          checkInMethod: "qr_scan",
          checkedInBy: req.user!.id,
          checkedInAt: new Date(),
        })
        .where(eq(attendanceRecords.id, existing.id))
        .returning();
      record = updated;
    } else {
      const [inserted] = await db
        .insert(attendanceRecords)
        .values({
          date: checkDate,
          serviceType,
          groupId: groupId || null,
          eventId: eventId || null,
          memberId: member.id,
          status: "present",
          checkInMethod: "qr_scan",
          checkedInBy: req.user!.id,
          checkedInAt: new Date(),
        })
        .returning();
      record = inserted;
    }

    await logAudit({
      userId: req.user!.id,
      action: "QR_ATTENDANCE_CHECKIN",
      entityType: "attendance_record",
      entityId: record.id,
      details: { memberId: member.id, memberName: member.name, serviceType },
      req,
    });

    res.json({
      success: true,
      data: {
        attendance: record,
        member,
      },
      message: `เช็คชื่อสำเร็จ: ${member.name}`,
    });
  } catch (err) {
    next(err);
  }
});

// 5. GET /absentees - Detect consecutive absentees (pastoral follow-up)
attendanceRouter.get("/absentees", async (req, res, next) => {
  try {
    const parsed = consecutiveAbsenceQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(
        "พารามิเตอร์ไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const { threshold, serviceType, groupId } = parsed.data;
    const db = getDb();

    // 1. Find the distinct recent N service dates for this service type
    const dateConditions = [eq(attendanceRecords.serviceType, serviceType)];
    if (groupId) {
      dateConditions.push(eq(attendanceRecords.groupId, groupId));
    }

    const distinctDatesResult = await db
      .select({
        serviceDate: sql<string>`DATE(${attendanceRecords.date})`,
      })
      .from(attendanceRecords)
      .where(and(...dateConditions))
      .groupBy(sql`DATE(${attendanceRecords.date})`)
      .orderBy(desc(sql`DATE(${attendanceRecords.date})`))
      .limit(threshold);

    const recentDates = distinctDatesResult.map((d) => d.serviceDate);

    // If there aren't enough distinct recorded sessions yet, return empty list
    if (recentDates.length === 0) {
      return res.json({
        success: true,
        data: [],
        meta: {
          threshold,
          serviceType,
          recentRecordedDatesCount: 0,
        },
      });
    }

    // 2. Fetch all active members
    const activeMembers = await db
      .select({
        id: members.id,
        name: members.name,
        nickname: members.nickname,
        phone: members.phone,
        area: members.area,
        group: members.group,
        status: members.status,
        membershipStatus: members.membershipStatus,
        assignedLeaderId: members.assignedLeaderId,
        leaderName: users.name,
        leaderEmail: users.email,
      })
      .from(members)
      .leftJoin(users, eq(members.assignedLeaderId, users.id))
      .where(
        and(
          isNull(members.deletedAt),
          inArray(members.membershipStatus, ["active", "candidate", "visitor"])
        )
      );

    // 3. Find attendance records for these members on those recent dates
    const memberAttendances = await db
      .select({
        memberId: attendanceRecords.memberId,
        serviceDate: sql<string>`DATE(${attendanceRecords.date})`,
        status: attendanceRecords.status,
      })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.serviceType, serviceType),
          groupId ? eq(attendanceRecords.groupId, groupId) : sql`1=1`,
          inArray(sql`DATE(${attendanceRecords.date})`, recentDates),
          inArray(attendanceRecords.status, ["present", "online"])
        )
      );

    // Group attendances by memberId
    const attendedMembersMap = new Set<string>();
    memberAttendances.forEach((rec) => {
      attendedMembersMap.add(rec.memberId);
    });

    // Members who did NOT attend any of the recent N dates
    const absentees = [];

    for (const m of activeMembers) {
      if (!attendedMembersMap.has(m.id)) {
        // Find last attended date if any
        const [lastRecord] = await db
          .select({
            date: attendanceRecords.date,
          })
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.memberId, m.id),
              inArray(attendanceRecords.status, ["present", "online"])
            )
          )
          .orderBy(desc(attendanceRecords.date))
          .limit(1);

        absentees.push({
          ...m,
          consecutiveAbsenceCount: recentDates.length,
          lastAttendedDate: lastRecord ? lastRecord.date : null,
        });
      }
    }

    res.json({
      success: true,
      data: absentees,
      meta: {
        threshold,
        serviceType,
        totalAbsentees: absentees.length,
        comparedDates: recentDates,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 6. GET /summary - Attendance statistics & trends
attendanceRouter.get("/summary", async (_req, res, next) => {
  try {
    const db = getDb();
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const [totalThisWeek] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(attendanceRecords)
      .where(
        and(
          gte(attendanceRecords.date, startOfWeek),
          inArray(attendanceRecords.status, ["present", "online"])
        )
      );

    const [totalAllTime] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(attendanceRecords)
      .where(inArray(attendanceRecords.status, ["present", "online"]));

    // Status breakdown for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const statusCounts = await db
      .select({
        status: attendanceRecords.status,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(attendanceRecords)
      .where(gte(attendanceRecords.date, thirtyDaysAgo))
      .groupBy(attendanceRecords.status);

    // Recent 6 services attendance trend
    const trends = await db
      .select({
        date: sql<string>`DATE(${attendanceRecords.date})`,
        serviceType: attendanceRecords.serviceType,
        count: sql<number>`cast(count(distinct ${attendanceRecords.memberId}) as int)`,
      })
      .from(attendanceRecords)
      .where(inArray(attendanceRecords.status, ["present", "online"]))
      .groupBy(sql`DATE(${attendanceRecords.date})`, attendanceRecords.serviceType)
      .orderBy(desc(sql`DATE(${attendanceRecords.date})`))
      .limit(6);

    res.json({
      success: true,
      data: {
        totalThisWeek: totalThisWeek?.count || 0,
        totalAllTime: totalAllTime?.count || 0,
        statusBreakdown: statusCounts,
        recentTrends: trends.reverse(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// 7. GET /export - Export attendance records as UTF-8 CSV
attendanceRouter.get("/export", async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        date: attendanceRecords.date,
        serviceType: attendanceRecords.serviceType,
        status: attendanceRecords.status,
        checkInMethod: attendanceRecords.checkInMethod,
        memberName: members.name,
        memberNickname: members.nickname,
        memberPhone: members.phone,
        groupName: groups.name,
        checkerName: users.name,
        checkedInAt: attendanceRecords.checkedInAt,
        notes: attendanceRecords.notes,
      })
      .from(attendanceRecords)
      .innerJoin(members, eq(attendanceRecords.memberId, members.id))
      .leftJoin(groups, eq(attendanceRecords.groupId, groups.id))
      .leftJoin(users, eq(attendanceRecords.checkedInBy, users.id))
      .orderBy(desc(attendanceRecords.date))
      .limit(5000);

    const headers = [
      "วันที่",
      "รอบการนมัสการ",
      "กลุ่มแคร์",
      "ชื่อ-นามสกุล",
      "ชื่อเล่น",
      "เบอร์โทร",
      "สถานะการมา",
      "วิธีการเช็คชื่อ",
      "ผู้เช็คชื่อ",
      "เวลาเช็คชื่อ",
      "หมายเหตุ",
    ];

    const serviceTypeMap: Record<string, string> = {
      sunday_service: "นมัสการวันอาทิตย์",
      care_group: "กลุ่มแคร์",
      prayer_meeting: "อธิษฐานวันพุธ",
      youth_service: "นมัสการวัยรุ่น",
      special_event: "กิจกรรมพิเศษ",
    };

    const statusMap: Record<string, string> = {
      present: "มา",
      absent: "ขาด",
      leave: "ลา",
      online: "ออนไลน์",
    };

    const methodMap: Record<string, string> = {
      manual: "เจ้าหน้าที่เช็คชื่อ",
      qr_scan: "สแกน QR Code",
      self_qr: "สแกนด้วยตนเอง",
      kiosk: "ตู้คีออสก์",
    };

    const csvRows = [headers.join(",")];

    for (const r of rows) {
      const line = [
        `"${new Date(r.date).toLocaleDateString("th-TH")}"`,
        `"${serviceTypeMap[r.serviceType] || r.serviceType}"`,
        `"${r.groupName || "-"}"`,
        `"${r.memberName.replace(/"/g, '""')}"`,
        `"${r.memberNickname || "-"}"`,
        `"${r.memberPhone || "-"}"`,
        `"${statusMap[r.status] || r.status}"`,
        `"${methodMap[r.checkInMethod] || r.checkInMethod}"`,
        `"${r.checkerName || "-"}"`,
        `"${new Date(r.checkedInAt).toLocaleTimeString("th-TH")}"`,
        `"${(r.notes || "").replace(/"/g, '""')}"`,
      ];
      csvRows.push(line.join(","));
    }

    const csvContent = "\uFEFF" + csvRows.join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-export-${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

// 8. DELETE /:id - Cancel attendance record (Admin only)
attendanceRouter.delete(
  "/:id",
  requireRole("super_admin", "admin"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const db = getDb();

      const [existing] = await db
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.id, id))
        .limit(1);

      if (!existing) {
        throw new NotFoundError("ไม่พบบันทึกการเช็คชื่อที่ต้องการลบ");
      }

      await db.delete(attendanceRecords).where(eq(attendanceRecords.id, id));

      await logAudit({
        userId: req.user!.id,
        action: "DELETE_ATTENDANCE",
        entityType: "attendance_record",
        entityId: id,
        details: { memberId: existing.memberId, date: existing.date.toISOString() },
        req,
      });

      res.json({
        success: true,
        message: "ลบบันทึกการเช็คชื่อเรียบร้อยแล้ว",
      });
    } catch (err) {
      next(err);
    }
  }
);
