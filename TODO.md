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

Lane P is active. Lane R is complete.

### Demo Priority — May 13 lightning talk

Status: Active. The top short-term priority is now a polished format-switching demo artifact for the Ubuntu Summit 26.04 identity. Demo polish and reliability take precedence over new preset or architecture lanes until the slide-ready URL and capture artifact are confirmed.

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

Goal: Stop treating saved sizes as if they were only export targets. The live workflow is already closer to authored per-format variants, so the next pass should make the shell, controller behavior, and terminology match that reality without breaking the current document format.

Status: Active. P1-P6 groundwork is complete, and the first operator-preset slice is landed: Halo now has copy-on-apply preset browsing in Parameters plus a file-backed save path for user presets. Applying a preset reseeds Halo behavior from a known-good preset while preserving the current document's composition adjustments, and later local tweaks persist through ordinary file save.

| Step | Status | Summary |
|------|--------|---------|
| P6 | Complete | Model decision: keep one document as the campaign container, keep fast radio-button switching between authored format variants, and keep export/output recipes separate from those variants. Same-size authored duplicates stay deferred until a concrete workflow need appears. |
| P7 | In Progress | Operator reuse is now copy-on-apply for Halo. The Parameters panel can browse built-in Halo presets, browse saved Halo presets from a file-backed library, apply either as a document-local seed, reset Halo behavior to the current format seed, and save the current Halo settings as a reusable preset. Next: decide whether to lift this into a shared operator-preset library surface and which operator follows Halo. |

## Immediate Next Steps

- **Top priority until May 13:** polish the Ubuntu Summit format-switching demo for the lightning talk. Focus on visible quality, not new architecture.
- Confirm the happy-path save → close → reopen flow on the actual demo machine and browser without depending on the dev-preview `projects/` fallback path.
- Produce one stable browser URL plus a screenshot or short screen recording artifact suitable for the presentation slide.
- Treat further UI cleanup as done unless a demo-blocking issue appears during the actual-machine rehearsal or capture pass.
- **Lane R is complete.** All major interactive paths use localized updates; remaining `buildConfigEditor()` calls are all genuinely structural.
- **Lane P is active.** The first copy-on-apply operator preset slice is landed for Halo and validated.
- **Next:** decide whether the file-backed Halo preset path should become a shared operator-preset library surface, then extend the same copy-on-apply model to the next operator that benefits from reusable seeded behavior.
- Keep the Parameters rail readable while fixes land; do not add new control-surface complexity ahead of the stabilization pass.
- Keep the current breathing and pulsing look stable while simplifying halo controls; do not reopen fine-tuning work unless a concrete regression appears.
- Do not treat cross-document reuse as a document-model problem alone; reusable background-animation and foreground-layout carryover should land as template or preset behavior.
- Keep persisted preview-document snapshots compatibility-keyed by output profile until a deliberate migration is scoped.
- Use the current format-id keyed runtime to pressure-test same-size variants, derivation rules, and active-format restore behavior before changing the disk shape.
- Treat format work as authoring behavior first. Variant switching, derivation, and persistence come before more shell polish or export-recipe work.
- Keep future export work focused on output-operator or preset modeling. The shell parity plumbing for composed PNG, PNG sequence, and dev-only MP4 export is already in place.

## Operational Constraints

- Do not change halo breathing or pulsing behavior just to simplify the radius controls; geometry cleanup must preserve the current motion look.
- Treat UI and state-sync fixes as architecture work, not styling passes. Only take changes that remove real rebuild, synchronization, or ownership hazards.
- Do not re-introduce browser-local preset CRUD as the working-state authority.
- Do not start a saved-file schema rename until the shell and controller behavior settle.
- Keep `baseline-foundry` read-only from this repo unless a shared contract clearly belongs upstream.
- Prefer small validated slices over a one-shot format-system rewrite.

