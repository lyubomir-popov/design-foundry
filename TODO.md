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

Lane R is active. Lane P is paused while the editor and animation hot paths are stabilized.

### Lane O — Stage shell ergonomics

Status: Paused after O1-O3. The shell follow-up did its job; O4/O5 stay deferred until there is a concrete zoom or pan need.

### Lane R — Editor and animation hot-path stabilization

Goal: Pay down the concrete iterative-work risks uncovered in the fresh-eyes audit before adding more control surface or format behavior.

Status: Active and in progress. The first UI and animation slices are landed: selected text-style edits no longer rebuild the entire Parameters rail, and the animation builder now memoizes halo-config fingerprints instead of serializing the whole config every frame.

| Step | Status | Summary |
|------|--------|---------|
| R1 | In Progress | Selected text-style edits and style switches, the grid section, and the logo section now keep their live DOM mounted during routine edits. Next: remove the same rebuild pattern from the remaining controller-driven add/delete, authoring, and document-target paths that still call `buildConfigEditor()` for ordinary changes. |
| R2 | Next | Replace hidden parameter-pane open-state side effects such as `shouldAutoOpenNextOperatorSection` with explicit, inspectable controller state. |
| R3 | Complete | Halo-config fingerprints are memoized by config object identity, and repeated halo label measurement is now cached in the renderer instead of remeasuring the same label text during the hot render path. |
| R4 | Next | Consolidate profile-scoped persistence writes so format buckets, halo config, and export settings do not depend on scattered manual triple-persist choreography. |

### Lane P — Format variants and preset groundwork

Goal: Stop treating saved sizes as if they were only export targets. The live workflow is already closer to authored per-format variants, so the next pass should make the shell, controller behavior, and terminology match that reality without breaking the current document format.

Status: P1-P5 groundwork is complete and archived in `HISTORY.md`. Lane P is paused while Lane R stabilizes the current editor/control surface and hot animation paths. The next format question is still whether same-size authored variants should become first-class before the saved-file redesign.

| Step | Status | Summary |
|------|--------|---------|
| P6 | Next | Decide whether to unlock same-size authored variants before a saved-file schema change, and if the answer is yes, land the smallest compatibility-safe slice first. |

## Immediate Next Steps

- Continue Lane R1 by removing unnecessary full inspector rebuilds from the remaining controller-driven add/delete, authoring, and document-target paths.
- Keep a separate note on the overlay-visible halo fade / hard drop-off regression. Current live evidence points to the overlay SVG safe-area fill path, not the recent Lane R commits, so triage it without blocking the active stabilization lane unless a narrower check ties it to current work.
- Keep the Parameters rail readable while fixes land; do not add new control-surface complexity ahead of the stabilization pass.
- Keep the current breathing and pulsing look stable while simplifying halo controls; do not reopen fine-tuning work unless a concrete regression appears.
- Decide whether same-size authored variants should become first-class before any saved-file schema rename.
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

