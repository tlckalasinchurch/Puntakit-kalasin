import { describe, expect, it, vi } from "vitest";
import {
  isDemoModeEnabled,
  isLegacyTestAuthEnabled,
  requireAdmin,
  requireRole,
} from "./auth.js";
import { createApp } from "../app.js";
import { verifyAuthToken } from "../lib/auth.js";
import { ADMIN_ROLES } from "../../shared/roles.js";
import type { UserRole } from "../../shared/schema.js";

/**
 * Pins the server gate to the shared role set.
 *
 * `requireAdmin` guards events, announcements, ministries, the church
 * profile, member deletion/restore and group creation/deletion — and the
 * client derives its `isAdmin` UI flag from the same `ADMIN_ROLES` set in
 * `shared/roles.ts`. These tests fail if either side of that contract moves
 * without the other: the middleware accepting a role outside ADMIN_ROLES, or
 * (via shared/roles.test.ts) the set itself drifting.
 */

const NON_ADMIN_ROLES: UserRole[] = ["staff", "ministry_leader", "group_leader", "member", "viewer"];

function runGate(
  middleware: ReturnType<typeof requireRole>,
  role: UserRole | undefined
): { passed: boolean; error?: unknown } {
  const req = {
    user:
      role === undefined
        ? undefined
        : { id: `u-${role}`, email: `${role}@test.local`, name: role, role },
  };
  const next = vi.fn();
  middleware(req as any, {} as any, next);
  // requireRole middleware always calls next exactly once: with no argument
  // when allowed, with the Unauthorized/Forbidden error when denied.
  const error = next.mock.calls[0]?.[0];
  return { passed: error === undefined, error };
}

describe("requireAdmin — defined from the shared ADMIN_ROLES set", () => {
  it.each([...ADMIN_ROLES])("allows %s (set member)", (role) => {
    const result = runGate(requireAdmin, role);
    expect(result.passed).toBe(true);
  });

  it.each(NON_ADMIN_ROLES)("rejects %s with 403 FORBIDDEN", (role) => {
    const result = runGate(requireAdmin, role);
    expect(result.passed).toBe(false);
    expect((result.error as any).statusCode).toBe(403);
    expect((result.error as any).code).toBe("FORBIDDEN");
  });

  it("rejects an unauthenticated request with 401 UNAUTHORIZED", () => {
    const result = runGate(requireAdmin, undefined);
    expect(result.passed).toBe(false);
    expect((result.error as any).statusCode).toBe(401);
    expect((result.error as any).code).toBe("UNAUTHORIZED");
  });
});

describe("requireRole — super_admin is always allowed, listed or not", () => {
  it("passes super_admin through a gate that omits it", () => {
    const result = runGate(requireRole("admin"), "super_admin");
    expect(result.passed).toBe(true);
  });

  it("rejects a role outside the gate's set with 403 FORBIDDEN", () => {
    const result = runGate(requireRole("admin"), "staff");
    expect(result.passed).toBe(false);
    expect((result.error as any).statusCode).toBe(403);
  });
});

/**
 * Guards the two auth shortcuts that only ever make sense off a deploy.
 *
 * These tests exist because of a real regression: `.env.local` (the documented
 * local dev file) sets `NODE_ENV=development` and `PUNTAKIT_DEMO_MODE=1`, and
 * it overrides the values `vitest.config.ts` declares. Demo mode was therefore
 * active during `pnpm test`, `requireAuth` auto-authenticated every request as
 * the demo admin, and 46 assertions across nine integration suites
 * (`expect(401)`, `expect(403)`, "hide from a non-privileged user") silently
 * stopped testing anything — while CI, which has no `.env.local`, stayed green.
 * The same class of mistake in production would be a full authorization
 * bypass, so both directions are pinned here.
 */
function withEnv(overrides: Record<string, string | undefined>, run: () => void): void {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) saved[key] = process.env[key];
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("demo mode — development only, never during tests or a deploy", () => {
  it("is off while the test runtime flag is set, even with NODE_ENV=development", () => {
    withEnv({ PUNTAKIT_DEMO_MODE: "1", NODE_ENV: "development", PUNTAKIT_TEST_AUTH: "1" }, () => {
      expect(isDemoModeEnabled()).toBe(false);
    });
  });

  it("is off in production", () => {
    withEnv({ PUNTAKIT_DEMO_MODE: "1", NODE_ENV: "production", PUNTAKIT_TEST_AUTH: undefined }, () => {
      expect(isDemoModeEnabled()).toBe(false);
    });
  });

  it("is on for local development (the documented .env.local contract)", () => {
    withEnv({ PUNTAKIT_DEMO_MODE: "1", NODE_ENV: "development", PUNTAKIT_TEST_AUTH: undefined }, () => {
      expect(isDemoModeEnabled()).toBe(true);
    });
  });
});

describe("legacy cookie/JWT path — unreachable from a deploy", () => {
  it("is off in production even when PUNTAKIT_TEST_AUTH=1 leaks into the environment", () => {
    withEnv({ PUNTAKIT_TEST_AUTH: "1", NODE_ENV: "production" }, () => {
      expect(isLegacyTestAuthEnabled()).toBe(false);
    });
  });

  it("refuses to construct the app when PUNTAKIT_TEST_AUTH=1 in production", () => {
    withEnv({ PUNTAKIT_TEST_AUTH: "1", NODE_ENV: "production" }, () => {
      expect(() => createApp()).toThrow(/PUNTAKIT_TEST_AUTH=1 is rejected/);
    });
  });

  it("refuses to construct the app when PUNTAKIT_DEMO_MODE=1 in production", () => {
    withEnv({ PUNTAKIT_DEMO_MODE: "1", NODE_ENV: "production", PUNTAKIT_TEST_AUTH: undefined }, () => {
      expect(() => createApp()).toThrow(/PUNTAKIT_DEMO_MODE=1 is rejected/);
    });
  });

  it("has no committed signing secret to fall back on", () => {
    // Previously `process.env.JWT_SECRET || "puntakit-test-only-secret"`: a
    // public constant that let anyone mint a token `requireAuth` accepted, and
    // `requireRole()` passes `super_admin` through every gate unconditionally.
    withEnv({ JWT_SECRET: undefined }, () => {
      expect(() => verifyAuthToken("anything.signed.here")).toThrow(/JWT_SECRET is not set/);
    });
  });
});
