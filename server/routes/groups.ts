import { Router, type Request } from "express";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  attendanceRecords,
  groups,
  groupMembers,
  members,
  users,
  type Group,
  type GroupMember,
} from "../../shared/schema.js";
import {
  groupInputSchema,
  groupMemberInputSchema,
  groupMemberUpdateSchema,
  groupQuerySchema,
} from "../../shared/validation.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";

export const groupsRouter = Router();

groupsRouter.use(requireAuth);

// Helper to check if user can manage the group (admin, super_admin, ministry_leader, or assigned leader/co-leader)
async function verifyGroupManagementAccess(req: Request, groupId: string) {
  const user = req.user!;
  if (user.role === "super_admin" || user.role === "admin" || user.role === "ministry_leader") {
    return true;
  }

  if (user.role === "group_leader") {
    const db = getDb();
    const [group] = await db
      .select({ id: groups.id, leaderId: groups.leaderId, coLeaderId: groups.coLeaderId })
      .from(groups)
      .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
      .limit(1);

    if (!group) {
      throw new NotFoundError("ไม่พบข้อมูลกลุ่มที่ระบุ");
    }

    if (group.leaderId === user.id || group.coLeaderId === user.id) {
      return true;
    }

    // Also check if user has leader or assistant_leader role in active group_members
    // Find linked member record for user
    const [linkedMember] = await db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.userId, user.id), isNull(members.deletedAt)))
      .limit(1);

    if (linkedMember) {
      const [membership] = await db
        .select({ role: groupMembers.role })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.memberId, linkedMember.id),
            eq(groupMembers.status, "active"),
            inArray(groupMembers.role, ["leader", "assistant_leader"])
          )
        )
        .limit(1);

      if (membership) {
        return true;
      }
    }
  }

  throw new ForbiddenError("คุณไม่มีสิทธิ์ในการจัดการกลุ่มนี้");
}

// Helper to mask location and coordinates for private/confidential groups for non-privileged users
function maskGroupLocation<T extends { privacy?: string; meetingLocation?: string | null; latitude?: string | null; longitude?: string | null; area?: string | null }>(
  group: T,
  req: Request,
  isLeaderOrActiveMember: boolean = false
): T {
  const user = req.user!;
  const isPrivileged =
    user.role === "super_admin" ||
    user.role === "admin" ||
    user.role === "ministry_leader" ||
    isLeaderOrActiveMember;

  if (isPrivileged || group.privacy === "public") {
    return group;
  }

  // Mask private / confidential group location
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

// 1. GET / - List groups with member count, leader info, and privacy masking
groupsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = groupQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(
        "พารามิเตอร์การค้นหาไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const { search, category, status, privacy, area } = parsed.data;
    const db = getDb();
    const conditions = [isNull(groups.deletedAt)];

    if (status) {
      conditions.push(eq(groups.status, status));
    }
    if (category) {
      conditions.push(eq(groups.category, category));
    }
    if (privacy) {
      conditions.push(eq(groups.privacy, privacy));
    }
    if (area) {
      conditions.push(ilike(groups.area, `%${area}%`));
    }
    if (search) {
      conditions.push(
        or(
          ilike(groups.name, `%${search}%`),
          ilike(groups.meetingLocation, `%${search}%`),
          ilike(groups.description, `%${search}%`),
          ilike(groups.area, `%${search}%`)
        )!
      );
    }

    const rows = await db
      .select({
        id: groups.id,
        name: groups.name,
        leaderId: groups.leaderId,
        coLeaderId: groups.coLeaderId,
        category: groups.category,
        privacy: groups.privacy,
        status: groups.status,
        area: groups.area,
        meetingDay: groups.meetingDay,
        meetingTime: groups.meetingTime,
        meetingLocation: groups.meetingLocation,
        latitude: groups.latitude,
        longitude: groups.longitude,
        maxMembers: groups.maxMembers,
        isOpen: groups.isOpen,
        avatarUrl: groups.avatarUrl,
        coverUrl: groups.coverUrl,
        startDate: groups.startDate,
        description: groups.description,
        createdById: groups.createdById,
        createdAt: groups.createdAt,
        updatedAt: groups.updatedAt,
        leaderName: users.name,
        leaderEmail: users.email,
        memberCount: sql<number>`cast(count(distinct case when ${groupMembers.status} = 'active' then ${groupMembers.id} end) as int)`,
      })
      .from(groups)
      .leftJoin(users, eq(groups.leaderId, users.id))
      .leftJoin(groupMembers, eq(groups.id, groupMembers.groupId))
      .where(and(...conditions))
      .groupBy(groups.id, users.id)
      .orderBy(desc(groups.createdAt));

    // Apply privacy masking for each group
    const maskedRows = rows.map((g) => {
      const isLeader = g.leaderId === req.user!.id || g.coLeaderId === req.user!.id;
      return maskGroupLocation(g, req, isLeader);
    });

    res.json({
      success: true,
      data: maskedRows,
    });
  } catch (err) {
    next(err);
  }
});

// 2. GET /:id - Group details with active member list and real-time attendance stats
groupsRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const [group] = await db
      .select({
        id: groups.id,
        name: groups.name,
        leaderId: groups.leaderId,
        coLeaderId: groups.coLeaderId,
        category: groups.category,
        privacy: groups.privacy,
        status: groups.status,
        area: groups.area,
        meetingDay: groups.meetingDay,
        meetingTime: groups.meetingTime,
        meetingLocation: groups.meetingLocation,
        latitude: groups.latitude,
        longitude: groups.longitude,
        maxMembers: groups.maxMembers,
        isOpen: groups.isOpen,
        avatarUrl: groups.avatarUrl,
        coverUrl: groups.coverUrl,
        startDate: groups.startDate,
        description: groups.description,
        createdById: groups.createdById,
        createdAt: groups.createdAt,
        updatedAt: groups.updatedAt,
        leaderName: users.name,
        leaderEmail: users.email,
      })
      .from(groups)
      .leftJoin(users, eq(groups.leaderId, users.id))
      .where(and(eq(groups.id, id), isNull(groups.deletedAt)))
      .limit(1);

    if (!group) {
      throw new NotFoundError("ไม่พบข้อมูลกลุ่มที่ระบุ");
    }

    // Check if current user is leader or active member
    const isLeader = group.leaderId === req.user!.id || group.coLeaderId === req.user!.id;
    let isActiveMember = isLeader;

    if (!isActiveMember) {
      const [myMembership] = await db
        .select({ id: groupMembers.id })
        .from(groupMembers)
        .innerJoin(members, eq(groupMembers.memberId, members.id))
        .where(
          and(
            eq(groupMembers.groupId, id),
            eq(members.userId, req.user!.id),
            eq(groupMembers.status, "active"),
            isNull(members.deletedAt)
          )
        )
        .limit(1);
      if (myMembership) {
        isActiveMember = true;
      }
    }

    // Subquery to calculate lastAttendedAt dynamically from attendance_records (Single Source of Truth)
    const lastAttendanceSubquery = db
      .select({
        memberId: attendanceRecords.memberId,
        lastAttendedAt: sql<Date>`max(${attendanceRecords.date})`.as("last_attended_at"),
      })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.groupId, id),
          inArray(attendanceRecords.status, ["present", "online"])
        )
      )
      .groupBy(attendanceRecords.memberId)
      .as("last_att");

    // Get group members with dynamic lastAttendedAt
    const membersList = await db
      .select({
        id: groupMembers.id,
        groupId: groupMembers.groupId,
        memberId: groupMembers.memberId,
        role: groupMembers.role,
        status: groupMembers.status,
        joinedAt: groupMembers.joinedAt,
        leftAt: groupMembers.leftAt,
        memberName: members.name,
        memberNickname: members.nickname,
        memberAvatarUrl: members.avatarUrl,
        memberPhone: members.phone,
        membershipStatus: members.membershipStatus,
        pastoralStatus: members.status,
        lastAttendedAt: lastAttendanceSubquery.lastAttendedAt,
      })
      .from(groupMembers)
      .innerJoin(members, eq(groupMembers.memberId, members.id))
      .leftJoin(lastAttendanceSubquery, eq(groupMembers.memberId, lastAttendanceSubquery.memberId))
      .where(and(eq(groupMembers.groupId, id), isNull(members.deletedAt)))
      .orderBy(desc(groupMembers.status), desc(groupMembers.joinedAt));

    const activeMembers = membersList.filter((m) => m.status === "active");

    const maskedGroup = maskGroupLocation(group, req, isActiveMember);

    res.json({
      success: true,
      data: {
        ...maskedGroup,
        members: membersList,
        activeMemberCount: activeMembers.length,
        totalMemberCount: membersList.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 3. POST / - Create group (admin, super_admin only)
groupsRouter.post(
  "/",
  requireRole("super_admin", "admin"),
  async (req, res, next) => {
    try {
      const parsed = groupInputSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(
          "ข้อมูลกลุ่มไม่ถูกต้อง",
          parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
        );
      }

      const db = getDb();
      const [newGroup] = await db
        .insert(groups)
        .values({
          ...parsed.data,
          leaderId: parsed.data.leaderId || null,
          coLeaderId: parsed.data.coLeaderId || null,
          createdById: req.user!.id,
          updatedAt: new Date(),
        })
        .returning();

      await logAudit({
        userId: req.user!.id,
        action: "CREATE_GROUP",
        entityType: "group",
        entityId: newGroup.id,
        details: { name: newGroup.name, category: newGroup.category, privacy: newGroup.privacy },
        req,
      });

      res.status(201).json({
        success: true,
        data: newGroup,
        message: "สร้างกลุ่มเรียบร้อยแล้ว",
      });
    } catch (err) {
      next(err);
    }
  }
);

// 4. PUT /:id - Update group (admin, super_admin, ministry_leader, or assigned group leader)
groupsRouter.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    await verifyGroupManagementAccess(req, id);

    const parsed = groupInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        "ข้อมูลแก้ไขกลุ่มไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const db = getDb();
    const [existing] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, id), isNull(groups.deletedAt)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("ไม่พบกลุ่มที่ต้องการแก้ไข");
    }

    const [updatedGroup] = await db
      .update(groups)
      .set({
        ...parsed.data,
        leaderId: parsed.data.leaderId !== undefined ? (parsed.data.leaderId || null) : existing.leaderId,
        coLeaderId: parsed.data.coLeaderId !== undefined ? (parsed.data.coLeaderId || null) : existing.coLeaderId,
        updatedAt: new Date(),
      })
      .where(eq(groups.id, id))
      .returning();

    await logAudit({
      userId: req.user!.id,
      action: "UPDATE_GROUP",
      entityType: "group",
      entityId: id,
      details: parsed.data as Record<string, unknown>,
      req,
    });

    res.json({
      success: true,
      data: updatedGroup,
      message: "อัปเดตข้อมูลกลุ่มเรียบร้อยแล้ว",
    });
  } catch (err) {
    next(err);
  }
});

// 5. DELETE /:id - Soft-delete group (admin, super_admin only)
groupsRouter.delete(
  "/:id",
  requireRole("super_admin", "admin"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const db = getDb();

      const [existing] = await db
        .select()
        .from(groups)
        .where(and(eq(groups.id, id), isNull(groups.deletedAt)))
        .limit(1);

      if (!existing) {
        throw new NotFoundError("ไม่พบกลุ่มที่ต้องการลบ");
      }

      await db
        .update(groups)
        .set({
          deletedAt: new Date(),
          status: "closed",
          updatedAt: new Date(),
        })
        .where(eq(groups.id, id));

      await logAudit({
        userId: req.user!.id,
        action: "DELETE_GROUP",
        entityType: "group",
        entityId: id,
        details: { name: existing.name },
        req,
      });

      res.json({
        success: true,
        message: "ลบกลุ่มเรียบร้อยแล้ว",
      });
    } catch (err) {
      next(err);
    }
  }
);

// 6. GET /:id/members - Get members of group with real-time last attended date
groupsRouter.get("/:id/members", async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const [group] = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, id), isNull(groups.deletedAt)))
      .limit(1);

    if (!group) {
      throw new NotFoundError("ไม่พบกลุ่มที่ระบุ");
    }

    const lastAttendanceSubquery = db
      .select({
        memberId: attendanceRecords.memberId,
        lastAttendedAt: sql<Date>`max(${attendanceRecords.date})`.as("last_attended_at"),
      })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.groupId, id),
          inArray(attendanceRecords.status, ["present", "online"])
        )
      )
      .groupBy(attendanceRecords.memberId)
      .as("last_att");

    const rows = await db
      .select({
        id: groupMembers.id,
        groupId: groupMembers.groupId,
        memberId: groupMembers.memberId,
        role: groupMembers.role,
        status: groupMembers.status,
        joinedAt: groupMembers.joinedAt,
        leftAt: groupMembers.leftAt,
        memberName: members.name,
        memberNickname: members.nickname,
        memberAvatarUrl: members.avatarUrl,
        memberPhone: members.phone,
        membershipStatus: members.membershipStatus,
        pastoralStatus: members.status,
        lastAttendedAt: lastAttendanceSubquery.lastAttendedAt,
      })
      .from(groupMembers)
      .innerJoin(members, eq(groupMembers.memberId, members.id))
      .leftJoin(lastAttendanceSubquery, eq(groupMembers.memberId, lastAttendanceSubquery.memberId))
      .where(and(eq(groupMembers.groupId, id), isNull(members.deletedAt)))
      .orderBy(desc(groupMembers.status), desc(groupMembers.joinedAt));

    res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// 7. POST /:id/members - Add or reactivate member in group
groupsRouter.post("/:id/members", async (req, res, next) => {
  try {
    const { id } = req.params;
    await verifyGroupManagementAccess(req, id);

    const parsed = groupMemberInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        "ข้อมูลสมาชิกไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const { memberId, role, status = "active" } = parsed.data;
    const db = getDb();

    // Verify group exists
    const [group] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, id), isNull(groups.deletedAt)))
      .limit(1);

    if (!group) {
      throw new NotFoundError("ไม่พบกลุ่มที่ระบุ");
    }

    // Verify member exists
    const [member] = await db
      .select()
      .from(members)
      .where(and(eq(members.id, memberId), isNull(members.deletedAt)))
      .limit(1);

    if (!member) {
      throw new NotFoundError("ไม่พบสมาชิกที่ระบุ");
    }

    // Check if membership already exists (active or inactive)
    const [existingMembership] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.memberId, memberId)))
      .limit(1);

    if (existingMembership) {
      if (existingMembership.status === "active") {
        throw new ConflictError("สมาชิกท่านนี้อยู่ในกลุ่มนี้แล้ว");
      }

      // Reactivate previously inactive membership
      const [reactivated] = await db
        .update(groupMembers)
        .set({
          status: "active",
          role,
          joinedAt: new Date(),
          leftAt: null,
        })
        .where(eq(groupMembers.id, existingMembership.id))
        .returning();

      await logAudit({
        userId: req.user!.id,
        action: "REACTIVATE_GROUP_MEMBER",
        entityType: "group_member",
        entityId: reactivated.id,
        details: { groupId: id, memberId, role },
        req,
      });

      return res.status(200).json({
        success: true,
        data: reactivated,
        message: "เพิ่มสมาชิกเข้ากลุ่มเรียบร้อยแล้ว",
      });
    }

    const [newGroupMember] = await db
      .insert(groupMembers)
      .values({
        groupId: id,
        memberId,
        role,
        status,
        joinedAt: new Date(),
      })
      .returning();

    // Update backward-compatible member `group` text column if empty
    if (!member.group || member.group === "") {
      await db
        .update(members)
        .set({ group: group.name, updatedAt: new Date() })
        .where(eq(members.id, memberId));
    }

    await logAudit({
      userId: req.user!.id,
      action: "ADD_GROUP_MEMBER",
      entityType: "group_member",
      entityId: newGroupMember.id,
      details: { groupId: id, groupName: group.name, memberId, memberName: member.name, role },
      req,
    });

    res.status(201).json({
      success: true,
      data: newGroupMember,
      message: "เพิ่มสมาชิกเข้ากลุ่มเรียบร้อยแล้ว",
    });
  } catch (err) {
    next(err);
  }
});

// 8. PUT /:id/members/:memberId - Update member's role or status
groupsRouter.put("/:id/members/:memberId", async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    await verifyGroupManagementAccess(req, id);

    const parsed = groupMemberUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        "ข้อมูลไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const db = getDb();
    const [existing] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.memberId, memberId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("ไม่พบสมาชิกในกลุ่มนี้");
    }

    const updates: Partial<GroupMember> = {
      ...(parsed.data.role && { role: parsed.data.role }),
      ...(parsed.data.status && { status: parsed.data.status }),
      ...(parsed.data.status === "inactive" && { leftAt: new Date() }),
      ...(parsed.data.status === "active" && { leftAt: null }),
    };

    const [updated] = await db
      .update(groupMembers)
      .set(updates)
      .where(eq(groupMembers.id, existing.id))
      .returning();

    await logAudit({
      userId: req.user!.id,
      action: "UPDATE_GROUP_MEMBER",
      entityType: "group_member",
      entityId: updated.id,
      details: parsed.data as Record<string, unknown>,
      req,
    });

    res.json({
      success: true,
      data: updated,
      message: "อัปเดตสถานะสมาชิกเรียบร้อยแล้ว",
    });
  } catch (err) {
    next(err);
  }
});

// 9. DELETE /:id/members/:memberId - Soft-remove member (mark as inactive + set leftAt)
groupsRouter.delete("/:id/members/:memberId", async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    await verifyGroupManagementAccess(req, id);

    const db = getDb();

    const [existing] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.memberId, memberId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("ไม่พบสมาชิกในกลุ่มนี้");
    }

    // Soft remove: set status = inactive and leftAt = now() (retains past attendance & history)
    await db
      .update(groupMembers)
      .set({
        status: "inactive",
        leftAt: new Date(),
      })
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.memberId, memberId)));

    await logAudit({
      userId: req.user!.id,
      action: "REMOVE_GROUP_MEMBER",
      entityType: "group_member",
      entityId: existing.id,
      details: { groupId: id, memberId, previousStatus: existing.status },
      req,
    });

    res.json({
      success: true,
      message: "นำสมาชิกออกจากกลุ่มเรียบร้อยแล้ว (เปลี่ยนสถานะเป็น inactive)",
    });
  } catch (err) {
    next(err);
  }
});
