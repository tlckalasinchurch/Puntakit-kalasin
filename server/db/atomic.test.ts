import { describe, expect, it, vi } from "vitest";

import { runAtomically } from "./atomic.js";
import type { DatabaseHandle } from "./client.js";

/**
 * runAtomically picks the write strategy by driver. These tests use stand-in
 * handles that behave like the real drivers on the one point that matters:
 * the Neon HTTP driver throws when `transaction()` is called.
 */

const statement = (label: string, log: string[]) =>
  ({ then: (resolve: (value: unknown) => unknown) => { log.push(label); return Promise.resolve(resolve(undefined)); } }) as PromiseLike<unknown>;

describe("runAtomically", () => {
  it("on the Neon driver: one batch with every statement, never a transaction", async () => {
    const batch = vi.fn(async () => []);
    const transaction = vi.fn(async () => {
      throw new Error("No transactions support in neon-http driver");
    });
    const handle = { driver: "neon", db: { batch, transaction } } as unknown as DatabaseHandle;
    const statements = [{}, {}, {}] as unknown as PromiseLike<unknown>[];

    await runAtomically(() => statements, handle);

    expect(transaction).not.toHaveBeenCalled();
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch).toHaveBeenCalledWith(statements);
  });

  it("on the Neon driver: a failing batch rejects (nothing is retried or split)", async () => {
    const batch = vi.fn(async () => {
      throw Object.assign(new Error("boom"), { code: "23505" });
    });
    const handle = { driver: "neon", db: { batch } } as unknown as DatabaseHandle;

    await expect(runAtomically(() => [{} as PromiseLike<unknown>], handle)).rejects.toThrow("boom");
    expect(batch).toHaveBeenCalledTimes(1);
  });

  it("on the Neon driver: no statements means no request", async () => {
    const batch = vi.fn(async () => []);
    await runAtomically(() => [], { driver: "neon", db: { batch } } as unknown as DatabaseHandle);
    expect(batch).not.toHaveBeenCalled();
  });

  it("on drivers with transactions: one transaction, statements run in order", async () => {
    const log: string[] = [];
    const tx = {};
    const transaction = vi.fn(async (fn: (tx: unknown) => Promise<void>) => fn(tx));
    const batch = vi.fn();
    const handle = { driver: "pglite", db: { transaction, batch } } as unknown as DatabaseHandle;

    await runAtomically(() => [statement("first", log), statement("second", log)], handle);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(batch).not.toHaveBeenCalled();
    expect(log).toEqual(["first", "second"]);
  });

  it("builds the statements with the transaction executor, not the outer db", async () => {
    const tx = { tag: "tx" };
    const handle = { driver: "postgres", db: { transaction: async (fn: (t: unknown) => Promise<void>) => fn(tx) } } as unknown as DatabaseHandle;
    let seen: unknown;

    await runAtomically((executor) => {
      seen = executor;
      return [];
    }, handle);

    expect(seen).toBe(tx);
  });
});
