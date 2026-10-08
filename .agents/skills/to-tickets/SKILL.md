---
name: to-tickets
description: "Break a local feature spec into tracer-bullet tickets with explicit blocking edges."
disable-model-invocation: true
---

# To Tickets

Break `.ai/workflow/features/<slug>/SPEC.md` into vertical, tracer-bullet tickets and
write the result to `.ai/workflow/features/<slug>/TICKETS.md`. This skill is local-only:
do not publish issues or call an external tracker.

The command caller supplies a feature slug. Reject missing or unsafe slugs. Stop if the
feature spec is missing. Use the project's domain vocabulary and respect its ADRs.

## Ticket rules

- Each ticket is a narrow but complete path through every layer it needs.
- Each ticket is independently demoable or verifiable.
- Keep each ticket small enough for one fresh implementation context.
- Put prefactoring before the ticket that relies on it.
- Record only genuine blockers in `Blocked by`.
- Every ticket starts with `Status: draft`.
- Valid status transitions are `draft` → `approved` → `done`; `/implement` may start
  only when the target ticket is exactly `Status: approved`.
- This local file is the source of truth; do not create one issue file per ticket.

## Output format

Write one `TICKETS.md` containing this structure:

```markdown
# Tickets: <feature slug>

Source: SPEC.md

## TICKET-001: <short title>

**What to build:** <end-to-end user-visible behavior>

**Blocked by:** None (can start immediately)

**Status:** draft

### Acceptance criteria

- [ ] <observable criterion>
- [ ] <observable criterion>

### Test seam

<public interface and behavior to verify>

## TICKET-002: <short title>

**What to build:** ...

**Blocked by:** TICKET-001

**Status:** draft

### Acceptance criteria

- [ ] ...
```

Do not put architecture decisions that are absent from the spec into a ticket. If the
breakdown depends on an unresolved decision, stop and report it instead of guessing.
After writing, ask the user to review granularity and blocking edges before changing any
status to `approved`.
