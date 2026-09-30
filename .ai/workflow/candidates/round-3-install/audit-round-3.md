VERDICT: REVISE
The twice-failed structural read-only claim is genuinely and completely eliminated from every live file, so the third-occurrence REJECT rule does not fire; but this round's replacement snapshot control hashes the snapshot file mid-append and therefore reports a delta on every round, voiding each round by its own rule.

FINDINGS

```
[MAJOR] .ai/WORKFLOW.md:58 (with :61-62 and :170-171) — the pre/post snapshot diff is guaranteed non-empty even when the auditor writes nothing
TRIGGER:  Any round run per steps 4 and 6. `git ls-files --others --exclude-standard .ai` lists `.pre-audit.txt` itself, and the result is appended to that same file with `>>`. `sha256sum` therefore hashes the snapshot in its partial, status-only state. Proven in this round's artifact: `.pre-audit.txt:38` records `c50f4369d16f2ec5f913677fd902bfc09518dc4d92e77213eb1e818ec347452d` for itself, while the file's actual content hashes to `85bceeae51ebc7c78b22a7c315cf6dc831634e9f280d4e2411921a727a033dee`. My recompute of all 11 covered paths returns exactly one mismatch, line 9c9, and it is that self-hash. The post capture adds a second and third delta, since redirection creates `.post-audit.txt` before `git status --untracked-files=all` and `git ls-files` scan, so both sections gain a line absent from the pre file.
EFFECT:   `.ai/WORKFLOW.md:170-171` states a non-empty diff voids the round regardless of the verdict. Every round self-voids. The operator either discards valid verdicts forever or learns to ignore the diff, which disables the only enforcement mechanism installed to replace the false structural claim. The round-1 and round-2 defect was a control weaker than advertised; this is a control that cries wolf on 100% of invocations, with the same end state of no real enforcement.
FIX:      exclude the snapshot pair from both sections of both captures, in .ai/WORKFLOW.md:57-61
  git status --short --untracked-files=all | grep -v '\.p\(re\|ost\)-audit\.txt$' > .ai/workflow/candidates/<round-slug>/.pre-audit.txt
  sha256sum $(git ls-files --others --exclude-standard .ai | grep -v '\.p\(re\|ost\)-audit\.txt$') <touch-set files outside .ai> >> .ai/workflow/candidates/<round-slug>/.pre-audit.txt
  # identical two lines for .post-audit.txt, then plain diff of the two files
  and at :65-67 restate the disclosed gap as "the snapshot pair is excluded by name; every other file inside .ai/ is covered".
VERIFY:   run both captures around a round in which nothing is written; `diff .pre-audit.txt .post-audit.txt` exits 0 with no output. Then append one byte to any covered file and rerun; the diff is non-empty and names that file.
```

```
[MINOR] .ai/workflow/candidates/round-3-install/candidate.md:30-31 — the touch-set table omits a file written inside this round's window
TRIGGER:  Line 30-31 states "Round 1 and round 2's files (both moved source documents, both rounds' `candidate.md`/`audit-round-N.md`) are unchanged this round." `.ai/workflow/candidates/round-2-install/audit-round-2.md` carries mtime 2026-09-22 20:31 (+07), inside the round-3 window of 20:31 to 20:33 established by `CLAUDE.md` at 20:31, `.ai/WORKFLOW.md` at 20:32 and both round-3 files at 20:33. That file necessarily post-dates round 2's audit, since it contains round 2's verdict; it cannot have been "unchanged this round" in the sense the sentence asserts.
EFFECT:   Round 2's MINOR prescribed "a before hash for every path touched". The transcription step at WORKFLOW.md:172 legitimately creates this file, but it appears in no touch-set row, so the one path this round created outside the table has no before-state and no declared provenance. Mitigated: `.pre-audit.txt:36` does hash it at `968b75965901bdf43965382c2fb5d86ca9703442665c9079e19c7a90e7f1b14e`, which reproduces, and its text matches the verdict I read.
FIX:      candidate.md:30-31, add a row: "| new file | `.ai/workflow/candidates/round-2-install/audit-round-2.md` | n/a (verbatim transcription of round 2's verdict, WORKFLOW.md step 7) | 968b7596... |" and narrow the blanket sentence to the four files it is true of.
VERIFY:   every path whose mtime falls inside the round window appears in the touch-set table.
```

```
[NIT] .ai/WORKFLOW.md:90 — bare "read-only" label survives in the state-machine diagram
TRIGGER:  Line 90 reads "AUDIT  (Auditor role: fresh Agent, security-reviewer, model=opus, read-only)". Every qualified statement elsewhere was corrected this round; this label was not.
EFFECT:   None on a reader who reaches lines 36 to 72 or line 113, both now correct. This is not a recurrence of the twice-failed finding: it asserts no structure, no guarantee, no enforcement, and the file's authoritative section forty lines above contradicts any absolute reading. Recorded so the determination is explicit rather than silent.
FIX:      line 90, "model=opus, does not edit the candidate".
VERIFY:   grep -nEi "read[- ]?only" .ai/WORKFLOW.md CLAUDE.md returns no matches.
```

OUT OF SCOPE, NOTICED
- `.gitignore` still has no `.ai/` entry, flagged in rounds 1 and 2 and unchanged; the next `git add -A` commits every packet and verdict.
- `CLAUDE.md` remains LF in a tree git converts to CRLF; the warning prints on every `git diff`. Pre-existing.
- `CLAUDE.md:48` is now roughly 120 characters against a block wrapped near 90, a side effect of the in-place wording replacement.

NOT APPLICABLE, fleet-specific material explicitly skipped rather than force-fitted
- Appendix A hazard register, n8n workflow and node hazards, Telegram parse-mode rules, SSH worker-node session and Job Object semantics, S4U and session-0 scheduled tasks, PowerShell 5.1 remote-host encoding and quoting. This repo is one Vite/Express project with no remote hosts, no gateway, no messaging egress. Lens 2 reduces to the snapshot self-reference above, Lens 3 to the line-ending note. Lens 4 has no surface: no test file was touched this round and none was weakened. Tiered T1 per instruction.

VERIFIED / ASSUMED / UNVERIFIABLE
- verified: the structural claim is gone from every live file. `grep -rn -i structural .ai CLAUDE.md` returns 19 hits; exactly one is a live claim-bearing line, `.ai/WORKFLOW.md:45`, which is the prohibition itself. `CLAUDE.md` returns zero. Fifteen hits sit in round-1, round-2 and round-3 `candidate.md` / `audit-round-N.md` files quoting the finding, which is the expected historical record. The remaining two are unrelated incidental usages inside the verbatim source documents, `gemini_38_flash_high_runbook.md:291` on schema validity and `opus_4_6_public_blueprint.md:654` on a scope-guard hazard; neither concerns auditor write capability and editing either file would itself be a scope violation.
- verified: no reworded equivalent. Sweeps for guarantee, cannot write, unable to write, enforced by, impossible, absolute, sandbox, no write access return only `.ai/WORKFLOW.md:44` "not an absolute sandbox", :45 the prohibition, :72 "not through a claim about what the auditor's tools make impossible", and :150 about session freshness. All four are the honest form. The single unqualified survivor is the NIT at :90.
- verified: the honesty section at `.ai/WORKFLOW.md:36-72` names `Bash` as granted and write-capable, enumerates redirection, `sed -i`, `git checkout`, `git commit`, calls the grant a strong default and not an absolute sandbox, routes enforcement to an external recompute, and discloses the snapshot self-hash gap at :65-67.
- verified: `.ai/WORKFLOW.md:31` now reads "A reviewer subagent whose defined grant excludes `Write` and `Edit`" and :113 reads "(strong default plus the external pre/post hash diff, see above)".
- verified: the corrected status command gives full per-file coverage. Plain `git status --short` yields 20 lines with the `.ai/` tree collapsed to 1. `--untracked-files=all` yields 29 lines with 10 distinct `.ai/` paths. `git ls-files --others --exclude-standard .ai` returns the same 10.
- verified: the touch-set table's before values match round 2's own `.pre-audit.txt` exactly, `29d81ab7ed3101600041bb2d709cb85ab419ea988fc5405c6a5eb5784b687cc4` for `.ai/WORKFLOW.md` and `3446723f656814b6e486e113c2740dc0f113e40562e7c5aa50fe479efc900a58` for `CLAUDE.md`. Both after values reproduce today, `b2e599d959b2ed3435e1e3580332718850f0be7af0d13a45fe8dd79c9d893ff5` and `caf8dc974315391b0a8a2f2d9a5d97975050b39d629e51f384c6be1356bb1fa3`, via `sha256sum` under MSYS Git Bash.
- verified: both source documents are still byte-identical across all three rounds, `18f43e2e...` and `ea24e3b8...`, matching round 1's and round 2's recorded values.
- verified: `git diff CLAUDE.md` is still one hunk at `@@ -42,3 +42,15 @@`, `1 file changed, 12 insertions(+)`, zero deletions, all three context lines intact. This round's change is a wording replacement inside the appended "Implement/Audit workflow" block, now reading "an independent Auditor role that does not edit the candidate". No line outside that section was touched in any of the three rounds.
- verified: this round's `candidate.md` contains no imperative directed at me. Round 1's VERIFY grep, round 2's VERIFY grep, a broad sweep for you should, you must, please, ensure, make sure, accept, do not, skip, ignore, assume, and a search for the word should all return zero matches. Nothing to quote.
- verified: `pnpm check` reproduces. `tsc --noEmit`, EXIT_CODE=0, no output, run by me under MSYS Git Bash.
- verified: no file outside the three rounds' documented touch-sets was touched. The 16 pre-existing modified files carry mtimes from 08:05 to 15:28 (+07) and both pre-existing migration files 08:05, all hours before the round-3 window of 20:31 to 20:33. I hold no `Write` or `Edit` tool and issued no write command; my recompute of all 11 covered paths differs from `.pre-audit.txt` in exactly the one self-referential line analysed in the MAJOR.
- assumed: the round-3 window is 20:31 to 20:33 (+07) on 2026-09-22, inferred from mtimes on the files this round created or edited.
- assumed: `.post-audit.txt` would appear in its own `git status --untracked-files=all` and `git ls-files` output as a zero-byte file created by redirection. The MAJOR does not rest on this; the `.pre-audit.txt` self-hash mismatch alone is proven and alone guarantees the non-empty diff.
- unverifiable: the pre-round-3 content of `.ai/WORKFLOW.md` beyond its recorded hash. Round 2's `.pre-audit.txt` anchors the before-state digest, so the scope of this round's edit is now checkable in aggregate but not hunk by hunk, since the file is untracked and `git diff .ai/WORKFLOW.md` is empty.
- unverifiable: that any implementer session ran on `claude-sonnet-5` as `.ai/WORKFLOW.md:15` states. Nothing in the repo records the acting model. My own `model: "opus"` resolved to `claude-opus-5`, which limitation 2 asks each round to reconfirm.

Operator notice, one line: `false-structural-readonly-claim` is resolved and closed at round 3; the REJECT-on-third-occurrence rule did not fire, and this REVISE carries one new MAJOR that has failed zero rounds.

```json
{"verdict":"REVISE","pipeline_result":"FAIL","blockers":0,"majors":1,"minors":1,"nits":1,"scope_violations":0,"tests_weakened":false,"executor_assumed":"bash-MSYS","prior_finding_resolved":"false-structural-readonly-claim-survives","findings":[{"sev":"MAJOR","file":".ai/WORKFLOW.md","line":58,"id":"snapshot-self-hash-guarantees-nonempty-diff"},{"sev":"MINOR","file":".ai/workflow/candidates/round-3-install/candidate.md","line":30,"id":"touch-set-omits-audit-round-2-transcription"},{"sev":"NIT","file":".ai/WORKFLOW.md","line":90,"id":"bare-readonly-label-in-diagram"}]}
```
