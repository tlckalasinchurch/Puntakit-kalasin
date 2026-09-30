import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { announcements } from "../../shared/schema.js";
import { announcementInputSchema } from "../../shared/validation.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const announcementsRouter = Router();

announcementsRouter.use(requireAuth);

announcementsRouter.get("/", async (_req, res) => {
  const db = getDb();
  const rows = await db.select().from(announcements).orderBy(desc(announcements.publishDate));
  res.json({ success: true, data: rows });
});

announcementsRouter.get("/:id", async (req, res) => {
  const db = getDb();
  const [row] = await db.select().from(announcements).where(eq(announcements.id, req.params.id)).limit(1);
  if (!row) {
    res.status(404).json({ success: false, error: "ไม่พบประกาศ" });
    return;
  }
  res.json({ success: true, data: row });
});

announcementsRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = announcementInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
    return;
  }
  const db = getDb();
  const [created] = await db
    .insert(announcements)
    .values({ ...parsed.data, createdBy: req.user!.id })
    .returning();
  res.status(201).json({ success: true, data: created });
});

announcementsRouter.put("/:id", requireAdmin, async (req, res) => {
  const parsed = announcementInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
    return;
  }
  const db = getDb();
  const [updated] = await db
    .update(announcements)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(announcements.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ success: false, error: "ไม่พบประกาศ" });
    return;
  }
  res.json({ success: true, data: updated });
});

announcementsRouter.delete("/:id", requireAdmin, async (req, res) => {
  const db = getDb();
  const [deleted] = await db.delete(announcements).where(eq(announcements.id, req.params.id)).returning();
  if (!deleted) {
    res.status(404).json({ success: false, error: "ไม่พบประกาศ" });
    return;
  }
  res.json({ success: true, data: deleted });
});
