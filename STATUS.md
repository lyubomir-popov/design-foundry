# LLM Handoff Context

> Read this first in a new chat.
> Active plan and sequencing live in `TODO.md`.
> Completed work archive lives in `HISTORY.md`.
> Long-term direction lives in `ROADMAP.md`.
> Agent workflow rules live in `.github/copilot-instructions.md`.

## Repo boundary

| Role | Path |
|------|------|
| Primary repo | `brand-layout-ops` (current workspace) |
| Reference-only repo | local `racoon-anim` clone when parity checks need it |

Do not continue product architecture work in the reference repo unless explicitly asked.
Keep repo and reference mentions location-agnostic so these docs stay valid across Windows and WSL checkouts.

## Quick start

```bash
npm run preview:dev
npm run typecheck
npm run preview:build
```

Run the dev server, not the static build, when testing browser MP4 export. `File -> Export MP4...` posts to a dev-only authoring route.

Useful focused checks: `npm run demo:overlay-layout`, `npm run demo:copy-to-points`, `npm run demo:orbits`, `npm run demo:spokes`.

## Current state

- Stage 1 parity is closed for the current rebuild scope. Document workflow, overlay editing, guides, source-default writeback, and the current export path are all working.
- The working artifact is a local `.brand-layout-ops.json` file. Browser-local presets are gone from the live workflow.
- `project.sceneFamilyGraphs` is now a sparse `Partial<Record<OverlaySceneFamilyKey, OverlayBackgroundGraph>>`. New documents only contain the active family; other families are created on demand when the user switches. Legacy files with all four families still load fine. `project.backgroundGraph` is a derived live active-family projection used by the preview runtime and is no longer written into new saved files. Legacy `sceneFamilyConfigs` remains load/apply compatibility only.
- The live shell now uses a two-menu `bf-top-navigation`: `File` owns recent-file access, the Formats dialog, the Preset Library dialog, source defaults, export settings, and export commands through BF modal dialogs, while `View` owns overlay visibility, guide mode, and playback state. The current document name is shown in the top-navigation banner, the Parameters rail stays parameter-only, and it starts with a dedicated `Layers` palette.
- File export parity is back to the current reference-app scope: composed PNG stills, inclusive-range PNG sequences, and dev-only MP4 export all run from the shell. The MP4 path snapshots the current persisted preview document, renders temp frames through `scripts/export-headless.ts`, and encodes them through `scripts/encode-mp4.ts` with optional two-second fades.
- Playback now uses `K` instead of `Space`, reserving `Space` for future canvas-hand or pan work without conflicting with the existing shell shortcuts.
- The preview stage now sits inside the canonical `bf-stage-shell` wrapper instead of treating `bf-fixed-width` and stage shell as the same element. The main worksurface reads as a neutral gray document surround, and the stage edge now stays visually distinct from the app chrome.
- Fit-to-viewport stage sizing now comes from measured stage-shell height instead of the older `100dvh` heuristic. Dock-mode changes, aside resizing, and shell resizes refresh the stage metrics and rerender authoring or network overlays so the fitted frame does not force gratuitous scrollbars when it should still fit.
- The stage now has a toggleable network overlay layer. `View` and `N` can show a 50% black scrim plus a deterministic DAG autolayout of the active background graph, with pseudo-nodes for overlay layout, preview composite, and output sinks so operator flow is visible without committing to a spatial editor yet.
- `preview-composition.ts` is now the shared preview compositor seam. Stage canvas visibility, SVG overlay visibility, export composition, automation state, and the network overlay all use the same ordered layer and sink model instead of carrying separate hardcoded assumptions.
- The Layers palette now owns the first graph-authoring surface. It can add background operators, connect compatible typed ports per input, and disconnect occupied inputs without deleting nodes. New nodes get unique IDs and default params, are selected immediately for editing, and do not become the graph output until later edge or active-node authoring says so.
- Shared graph port metadata and validation now live in `packages/operator-overlay-layout/src/background-graph.ts`. Persisted graphs normalize against real input and output ports, reject duplicate or cyclic connections, and keep the graph model reusable across future authoring surfaces.
- The stage network overlay now labels authored graph edges with human port names instead of raw port keys.
- The Formats dialog is now a table-driven workflow instead of the older choice-row modal. It shows saved document formats as radio rows with width and height columns, includes a built-in preset picker for unused standard profiles, supports direct custom-size entry, and allows row-level removal. Newly added formats now become active immediately so the user can design for that format at once. Custom dimensions still flow through generated `custom_{width}x{height}` output-profile keys.
- The shared document schema now exposes `OverlayDocumentFormat` while keeping the older target naming as a compatibility alias. Automation state now emits `document_formats` and `document_active_format_id` alongside the legacy target keys, and the live app-layer controller or shell wiring now uses format-first naming too. Formats now also persist `formatPresetKey` and `derivedFromFormatId` metadata. Built-in presets are now defined explicitly as one shared frame + safe-area + grid seed package, the dialog surfaces that richer seed summary per row, and the controller maintains derivation references when formats are removed or re-keyed.
- First-time bucket creation for a new format is now metadata-driven instead of only copying the active bucket blindly: preset-backed variants keep the preset safe-area and grid seed, while custom formats derive directly from the source format's authored layout.
- Active format ids now stay stable when a format's output profile changes. The live preview runtime is also now keyed by stable document format ids instead of raw output profile keys, so authored layout buckets, export settings, halo config, and staged CSV edits no longer collapse just because two formats share or mutate through the same profile key. The preview-document bridge still converts that runtime state back to profile-keyed snapshots for compatibility, and load normalization now preserves a saved `project.activeTargetId` even when an older compatibility snapshot profile is stale.
- The preview shell now restores the last successfully saved or opened document snapshot on startup as a local fallback resume path, and output-profile switches force an immediate stage rerender so custom-format activation cannot leave the old frame size or guide geometry on screen.
- First-save document naming now adopts the chosen file name when the in-app document is still untitled, so the top-navigation title and persisted metadata no longer stay stuck on `Untitled document` after naming the file in the save picker. Untitled fallback saves now also prompt for a real document name when no handle-backed filename exists, and explicit `#document=<file>` restores now win over stale last-session snapshots while still falling back if the hash target cannot be restored. File open/restore metadata now also notifies the shell immediately, recent-document storage failures are non-blocking, and the dev preview has a `/__authoring/document-file` fallback that prevents the integrated browser File System Access path from leaving zero-byte project files when a handle write fails or verifies empty. The save path now also uses that authoring route when no usable file handle exists at all, so dev-browser Save/Save As no longer disappears into a hidden download fallback before trying `projects/<file>`. Both branches are live-validated end to end for Save/Save As, refresh restore, and explicit Open when the file handle itself returns empty content.
- `fullhd_1920x1080` is now a real built-in format profile and default document target (`1920×1080 Full HD`), with seeded frame, safe-area, grid, text-style, and halo defaults instead of being only an ad hoc custom size.
- Safe-area editing in the Layout Grid panel now writes against the current live safe-area state instead of a stale captured object, so changing top, right, bottom, and left in sequence no longer silently reverts earlier edits and skew the rendered frame.
- Halo labels and echo markers now share one spoke-edge clearance control: `spoke_lines.content_clearance_px` lives beside the spoke geometry sliders, defaults to `24`, and sets the minimum outer radius for both labels and halo markers from the longest thick-spoke edge instead of making text and shapes drift under separate radius rules.
- Echo-marker clearance now uses the actual rendered marker footprint during late animation, not just the template dot radius, so sparse-boost and pulse-scaled plus/triangle/star/hexagon variants no longer slip inward across the shared clearance boundary near the end of the cycle.
- Halo label placement and marker clearance now route through one shared content-band path in the renderer instead of duplicating spoke-slot lookup, label font sizing, and radial-band math in separate branches. The remaining halo cleanup should extend that shared path rather than reintroducing parallel radius rules.
- Halo content-base follow-up is in progress: release labels now pin to the shared authored content base instead of riding the orbit-step offset, the `Label Position` control is gone from the live inspector, and the remaining content controls now live together under `Spoke Content` so the fixed base, first-echo gap, and label size are configured from one surface.
- The remaining radius surface is now narrower and less misleading: `Orbit Inner Radius` and `Halo Outer Radius` expose the orbit/halo envelope, `Spoke Line Start` now reflects the visual spoke-line inset and is clamped to the halo edge at runtime, and the dead live `End Radius Extra` control is gone from both the runtime and saved halo shape.
- Selected text-style edits in the overlay pane now keep the live section DOM and update their style-card metadata locally instead of forcing a full Parameters-rail rebuild on each committed change.
- The Layout Grid section now localizes its own structural updates: baseline edits no longer rebuild the Parameters rail, and toggling `Fit Safe Area` now shows or hides the safe-area inputs within the section instead of tearing down the whole inspector.
- Selected text style switches now stay local to the text section: choosing a different paragraph style no longer rebuilds the Parameters rail, and the style cards plus Font Size / Line Height / Weight controls retarget in place to the newly active style.
- Authoring drags on an already-selected overlay item now keep the current overlay section mounted: the authoring controller no longer re-selects the same item on pointer down, and pointer up now syncs the current overlay section inputs from state instead of forcing a full Parameters-rail rebuild.
- The Logo section now localizes its own lock / size state updates: changing `Lock A Head to Logo` no longer rebuilds the Parameters rail, and the width-field title plus width / height values now sync locally against current logo state instead of depending on a fresh section build.
- The Ubuntu Summit animation builder now memoizes halo-config fingerprints by object identity, so stable playback no longer re-serializes the full halo config every frame just to decide whether transition state can be reused.
- Halo label metrics are now cached in the halo renderer, so the render path no longer remeasures the same release-label text in both band-layout and overlay-draw passes.
- Construction-line fade now has a real UI toggle: the halo config panel exposes `vignette.enabled` as `Construction Fade`, the renderer respects that flag instead of always applying the radial vignette to the background spoke layer, and the seeded halo defaults now start with that fade off.
- The current save/load path still persists the open document's concrete target rows in `project.targets`, but the product direction has shifted again: the user-facing model should be Adobe-like authored format variants with InDesign-style auto-adjust or derivation, seeded by a global document-size preset library. Named export presets should still move onto the future Houdini-like output operator instead of staying in the Formats dialog or source-default modal flows.
- The shell uses the canonical `baseline-foundry` dark application, overlay, and resize contracts. The old local shell class layer is gone from source. The preview currently imports the valid exported `baseline-foundry/presets/app-tier.css` preset because the sibling repo's exported `presets/panel.css` artifact is malformed.
- `main.ts` is now a composition root around extracted controllers. The remaining work is product-shape work, not more parity recovery.

## Active queue

Lane R is active. Lane P is paused while the editor and animation hot paths are stabilized.

- Lane M is complete: network overlay, deterministic autolayout, selection, composition seam, and named output sinks are all in place.
- Lane N is complete: Layers-palette graph CRUD now covers add-node, connect, disconnect, shared typed-port validation, and synchronized parameter-pane focus.
- Lane O is paused after O1-O3, with zoom and pan work deferred until there is a concrete need.
- Lane P is paused after P5a and P5b while Lane R lands the current editor and animation debt fixes. Live format identity no longer mutates with the output profile key, and the in-memory preview runtime now keys authored buckets by document format id while the save/load bridge still preserves the older profile-keyed snapshot shape.
- Lane Q is complete: Q1, Q2, Q3a, and Q3b are archived in `HISTORY.md`. The halo content-base and radius cleanup no longer carries runtime or saved-shape ballast for `end_radius_extra_px`.
- Lane R is active: overlay text-style edits and style switches, authoring drag refreshes, grid baseline / safe-area edits, logo lock / size edits, animation fingerprint reuse, and halo label measurement caching are landed. The next work is to remove the remaining controller-driven rebuild-heavy add/delete and any non-structural document-target paths, then address controller state and persistence choreography.
- Future format work should follow the new hybrid rule: global presets seed authored format variants, variant derivation should carry a useful first-guess layout across dimensions, and export presets belong on the future output operator.
- Content-format as a user-facing concept is retired. The document authoring model replaces it, with Adobe-like format variants on top of the Houdini-like operator core. See `ROADMAP.md` → "Document/project model — Adobe-style variants over a Houdini core" for the full synthesis.

## Invariants that still matter

- The authored document graph plus overlay-authored objects are the only editable authority. Selection UIs and parameter panes must point at that state, not create shadow models.
- Layout semantics stay out of preview adapters and Three.js.
- Shell-level actions belong in authoring chrome, not inside operator parameter surfaces.
- `baseline-foundry` stays read-only from this repo unless a shared contract clearly belongs upstream.
- Do not re-introduce local shell class contracts or `[data-*]` style selectors in `apps/overlay-preview`.

## Key files

| Purpose | File |
|---------|------|
| Composition root | `apps/overlay-preview/src/main.ts` |
| Inspector rebuild + Layers palette | `apps/overlay-preview/src/config-editor-controller.ts` |
| Overlay child editing | `apps/overlay-preview/src/overlay-editing-controller.ts` |
| Shell bootstrap and keyboard shortcuts | `apps/overlay-preview/src/preview-shell-controller.ts` |
| Shared preview composition seam | `apps/overlay-preview/src/preview-composition.ts` |
| Stage network overlay rendering | `apps/overlay-preview/src/stage-network-overlay-controller.ts` |
| Background graph selection and family switching | `apps/overlay-preview/src/background-graph-controller.ts` |
| Preview document model and compatibility | `apps/overlay-preview/src/preview-document.ts` |
| Document open/save orchestration | `apps/overlay-preview/src/document-workspace.ts` |
| Shared document schema and graph persistence | `packages/operator-overlay-layout/src/document-schema.ts` |
| Shared background graph helpers | `packages/operator-overlay-layout/src/background-graph.ts` |
| Schema-driven parameter rendering | `packages/parameter-ui/src/schema-renderer.ts` |

## Fresh chat prompt

Continue work in this `brand-layout-ops` repo, using a local `racoon-anim` clone as the read-only reference app when parity checks need it. Read `.github/copilot-instructions.md`, `.github/agents/agent.md`, `STATUS.md`, `TODO.md`, `ROADMAP.md`, `docs/specs.md`, and `README.md` first. Treat `TODO.md` as the canonical active queue. Stage 1 parity, the selected-operator pane, the baseline-foundry shell cleanup, the preset-residue cleanup, the graph-first family-persistence migration, Lane J1-J5, and Lane K1-K3 are complete. The current baseline is a `bf-top-navigation` action shell plus a dedicated Layers palette and a layer-following Parameters rail, with persisted documents now storing `sceneFamilyGraphs` without serializing `backgroundGraph`. Lane P is now the active follow-up lane: make the live shell and controller behavior read as authored formats or variants instead of output-only targets, starting with the existing compatible `project.targets` persistence shape.