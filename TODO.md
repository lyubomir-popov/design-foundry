# TODO

> **Post-pivot (2026-05-23):** this queue now has two tiers. Read [`PIVOT.md`](./PIVOT.md) and [`STATUS.md`](./STATUS.md) before working through it. The "Kernel queue" below is the new top-of-stack; the "Product-surface queue" further down is the existing active backlog (Lane P, etc.) and is unchanged.

## Kernel queue (new, post-pivot)

Source of truth: [`PIVOT.md`](./PIVOT.md). Items are not yet sequenced into formal "lanes"; pick the next one when there is bandwidth for kernel work specifically. Kernel work does NOT block product-surface work and should NOT modify `apps/overlay-preview/` until step K6.

| Step | Status | Summary |
|------|--------|---------|
| K1 | Complete | `@design-foundry/render-ir` package: flat display-list types (Color, Mat3, Paint, Stroke, PathCommands, ShapedRun, AssetRef, ImageFit, Viewport, DisplayListItem union [rect, ellipse, line, path, glyph-run, image, group], DisplayList, Renderer\<T\>). Self-contained — no core-types dependency. |
| K2 | Complete | `@design-foundry/render-svg` package: SVG renderer adapter implementing `Renderer<string>`. Covers all 7 item types (rect, ellipse, line, path, glyph-run, image, group), transforms, clips, corner radii, strokes. `verify:render-ir-svg` harness passes 15 tests including cross-validation against existing svg-overlay-adapter safe-area output. |
| K3 | Complete | `@design-foundry/text-shape` package wrapping harfbuzzjs WASM. `loadFont(data, uri)` → `FontHandle`, `shape(font, text, fontSize, opts)` → `ShapedRun`. Advances scaled from font units by fontSize/upem. `verify:text-shape` passes 5 tests: basic shaping, size scaling, RTL direction, empty string, cluster tracking. |
| K4 | Complete | `@design-foundry/operator-kernel` package: typed operator contract with `InputPort`, `OutputPort`, `ParameterSchema`, sync `evaluate()`, optional `invalidationKey()`, standard `PORT_KIND` constants, and `InputsOf`/`OutputsOf`/`ParamsOf` utility types. No dependencies. `verify:operator-kernel` passes 8 tests. |
| K5 | Complete | `@design-foundry/render-canvas2d` package: Canvas2D renderer adapter for render-ir. Implements `Renderer<void>`, handles all 7 item types, transform mapping, clip paths, stroke dash patterns. `verify:render-canvas2d` passes 13 tests. |
| K6 | Complete | Ported `operator-halo-field` onto `operator-kernel` contract. New `./kernel` export path exposes `haloFieldOperator: OperatorDefinition<HaloFieldInputs, HaloFieldOutputs, HaloFieldConfig>`. Existing exports untouched. `verify:halo-field-kernel` passes 7 tests including cross-validation against direct function calls. |
| K7 | Complete | `@design-foundry/render-pdf` package: sRGB vector PDF renderer via pdf-lib. Implements `Renderer<Promise<Uint8Array>>`, handles rects (incl. non-uniform corners), ellipses, lines, paths (via drawSvgPath), text (Helvetica fallback), groups with opacity. Y-flip coordinate mapping. `verify:render-pdf` passes 10 tests. |
| K8 | Deferred | pnpm workspace promotion at `H:\WSL_dev_projects\` (option A in PIVOT.md §6). Topology decision settled (multi-repo + pnpm overlay); deferred because cross-repo scope, not urgency. |
| K9 | Complete | Port `apps/overlay-preview` rendering to consume `@design-foundry/render-ir`. **K9a:** PointField → DisplayList adapter with per-scene-family style resolvers (phyllotaxis, scatter, boids) + safe-area bars. **K9b:** wired into `scene-family-preview.ts` via opt-in `useKernelRenderer` flag. **K9c:** overlay SVG adapter — guides, text, logos → DisplayList → SvgRenderer; `ShapedRun` extended with `fontFamily`/`fontWeight`; wired into `stage-render-controller.ts` via `useKernelOverlay` flag. 18 adapter tests. **K9d deferred:** halo stays on Three.js — one-off summit operator, already has kernel contract (K6), not a reuse candidate. |
| K10 | Complete | Visual parity validation. 12-test suite (`verify:visual-parity`) cross-validates: adapter style resolvers vs legacy formulas for all 3 scene families (phyllotaxis, scatter, boids); safe-area/guide-grid/text/logo geometry parity vs `svg-overlay-adapter.ts`; cross-renderer consistency (same DisplayList → SVG + Canvas2D + PDF all succeed); full pipeline round-trips (PointField → adapter → all backends); color conversion accuracy. |
| K11 | Backlog | Migrate remaining `packages/operator-*` to `operator-kernel` contract. Retire ad-hoc `OperatorDefinition` in `core-types` once all operators are ported. |

**Cross-repo coordination items (not in this repo's queue, just listed for context):**

- `diagram-generator` continues its in-place refactor. Its `packages/layout-engine/` is the SINGLE source of autolayout code in the workspace and is reserved as the future `@design-foundry/operator-autolayout`. See `../diagram-generator/.github/copilot-instructions.md` top section.
- `canonical-spacing-spec` stays a sibling spec repo (no merger planned). May get its GitHub ownership moved to the user's organization account at some point — admin-only, no local impact.
- **No-double-work guarantee for autolayout:** kernel queue K1–K8 above contains NO step that builds autolayout in this repo. When K4 (operator-kernel contract) and diagram-generator's refactor are both stable, the layout-engine code physically relocates here as `@design-foundry/operator-autolayout` and is wrapped in a thin adapter. Until that moment, autolayout work happens in exactly one place: `diagram-generator/packages/layout-engine/`.

## Product-surface queue (existing, unchanged)

Lane P is still active. Demo work, halo polish, and format-variant authoring all continue as before. The kernel queue above does NOT block this queue.

## Objective

Stabilize the post-parity document model around authored format variants without breaking the current saved-file compatibility layer.

Work should now center on:

- `design-foundry` (current workspace)

The original app remains the reference implementation for behavior and output, not the place to continue product architecture work.

Reference source repo:

- local `racoon-anim` clone (read-only parity reference)

## Working Rules

- This file is the active source of truth for sequencing and status.
- Keep this file operational and short-term. Product shape, architecture, north stars, and open design questions belong in `ROADMAP.md`.
- Completed work belongs in `HISTORY.md`, not in the active queue.
- If priorities change mid-lane, record the new lane here and move displaced long-term thinking back to the roadmap instead of letting TODO turn into a second strategy document.

## Active Execution Queue

Lane S is next. Lanes P and R are complete.

### Demo Priority — May 13 lightning talk

Status: **Closed.** Demo rehearsal completed. Artifacts captured. Remaining post-demo items triaged below.

### Lane O — Stage shell ergonomics

Status: Paused after O1-O3. The shell follow-up did its job; O4/O5 stay deferred until there is a concrete zoom or pan need.

### Lane R — Editor and animation hot-path stabilization

Goal: Pay down the concrete iterative-work risks uncovered in the fresh-eyes audit before adding more control surface or format behavior.

Status: Complete and archived in `HISTORY.md`. Lane R closed after the rebuild audit confirmed all remaining inspector rebuilds are genuinely structural.

| Step | Status | Summary |
|------|--------|---------|
| R1 | Complete | Selected text-style edits and style switches, authoring drag refreshes, grid baseline / safe-area edits, logo lock / size edits, and same-node background connect/disconnect actions all keep their live DOM mounted during routine edits with localized refresh and safe fallback to full rebuild. All remaining `buildConfigEditor()` calls verified as genuinely structural (selection, add/remove, format switching, scene family changes). |
| R2 | Complete | Operator accordion state is tracked per operator group instead of globally. Fallback behavior is explicit: first-section auto-open only runs when a group has no tracked state, and explicitly collapsed groups stay collapsed across group switches. Cross-group accordion state preservation is covered by regression suite. |
| R3 | Complete | Halo-config fingerprints are memoized by config object identity, repeated halo label measurement is cached in the renderer, and mascot asset completion now requests a fresh halo redraw from current stage state instead of replaying a cached scene descriptor. |
| R4 | Complete | Removed duplicate document-format render calls, tightened controller API (removed unused public persistence methods), and created `persistActiveDocumentFormatRuntimeState()` as the canonical shared helper. Format switching, source-default creation, and profile switching all route through the shared helper; no manual persistence choreography remains. |

### Lane P — Format variants and preset groundwork

Status: **Complete.** P1-P7 all landed. Tab-key Add Node menu shipped. Dead config-editor add/family controls removed. Archived in `HISTORY.md`.

### Lane S — Operatorized scene building (Stage 2)

Goal: Make procedural scene composition reusable rather than app-specific. Typed point/field handoff between operators, compositing/layer-stack operator family, swappable scene-family operators.

Status: Not started.

| Step | Status | Summary |
|------|--------|---------|
| S1 | Complete | Typed `PointField` graph payload is now enforced in `graph-runtime`: edge input collection validates source/target port existence, enforces port-kind compatibility, and validates `point-field` payload shape at runtime. New tests cover invalid point-field payloads and port-kind mismatch failures. |
| S2 | Pending | Point/field generator operator — standalone operator that produces a `PointField` from configurable parameters. |
| S3 | Pending | SVG instancing operator — consumes a `PointField` and stamps SVG instances at each point. |
| S4 | Pending | Compositing/layer-stack operator — ordered composition of background, image, text, and media layers. |
| S5 | Pending | Background and layout composition in one graph — unify overlay layout and background operators into a single document graph. |

### Lane T — Document model cleanup (Stage 3 remaining)

Goal: Finish hardening authored layout state and format-variant model. Cleaner separation of authored vs imported content, same-size authored variants, saved-file schema simplification.

Status: Not started. Deferred until after Lane S groundwork.

## Immediate Next Steps

- **Lane S is active.** S1 is complete; continue with S2: standalone point/field generator operator as the next graph-native building block.
- The next concrete deliverable is introducing the dedicated S2 generator operator and wiring at least one graph path that consumes its `pointField` output through typed ports end-to-end.
- Tab-key Add Node menu is shipped and working. The config editor no longer carries dead add/family controls.
- Keep the current breathing and pulsing look stable; do not reopen fine-tuning work unless a concrete regression appears.
- Keep persisted preview-document snapshots compatibility-keyed by output profile until a deliberate migration is scoped.
- Keep future export work focused on output-operator or preset modeling. The shell parity plumbing for composed PNG, PNG sequence, and dev-only MP4 export is already in place.

## May 2026 Audit — Housekeeping

- [x] Archive `HISTORY.md` entries before May 2026 into `docs/archive/2026-early.md`
- [x] Add `tmp/` to `.gitignore` and remove tracked debugging artifacts
- [x] Update README.md "Later additions" — SVG export and field generators already shipped
- [x] Update `docs/future-backends.md` — SVG export shipped
- [x] Update `ROADMAP.md` — mark Stages 0+1 complete, annotate Stage 1.5+3, fix drift signals table
- [x] Triage stale May 13 demo priority section
- [x] Remove stale `projects/` files: HTML snapshots, duplicates, zero-byte artifacts
- [x] Delete stale docs: `audit-document-persistence-2026-05-01.md`, `report-document-persistence-2026-05-05.md`
- [x] Remove dead Formats dialog residue in `preview-shell-controller.ts`
- [x] Fix `verify-ui-regressions.ts` fixture mismatch (uses `video-intro-export.json` vs docs reference `video-intro-export.brand-layout-ops.json`)
- [x] Remove dead `saveOutputFormatKey` persistence stub in `sample-document.ts`

## May 2026 Audit — Architectural

- [x] Consider renaming `operator-overlay-layout` to reflect its actual document-model scope
- [x] Consolidate `contentFormatKey` bridge into the document-variants model (ROADMAP says retired, code still treats as first-class)
- [x] Add unit tests for kernel packages: `graph-runtime`, `layout-grid`, `layout-text`
- [x] Update `docs/architecture.md` to describe the actual app seams, controller structure, and document model

## Operational Constraints

- Do not change halo breathing or pulsing behavior just to simplify the radius controls; geometry cleanup must preserve the current motion look.
- Treat UI and state-sync fixes as architecture work, not styling passes. Only take changes that remove real rebuild, synchronization, or ownership hazards.
- Do not re-introduce browser-local preset CRUD as the working-state authority.
- Do not start a saved-file schema rename until the shell and controller behavior settle.
- Keep `baseline-foundry` read-only from this repo unless a shared contract clearly belongs upstream.
- Prefer small validated slices over a one-shot format-system rewrite.

