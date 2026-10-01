import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import * as path from "node:path";
import { api } from "./lib/api";

/**
 * Client sync guard for the GET /api/members wire contract.
 *
 * The server (server/routes/members.ts, pinned by members.test.ts) returns
 * the member rows as a BARE ARRAY in `data`, with pagination in a separate
 * `meta` field — there is no `{ items: [...] }` wrapper. Attendance's live
 * roster and Groups' add-member picker once typed this response as
 * `{ items }`, read `undefined` and rendered an always-empty list.
 *
 * These tests fail when either:
 *  1. a client file types `/api/members` as `{ items: ... }` again, or
 *  2. `api.request` stops returning the `data` field as-is (which is what
 *     makes the bare-array typing work).
 * The server-side shape change is caught by server/routes/members.test.ts.
 */

const CLIENT_SRC = path.resolve(import.meta.dirname);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(tsx?|ts)$/.test(entry) || full.endsWith(".ts") || full.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("GET /api/members list contract (client sync guard)", () => {
  it("no client file reads /api/members through an `{ items }` wrapper", () => {
    const offenders: string[] = [];
    for (const file of walk(CLIENT_SRC)) {
      const source = readFileSync(file, "utf8");
      // An api.get<...> call on /api/members whose generic is an object
      // wrapping the rows in `items` — the exact shape that blanked the
      // Attendance roster and the Groups add-member picker.
      const wrapperCall = source.match(
        /api\.get<\s*\{\s*items\s*:\s*[^}]*\}\s*>\s*\(\s*[`"']\/api\/members/
      );
      if (wrapperCall) offenders.push(path.relative(CLIENT_SRC, file));
      // Reads like `.items` on the result of a /api/members fetch are the
      // same bug in a different costume.
      const wrapperRead = source.match(
        /(memRes|res|response)\s*\.\s*items\s*(\|\||;|\))/g
      );
      if (wrapperRead && source.includes("/api/members")) {
        offenders.push(`${path.relative(CLIENT_SRC, file)} (.items read)`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("api.request unwraps the standard envelope to `data` so bare-array typing works", async () => {
    const source = readFileSync(path.join(CLIENT_SRC, "lib", "api.ts"), "utf8");
    expect(source).toContain("success");
    // The unwrapping return that every `api.get<T>` depends on.
    expect(source).toMatch(/return\s+res\.data\s+as\s+T/);
  });
});
