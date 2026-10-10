---
name: brief
description: Start-of-session briefing for this project. Reads the project instructions, current status and handoff, verifies the real git state against the notes, then states the current task, the standing constraints and the exact next action. Use when starting or resuming work, or when asked "where are we".
allowed-tools: Read Grep Glob Bash(git status *) Bash(git log *) Bash(git branch *) Bash(git diff *) Bash(git worktree list)
---

Brief the user on where the project stands **before any change is made**. This skill is read-only.

## Steps

1. **Read, in this order, only what exists** (`CLAUDE.md` and the files it imports are already loaded — do not re-read them):
   - `.ai/HANDOFF.md` — what the previous session left for this one
   - `.ai/CURRENT.md` — status, branch, blockers, exact next action
   - `.ai/DECISIONS.md` — index of durable decisions (open a decision's source file only if the task touches it)
   - `.ai/PROJECT.md` and the detailed plan named in `HANDOFF.md` — only if the task needs them
2. **Verify, do not trust.** Run `git status --short`, `git branch --show-current`, `git log -1 --oneline` and `git worktree list`. Compare with the state recorded in `.ai/CURRENT.md`. Any difference (new, missing or changed files; a different branch or commit) goes into the brief as a **discrepancy** — the repository wins over the notes.
3. **Use memory, don't guess.** If a recalled memory names a file, function or flag, confirm it still exists before relying on it.
4. **Report, in the user's language (Thai in this project), briefly:**
   - the current task and who agreed to it
   - the standing constraints (quote them from `HANDOFF.md` / `CURRENT.md`; do not paraphrase prohibitions)
   - unresolved questions and blockers, each with where it is recorded
   - the exact next action
   - discrepancies and anything that looks stale
5. **Stop.** Do not start implementing, and do not ask for information the files already answer. Wait for the user to confirm the task unless they already gave an instruction.

## Never

- Never state that something is committed, pushed, deployed or verified in production unless a command in this session shows it.
- Never edit, stage, reset or delete anything while briefing.
