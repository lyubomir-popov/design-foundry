---
description: "Use when continuing work in the design-foundry repo. Read the repo-wide instructions and canonical docs first, then resume parity, document-model, or authoring-shell work without duplicating status tracking."
---

# Brand Layout Ops Agent

Use this agent when continuing work in `design-foundry`.

## What belongs here

- A short repo-specific resume prompt for future agents.
- The first files to read in this repo.
- Brief continuation hints about the most important work surfaces.
- Narrow repo-specific guidance that would be awkward to place in the generic workflow rules.

Keep this file short enough that reading it at session start is cheap.

## What does not belong here

- Stable workflow rules that apply repo-wide. Those belong in `.github/copilot-instructions.md`.
- Current state, progress notes, or cold-start facts. Those belong in `STATUS.md`.
- Active tasks, decision notes, or architecture notes. Those belong in `TODO.md`.
- Long-term direction. That belongs in `ROADMAP.md`.
- Source-of-truth references. Those belong in `docs/specs.md`.
- User-facing overview text. That belongs in `README.md`.
- Long agent handoffs or diagnostics. Those belong in `AGENT-INBOX.md`.

If this file starts accumulating extra detail, move that detail to the canonical workflow file instead of growing this prompt into a second status document.

## First read

1. `.github/copilot-instructions.md`
2. `STATUS.md`
3. `TODO.md`
4. `ROADMAP.md`
5. `docs/specs.md`
6. `README.md`

## Canonical discipline

- Treat `.github/copilot-instructions.md` as the source of truth for workflow rules and documentation boundaries.
- Keep `.github/agents/agent.md` focused on resume guidance only.
- Keep status in the canonical workflow files: `STATUS.md`, `TODO.md`, `ROADMAP.md`, `HISTORY.md`, `INBOX.md`, `AGENT-INBOX.md`, and `docs/specs.md`.
- Do not create parallel TODO, handoff, or status files.
- Update `STATUS.md` when the current state changes.
- Update `TODO.md` when architecture, parity gaps, active tasks, or deviation-log entries change.
- Move completed items to `HISTORY.md`.
- Update `ROADMAP.md` only when long-term direction changes.
- Drain `INBOX.md` and `AGENT-INBOX.md` at session start.
- If work departs from the listed order, record why in the TODO deviation log.
- Put long machine-generated notes in `AGENT-INBOX.md`, not in this file.

## Working stance

- Follow the active queue in `TODO.md`.
- Keep parity first. Only widen abstractions when they reduce drift or support the emerging layer-stack and authoring-shell direction.
- Keep layout semantics out of preview adapters and Three.js.
- Treat `baseline-foundry` as read-only from this repo unless shared shell or style work clearly belongs upstream.

## Normalization check

If the repo looks unexpectedly dirty across Windows and WSL, inspect first with:

```bash
git status --short
```

- Treat line-ending noise as suspicious until verified.
- Do not discard local changes with destructive git commands unless the user explicitly approves it.
- Prefer non-destructive inspection before any normalization cleanup.

## Reference repo

Use the local `racoon-anim` clone only as the behavior reference for parity checks, not as the place to continue product-architecture work.

## Resume focus

The current work is centered on:

1. Lane P follow-up: authored format variants over the current compatibility persistence shape.
2. Keeping persisted preview-document snapshots compatibility-keyed by output profile until the saved-file redesign is intentional.
3. Using the format-id keyed runtime to evaluate same-size authored variants before widening the saved-file model.
4. Preserving the document-first workflow while shell terminology and behavior keep shifting from targets to formats.