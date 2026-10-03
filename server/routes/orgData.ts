import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { ADMIN_ROLES } from "../../shared/roles.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";
import { ValidationError } from "../lib/errors.js";
import { applyOrgLoad, buildOrgRows, describeOrgLoad, orgDatasetSchema, rollbackOrgLoad } from "../lib/orgDataset.js";

/**
 * Admin-only loader for the prepared org dataset (body -> care group -> member).
 * The dataset is uploaded by the admin from the browser. It is never stored in
 * the repository and never logged: audit details carry counts only.
 */
export const orgDataRouter = Router();
orgDataRouter.use(requireAuth, requireRole(...ADMIN_ROLES));

const bodySchema = z.object({ dataset: orgDatasetSchema, confirm: z.boolean().optional() });

function parse(req: { body: unknown }) {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(
      "ไฟล์ข้อมูลไม่ถูกต้อง",
      parsed.error.issues.slice(0, 20).map((i) => ({ field: i.path.slice(0, 4).join("."), message: i.message }))
    );
  }
  let rows;
  try {
    rows = buildOrgRows(parsed.data.dataset);
  } catch (err) {
    throw new ValidationError("ไฟล์ข้อมูลไม่สอดคล้องกัน", [{ field: "dataset", message: (err as Error).message }]);
  }
  return { rows, confirm: parsed.data.confirm === true };
}

orgDataRouter.post("/dry-run", async (req, res, next) => {
  try {
    const { rows } = parse(req);
    res.json({ success: true, data: await describeOrgLoad(getDb(), rows) });
  } catch (err) {
    next(err);
  }
});

orgDataRouter.post("/apply", async (req, res, next) => {
  try {
    const { rows, confirm } = parse(req);
    if (!confirm) throw new ValidationError("ต้องยืนยันก่อนโหลดข้อมูล", [{ field: "confirm", message: "required" }]);
    const before = await describeOrgLoad(getDb(), rows);
    await applyOrgLoad(rows);
    const after = await describeOrgLoad(getDb(), rows);
    await logAudit({
      req,
      action: "ORG_DATASET_LOADED",
      entityType: "org_dataset",
      details: { plan: before.plan, targetBefore: before.targetBefore, targetAfter: after.targetBefore },
    });
    res.json({ success: true, data: { plan: before.plan, targetBefore: before.targetBefore, targetAfter: after.targetBefore } });
  } catch (err) {
    next(err);
  }
});

orgDataRouter.post("/rollback", async (req, res, next) => {
  try {
    const { rows, confirm } = parse(req);
    if (!confirm) throw new ValidationError("ต้องยืนยันก่อนถอนกลับ", [{ field: "confirm", message: "required" }]);
    const before = await describeOrgLoad(getDb(), rows);
    await rollbackOrgLoad(rows);
    const after = await describeOrgLoad(getDb(), rows);
    await logAudit({
      req,
      action: "ORG_DATASET_ROLLED_BACK",
      entityType: "org_dataset",
      details: { plan: before.plan, targetBefore: before.targetBefore, targetAfter: after.targetBefore },
    });
    res.json({ success: true, data: { plan: before.plan, targetBefore: before.targetBefore, targetAfter: after.targetBefore } });
  } catch (err) {
    next(err);
  }
});
