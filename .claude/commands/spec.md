---
description: Turn a grilled feature into a local SPEC.md
argument-hint: <slug>
---

# `/spec <slug>`

The argument is the feature slug: `$ARGUMENTS`. Reject a missing or unsafe slug.

Confirm `.ai/workflow/features/<slug>/GRILL.md` exists and has no unresolved material
decision. Then invoke the local `to-spec` skill. It must synthesize the conversation,
GRILL.md, and the codebase into:

`.ai/workflow/features/<slug>/SPEC.md`

Do not publish an issue, call an external tracker, edit application code, or create a
second spec elsewhere. If requirements or test seams are ambiguous, stop and report the
missing decision.
