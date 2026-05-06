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

Lane Q is active. Lane P is paused until the halo content-base cleanup settles.

### Lane O — Stage shell ergonomics

Status: Paused after O1-O3. The shell follow-up did its job; O4/O5 stay deferred until there is a concrete zoom or pan need.

### Lane Q — Halo content-base stabilization

Goal: Make release labels and halo markers read from one fixed authored content base so the label start stays stable through breathing, the first echo follows the same base-plus-gap rule as later echoes, and the remaining radius controls read as one coherent surface.

Status: Q1 is complete and archived in `HISTORY.md`. The live inspector now hides `Label Position`, groups `Content Clearance`, `Echo Gap`, and `Label Size` under `Spoke Content`, and the renderer pins label placement to the shared content base instead of the old orbit-step offset path.

| Step | Status | Summary |
|------|--------|---------|
| Q2 | Next | Pressure-test the remaining radius controls against the current breathing cycle, then collapse or rename any still-overlapping controls without changing the current pulse look. |

### Lane P — Format variants and preset groundwork

Goal: Stop treating saved sizes as if they were only export targets. The live workflow is already closer to authored per-format variants, so the next pass should make the shell, controller behavior, and terminology match that reality without breaking the current document format.

Status: P1-P5 groundwork is complete and archived in `HISTORY.md`. Lane P is paused while Lane Q stabilizes halo content geometry. The next format question is still whether same-size authored variants should become first-class before the saved-file redesign.

| Step | Status | Summary |
|------|--------|---------|
| P6 | Next | Decide whether to unlock same-size authored variants before a saved-file schema change, and if the answer is yes, land the smallest compatibility-safe slice first. |

## Immediate Next Steps

- Pressure-test the halo content-base cleanup through the breathing cycle and identify which remaining radii controls still overlap conceptually.
- Keep the current breathing and pulsing look stable while simplifying halo controls; do not reopen fine-tuning work unless a concrete regression appears.
- Decide whether same-size authored variants should become first-class before any saved-file schema rename.
- Keep persisted preview-document snapshots compatibility-keyed by output profile until a deliberate migration is scoped.
- Use the current format-id keyed runtime to pressure-test same-size variants, derivation rules, and active-format restore behavior before changing the disk shape.
- Treat format work as authoring behavior first. Variant switching, derivation, and persistence come before more shell polish or export-recipe work.
- Keep future export work focused on output-operator or preset modeling. The shell parity plumbing for composed PNG, PNG sequence, and dev-only MP4 export is already in place.

## Operational Constraints

- Do not change halo breathing or pulsing behavior just to simplify the radius controls; geometry cleanup must preserve the current motion look.
- Do not re-introduce browser-local preset CRUD as the working-state authority.
- Do not start a saved-file schema rename until the shell and controller behavior settle.
- Keep `baseline-foundry` read-only from this repo unless a shared contract clearly belongs upstream.
- Prefer small validated slices over a one-shot format-system rewrite.

