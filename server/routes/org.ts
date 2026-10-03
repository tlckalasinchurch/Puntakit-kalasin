import { Router } from "express";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { groupMembers, groups, members } from "../../shared/schema.js";
import { PRIVILEGED_ROLES } from "../../shared/roles.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { HEAD_ROLE, parseCareGroupDescription, parseMemberNotes } from "../../shared/orgView.js";

/**
 * Read-only org chart: ศบ. -> body -> care group -> member.
 * Same read gate as the rest of the people data (PRIVILEGED_ROLES).
 */
export const orgRouter = Router();
orgRouter.use(requireAuth, requireRole(...PRIVILEGED_ROLES));

orgRouter.get("/overview", async (_req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: groups.id,
        name: groups.name,
        orgLevel: groups.orgLevel,
        parentGroupId: groups.parentGroupId,
        area: groups.area,
        description: groups.description,
        leaderName: members.name,
        memberCount: sql<number>`cast(count(distinct case when ${groupMembers.status} = 'active' then ${groupMembers.id} end) as int)`,
      })
      .from(groups)
      .leftJoin(members, eq(groups.leaderMemberId, members.id))
      .leftJoin(groupMembers, eq(groups.id, groupMembers.groupId))
      .where(and(isNull(groups.deletedAt), inArray(groups.orgLevel, ["body", "care"])))
      .groupBy(groups.id, members.id)
      .orderBy(asc(groups.name));

    const [head] = await db
      .select({ id: members.id, name: members.name })
      .from(members)
      .where(and(eq(members.role, HEAD_ROLE), isNull(members.deletedAt)))
      .limit(1);

    const cares = rows.filter((r) => r.orgLevel === "care");
    const bodies = rows
      .filter((r) => r.orgLevel === "body")
      .map((b) => {
        const children = cares
          .filter((c) => c.parentGroupId === b.id)
          .map((c) => ({
            id: c.id,
            name: c.name.trim(),
            area: c.area,
            memberCount: c.memberCount,
            ...parseCareGroupDescription(c.description),
          }));
        return {
          id: b.id,
          name: b.name,
          leaderName: b.leaderName,
          careGroupCount: children.length,
          memberCount: children.reduce((n, c) => n + c.memberCount, 0),
          careGroups: children,
        };
      });
    bodies.sort((a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name, "th"));
    const unassigned = cares.filter((c) => !c.parentGroupId || !bodies.some((b) => b.id === c.parentGroupId));

    res.json({
      success: true,
      data: {
        head: head ?? null,
        totals: {
          bodies: bodies.length,
          careGroups: cares.length,
          members: bodies.reduce((n, b) => n + b.memberCount, 0) + unassigned.reduce((n, c) => n + c.memberCount, 0),
        },
        bodies,
        unassignedCareGroups: unassigned.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

orgRouter.get("/care-groups/:id/members", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ValidationError("รหัสกลุ่มไม่ถูกต้อง", [{ field: "id", message: "uuid" }]);
    const db = getDb();
    const [care] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, id), eq(groups.orgLevel, "care"), isNull(groups.deletedAt)))
      .limit(1);
    if (!care) throw new NotFoundError("ไม่พบแคร์ที่ระบุ");
    const [body] = care.parentGroupId
      ? await db.select({ name: groups.name }).from(groups).where(eq(groups.id, care.parentGroupId)).limit(1)
      : [];

    const rows = await db
      .select({
        id: members.id,
        name: members.name,
        nickname: members.nickname,
        notes: members.notes,
        joinedGroupAt: groupMembers.joinedAt,
      })
      .from(groupMembers)
      .innerJoin(members, eq(groupMembers.memberId, members.id))
      .where(and(eq(groupMembers.groupId, id), eq(groupMembers.status, "active"), isNull(members.deletedAt)))
      .orderBy(asc(members.name));

    res.json({
      success: true,
      data: {
        group: {
          id: care.id,
          name: care.name.trim(),
          area: care.area,
          location: care.meetingLocation,
          bodyName: body?.name ?? null,
          ...parseCareGroupDescription(care.description),
        },
        members: rows.map((m) => {
          const { notes, ...rest } = m;
          return { ...rest, ...parseMemberNotes(notes) };
        }),
      },
    });
  } catch (err) {
    next(err);
  }
});
