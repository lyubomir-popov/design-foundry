# Workspace Instructions

## Documentation structure

| File | Role | Who writes |
|------|------|-----------|
| `.github/copilot-instructions.md` | **Rules.** Workflow rules, source precedence, planning rules. | Agent maintains |
| `.github/agents/agent.md` | **Resume agent.** Optional repo-specific continuation prompt. | Agent maintains |
| `README.md` | **Overview.** Project summary and workflow map. | Agent maintains |
| `ROADMAP.md` | **Long-term.** Stages, parity inventory, future directions. | Agent updates rarely |
| `TODO.md` | **Active plan.** Architecture, parity audit, short-term tasks. | Agent updates every session |
| `INBOX.md` | **Inbox.** User drops notes to avoid interrupting agent. | User writes, agent drains |
| `AGENT-INBOX.md` | **Agent inbox.** Long machine-generated handoffs, cross-repo notes, and diagnostics awaiting triage. | Agents / automation write, agent drains |
| `STATUS.md` | **Cold start.** Repo orientation, current state, key files, critical invariants. | Agent updates when state changes |
| `HISTORY.md` | **Archive.** Completed work log. | Agent appends when tasks complete |
| `docs/specs.md` | **Specs.** Concrete linked spec paths and summary. | Agent updates when source paths change |

**No other files should carry TODO lists or duplicated status.** `AGENT-INBOX.md` is the only allowed repo-level overflow channel for machine-to-machine notes, and it must not become a second `TODO.md` or `STATUS.md`. Session-scoped scratch (Copilot `/memories/session/`) is fine for in-progress notes but must not become a parallel tracking system.

## Instruction file scope

Use the two `.github` files for different layers of guidance:

- `.github/copilot-instructions.md` is the stable repo-wide contract. Put workflow rules, planning thresholds, validation expectations, precedence rules, repo boundaries, and instructions that should apply to every future session here.
- `.github/agents/agent.md` is optional and should stay short. Put only repo-specific resume guidance here: what to read first, which code or docs matter most, and any narrow continuation hints that help a fresh agent start quickly.
- If a detail stops being a short resume hint and becomes durable project state, move it into the canonical workflow files instead of expanding `.github/agents/agent.md`.

When deciding where extra detail belongs, use this map:

- Current state or cold-start notes: `STATUS.md`
- Active tasks or architecture notes: `TODO.md`
- Long-term direction: `ROADMAP.md`
- Completed work: `HISTORY.md`
- Source-of-truth references: `docs/specs.md`
- Human-readable overview: `README.md`
- Async user notes: `INBOX.md`
- Agent-to-agent handoffs or long diagnostics: `AGENT-INBOX.md`

## Source-of-truth precedence

When sources disagree, use this order unless a higher-priority source explicitly narrows it further:

1. Linked specs in workspace repos or explicitly referenced source docs
2. `ROADMAP.md`
3. `.github/copilot-instructions.md`
4. `STATUS.md` and `HISTORY.md`
5. `README.md` and `docs/specs.md`
6. `INBOX.md`
7. `AGENT-INBOX.md`
8. Local implementation details that are not clearly intentional or documented

Do not rewrite higher-priority docs to match lower-priority implementation drift.

## Planning threshold

- Small task: act directly.
- Medium task: write a short plan in `STATUS.md` before execution.
- Large / architectural / cross-repo task: create or update a dedicated plan section before making broad changes.

## History rules

- Record completed short-term items under a short-term section.
- Record completed long-term items under a long-term section.
- Move items to history only when actually complete.
- Do not use history as a backlog or scratchpad.

### The inbox pattern

`INBOX.md` is the user write-only channel. `AGENT-INBOX.md` is the machine-generated handoff channel for long agent notes, automation diagnostics that need triage, and cross-repo follow-ups. At session start, the agent must:

1. Read `INBOX.md` and triage each item into `TODO.md` (near-term) or `ROADMAP.md` (longer-term).
2. Read `AGENT-INBOX.md` and triage durable facts into `TODO.md`, `ROADMAP.md`, `STATUS.md`, `HISTORY.md`, or `docs/specs.md`.
3. Empty both files back to their header templates.

If an INBOX item includes bug screenshots or image attachments, follow this fixed order: inspect the referenced images first, implement the fix, present the fix for user confirmation, and only then delete the referenced images.

This lets the user drop thoughts asynchronously without derailing agent work.

### What goes where

| Information | Goes in |
|-------------|---------|
| "What should the next chat do?" | `TODO.md` → Active TODO |
| "Why did we make this architectural decision?" | `TODO.md` → Deviation Log or Architecture notes |
| "What does the product become long-term?" | `ROADMAP.md` |
| "What concrete linked specs govern this repo?" | `docs/specs.md` |
| "What's been done?" | `HISTORY.md` |
| Async user notes | `INBOX.md` |
| Agent-generated handoffs or long machine notes | `AGENT-INBOX.md` |
| "Quick scratch notes for this session only" | `/memories/session/` (Copilot memory) |
| "Key file paths and resume pointers" | `/memories/repo/` (Copilot memory) |

## Agent workflow

### Session start

1. Read `STATUS.md` for orientation.
2. Check `INBOX.md` — triage user items into plan or roadmap, then empty it.
3. Check `AGENT-INBOX.md` — triage machine notes into canonical files, then empty it.
4. Read `TODO.md` for current tasks.
5. Read `docs/specs.md` before changing external-spec-governed behavior.

### During work

- Mark tasks done in `TODO.md` as you complete them.
- Move completed items to `HISTORY.md`.

### Session end

1. Update `STATUS.md` if the current-state paragraph is stale.
2. Update `TODO.md` with any new tasks that emerged.
3. Ensure `INBOX.md` is empty.
4. Ensure `AGENT-INBOX.md` is empty.
5. **Do not** create new markdown files to document changes unless explicitly requested.

## Agent environment rules

- Use foreground VS Code integrated terminals the user can monitor — not background processes or external terminal windows.
- Prefer reusing a small number of visible terminals instead of spawning dozens of throwaway shells for small checks.
- Keep track of the terminals you start and close any that hang, time out, or are no longer needed before finishing the task.

## Commit message discipline

Prefix with the area touched: `halo:`, `ui:`, `grid:`, `docs:`, `types:`, `build:`, `test:`. First line under 72 chars.

## Autonomous continuation rule

If the user explicitly says to proceed autonomously, commit often, or keep working while they are away, treat that as standing approval to keep executing the best available plan without waiting for small confirmations.

In that mode:

1. Work through the current plan until you hit a real blocker, not a minor ambiguity.
2. Make small validated checkpoint commits after substantive chunks instead of piling unrelated work into one large diff.
3. Re-read `TODO.md` after major chunks and periodically re-audit alignment.
4. Update the canonical docs as work lands so the next chat can continue cold.
5. Do not stop just to ask whether to continue unless the next best move is genuinely unclear or risky.

## Cross-repo coordination

When work in one repo creates a dependency or follow-up in another:

1. Drop a machine-generated note in the **target repo's** `AGENT-INBOX.md` describing what changed and what the target repo needs to do. Reserve `INBOX.md` for user-authored notes.
2. Do not attempt the cross-repo change in the same session unless the user explicitly redirects there.
3. Use one agent per repo for feature work. Use one agent across repos only for mirroring convention changes or small coordinated edits.
4. For larger features, prefer sequential single-repo sessions with inbox handoffs over one agent trying to hold multi-repo context.

## Repo boundary

- Work in this repo only unless the user explicitly redirects elsewhere.
- Sibling repos (`racoon-anim`, `baseline-foundry`, `canonical-specs`, `docs-typescale`, `portable-vertical-rhythm`) are read-only references.

## Repo topology (settled)

- **Multi-repo, not monorepo.** Each repo under `H:\WSL_dev_projects\` is its own git repo with its own history. This is deliberate: repos have different ownership trajectories (some may transfer to Canonical, others are personal/sandbox). A true monorepo would block selective repo transfer.
- **pnpm workspace overlay.** A single `pnpm-workspace.yaml` at `H:\WSL_dev_projects\` provides `workspace:*` symlinks across repos. This is a dependency-linking convenience layer — it does not affect git, CI, or repo ownership. Do not confuse this with a monorepo.
- Do not propose merging repos, git subtree imports, or monorepo migrations.

## Non-negotiable architecture rules

- Layout semantics stay out of Three.js and preview adapters.
- Operator packages expose typed I/O; parameter UI reads operator manifests.
- No monolithic app-level geometry rules.
- SVG, PDF, EPS, and CMYK are export-backend concerns only.
- If a canonical rule must survive renderer or preview changes, move it toward shared types, layout kernels, operator outputs, or backend contracts rather than leaving it in `apps/overlay-preview`.

## How to port this convention to another project

1. Create `.github/copilot-instructions.md` in the repo.
2. Optionally create `.github/agents/agent.md` for repo-specific resume guidance.
3. Create `README.md`, `ROADMAP.md`, `TODO.md`, `INBOX.md`, `AGENT-INBOX.md`, `STATUS.md`, and `HISTORY.md` at the repo root.
4. Create `docs/specs.md`.
5. Delete any other TODO/status/handoff files. One user inbox + one agent inbox + one cold-start + one plan + one roadmap + one archive is the maximum.

## Agent file roles

- `.github/copilot-instructions.md` is the single repo-wide instruction file.
- `.github/agents/agent.md` is optional and should contain only repo-specific resume or subagent guidance.
- `.github/agents/agent.md` should not become a second `STATUS.md`, `TODO.md`, or `README.md`; when details grow beyond a short resume prompt, move them into the canonical file for that kind of information.
- Do not duplicate the full workflow rules in both places.

The key insight: every piece of status information lives in exactly one place. If you find yourself writing the same fact in two files, delete one.