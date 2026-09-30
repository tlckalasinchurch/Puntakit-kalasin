# Candidate — Round 4: install the Implement/Audit workflow (fixes round 3's REVISE)

Round 3's verdict: REVISE — 1 MAJOR, 1 MINOR, 1 NIT. Full text:
`.ai/workflow/candidates/round-3-install/audit-round-3.md`. Round 3's headline
result: the twice-failed "structural read-only" MAJOR is genuinely and
completely resolved (verified independently by round 3's auditor); the
REJECT-on-third-occurrence rule did not fire. This round fixes the one new
MAJOR round 3 found in the replacement control, plus the MINOR and NIT.

Rounds 1-3's candidate/audit files are left unedited as historical record.

## Findings addressed

| Finding | Fix applied |
|---|---|
| [MAJOR] the pre/post-audit snapshot hashed itself mid-write (`.pre-audit.txt` appending its own future hash to itself via `git ls-files --others` + `sha256sum`), guaranteeing a non-empty diff on every round regardless of whether the auditor wrote anything | Both capture commands in `.ai/WORKFLOW.md` now pipe through `grep -v '\.p\(re\|ost\)-audit\.txt$'` before both the status listing and the `git ls-files`/`sha256sum` step, excluding the snapshot pair by name. Tested for real (not just claimed): captured the snapshot twice in a row with nothing changed in between; `diff` exited 0 with no output. Transcript below. |
| [MINOR] round 3's candidate.md omitted `.ai/workflow/candidates/round-2-install/audit-round-2.md` from its touch-set table, even though that file's mtime falls inside round 3's own working window | Not fixed by editing round 3 (historical). Documented here for the record: `audit-round-2.md` is the verbatim transcription of round 2's verdict, written as the closing step of round 2's own process (per `WORKFLOW.md` step 7) - its mtime falling close to round 3's start is a sequencing artifact of working the rounds back-to-back in one session, not a round-3 edit. `.pre-audit.txt` from round 3 hashed it at `968b75965901bdf43965382c2fb5d86ca9703442665c9079e19c7a90e7f1b14e`, which still reproduces today (see evidence below) - its content is unchanged since round 2. |
| [NIT] `.ai/WORKFLOW.md`'s state-machine diagram still used a bare "read-only" label after every prose claim elsewhere was corrected | Line now reads "model=opus, does not edit the candidate", matching the rest of the document. `grep -nEi "read[- ]?only" .ai/WORKFLOW.md CLAUDE.md` returns no matches (verified below). |

## Candidate identity - files touched this round (round 4 only)

| Action | Path | SHA-256 before | SHA-256 after |
|---|---|---|---|
| edit | `.ai/WORKFLOW.md` | `b2e599d959b2ed3435e1e3580332718850f0be7af0d13a45fe8dd79c9d893ff5` (round 3's after-hash, verified independently by round 3's auditor) | `393fd8bf3421fbe8f4f48ab8ec3f6db8d3d5d1e46f5a8949eb07f77f0017b31d` |
| new file | `.ai/workflow/candidates/round-4-install/candidate.md` | n/a (new) | (see this round's `.pre-audit.txt` once captured) |

`CLAUDE.md` is unchanged this round (no edit was needed for round 3's
findings). Rounds 1-3's files are unchanged this round.

## Validation commands actually run

```
$ pnpm check
> puntakit-dashboard@1.0.0 check
> tsc --noEmit
EXIT_CODE=0
```

## Evidence offered, with the commands that produce it

- `grep -nEi "read[- ]?only" .ai/WORKFLOW.md CLAUDE.md`: no matches, both files,
  reproduced after this round's edit.
- The fixed snapshot mechanism, tested directly rather than asserted: captured
  `git status --short --untracked-files=all | grep -v '\.p\(re\|ost\)-audit\.txt$'`
  plus `sha256sum $(git ls-files --others --exclude-standard .ai | grep -v
  '\.p\(re\|ost\)-audit\.txt$') CLAUDE.md` twice in a row into two separate
  files, with no edits made between the two captures. `diff` of the two files
  exited 0 with no output - the false-positive-on-every-round defect from round
  3 no longer reproduces. The negative case (a real edit between captures
  produces a non-empty diff naming the changed file) was not independently
  re-run this round; it follows directly from `sha256sum` changing whenever
  file bytes change, which is not a workflow-specific claim.
- `.ai/workflow/candidates/round-2-install/audit-round-2.md` reproduces the
  hash round 3's `.pre-audit.txt` recorded for it,
  `968b75965901bdf43965382c2fb5d86ca9703442665c9079e19c7a90e7f1b14e`, confirming
  it has not changed since round 2 despite the touch-set omission in round 3's
  packet.
- `pnpm check` exits 0 with no output, reproduced above.
