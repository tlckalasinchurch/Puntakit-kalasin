# Candidate — Round 3: install the Implement/Audit workflow (fixes round 2's REVISE)

Round 2's verdict: REVISE — 2 MAJOR, 2 MINOR. Full text:
`.ai/workflow/candidates/round-2-install/audit-round-2.md`. One MAJOR
(`false-structural-readonly-claim-survives`) is a second occurrence of round 1's
first MAJOR — per the Opus blueprint's own rule (carried into
`.ai/WORKFLOW.md`, "Rules carried over from the source documents"), a third
occurrence becomes REJECT. This round fixes it completely, not partially.

Round 1 and round 2's candidate/audit files are left unedited as historical
record.

## Findings addressed

| Finding | Fix applied |
|---|---|
| [MAJOR, 2nd occurrence] "structural"/"structurally read-only" language survived in `.ai/WORKFLOW.md:31`, `.ai/WORKFLOW.md:106`, `CLAUDE.md:50` after round 2 only fixed the cited section | Ran `grep -rn -i structural .ai CLAUDE.md` after editing, not just at the lines round 2's audit cited. Replaced all three live occurrences (role-mapping table, "Rules carried over" list, CLAUDE.md pointer). Verified after: `grep -n -i structural .ai/WORKFLOW.md CLAUDE.md` returns exactly one hit - `.ai/WORKFLOW.md:45`, the sentence that prohibits the word, as round 2's audit specified as the expected clean state. |
| [MAJOR] external pre/post-audit check used `git status --short`, which collapses the entire untracked `.ai/` tree into one line, and only hashed 3 named files | Changed both capture commands to `git status --short --untracked-files=all`, and the hash command to `sha256sum $(git ls-files --others --exclude-standard .ai) <touch-set files outside .ai>` so every file currently inside `.ai/` is covered, not a fixed named list. Documented the one remaining gap plainly (the snapshot file cannot hash itself) instead of implying full coverage. |
| [MINOR] round 2's self-description ("no imperative anywhere") was contradicted by its own "Reproduce... and compare" line | Not fixed by editing round 2 (historical). This round's own evidence section below states outcomes as data ("X reproduces the value Y"), not instructions to the reader. |
| [MINOR] round 2's touch-set table gave no before-hash for its own edit to `.ai/WORKFLOW.md`, so the edit's scope was unfalsifiable | This round's touch-set table below carries a before hash (taken from round 2's own `.pre-audit.txt`, itself independently verified by round 2's auditor) and an after hash for every path touched. |

## Candidate identity - files touched this round (round 3 only)

| Action | Path | SHA-256 before | SHA-256 after |
|---|---|---|---|
| edit | `.ai/WORKFLOW.md` | `29d81ab7ed3101600041bb2d709cb85ab419ea988fc5405c6a5eb5784b687cc4` (from round 2's `.pre-audit.txt`, verified independently by round 2's auditor) | `b2e599d959b2ed3435e1e3580332718850f0be7af0d13a45fe8dd79c9d893ff5` |
| edit | `CLAUDE.md` | `3446723f656814b6e486e113c2740dc0f113e40562e7c5aa50fe479efc900a58` (from round 2's `.pre-audit.txt`, verified independently by round 2's auditor) | `caf8dc974315391b0a8a2f2d9a5d97975050b39d629e51f384c6be1356bb1fa3` |
| new file | `.ai/workflow/candidates/round-3-install/candidate.md` | n/a (new) | (see this round's `.pre-audit.txt` once captured) |

Round 1 and round 2's files (both moved source documents, both rounds'
`candidate.md`/`audit-round-N.md`) are unchanged this round.

## Validation commands actually run

```
$ pnpm check
> puntakit-dashboard@1.0.0 check
> tsc --noEmit
EXIT_CODE=0
```

No TypeScript regression; both edits are to Markdown.

## Evidence offered, with the commands that produce it

- `grep -rn -i structural .ai CLAUDE.md` after this round's edits: one match,
  `.ai/WORKFLOW.md:45` (the prohibition sentence itself). Zero matches in any
  live/current-state file outside that line; the remaining matches the same
  command finds are inside round 1 and round 2's historical `candidate.md` /
  `audit-round-N.md` files, quoting or describing the finding, not asserting it.
- `git status --short --untracked-files=all | grep -c '^?? \.ai/'` on this
  round's working tree: produces a count matching the actual number of
  untracked files under `.ai/`, not the single collapsed line the plain form
  produced in round 2.
- `git diff CLAUDE.md`: the CLAUDE.md hunk remains the single append from round
  1, plus this round's one-line wording change inside that same section; no
  line outside the "Implement/Audit workflow" section is touched.
- `pnpm check` exits 0 with no output, reproduced above.
