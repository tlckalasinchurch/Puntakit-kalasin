import { SUPER_ADMIN_ROLES } from "../../shared/roles.js";
import { requireRole } from "./auth.js";

/**
 * Guard for every endpoint that loads, decides or approves import data (workbook upload,
 * duplicate decisions, rule confirmation, merge plans, org dataset dry-run/apply/rollback).
 * Only a super_admin may write. It is separate from `requireAdmin` on purpose: that guard
 * is shared with routes unrelated to import and keeps meaning "admin or super_admin".
 * Reading import results stays on each route's own reader guard.
 */
export const requireImportWriter = requireRole(...SUPER_ADMIN_ROLES);
