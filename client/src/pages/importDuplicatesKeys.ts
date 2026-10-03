/**
 * Pure helpers behind the duplicate-review cards. They live outside the React
 * file so the rules that stop stale form state can be unit-tested (the client
 * test environment has no DOM).
 *
 * The rule: a form that holds row ids in its state must be remounted whenever
 * the set of rows it was built for changes, otherwise it keeps submitting ids
 * from an earlier import.
 */

type RowRef = { sourceRowId: string };
type KeyedCandidate = {
  members: ReadonlyArray<RowRef>;
  decisions: ReadonlyArray<{ id: string }>;
};

/** Identity of the compared rows: same rows (in any order) give the same key. */
export function rowSetKey(members: ReadonlyArray<RowRef>): string {
  return members
    .map((m) => m.sourceRowId)
    .sort()
    .join("|");
}

export function decisionPanelKey(candidate: KeyedCandidate): string {
  return `${candidate.decisions[0]?.id ?? "none"}#${rowSetKey(candidate.members)}`;
}
