import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { ministries } from "../../shared/schema.js";
import { ministryInputSchema } from "../../shared/validation.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const ministriesRouter = Router();

ministriesRouter.use(requireAuth);

ministriesRouter.get("/", async (_req, res) => {
  const db = getDb();
  const rows = await db.select().from(ministries).orderBy(desc(ministries.createdAt));
  res.json({ success: true, data: rows });
});

ministriesRouter.get("/:id", async (req, res) => {
  const db = getDb();
  const [row] = await db.select().from(ministries).where(eq(ministries.id, req.params.id)).limit(1);
  if (!row) {
    res.status(404).json({ success: false, error: "ไม่พบพันธกิจ" });
    return;
  }
  res.json({ success: true, data: row });
});

ministriesRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = ministryInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
    return;
  }
  const db = getDb();
  const [created] = await db.insert(ministries).values(parsed.data).returning();
  res.status(201).json({ success: true, data: created });
});

ministriesRouter.put("/:id", requireAdmin, async (req, res) => {
  const parsed = ministryInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
    return;
  }
  const db = getDb();
  const [updated] = await db
    .update(ministries)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(ministries.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ success: false, error: "ไม่พบพันธกิจ" });
    return;
  }
  res.json({ success: true, data: updated });
});

ministriesRouter.delete("/:id", requireAdmin, async (req, res) => {
  const db = getDb();
  const [deleted] = await db.delete(ministries).where(eq(ministries.id, req.params.id)).returning();
  if (!deleted) {
    res.status(404).json({ success: false, error: "ไม่พบพันธกิจ" });
    return;
  }
  res.json({ success: true, data: deleted });
});
