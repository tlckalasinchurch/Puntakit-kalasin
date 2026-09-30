VERDICT: REVISE

Round 1's first MAJOR is not resolved: the false "structurally read-only" claim was deleted only at the exact lines the round-1 audit cited and still stands verbatim in two other places in `.ai/WORKFLOW.md` and once in `CLAUDE.md`, and the external check that replaces it is blind to every file inside `.ai/`.

FINDINGS

```
[MAJOR] .ai/WORKFLOW.md:31, .ai/WORKFLOW.md:106, CLAUDE.md:50 — the false structural read-only claim survives round 1's fix in three locations
TRIGGER: Read the current files. WORKFLOW.md:31 (Auditor row of the role-mapping table): "A **structurally read-only** subagent (tool grant: `Read, Grep, Glob, Bash` — no `Write`, no `Edit`) is spawned fresh for each audit round." WORKFLOW.md:106: "The auditor never edits code (structural, see above) -- source: Opus blueprint 4.6." CLAUDE.md:50: "an independent, structurally read-only Auditor role". The new section at WORKFLOW.md:36-51 is correct and says at line 45 "not an absolute sandbox; do not describe it as a structural guarantee", so the file now contradicts itself, and "see above" at line 106 points at the sentence that forbids the word it uses.
EFFECT: The condition round 1 flagged still holds. `Bash` is in my grant and is write-capable; I confirmed it by running `sha256sum`, `git status`, `git diff` and `pnpm check` this session. A future operator or a smaller reviewer model that reads the role-mapping table or the "Rules carried over, not weakened" list stops there and treats the boundary as enforced. CLAUDE.md is the worst of the three: it is git-tracked, it is the file every session in this repo loads, and round-2 candidate.md:24 explicitly declares it "unchanged this round". The cause is candidate.md:21, "No other section changed" - the fix targeted the cited line range rather than the claim.
FIX:
  WORKFLOW.md:31  replace "A **structurally read-only** subagent"
                  with    "A reviewer subagent whose defined grant excludes `Write` and `Edit`"
  WORKFLOW.md:106 replace "(structural, see above)"
                  with    "(strong default plus the external pre/post hash diff, see above)"
  CLAUDE.md:50    replace "an independent, structurally read-only Auditor role"
                  with    "an independent Auditor role that does not edit the candidate"
VERIFY: grep -n -iE "structural" .ai/WORKFLOW.md CLAUDE.md   (expect exactly one hit: WORKFLOW.md:45, the prohibition itself)
```

```
[MAJOR] .ai/WORKFLOW.md:54 and .ai/workflow/candidates/round-2-install/.pre-audit.txt:1-23 — the replacement control cannot detect a write to any file it is meant to protect
TRIGGER: `.ai/` is untracked and has no `.gitignore` entry, so `git status --short` collapses the entire tree into one line. Verified: `git status --short | grep -c "\.ai"` returns 1, while `git status --short --untracked-files=all | grep "\.ai"` returns 7 paths. Round 2's own two new files, `round-2-install/candidate.md` and `.pre-audit.txt`, do not appear in the prescribed command's output at all. The hash half covers 3 files (`.ai/WORKFLOW.md`, round-2 `candidate.md`, `CLAUDE.md`) and omits `.ai/opus_4_6_public_blueprint.md`, `.ai/gemini_38_flash_high_runbook.md`, and both round-1 files, all four of which candidate.md:24 asserts are unchanged.
EFFECT: An auditor that edited its own instruction document, or that rewrote round 1's historical record, produces an empty `diff .pre-audit.txt .post-audit.txt` and the round is declared valid. The control presented as the honest replacement for the false structural claim is weaker than the claim it replaces was asserted to be, on exactly the files whose integrity the workflow depends on.
FIX:
  WORKFLOW.md:54  git status --short --untracked-files=all > .ai/workflow/candidates/<round-slug>/.pre-audit.txt
  WORKFLOW.md:55  sha256sum $(git ls-files --others --exclude-standard .ai) <touch set outside .ai> >> ...
  WORKFLOW.md:57-58  apply the same two changes to the .post-audit.txt pair
VERIFY: git status --short --untracked-files=all | grep -c '^?? \.ai/'   (expect 7, not 1)
```

```
[MINOR] .ai/workflow/candidates/round-2-install/candidate.md:13,15 — the round's self-assessment of its own text is false
TRIGGER: Line 13 claims "this round's own text below uses no imperative toward the auditor anywhere"; line 15 claims "commands only, no 'should', no imperative". candidate.md:53-54 reads "Reproduce the after-state with `sha256sum .ai/gemini_38_flash_high_runbook.md .ai/opus_4_6_public_blueprint.md` and compare to the values above."
EFFECT: The imperative itself is harmless, it directs toward verification rather than away from it, so round 1's MAJOR pattern did not recur in substance. The defect is the claim-versus-artifact gap (K3) in a submission whose entire subject is honesty about claims: a reviewer who accepts the self-assessment inherits a false premise about a file it is reading anyway.
FIX: candidate.md:53-54, drop the imperative, state it as data: "After-state: `sha256sum .ai/gemini_38_flash_high_runbook.md .ai/opus_4_6_public_blueprint.md` produces the same two values."
VERIFY: grep -nE "^\s*(Reproduce|Compare|Check|Confirm|Run|Verify|Note) " .ai/workflow/candidates/round-2-install/candidate.md   (expect no matches)
```

```
[MINOR] .ai/workflow/candidates/round-2-install/candidate.md:21 — "No other section changed" in .ai/WORKFLOW.md is unfalsifiable from the repo
TRIGGER: `git diff .ai/WORKFLOW.md` returns empty and exits 0 because the file is untracked (`git ls-files .ai/` returns nothing). Round-1 `candidate.md:28` recorded no SHA-256 for `.ai/WORKFLOW.md`, only "new file". `.pre-audit.txt:21` hashes it after round 2's edit. No pre-round-2 state of that file exists anywhere I can reach, so the scope of round 2's single edit cannot be checked, only its result. This is round 1's MINOR about unanchored before-states recurring on a new file.
EFFECT: The one substantive edit of this round is reviewable only as a finished artifact. Corroborated circumstantially: mtimes place `.ai/WORKFLOW.md` at 20:22 and round-2 `candidate.md` at 20:23 (+07), after `audit-round-1.md` at 20:17, while round-1 `candidate.md` (19:52) and both source documents (2026-09-18 01:34) predate the round-2 window.
FIX: candidate.md:21, add the before hash to the Note column, as round 2 did for the source documents: "SHA-256 before this round's edit: <value from the round-1 freeze>; after: 29d81ab7...". Record a hash for every file in every future round's touch-set table at freeze time.
VERIFY: the round-3 packet's touch-set table carries a before hash for every listed path, and `sha256sum` reproduces each one.
```

OUT OF SCOPE, NOTICED
- `.gitignore` still has no `.ai/` entry, unchanged since round 1 flagged it; the next `git add -A` commits every candidate packet and verdict.
- `.pre-audit.txt` cannot hash itself, so a write to the snapshot file is invisible to the mechanism the snapshot implements.
- `CLAUDE.md` remains LF in a working tree git will convert to CRLF; `git diff` prints the warning on every invocation. Pre-existing.

NOT APPLICABLE (fleet-specific, explicitly skipped rather than force-fitted)
- Appendix A hazard register, n8n node and workflow hazards, Telegram parse-mode rules, SSH worker-node session and Job Object semantics, S4U and session-0 scheduled tasks, PowerShell 5.1 remote-host encoding and quoting. This repo is one Vite/Express project with no remote hosts, no automation gateway, no messaging egress. Lens 2 (concurrency) and Lens 3 (portability) reduce to the line-ending note above. Lens 4 (test rigor) has no surface: no test file was touched, none weakened. Tiered T1 per the operator's instruction.

VERIFIED / ASSUMED / UNVERIFIABLE
- verified: `.pre-audit.txt` matches current reality byte for byte. Re-ran `git status --short` (20 lines, identical ordering) and `sha256sum` on all three listed paths; all three digests reproduce, including `29d81ab7ed3101600041bb2d709cb85ab419ea988fc5405c6a5eb5784b687cc4` for `.ai/WORKFLOW.md`. I hold no `Write` or `Edit` tool and issued no write command.
- verified: both source-document hashes reproduce exactly and match round 1's and round 2's claimed values. `18f43e2e35a00f21db1e1d5a0fba6a6fb73390485e1cf12796f9a2f35acc8cf3` and `ea24e3b822e0203413130a350f8a30675b471e95096532e1b12e6fff769cced6`, via `sha256sum` under MSYS Git Bash.
- verified: round 2 did not retroactively edit round 1's packet. Round-1 `candidate.md:55-56` still carries the quoted directive "do not re-derive this, verify it against that file's stated facts" and line 68 still reads "What the auditor should actually check", both exactly as round 1's audit quoted them.
- verified: round 2's candidate contains no directive suppressing auditor verification. The only matches for round 1's VERIFY grep are at candidate.md:13 and :15, where round 1's directive is quoted inside the findings table and attributed to round 1, which is the handling blueprint 4.5 prescribes.
- verified: the SHA-256 "before" transcript now exists at candidate.md:44-48 with the pre-move filenames, and candidate.md:50-52 states plainly that `git ls-files` anchors nothing. Round 1's MINOR on that point is resolved.
- verified: round 1's MINOR on the submitter-set agenda is resolved. Its VERIFY was that the next verdict cite a finding outside any list the packet supplies; both MAJORs above are outside it.
- verified: `pnpm check` reproduces. `tsc --noEmit`, EXIT_CODE=0, no output, run by me under MSYS Git Bash.
- verified: `git diff --stat CLAUDE.md` is still `1 file changed, 12 insertions(+)`, a pure append at `@@ -42,3 +42,15 @@`, unchanged from round 1.
- assumed: round-1 `candidate.md` and `audit-round-1.md` are byte-identical to what round 1 produced. No hash was recorded for either; content spot-checks and mtimes (19:52 and 20:17, both before the round-2 window) are the available evidence.
- unverifiable: the pre-round-2 content of `.ai/WORKFLOW.md`, per the fourth finding. I can confirm what it says now, not what round 2 changed to make it say that.
- unverifiable: that round 2's implementer session ran on `claude-sonnet-5` as `.ai/WORKFLOW.md:15` states. Nothing in the repo records the acting model. My own `model: "opus"` resolved to `claude-opus-5`, which is what limitation 2 asks each round to reconfirm.

Operator notice, one line: MAJOR finding `false-structural-readonly-claim` has now failed one REVISE round; per blueprint 4.6 a third verdict carrying it becomes REJECT with restart guidance.

```json
{"verdict":"REVISE","pipeline_result":"FAIL","blockers":0,"majors":2,"minors":2,"scope_violations":0,"tests_weakened":false,"executor_assumed":"bash-MSYS","findings":[{"sev":"MAJOR","file":".ai/WORKFLOW.md","line":31,"id":"false-structural-readonly-claim-survives"},{"sev":"MAJOR","file":".ai/WORKFLOW.md","line":54,"id":"external-check-blind-to-untracked-ai-tree"},{"sev":"MINOR","file":".ai/workflow/candidates/round-2-install/candidate.md","line":13,"id":"false-self-assessment-no-imperative"},{"sev":"MINOR","file":".ai/workflow/candidates/round-2-install/candidate.md","line":21,"id":"workflow-md-edit-scope-unanchored"}]}
```
