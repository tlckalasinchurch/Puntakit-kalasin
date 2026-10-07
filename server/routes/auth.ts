import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

/** Clerk-backed session endpoint used to sync the local role/profile. */
export const authRouter = Router();

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = req.user!;
  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});
