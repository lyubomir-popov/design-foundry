# Design-Foundry pivot

**Status:** rename complete (2026-05-23). Folder, GitHub origin remote, npm package scope (`@design-foundry/*`), persisted format identifiers (`*.df.json` + `kind: "df.document"` / `"df.operator-presets"`), browser storage keys (`df-*` / `df:*`), prose mentions across all 6 workspace repos, peer `.code-workspace` files, and TypeScript build all migrated. `npm run typecheck` is clean at the new path.

**Outstanding follow-ups (informational, not blocking):**

- The private git remote `l` (currently `git@176.58.120.91:/home/git/repos/brand-layout-ops.git`) was deliberately NOT renamed because it points at a user-controlled server that needs a server-side rename first. After renaming the server-side path, run: `git remote set-url l git@176.58.120.91:/home/git/repos/design-foundry.git`.
- `STATUS.md`, `ROADMAP.md`, `TODO.md` were string-renamed only. They still describe the pre-pivot product surface (overlay-preview app, format-switching demo, etc.). They have NOT yet been rewritten against the Houdini-spirit kernel reframing. That rewrite is the next planning task.
- pnpm workspace promotion at `H:\WSL_dev_projects\` (option A topology) is parked. Current state: npm workspaces inside this repo only; cross-repo deps still use `file:../baseline-foundry`-style local paths. See §6 below.
- The reframing itself (kernel architecture, package layout, render pipeline, text-shape WASM, CRDT state) is documented but NOT yet implemented. Code is still the pre-pivot product surface, just renamed.

This document is the single source of truth for the pivot. Every other repo in `H:\WSL_dev_projects\` carries a pointer to this file in its `AGENT-INBOX.md`. Cold-start agents in any repo MUST read this file before making structural decisions.

---

## 1. Decision summary

| | Before | After |
|---|---|---|
| Repo name | `brand-layout-ops` (a.k.a. "BLO") | `design-foundry` (a.k.a. "DF") |
| GitHub remote | `git@github.com:lyubomir-popov/brand-layout-ops.git` | `git@github.com:lyubomir-popov/design-foundry.git` |
| Package scope | `@brand-layout-ops/*` | `@design-foundry/*` |
| Persisted doc kind | `"brand-layout-ops.document"` | `"df.document"` |
| Persisted preset kind | `"brand-layout-ops.operator-presets"` | `"df.operator-presets"` |
| Persisted file extension | `*.brand-layout-ops.json` | `*.df.json` |
| Self-image | "operator-graph product kernel" | "Houdini-in-spirit procedural graphic-design kernel" |

The short identifier inside persisted data formats (`df`) is deliberately **decoupled from the package name** so that any future rename does not break user files again.

## 2. Vision (the moonshot)

Houdini-in-spirit graphic-design kernel for one person + agents. Graphic design is the central tenet; everything else (print, video, web, IDML, draw.io) is an adapter / render target. Long-term aim: a viable Penpot challenger, succeeding where Penpot's Clojure choice limits them.

**The kernel is the data graph + DAG runtime + operator interface.** Everything else is plug-in.

```
Schema (typed data graph)
   ↓
Graph runtime (DAG eval, incremental, memoized)
   ↑ extended by
Operator libraries  ← autolayout, print-grid-snap, copy-to-points,
                      force-directed, ELK, text-shape, spec-validator,
                      viewport / infinite-canvas
   ↓ produce
Post-layout IR (display list: flat list of typed primitives, absolute coords, stable IDs)
   ↓ consumed by
Render adapters  ← SVG, Canvas2D, WebGL/WebGPU, vector PDF, HTML+CSS,
                   draw.io, IDML, video keyframes
   ↓
Shell apps  ← editor, batch CLI, preview server, designer-app
```

## 3. Tech-stack decisions

| Concern | Decision | Notes |
|---|---|---|
| Core language | **TypeScript** | Agent productivity is decisive. WASM escape hatch for hot paths. |
| Hot paths | TS first; **WASM (Rust/Zig) only when profiled** | Module boundaries designed so a hot operator can be swapped without API change. |
| Text shaping | **harfbuzzjs (HarfBuzz WASM) + opentype.js / fontkit for metrics** | Wrapped in `@design-foundry/text-shape`. One package, all consumers. Do NOT write a shaper. |
| Line breaking | Knuth–Plass via `linebreak.js`; **Hyphenopoly** for hyphenation | Layered above shaping. |
| Editor canvas | SVG ≤5k nodes → Canvas2D mid-tier → WebGL/WebGPU large | Renderer interface canvas-agnostic from day 1. No DOM assumptions inside operators. |
| Post-layout IR | **Flat display list** (Skia/Flutter/PDF pattern), one `group` primitive for nesting | Diff-able, snapshot-testable, serializable. Lives in `@design-foundry/render-ir`. |
| Print PDF | **Native vector via pdf-lib (sRGB)** as the default path. | CMYK is a 10% case; extension seam in renderer for color-space later (pdf-lib extension or switch print job to PDFKit). |
| Long-form prose (whitepapers, books) | **Optional HTML/CSS adapter → Paged.js / Prince** | Add when prose-heavy multi-page needs hurt; not before. Browser typography for the hard cases (justification, footnotes, hyphenation across pages). |
| State shape | CRDT-friendly (immutable, op-log, stable IDs) from day 1 | Multiplayer is a future concern but the shape costs nothing now. Override log in `document-schema` already follows this. |
| Schema versioning | Version field + migration runner from day 1 | `document-schema` already has `version: 1`. |
| Plugin sandbox | Web Workers with typed message protocol; QuickJS-WASM if true sandbox needed later | No `eval()`. |
| Desktop | **Tauri** when needed; Linux pro-DTP space is wide open | Avoid Electron. Defer. |
| Monorepo tooling | **Multi-repo + pnpm workspace overlay at `H:\WSL_dev_projects\`** | Each repo stays its own git repo (multi-repo). A single `pnpm-workspace.yaml` at the parent directory provides `workspace:*` symlinks across repos — this is a convenience layer, not a monorepo. Chosen because repos have different ownership trajectories: some may transfer to Canonical, others are personal/sandbox. A true monorepo would make selective repo transfer painful (git history splitting). The pnpm overlay doesn't affect git at all. |
| Publish channel | **GitHub Packages (private scope)** when external versioning needed | Free for private. Local dev does not need it. |

## 4. Package layout (current + planned)

### Existing in this repo (rename `@brand-layout-ops` → `@design-foundry`)

- `core-types`
- `document-schema` *(Phase 1 — extend to support autolayout frame primitive when porting diagram-generator's engine)*
- `graph-runtime` *(Phase 3 — generic edge validation already extracted)*
- `layout-engine`
- `layout-grid` *(Phase 2a — unit-agnostic `grid-core.ts` already extracted, byte-identical parity with a4)*
- `layout-text`
- `overlay-interaction`
- `parameter-ui`
- `operator-copy-to-points`
- `operator-fuzzy-boids`
- `operator-halo-field`
- `operator-orbits`
- `operator-overlay-layout`
- `operator-phyllotaxis`
- `operator-scatter`
- `operator-spokes`
- `operator-ubuntu-summit-animation`

### Anchor packages to create next (stubs only; full impl deferred)

- **`render-ir`** — flat display list types + `Renderer<T>` interface. No implementation yet. Forces the discipline that operators produce IR, renderers consume IR.
- **`text-shape`** — harfbuzzjs wrapper. Minimal API: `shape(font, text, opts) → ShapedRun`. Pins the choice early.

### Future ports (do NOT build now)

- **`operator-autolayout`** — port from `diagram-generator/packages/layout-engine` once that repo's TS refactor lands AND the design-foundry kernel (render-IR, operator-kernel contract) is ready to receive it. The port is a relocation + thin adapter, not a re-implementation. See §5 `diagram-generator` for the no-double-work guarantee.
- **Renderers:** `render-svg`, `render-canvas`, `render-pdf`, `render-drawio`, `render-html-css` (long-form), `render-idml`, `render-video-keyframes`. Add as consumers need them.
- **`operator-viewport`** — "infinite canvas / Figma-style pan-zoom" as a single operator producing a viewport-transformed display list.

## 5. Cross-repo plan

### `design-foundry` (this repo, formerly `brand-layout-ops`)
- Host the kernel and all shared packages.
- Continue using the overlay-preview app as the working editor; renderer interface (display list) goes in there first.
- Naming: `df` short identifier for any new persisted format, attribute prefix, or short label.

### `a4-generator`
- Stays. Becomes a consumer of `@design-foundry/document-schema`, `@design-foundry/layout-grid/core`, `@design-foundry/render-ir`, `@design-foundry/text-shape`.
- `.a4doc.json` extension is already package-name-decoupled; keep it.
- **Open question to revisit:** an `@design-foundry/render-html-css` adapter (Paged.js → PDF) for prose-heavy multi-page documents. The algorithmic baseline-locked engine stays for datasheets / spec sheets / cover-grade work. Hybrid model.
- AGENT-INBOX must carry a pointer to this PIVOT doc.

### `diagram-generator`
- Stays a sibling repo. No merger into any other repo is planned.
- Existing TS `packages/layout-engine` is the Figma-grade autolayout (HUG/FILL/FIXED, 9-point align, two-pass measure/place, parity with Python). It is the most advanced layout engine in the workspace. Continue iterating it in place.
- Eventually ports into design-foundry as `@design-foundry/operator-autolayout` when (a) diagram-generator's refactor is stable and (b) the design-foundry kernel (render-IR + operator-kernel contract from K4) is ready to receive it.
- **No-double-work guarantee:** design-foundry does NOT build its own autolayout implementation. There is exactly one autolayout codebase (`diagram-generator/packages/layout-engine/`). At port time the code is relocated (moved or workspace-linked) into `design-foundry/packages/operator-autolayout/` and wrapped in a thin adapter that conforms to the operator-kernel contract. Until that moment, design-foundry has zero autolayout code.
- Public function signatures of `layout-engine` are the de-facto interface for the eventual operator port. Keep them stable when convenient; if they shift, record it in `diagram-generator/HISTORY.md` so the porting agent knows.

### `canonical-spacing-spec`
- Stays a sibling spec repo. It is the canonical source for spacing / grid / type-scale specifications and feeds multiple consumers (a4-generator, baseline-foundry, design-foundry, diagram-generator, etc.).
- No structural change from the design-foundry pivot. Specs continue to be authored here and read by consumers.
- Possible future admin change: GitHub ownership of this repo may be transferred to the user's organization account. That is a remote/permissions change with no impact on local paths, code, or architecture.

### `baseline-foundry`
- Stays. Peer to design-foundry. Continues as the CSS/tokens shell library consumed by design-foundry apps (already a `file:` dep in this repo's `package.json`).
- Multi-root `.code-workspace` reference will switch from `../brand-layout-ops` to `../design-foundry`.

### `agent-workflow-kit`
- Tooling only. Unaffected by package rename. AGENT-INBOX gets a pointer to this doc as a courtesy.

## 6. Done so far (in this repo, pre-rename)

- ✅ Phase 1: `document-schema` package (unit-agnostic, schema versioned, JSON Schema artifact).
- ✅ Phase 2a: `layout-grid/core` extracted with byte-identical parity vs `a4-generator` rigorous grid (`scripts/verify-grid-core-parity.ts`).
- ✅ Phase 3: `graph-runtime/edge-validation` covering all 10 EdgeValidationCode cases (`scripts/verify-edge-validation.ts`).

These artifacts move with the rename (package scope becomes `@design-foundry/*`).

## 7. Sequence after rename completes

Numbered for cold-start agents. Tick as we go.

1. [ ] **`render-ir` package stub** — types only (`DisplayListItem`, `Renderer<TArtifact>`, `Viewport`, `Paint`, `Stroke`, `ShapedRun`, `Mat3`, `PathCommands`, `AssetRef`, `ImageFit`). One `group` primitive for nesting. No implementation. Used as anchor for the next renderer-bearing package.
2. [ ] **`text-shape` package stub** — minimal `shape(font, text, opts) → ShapedRun[]` signature backed by `harfbuzzjs`. Single test: shape "Ag" in a default font, assert non-zero advance width and two glyphs.
3. [ ] **Pivot existing overlay-preview rendering to consume display list** via a small adapter inside `apps/overlay-preview`. One section at a time. The `SvgRenderer` lives next to its consumer for now; promote to `@design-foundry/render-svg` once a second consumer needs it.
4. [ ] **Switch root from npm workspaces to pnpm workspaces at `H:\WSL_dev_projects\`** with a top-level `pnpm-workspace.yaml` enumerating all relevant package locations across the six repos. Verify each repo still typechecks. Set up `workspace:*` aliases where applicable.
5. [ ] **Defer until diagram-generator's TS refactor lands in canonical-spacing-spec:** port `@diagram-generator/layout-engine` into design-foundry as `@design-foundry/operator-autolayout` with parity test against the in-place engine. Update `document-schema` to add the autolayout frame primitive as a first-class node kind alongside the absolute-frame primitive.
6. [ ] **Defer:** `operator-viewport` (infinite canvas).
7. [ ] **Defer:** `render-pdf` (sRGB-only via pdf-lib).
8. [ ] **Defer:** `render-html-css` (Paged.js path for a4-generator prose-heavy docs).

## 8. Naming + identifier conventions (lock these now)

- **Package scope:** `@design-foundry/*`.
- **Short identifier (persisted data, file extensions, attribute prefixes):** `df`. Examples: `*.df.json`, `"kind": "df.document"`, `data-df-node-id="..."`, `df:` URI scheme if ever needed.
- **In-prose abbreviation:** "DF" or "design-foundry". Avoid "BLO" and "brand-layout-ops" in all new prose.
- **Avoid embedding the package name in any persisted artifact ever again.**

## 9. Pointers expected in every peer repo

Each peer repo's `AGENT-INBOX.md` carries this paragraph near the top:

> **DESIGN-FOUNDRY PIVOT (2026-05-23):** `brand-layout-ops` has been renamed `design-foundry` and reframed as the Houdini-in-spirit kernel monorepo for the workspace. This repo will consume `@design-foundry/*` packages and follow the architecture documented in `../design-foundry/PIVOT.md`. Read that file before making structural decisions here.

## 10. Open questions parked for later

- ~~Exact pnpm workspace root layout~~ — **resolved:** single `pnpm-workspace.yaml` at `H:\WSL_dev_projects\` (option A). Multi-repo topology stays; pnpm is a dependency-linking convenience layer only. Rationale: repos have different ownership trajectories (some may transfer to Canonical, some won't). A true monorepo would block selective transfer.
- Whether `operator-overlay-layout` should split into `operator-grid-resolve` + `operator-layout-place` once the autolayout port lands and the dual-primitive schema settles.
- Whether `parameter-ui` belongs in design-foundry or moves to baseline-foundry as a shell-level concern.
- Whether `baseline-foundry` ultimately becomes `@design-foundry/shell` or stays a peer repo.
- Eventual publish channel choice if external contributors materialise: GitHub Packages vs npm public scope.
