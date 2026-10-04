import type { Database } from "../db/client.js";
import { getDatabaseHandle } from "../db/client.js";

/**
 * Runs the statements built by `build` as ONE unit.
 *
 * neon-http has no transactions, but `db.batch()` sends the statements in one
 * request that commits or rolls back together. The other drivers use a normal
 * transaction. `build` must create every statement from the `db` it is given
 * and must not await them, so the same code serves both paths.
 */
export async function runAtomically(build: (db: Database) => unknown[]): Promise<void> {
  const handle = getDatabaseHandle();
  if (handle.driver === "neon") {
    const statements = build(handle.db as unknown as Database);
    if (statements.length) await handle.db.batch(statements as unknown as Parameters<typeof handle.db.batch>[0]);
    return;
  }
  await (handle.db as unknown as Database).transaction(async (tx) => {
    for (const statement of build(tx as unknown as Database)) await statement;
  });
}
