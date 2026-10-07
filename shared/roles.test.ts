import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLES,
  CREATE_ROLES,
  DELETE_ROLES,
  GROUP_MANAGE_ANY_ROLES,
  MEMBER_CREATE_ROLES,
  MEMBER_UPDATE_ROLES,
  PRIVILEGED_ROLES,
  hasRole,
} from "./roles.js";
import { USER_ROLES } from "./schema.js";

/**
 * Invariants for the canonical role sets (shared/roles.ts).
 *
 * These sets are the single source of truth for both the server route gates
 * and the client's role-gated UI. The bugs this guards against are the ones
 * this file exists to prevent:
 *  - a set listing a role that does not exist in USER_ROLES,
 *  - a set silently dropping `super_admin` (which `requireRole()` always
 *    allows server-side, so a client gate without it would hide buttons from
 *    the very role the server lets through),
 *  - the member hierarchy inverting (create ⊄ update, admin ⊄ create),
 *  - an admin-only set quietly growing a staff-level role.
 */

const ALL_SETS = {
  PRIVILEGED_ROLES,
  CREATE_ROLES,
  DELETE_ROLES,
  ADMIN_ROLES,
  MEMBER_CREATE_ROLES,
  MEMBER_UPDATE_ROLES,
  GROUP_MANAGE_ANY_ROLES,
} as const;

describe("shared/roles.ts — canonical role sets", () => {
  it("every set contains only known USER_ROLES, with no duplicates", () => {
    for (const [name, roles] of Object.entries(ALL_SETS)) {
      expect(new Set(roles).size, `${name} contains duplicates`).toBe(roles.length);
      for (const role of roles) {
        expect(USER_ROLES, `${name} lists unknown role "${role}"`).toContain(role);
      }
    }
  });

  it("every set includes super_admin (requireRole always allows it)", () => {
    for (const [name, roles] of Object.entries(ALL_SETS)) {
      expect(roles, `${name} must include super_admin`).toContain("super_admin");
    }
  });

  it("nests the member gates: admin ⊂ member-create ⊂ member-update", () => {
    for (const role of ADMIN_ROLES) {
      expect(MEMBER_CREATE_ROLES).toContain(role);
    }
    for (const role of MEMBER_CREATE_ROLES) {
      expect(MEMBER_UPDATE_ROLES).toContain(role);
    }
  });

  it("keeps the admin-only set exactly super_admin + admin", () => {
    // Pinned deliberately: `requireAdmin` (events, announcements, ministries,
    // church profile, member delete/restore, group create/delete) is defined
    // from this set. Widening it must be a conscious decision, not a drift.
    expect([...ADMIN_ROLES].sort()).toEqual(["admin", "super_admin"]);
  });

  it("keeps staff out of group-wide management but in member editing", () => {
    // verifyGroupManagementAccess in server/routes/groups.ts: staff cannot
    // manage groups, while MEMBER_UPDATE_ROLES grants the staff-level roles
    // member editing + CSV export.
    expect(GROUP_MANAGE_ANY_ROLES).not.toContain("staff");
    expect(MEMBER_UPDATE_ROLES).toContain("staff");
    expect(MEMBER_UPDATE_ROLES).toContain("group_leader");
    expect(MEMBER_CREATE_ROLES).not.toContain("group_leader");
  });

  it("hasRole allows every listed role and denies an undefined role", () => {
    for (const roles of Object.values(ALL_SETS)) {
      for (const role of roles) {
        expect(hasRole(role, roles)).toBe(true);
      }
    }
    expect(hasRole(undefined, ADMIN_ROLES)).toBe(false);
  });
});
