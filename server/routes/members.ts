import { Router, type Request } from "express";
import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { members, type Member, type UserRole } from "../../shared/schema.js";
import {
  checkDuplicateMemberSchema,
  memberInputSchema,
  memberQuerySchema,
} from "../../shared/validation.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";

export const membersRouter = Router();

membersRouter.use(requireAuth);

function maskSensitiveData(member: Member, userRole: UserRole, userId: string): Member {
  const isPrivileged =
    userRole === "super_admin" ||
    userRole === "admin" ||
    userRole === "staff" ||
    member.assignedLeaderId === userId;

  if (isPrivileged) {
    return member;
  }

  return {
    ...member,
    phone: member.phone ? member.phone.replace(/(\d{3})\d{3,4}(\d{3})/, "$1-xxx-$2") : null,
    email: member.email ? member.email.replace(/(.{2})(.*)(?=@)/, "$1***") : null,
    address: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    emergencyContactRelation: null,
    notes: null,
  };
}

// 1. GET / - List members with pagination, search, filter, sort
membersRouter.get("/", async (req, res, next) => {
  try {
    const parsed = memberQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(
        "พารามิเตอร์การค้นหาไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const { page, limit, search, area, group, status, membershipStatus, sortBy, sortOrder, includeDeleted } =
      parsed.data;
    const offset = (page - 1) * limit;

    const db = getDb();
    const conditions = [];

    // Role-based soft-delete visibility
    const canViewDeleted = req.user!.role === "super_admin" || req.user!.role === "admin";
    if (!includeDeleted || !canViewDeleted) {
      conditions.push(isNull(members.deletedAt));
    }

    if (area && area !== "ทั้งหมด") {
      conditions.push(eq(members.area, area));
    }
    if (group && group !== "ทั้งหมด") {
      conditions.push(eq(members.group, group));
    }
    if (status) {
      conditions.push(eq(members.status, status));
    }
    if (membershipStatus) {
      conditions.push(eq(members.membershipStatus, membershipStatus));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(members.name, searchPattern),
          ilike(members.nickname, searchPattern),
          ilike(members.phone, searchPattern),
          ilike(members.email, searchPattern)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count for pagination
    const [countResult] = await db
      .select({ total: count() })
      .from(members)
      .where(whereClause);
    const total = Number(countResult?.total ?? 0);

    const orderClause =
      sortBy === "name"
        ? (sortOrder === "asc" ? asc(members.name) : desc(members.name))
        : sortBy === "joinedAt"
        ? (sortOrder === "asc" ? asc(members.joinedAt) : desc(members.joinedAt))
        : (sortOrder === "asc" ? asc(members.createdAt) : desc(members.createdAt));

    const rows = await db
      .select()
      .from(members)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(orderClause);

    // Apply data masking based on role
    const maskedRows = rows.map((m) => maskSensitiveData(m, req.user!.role, req.user!.id));

    res.json({
      success: true,
      data: maskedRows,
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

// 2. GET /check-duplicate - Check if phone or email exists
membersRouter.get("/check-duplicate", async (req, res, next) => {
  try {
    const parsed = checkDuplicateMemberSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError("ข้อมูลไม่ถูกต้อง");
    }

    const { phone, email, excludeId } = parsed.data;
    if (!phone && !email) {
      return res.json({ success: true, data: { isDuplicate: false } });
    }

    const db = getDb();
    const conditions = [];
    if (phone) conditions.push(eq(members.phone, phone));
    if (email) conditions.push(eq(members.email, email));

    const checkQuery = db
      .select({ id: members.id, name: members.name, phone: members.phone, email: members.email })
      .from(members)
      .where(
        and(
          isNull(members.deletedAt),
          excludeId ? sql`${members.id} != ${excludeId}` : undefined,
          or(...conditions)
        )
      )
      .limit(1);

    const [existing] = await checkQuery;

    if (existing) {
      const matchField = phone && existing.phone === phone ? "phone" : "email";
      return res.json({
        success: true,
        data: {
          isDuplicate: true,
          conflictField: matchField,
          existingMemberName: existing.name,
        },
      });
    }

    res.json({ success: true, data: { isDuplicate: false } });
  } catch (err) {
    next(err);
  }
});

// 3. GET /export/csv - Export members to CSV (UTF-8 BOM supported)
membersRouter.get(
  "/export/csv",
  requireRole("super_admin", "admin", "staff", "ministry_leader", "group_leader"),
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(members)
        .where(isNull(members.deletedAt))
        .orderBy(members.name);

      const headers = [
        "รหัส",
        "ชื่อ-นามสกุล",
        "ชื่อเล่น",
        "เพศ",
        "เบอร์โทรศัพท์",
        "อีเมล",
        "LINE ID",
        "ที่อยู่",
        "บทบาท",
        "พื้นที่",
        "กลุ่ม",
        "สถานะสมาชิก",
        "สถานะการติดตาม",
        "วันที่เริ่มเข้าร่วม",
        "ผู้ติดต่อฉุกเฉิน",
        "เบอร์ฉุกเฉิน",
      ];

      const csvRows = [headers.join(",")];

      for (const m of rows) {
        const masked = maskSensitiveData(m, req.user!.role, req.user!.id);
        const rowData = [
          `"${masked.id}"`,
          `"${masked.name.replace(/"/g, '""')}"`,
          `"${(masked.nickname || "").replace(/"/g, '""')}"`,
          `"${masked.gender || ""}"`,
          `"${masked.phone || ""}"`,
          `"${masked.email || ""}"`,
          `"${masked.lineId || ""}"`,
          `"${(masked.address || "").replace(/"/g, '""')}"`,
          `"${masked.role}"`,
          `"${(masked.area || "").replace(/"/g, '""')}"`,
          `"${(masked.group || "").replace(/"/g, '""')}"`,
          `"${masked.membershipStatus}"`,
          `"${masked.status}"`,
          `"${masked.joinedAt ? new Date(masked.joinedAt).toLocaleDateString("th-TH") : ""}"`,
          `"${(masked.emergencyContactName || "").replace(/"/g, '""')}"`,
          `"${masked.emergencyContactPhone || ""}"`,
        ];
        csvRows.push(rowData.join(","));
      }

      await logAudit({
        req,
        action: "MEMBERS_EXPORT_CSV",
        entityType: "member",
        details: { count: rows.length },
      });

      // UTF-8 BOM (\uFEFF) for Excel Thai encoding support
      const csvContent = "\uFEFF" + csvRows.join("\r\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=members-${Date.now()}.csv`);
      res.send(csvContent);
    } catch (err) {
      next(err);
    }
  }
);

// 4. GET /:id - Single member
membersRouter.get("/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(members)
      .where(and(eq(members.id, req.params.id), isNull(members.deletedAt)))
      .limit(1);

    if (!row) {
      throw new NotFoundError("ไม่พบข้อมูลสมาชิกที่ต้องการ");
    }

    res.json({
      success: true,
      data: maskSensitiveData(row, req.user!.role, req.user!.id),
    });
  } catch (err) {
    next(err);
  }
});

// 5. POST / - Create member
membersRouter.post(
  "/",
  requireRole("super_admin", "admin", "staff"),
  async (req, res, next) => {
    try {
      const parsed = memberInputSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues[0]?.message ?? "ข้อมูลสมาชิกไม่ถูกต้อง",
          parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
        );
      }

      const db = getDb();

      // Check duplicates for non-empty phone and email
      if (parsed.data.phone || parsed.data.email) {
        const dupConditions = [];
        if (parsed.data.phone) dupConditions.push(eq(members.phone, parsed.data.phone));
        if (parsed.data.email) dupConditions.push(eq(members.email, parsed.data.email));

        const [existing] = await db
          .select({ id: members.id, name: members.name, phone: members.phone, email: members.email })
          .from(members)
          .where(and(isNull(members.deletedAt), or(...dupConditions)))
          .limit(1);

        if (existing) {
          const field = parsed.data.phone && existing.phone === parsed.data.phone ? "เบอร์โทรศัพท์" : "อีเมล";
          throw new ConflictError(`${field} นี้มีอยู่ในระบบแล้ว (สมาชิก: ${existing.name})`);
        }
      }

      const [created] = await db
        .insert(members)
        .values({
          ...parsed.data,
          nickname: parsed.data.nickname || null,
          avatarUrl: parsed.data.avatarUrl || null,
          gender: parsed.data.gender || null,
          birthDate: parsed.data.birthDate || null,
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
          lineId: parsed.data.lineId || null,
          address: parsed.data.address || null,
          area: parsed.data.area || null,
          group: parsed.data.group || null,
          assignedLeaderId: parsed.data.assignedLeaderId || null,
          emergencyContactName: parsed.data.emergencyContactName || null,
          emergencyContactPhone: parsed.data.emergencyContactPhone || null,
          emergencyContactRelation: parsed.data.emergencyContactRelation || null,
          consentDate: parsed.data.consentGiven ? new Date() : null,
          notes: parsed.data.notes || null,
          createdById: req.user!.id,
          updatedById: req.user!.id,
        })
        .returning();

      await logAudit({
        req,
        action: "MEMBER_CREATED",
        entityType: "member",
        entityId: created.id,
        details: { name: created.name },
      });

      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }
);

// 6. PUT /:id - Update member
membersRouter.put(
  "/:id",
  requireRole("super_admin", "admin", "staff", "ministry_leader", "group_leader"),
  async (req, res, next) => {
    try {
      const parsed = memberInputSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
          parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
        );
      }

      const db = getDb();
      const [existing] = await db
        .select()
        .from(members)
        .where(and(eq(members.id, req.params.id), isNull(members.deletedAt)))
        .limit(1);

      if (!existing) {
        throw new NotFoundError("ไม่พบสมาชิกที่ต้องการแก้ไข");
      }

      // Check duplicates excluding current member
      if (parsed.data.phone || parsed.data.email) {
        const dupConditions = [];
        if (parsed.data.phone) dupConditions.push(eq(members.phone, parsed.data.phone));
        if (parsed.data.email) dupConditions.push(eq(members.email, parsed.data.email));

        const [dup] = await db
          .select({ id: members.id, name: members.name, phone: members.phone, email: members.email })
          .from(members)
          .where(
            and(
              sql`${members.id} != ${req.params.id}`,
              isNull(members.deletedAt),
              or(...dupConditions)
            )
          )
          .limit(1);

        if (dup) {
          const field = parsed.data.phone && dup.phone === parsed.data.phone ? "เบอร์โทรศัพท์" : "อีเมล";
          throw new ConflictError(`${field} นี้ถูกใช้งานแล้วโดยสมาชิก: ${dup.name}`);
        }
      }

      const [updated] = await db
        .update(members)
        .set({
          ...parsed.data,
          updatedById: req.user!.id,
          updatedAt: new Date(),
        })
        .where(eq(members.id, req.params.id))
        .returning();

      await logAudit({
        req,
        action: "MEMBER_UPDATED",
        entityType: "member",
        entityId: updated.id,
        details: { changes: Object.keys(parsed.data) },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// 7. DELETE /:id - Soft delete member
membersRouter.delete(
  "/:id",
  requireRole("super_admin", "admin"),
  async (req, res, next) => {
    try {
      const db = getDb();
      const [deleted] = await db
        .update(members)
        .set({
          deletedAt: new Date(),
          updatedById: req.user!.id,
          updatedAt: new Date(),
        })
        .where(and(eq(members.id, req.params.id), isNull(members.deletedAt)))
        .returning();

      if (!deleted) {
        throw new NotFoundError("ไม่พบสมาชิก หรือสมาชิกถูกลบไปแล้ว");
      }

      await logAudit({
        req,
        action: "MEMBER_SOFT_DELETED",
        entityType: "member",
        entityId: deleted.id,
        details: { name: deleted.name },
      });

      res.json({ success: true, data: deleted });
    } catch (err) {
      next(err);
    }
  }
);

// 8. POST /:id/restore - Restore soft-deleted member
membersRouter.post(
  "/:id/restore",
  requireRole("super_admin", "admin"),
  async (req, res, next) => {
    try {
      const db = getDb();
      const [restored] = await db
        .update(members)
        .set({
          deletedAt: null,
          updatedById: req.user!.id,
          updatedAt: new Date(),
        })
        .where(eq(members.id, req.params.id))
        .returning();

      if (!restored) {
        throw new NotFoundError("ไม่พบสมาชิกที่ต้องการกู้คืน");
      }

      await logAudit({
        req,
        action: "MEMBER_RESTORED",
        entityType: "member",
        entityId: restored.id,
        details: { name: restored.name },
      });

      res.json({ success: true, data: restored });
    } catch (err) {
      next(err);
    }
  }
);
