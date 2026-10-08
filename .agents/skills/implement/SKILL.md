---
name: implement
description: "Implement one approved local workflow ticket without bypassing the audit loop."
disable-model-invocation: true
---

# Implement

Implement one ticket from the local workflow. The command caller supplies
`<slug> <ticket-id>`.

## Mandatory gate

Before touching production code:

1. Read `.ai/workflow/features/<slug>/GRILL.md`, `SPEC.md`, and `TICKETS.md`.
2. Find the exact ticket heading and verify its status is exactly `Status: approved`.
3. If the ticket is missing, ambiguous, blocked, or not approved, stop. Do not infer
   approval from chat context.
4. Check the working tree and preserve unrelated user changes.

## Implementation rules

- Use the existing `tdd` skill at the agreed test seam where the ticket changes code.
- Follow the repository's `CLAUDE.md`, ADRs, and the ticket's acceptance criteria.
- Let `verification-before-completion` and `systematic-debugging` trigger normally.
- Make the smallest change that satisfies the approved ticket; no speculative scope.
- Run focused checks during implementation and record what was actually run.
- Do not call `/code-review`; `.ai/WORKFLOW.md` is the only final audit path.
- Do not commit, push, or mark the ticket done during implementation. The workflow
  commits only after `/review` accepts the frozen candidate.

## Handoff

When implementation is complete, report the changed files, tests/checks run, and any
known limitation. Hand off to `/test <slug> <ticket-id>`. `/test` owns the final
candidate packet and freeze point after it runs the real validation commands; no source
file may change after that freeze.
