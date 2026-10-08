import { Router, type Request } from "express";
import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { groupMembers, members, type Member, type UserRole } from "../../shared/schema.js";
import {
  checkDuplicateMemberSchema,
  memberInputSchema,
  memberQuerySchema,
} from "../../shared/validation.js";
import {
  ADMIN_ROLES,
  MEMBER_CONTACT_ROLES,
  MEMBER_CREATE_ROLES,
  MEMBER_UPDATE_ROLES,
} from "../../shared/roles.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { runAtomically } from "../lib/atomicWrites.js";
import { careGroupsOf, careMembershipStatements, requireCareGroup } from "../lib/careMembership.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";

export const membersRouter = Router();

membersRouter.use(requireAuth);

/**
 * Masks a phone number whatever its format: keeps the first three and last
 * three digits. The earlier regex only matched an unbroken run of 9-10 digits,
 * so "081-234-5678" and "+66 81 234 5678" came back unmasked. A value with too
 * few digits to mask safely (or none, such as "abc") is hidden entirely.
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "xxx";
  return `${digits.slice(0, 3)}-xxx-${digits.slice(-3)}`;
}

/** Keeps the first two characters of the name part (one when it has two or fewer). */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  const local = email.slice(0, at);
  const keep = local.length > 2 ? 2 : 1;
  return `${local.slice(0, keep)}***${email.slice(at)}`;
}

/**
 * Applies the role-based field mask to a member row.
 *
 * Exported so `members.test.ts` can assert the real rules instead of a copy of
 * them: a duplicated mask in the test suite cannot fail when this function
 * changes, which is how `lineId` stayed visible to every signed-in role.
 */
export function maskSensitiveData(member: Member, userRole: UserRole, userId: string): Member {
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
    phone: member.phone ? maskPhone(member.phone) : null,
    email: member.email ? maskEmail(member.email) : null,
    // LINE ID is a personal contact handle: it identifies a real person on a
    // third-party network and is not needed to care for them, so it is masked
    // alongside the phone number and email. Leaving it in place meant the
    // lowest-privileged signed-in role (`viewer`) received a directory of every
    // member's LINE ID from the list endpoint.
    lineId: null,
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

    const { page, limit, search, area, group, careGroupId, status, membershipStatus, sortBy, sortOrder, includeDeleted } =
      parsed.data;
    const offset = (page - 1) * limit;

    const db = getDb();
    const conditions = [];

    // Role-based soft-delete visibility (same set as the delete/restore gates)
    const canViewDeleted = ADMIN_ROLES.includes(req.user!.role);
    if (!includeDeleted || !canViewDeleted) {
      conditions.push(isNull(members.deletedAt));
    }

    if (area && area !== "ทั้งหมด") {
      conditions.push(eq(members.area, area));
    }
    if (group && group !== "ทั้งหมด") {
      conditions.push(eq(members.group, group));
    }
    if (careGroupId) {
      conditions.push(
        inArray(
          members.id,
          db
            .select({ id: groupMembers.memberId })
            .from(groupMembers)
            .where(and(eq(groupMembers.groupId, careGroupId), eq(groupMembers.status, "active")))
        )
      );
    }
    if (status) {
      conditions.push(eq(members.status, status));
    }
    if (membershipStatus) {
      conditions.push(eq(members.membershipStatus, membershipStatus));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      // Searching by phone or email matches the unmasked value. For a role that
      // only receives masked contacts that would be a lookup oracle ("whose
      // number is 081-234-5678?"), so those roles search names only.
      const canSearchContacts = MEMBER_CONTACT_ROLES.includes(req.user!.role);
      conditions.push(
        or(
          ilike(members.name, searchPattern),
          ilike(members.nickname, searchPattern),
          ...(canSearchContacts
            ? [ilike(members.phone, searchPattern), ilike(members.email, searchPattern)]
            : [])
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
    const careOf = await careGroupsOf(db, rows.map((m) => m.id));
    const maskedRows = rows.map((m) => ({
      ...maskSensitiveData(m, req.user!.role, req.user!.id),
      careGroup: careOf.get(m.id) ?? null,
    }));

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
membersRouter.get("/check-duplicate", requireRole(...MEMBER_UPDATE_ROLES), async (req, res, next) => {
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
  requireRole(...MEMBER_UPDATE_ROLES),
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

    const careOf = await careGroupsOf(db, [row.id]);
    res.json({
      success: true,
      data: { ...maskSensitiveData(row, req.user!.role, req.user!.id), careGroup: careOf.get(row.id) ?? null },
    });
  } catch (err) {
    next(err);
  }
});

// 5. POST / - Create member
membersRouter.post(
  "/",
  requireRole(...MEMBER_CREATE_ROLES),
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

      const { careGroupId, ...input } = parsed.data;
      const care = careGroupId ? await requireCareGroup(db, careGroupId) : null;
      const newId = randomUUID();
      const values = {
        ...input,
        id: newId,
        nickname: input.nickname || null,
        avatarUrl: input.avatarUrl || null,
        gender: input.gender || null,
        birthDate: input.birthDate || null,
        phone: input.phone || null,
        email: input.email || null,
        lineId: input.lineId || null,
        address: input.address || null,
        area: input.area || null,
        group: care ? care.name : input.group || null,
        assignedLeaderId: input.assignedLeaderId || null,
        emergencyContactName: input.emergencyContactName || null,
        emergencyContactPhone: input.emergencyContactPhone || null,
        emergencyContactRelation: input.emergencyContactRelation || null,
        consentDate: input.consentGiven ? new Date() : null,
        notes: input.notes || null,
        createdById: req.user!.id,
        updatedById: req.user!.id,
      };
      // Member row and care-group membership are written as one unit, so a
      // new person is never left without the care group that was chosen.
      await runAtomically((tx) => [tx.insert(members).values(values), ...(care ? careMembershipStatements(tx, newId, care) : [])]);
      const [created] = await db.select().from(members).where(eq(members.id, newId)).limit(1);

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
  requireRole(...MEMBER_UPDATE_ROLES),
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
              // A group leader is only told about duplicates inside their own
              // scope. A match outside it must look the same as no match, or
              // this endpoint becomes a phone/email lookup for the whole church.
              scope ? (scope.length ? inArray(members.id, scope) : sql`false`) : undefined,
              or(...dupConditions)
            )
          )
          .limit(1);

        if (dup) {
          const field = parsed.data.phone && dup.phone === parsed.data.phone ? "เบอร์โทรศัพท์" : "อีเมล";
          // Restricted roles get one generic message with no name, so the
          // wording cannot reveal who holds the contact.
          throw new ConflictError(
            scope ? `${field} นี้ถูกใช้งานแล้วในระบบ` : `${field} นี้ถูกใช้งานแล้วโดยสมาชิก: ${dup.name}`
          );
        }
      }

      const { careGroupId, ...input } = parsed.data;
      const care = careGroupId ? await requireCareGroup(db, careGroupId) : null;
      const changes = { ...input, updatedById: req.user!.id, updatedAt: new Date() };
      if (careGroupId === undefined) {
        await db.update(members).set(changes).where(eq(members.id, req.params.id));
      } else {
        // "" / null clears the care group; a uuid moves the member (one active care group at a time).
        await runAtomically((tx) => [
          tx.update(members).set(changes).where(eq(members.id, req.params.id)),
          ...careMembershipStatements(tx, req.params.id, care),
        ]);
      }
      const [updated] = await db.select().from(members).where(eq(members.id, req.params.id)).limit(1);

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
  requireRole(...ADMIN_ROLES),
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
  requireRole(...ADMIN_ROLES),
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
