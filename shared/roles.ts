import type { UserRole } from "./schema.js";

/**
 * Canonical role sets for the whole application — defined once here and
 * imported by both the server routes and the client.
 *
 * This repo has exactly one permission system (the `USER_ROLES` enum) and this
 * file exists so it stays that way: before it, the same four-role list was
 * written out in five server route modules and three client pages, which is
 * exactly how a client-side gate drifts away from the server gate it is
 * supposed to mirror.
 *
 * `super_admin` is always allowed by `requireRole()` in
 * `server/middleware/auth.ts`, so it is listed explicitly in every set below
 * to keep the client and the server in agreement.
 */

/** Read every privileged surface, review/publish ministry content, manage any record. */
export const PRIVILEGED_ROLES: readonly UserRole[] = [
  "super_admin",
  "admin",
  "staff",
  "ministry_leader",
];

/**
 * Every role that may open the admin shell (`AppLayout`). A `member` belongs to
 * the member PWA under `/app/*` and is sent there instead.
 */
export const ADMIN_SHELL_ROLES: readonly UserRole[] = [
  "super_admin",
  "admin",
  "ministry_leader",
  "group_leader",
  "staff",
  "viewer",
];

/** Create mission activity, mission submissions and follow-ups. */
export const CREATE_ROLES: readonly UserRole[] = [...PRIVILEGED_ROLES, "group_leader"];

/** Soft-delete mission activity. */
export const DELETE_ROLES: readonly UserRole[] = ["super_admin", "admin", "ministry_leader"];

/**
 * Admin-gated resources: events, announcements, ministries, the church
 * profile, member deletion/restore and group creation/deletion.
 * `requireAdmin` in `server/middleware/auth.ts` is defined from this exact
 * set, so the client's `isAdmin` flag and the server gate can never drift.
 */
export const ADMIN_ROLES: readonly UserRole[] = ["super_admin", "admin"];

/** Create a member record (`POST /api/members`). */
export const MEMBER_CREATE_ROLES: readonly UserRole[] = ["super_admin", "admin", "staff"];

/**
 * Roles that receive unmasked member contacts from `GET /api/members` and may
 * therefore search by phone or email. Every other role gets masked contacts and
 * name-only search (`maskSensitiveData`, `server/routes/members.ts`).
 */
export const MEMBER_CONTACT_ROLES: readonly UserRole[] = ["super_admin", "admin", "staff"];

/**
 * Edit member records and export the member CSV
 * (`PUT /api/members/:id`, `GET /api/members/export/csv`). Staff-level roles
 * that can care for a record, but not create or delete one.
 */
export const MEMBER_UPDATE_ROLES: readonly UserRole[] = [
  ...MEMBER_CREATE_ROLES,
  "ministry_leader",
  "group_leader",
];

/**
 * Manage any group and its membership regardless of ownership. A
 * `group_leader` additionally needs to lead the specific group — the same
 * ownership rule `verifyGroupManagementAccess` enforces in
 * `server/routes/groups.ts`.
 */
export const GROUP_MANAGE_ANY_ROLES: readonly UserRole[] = [
  "super_admin",
  "admin",
  "ministry_leader",
];

/**
 * True when `role` is one of `allowed`. An undefined role (still loading, or
 * signed out) is never allowed.
 */
export function hasRole(role: UserRole | undefined, allowed: readonly UserRole[]): boolean {
  return role !== undefined && allowed.includes(role);
}
