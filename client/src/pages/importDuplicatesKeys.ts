import { IMPORT_MERGE_FIELDS, type ImportMergeField } from "@shared/importMerge";

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
  mergePlan: { id: string } | null;
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

export function mergePlanPanelKey(candidate: KeyedCandidate): string {
  return `${candidate.mergePlan?.id ?? "none"}#${candidate.decisions[0]?.id ?? "none"}#${rowSetKey(candidate.members)}`;
}

/** Starting point of a merge-plan form: every field comes from the first row. */
export function defaultMergePlanForm(members: ReadonlyArray<RowRef>): {
  primary: string;
  choices: Record<ImportMergeField, string>;
} {
  const first = members[0]?.sourceRowId ?? "";
  return {
    primary: first,
    choices: Object.fromEntries(IMPORT_MERGE_FIELDS.map((field) => [field, first])) as Record<ImportMergeField, string>,
  };
}
