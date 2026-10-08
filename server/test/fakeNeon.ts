import type { PGlite } from "@electric-sql/pglite";

/**
 * A stand-in for `neon(connectionString)` from @neondatabase/serverless that
 * answers from an embedded PGlite. It lets the REAL `drizzle-orm/neon-http`
 * driver run in tests, so Neon-only behaviour is exercised for real:
 *
 *  - `db.transaction()` throws "No transactions support in neon-http driver"
 *    (that is drizzle's own code, not this fake);
 *  - `db.batch([...])` reaches `client.transaction(queries)`, which this fake
 *    runs as ONE PGlite transaction, like Neon's HTTP transaction endpoint
 *    (all statements commit together or roll back together).
 *
 * `failWhen` injects a failure while a batch is running, after the earlier
 * statements have already executed inside the transaction. It is how the tests
 * prove a failure rolls back everything.
 */

type QueryOptions = { arrayMode?: boolean; fullResults?: boolean };
type QueryData = { query: string; params: unknown[]; options: QueryOptions };

export interface FakeNeon {
  sql: ((query: string, params?: unknown[], options?: QueryOptions) => LazyQuery) & {
    query: FakeNeon["sql"];
    transaction: (queries: LazyQuery[], options?: QueryOptions) => Promise<unknown[]>;
  };
  /** Number of `transaction()` (batch) calls received. */
  readonly batchCalls: () => number;
  /** Statements in the most recent batch, in order. */
  readonly lastBatch: () => string[];
  /** While set, a statement for which this returns true fails the whole batch. */
  failWhen: ((query: string) => boolean) | null;
}

type LazyQuery = PromiseLike<unknown> & { queryData: QueryData };

export function createFakeNeon(pg: PGlite): FakeNeon {
  let batchCalls = 0;
  let lastBatch: string[] = [];

  const shape = (res: { rows: unknown[]; fields: unknown[]; affectedRows?: number }, options: QueryOptions) =>
    options.fullResults ? { ...res, rowCount: res.affectedRows ?? res.rows.length, command: "" } : res.rows;

  const execute = async (executor: Pick<PGlite, "query">, data: QueryData) => {
    const res = await executor.query(data.query, data.params, { rowMode: data.options.arrayMode ? "array" : "object" });
    return shape(res as never, data.options);
  };

  const lazy = (query: string, params: unknown[] = [], options: QueryOptions = {}): LazyQuery => {
    const queryData: QueryData = { query, params, options };
    return {
      queryData,
      then: (onFulfilled, onRejected) => execute(pg, queryData).then(onFulfilled, onRejected),
    } as LazyQuery;
  };

  const fake: FakeNeon = {
    sql: Object.assign((query: string, params?: unknown[], options?: QueryOptions) => lazy(query, params, options), {
      query: undefined as unknown as FakeNeon["sql"],
      transaction: async (queries: LazyQuery[]) => {
        batchCalls += 1;
        lastBatch = queries.map((q) => q.queryData.query);
        return pg.transaction(async (tx) => {
          const results: unknown[] = [];
          for (const q of queries) {
            if (fake.failWhen?.(q.queryData.query)) {
              throw Object.assign(new Error("injected failure inside the batch"), { code: "XX000" });
            }
            results.push(await execute(tx, q.queryData));
          }
          return results;
        });
      },
    }) as FakeNeon["sql"],
    batchCalls: () => batchCalls,
    lastBatch: () => lastBatch,
    failWhen: null,
  };
  fake.sql.query = fake.sql;
  return fake;
}
