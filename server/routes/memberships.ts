import { Router } from "express";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { members, membershipTerms, type MembershipTerm } from "../../shared/schema.js";
import {
  membershipDecisionSchema,
  membershipOverviewQuerySchema,
  membershipPaymentSchema,
  membershipStartSchema,
} from "../../shared/validation.js";
import {
  MEMBERSHIP_STATE_LABELS,
  ORDINARY_FEE_BAHT,
  TERM_YEARS,
  addYears,
  formatMemberNo,
  summarizeMembership,
  todayInThailand,
  type MembershipSummary,
} from "../../shared/membership.js";
import { MEMBERSHIP_PAYMENT_ROLES, MEMBERSHIP_VIEW_ROLES } from "../../shared/roles.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { runAtomically } from "../lib/atomicWrites.js";
import { careGroupsOf } from "../lib/careMembership.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";
import {
  assertCanDecide,
  assertCanView,
  memberIdsInGroups,
  resolveMembershipScope,
} from "../lib/membershipScope.js";

/**
 * Annual membership lifecycle API. Rules: `shared/membership.ts`. Scope: every
 * route resolves `resolveMembershipScope` on the SERVER — the UI hiding a
 * button is not what keeps a care leader out of another group's members.
 *
 * Responses carry no phone, email or address: this is about status, not contact.
 */
export const membershipsRouter = Router();

membershipsRouter.use(requireAuth, requireRole(...MEMBERSHIP_VIEW_ROLES));

const toTermDto = (t: MembershipTerm) => ({
  id: t.id,
  type: t.type,
  status: t.status,
  startsOn: t.startsOn,
  endsOn: t.endsOn,
  closedReason: t.closedReason,
  closedAt: t.closedAt,
  decisionNote: t.decisionNote,
  feeBaht: t.feeBaht,
  paymentStatus: t.paymentStatus,
  paidAmountBaht: t.paidAmountBaht,
  paidAt: t.paidAt,
  paymentNote: t.paymentNote,
  createdAt: t.createdAt,
});

async function loadMember(memberId: string) {
  const [member] = await getDb()
    .select({
      id: members.id,
      name: members.name,
      nickname: members.nickname,
      memberNo: members.memberNo,
      avatarUrl: members.avatarUrl,
      joinedAt: members.joinedAt,
    })
    .from(members)
    .where(and(eq(members.id, memberId), isNull(members.deletedAt)))
    .limit(1);
  if (!member) throw new NotFoundError("ไม่พบสมาชิก");
  return member;
}

async function termsOf(memberId: string): Promise<MembershipTerm[]> {
  return getDb()
    .select()
    .from(membershipTerms)
    .where(eq(membershipTerms.memberId, memberId))
    .orderBy(desc(membershipTerms.startsOn), desc(membershipTerms.createdAt));
}

// GET /overview — in-scope members that have a membership term, with their status
membershipsRouter.get("/overview", async (req, res, next) => {
  try {
    const parsed = membershipOverviewQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(
        "พารามิเตอร์ไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }
    const { filter, careGroupId, search, limit } = parsed.data;
    const user = req.user!;
    const db = getDb();
    const scope = await resolveMembershipScope(user);
    const today = todayInThailand();

    let scopedIds: string[] | null = null;
    if (scope.kind === "groups") {
      scopedIds = await memberIdsInGroups(scope.viewGroupIds);
      if (scopedIds.length === 0) {
        res.json({ success: true, data: { today, counts: emptyCounts(), items: [], canRecordPayment: false } });
        return;
      }
    } else if (scope.kind === "none") {
      throw new ForbiddenError("คุณไม่มีสิทธิ์ดูสถานะสมาชิก");
    }

    const rows = await db
      .select({
        term: membershipTerms,
        memberId: members.id,
        name: members.name,
        nickname: members.nickname,
        memberNo: members.memberNo,
        avatarUrl: members.avatarUrl,
      })
      .from(membershipTerms)
      .innerJoin(members, eq(membershipTerms.memberId, members.id))
      .where(
        and(
          eq(membershipTerms.status, "open"),
          isNull(members.deletedAt),
          scopedIds ? inArray(members.id, scopedIds) : undefined
        )
      )
      .orderBy(asc(membershipTerms.endsOn));

    const care = await careGroupsOf(db, rows.map((r) => r.memberId));

    const counts = emptyCounts();
    const items: Array<{
      memberId: string;
      name: string;
      nickname: string | null;
      memberNo: string | null;
      avatarUrl: string | null;
      careGroup: { id: string; name: string } | null;
      bodyName: string | null;
      term: ReturnType<typeof toTermDto>;
      summary: MembershipSummary;
    }> = [];

    for (const r of rows) {
      const summary = summarizeMembership([r.term], today);
      counts.total += 1;
      counts[summary.state] += 1;
      if (r.term.type === "ordinary" && r.term.paymentStatus === "unpaid") counts.unpaid += 1;
      if (summary.needsAttention) counts.attention += 1;

      const cg = care.get(r.memberId) ?? null;
      if (careGroupId && cg?.id !== careGroupId) continue;
      if (search && !`${r.name} ${r.nickname ?? ""}`.toLowerCase().includes(search.toLowerCase())) continue;
      if (filter === "attention" && !summary.needsAttention) continue;
      if (filter === "trial" && r.term.type !== "extraordinary") continue;
      if (filter === "ordinary" && r.term.type !== "ordinary") continue;

      items.push({
        memberId: r.memberId,
        name: r.name,
        nickname: r.nickname,
        memberNo: formatMemberNo(r.memberNo),
        avatarUrl: r.avatarUrl,
        careGroup: cg ? { id: cg.id, name: cg.name } : null,
        bodyName: cg?.bodyName ?? null,
        term: toTermDto(r.term),
        summary,
      });
    }

    res.json({
      success: true,
      data: {
        today,
        counts,
        items: items.slice(0, limit),
        truncated: items.length > limit,
        canRecordPayment: MEMBERSHIP_PAYMENT_ROLES.includes(user.role),
      },
    });
  } catch (err) {
    next(err);
  }
});

function emptyCounts() {
  const counts: Record<string, number> = { total: 0, attention: 0, unpaid: 0 };
  for (const state of Object.keys(MEMBERSHIP_STATE_LABELS)) counts[state] = 0;
  return counts as { total: number; attention: number; unpaid: number } & Record<keyof typeof MEMBERSHIP_STATE_LABELS, number>;
}

// GET /members/:memberId — one member's status and full cycle history
membershipsRouter.get("/members/:memberId", async (req, res, next) => {
  try {
    const user = req.user!;
    const scope = await resolveMembershipScope(user);
    await assertCanView(scope, user.role, req.params.memberId);
    const member = await loadMember(req.params.memberId);
    const terms = await termsOf(member.id);
    const today = todayInThailand();
    let canDecide = false;
    try {
      await assertCanDecide(scope, user.role, member.id);
      canDecide = true;
    } catch {
      canDecide = false;
    }
    res.json({
      success: true,
      data: {
        member: { ...member, memberNo: formatMemberNo(member.memberNo) },
        today,
        summary: summarizeMembership(terms, today),
        terms: terms.map(toTermDto),
        permissions: { canDecide, canRecordPayment: MEMBERSHIP_PAYMENT_ROLES.includes(user.role) },
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /members/:memberId/terms — open the first (or the next) term for a member
membershipsRouter.post("/members/:memberId/terms", async (req, res, next) => {
  try {
    const user = req.user!;
    const scope = await resolveMembershipScope(user);
    await assertCanDecide(scope, user.role, req.params.memberId);
    const parsed = membershipStartSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }
    const member = await loadMember(req.params.memberId);
    const existing = await termsOf(member.id);
    if (existing.some((t) => t.status === "open")) {
      throw new ConflictError("สมาชิกคนนี้มีรอบสมาชิกที่ยังเปิดอยู่ — ตัดสินใจรอบเดิมก่อน");
    }
    const startsOn = parsed.data.startsOn ?? todayInThailand();
    const isTrial = parsed.data.type === "extraordinary";
    const [created] = await getDb()
      .insert(membershipTerms)
      .values({
        memberId: member.id,
        type: parsed.data.type,
        status: "open",
        startsOn,
        endsOn: addYears(startsOn, TERM_YEARS),
        feeBaht: isTrial ? 0 : ORDINARY_FEE_BAHT,
        paymentStatus: isTrial ? "not_required" : "unpaid",
        createdById: user.id,
      })
      .returning();
    await logAudit({
      req,
      action: "MEMBERSHIP_TERM_STARTED",
      entityType: "membership_term",
      entityId: created.id,
      details: { memberId: member.id, type: created.type, startsOn: created.startsOn, endsOn: created.endsOn },
    });
    res.status(201).json({ success: true, data: toTermDto(created) });
  } catch (err) {
    next(err);
  }
});

async function loadTerm(termId: string): Promise<MembershipTerm> {
  const [term] = await getDb().select().from(membershipTerms).where(eq(membershipTerms.id, termId)).limit(1);
  if (!term) throw new NotFoundError("ไม่พบรอบสมาชิก");
  return term;
}

// POST /terms/:termId/decision — convert a trial, renew an ordinary term, or not continue
membershipsRouter.post("/terms/:termId/decision", async (req, res, next) => {
  try {
    const user = req.user!;
    const term = await loadTerm(req.params.termId);
    const scope = await resolveMembershipScope(user);
    await assertCanDecide(scope, user.role, term.memberId);
    const parsed = membershipDecisionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }
    if (term.status !== "open") throw new ConflictError("รอบสมาชิกนี้ปิดไปแล้ว");
    const { decision } = parsed.data;
    const note = parsed.data.note || null;
    const now = new Date();

    let next: { reason: "converted_to_ordinary" | "renewed" | "not_continued"; open: boolean };
    if (decision === "not_continued") next = { reason: "not_continued", open: false };
    else if (decision === "convert_to_ordinary") {
      if (term.type !== "extraordinary") throw new ValidationError("เปลี่ยนเป็นสามัญได้เฉพาะสมาชิกวิสามัญ");
      next = { reason: "converted_to_ordinary", open: true };
    } else {
      if (term.type !== "ordinary") throw new ValidationError("ต่ออายุได้เฉพาะสมาชิกสามัญ");
      next = { reason: "renewed", open: true };
    }

    // The new ordinary cycle starts when the old one ends (renewal) or today (a
    // trial converted early/late); history is never edited, only closed.
    const nextStart = decision === "renew" ? term.endsOn : decision === "convert_to_ordinary" ? maxDate(todayInThailand(), term.startsOn) : null;

    await runAtomically((tx) => [
      tx
        .update(membershipTerms)
        .set({
          status: "closed",
          closedReason: next.reason,
          closedAt: now,
          decidedById: user.id,
          decisionNote: note,
          updatedAt: now,
        })
        .where(and(eq(membershipTerms.id, term.id), eq(membershipTerms.status, "open"))),
      ...(next.open && nextStart
        ? [
            tx.insert(membershipTerms).values({
              memberId: term.memberId,
              type: "ordinary",
              status: "open",
              startsOn: nextStart,
              endsOn: addYears(nextStart, TERM_YEARS),
              feeBaht: ORDINARY_FEE_BAHT,
              paymentStatus: "unpaid",
              createdById: user.id,
            }),
          ]
        : []),
    ]);

    await logAudit({
      req,
      action: "MEMBERSHIP_TERM_DECIDED",
      entityType: "membership_term",
      entityId: term.id,
      details: { memberId: term.memberId, decision, from: term.type, note },
    });
    const terms = await termsOf(term.memberId);
    res.json({
      success: true,
      data: { summary: summarizeMembership(terms, todayInThailand()), terms: terms.map(toTermDto) },
    });
  } catch (err) {
    next(err);
  }
});

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

// PATCH /terms/:termId/payment — an authorised person records money received
membershipsRouter.patch("/terms/:termId/payment", requireRole(...MEMBERSHIP_PAYMENT_ROLES), async (req, res, next) => {
  try {
    const user = req.user!;
    const parsed = membershipPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }
    const term = await loadTerm(req.params.termId);
    await loadMember(term.memberId); // a deleted member's terms are not editable
    if (term.paymentStatus === "not_required") throw new ValidationError("รอบวิสามัญไม่มีค่าสมาชิก");
    if (term.paymentStatus === "paid") throw new ConflictError("รอบนี้บันทึกการชำระเงินแล้ว");
    if (parsed.data.amountBaht < term.feeBaht) {
      throw new ValidationError(`จำนวนเงินต้องไม่น้อยกว่าค่าสมาชิก ${term.feeBaht} บาท`, [
        { field: "amountBaht", message: `ต้องไม่น้อยกว่า ${term.feeBaht} บาท` },
      ]);
    }
    const paidOn = parsed.data.paidOn ?? todayInThailand();
    const now = new Date();
    const [updated] = await getDb()
      .update(membershipTerms)
      .set({
        paymentStatus: "paid",
        paidAmountBaht: parsed.data.amountBaht,
        // Noon UTC keeps the calendar day stable in every timezone the app is read in.
        paidAt: new Date(`${paidOn}T05:00:00.000Z`),
        paymentRecordedById: user.id,
        paymentNote: parsed.data.note || null,
        updatedAt: now,
      })
      .where(and(eq(membershipTerms.id, term.id), eq(membershipTerms.paymentStatus, "unpaid")))
      .returning();
    if (!updated) throw new ConflictError("รอบนี้บันทึกการชำระเงินแล้ว");
    await logAudit({
      req,
      action: "MEMBERSHIP_PAYMENT_RECORDED",
      entityType: "membership_term",
      entityId: term.id,
      details: { memberId: term.memberId, amountBaht: updated.paidAmountBaht, paidOn },
    });
    res.json({ success: true, data: toTermDto(updated) });
  } catch (err) {
    next(err);
  }
});
