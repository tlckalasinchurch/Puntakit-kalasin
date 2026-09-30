import { Router } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { churchProfile } from "../../shared/schema.js";
import { churchProfileInputSchema } from "../../shared/validation.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const churchProfileRouter = Router();

const PROFILE_ID = "main";

churchProfileRouter.use(requireAuth);

churchProfileRouter.get("/", async (_req, res) => {
  const db = getDb();
  const [row] = await db.select().from(churchProfile).where(eq(churchProfile.id, PROFILE_ID)).limit(1);
  res.json({ success: true, data: row ?? null });
});

churchProfileRouter.put("/", requireAdmin, async (req, res) => {
  const parsed = churchProfileInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
    return;
  }
  const db = getDb();
  const [saved] = await db
    .insert(churchProfile)
    .values({ id: PROFILE_ID, ...parsed.data })
    .onConflictDoUpdate({
      target: churchProfile.id,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();
  res.json({ success: true, data: saved });
});
