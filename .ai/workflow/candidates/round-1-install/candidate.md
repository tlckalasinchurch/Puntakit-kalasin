# Candidate — Round 1: install the Implement/Audit workflow

## Requirements and acceptance IDs (from user request)

- A1: Gemini has its own instruction and uses the Gemini Runbook.
- A2: Opus has its own instruction and uses the Opus Blueprint.
- A3: The two roles are not mixed together.
- A9: The system still respects the host's instruction hierarchy and security
  boundary.
- (A4-A8, A10 concern *running* the workflow, not this installation round, and are
  addressed by `.ai/WORKFLOW.md`'s state machine and this round's live test below.)

## Baseline identity

- Repo: `puntakit-dashboard`, branch `feat/groups-foundation`.
- Baseline `git status --short` before this round had 16 pre-existing modified
  files (unrelated groups-feature work in progress) and 2 pre-existing untracked
  files (`server/db/migrations/0003_acoustic_eddie_brock.sql`,
  `server/db/migrations/meta/0003_snapshot.json`). None of these were touched by
  this round.

## Candidate identity - files touched this round

| Action | Path | Note |
|---|---|---|
| moved, byte-identical | `Gemini_38_flash_high_runbook.md` -> `.ai/gemini_38_flash_high_runbook.md` | SHA-256 before: `18f43e2e35a00f21db1e1d5a0fba6a6fb73390485e1cf12796f9a2f35acc8cf3`. After: identical. |
| moved, byte-identical | `OPUS_4_6_PUBLIC_BLUEPRINT.md` -> `.ai/opus_4_6_public_blueprint.md` | SHA-256 before: `ea24e3b822e0203413130a350f8a30675b471e95096532e1b12e6fff769cced6`. After: identical. |
| new file | `.ai/WORKFLOW.md` | Orchestration wrapper: role mapping, state machine, disclosed limitations. |
| new dir | `.ai/workflow/candidates/round-1-install/` | This freeze packet's own location. |
| edit, append-only | `CLAUDE.md` | Added one new section ("## Implement/Audit workflow", 12 lines) at end of file. No existing line changed. `git diff --stat CLAUDE.md` -> `1 file changed, 12 insertions(+)`. |

No other files were modified by this round.

## Validation commands actually run

```
$ pnpm check
> puntakit-dashboard@1.0.0 check
> tsc --noEmit
EXIT_CODE=0
```

Establishes: the CLAUDE.md edit and new `.ai/` files introduced no TypeScript
regression. Does not establish: runtime behavior, since no runtime code was
touched (this round is documentation/file-org only).

`pnpm test` was not run for this round: the round touches no test files and no
source under test (only Markdown and one append to a Markdown instruction file).

## Known limitations / disclosed to the auditor

1. Neither original document's target model is literally available in this
   environment (no Gemini CLI; no model literally named "Claude Opus 4.6"). See
   `.ai/WORKFLOW.md` under "What this environment actually is" and "Known
   limitations" for the full disclosure - do not re-derive this, verify it against
   that file's stated facts.
2. `.ai/opus_4_6_public_blueprint.md`'s Appendix A (fleet hazard register) and
   Windows-fleet-specific sections (SSH worker nodes, n8n, Telegram, scheduled
   tasks) describe a different deployment than this single-repo project. They do
   not apply here and should not be forced onto this review.
3. This round's own "Implementer" work was performed by the main Claude Code
   session (not a delegated subagent), because the task is small, single-owner,
   and entirely within one file-move + two file-writes + one append - the Gemini
   runbook's own delegation gates (section 2.1) do not favor delegation for this
   shape of work ("one mechanical tool call, known shell command, small file
   read, or straightforward transformation" -> DIRECT).

## What the auditor should actually check

- Do `.ai/gemini_38_flash_high_runbook.md` and `.ai/opus_4_6_public_blueprint.md`
  match the SHA-256 hashes claimed above for byte-identical preservation (re-hash
  them yourself; do not trust the claimed hashes).
- Does `CLAUDE.md` contain only an append, with no existing line altered (check
  the diff yourself).
- Does `.ai/WORKFLOW.md` accurately disclose the substitution (no literal Gemini,
  no literal Opus 4.6) rather than implying the real named models are in use.
- Is the auditor's own tool grant (from `security-reviewer` + `model: opus`)
  actually free of `Write`/`Edit` - confirm from your own available tools, not
  from this packet's claim.
- Any scope creep: were any of the 16 pre-existing modified files, or the 2
  pre-existing untracked migration files, touched by this round? (They should not
  be - check `git status --short` yourself.)
