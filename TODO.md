# TODO

## Objective

Stabilize the post-parity document model around authored format variants without breaking the current saved-file compatibility layer.

Work should now center on:

- `brand-layout-ops` (current workspace)

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
| S1 | Pending | Typed `PointField` graph payload — make point/field data a first-order graph output so generators can feed downstream operators without preview-only glue. |
| S2 | Pending | Point/field generator operator — standalone operator that produces a `PointField` from configurable parameters. |
| S3 | Pending | SVG instancing operator — consumes a `PointField` and stamps SVG instances at each point. |
| S4 | Pending | Compositing/layer-stack operator — ordered composition of background, image, text, and media layers. |
| S5 | Pending | Background and layout composition in one graph — unify overlay layout and background operators into a single document graph. |

### Lane T — Document model cleanup (Stage 3 remaining)

Goal: Finish hardening authored layout state and format-variant model. Cleaner separation of authored vs imported content, same-size authored variants, saved-file schema simplification.

Status: Not started. Deferred until after Lane S groundwork.

## Immediate Next Steps

- **Lane S is next.** Start with S1: typed `PointField` graph payload.
- The first concrete deliverable is making `PointField` (or equivalent typed point/field data) a first-order graph output type in `core-types` and `graph-runtime`, so background operators can produce and consume point fields through the graph instead of preview-only glue.
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

