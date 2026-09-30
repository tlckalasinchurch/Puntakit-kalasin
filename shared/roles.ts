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

/** Create mission activity, mission submissions and follow-ups. */
export const CREATE_ROLES: readonly UserRole[] = [...PRIVILEGED_ROLES, "group_leader"];

/** Soft-delete mission activity. */
export const DELETE_ROLES: readonly UserRole[] = ["super_admin", "admin", "ministry_leader"];

/**
 * True when `role` is one of `allowed`. An undefined role (still loading, or
 * signed out) is never allowed.
 */
export function hasRole(role: UserRole | undefined, allowed: readonly UserRole[]): boolean {
  return role !== undefined && allowed.includes(role);
}
