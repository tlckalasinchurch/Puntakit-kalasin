import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "../../shared/schema.js";
import { isUniqueViolation, KNOWN_UNIQUE_CONSTRAINTS } from "./dbErrors.js";

/**
 * The detector is checked against REAL errors from a real Postgres engine
 * (PGlite), as drizzle surfaces them, not against hand-made objects.
 */

let tempRoot: string;
let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;

const batch = (checksum: string) => ({
  sourceFileName: "x.xlsx",
  fileChecksum: checksum,
  layoutVariants: [],
  checkboxConventions: [],
  worksheetCount: 1,
  rowCount: 1,
  memberCount: 1,
  normalizationVersion: 1,
});

async function failure(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("expected the statement to fail");
}

beforeAll(async () => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "puntakit-dberrors-"));
  pg = new PGlite(path.join(tempRoot, "db"));
  db = drizzle(pg, { schema });
  await migrate(db, { migrationsFolder: path.join(import.meta.dirname, "..", "db", "migrations") });
}, 60_000);

afterAll(async () => {
  await pg.close();
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe("isUniqueViolation", () => {
  it("recognises a duplicate file checksum, by constraint name", async () => {
    await db.insert(schema.importBatches).values(batch("dup-checksum"));
    const error = await failure(() => db.insert(schema.importBatches).values(batch("dup-checksum")));
    expect(isUniqueViolation(error, KNOWN_UNIQUE_CONSTRAINTS.importFileChecksum)).toBe(true);
  });

  it("does not claim a unique violation of a DIFFERENT constraint", async () => {
    const error = await failure(() => db.insert(schema.importBatches).values(batch("dup-checksum")));
    expect(isUniqueViolation(error, "some_other_constraint")).toBe(false);
    expect(isUniqueViolation(error, "import_source_rows_pkey")).toBe(false);
  });

  it("does not claim other database errors (a foreign-key violation stays a 500)", async () => {
    const error = await failure(() =>
      db.insert(schema.importSourceRows).values({ batchId: "00000000-0000-4000-8000-000000000000", sheetName: "s", excelRow: 1, normStatus: "ok" })
    );
    expect(isUniqueViolation(error, KNOWN_UNIQUE_CONSTRAINTS.importFileChecksum)).toBe(false);
  });

  it("does not claim non-database values", () => {
    expect(isUniqueViolation(new Error("boom"), KNOWN_UNIQUE_CONSTRAINTS.importFileChecksum)).toBe(false);
    expect(isUniqueViolation(null, KNOWN_UNIQUE_CONSTRAINTS.importFileChecksum)).toBe(false);
    expect(isUniqueViolation("23505", KNOWN_UNIQUE_CONSTRAINTS.importFileChecksum)).toBe(false);
  });

  it("recognises the error whether it is wrapped (cause) or thrown directly (Neon HTTP)", () => {
    const direct = Object.assign(new Error("x"), { code: "23505", constraint: KNOWN_UNIQUE_CONSTRAINTS.importFileChecksum });
    const wrapped = Object.assign(new Error("Failed query"), { cause: direct });
    expect(isUniqueViolation(direct, KNOWN_UNIQUE_CONSTRAINTS.importFileChecksum)).toBe(true);
    expect(isUniqueViolation(wrapped, KNOWN_UNIQUE_CONSTRAINTS.importFileChecksum)).toBe(true);
  });

  it("uses the message when a driver omits the constraint field", () => {
    const error = Object.assign(new Error(`duplicate key value violates unique constraint "${KNOWN_UNIQUE_CONSTRAINTS.importFileChecksum}"`), { code: "23505" });
    expect(isUniqueViolation(error, KNOWN_UNIQUE_CONSTRAINTS.importFileChecksum)).toBe(true);
  });
});
