import { Router } from "express";
import { z } from "zod";
import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { groups, users, USER_ROLES } from "../../shared/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { runAtomically } from "../lib/atomicWrites.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";

/**
 * Super-admin-only account management. `requireRole()` always lets super_admin
 * through and admin must NOT pass here, so this router checks the role itself.
 *
 * It changes two things only: `users.role`, and `groups.leader_id` of care
 * groups (the owner field the existing group rules already read). It never
 * creates accounts: a person appears in the list after the first sign-in.
 */
export const adminUsersRouter = Router();
adminUsersRouter.use(requireAuth, (req, _res, next) => {
  if (req.user?.role !== "super_admin") return next(new ForbiddenError("เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น"));
  next();
});

const roleSchema = z.object({ role: z.enum(USER_ROLES) });
const careGroupsSchema = z.object({
  groupIds: z.array(z.string().uuid()).max(200),
  /** Must be true to take a care group away from a different current leader. */
  replaceExisting: z.boolean().optional(),
});

adminUsersRouter.get("/", async (req, res, next) => {
  try {
    const db = getDb();
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status, createdAt: users.createdAt })
      .from(users)
      .where(search ? or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`)) : undefined)
      .orderBy(asc(users.name))
      .limit(500);

    // Everything below mirrors `getLedGroupIds` (careScope.ts): a group counts
    // when the user is its leader_id OR co_leader_id, at any level. `careGroups`
    // keeps the old meaning (care groups they lead) because the picker edits it.
    const userIds = rows.map((r) => r.id);
    const led = rows.length
      ? await db
          .select({
            id: groups.id,
            name: groups.name,
            orgLevel: groups.orgLevel,
            leaderId: groups.leaderId,
            coLeaderId: groups.coLeaderId,
          })
          .from(groups)
          .where(and(isNull(groups.deletedAt), or(inArray(groups.leaderId, userIds), inArray(groups.coLeaderId, userIds))))
          .orderBy(asc(groups.name))
      : [];
    type Entry = { id: string; name: string; orgLevel: "body" | "care" | null; as: "leader" | "co_leader" };
    const scopeOf = new Map<string, Entry[]>();
    const add = (userId: string | null, g: (typeof led)[number], as: Entry["as"]) => {
      if (userId) scopeOf.set(userId, [...(scopeOf.get(userId) ?? []), { id: g.id, name: g.name, orgLevel: g.orgLevel, as }]);
    };
    for (const g of led) {
      add(g.leaderId, g, "leader");
      if (g.coLeaderId && g.coLeaderId !== g.leaderId) add(g.coLeaderId, g, "co_leader");
    }

    res.json({
      success: true,
      data: rows.map((r) => {
        const effective = scopeOf.get(r.id) ?? [];
        return {
          ...r,
          careGroups: effective.filter((g) => g.as === "leader" && g.orgLevel === "care").map(({ id, name }) => ({ id, name })),
          ledGroups: effective,
          // The server applies group scope only to the group_leader role.
          scopeActive: r.role === "group_leader",
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

adminUsersRouter.put("/:id/role", async (req, res, next) => {
  try {
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("บทบาทไม่ถูกต้อง", [{ field: "role", message: "invalid" }]);
    const db = getDb();
    const [target] = await db.select().from(users).where(eq(users.id, req.params.id)).limit(1);
    if (!target) throw new NotFoundError("ไม่พบผู้ใช้");
    if (target.id === req.user!.id) throw new ConflictError("เปลี่ยนบทบาทของตัวเองไม่ได้");
    if (target.role === "super_admin" && parsed.data.role !== "super_admin") {
      const [{ count }] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(users)
        .where(and(eq(users.role, "super_admin"), eq(users.status, "active")));
      if (count <= 1) throw new ConflictError("ต้องมีผู้ดูแลระบบสูงสุดอย่างน้อย 1 คน");
    }
    const [updated] = await db
      .update(users)
      .set({ role: parsed.data.role, updatedAt: new Date() })
      .where(eq(users.id, target.id))
      .returning({ id: users.id, role: users.role });
    await logAudit({ req, action: "USER_ROLE_CHANGED", entityType: "user", entityId: target.id, details: { from: target.role, to: updated.role } });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/** Replace the set of care groups this user leads. */
adminUsersRouter.put("/:id/care-groups", async (req, res, next) => {
  try {
    const parsed = careGroupsSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("รายการพันธกิจไม่ถูกต้อง", [{ field: "groupIds", message: "invalid" }]);
    const db = getDb();
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, req.params.id)).limit(1);
    if (!target) throw new NotFoundError("ไม่พบผู้ใช้");

    const wanted = Array.from(new Set(parsed.data.groupIds));
    if (wanted.length) {
      const live = await db
        .select({ id: groups.id })
        .from(groups)
        .where(and(inArray(groups.id, wanted), eq(groups.orgLevel, "care"), isNull(groups.deletedAt)));
      if (live.length !== wanted.length) throw new ValidationError("มีพันธกิจที่ไม่พบในระบบ", [{ field: "groupIds", message: "unknown care group" }]);
    }
    // Taking a group from another leader is a decision, not a side effect:
    // without `replaceExisting` the request is refused and names the groups.
    if (wanted.length && !parsed.data.replaceExisting) {
      const taken = await db
        .select({ id: groups.id, name: groups.name, leaderName: users.name })
        .from(groups)
        .innerJoin(users, eq(groups.leaderId, users.id))
        .where(and(inArray(groups.id, wanted), sql`${groups.leaderId} <> ${target.id}`));
      if (taken.length) {
        throw new ConflictError(
          `พันธกิจ ${taken.length} รายการมีหัวหน้าอยู่แล้ว`,
          taken.map((t) => ({ field: "groupIds", message: `${t.name.trim()} — หัวหน้าเดิม ${t.leaderName}` }))
        );
      }
    }

    const before = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.leaderId, target.id), eq(groups.orgLevel, "care"), isNull(groups.deletedAt)));
    const beforeIds = before.map((g) => g.id);
    const removed = beforeIds.filter((g) => !wanted.includes(g));
    const added = wanted.filter((g) => !beforeIds.includes(g));

    await runAtomically((tx) => [
      ...(removed.length ? [tx.update(groups).set({ leaderId: null, updatedAt: new Date() }).where(inArray(groups.id, removed))] : []),
      ...(added.length ? [tx.update(groups).set({ leaderId: target.id, updatedAt: new Date() }).where(inArray(groups.id, added))] : []),
    ]);
    await logAudit({ req, action: "USER_CARE_GROUPS_SET", entityType: "user", entityId: target.id, details: { added: added.length, removed: removed.length, total: wanted.length } });
    res.json({ success: true, data: { groupIds: wanted } });
  } catch (err) {
    next(err);
  }
});
