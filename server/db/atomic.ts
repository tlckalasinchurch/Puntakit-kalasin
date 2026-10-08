import { getDatabaseHandle, type Database, type DatabaseHandle } from "./client.js";

/**
 * A drizzle query builder that has NOT been awaited yet. Builders are lazy:
 * nothing reaches the database until they are awaited (transaction path) or
 * handed to `db.batch` (Neon HTTP path).
 */
export type AtomicStatement = PromiseLike<unknown>;

/**
 * Runs a fixed list of writes so that all of them succeed or none do.
 *
 * Why this exists: `drizzle-orm/neon-http` (the production driver) does NOT
 * support `db.transaction()`; it throws "No transactions support in neon-http
 * driver". It does support `db.batch([...])`, which sends every statement in
 * one HTTP request and runs them as ONE database transaction (rollback of all
 * on any failure). Other drivers keep `db.transaction()`.
 *
 * Constraints of the Neon path, which callers must respect:
 *  - the statements are fixed up front: a statement cannot read the result of
 *    an earlier one, so callers generate ids in the application
 *    (`randomUUID()`) instead of using `.returning()`;
 *  - everything travels in one request, so one atomic unit cannot be split
 *    into several batches without losing atomicity.
 *
 * `build` receives the executor to build statements with (the db for Neon, the
 * transaction otherwise) and must return the statements in execution order.
 */
export async function runAtomically(
  build: (executor: Database) => AtomicStatement[],
  handle: DatabaseHandle = getDatabaseHandle()
): Promise<void> {
  if (handle.driver === "neon") {
    const statements = build(handle.db);
    if (statements.length === 0) return;
    await handle.db.batch(statements as unknown as Parameters<typeof handle.db.batch>[0]);
    return;
  }

  await handle.db.transaction(async (tx) => {
    for (const statement of build(tx as unknown as Database)) {
      await statement;
    }
  });
}
