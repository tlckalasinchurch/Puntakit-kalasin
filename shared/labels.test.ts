import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import * as path from "node:path";
import { MEMBERSHIP_STATUS_LABELS, ROLE_LABELS } from "./labels.js";
import { MEMBERSHIP_STATUSES, USER_ROLES } from "./schema.js";

/**
 * Guards the membership-status label contract.
 *
 * The Member PWA profile page once checked pre-schema values
 * ("regular"/"baptized"), so its ternary fell through to "ผู้สนใจ" for every
 * member regardless of their real status. These tests fail when:
 *  - the shared label map stops covering exactly the schema's enum values, or
 *  - any client file compares `membershipStatus` against a value that is not
 *    in MEMBERSHIP_STATUSES (the "regular"/"baptized" class of bug).
 */

const CLIENT_SRC = path.resolve(import.meta.dirname, "..", "client", "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("membership status labels (shared/labels.ts)", () => {
  it("covers exactly the schema's MEMBERSHIP_STATUSES values", () => {
    expect(Object.keys(MEMBERSHIP_STATUS_LABELS).sort()).toEqual(
      [...MEMBERSHIP_STATUSES].sort()
    );
  });

  it("every label is non-empty Thai text distinct per status", () => {
    const labels = Object.values(MEMBERSHIP_STATUS_LABELS);
    for (const label of labels) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("no client file compares membershipStatus to a value outside the enum", () => {
    const offenders: string[] = [];
    for (const file of walk(CLIENT_SRC)) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("membershipStatus")) continue;
      // Any `membershipStatus === "x"` / `=== 'x'` comparison must use one of
      // the schema's values — "regular"/"baptized" style drift fails here.
      const compared = [...source.matchAll(/membershipStatus\s*===\s*["']([^"']+)["']/g)];
      for (const [, value] of compared) {
        if (!(MEMBERSHIP_STATUSES as readonly string[]).includes(value)) {
          offenders.push(`${path.relative(CLIENT_SRC, file)}: "${value}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("user role labels (shared/labels.ts)", () => {
  it("covers exactly the schema's USER_ROLES values", () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...USER_ROLES].sort());
  });

  it("every label is non-empty and distinct per role", () => {
    const labels = Object.values(ROLE_LABELS);
    for (const label of labels) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("no client file builds a role label from an inline ternary/role list", () => {
    // The Member PWA once hardcoded a five-branch ternary that dropped
    // admin/viewer and drifted on wording. Any hand-written role→label map
    // or ternary chain must be replaced by ROLE_LABELS.
    const offenders: string[] = [];
    for (const file of walk(CLIENT_SRC)) {
      const source = readFileSync(file, "utf8");
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
      // Inline literal maps of role names to Thai labels...
      if (/\{\s*(super_admin|admin)\s*:\s*"[\u0E00-\u0E7F]/.test(source)) {
        offenders.push(path.relative(CLIENT_SRC, file) + " (inline role label map)");
      }
      // ...or ternary chains comparing user.role to render a Thai label.
      if (/role\s*===\s*"(super_admin|ministry_leader|group_leader|staff)"\s*\n?\s*\?\s*"[\u0E00-\u0E7F]/.test(source)) {
        offenders.push(path.relative(CLIENT_SRC, file) + " (inline role label ternary)");
      }
    }
    expect(offenders).toEqual([]);
  });
});
