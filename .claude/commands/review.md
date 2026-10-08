---
description: Audit the frozen candidate with the repository's independent review loop
argument-hint: <slug>
---

# `/review <slug>`

The argument is the feature slug: `$ARGUMENTS`. Reject a missing or unsafe slug.

Read `.ai/WORKFLOW.md` and locate the latest frozen candidate under
`.ai/workflow/features/<slug>/rounds/round-N/`. Refuse to review a missing packet or a
packet whose validation section is incomplete.

Before spawning the auditor, capture the external pre-audit snapshot required by
`.ai/WORKFLOW.md`: `git status --short --untracked-files=all` plus SHA-256 hashes of
every file in the candidate touch set. Exclude only the snapshot file itself. Spawn a
fresh `Agent` with `subagent_type: security-reviewer` and `model: opus`. The auditor
must have no Write/Edit tools, must read `opus_4_6_public_blueprint.md` and the frozen
candidate, and must review the actual diff rather than the implementer's narrative.

After the auditor returns, capture the matching post-audit snapshot and compare it. Any
change to the candidate or touch set voids the round regardless of the verdict. Copy the
verdict verbatim to:

`.ai/workflow/features/<slug>/rounds/round-N/audit-round-N.md`

Use the verdict state machine from `.ai/WORKFLOW.md`:

- `ACCEPT` or `ACCEPT-WITH-NITS`: update only that ticket's status to `done` after the
  verdict is recorded.
- `REVISE` or `REJECT`: keep the ticket approved, return to `/implement`, and use the
  next round number.
- `CANNOT-REVIEW`: supply the missing evidence and do not count the round as a pass or
  fail.

Do not call the existing `code-review` skill as a second closing path. Do not commit or
push from `/review`; commit only after an accepted round.
