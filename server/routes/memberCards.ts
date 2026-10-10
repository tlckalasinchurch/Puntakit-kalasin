import { Router } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { churchProfile, members, membershipTerms } from "../../shared/schema.js";
import { ADMIN_SHELL_ROLES, MEMBER_CREATE_ROLES } from "../../shared/roles.js";
import { formatMemberNo, summarizeMembership, todayInThailand } from "../../shared/membership.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { careGroupsOf } from "../lib/careMembership.js";
import { assertMembersInScope } from "../lib/careScope.js";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors.js";
import { canViewMember, resolveMembershipScope } from "../lib/membershipScope.js";

/**
 * Membership card data. Everything on the card is read from the member
 * register at request time — the photo is `members.avatar_url`, the name and
 * join date are the member row, the care group comes from `group_members`. The
 * card stores nothing of its own, so a changed photo or name shows on the very
 * next load.
 *
 * Contact details are never part of the card.
 */
export const memberCardsRouter = Router();

memberCardsRouter.use(requireAuth, requireRole(...ADMIN_SHELL_ROLES));

const FALLBACK_CHURCH_NAME = "คริสตจักรชีวิตสุขสันต์กาฬสินธุ์";

memberCardsRouter.get("/:memberId", async (req, res, next) => {
  try {
    const user = req.user!;
    const db = getDb();
    // A group_leader only reaches members of the groups they lead — the same rule as /api/members.
    await assertMembersInScope(req, [req.params.memberId]);
    const [member] = await db
      .select({
        id: members.id,
        name: members.name,
        nickname: members.nickname,
        memberNo: members.memberNo,
        avatarUrl: members.avatarUrl,
        joinedAt: members.joinedAt,
      })
      .from(members)
      .where(and(eq(members.id, req.params.memberId), isNull(members.deletedAt)))
      .limit(1);
    if (!member) throw new NotFoundError("ไม่พบสมาชิก");

    const [care, church] = await Promise.all([
      careGroupsOf(db, [member.id]),
      db.select({ name: churchProfile.name }).from(churchProfile).limit(1),
    ]);
    const cg = care.get(member.id) ?? null;

    // Membership type / validity only for people allowed to see membership status.
    let membership: ReturnType<typeof summarizeMembership> | null = null;
    const scope = await resolveMembershipScope(user);
    if (await canViewMember(scope, user.role, member.id)) {
      const terms = await db.select().from(membershipTerms).where(eq(membershipTerms.memberId, member.id));
      membership = summarizeMembership(terms, todayInThailand());
    }

    res.json({
      success: true,
      data: {
        id: member.id,
        name: member.name,
        nickname: member.nickname,
        memberNo: formatMemberNo(member.memberNo),
        avatarUrl: member.avatarUrl,
        joinedAt: member.joinedAt,
        careGroupName: cg?.name ?? null,
        bodyName: cg?.bodyName ?? null,
        churchName: church[0]?.name ?? FALLBACK_CHURCH_NAME,
        membership: membership
          ? { type: membership.type, state: membership.state, label: membership.label, endsOn: membership.endsOn }
          : null,
        canAssignNumber: MEMBER_CREATE_ROLES.includes(user.role),
      },
    });
  } catch (err) {
    next(err);
  }
});

const assignNumberSchema = z.object({
  memberNo: z.number().int().min(1).max(99999).optional(),
});

// POST /:memberId/number — give the member a card number (next free one, or an explicit one)
memberCardsRouter.post("/:memberId/number", requireRole(...MEMBER_CREATE_ROLES), async (req, res, next) => {
  try {
    const parsed = assignNumberSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw new ValidationError("หมายเลขสมาชิกไม่ถูกต้อง (1–99999)");
    const db = getDb();
    const [member] = await db
      .select({ id: members.id, memberNo: members.memberNo })
      .from(members)
      .where(and(eq(members.id, req.params.memberId), isNull(members.deletedAt)))
      .limit(1);
    if (!member) throw new NotFoundError("ไม่พบสมาชิก");
    if (member.memberNo !== null) throw new ConflictError("สมาชิกคนนี้มีหมายเลขสมาชิกแล้ว");

    const wanted = parsed.data.memberNo;
    let assigned: number | null = null;
    // The unique index is the arbiter: two people asking for "the next number"
    // at once cannot both get it; the loser retries with the new maximum.
    for (let attempt = 0; attempt < 3 && assigned === null; attempt++) {
      try {
        const [row] = await db
          .update(members)
          .set({
            memberNo: wanted ?? sql`(SELECT COALESCE(MAX(${members.memberNo}), 0) + 1 FROM ${members})`,
            updatedById: req.user!.id,
            updatedAt: new Date(),
          })
          .where(and(eq(members.id, member.id), isNull(members.memberNo)))
          .returning({ memberNo: members.memberNo });
        assigned = row?.memberNo ?? null;
        if (assigned === null) throw new ConflictError("สมาชิกคนนี้มีหมายเลขสมาชิกแล้ว");
      } catch (err) {
        const code = (err as { code?: string; cause?: { code?: string } }).code ?? (err as { cause?: { code?: string } }).cause?.code;
        if (code !== "23505") throw err;
        if (wanted !== undefined) throw new ConflictError(`หมายเลข ${formatMemberNo(wanted)} ถูกใช้แล้ว`);
      }
    }
    if (assigned === null) throw new ConflictError("กำหนดหมายเลขไม่สำเร็จ ลองอีกครั้ง");
    await logAudit({ req, action: "MEMBER_NUMBER_ASSIGNED", entityType: "member", entityId: member.id, details: { memberNo: assigned } });
    res.json({ success: true, data: { memberNo: formatMemberNo(assigned) } });
  } catch (err) {
    next(err);
  }
});
