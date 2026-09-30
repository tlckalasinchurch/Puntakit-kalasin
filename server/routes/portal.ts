import { Router, type Request } from "express";
import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  announcements,
  attendanceRecords,
  eventRegistrations,
  events,
  groupMembers,
  groups,
  members,
  prayerRequests,
  pushSubscriptions,
  users,
  type Member,
} from "../../shared/schema.js";
import {
  eventRegistrationSchema,
  memberProfileUpdateSchema,
  prayerRequestInputSchema,
  pushSubscriptionSchema,
} from "../../shared/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors.js";

export const portalRouter = Router();

portalRouter.use(requireAuth);

// Helper to resolve the authenticated user's linked member record
async function getLinkedMember(req: Request): Promise<Member | null> {
  const db = getDb();
  const userId = req.user!.id;
  const userEmail = req.user!.email;

  // 1. Look by user_id
  const [memberByUserId] = await db
    .select()
    .from(members)
    .where(and(eq(members.userId, userId), isNull(members.deletedAt)))
    .limit(1);

  if (memberByUserId) {
    return memberByUserId;
  }

  // 2. Fallback: match by email and auto-bind user_id
  if (userEmail) {
    const [memberByEmail] = await db
      .select()
      .from(members)
      .where(and(eq(members.email, userEmail), isNull(members.deletedAt)))
      .limit(1);

    if (memberByEmail) {
      if (!memberByEmail.userId) {
        await db
          .update(members)
          .set({ userId, updatedAt: new Date() })
          .where(eq(members.id, memberByEmail.id));
      }
      return { ...memberByEmail, userId };
    }
  }

  return null;
}

// 1. GET /portal - Comprehensive summary for Member PWA home
portalRouter.get("/portal", async (req, res, next) => {
  try {
    const db = getDb();
    const user = req.user!;
    const member = await getLinkedMember(req);

    // Latest 3 published announcements
    const recentAnnouncements = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        content: announcements.content,
        publishDate: announcements.publishDate,
      })
      .from(announcements)
      .where(eq(announcements.status, "published"))
      .orderBy(desc(announcements.publishDate))
      .limit(3);

    // Upcoming events with user registration status
    const now = new Date();
    const upcomingEvents = await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        eventDate: events.eventDate,
        location: events.location,
        category: events.category,
        status: events.status,
      })
      .from(events)
      .where(and(gte(events.eventDate, now), eq(events.status, "scheduled")))
      .orderBy(events.eventDate)
      .limit(5);

    // Check registrations for these upcoming events
    let myRegisteredEventIds: string[] = [];
    if (upcomingEvents.length > 0) {
      const eventIds = upcomingEvents.map((e) => e.id);
      const regRows = await db
        .select({ eventId: eventRegistrations.eventId })
        .from(eventRegistrations)
        .where(
          and(
            inArray(eventRegistrations.eventId, eventIds),
            or(
              eq(eventRegistrations.userId, user.id),
              member ? eq(eventRegistrations.memberId, member.id) : sql`1=0`
            )!,
            eq(eventRegistrations.status, "registered")
          )
        );
      myRegisteredEventIds = regRows.map((r) => r.eventId);
    }

    const eventsWithStatus = upcomingEvents.map((e) => ({
      ...e,
      isRegistered: myRegisteredEventIds.includes(e.id),
    }));

    // Member's care group details if member exists
    let careGroup = null;
    if (member) {
      // Find group by group_members or matching group name
      const [membership] = await db
        .select({
          groupId: groupMembers.groupId,
          role: groupMembers.role,
          name: groups.name,
          category: groups.category,
          meetingDay: groups.meetingDay,
          meetingTime: groups.meetingTime,
          meetingLocation: groups.meetingLocation,
          description: groups.description,
          leaderName: users.name,
        })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .leftJoin(users, eq(groups.leaderId, users.id))
        .where(and(eq(groupMembers.memberId, member.id), isNull(groups.deletedAt)))
        .limit(1);

      if (membership) {
        careGroup = membership;
      } else if (member.group) {
        // Fallback by text name
        const [grpByName] = await db
          .select({
            id: groups.id,
            name: groups.name,
            category: groups.category,
            meetingDay: groups.meetingDay,
            meetingTime: groups.meetingTime,
            meetingLocation: groups.meetingLocation,
            description: groups.description,
            leaderName: users.name,
          })
          .from(groups)
          .leftJoin(users, eq(groups.leaderId, users.id))
          .where(and(eq(groups.name, member.group), isNull(groups.deletedAt)))
          .limit(1);
        if (grpByName) {
          careGroup = { ...grpByName, role: "member" };
        }
      }
    }

    // Attendance stats for member
    let attendanceStats = { totalAttended: 0, lastAttended: null as Date | null };
    if (member) {
      const [totalRow] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.memberId, member.id),
            inArray(attendanceRecords.status, ["present", "online"])
          )
        );

      const [lastRow] = await db
        .select({ date: attendanceRecords.date })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.memberId, member.id),
            inArray(attendanceRecords.status, ["present", "online"])
          )
        )
        .orderBy(desc(attendanceRecords.date))
        .limit(1);

      attendanceStats = {
        totalAttended: totalRow?.count || 0,
        lastAttended: lastRow ? lastRow.date : null,
      };
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        member: member
          ? {
              id: member.id,
              name: member.name,
              nickname: member.nickname,
              avatarUrl: member.avatarUrl,
              phone: member.phone,
              email: member.email,
              lineId: member.lineId,
              membershipStatus: member.membershipStatus,
              qrToken: `PK-MEM-${member.id}`,
            }
          : null,
        careGroup,
        recentAnnouncements,
        upcomingEvents: eventsWithStatus,
        attendanceStats,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 2. GET /profile - Get own profile details for viewing/editing
portalRouter.get("/profile", async (req, res, next) => {
  try {
    const member = await getLinkedMember(req);
    if (!member) {
      return res.json({
        success: true,
        data: null,
      });
    }

    res.json({
      success: true,
      data: {
        id: member.id,
        name: member.name,
        nickname: member.nickname,
        avatarUrl: member.avatarUrl,
        phone: member.phone,
        email: member.email,
        lineId: member.lineId,
        address: member.address,
        emergencyContactName: member.emergencyContactName,
        emergencyContactPhone: member.emergencyContactPhone,
        emergencyContactRelation: member.emergencyContactRelation,
        membershipStatus: member.membershipStatus,
        consentDate: member.consentDate,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 3. PUT /profile - Update own profile info safely
portalRouter.put("/profile", async (req, res, next) => {
  try {
    const parsed = memberProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        "ข้อมูลไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const member = await getLinkedMember(req);
    if (!member) {
      throw new NotFoundError("ไม่พบข้อมูลสมาชิกที่ผูกกับบัญชีผู้ใช้นี้ กรุณาติดต่อผู้ดูแลระบบ");
    }

    const db = getDb();
    const [updated] = await db
      .update(members)
      .set({
        ...parsed.data,
        consentDate: parsed.data.consentGiven ? new Date() : member.consentDate,
        updatedAt: new Date(),
      })
      .where(eq(members.id, member.id))
      .returning();

    await logAudit({
      userId: req.user!.id,
      action: "MEMBER_SELF_UPDATE_PROFILE",
      entityType: "member",
      entityId: member.id,
      details: parsed.data as Record<string, unknown>,
      req,
    });

    res.json({
      success: true,
      data: updated,
      message: "อัปเดตข้อมูลส่วนตัวเรียบร้อยแล้ว",
    });
  } catch (err) {
    next(err);
  }
});

// 3. GET /attendance - My attendance history
portalRouter.get("/attendance", async (req, res, next) => {
  try {
    const member = await getLinkedMember(req);
    if (!member) {
      return res.json({ success: true, data: [] });
    }

    const db = getDb();
    const rows = await db
      .select({
        id: attendanceRecords.id,
        date: attendanceRecords.date,
        serviceType: attendanceRecords.serviceType,
        status: attendanceRecords.status,
        checkInMethod: attendanceRecords.checkInMethod,
        groupName: groups.name,
      })
      .from(attendanceRecords)
      .leftJoin(groups, eq(attendanceRecords.groupId, groups.id))
      .where(eq(attendanceRecords.memberId, member.id))
      .orderBy(desc(attendanceRecords.date))
      .limit(50);

    res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// 4. GET /group - My care group details & fellowship members
portalRouter.get("/group", async (req, res, next) => {
  try {
    const member = await getLinkedMember(req);
    if (!member) {
      return res.json({ success: true, data: null });
    }

    const db = getDb();
    // Find member's group
    const [membership] = await db
      .select({
        groupId: groupMembers.groupId,
        groupName: groups.name,
        category: groups.category,
        meetingDay: groups.meetingDay,
        meetingTime: groups.meetingTime,
        meetingLocation: groups.meetingLocation,
        description: groups.description,
        leaderName: users.name,
        leaderEmail: users.email,
      })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .leftJoin(users, eq(groups.leaderId, users.id))
      .where(and(eq(groupMembers.memberId, member.id), isNull(groups.deletedAt)))
      .limit(1);

    if (!membership) {
      return res.json({ success: true, data: null });
    }

    // Get group fellow members (names and nicknames only for privacy)
    const fellowMembers = await db
      .select({
        id: groupMembers.id,
        memberName: members.name,
        memberNickname: members.nickname,
        avatarUrl: members.avatarUrl,
        role: groupMembers.role,
      })
      .from(groupMembers)
      .innerJoin(members, eq(groupMembers.memberId, members.id))
      .where(and(eq(groupMembers.groupId, membership.groupId), isNull(members.deletedAt)))
      .orderBy(groupMembers.role);

    res.json({
      success: true,
      data: {
        ...membership,
        members: fellowMembers,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 5. POST /events/:id/register - Register for an event
portalRouter.post("/events/:id/register", async (req, res, next) => {
  try {
    const { id: eventId } = req.params;
    const user = req.user!;
    const member = await getLinkedMember(req);
    const parsed = eventRegistrationSchema.safeParse(req.body);

    const db = getDb();

    // Verify event exists
    const [event] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.status, "scheduled")))
      .limit(1);

    if (!event) {
      throw new NotFoundError("ไม่พบกิจกรรม หรือกิจกรรมถูกยกเลิกแล้ว");
    }

    // Check if already registered
    const [existing] = await db
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.userId, user.id)
        )
      )
      .limit(1);

    if (existing) {
      if (existing.status === "registered") {
        throw new ConflictError("คุณได้ลงทะเบียนเข้าร่วมกิจกรรมนี้แล้ว");
      }
      // Re-activate if was cancelled
      const [updated] = await db
        .update(eventRegistrations)
        .set({
          status: "registered",
          registeredAt: new Date(),
          notes: parsed.success ? parsed.data.notes || existing.notes : existing.notes,
        })
        .where(eq(eventRegistrations.id, existing.id))
        .returning();

      return res.json({
        success: true,
        data: updated,
        message: "ลงทะเบียนเข้าร่วมกิจกรรมเรียบร้อยแล้ว",
      });
    }

    const [registration] = await db
      .insert(eventRegistrations)
      .values({
        eventId,
        userId: user.id,
        memberId: member ? member.id : null,
        status: "registered",
        registeredAt: new Date(),
        notes: parsed.success ? parsed.data.notes || null : null,
      })
      .returning();

    await logAudit({
      userId: user.id,
      action: "EVENT_REGISTER",
      entityType: "event_registration",
      entityId: registration.id,
      details: { eventId, eventTitle: event.title },
      req,
    });

    res.status(201).json({
      success: true,
      data: registration,
      message: `ลงทะเบียนเข้าร่วม "${event.title}" เรียบร้อยแล้ว`,
    });
  } catch (err) {
    next(err);
  }
});

// 6. DELETE /events/:id/register - Cancel event registration
portalRouter.delete("/events/:id/register", async (req, res, next) => {
  try {
    const { id: eventId } = req.params;
    const user = req.user!;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.userId, user.id),
          eq(eventRegistrations.status, "registered")
        )
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundError("ไม่พบข้อมูลการลงทะเบียนกิจกรรมนี้");
    }

    await db
      .update(eventRegistrations)
      .set({ status: "cancelled" })
      .where(eq(eventRegistrations.id, existing.id));

    await logAudit({
      userId: user.id,
      action: "EVENT_UNREGISTER",
      entityType: "event_registration",
      entityId: existing.id,
      details: { eventId },
      req,
    });

    res.json({
      success: true,
      message: "ยกเลิกการลงทะเบียนกิจกรรมเรียบร้อยแล้ว",
    });
  } catch (err) {
    next(err);
  }
});

// 7. GET /events/my - List events registered by user
portalRouter.get("/events/my", async (req, res, next) => {
  try {
    const user = req.user!;
    const db = getDb();

    const rows = await db
      .select({
        id: eventRegistrations.id,
        eventId: events.id,
        title: events.title,
        description: events.description,
        eventDate: events.eventDate,
        location: events.location,
        category: events.category,
        registrationStatus: eventRegistrations.status,
        registeredAt: eventRegistrations.registeredAt,
      })
      .from(eventRegistrations)
      .innerJoin(events, eq(eventRegistrations.eventId, events.id))
      .where(
        and(
          eq(eventRegistrations.userId, user.id),
          eq(eventRegistrations.status, "registered")
        )
      )
      .orderBy(events.eventDate);

    res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// 8. POST /prayer-requests - Submit prayer request
portalRouter.post("/prayer-requests", async (req, res, next) => {
  try {
    const parsed = prayerRequestInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        "ข้อมูลคำขออธิษฐานไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const user = req.user!;
    const member = await getLinkedMember(req);
    const db = getDb();

    const [prayer] = await db
      .insert(prayerRequests)
      .values({
        ...parsed.data,
        userId: user.id,
        memberId: member ? member.id : null,
        status: "pending",
        updatedAt: new Date(),
      })
      .returning();

    await logAudit({
      userId: user.id,
      action: "CREATE_PRAYER_REQUEST",
      entityType: "prayer_request",
      entityId: prayer.id,
      details: { title: prayer.title, category: prayer.category, isConfidential: prayer.isConfidential },
      req,
    });

    res.status(201).json({
      success: true,
      data: prayer,
      message: "ส่งคำขออธิษฐานเรียบร้อยแล้ว ทีมศิษยาภิบาลจะร่วมอธิษฐานเผื่อท่าน",
    });
  } catch (err) {
    next(err);
  }
});

// 9. GET /prayer-requests/my - Member's own prayer requests
portalRouter.get("/prayer-requests/my", async (req, res, next) => {
  try {
    const user = req.user!;
    const db = getDb();

    const rows = await db
      .select({
        id: prayerRequests.id,
        title: prayerRequests.title,
        content: prayerRequests.content,
        category: prayerRequests.category,
        isConfidential: prayerRequests.isConfidential,
        status: prayerRequests.status,
        answeredNotes: prayerRequests.answeredNotes,
        createdAt: prayerRequests.createdAt,
      })
      .from(prayerRequests)
      .where(eq(prayerRequests.userId, user.id))
      .orderBy(desc(prayerRequests.createdAt));

    res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// 10. POST /push/subscribe - Store Web Push subscription
portalRouter.post("/push/subscribe", async (req, res, next) => {
  try {
    const parsed = pushSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        "ข้อมูล Push Subscription ไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const { endpoint, p256dh, auth, userAgent } = parsed.data;
    const user = req.user!;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);

    if (existing) {
      await db
        .update(pushSubscriptions)
        .set({
          userId: user.id,
          p256dh,
          auth,
          userAgent: userAgent || null,
        })
        .where(eq(pushSubscriptions.endpoint, endpoint));
    } else {
      await db.insert(pushSubscriptions).values({
        userId: user.id,
        endpoint,
        p256dh,
        auth,
        userAgent: userAgent || null,
      });
    }

    res.json({
      success: true,
      message: "เปิดรับการแจ้งเตือน Push Notification สำเร็จ",
    });
  } catch (err) {
    next(err);
  }
});

// 11. POST /push/send-test - Send test push notification simulation
portalRouter.post("/push/send-test", async (req, res, next) => {
  try {
    const user = req.user!;
    // Simulates sending push or confirms server readiness
    res.json({
      success: true,
      message: `ส่งการแจ้งเตือนทดสอบไปยัง ${user.name} สำเร็จ`,
      data: {
        title: "Puntakit Kalasin",
        body: "ยินดีต้อนรับสู่ระบบสมาชิกคริสตจักรพันธกิจกาฬสินธุ์",
        icon: "/pwa-192.png",
      },
    });
  } catch (err) {
    next(err);
  }
});
