import { describe, expect, it } from "vitest";
import { decisionPanelKey, rowSetKey } from "./importDuplicatesKeys";

const rows = (...ids: string[]) => ids.map((sourceRowId) => ({ sourceRowId }));
const candidate = (ids: string[], decisionId: string | null = null) => ({
  members: rows(...ids),
  decisions: decisionId ? [{ id: decisionId }] : [],
});

describe("duplicate review: stale form state", () => {
  it("gives the same key to the same rows in any order", () => {
    expect(rowSetKey(rows("a", "b"))).toBe(rowSetKey(rows("b", "a")));
  });

  it("changes the decision form key when the duplicate-row set changes, even if the decision is unchanged", () => {
    const before = candidate(["a", "b"], "dec-1");
    expect(decisionPanelKey(candidate(["a", "b", "c"], "dec-1"))).not.toBe(decisionPanelKey(before));
    expect(decisionPanelKey(candidate(["x", "y"], "dec-1"))).not.toBe(decisionPanelKey(before));
  });

  it("keeps the key stable when nothing changed, so typing is not lost on a reload", () => {
    expect(decisionPanelKey(candidate(["a", "b"], "d"))).toBe(decisionPanelKey(candidate(["b", "a"], "d")));
  });

  it("still changes with the decision id", () => {
    expect(decisionPanelKey(candidate(["a", "b"], "d1"))).not.toBe(decisionPanelKey(candidate(["a", "b"], "d2")));
    expect(decisionPanelKey(candidate(["a", "b"], null))).not.toBe(decisionPanelKey(candidate(["a", "b"], "d1")));
  });
});
