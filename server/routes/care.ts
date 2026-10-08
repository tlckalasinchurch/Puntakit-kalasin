import { Router } from "express";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { attendanceRecords, groupMembers, groups, members } from "../../shared/schema.js";
import { CREATE_ROLES } from "../../shared/roles.js";
import { resolveGroupScope, scopeAllows } from "../lib/groupAccess.js";
import { maskPhone } from "./members.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { parseCareGroupDescription } from "../../shared/orgView.js";
import { getLedGroupIds, isScopedRole } from "../lib/careScope.js";

/**
 * Care-leader view of one care group: who belongs to it, who was marked on a
 * date, and who has missed the group's last meetings. Read-only; saving the
 * check-in uses POST /api/attendance/bulk.
 */
export const careRouter = Router();
careRouter.use(requireAuth, requireRole(...CREATE_ROLES));

const SERVICE_TYPE = "care_group";
const RECENT_SESSIONS = 8;
const present = new Set(["present", "online"]);

/** Local calendar date as YYYY-MM-DD (the app records attendance by calendar day). */
const dayKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

/**
 * Care groups the caller may check in: every care group for staff-level roles,
 * only the groups they lead for a group_leader (none when unassigned). Same
 * `{ bodies: [{ name, careGroups: [{ id, name }] }] }` shape the page already reads.
 */
careRouter.get("/groups", async (req, res, next) => {
  try {
    const db = getDb();
    const led = isScopedRole(req.user!.role) ? await getLedGroupIds(req.user!.id) : null;
    const cares = await db
      .select({ id: groups.id, name: groups.name, parentGroupId: groups.parentGroupId })
      .from(groups)
      .where(
        and(
          eq(groups.orgLevel, "care"),
          isNull(groups.deletedAt),
          led ? (led.length ? inArray(groups.id, led) : sql`false`) : undefined
        )
      )
      .orderBy(asc(groups.name));
    const bodyRows = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(and(eq(groups.orgLevel, "body"), isNull(groups.deletedAt)))
      .orderBy(asc(groups.name));
    const bodies = bodyRows
      .map((b) => ({
        name: b.name,
        careGroups: cares.filter((c) => c.parentGroupId === b.id).map((c) => ({ id: c.id, name: c.name.trim() })),
      }))
      .filter((b) => b.careGroups.length > 0);
    const orphans = cares.filter((c) => !bodyRows.some((b) => b.id === c.parentGroupId));
    if (orphans.length) bodies.push({ name: "ไม่ระบุบอดี้", careGroups: orphans.map((c) => ({ id: c.id, name: c.name.trim() })) });
    res.json({ success: true, data: { bodies } });
  } catch (err) {
    next(err);
  }
});

careRouter.get("/groups/:id/roster", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ValidationError("รหัสพันธกิจไม่ถูกต้อง", [{ field: "id", message: "uuid" }]);
    const date = typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : dayKey(new Date());

    const db = getDb();
    const [care] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, id), eq(groups.orgLevel, "care"), isNull(groups.deletedAt)))
      .limit(1);
    if (!care) throw new NotFoundError("ไม่พบพันธกิจที่ระบุ");
    const [leader] = care.leaderMemberId
      ? await db.select({ name: members.name }).from(members).where(eq(members.id, care.leaderMemberId)).limit(1)
      : [];
    const [body] = care.parentGroupId
      ? await db.select({ name: groups.name }).from(groups).where(eq(groups.id, care.parentGroupId)).limit(1)
      : [];

    const people = await db
      .select({ id: members.id, name: members.name, nickname: members.nickname, phone: members.phone, lineId: members.lineId })
      .from(groupMembers)
      .innerJoin(members, eq(groupMembers.memberId, members.id))
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.status, "active"), isNull(members.deletedAt)))
      .orderBy(asc(members.name));

    // The group's recent meeting days (days that have at least one record).
    const dayExpr = sql<string>`to_char(${attendanceRecords.date}, 'YYYY-MM-DD')`;
    const sessionRows = await db
      .selectDistinct({ day: dayExpr })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.groupId, id), eq(attendanceRecords.serviceType, SERVICE_TYPE)))
      .orderBy(desc(dayExpr))
      .limit(RECENT_SESSIONS);
    const sessions = sessionRows.map((r) => r.day);

    const records = sessions.length
      ? await db
          .select({ memberId: attendanceRecords.memberId, day: dayExpr, status: attendanceRecords.status })
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.groupId, id),
              eq(attendanceRecords.serviceType, SERVICE_TYPE),
              inArray(dayExpr, sessions)
            )
          )
      : [];
    const statusAt = new Map<string, string>(); // `${member}|${day}` -> status
    for (const r of records) statusAt.set(`${r.memberId}|${r.day}`, r.status);

    // Contacts follow the members policy: a group_leader receives phone and
    // LINE ID raw only for a group it leads; for any other group they are masked.
    const scope = await resolveGroupScope(req.user!);
    const showContacts = scopeAllows(scope, id);

    const rows = people.map((person) => {
      const p = showContacts
        ? person
        : { ...person, phone: person.phone ? maskPhone(person.phone) : null, lineId: null };
      // Consecutive recent meetings (newest first, before `date`) with no "present"/"online".
      let missed = 0;
      let lastSeen: string | null = null;
      for (const day of sessions) {
        if (day >= date) continue;
        if (present.has(statusAt.get(`${p.id}|${day}`) ?? "")) {
          lastSeen = day;
          break;
        }
        missed += 1;
      }
      return { ...p, status: statusAt.get(`${p.id}|${date}`) ?? null, missed, lastSeen };
    });

    res.json({
      success: true,
      data: {
        group: {
          id: care.id,
          name: care.name.trim(),
          bodyName: body?.name ?? null,
          ...parseCareGroupDescription(care.description),
          ...(leader ? { careLeaderName: leader.name } : {}),
        },
        date,
        sessions,
        members: rows,
      },
    });
  } catch (err) {
    next(err);
  }
});
