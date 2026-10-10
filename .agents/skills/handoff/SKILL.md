---
name: handoff
description: Produce the end-of-session handoff for this project by writing .ai/HANDOFF.md with the exact branch, commit, uncommitted files, real test results, blockers and the next concrete action. Use when ending a session, after /wrap. Note that a personal skill of the same name can shadow this one.
disable-model-invocation: true
argument-hint: "[what the next session will focus on]"
---

Write `.ai/HANDOFF.md` so a fresh session can resume without being briefed. It replaces the previous handoff (the history belongs in `.ai/CHANGELOG.md`). Keep it **under about 80 lines**.

## Collect (from commands, not memory)

- `git branch --show-current`, `git log -1 --oneline`, `git status --short`, `git worktree list`
- every check run this session, with the exact command and result — or "not run"
- the next concrete action; if the user passed an argument, tailor the next-session focus to it

## Write these sections

1. **Date, branch, HEAD.** If there is no new commit, say "no commit made this session".
2. **Uncommitted changes**, grouped as *this project's work*, *belongs to someone else — do not touch*, and *unknown*. Use exact paths.
3. **Verification:** results with commands. Anything not run or not provable is `NOT VERIFIED`, with what would verify it.
4. **Blockers and open decisions:** one line each, with the file that holds the detail (ADR, plan, note).
5. **Standing prohibitions** carried over from `.ai/CURRENT.md`, quoted, not paraphrased.
6. **Next concrete action**, then the ordered steps after it.
7. **How to resume:** run `/brief` first; list the 3–6 files worth reading, in order.

## Rules

- Point to specs, plans, ADRs and diffs by path. **Do not copy their content.**
- **Never claim** work was committed, pushed, deployed or verified in production unless a command in this session confirmed it.
- No secrets and no personal data. Do not commit or stage anything.
- Make sure `.ai/CURRENT.md` agrees with the handoff; if it does not, update it (or run `/wrap` first).

## If a personal `handoff` skill exists

A user-level skill of the same name takes precedence over a project skill, so `/handoff` may open that one (it writes to the temp directory, not to `.ai/`). If that happens, follow this file by hand instead; do not edit the personal skill.
