# History — Completed Work

Items moved here from `TODO.md` to keep the active backlog lean.

## Short-term

## Lane S1 — PointField graph payload contract (2026-05-26)

- Promoted `point-field` from convention to enforced graph-runtime contract in `packages/graph-runtime/src/index.ts`: incoming edges now validate source/target port existence, reject incompatible port kinds, and verify runtime payload shape for `point-field` inputs.
- Added regression tests in `packages/graph-runtime/src/index.test.ts` for invalid `point-field` payload shape and explicit cross-edge port-kind mismatch failures.
- Updated existing graph-runtime tests to declare explicit test input/output ports so the new validation path is exercised by default.
- Validation: `npm run typecheck` and `npm test` (58 tests passing).

## Kernel build K1–K7 complete (2026-06-01)

Built the foundational kernel architecture from the ground up, 7 new packages with 58 verification tests:

| Step | Package | Description | Tests |
|------|---------|-------------|-------|
| K1 | `@design-foundry/render-ir` | Flat display-list IR types (Skia/Flutter pattern). Pure types, no dependencies, serializable. 7 item types: rect, ellipse, line, path, glyph-run, image, group. | typecheck |
| K2 | `@design-foundry/render-svg` | SVG renderer adapter. Template-literal string output. Validates IR design. | 15 |
| K3 | `@design-foundry/text-shape` | harfbuzzjs WASM wrapper. Consumers import this, not harfbuzzjs directly. | 5 |
| K4 | `@design-foundry/operator-kernel` | Typed operator contract: InputPort, OutputPort, ParameterSchema, sync evaluate(), invalidationKey(), PORT_KIND constants, utility types. No dependencies. | 8 |
| K5 | `@design-foundry/render-canvas2d` | Canvas2D renderer adapter. Validates IR drives multiple backends. | 13 → 16 |
| K6 | `operator-halo-field/kernel` adapter | Ported halo-field onto operator-kernel contract via new `./kernel` export path. Existing exports untouched (additive). Cross-validated against direct function calls. | 7 |
| K7 | `@design-foundry/render-pdf` | sRGB vector PDF renderer via pdf-lib. CMYK deferred per PIVOT.md. | 10 → 11 |

K8 (pnpm workspace promotion) deferred — topology settled (multi-repo + pnpm overlay), but cross-repo scope.

Key design decisions made during the build:
- render-ir is self-contained (no core-types dependency). Different Color type (alpha required vs optional in core-types).
- Operator evaluate() is synchronous and pure. Async is a graph-runtime scheduling concern.
- Port kinds are open strings for extensibility, with standard constants exported via PORT_KIND.
- Stateful operators (e.g. fuzzy-boids) model state as explicit input+output port pairs.
- Generic constraints use `object` (not `Record<string, unknown>`) for compatibility with exactOptionalPropertyTypes.

## Adversarial review triage (2026-05-25)

Two adversarial reviews (plan coherence + architecture/code) were run against K1–K7. Findings triaged against pivot direction:

- **Fixed:** Canvas2D arc rendering bug — SVG `A` commands were falling back to `lineTo`. Implemented full SVG spec F.6 endpoint→center arc conversion using `ellipse()`.
- **Fixed:** Stale glyph-run fallback comments in all 3 renderers — updated to reflect that text-shape (K3) is available but glyph-outline extraction is a separate step.
- **Fixed:** Halo-field kernel-adapter port kinds — `timing` was `SCALAR` (actually a 6-field object), `introField`/`points` were `POINT_FIELD` (not actual PointField shapes). Changed to domain-specific kind strings (`"runtime-timing"`, `"intro-field-state"`, `"runtime-point-array"`). Verification test updated.
- **Added:** K9–K11 backlog items for Stage 1.6 overlay-preview integration, visual parity testing, and operator migration.
- **Added:** 3 new tests (Canvas2D arc, elliptical arc, non-uniform corners) + 1 PDF arc test. Total: 61 tests.
- **Deferred to roadmap:** glyph outline rendering, operator versioning semantics, async operator design, graph error recovery, cross-renderer consistency spec.
- **Dismissed (by design):** two operator contracts coexisting (pivot says additive), overlay-preview not consuming kernel (Stage 1.6+), Color type duplication (render-ir intentionally dependency-free), PointField→DisplayList bridge (integration work).

## K9 overlay-preview integration started (2026-05-25)

- **K9a:** Built `apps/overlay-preview/src/display-list-adapter.ts` — converts PointField → render-ir DisplayList with per-scene-family style resolvers (phyllotaxis, scatter, boids) and safe-area bars. 10 tests via `scripts/verify-display-list-adapter.ts`.
- **K9b:** Wired adapter into `scene-family-preview.ts` as opt-in `useKernelRenderer` flag on `RenderSceneFamilyPreviewFrameOptions`. When enabled, phyllotaxis, scatter, and CPU-boids rendering goes through `pointFieldToDisplayList()` → `Canvas2DRenderer.render()` instead of the ad-hoc `drawPointDot()` loops. First end-to-end kernel rendering in the product surface. GPU-spike and worker-boids paths remain on their existing backends (different data structures). Total: 72 tests across 7 suites.
- **K9c:** Overlay SVG adapter. Extended `ShapedRun` in render-ir with optional `fontFamily` and `fontWeight` for fallback rendering. Updated SVG and Canvas2D renderer fallback paths to emit font-family/font-weight. Built three overlay → DisplayList adapters: `guideGridToDisplayList()` (rects + lines + glyph-run labels), `textPlacementToDisplayList()` (one GlyphRunItem per wrapped line), `logoPlacementToDisplayList()` (ImageItem). Wired into `stage-render-controller.ts` via `useKernelOverlay` flag. 18 adapter tests including SVG round-trip. Total: 80 tests across 7 suites.
- **K9d deferred:** halo stays on Three.js — one-off summit operator, already has kernel contract (K6), not a reuse candidate.

## K10 visual parity validation (2026-05-25)

Built `verify:visual-parity` suite (12 tests) validating kernel adapter parity against legacy pipeline:
- Style formula cross-validation: phyllotaxis radius/alpha, scatter density-weight scaling, boids visibility gating — all numerically identical to ad-hoc `scene-family-preview.ts` formulas.
- Geometry parity: safe area bars, guide grid element counts (rects/lines/labels), text positions, logo bounds all match `svg-overlay-adapter.ts` output.
- Cross-renderer consistency: same DisplayList renders successfully through SVG, Canvas2D, and PDF backends.
- Full pipeline round-trips: PointField → adapter → all 3 backends; guide grid → SVG + PDF.
- Color conversion accuracy: ColorRgba (0–255) → render-ir Color (0–1) → SVG CSS color strings round-trips correctly.
Total: 92 tests across 8 suites.

## Renamed `brand-layout-ops` → `design-foundry` (2026-05-23)

- Repo, folder, GitHub remote, package scope, persisted format identifiers, storage keys, and prose mentions all renamed in one pass.
- Persisted format moved to option-C identifiers decoupled from the package name: file extension is now `*.df.json` and JSON discriminators are `"kind": "df.document"` and `"kind": "df.operator-presets"`. Old `brand-layout-ops.*` kind strings are gone; the existing `LEGACY_OVERLAY_PREVIEW_DOCUMENT_KIND` migration constant for the original `"brand-layout-ops-document"` kind remains untouched.
- Browser storage keys (IndexedDB DB name, localStorage snapshot key, overlay-visibility/guide-mode/control-panel-width keys, GPU spike flag) re-prefixed to `df-` / `df:`. This invalidates any existing browser-local state on the dev machine; persisted `projects/*.df.json` files survive untouched aside from the `"kind"` field migration and the file-extension change.
- Peer repos (`a4-generator`, `baseline-foundry`, `canonical-spacing-spec`, `diagram-generator`, `agent-workflow-kit`) updated: prose mentions renamed; AGENT-INBOX pivot pointers added; multi-root `.code-workspace` files updated where applicable.
- Reframing recorded in `PIVOT.md` at the repo root: design-foundry is now positioned as the Houdini-in-spirit kernel monorepo for the workspace, hosting the typed data graph, incremental DAG runtime, operator interface, flat display-list IR, and harfbuzzjs text-shape WASM layer. A4-generator, baseline-foundry, canonical-spacing-spec, and diagram-generator all stay as sibling repos; diagram-generator's `packages/layout-engine/` will eventually port here as `@design-foundry/operator-autolayout` when both its refactor and design-foundry's operator-kernel contract are stable. (Earlier draft of this paragraph incorrectly claimed diagram-generator would be absorbed into canonical-spacing-spec — corrected same-day; canonical-spacing-spec is and remains a sibling spec repo feeding multiple consumers.)

## BF `os` resync for overlay preview (2026-05-11)

- Switched `apps/overlay-preview/src/main.ts` from the removed `baseline-foundry/presets/panel.css` export to the supported `baseline-foundry/tiers/os.css` export so the preview matches current BF `main` instead of depending on the deprecated panel-shaped contract.
- Refreshed the local `baseline-foundry` file dependency with `npm install baseline-foundry@file:../baseline-foundry` so the workspace package install picked up the current BF export map; that updated `package-lock.json` and restored local preview-build validation.
- Replaced the remaining hardcoded gold literals in `apps/overlay-preview/src/styles.css` with BF resize-handle and authoring-accent tokens so the local shell override layer follows the shared BF chrome contract instead of carrying repo-local copies.
- Validation: `npm run preview:build` after the import swap, dependency refresh, and token-alignment cleanup.

## Demo rehearsal checkpoints (2026-05-10)

- Rehearsed the live format-switching recording path against `video-intro-export.brand-layout-ops.json`: after startup the hash-loaded document resolved to the expected file-backed title, `D` opened panel-hosted Formats without a modal, switching `1280×720 X LI` to `1920×1080 Full HD` updated the stage `viewBox` live, and dismissing Formats returned the rail to Parameters in place.
- Rehearsed save → reload against a disposable `projects/video-intro-export-rehearsal.brand-layout-ops.json` copy: `Ctrl+S` saved the current 1920×1080 state, a full reload restored that file from the hash route, and the saved JSON on disk carried the expected `activeTargetId` and metadata update. This clears the current dev-preview browser path while leaving the actual demo machine's OS-level save/open path as the remaining real-world check.
- Validation: `npm run typecheck`, `npm run preview:build`, and live browser checks for panel-hosted Formats, stage `viewBox` switching, save status, reload restore, and saved-file contents.

## Selected-text inspector compaction (2026-05-09)

- Removed the remaining selected-overlay duplication from the Parameters rail in `apps/overlay-preview/src/config-editor-controller.ts`, `apps/overlay-preview/src/overlay-editing-controller.ts`, and `apps/overlay-preview/src/overlay-section.ts`: the rail no longer repeats the selected layer's identity line, the readonly `Label` / `ID` metadata row is gone, and the text section now uses generic `Text` and `Paragraph Style` labels instead of echoing the sidenav selection.
- Replaced the tall paragraph-style option-card stack in `apps/overlay-preview/src/overlay-section.ts` with a compact `Paragraph Style` dropdown so selected text layers consume less vertical space in the demo inspector.
- Validation: `npm run typecheck`, `npm run preview:build`, and a live browser check confirming selected text layers no longer show the redundant help copy or metadata row and now expose one paragraph-style combobox with no remaining option cards.

## Panel-hosted Formats + Layout Grid readability cleanup (2026-05-09)

- Moved the existing Formats editor out of the modal path and into the right-hand control panel. `File -> Formats...` and `D` now replace the rail body with a panel-hosted Formats view, keep the stage visible while format selection updates live, and `D`, `P`, or the panel dismiss control restore the ordinary Parameters view without leaving mixed content behind.
- Reworked the Layout Grid section in `apps/overlay-preview/src/grid-section.ts` for narrow-width readability: Baseline now owns its own row, Rows and Row Gutter share one two-up row, Columns and Col Gutter share the next, and Margins / Safe Area now use group headings with short directional labels instead of repeating long labels in every field.
- Added a local control-rail override in `apps/overlay-preview/src/styles.css` so numeric and text inputs use `2px` inline padding inside the panel, which keeps values visible at narrow widths.
- Simplified the `W` shortcut in `apps/overlay-preview/src/preview-shell-controller.ts` so it toggles directly between `off` and `baseline`; because baseline mode already includes the composition or layout guides, this gives a fast two-state demo toggle instead of cycling through three states.
- Validation: `npm run typecheck`, `npm run preview:build`, clean editor diagnostics, live check confirming the grouped Layout Grid labels plus `2px` input padding, live check confirming `W` flips between guides on and guides off, and live check confirming selecting `1280×720 X LI` from the panel-hosted Formats view changes the stage `viewBox` from `1920 1080` to `1280 720` while the panel stays open.

## Demo-polish rail cleanup + panel preset return (2026-05-09)

- Removed the temporary `Family` and `Add` controls from the Layers rail in `apps/overlay-preview/src/config-editor-controller.ts`, keeping only the current background-operator selection list until a better insertion surface exists.
- Switched the preview stylesheet import in `apps/overlay-preview/src/main.ts` from `baseline-foundry/presets/app-tier.css` back to `baseline-foundry/presets/panel.css`, so the live inspector now uses the shared panel tokens for zero-radius controls and tighter inline padding instead of carrying a roomier app-tier control shape.
- Shortened Layout Grid unit labels in `apps/overlay-preview/src/grid-section.ts` from `baselines` to `bU` while keeping safe-area labels explicit as pixels.
- Validation: `npm run preview:build`, `npm run typecheck`, clean editor diagnostics, and a live preview check confirming the Background rail now shows only `Halo Field`, the Layout Grid labels read `bU`, and a rendered select control reports `border-radius: 0px`.

## Inspector local-override cleanup slice (2026-05-09)

- Confirmed the narrow numeric-input failure was caused by local inspector composition, not by a Baseline Foundry numeric-control bug.
- Removed the stale local `.bf-panel.is-fill` / `.bf-panel-content` workaround from `apps/overlay-preview/src/styles.css` now that Baseline Foundry owns that contract upstream.
- Stopped adding extra local right padding inside the Layers drawer, increased the app aside width ceiling, and made the overlay text and logo placement grids span two columns so the numeric values remain visible even at the minimum `18rem` aside width.
- Validation: `npm run typecheck`, `npm run verify:ui-regressions -- --url http://127.0.0.1:4173`, and a live preview check at forced `18rem` aside width confirming `Keyline`, `Row`, `Y Offset`, and `Span` remain readable.

## Lane P Halo durable save-preset slice (2026-05-09)

- Added a file-backed operator-preset library at `apps/overlay-preview/public/assets/operator-presets.json` plus a matching Vite authoring route so user-saved Halo presets persist outside individual documents without falling back to browser-local storage.
- Added `apps/overlay-preview/src/operator-preset-controller.ts` and wired it through `apps/overlay-preview/src/main.ts` so user-saved Halo presets are loaded before the Parameters rail builds.
- Extended `apps/overlay-preview/src/halo-config-section.ts` with `Save Current as Preset`, merged built-in and saved preset browsing, and kept the copy-on-apply rule: saving a preset captures non-composition Halo behavior for reuse, while the document keeps owning its local composition tweaks and later edits.
- Validation: `npm run typecheck`, `npm run verify:ui-regressions -- --url http://127.0.0.1:4173`, and a focused Playwright round-trip that saved a Halo preset through the new UI, confirmed the file-backed preset library changed, then restored the asset to its clean checked-in state.

## Lane P Halo copy-on-apply preset slice (2026-05-09)

- Added built-in Halo operator presets in `packages/operator-halo-field/src/index.ts` so operator-owned reusable seeds now live with the Halo operator instead of in preview-only UI code.
- Updated `apps/overlay-preview/src/halo-config-section.ts` to expose a `Halo Preset` picker in Parameters. Applying a preset now reseeds non-composition Halo behavior from a known-good preset while preserving the current document's composition tweaks.
- The preset flow is copy-on-apply: once applied, later local Halo edits remain document-owned and persist through normal document save without requiring an explicit preset save.
- Extended `scripts/verify-ui-regressions.ts` to assert that applying the `Dense Signal` preset changes Halo generator values while preserving the current `Center Y Offset` composition adjustment.
- Validation: `npm run typecheck` and `npm run verify:ui-regressions -- --url http://127.0.0.1:4173`.

## Lane R node-controls localized refresh slice (2026-05-08)
## Lane R stabilization complete (2026-05-08)

- Completed all four R-lane slices: R1 (localized inspector updates), R2 (per-group accordion state), R3 (animation optimization), R4 (persistence consolidation).
- Audited all `buildConfigEditor()` call sites; verified all are genuinely structural changes (selection, add/remove, format/family switching).
- No further inspector-localization opportunities identified; all value edits already incremental; all state-mutations that change selections correctly rebuild.
- Regression suite confirms: same-node collapse preservation, cross-group state survival, overlay-selected scoping, Parameters content selection.
- **Next:** Lane P6 decision point on same-size format variant unlock timing.

## Lane R node-controls localized refresh slice (2026-05-08)

- Updated `apps/overlay-preview/src/config-editor-controller.ts` so same-node background `Connect` and `Disconnect` actions refresh only the selected `Node` controls panel instead of rebuilding the full inspector.
- Kept a safe fallback to the existing full rebuild path when localized panel replacement cannot run, so behavior remains resilient while avoiding unnecessary rebuild work on the common path.
- Validation: `npm run typecheck` and `npm run verify:ui-regressions -- --url http://127.0.0.1:4173`.

## Lane R operator-pane per-group state slice (2026-05-08)

- Updated `apps/overlay-preview/src/config-editor-controller.ts` so operator accordion state is tracked per operator group instead of with one global section key.
- Refined fallback behavior so first-section auto-open now runs only when a group has no tracked state yet (or when a previously tracked section key is stale), while explicitly collapsed groups stay collapsed across group switches.
- Extended `scripts/verify-ui-regressions.ts` to assert cross-group persistence of collapsed operator panes (`Fuzzy Boids` and `Composition`) in addition to the existing same-node connect/disconnect collapsed-pane checks.
- Validation: `npm run typecheck` and `npm run verify:ui-regressions -- --url http://127.0.0.1:4173`.

## Lane R layers navigator compaction slice (2026-05-07)

- Reworked the `Layers` rail in `apps/overlay-preview/src/config-editor-controller.ts` so it drops the extra explanatory copy, renames the navigator surface from `Workspace` to `Layers`, replaces wrapped family radios with a `Background Family` select, and collapses add-node creation to one compact `Add Node` control.
- Moved selected background-node graph actions out of the navigator and into a dedicated `Node` section in Parameters, where connect, disconnect, and remove now stay attached to the selected node instead of competing with layer selection.
- Removed the now-unused local layer-palette CSS from `apps/overlay-preview/src/styles.css`, changed background-node fallback opening so the `Node` section is immediately visible on selection, and updated `scripts/verify-ui-regressions.ts` to cover the new `Layers` model plus add/connect/disconnect/remove behavior.
- Followed that with a keyboard-first cleanup: selected overlay text layers are now removed with `Delete` instead of a Parameters button, the root overlay copy points at that shortcut, and overlay visibility toggles rerender the stage so authored SVG text reappears immediately after `Show Overlay`.
- Finished the next UX cleanup by keeping `Layers` adjacent to `Parameters` inside the control panel as a narrow baseline-foundry side navigation, showing overlay and background items together in one persistent navigator, and flattening overlay-root `Overlay Layout` plus `Layout Grid` into always-open small-caps sections instead of accordion tabs.
- Validation: `npm run verify:ui-regressions -- --url http://127.0.0.1:4173` and `npm run typecheck`.

## Lane R selected-element scoping audit slice (2026-05-07)

- Audited the Parameters rail ownership in `apps/overlay-preview/src/config-editor-controller.ts` and confirmed the operator section grouping logic was already correct. The cross-selection leak came from always mounting the `Layers` palette inside the operator rail, which let background selections still show overlay selection UI in Parameters.
- Moved the `Layers` palette into a dedicated shell-level rail so selection and graph-authoring controls stay outside the selected-element Parameters surface.
- Updated the Parameters help copy and overlay-root helper text so the UI now explicitly describes the Layers rail as the place for selection and document-level controls.
- Made the overlay action row selection-aware in `apps/overlay-preview/src/overlay-section.ts` and `apps/overlay-preview/src/overlay-editing-controller.ts`: overlay root now shows `Add Text` only, selected text shows `Delete Text` only, and logo parameters no longer inherit unrelated text actions.
- Expanded `scripts/verify-ui-regressions.ts` to cover overlay-root scoping, text-layer scoping, logo scoping, halo-only scoping, and the earlier collapsed same-node graph connect or disconnect behavior.
- Validation: `npm run verify:ui-regressions -- --url http://127.0.0.1:4173` and `npm run typecheck`.

## Lane R Layers scoping + regression guardrails slice (2026-05-07)

- Updated `apps/overlay-preview/src/config-editor-controller.ts` so the Layers palette stops showing `Rendered Background` and `Background Graph` while Overlay Layout is selected. Those background controls now appear only after a background operator is selected from the network overlay, which keeps overlay-root editing scoped to authored layers instead of always showing the graph surface.
- Added `npm run verify:ui-regressions` in `scripts/verify-ui-regressions.ts`, covering the overlay-selected Layers scoping rule and the collapsed same-node `Fuzzy Boids` connect or disconnect behavior that the earlier operator-fallback slice fixed.
- Brought verification scripts into the TypeScript compile surface by adding `scripts/**/*.ts` to `tsconfig.json`, and updated `scripts/verify-document-persistence.ts` to match the current preview-document bridge contract while asserting that snapshot creation goes through `persistActiveDocumentFormatRuntimeState()`.
- Validation: `npm run verify:ui-regressions -- --url http://127.0.0.1:4173`, `npm run verify:document-persistence`, and `npm run typecheck`.

## Lane R operator-pane fallback policy slice (2026-05-07)

- Changed `apps/overlay-preview/src/config-editor-controller.ts` so `queueOperatorSectionRestore()` no longer treats `fallbackToFirstSection` as an implicit default. First-section reopening is now opt-in at the call sites that actually change selection.
- Same-node background-graph connect and disconnect actions now preserve a fully collapsed Parameters pane instead of reopening the top-level operator section after rebuild, while overlay-layer and background-node selection changes still open a relevant section when no restorable section key exists.
- Validation: `npm run typecheck`, live preview check confirming collapsed `Fuzzy Boids` stayed collapsed after `Connect`, live preview check confirming it also stayed collapsed after `Disconnect`, and live preview check confirming selecting `Text: A Head` still opened the `Text: A Head` section.

## Lane R persistence choreography helper slice (2026-05-06)

- Added `persistActiveDocumentFormatRuntimeState()` to `apps/overlay-preview/src/profile-state-controller.ts` so the active document format's params bucket, export settings, and halo config are persisted through one explicit helper instead of repeated manual three-call sequences.
- Updated `apps/overlay-preview/src/preview-document-bridge.ts` and `apps/overlay-preview/src/document-target-controller.ts` to consume that shared helper, so source-default snapshot creation and document-format target switching now share the same persistence contract as profile switching.
- Validation: `npm run typecheck` and `npm run verify:document-persistence`.

## Overlay safe-area fade regression fix (2026-05-06)

- Fixed the overlay-visible halo fade / hard drop-off regression in `apps/overlay-preview/src/stage-render-controller.ts` by treating the preview safe-area matte as guide UI instead of unconditional overlay content.
- The stage now emits `.safe-area-fill` only when guide mode is not `off`, so hiding guides no longer darkens the halo while the authored overlay remains visible.
- Validation: `npm run typecheck`, live preview check with guide mode forced to `off` confirming `.safe-area-fill` dropped from `1` to `0` while overlay content stayed visible, and live preview check with guide mode restored to `composition` confirming the safe-area fill and guide labels returned together.

## Lane R follow-up slices — grid local updates + halo label metrics cache (2026-05-06)

- Removed the full Parameters-rail rebuild from selected text style switching in `apps/overlay-preview/src/overlay-editing-controller.ts`; switching a selected text layer between paragraph styles now keeps the existing style controls mounted while the active style card and Font Size / Line Height / Weight inputs retarget locally in `apps/overlay-preview/src/overlay-section.ts`.
- Removed the full Parameters-rail rebuild from authoring drag refreshes in `apps/overlay-preview/src/authoring-controller.ts`; dragging an already-selected overlay item no longer re-selects the same item on pointer down, and pointer up now syncs the rendered overlay section inputs from state through `config-editor-controller.ts` and `overlay-section.ts` instead of rebuilding the entire inspector.
- Replaced the hidden `shouldAutoOpenNextOperatorSection` side effect in `apps/overlay-preview/src/config-editor-controller.ts` with explicit controller state. Rebuild-triggering layer and graph actions now queue a concrete section-restore request, and the controller tracks the last open operator section key directly instead of inferring reopen behavior from a hidden boolean and live DOM reads during rebuild.
- Removed the halo renderer's cached-scene replay on mascot asset completion in `apps/overlay-preview/src/halo-renderer.ts`; the async mascot image load path now signals `apps/overlay-preview/src/stage-render-controller.ts` to render the current halo frame from live app state instead of replaying a stale cached descriptor.
- Removed full Parameters-rail rebuilds from the Layout Grid section for `Baseline (px)` and `Fit Safe Area`; baseline edits now keep the existing input mounted, and the safe-area inputs now show or hide inside the section instead of tearing down the whole inspector.
- Removed full Parameters-rail rebuilds from the Logo section for `Lock A Head to Logo`; the logo lock toggle now keeps the existing checkbox and width input mounted while the width-field title and logo dimensions sync locally from current state.
- Cached halo release-label text metrics in `apps/overlay-preview/src/halo-renderer.ts`, so the renderer now reuses one measured width / ascent / descent tuple per label and font size instead of measuring the same text in both band layout and overlay draw passes.
- Validation: `npm run typecheck`, live preview check confirming a selected text layer's Font Size input stayed connected while a style switch retargeted it from `64` to the clicked `B Head` style's `32`, live preview drag check confirming the existing `Keyline` input stayed connected while the selected `A Head` text moved from keyline `2` to `1`, live preview check confirming the explicit config-editor restore state still reopened `Text: A Head` after leaving `Layout Grid` and still left an operator section expanded after switching to the halo node, fresh preview reload check confirming the halo scene still loads cleanly after the mascot asset redraw callback moved out of cached renderer state, live preview check confirming the Layout Grid baseline input stayed mounted during edit, live `Fit Safe Area` toggle check confirming the safe-area inputs hide within the section without a full rail rebuild, live logo lock toggle check confirming the checkbox and width input stayed connected while the width-field title updated locally, and live preview render checks after the halo label-metrics cache landed.

## Lane R first slices — text-style rail updates + animation fingerprint memoization (2026-05-06)

- Removed full Parameters-rail rebuilds from selected text-style edits in `apps/overlay-preview/src/overlay-section.ts`; font size, line height, and weight now update the local style-card metadata in place and keep the live section DOM connected during committed edits.
- Memoized halo-config fingerprints by config object identity in `packages/operator-ubuntu-summit-animation/src/index.ts`, so stable playback no longer re-serializes the full halo config every frame just to compare transition-state compatibility.
- Validation: `npm run typecheck`, live overlay-pane edit check confirming the existing Font Size input stayed connected after change and the style card metadata updated in place, and live automation state check confirming the animation builder still returns a valid scene descriptor at `playback_time_sec = 2.01`.

## Halo saved-shape cleanup — Q3b (2026-05-06)

- Removed `spoke_lines.end_radius_extra_px` from the halo config type and seeded defaults in `packages/operator-halo-field`, so the dead end-radius value no longer exists in either the live schema or newly created halo configs.
- Removed `end_radius_extra_px` from the tracked source-default halo asset and the checked-in project documents, closing the last saved-shape ballast left over from the retired live control.
- Validation: `npm run typecheck`, preview reload, and automation state checks confirming the loaded halo config no longer exposes `end_radius_extra_px`.

## Halo runtime ballast cleanup — Q3a (2026-05-06)

- Removed the unused derived `Spoke.end_radius` field from the halo runtime shape in `packages/operator-halo-field`, since the live `End Radius Extra` control is retired and the renderer no longer consumes that value.
- This was followed immediately by Q3b, which removed the remaining saved-field ballast as well.
- Validation: `npm run typecheck`.

## Halo radius cleanup — Q2 (2026-05-06)

- Renamed the remaining live halo envelope controls to `Orbit Inner Radius` and `Halo Outer Radius`, moved `Spoke Line Start` into `Spoke Details`, and simplified the `Angles` section so the inspector now matches the actual geometry owners instead of reading like four competing radius knobs.
- Retired the dead live `End Radius Extra` control from the halo inspector while keeping the compatibility field in the config shape for existing files.
- Clamped `Spoke Line Start` to the halo outer radius in the halo field builder so oversized values no longer make the thick spoke segment drop out while the current breathing look stays intact.
- Validation: `npm run typecheck`, live preview reload, live inspector checks confirming the renamed sections and labels, and an automation snapshot with `start_radius_px = 400` rendering cleanly through the live preview.

## Halo content-base stabilization — Q1 (2026-05-06)

- Pinned release-label placement to the shared authored content base in `halo-renderer.ts` instead of deriving label start from the orbit-step offset path, so breathing no longer pushes labels outward.
- Removed the live `Label Position` control from the halo inspector while keeping the compatibility field in config defaults, making the fixed-base behavior the only active label-placement model.
- Regrouped the remaining shared content controls into one `Spoke Content` section so `Content Clearance`, `Echo Gap`, and `Label Size` now live together instead of being split across geometry, echo, and label sections.
- Validation: `npm run typecheck`, live preview reload, and browser checks confirming the halo inspector now shows `Spoke Content` with `Content Clearance`, `Echo Gap`, and `Label Size`, with no `Label Position` control or separate `Release Labels` section.

## Halo clearance + construction-fade cleanup (2026-05-05)

- Added `spoke_lines.content_clearance_px` so halo labels and echo markers now share one spoke-edge clearance control instead of drifting under separate radius rules.
- Switched late-animation echo-marker clearance to the actual rendered marker footprint, preventing sparse-boost and pulse-scaled markers from slipping back inside the clearance band.
- Refactored halo label placement and marker clearance onto one shared content-band path in `halo-renderer.ts` so future radius work extends one helper path instead of parallel branches.
- Added the `Construction Fade` toggle, wired the renderer to respect `vignette.enabled`, and changed seeded halo defaults so construction-line fade now starts off by default.
- Validation: `npm run typecheck`, live preview checks for shared clearance behavior, and a reload check confirming `Construction Fade` is visible and unchecked by default.

## Document persistence hardening (2026-05-05)

- Fixed saved active-format restore so `project.activeTargetId` remains authoritative when the older compatibility snapshot profile is stale; reopened custom formats now stay active instead of falling back to 1080x1920.
- Fixed file metadata application so Save/Open/Restore title updates notify the shell immediately, and recent-document storage clone failures no longer leave the open/save flow pending.
- Added a dev-server document-file fallback for the integrated browser path that was creating zero-byte project files: file-handle saves are verified after write, failed or mismatched writes fall back to `/__authoring/document-file`, and empty file-handle reads can recover a valid same-name JSON from `projects/`.
- Extended that dev-server fallback so Save/Save As writes directly to `projects/<file>` when no usable file handle exists at all, instead of dropping straight to a browser download that can look like a no-op in the VS Code webview or Chrome automation.
- Added `fullhd_1920x1080` as a built-in default format and seeded it into the default source document, so `1920×1080 Full HD` now appears in the fresh-document formats list without manual re-entry.
- Added `npm run verify:document-persistence` for the stale-snapshot active-format case.
- Validation: `npm run typecheck`, `npm run verify:document-persistence`, live route smoke for `/__authoring/document-file`, live preview e2e covering Save As, refresh restore, explicit Open from the saved document, an intentionally failing File System Access write that still produced and reopened a nonempty `projects/` JSON through the dev fallback, and a real Chrome check where picker failure still wrote `projects/Untitled-document.brand-layout-ops.json` and subsequent plain Save updated that same file in place.

## Save naming + safe-area edit state fix (2026-05-01)

- Fixed first-save naming so an untitled document adopts the chosen file name in document metadata and the top-navigation title instead of staying `Untitled document` after Save or Save As.
- Fixed the Layout Grid safe-area inputs so multi-field edits compose against the current safe-area state instead of overwriting earlier edits with stale values from when the panel was built.
- Validation: `npm run typecheck`, live browser save with a stubbed file picker confirming the nav title updates to the chosen file stem, and live safe-area edits confirming rendered left and right insets match the input values.

## Preview resume + format redraw fix (2026-05-01)

- Fixed the preview-shell startup path so the app restores the last successfully saved or opened document snapshot instead of always falling back to the default untitled source-default document on reload.
- Fixed output-profile switching so activating a custom format immediately rerenders the stage and authored SVG overlay for the new frame size instead of leaving the previous format's render state on screen.
- Validation: `npm run typecheck` plus live browser checks for 1080x1920 to 1920x1080 switching and startup restore of a saved 1920x1080 document snapshot.

## Export parity — browser MP4 path (2026-05-01)

- Closed the remaining `racoon-anim` export-parity gap by wiring browser MP4 export into the live File menu with the same inclusive frame-range semantics and optional two-second fade toggles.
- Extended `scripts/export-headless.ts` so the headless renderer can apply an exact persisted preview-document snapshot before rendering, which keeps browser export tied to the current authored document instead of a looser runtime-only state.
- Added the dev-only `/__authoring/export-mp4` route in `apps/overlay-preview/vite.config.ts`. It writes a temp preview-document snapshot, renders an isolated temp PNG sequence, encodes delivery-friendly MP4 output through `scripts/encode-mp4.ts`, and cleans up afterward. Windows child-process spawning is now handled with a safe shell-backed path.
- Validation: `npm run typecheck` and a live one-frame browser MP4 smoke export that returned HTTP 200 and produced an MP4 in `output/<width>x<height>/mp4/`.

## Long-term

## Lane P5b — runtime buckets keyed by document format ids (2026-04-19)

- Moved the live preview runtime off raw profile keys: authored params, export settings, halo config, and staged CSV drafts are now keyed by stable document format ids instead of collapsing onto `outputProfileKey`.
- Updated the preview-document bridge so save/load still round-trips through the older profile-keyed snapshot shape for compatibility while the in-memory app state stays format-id keyed.
- Threaded the new format-id runtime through the format controller, source-default apply path, and main composition wiring so format switches and profile mutation persist the active authored state before hopping between formats.
- Validation: `npm run typecheck`, `npm run preview:build`, and a live browser smoke test covering `File -> Formats...`, preset add, and saved-format activation.

## Lane P5a — stable format ids during profile mutation (2026-04-19)

- Cleaned the stale Lane P4 note out of the canonical docs and promoted the real next step into Lane P5 so the active queue now matches the code again.
- New document formats now get stable authored ids instead of defaulting every new format id to the output profile key.
- Changing the active format's output profile now keeps the existing format id, preserves derivation references, and primes the new profile-scoped runtime state from the active format before switching so authored layout, export settings, and halo state survive the mutation.
- Remaining gap: runtime buckets are still keyed by output profile, so same-size authored variants still need a later P5 slice instead of landing as part of this one-step refactor.

## Lane P1–P2 — formats shell terminology + preset activation (2026-04-03)

- Reframed the old `Document Setup` shell surface as `Formats...` in the live File menu and modal title so the user-facing workflow reads as authored formats instead of output-only target rows.
- Updated the Formats dialog copy and table labels to talk about active formats, saved formats, and format removal rather than generic sizes or targets.
- Added a built-in preset row to the Formats dialog so unused standard output profiles can be added directly from a preset list instead of forcing manual dimension entry for common social sizes.
- Custom-size adds now immediately activate the new format, matching the design workflow of choosing a format and then editing for it. This reuses the existing profile-bucket behavior that seeds a new profile from the current active format as a first-guess layout.
- Validation: `npm run typecheck` and `npm run preview:build`.

## Lane P3 — compatibility naming cleanup (2026-04-03)

- Added `OverlayDocumentFormat` to the shared document schema and kept `OverlayDocumentTarget` as a compatibility alias so new code can use format terminology without breaking the current saved-file shape.
- Clarified in the shared project types that `activeTargetId` and `project.targets` are compatibility keys for now, even though the user-facing model is moving toward authored formats.
- Extended automation state in `export-controller.ts` to emit `document_formats` and `document_active_format_id` alongside the legacy `document_targets` and `document_active_target_id` keys, giving downstream tooling a migration path without a breaking change.
- Renamed the live app-layer controller, app-context API, dialog selectors, and shell wiring to format-first terminology so the running preview no longer advertises targets as the primary concept outside the persisted compatibility keys.
- Validation: `npm run typecheck` and `npm run preview:build`.

## Lane P4a — format origin metadata groundwork (2026-04-03)

- Added `formatPresetKey` and `derivedFromFormatId` to `OverlayDocumentFormat` so document-owned formats can now remember both which global or built-in size preset seeded them and which existing format they were derived from.
- New built-in-preset and custom-format adds now stamp their derivation source from the previously active format, matching the existing first-guess layout seeding behavior.
- Automation export state now includes the new format metadata so downstream tooling can inspect preset origin and derivation without inferring it indirectly from dimensions alone.
- The Formats dialog now shows preset or derivation summaries per format row, and the controller keeps derivation references honest when a source format is removed or when a format id changes because its profile key changed.
- Validation: `npm run typecheck` and `npm run preview:build`.

## Lane P4b — preset seed package definition (2026-04-03)

- Defined the built-in global format presets explicitly in shared overlay-layout code as a coupled seed package: frame size, safe area, and grid now live together instead of being inferred from separate profile and grid-default tables.
- Default overlay params now seed from that shared preset package, which keeps new formats honest while still leaving the live document buckets as the authority for later safe-area or grid edits.
- The Formats dialog now surfaces the richer preset seed summary, including safe-area dimensions plus grid rhythm, and automation export state now exposes the resolved preset payload for each document format.
- Validation: `npm run typecheck` and `npm run preview:build`.

## Lane P4c — preset library shell entry (2026-04-03)

- Added `File -> Preset Library...` so the menu system now exposes the global preset model explicitly instead of leaving it implicit inside the Formats add row.
- The new modal explains the split: presets are global frame + safe-area + grid seeds, while document formats own later overrides.
- The Formats dialog copy now points back to the preset library so the difference between document-owned formats, global presets, and source defaults stays legible in the shell.

## Lane P4d — metadata-driven variant seeding (2026-04-03)

- First-time profile buckets for new formats are now seeded from actual format metadata instead of only copying the active bucket blindly during output-profile switches.
- Preset-backed variants now keep the preset's safe-area and grid seed while carrying the source format's authored layout as the initial first guess.
- Custom-size variants now derive directly from the source format's authored layout, which makes `derivedFromFormatId` reflect a real seeding behavior instead of only row metadata.
- The Formats dialog copy and status messages now explain the difference between preset-backed adds and custom derived variants.
- Validation: `npm run typecheck` and `npm run preview:build`.

## Lane M — stage network overlay + compositor seam (2026-04-02)

- Added a dedicated stage network overlay mount in the preview stage and a persisted `networkOverlayVisible` flag in preview state.
- Extended `preview-shell-controller.ts` so `View` can show or hide the overlay and `N` toggles it directly from the keyboard.
- Added `stage-network-overlay-controller.ts`, which renders the active background graph as a deterministic DAG overlay using topological depth instead of a force layout or persisted XY positions.
- The overlay uses a 50% black scrim, `baseline-foundry` option-card primitives for node cards, curved SVG connections, and connection labels derived from graph ports.
- Added honest pseudo-nodes for `Overlay Layout`, `Preview Composite`, and `Preview Sink` so the current preview composition flow is visible without pretending there is already a full compositor editor.
- Wired overlay rerenders to selection, graph sync, profile switching, document apply/reset, resize, and visibility changes so the overlay stays in sync without redrawing every playback frame.
- Added `preview-composition.ts` as the shared source of truth for ordered preview layers and named output sinks.
- Stage canvas visibility, SVG overlay visibility, export frame composition, automation state, and the network overlay's composite or sink pseudo-nodes now all read that same preview composition model instead of each hardcoding their own render-order assumptions.
- The current preview seam now explicitly models composed outputs as sinks: `Frame Preview`, `PNG Still`, `Image Sequence`, `Automation Frame`, with `SVG` and `PDF` carried as planned sink slots instead of implied future work.
- Validation: `npm run typecheck` and `npm run preview:build`.

## Lane N1 — add-node graph authoring (2026-04-02)

- Added `getAvailableBackgroundOperatorKeys()` and `addBackgroundNode()` to `background-graph-controller.ts` so graph mutation stays centralized instead of the inspector hand-editing document graph arrays directly.
- New background nodes derive from shared default operator configs, receive unique IDs (`background-scatter-2`, etc.), and do not steal `activeNodeId` just by being added, so the live preview does not unexpectedly jump outputs before edge wiring exists.
- Added Layers-palette `Add ...` buttons for the supported background operators. Clicking one adds the node, marks the document dirty, selects the new node, and opens its parameter section immediately.
- Validation: `npm run typecheck` and `npm run preview:build`.

## Lane N2–N5 — edge CRUD and layers-first authoring (2026-04-02)

- Added shared background-graph port metadata and connection validation in `packages/operator-overlay-layout/src/background-graph.ts`. Graph normalization now keeps only real typed ports, rejects duplicates, rejects cyclic connections, and preserves one incoming edge per input port.
- Added controller-level background edge connect and disconnect helpers so graph mutation stays centralized instead of the Layers palette editing edge arrays directly.
- Added per-input graph authoring controls to the Layers palette. Compatible upstream outputs appear as connect or replace choices, and occupied inputs expose explicit `Disconnect` actions.
- Connect and disconnect now keep the edited node selected, rebuild the parameter pane immediately, and rerender the stage network overlay so the selection surface stays synchronized after graph edits.
- The stage network overlay now labels authored graph edges with human port names instead of raw key strings.
- Validation: `npm run typecheck`.

## Shell ergonomics prework — playback shortcut (2026-04-02)

- Moved the playback shortcut from `Space` to `K` in `preview-shell-controller.ts` and the `View` menu so future canvas-hand or pan work can claim `Space` without colliding with transport controls.
- Validation: `npm run typecheck`.

## Lane O1–O3 — stage shell surround + fit sizing (2026-04-02)

- Audited the shell contract and confirmed `baseline-foundry` already ships a canonical `bf-stage-shell`; the follow-up stayed local to the preview's stage sizing and surround instead of becoming an upstream request.
- Updated `apps/overlay-preview/index.html` so the stage now sits inside a real `bf-stage-shell` wrapper with a nested `bf-fixed-width` frame, matching the canonical sample structure instead of combining both responsibilities on one element.
- Added a neutral gray worksurface treatment plus a clearer stage edge in `apps/overlay-preview/src/styles.css` so the document reads like a canvas on a work surface instead of blending into the dark app shell.
- Replaced the old `100dvh` stage-width heuristic with measured stage-shell sizing. `stage-render-controller.ts` now publishes live shell block metrics, and shell or aside resize paths refresh authoring and network overlay positioning through `main.ts` and `preview-shell-controller.ts`.
- Validation: `npm run typecheck` and `npm run preview:build`.

## Lane L — Sparse operator graph inclusion + node CRUD

- Changed `OverlaySceneFamilyGraphs` from a fixed interface with all four families to a sparse `Partial<Record<OverlaySceneFamilyKey, OverlayBackgroundGraph>>`. New documents start with only the active family's graph.
- `createDefaultOverlaySceneFamilyGraphs` now accepts `activeSceneFamilyKey` and only creates that one family.
- `normalizeOverlaySceneFamilyGraphs` now accepts `activeSceneFamilyKey`, iterates only over keys present in input, and ensures the active key always has a graph.
- `syncDocumentBackgroundGraph` creates families on demand when the user switches, with explicit write-back to the sparse map.
- Added `removeBackgroundNode(nodeId)` to `BackgroundGraphController`: removes the node, prunes all edges referencing it, falls back `activeNodeId` to the last remaining node, refuses to remove the last node.
- Wired a hover-reveal × button per background node row in the Layers palette. Hidden when only one node exists.
- Verified: existing source-default config (all four families), legacy project files (`ubuntuSummit26.04.json`), and the automation/export controller all work unchanged under the sparse type.

## Audit pass — dead code cleanup (2026-04-02)

- Deleted orphaned `apps/overlay-preview/src/content-format-section.ts` (never imported anywhere after the content-format accordion was retired).
- Removed dead `loadOutputFormatKey()` export from `apps/overlay-preview/src/sample-document.ts` (exported but never imported).
- Validated: `npm run typecheck` passes cleanly after both removals.

## Completed Phases

**Phase 1 — Lock the operator boundaries:** Done. 10 initial packages established. Spoke math kept coarse.

**Phase 2 — Runnable preview app:** Done. Document snapshot loading, graph evaluation, layout overlay, motion background, and manifest-driven parameter surfaces all working.

**Phase 3 — Layout stack port:** Done. Baseline grid, text wrapping, logo placement, CSV/inline content, selected-element interaction, grid snapping all verified against reference.

**Phase 4 — Editor interaction port:** Done. Selection, drag, resize, inline editing, shift-lock, guide toggle, style labels, text CRUD, CSV drafts with writeback staging, file-backed document workflow (open/save/save-as/duplicate/reopen), per-profile output profiles, content-format buckets, preset save/update/delete/import/export, keyboard shortcuts, and baseline-aware text-box inset all landed. Document model carries shared project metadata (scene family, targets, sceneFamilyConfigs, backgroundGraph) through the overlay-document envelope.

**Phase 5 — Port the animation background as coarse operators:** Done. `operator-orbits`, `operator-spokes`, coarse motion preview integration. Mascot-specific motion stays in adapter/scene-family layer until reuse is concrete. Mascot fade now multiplies through whole scene. The temporary vignette overlay pass was later removed because it caused visible gradient banding in exported video.

## Deviation Log (summary)

All deviations are resolved and justified. Key patterns: motion preview was pulled forward to improve parity visibility (2026-03-26), Phase 6 was reopened after a full cross-repo audit (2026-03-27), the `portable-vertical-rhythm` and then `baseline-foundry` shell swaps landed during parity work at user request (2026-03-28), file-backed documents were prioritized over CSV polish and browser-local presets (2026-03-28), shared document project metadata plus scatter as a full scene family both landed before all UI was exposed (2026-03-28), and on 2026-03-29 halo work was explicitly frozen as parity-complete for this rebuild while the separate vignette overlay pass was removed because it caused export banding. An experimental GPU fuzzy-boids spike also landed the same day behind an opt-in flag, using WebGL2 simulation plus CPU `PointField` readback as the export seam. Detailed reasoning preserved in git history.

## Package split status

All initial first splits complete: grid, text, overlay composition, overlay interaction, parameter surface, orbits, spokes. Mask operators remain deferred.

## Post-extraction bug fixes (2026-04-01)

- Fixed missing `data-document-summary` and `data-document-status` attributes in `document-section.ts` (dropped during EQ-1 class migration at `fc35f96`). This made document workspace status/summary invisible, causing save/open feedback to be silently discarded.
- Added error handling to file-toolbar button click handlers in `preview-shell-controller.ts` so failures are logged to console and shown in the document status line instead of being silently swallowed.
- Removed presets accordion section from config-editor registration. Document save/open replaces preset localStorage persistence.
- Killed localStorage persistence for presets (`brand-layout-ops-presets-v1`, `brand-layout-ops-active-preset-v1`) and output format (`brand-layout-ops-output-format-v1`). All functions now return empty defaults / no-op.
- Changed baseline grid overlay stroke from red at 15% to white at 15% so it's visible on the dark stage background.

## Document-model regression follow-up (2026-04-01)

- The suspected Chrome file-toolbar regression did not reproduce in a clean Chrome incognito session; the user's ordinary-profile failure was likely caused by extension or profile interference rather than the repo. The document picker remains hardened around a `.json` filter plus fallback path.
- Hardened the document workspace fallback path: if the local file picker fails unexpectedly, Save/Save As/Duplicate now fall back to a browser download with an explicit status message, and Open falls back to the legacy file-input chooser instead of looking dead.
- Removed the dedicated Content Format accordion from the live inspector. Content-format still exists inside the document/source-default schema for compatibility, but it is no longer presented as a localStorage-era sidebar control.
- Closed the suspected source-default round-trip regression after the user re-tested it during this session and confirmed the writeback path still works.

## Lane E1 — workspace vs parameter rails (2026-04-01)

- Split the live inspector into two explicit rails inside `config-editor-controller.ts`: a shell-level `Workspace` rail for document, export, playback, and source-default controls, and a separate `Parameters` rail for overlay-layout plus the selected saved background operator.
- This closes Lane E1 by making the shell/operator boundary visible in the UI before the later selected-operator model and single-surface pane work.

## Lane E2/E3 — unified selected-operator pane (2026-04-01)

- Added an explicit selected-operator state to the preview app so the inspector can switch between `operator-overlay-layout` and saved background nodes through one model instead of the earlier background-only selector.
- Updated the parameter rail selector to include `Overlay Layout` alongside saved background nodes while keeping rendered-output family selection separate from parameter-surface selection.
- The parameter rail now renders only the selected operator surface instead of stacking overlay-layout sections and the active background panel together. Overlay-layout selection shows only its scoped sections, and background-node selection shows only that operator-family surface.
- Document/state refresh paths now normalize both the saved background-node focus and the higher-level selected-operator choice after load, reset, and source-default apply.
- Validation: `npm run typecheck` and `npm run preview:build`.

## Lane F1/F2 — shell contract cleanup (2026-04-01)

- Switched the live preview shell to the canonical `baseline-foundry` dark root contract: `body` now uses `bf-theme is-dark`, the application overlay now uses `bf-application-overlay`, and the resize handle now uses `bf-application-aside-resize-handle`.
- Removed the preview-local `editor-docked` body class and now derive docked-vs-overlay mode directly from viewport width plus canonical aside/application state.
- Removed the remaining bespoke shell class names from live markup and styles, replacing them with `bf-*` plus `is-*` state naming. The old `.mascot-app`, `.stage*`, `.preview-*`, and `.operator-selector*` contracts are gone from source.
- `apps/overlay-preview/src/styles.css` no longer styles `[data-*]` selectors.
- Finished the F3 runtime seam: desktop now starts pinned open, mobile now starts with the drawer closed, and a Playwright smoke pass confirmed the canonical `bf-application-overlay` open/close path plus the pinned-aside desktop path both behave correctly.
- Validation: `npm run typecheck` and `npm run preview:build`.

## Halo follow-up verification (2026-04-01)

- Re-ran the carried halo spot checks from commit `5b927dd` against the current preview after the later selected-operator and shell refactors.
- An automation-driven export probe rendered halo frames at `composition.scale` `0.35`, `1.0`, and `1.35` and confirmed both the halo geometry bounds and the text-overlay bounds grow with scale, so the old "dots only" zoom regression is not present in the current app.
- Re-checked the release-label seam behavior in exported frames and confirmed the left-side fold seam still fades the oldest labels behind the newest spoke instead of drawing them on top.
- Validation: temporary `window.__layoutOpsAutomation` probe plus exported frame inspection.

## Lane H1 — preset residue removal (2026-04-02)

- Removed the remaining preset subsystem from the live preview runtime now that file-backed documents are the only working-state unit: `preset-controller.ts` and `presets-section.ts` were deleted, `PreviewState` no longer carries `presets` or `activePresetId`, and `main.ts` no longer wires preset actions into the app context.
- Preview documents no longer persist preset payloads or active-preset IDs. Legacy preview-document migration still accepts older snapshot files, but preset fields are ignored instead of being rehydrated into live state.
- Removed the stale preset export helper from `export-controller.ts` and the remaining preset-name input special case from `preview-shell-controller.ts`.
- Source-default reset no longer rebuilds non-existent preset tabs, and `sample-document.ts` now only carries overlay-param cloning plus export-format defaults instead of dead preset persistence utilities.
- Validation: `npm run typecheck` and `npm run preview:build`.

## Lane I — graph-first family persistence (2026-04-02)

- Replaced the old `sceneFamilyConfigs` persistence bridge with graph-shaped family storage in the shared document schema: `OverlayDocumentProject` now persists `sceneFamilyGraphs`, while `backgroundGraph` remains the live active-family projection used by the preview runtime.
- Family switching in `background-graph-controller.ts` now snapshots the current active graph into the per-family map and reloads the stored graph for the newly selected family instead of rebuilding from config snapshots.
- Automation state now exposes `document_scene_family_graphs`, and automation apply accepts both the new graph-map payload and older `document_scene_family_configs` payloads through a compatibility bridge.
- Older document and source-default files still load: `document-schema.ts` now normalizes legacy `sceneFamilyConfigs` into per-family graphs and lets any saved active `backgroundGraph` override the current family entry during migration.
- Validation: `npm run typecheck` and `npm run preview:build`.

## Lane J1/J2/J3 — docs-role audit, authored authority, and layer palette (2026-04-02)

- Shortened `llm-handoff-context.md` back to a real cold-start file and removed active-queue duplication from `README.md`, so status now lives only in the canonical docs.
- Kept the authored model explicit: the document graph plus overlay-authored objects remain the only editable authority, and the new palette or pane work reads that state instead of introducing shell-only shadow models.
- Replaced the old parameter-surface selector with a dedicated `Layers` palette in the Parameters rail. It now lists background nodes, the overlay root, text fields, and the logo so selection no longer depends on direct canvas picking alone.
- Reduced the old `Selected Element` action row to add/delete actions only, so the new palette is the primary selection surface for overlay children.
- Validation: `npm run typecheck` and `npm run preview:build`.

## Lane J4 — pure overlay parameters pane (2026-04-02)

- Removed the special `Selected Element` framing from the overlay parameter surface. The overlay section now reads as `Overlay Layout`, `Text: ...`, or `Logo` depending on the current layer selection.
- The Parameters rail now follows the selected overlay layer more strictly: when a text or logo layer is selected, root-only overlay controls such as the layout grid stay hidden until the overlay root is selected again from the Layers palette.
- Cleaned up the last stale `selected-overlay` naming in the source tree so the code now reflects the overlay-layer model directly.
- Validation: `npm run typecheck` and `npm run preview:build`.

## Lane J5 — top-level shell chrome for workspace actions (2026-04-02)

- Added a top `bf-navigation-bar` action chrome to the live preview and moved file, document-size, source-default, export, and playback actions into grouped top-level toolbars.
- Retired the Playback accordion from the live workspace rail and removed the dead `playback-section.ts` file.
- Removed duplicate action rows from the Export, Source Defaults, and Output Format panels so the inspector now keeps settings and status while shell actions live in top chrome.
- Added first-class file shortcuts for `Ctrl/Cmd+N` and `Ctrl/Cmd+O` alongside the existing save shortcuts so keyboard workflow still matches the promoted file actions.
- Validation: `npm run typecheck` and `npm run preview:build`.

## Lane K — serialized-envelope cleanup (2026-04-02)

- Added shared persistence helpers in `packages/operator-overlay-layout/src/document-schema.ts` so new saved documents keep `project.sceneFamilyGraphs` as the authored family store and omit `project.backgroundGraph` from disk.
- Updated preview-document persistence and source-default writeback to serialize through the shared persisted-document normalizer instead of cloning the runtime project envelope verbatim.
- Preserved backward compatibility: older files that still include `backgroundGraph` still load, and normalization rebuilds the live runtime projection when new files omit it.
- Validation: `npm run typecheck`, `npm run preview:build`, and a direct `tsx` smoke test confirming persisted documents report `persistedHasBackgroundGraph: false` while sanitized reloads report `reloadedHasBackgroundGraph: true`.

## Top-navigation shell cleanup (2026-04-02)

- Replaced the interim grouped top toolbar slab in `apps/overlay-preview/index.html` with baseline-foundry's real `bf-top-navigation` structure: responsive menu banner, dropdown action groups, and a first-class Parameters toggle.
- Updated `preview-shell-controller.ts` to render File, Document, Defaults, Export, and Motion actions as top-navigation dropdown menus instead of `bf-actions` toolbars, and wired the shell to `initTopNavigations()` so the mobile menu and dropdown behavior come from upstream runtime instead of preview-local header policy.
- Added the small local styling needed for this shell: a compact brand tag and button resets for dropdown command items, while removing the older grouped-toolbar-specific header styles.
- Follow-up cleanup fixed the shell grid wiring: the preview no longer uses `bf-application.has-navigation` without a real side navigation rail. It now uses a dedicated top-navigation shell layout so the BF menu bar spans the full app width while the resizable `480px` inline width only applies to the Parameters aside.
- Validation: `npm run typecheck` and `npm run preview:build`.

## File/View menu consolidation (2026-04-02)

- Collapsed the top navigation from fragmented `File` / `Document` / `Defaults` / `Export` / `Motion` menus down to a desktop-style `File` + `View` model. `File` now owns document, output-profile, export-settings, and source-default workflows plus direct export commands; `View` now owns overlay visibility, guide mode, and play/pause.
- Moved the remaining shell-level surfaces out of the Parameters rail and into baseline-foundry modal dialogs mounted by `preview-shell-controller.ts`: `Document`, `Output Profiles`, `Export Settings`, and `Source Defaults`.
- Removed the old shell accordion builders (`document-section.ts`, `export-section.ts`, `output-format-section.ts`, `source-default-section.ts`) so the Parameters rail stays parameter-only instead of duplicating file workflow state.
- Removed overlay visibility and guide-mode controls from `grid-section.ts` so preview-state controls live in one place instead of being split between the parameter surface and the nav.
- Switched the preview stylesheet import to the valid exported `baseline-foundry/presets/app-tier.css` preset because the sibling repo's current exported `presets/panel.css` artifact is malformed and was returning Vite/PostCSS errors.
- Validation: `npm run typecheck`, `npm run preview:build`, and Playwright DOM checks against a clean dev server confirming `File` and `View` menus, a single `Parameters` rail, mounted BF dialogs, and a working `Export Settings...` menu-to-modal path.

## Document setup UX follow-up (2026-04-02)

- Reworked the old `Output Profiles` modal into a real `Document Setup` workflow: existing sizes now render in a `bf-table` with radio selection, title, width, height, and row-level remove actions instead of the earlier repeated choice rows and active-only delete flow.
- Added direct custom-size entry through the final table row. New sizes are created from width and height inputs without forcing a preset selection first, and the runtime now supports generated `custom_{width}x{height}` output-profile keys so those dimensions survive the existing profile/document pipeline.
- Removed the standalone document-rename field from the shell modal. Recent-file access now lives in `Open Recent...`, while the current document name is shown in the top-navigation banner and truncates through the BF logo-title slot.
- Added right-aligned menu shortcut labels for the core File and View actions and wired the shell shortcuts that make sense in the browser authoring surface (`^N`, `^O`, `^S`, `^Shift+S`, `D`, `E`, `O`, `Space`).
- Validation: `npm run typecheck`, `npm run preview:build`, and Playwright checks confirming the top-nav file title, Document Setup table headings, custom-size add/remove flow without active-size switching, and working `D` / `E` keyboard shortcuts for `Document Setup...` and `Export Settings...`.

## Completed Execution Queue

- EQ-1 through EQ-12 are complete.
- Halo parity is intentionally closed for the current rebuild scope; the separate vignette overlay pass was removed after it caused export banding.
- Scatter now runs a deterministic operator-side relax/repulsion pass, so the full-frame point field no longer clumps like a simple random fill.
- An experimental fuzzy-boids GPU spike landed behind `?gpuBoids=1` or `localStorage["brand-layout-ops-gpu-boids-spike"] = "1"`; it uses WebGL2 simulation plus CPU `PointField` readback so SVG/single-frame export can consume the same snapshot seam. Follow-up validation aligned its cache/reset policy with the CPU preview, stopped animated upstream seed fields from causing per-frame structural resets, limited per-step neighbor scans to the active staggered prefix, moved the CPU solver onto a uniform-grid spatial partition so higher-count fallback runs no longer drop to raw all-pairs neighbor walks, and split live non-halo rendering onto dedicated scene-family canvases so GPU boids can render straight to a visible WebGL canvas without `readPixels` in the preview loop. Authored boid configs now clamp `maxNeighbors` into the paper-style `6–24` range, and live preview caps boid substeps to `1` above `1200` boids because a local benchmark of the cached CPU path at `2000` boids and `12` neighbors averaged about `16 ms` per frame at one substep versus about `31 ms` at two. The spike still does not implement the CPU solver's bounded local-neighbor search directly, so paper-mode boids continue to fall back to the CPU solver instead of silently diverging.
- Lane A1 landed: `scene-family-preview.ts` now evaluates the saved non-halo `backgroundGraph` through graph-runtime-backed preview operators instead of a preview-local graph walker. Overlay config mapping, GPU boids, and worker-boids preview behavior remain adapter-local, but orchestration now follows the same saved graph semantics the document persists.
- Key completed milestones: baseline-foundry shell swap, operator selector, operator-owned fuzzy-boids/phyllotaxis/scatter panels, document-owned scene-family configs, persisted background graph, the list-first network view, and the latest-release panel pressure test that removed downstream hybrid class drift from the live inspector shell.
- Pre-B cleanup landed: `scene-family-preview.ts` now renders non-halo families as point-field-only layers without preview guide or connective geometry, and the follow-up source cleanup removed palette-driven boid phasing while moving non-halo defaults toward full-frame white-point output.
- Lane B1 landed: `apps/overlay-preview/src/authoring-controller.ts` now owns selection, drag, resize, hit testing, and inline editing, while `main.ts` delegates the controller's init/render/reset/keyboard hooks instead of carrying the old inline interaction block.
- Lane B2 landed: `apps/overlay-preview/src/export-controller.ts` now owns composed-frame export, PNG sequence export, and `window.__layoutOpsAutomation`; single-frame PNG export now shares the same composed-frame path as sequence and automation export, and a Playwright smoke export against fuzzy-boids confirmed populated non-halo PNG output after the dedicated scene-preview canvas split.
- The downstream shell cleanup pass is materially complete for both surface classes and baseline shell runtime; remaining preview-shell debt is concentrated in dock-mode policy and other higher-level controllers rather than local alias CSS.
- Lane A2 landed: per-edit mirroring from graph nodes into `sceneFamilyConfigs` is removed. Section panels read graph nodes directly and fall back to operator defaults. `sceneFamilyConfigs` now only updates at family-switch boundaries (snapshot before rebuild) and during backward-compat automation apply. Export automation snapshots the graph only.
- Lane A3 landed: the operator parameter schema in `core-types` now supports `slider`, `readout`, `textarea`, and `color` field kinds alongside the original `number`/`boolean`/`select`. A schema→DOM renderer (`renderSchemaPanel`) was added to `parameter-ui`. All three scene-family operators (`phyllotaxis`, `scatter`, `fuzzy-boids`) now publish `parameterSchema` on their `OperatorDefinition`. A config-level schema for `OverlayPhyllotaxisConfig` was added to `background-graph.ts`, and the phyllotaxis section panel was converted from hardcoded DOM builders to schema-driven rendering as a proof of concept.
- Lane C3 landed: source-default orchestration extracted from `main.ts` into `source-default-controller.ts`.
- Lane C4 landed: `paragraph-styles-section.ts` confirmed dead and removed. `presets-section.ts` confirmed still imported and in use. `vanilla-typescale-audit.md` removed as stale.
- Lane C5 landed: `operator-overlay-layout/src/index.ts` decomposed into `document-schema.ts` (632), `background-graph.ts` (620), `field-defaults.ts` (313), `csv-resolution.ts` (270), `overlay-internals.ts` (34); barrel is 262 lines.

## Documentation system alignment (2026-04-01)

- Adopted 5-file documentation structure matching `baseline-foundry`: `docs/AGENT-INBOX.md` (inbox), `llm-handoff-context.md` (cold start), `docs/TODO.md` (active plan, renamed from `rebuild-plan.md`), `docs/product-roadmap.md` (long-term), `docs/history.md` (archive).
- Updated `AGENTS.md` with inbox pattern, session start/end workflow, and repo boundary.
- Updated all references in `.github/agents/brand-layout-ops.agent.md`, `llm-handoff-context.md`, and `README.md`.

## Lane D1 — action group separation (2026-04-01)

- Split the mixed `playback-export-section.ts` into three dedicated sections: `playback-section.ts` (play/pause transport), `export-section.ts` (PNG/sequence/settings), `source-default-section.ts` (reset/save default + status).
- Section registry now has 13 section builders (was 11).

## Lane D2 — file actions to shell chrome (2026-04-01)

- Moved file action buttons (New, Open, Save, Save As, Duplicate) from the Document accordion section into a dedicated `[data-file-toolbar]` nav element in the `bf-panel-header`.
- Document section now only shows name input, summary, status, and recent files.
- `buildFileToolbar()` populates the shell toolbar once during `init()`, independent of config-editor rebuilds.

## Lane D3 — document vs project naming decision (2026-04-01)

- Decided: "Document" is the correct user-facing working-unit label. The UI already uses it consistently (section name, file actions, workspace API). Internal types use `OverlayDocument*` prefix. File extension stays `.brand-layout-ops.json`. No rename needed.

## Schema-driven section conversions and halo helper extraction (2026-04-01)

- Converted all four operator section panels to schema-driven rendering via `renderSchemaPanel`:
  - `halo-config-section.ts`: 511 → 72 lines (86% reduction). Uses `HALO_FIELD_CONFIG_SCHEMA` with 17 sections and ~60 fields.
  - `phyllotaxis-section.ts`, `scatter-section.ts`, `fuzzy-boids-section.ts`: all converted from hardcoded DOM builders to schema-driven rendering using config schemas from `background-graph.ts`.
- Added `HALO_FIELD_CONFIG_SCHEMA` to `operator-halo-field/src/index.ts` (~130 lines of schema definition).
- Schema renderer (`parameter-ui/src/schema-renderer.ts`) expanded: supports `slider`, `readout`, `textarea`, `color` field kinds, nested dotted paths via `getByPath`/`setByPath`, `visibleWhen` conditional visibility, `object` param type.
- Extracted halo config merge helpers from `main.ts` into `operator-halo-field`: `getHaloConfigForProfile`, `mergeHaloConfigWithBaseConfig`, private `isRecord`. Removed unused `createDebugHaloFieldConfig` and `mergeHaloConfigWithDefaults`. `main.ts` lost ~95 lines.
- Removed dead `return` statement in `halo-config-section.ts::setNestedValue`.

## Phase 6 parity audit and export versioned naming (2026-04-01)

- Cross-repo parity audit completed for: overlay logo placement semantics, selected-element editor behavior, preset workflow, export workflow. All confirmed at parity with the reference repo.
- Remaining Phase 6 gap: export-relevant geometry consistency (visual comparison only — needs side-by-side screenshot pass).
- Implemented auto-versioned export naming matching the reference pattern:
  - Single PNG: directory picker → `output/{dims}/{name}-v{n}.png` with auto-version incrementing.
  - Preset export: directory picker → `presets/{dims}/v{major}.{minor}-{slug}.json`.
  - Both fall back to blob download when File System Access API is unavailable or user cancels.
- Helper `getNextVersionedPresetFileName` exported from `export-controller.ts` for reuse.
- `exportPreset` in `main.ts` now async with structured directory output.

### 2026-04-01 — CSV draft & playback controller extraction

- Extracted `csv-draft-controller.ts` (251 lines) from `main.ts`. Owns CSV staging, committing, flushing, and authoring-endpoint writes. Exposes `CsvDraftController` via `createCsvDraftController(deps)`.
- Extracted `playback-controller.ts` (103 lines) from `main.ts`. Owns rAF loop, play/pause, step. Moved `playbackFrameHandle` and `lastPlaybackFrameMs` out of module scope.
- `main.ts` reduced from ~2,653 to ~2,453 lines (−200).
- Typecheck clean after both extractions.
- Updated TODO.md drift signals (date → 2026-04-01, main.ts line count → ~2,453) and llm-handoff-context.md.

### 2026-04-01 — Overlay editing controller extraction

- Extracted `overlay-editing-controller.ts` from `main.ts`. It now owns selected-element text CRUD, linked logo-title sizing, selected-text style application, and the Selected Element action row.
- Removed the dead legacy `playback-export-section.ts` file after the section split had fully replaced it.
- Fixed dirty-state tracking for inspector-driven selected-element edits in `overlay-section.ts`; text/layout/style/logo changes made from the panel now mark the active document dirty just like authoring-layer edits.
- `main.ts` reduced from ~2,453 to ~2,311 lines.

### 2026-04-01 — Config editor controller extraction

- Extracted `config-editor-controller.ts` (238 lines) from `main.ts`. It now owns the inspector section registry, background-graph operator selector UI, accordion open-state restore, and config-editor rebuild wiring.
- `main.ts` reduced from ~2,311 to ~1,811 lines.
- Typecheck clean after extraction.

### 2026-04-01 — Document target controller extraction

- Extracted `document-target-controller.ts` (313 lines) from `main.ts`. It now owns saved document-size target CRUD, target-profile state pruning, and the Output Format subpanel rebuild logic.
- `main.ts` reduced from ~1,811 to ~1,586 lines.
- Typecheck clean after extraction.

### 2026-04-01 — Preset controller extraction

- Extracted `preset-controller.ts` (369 lines) from `main.ts`. It now owns preset save/update/delete, import/export, active-preset loading, and preset tabs rebuild logic.
- `main.ts` reduced from ~1,586 to ~1,363 lines.
- Typecheck clean after extraction.

### 2026-04-01 — Lane B GPU seam validation

- Added `tmp/export-brand-validation.mjs` to capture repeatable rebuild-side validation exports for the default halo frame plus fuzzy-boids GPU and CPU variants.

### 2026-04-01 — Baseline-Foundry shell compliance audit

- Audited `baseline-foundry` as a read-only reference for the next shell pass and confirmed the upstream contract we should adopt later: dark tone is `bf-theme is-dark`, the dense control surface is the shipped `panel` preset, and pinned resize or drawer behavior comes from `initResizableAsides()` plus `initPanelDrawers()` on canonical `bf-application` / `bf-aside` markup.
- Recorded the larger downstream cleanup as queued Lane F instead of starting it out of order: remove remaining local shell classes such as `.mascot-app`, `.stage*`, and `.operator-selector*`, and remove the remaining `[data-*]` style selector from `apps/overlay-preview/src/styles.css`.
- Captured validation outputs in `output/export-validation/2026-04-01/` and a matching reference frame in `output/export-validation/2026-04-01/reference/frame-0073.png`.
- B1 result: the GPU fuzzy-boids spike is not yet ready to be the default preview backend. At `instagram_1080x1350` and `t=3s`, the GPU and CPU fuzzy-boids exports differed by about `2.76%` of pixels (`40290 / 1458000`), with visible dot-radius mismatch despite broadly similar placement. Single-frame export timing stayed in the same few-hundred-millisecond band across validation runs, so the GPU spike did not show a decisive enough export win to justify default status.
- Product decision: keep the GPU spike as research-only opt-in behind `?gpuBoids=1` or `localStorage["brand-layout-ops-gpu-boids-spike"] = "1"`. The default preview path now stays on the CPU worker or CPU fallback until the export mismatch is resolved.

### 2026-04-01 — Phase 6 geometry gate closed

- Export automation now accepts a full persisted preview document via `preview_document`, and `tmp/export-brand-validation.mjs` now starts from the repo's authored source-default document by default. Validation runs no longer depend on whatever browser-local document state happened to be open.
- Fixed an export parity bug: fresh rebuild sessions now default overlay visibility to on unless explicitly disabled, and halo transparent exports now honor `transparentBackground` in `halo-renderer.ts` instead of baking the composition background into the stage canvas.
- Refreshed the authored instagram source-default buckets in `apps/overlay-preview/public/assets/source-default-config.json` to match the current reference defaults for `generic_social` and `speaker_highlight` after the parity pass exposed stale migrated positions.
- Regenerated a fresh `racoon-anim` reference frame and rebuilt-side validation outputs. Side-by-side screenshot review now closes the remaining export-relevant geometry gate, so Stage 1 parity is treated as complete and Phase 7 work is unblocked.

### 2026-04-01 — Stage render controller extraction

- Extracted `stage-render-controller.ts` from `main.ts`. It now owns overlay-graph evaluation, halo and scene-family preview canvas routing, SVG overlay assembly, and the shared stage render pipeline.
- `main.ts` reduced from ~1,363 to ~1,194 lines. Remaining concentration is output-profile switching plus document or preset workspace orchestration and shell bootstrap.
- Typecheck clean after the extraction and repair pass.

### 2026-04-01 — Preview shell controller extraction

- Extracted `preview-shell-controller.ts` from `main.ts`. It now owns document workspace UI rendering, file-toolbar construction, drawer open/close behavior, docked resize bootstrap, keyboard shortcuts, and preview-shell init sequencing.
- `main.ts` reduced from ~1,194 to ~1,122 lines. Remaining concentration is output-profile switching, content-format switching, and preview-document/workspace state orchestration.
- Restored a thin local `updateDocumentUi()` wrapper after the extraction left one stale `afterRender` hook in the config-section definitions.
- `npm run typecheck` and `npm run preview:build` both pass after the extraction.

### 2026-04-01 — Profile/document state controller extraction

- Extracted `profile-state-controller.ts` from `main.ts`. It now owns per-profile bucket persistence, export/halo profile state, output-profile switching, and content-format switching.
- Extracted `preview-document-state-controller.ts` from `main.ts`. It now owns persisted preview-document build/persistence, parse/apply/reset flows, and the post-load refresh sequence.
- Fixed dirty-state tracking for content-format changes in `content-format-section.ts`; switching format or content source now marks the current document dirty like other document-owned inspector edits.
- `main.ts` reduced from ~1,122 to ~1,033 lines.
- `npm run typecheck` and `npm run preview:build` both pass after the extraction.

### 2026-04-01 — Background graph controller extraction

- Extracted `background-graph-controller.ts` from `main.ts`. It now owns selected background-node normalization, selected-node updates, scene-family label formatting, and the graph-to-sceneFamilyConfig rebuild sync.
- `main.ts` reduced from ~1,033 to ~833 lines.
- `npm run typecheck` and `npm run preview:build` both pass after the extraction.

### 2026-04-01 — Plan re-audit and cleanup

- Re-audited the canonical docs against the live preview shell and current build health.
- Confirmed `npm run typecheck` and `npm run preview:build` still pass on the current repo state.
- Cleaned the stale README parity wording and refreshed the Resume Point so it reflects closed Stage 1 parity and the current Phase 7 focus.
- Resolved the TODO contradiction where Lane C was marked complete but the extraction checklist still left `main.ts` as an open goal; the composition-root goal is now treated as complete for this phase, with only optional cleanup remaining.
- Replaced the vague "multiple next directions" wording with a single active Phase 7 execution lane: the selected-operator pane (Lane E1-E3).
- Fixed the halo panel fallback message so it reflects the current operator-selector behavior, and halo inspector edits now mark the document dirty like the other scene-family panels.

## TODO cleanup — archiving completed lanes (2026-04-02)

Moved the following completed sections from `docs/TODO.md` to this archive:

- **Phases 1–6:** All parity verification complete. No blocking parity gaps remain. Halo, fuzzy-boids, scatter, overlay, layout, document workflow, export pipeline, keyboard shortcuts — all closed at the current rebuild scope.
- **Package split status:** All initial splits complete. Mask operators remain deferred.
- **Preview Shell Extraction:** All extraction checklist items done. `main.ts` is a composition root (~833 lines). Form helpers, SVG overlay, state protocol, document workspace, halo rendering, scene-family preview, authoring controller, export controller, CSV draft, playback, overlay editing, config editor, document targets, stage rendering, shell bootstrap, profile/content state, preview-document state, and background-graph controller are all in dedicated modules.
- **Lane E (selected-operator pane):** Complete. Workspace vs parameter rails split, unified selected-operator model, parameter pane follows selection.
- **Lane F (BF shell compliance):** Complete. Canonical dark panel contract, `bf-*`/`is-*` state classes only, shipped drawer/pinned-aside integration.
- **Lane G (document-model regression fixes):** Closed. File toolbar Chrome issue was profile-specific, localStorage presets removed, content-format section removed from config editor, source-default writeback confirmed working.
- **Lane H (document-first persistence):** Complete. All preset runtime and preview-document residue removed.
- **Lane I (graph-first family persistence):** Complete. `sceneFamilyGraphs` replaces `sceneFamilyConfigs` as the persisted envelope. Legacy load bridge preserved.
- **Lane J (docs audit + Houdini-style authoring shell):** Complete. Canonical docs follow stated roles, authored model locked, Layers palette, parameter pane follows layer selection, top-navigation with File/View menus.
- **Lane K (serialized-envelope cleanup):** Complete. Persisted documents omit `backgroundGraph`; runtime projection rebuilt on load.
- **Baseline-Foundry pressure test:** Complete. Live inspector renders credibly against current BF panel preset. All hybrid class names fixed.
- **Parity gap map and reference-repo cross-references:** Archived. No longer needed now that parity is closed.

Also:
- Deleted `docs/baseline-foundry-modal-feature-request.md` (already passed to baseline-foundry agent).
- Removed stale "Content Format" copy from `overlay-section.ts` CSV help text.
- Updated anti-drift checklist and discussion items to reflect content-format retirement.
