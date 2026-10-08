---
name: to-spec
description: "Turn the current conversation and feature notes into a local feature specification."
disable-model-invocation: true
---

# To Spec

Synthesize the current conversation, the feature's `GRILL.md`, and the codebase into a
specification at `.ai/workflow/features/<slug>/SPEC.md`. Do not publish to GitHub,
GitLab, Linear, or any other issue tracker.

The command caller supplies a feature slug. Reject missing or unsafe slugs instead of
inventing a path. Read `.ai/workflow/features/<slug>/GRILL.md` when it exists; if it is
missing, stop and ask the user to run `/grill <slug>` first.

## Process

1. Explore the relevant code and use the project's domain vocabulary. Respect existing
   ADRs and `CLAUDE.md`.
2. Identify the highest useful test seams. Prefer existing public interfaces over new
   seams. If a seam or requirement is ambiguous, stop before writing the spec.
3. Write the spec to the feature folder using the template below. Keep the document
   focused on the requested feature, not hypothetical future work.
4. Preserve the feature slug and do not create files outside its feature folder.

<spec-template>

## Problem Statement

The problem the user is facing, from the user's perspective.

## Solution

The solution, from the user's perspective.

## User Stories

A numbered list of user stories. Each story uses:

1. As an <actor>, I want a <feature>, so that <benefit>

## Implementation Decisions

Decisions about modules, interfaces, architecture, schema, API contracts, and
interactions. Do not include brittle file paths or code snippets unless a state machine,
reducer, schema, or type shape is necessary to preserve a decision.

## Testing Decisions

The public behavior under test, the agreed test seams, the modules to cover, and prior
art in this repository. Tests should verify external behavior rather than implementation
details.

## Acceptance Criteria

A concise checklist of observable, verifiable outcomes.

## Out of Scope

Things explicitly not included in this feature.

## Further Notes

Constraints, risks, or unresolved questions. Do not silently resolve an unresolved
architecture or business-rule decision.

</spec-template>
