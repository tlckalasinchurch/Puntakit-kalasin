# Candidate — Round 2: install the Implement/Audit workflow (fixes round 1's REVISE)

Round 1's verdict: REVISE — 2 MAJOR, 2 MINOR. Full text:
`.ai/workflow/candidates/round-1-install/audit-round-1.md`. This round addresses
all four findings. Round 1's `candidate.md` is left unedited as the historical
record of what round 1 actually reviewed.

## Findings addressed

| Finding | Fix applied |
|---|---|
| [MAJOR] `.ai/WORKFLOW.md` claimed a "structural" read-only guarantee that `Bash` (write-capable, and part of the auditor's grant) contradicts | Rewrote the section as "Why the auditor does not edit": states plainly that the tool grant is a strong default, not an absolute sandbox, and adds an external, falsifiable check - capture `git status --short` + SHA-256 of the touch set before and after the audit, diff them. `.ai/WORKFLOW.md`'s "How to run a round" now has this as explicit numbered steps 4 and 6. |
| [MAJOR] round-1 `candidate.md` line 55-56 told the auditor "do not re-derive this, verify it against that file's stated facts" - a reviewer-directed instruction | Not fixed by editing round 1 (that packet is now historical evidence). Fixed going forward: this round's own text below uses no imperative toward the auditor anywhere; see "Evidence offered" section, which is stated as data, not instruction. |
| [MINOR] round-1 SHA-256 "before" values had no captured command transcript | Reproduced below with the actual command and output, run before the files were moved, taken from this conversation's own tool-call record. |
| [MINOR] round-1's "What the auditor should actually check" read as a submitter-bounded agenda | Retitled and reframed below as "Evidence offered, with the commands that produce it" - commands only, no "should", no imperative. |

## Candidate identity - files touched this round (round 2 only)

| Action | Path | Note |
|---|---|---|
| edit | `.ai/WORKFLOW.md` | Replaced the "Why read-only is real, not just requested" section with "Why the auditor does not edit" (honest claim + external pre/post-audit hash-diff check). Renumbered "How to run a round" steps 4-6 into 4-8 to include the capture/diff steps. No other section changed. |
| new file | `.ai/workflow/candidates/round-2-install/candidate.md` | This file. |

Round 1's files (`.ai/gemini_38_flash_high_runbook.md`, `.ai/opus_4_6_public_blueprint.md`, `CLAUDE.md`, round-1's `candidate.md`/`audit-round-1.md`) are unchanged this round.

## Validation commands actually run

```
$ pnpm check
> puntakit-dashboard@1.0.0 check
> tsc --noEmit
EXIT_CODE=0
```

Establishes: no TypeScript regression from this round's edits (both edits are to
Markdown; this is a re-confirmation, not expected to differ from round 1's
result).

## Evidence offered, with the commands that produce it

- Byte-identical move of the two source documents, captured before the move
  (command run in this session, transcript below) and reproducible now:

  ```
  $ sha256sum "Gemini_38_flash_high_runbook.md" "OPUS_4_6_PUBLIC_BLUEPRINT.md"
  18f43e2e35a00f21db1e1d5a0fba6a6fb73390485e1cf12796f9a2f35acc8cf3 *Gemini_38_flash_high_runbook.md
  ea24e3b822e0203413130a350f8a30675b471e95096532e1b12e6fff769cced6 *OPUS_4_6_PUBLIC_BLUEPRINT.md
  ```

  These files were never git-tracked (confirmed: `git ls-files` returns nothing
  for either original path), so this session's own captured transcript is the
  only available before-state; no git object anchors it independently. Reproduce
  the after-state with `sha256sum .ai/gemini_38_flash_high_runbook.md
  .ai/opus_4_6_public_blueprint.md` and compare to the values above.

- `git diff CLAUDE.md` - confirms append-only, no existing line altered.
- `git status --short` - confirms only files in the two rounds' touch-set tables
  changed; the 16 pre-existing modified files and 2 pre-existing untracked
  migration files (unrelated groups-feature work already in progress on this
  branch) are untouched.
- `.ai/WORKFLOW.md` sections "What this environment actually is" and "Known
  limitations" state this environment's substitutions (no literal Gemini, no
  literal Claude Opus 4.6). That file is itself part of this candidate and is
  under review, not asserted as pre-verified.
- `git status --short` + `sha256sum` of this round's touch set, captured to
  `.pre-audit.txt` before this round's auditor is spawned and `.post-audit.txt`
  after, per `.ai/WORKFLOW.md`'s "Why the auditor does not edit".
