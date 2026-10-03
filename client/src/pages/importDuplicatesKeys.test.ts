import { describe, expect, it } from "vitest";
import { IMPORT_MERGE_FIELDS } from "@shared/importMerge";
import { decisionPanelKey, defaultMergePlanForm, mergePlanPanelKey, rowSetKey } from "./importDuplicatesKeys";

const rows = (...ids: string[]) => ids.map((sourceRowId) => ({ sourceRowId }));
const candidate = (ids: string[], planId: string | null = null, decisionId: string | null = null) => ({
  members: rows(...ids),
  decisions: decisionId ? [{ id: decisionId }] : [],
  mergePlan: planId ? { id: planId } : null,
});

describe("duplicate review: stale form state", () => {
  it("gives the same key to the same rows in any order", () => {
    expect(rowSetKey(rows("a", "b"))).toBe(rowSetKey(rows("b", "a")));
  });

  it("changes the merge-plan form key when the duplicate-row set changes, even if plan and decision are unchanged", () => {
    const before = candidate(["a", "b"], "plan-1", "dec-1");
    const afterNewImport = candidate(["a", "b", "c"], "plan-1", "dec-1");
    const afterOtherRows = candidate(["x", "y"], "plan-1", "dec-1");
    expect(mergePlanPanelKey(afterNewImport)).not.toBe(mergePlanPanelKey(before));
    expect(mergePlanPanelKey(afterOtherRows)).not.toBe(mergePlanPanelKey(before));
  });

  it("changes the decision form key when the duplicate-row set changes", () => {
    expect(decisionPanelKey(candidate(["a", "b"], null, "dec-1"))).not.toBe(decisionPanelKey(candidate(["a", "b", "c"], null, "dec-1")));
  });

  it("keeps the keys stable when nothing changed, so typing is not lost on a reload", () => {
    expect(mergePlanPanelKey(candidate(["a", "b"], "p", "d"))).toBe(mergePlanPanelKey(candidate(["b", "a"], "p", "d")));
  });

  it("still changes with the plan and decision ids", () => {
    expect(mergePlanPanelKey(candidate(["a", "b"], "p1", "d"))).not.toBe(mergePlanPanelKey(candidate(["a", "b"], "p2", "d")));
    expect(mergePlanPanelKey(candidate(["a", "b"], "p", "d1"))).not.toBe(mergePlanPanelKey(candidate(["a", "b"], "p", "d2")));
  });

  it("builds the form's starting state from the rows it is given: old set, then new set", () => {
    const old = defaultMergePlanForm(rows("old-1", "old-2"));
    expect(old.primary).toBe("old-1");

    // A remount for the new set starts from the new rows, never from "old-*".
    const next = defaultMergePlanForm(rows("new-1", "new-2", "new-3"));
    expect(next.primary).toBe("new-1");
    for (const field of IMPORT_MERGE_FIELDS) {
      expect(next.choices[field]).toBe("new-1");
      expect(next.choices[field]).not.toMatch(/^old-/);
    }
  });
});
