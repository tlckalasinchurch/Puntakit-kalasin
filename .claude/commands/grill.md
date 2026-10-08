---
description: Stress-test a feature idea and save the agreed design tree
argument-hint: <slug>
---

# `/grill <slug>`

The argument is the feature slug: `$ARGUMENTS`. Reject a missing or unsafe slug.

Use the existing `grill-me` skill, which delegates to the existing `grilling` skill. Do
not create a new interview skill and do not edit application code. Continue the decision
tree until the user and agent reach shared understanding; do not silently resolve
architecture or business-rule decisions.

After the interview, write only the agreed outcome to:

`.ai/workflow/features/<slug>/GRILL.md`

The file should contain the settled problem, decisions, constraints, unresolved items
(if any), and the agreed test seams. It must not contain chat commentary or invented
approval. If any material decision remains unresolved, leave it explicit and stop before
`/spec`.
