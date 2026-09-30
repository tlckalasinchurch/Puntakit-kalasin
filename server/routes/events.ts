import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { events } from "../../shared/schema.js";
import { eventInputSchema } from "../../shared/validation.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const eventsRouter = Router();

eventsRouter.use(requireAuth);

eventsRouter.get("/", async (_req, res) => {
  const db = getDb();
  const rows = await db.select().from(events).orderBy(asc(events.eventDate));
  res.json({ success: true, data: rows });
});

eventsRouter.get("/:id", async (req, res) => {
  const db = getDb();
  const [row] = await db.select().from(events).where(eq(events.id, req.params.id)).limit(1);
  if (!row) {
    res.status(404).json({ success: false, error: "ไม่พบกิจกรรม" });
    return;
  }
  res.json({ success: true, data: row });
});

eventsRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = eventInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
    return;
  }
  const db = getDb();
  const [created] = await db.insert(events).values(parsed.data).returning();
  res.status(201).json({ success: true, data: created });
});

eventsRouter.put("/:id", requireAdmin, async (req, res) => {
  const parsed = eventInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
    return;
  }
  const db = getDb();
  const [updated] = await db
    .update(events)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(events.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ success: false, error: "ไม่พบกิจกรรม" });
    return;
  }
  res.json({ success: true, data: updated });
});

eventsRouter.delete("/:id", requireAdmin, async (req, res) => {
  const db = getDb();
  const [deleted] = await db.delete(events).where(eq(events.id, req.params.id)).returning();
  if (!deleted) {
    res.status(404).json({ success: false, error: "ไม่พบกิจกรรม" });
    return;
  }
  res.json({ success: true, data: deleted });
});
