---
description: Break a local feature spec into draft tracer-bullet tickets
argument-hint: <slug>
---

# `/tickets <slug>`

The argument is the feature slug: `$ARGUMENTS`. Reject a missing or unsafe slug.

Confirm `.ai/workflow/features/<slug>/SPEC.md` exists. Invoke the local `to-tickets`
skill to create or update:

`.ai/workflow/features/<slug>/TICKETS.md`

Each ticket must be a complete vertical slice, list genuine blockers, include acceptance
criteria and a public test seam, and start with `Status: draft`. Do not change any ticket
to `approved` yourself. Ask the user to review granularity and blocking edges; the user
must edit the status marker in the file as the external decision gate.
