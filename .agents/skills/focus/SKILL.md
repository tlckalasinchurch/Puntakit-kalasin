---
name: focus
description: Keep the session on the single agreed task. Restates the task and its limits, edits only what the task needs, preserves unrelated and other people's changes, avoids refactoring, and parks out-of-scope findings instead of fixing them. Use while implementing, editing documents or reviewing, whenever scope drift is a risk.
argument-hint: "[the agreed task]"
---

Work **only** on the agreed task. If the user passed an argument, that is the task; otherwise use the task recorded in `.ai/CURRENT.md`. If neither is clear, ask once, or run `/brief`.

## Before editing

1. Restate the task in one sentence, with what "done" looks like and what is **out of scope**.
2. Run `git status --short` and note every change that already exists. Treat each one as someone else's work unless `.ai/CURRENT.md` says it belongs to this task.
3. Re-read the standing prohibitions in `.ai/CURRENT.md` and `.ai/HANDOFF.md`. If the task would break one, stop and tell the user instead of working around it.

## While working

- Touch the fewest files that finish the task. Match the style of the surrounding code or document.
- **Preserve what exists:** never run `git reset`, `git checkout -- <file>`, `git restore`, `git clean`, `git stash drop`, or overwrite a file you did not create without reading it first. Never revert another person's change.
- **No drive-by work:** no refactors, renames, formatting sweeps, dependency changes or "while I'm here" fixes. Write each out-of-scope finding on a short list (file, what, why it matters) and report it at the end; fix it only if the user asks.
- If the work reaches architecture, security, permissions, schema or business logic that the task did not name, **stop and ask**. Reversible visual or wording details: propose a default with the reason.
- Do not invent numbers, results or facts. If something cannot be checked, write `NOT VERIFIED` and say what would verify it.

## When finishing

List the files you changed against the files you expected to change. Explain any difference. Report the checks you actually ran with their results, and the checks you did not run. Then suggest `/wrap`.
