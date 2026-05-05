# Brand Layout Ops

This repo is the extracted product kernel for the browser-native operator-graph direction.
Reference app for parity work: local `racoon-anim` clone (path varies by machine)
It is intentionally not the current full app.

It holds the pieces that should survive renderer changes:

- typed document and operator contracts
- graph evaluation runtime
- layout-grid math
- text-layout math
- layout composition kernel

## Architectural position

Treat this like a simplified Houdini for branded layouts and motion scenes:

- layout is one operator family
- field or point generation is another
- SVG or vector instancing is another
- compositing is another
- preview backends are adapters
- export backends are adapters

The long-term rule is simple:

- no layout semantics inside Three.js
- no print semantics inside the preview runtime
- no monolithic app-level geometry rules

## Start Here

If you are resuming work in a fresh chat, read this first:

1. `STATUS.md` — cold-start handoff with current state

For deeper context:

2. `TODO.md` — architecture, parity audit, active tasks
3. `ROADMAP.md` — long-term vision
4. `HISTORY.md` — completed work archive
5. `INBOX.md` — async user notes (agent drains on session start)
6. `AGENT-INBOX.md` — agent-only handoffs and diagnostics awaiting triage
7. `docs/specs.md` — linked specs and external reference paths

Agent behavior rules are in `.github/copilot-instructions.md`.

If the task is parity-related, inspect these comparison sources next:

- Reference app behavior and presets in `racoon-anim`: `src/app/config-schema.js`, `default-config-source.js`, `editor-constants.js`, `index.js`
- Reference motion and halo-field rendering in `racoon-anim`: `src/app/rendering.js`, `halo-field.js`
- Reference content and assets in `racoon-anim`: `assets/content.csv`, `content-speaker-highlight.csv`, `UbuntuTagLogo.svg`, `racoon-mascot-face.svg`, `racoon-mascot-halo.svg`
- Current preview implementation: `apps/overlay-preview/src/main.ts`, `apps/overlay-preview/src/document-workspace.ts`, `apps/overlay-preview/src/preview-document.ts`, `apps/overlay-preview/src/preview-document-bridge.ts`, `apps/overlay-preview/src/sample-document.ts`, `apps/overlay-preview/src/sample-motion.ts`
- Current layout and motion kernels: `packages/operator-overlay-layout/src/index.ts`, `packages/layout-engine/src/index.ts`, `packages/operator-orbits/src/index.ts`, `packages/operator-spokes/src/index.ts`

## Local Preview

There is now a browser preview shell for parity work.

Run:

```bash
npm run preview:dev
# equivalent alias:
npm run dev
```

That starts a Vite app at `apps/overlay-preview/` which currently:

- evaluates the overlay-layout operator graph in the browser
- renders the selected document scene family in the live stage, with halo on the Three.js path and phyllotaxis, fuzzy-boids, and scatter on dedicated scene-family preview canvases
- supports text and logo selection, double-click text editing, drag snapping, guide toggling, and CSV or inline content switching
- surfaces the main operator document controls from an operator parameter schema instead of only from preview-local hardcoded controls
- includes left and right snapped resize handles for selected text fields, a first-baseline guide, and staged CSV apply or discard controls
- persists local `.brand-layout-ops.json` documents through the shared overlay document metadata/state envelope plus shared scene-family and per-format `project` metadata, with CSV-draft extras layered on top and legacy preview-file compatibility retained
- lets the Formats dialog add or delete saved document formats, add common sizes from a built-in preset list, and edit the document scene-family metadata instead of treating the active screen size as only transient preview state
- uses the selected document scene family in the live stage and composed-frame export path, with phyllotaxis, fuzzy-boids, and scatter rendered through richer family-specific canvas preview passes while halo keeps the Three.js renderer
- exports composed PNG stills, inclusive PNG sequences, and dev-only MP4s from the File menu; the MP4 path snapshots the current persisted preview document, renders a temporary PNG sequence headlessly, and encodes it through the existing FFmpeg script with optional fades
- treats local documents as the source of truth for working state; browser-local preset storage is no longer supposed to seed a new session's working document

Other useful local checks:

```bash
npm run typecheck
npm run demo:overlay-layout
npm run demo:copy-to-points
npm run demo:orbits
npm run demo:spokes
```

## Packages

- `@brand-layout-ops/core-types`: shared contracts and data payloads
- `@brand-layout-ops/graph-runtime`: minimal deterministic graph evaluator
- `@brand-layout-ops/layout-grid`: baseline-grid and column-grid resolution
- `@brand-layout-ops/layout-text`: wrapping and placement math using a provided measurer
- `@brand-layout-ops/layout-engine`: scene-level layout composition for branded overlay content
- `@brand-layout-ops/operator-overlay-layout`: graph-facing overlay composition operator plus shared overlay defaults and document-schema primitives, including document-owned scene-family graphs and background-chain persistence
- `@brand-layout-ops/operator-copy-to-points`: Houdini-style point instancing with propagated attributes for later Three.js and SVG backends
- `@brand-layout-ops/operator-orbits`: coarse orbit-ring point-field generator for motion-side rebuild work
- `@brand-layout-ops/operator-phyllotaxis`: golden-angle point-field generation matching the current Houdini phyllotaxis HDA logic
- `@brand-layout-ops/operator-scatter`: scatter-point generation inside ellipse, rect, rounded-rect, or polygon-style SVG path boundaries
- `@brand-layout-ops/operator-spokes`: coarse spoke-band point-field generator for motion-side rebuild work
- `@brand-layout-ops/operator-ubuntu-summit-animation`: coarse scene-family operator boundary for the full non-reusable Ubuntu Summit parity port, including mascot and full animation timeline state
- `@brand-layout-ops/overlay-interaction`: snapped text/logo drag math for operator-facing overlay editing
- `@brand-layout-ops/parameter-ui`: small DOM helpers for operator-facing control surfaces in preview apps

## Live Status

Current implementation state intentionally lives in `STATUS.md` and `TODO.md`, not in the README. Use the status file for the cold-start snapshot and the TODO for the active execution queue.

## Later additions

- field generator operators
- SVG instancing operators
- Canvas/WebGL/Three preview adapters
- SVG export backend
- PDF/EPS print backend
- CMYK intent and mapping pipeline

See `docs/architecture.md` and `docs/future-backends.md`.

## Documentation & Agent Workflow

This repo uses a standardized root-file workflow designed for AI-assisted development. The rules are codified in `.github/copilot-instructions.md`.

### Canonical workflow files

| File | Purpose | When to update |
|------|---------|----------------|
| `INBOX.md` | Inbox — user drops async notes | Agent drains at session start |
| `AGENT-INBOX.md` | Agent inbox — machine handoffs and diagnostics | Agent drains at session start |
| `STATUS.md` | Cold-start handoff for a new chat | Every session |
| `TODO.md` | Active plan, architecture, parity audit | When tasks/gaps change |
| `ROADMAP.md` | Long-term 5-stage vision | Rarely |
| `HISTORY.md` | Completed work archive | When tasks complete |
| `docs/specs.md` | Linked specs and external reference paths | When source paths change |

`INBOX.md` is for user-authored notes. `AGENT-INBOX.md` is for machine-generated handoffs, diagnostics, and cross-repo follow-ups.

### LLM efficiency notes

- Pick one model per task. Switching models mid-session often forces a full context reprocess.
- Keep permanent instructions short. Durable rules belong in `.github/copilot-instructions.md`; one-off context belongs in the active task or prompt.
- Keep project memory in the repo, not only in chat. `STATUS.md`, `TODO.md`, `HISTORY.md`, and `docs/specs.md` are the cheap recovery path.
- Prefer markdown, plain text, and small verified reads over giant context dumps.
- Search iteratively, then confirm against the owning file or reference repo.
- Checkpoint and restart freely when a session gets noisy rather than trying to drag a bloated context forward.

### Recommended workflow

1. **Start a new chat** → read `STATUS.md`, drain `INBOX.md`, drain `AGENT-INBOX.md`, read `TODO.md`.
2. **During work** → make code changes, run `npm run typecheck` to verify.
3. **After completing a task** → update `TODO.md` (mark done), move completed items to `HISTORY.md`, update `STATUS.md` if current state changed.
4. **Commit** with area prefix: `halo: add fold seam alpha`, `ui: accordion sections`, `docs: update sprint TODO`.
5. **End of session** → verify `STATUS.md` reflects where you stopped. Ensure `INBOX.md` and `AGENT-INBOX.md` are empty.

### Copying to another project

1. Create `.github/copilot-instructions.md` in the repo.
2. Optionally create `.github/agents/agent.md` for repo-specific resume guidance.
3. Create `README.md`, `ROADMAP.md`, `TODO.md`, `INBOX.md`, `AGENT-INBOX.md`, `STATUS.md`, `HISTORY.md`, and `docs/specs.md`.
4. Delete any other TODO/status/handoff files. These canonical files are the maximum.