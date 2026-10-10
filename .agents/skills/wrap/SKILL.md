---
name: wrap
description: Wrap up the work done in this session. Summarizes changes, tests, verification, blockers and remaining risks from real command output, then updates the project memory files (.ai/CURRENT.md, .ai/DECISIONS.md, .ai/CHANGELOG.md). Use when a meaningful chunk of work is finished or a durable decision was made; run before /handoff.
disable-model-invocation: true
argument-hint: "[optional note about what was done]"
---

Close out the work and keep the project memory accurate. Facts come from tools, not from recollection.

## 1. Gather facts

Run `git status --short`, `git diff --stat`, `git branch --show-current`, `git log -1 --oneline`. Note which uncommitted changes belong to this session and which were already there or belong to someone else (`.ai/CURRENT.md` lists the known ones).

## 2. Summarize (in the user's language — Thai in this project)

- **Changes:** exact file paths, one line each.
- **Checks:** each check as `command → result`. A check that was not run is listed as **not run**, never as passed.
- **Blockers and risks:** what is unresolved, what is unverified (`NOT VERIFIED`), what could be wrong.
- **Decisions:** only durable ones — a choice someone would otherwise have to re-derive or re-ask.
- **Open questions:** with where each is recorded.

## 3. Update project memory — smallest accurate change

- `.ai/CURRENT.md` — rewrite it to the true present: branch, commit, uncommitted changes, latest completed work, blockers, and the **exact next action**. Replace stale lines; do not append history there.
- `.ai/DECISIONS.md` — add one row per new durable decision (date, decision, status, rationale, source). If a decision already lives in an ADR or plan, **link it, do not copy it**.
- `.ai/CHANGELOG.md` — add an entry only for a significant completed change, with its verification result and what is still unverified.
- Native auto memory: if you learned a durable preference or correction from the user, save it through the memory system (one fact per file, index line in `MEMORY.md`). Never save what the repository already records.

## Rules

- **Do not commit, push, stage, merge or deploy.** Never write "committed", "pushed", "deployed" or "verified in production" unless a command in this session proved it.
- **No secrets** (API keys, passwords, tokens, personal data) in any memory file.
- Keep the files short. Memory is for durable knowledge, not a transcript.
- Do not touch files that are not yours (see the list in `.ai/CURRENT.md`).

Finish by telling the user which memory files changed and suggesting `/handoff` if the session is ending.
