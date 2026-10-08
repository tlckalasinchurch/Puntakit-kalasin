---
description: Run real checks and freeze a workflow candidate
argument-hint: <slug> <ticket-id>
---

# `/test <slug> <ticket-id>`

Arguments: `$ARGUMENTS`. Require exactly a safe feature slug and ticket identifier.

Confirm the approved ticket exists and the implementation is complete. Determine the
next round number under `.ai/workflow/features/<slug>/rounds/` (start at `round-1`).
Run the repository's real validation commands, independently recording the command,
exit code, and relevant output:

- `pnpm check`
- `pnpm test`
- `pnpm build`

If a command is unavailable or fails, record `FAIL` and the real reason; never replace a
failed command with a claim of success. Preserve unrelated user changes.

After validation, write the candidate packet to:

`.ai/workflow/features/<slug>/rounds/round-N/candidate.md`

The packet must include the feature/ticket identity, acceptance criteria, baseline and
candidate commits, `git diff --stat`, the exact validation results, known limitations,
and a complete touched-file list. Treat the packet as frozen after this command: do not
edit source or candidate files again before `/review`.

Do not mark the ticket done and do not commit. A failed validation blocks review unless
the failure is explicitly a known, non-blocking limitation in the packet.
