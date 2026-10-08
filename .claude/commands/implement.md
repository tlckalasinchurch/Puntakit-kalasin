---
description: Implement one approved local workflow ticket
argument-hint: <slug> <ticket-id>
---

# `/implement <slug> <ticket-id>`

Arguments: `$ARGUMENTS`. Require exactly a safe feature slug and ticket identifier.

Invoke the local `implement` skill. Before any code change it must read GRILL.md,
SPEC.md, and TICKETS.md and verify that the exact ticket has `Status: approved`. A chat
message saying “approved” is not sufficient. If the marker is absent, malformed, or the
ticket is blocked, stop without changing code.

Use `tdd` at the agreed seam, and let verification-before-completion and
systematic-debugging trigger normally. Do not invoke `/code-review`, do not mark the
ticket done, and do not commit. Hand off to `/test <slug> <ticket-id>` after the
implementation is ready.
