import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { authenticateWithPin, genericLoginError, revokeSession, setCsrfCookie } from "../lib/firstPartyAuth.js";
import { ValidationError } from "../lib/errors.js";

const loginSchema = z.object({
  identity: z.string().trim().email("กรุณากรอกอีเมลที่ถูกต้อง").max(254),
  pin: z.string().regex(/^\d{6}$/, "กรุณากรอกรหัส PIN 6 หลัก"),
});

export const authRouter = Router();

authRouter.get("/csrf", (_req, res) => {
  setCsrfCookie(res);
  res.json({ success: true, data: { ready: true } });
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(genericLoginError());
    const user = await authenticateWithPin(req, res, parsed.data.identity, parsed.data.pin);
    res.json({ success: true, data: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) { next(err); }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = req.user!;
  res.json({ success: true, data: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await revokeSession(req, res);
    res.json({ success: true, data: { loggedOut: true } });
  } catch (err) { next(err); }
});
