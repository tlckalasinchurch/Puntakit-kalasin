import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";

/**
 * Client/server role-gate drift guard.
 *
 * Every role gate must come from the canonical sets in `shared/roles.ts`
 * (AGENTS.md: "do not invent a second permission system or write a role list
 * inline"). The concrete bugs this prevents:
 *
 *  - Pages that checked `user?.role === "admin"` while the server's
 *    `requireAdmin` also allows `super_admin` — so super_admin saw a
 *    read-only UI.
 *  - Members' single `canManage` flag covering both create and edit, while
 *    the server allows only super_admin/admin/staff to create — so a
 *    group_leader saw "เพิ่มสมาชิก" and got a 403 on submit.
 *
 * Scans are intentionally static: a reviewer changing a gate must go through
 * `shared/roles.ts` instead of hand-editing a role list back in.
 */

const CLIENT_SRC = path.resolve(import.meta.dirname);
const REPO_ROOT = path.resolve(CLIENT_SRC, "..", "..");

/** The role-gated pages named in the audit that must mirror server gates. */
const GATED_PAGES = ["Events", "Announcements", "Ministries", "Church", "Members", "Groups"];

/** Static role equality checks that should have been a shared set instead. */
const INLINE_STATIC_ROLE_CHECK =
  /\.role\s*===\s*"(super_admin|admin|staff|ministry_leader)"/;

/** An inline literal list inside a requireRole(...) call. */
const INLINE_REQUIRE_ROLE_LIST = /requireRole\(\s*"/;

describe("role-gate contract (client ↔ server single source)", () => {
  it.each(GATED_PAGES)("%s gates through shared/roles.ts, not inline role checks", (page) => {
    const source = readFileSync(path.join(CLIENT_SRC, "pages", `${page}.tsx`), "utf8");
    expect(source, `${page}.tsx must import the shared role sets`).toContain('from "@shared/roles"');
    expect(source, `${page}.tsx must gate with hasRole(...)`).toMatch(/hasRole\(/);
    expect(
      source,
      `${page}.tsx must not compare user.role to a static role string directly`
    ).not.toMatch(INLINE_STATIC_ROLE_CHECK);
  });

  it.each(["members.ts", "groups.ts"])(
    "server/routes/%s takes its role sets from shared/roles.ts",
    (file) => {
      const source = readFileSync(path.join(REPO_ROOT, "server", "routes", file), "utf8");
      expect(source).toContain('from "../../shared/roles.js"');
      expect(
        source,
        `${file} must not pass an inline role list to requireRole()`
      ).not.toMatch(INLINE_REQUIRE_ROLE_LIST);
      expect(
        source,
        `${file} must not compare user.role to a static role string directly`
      ).not.toMatch(INLINE_STATIC_ROLE_CHECK);
    }
  );

  it("requireAdmin is defined from ADMIN_ROLES", () => {
    const source = readFileSync(path.join(REPO_ROOT, "server", "middleware", "auth.ts"), "utf8");
    expect(source).toMatch(/requireAdmin\s*=\s*requireRole\(\.\.\.ADMIN_ROLES\)/);
  });
});
