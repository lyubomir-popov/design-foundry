# History — Completed Work

Items moved here from `TODO.md` to keep the active backlog lean.

## Short-term

## Tab-key Add Node menu and Layers navigator cleanup (2026-05-21)

- Implemented Houdini-style Tab-key Add Node popup in `preview-shell-controller.ts`: Tab (when no form element is focused) opens a centered floating menu listing all available background operators. Click or Enter adds the node, selects it, and opens its parameters. Escape dismisses. Arrow keys navigate.
- Added `getAddNodeMenuEntries()` and `addBackgroundNode(operatorKey)` to `PreviewShellControllerDeps` and wired them in `main.ts`.
- Added CSS for `.bf-add-node-popup` and `.bf-add-node-popup-item` in `styles.css`.
- Updated `verify-ui-regressions.ts` `addBackgroundNode()` helper to use Tab key + menuitem click instead of the old combobox/button pattern.
- Removed dead code from config-editor-controller: `getAvailableBackgroundOperatorKeys()` and `addBackgroundNode()` deps, dead `getBackgroundOperatorLabel()` function, unused `OVERLAY_SCENE_FAMILY_ORDER` and `OverlayBackgroundOperatorKey` imports.
- Removed dead `getAvailableBackgroundOperatorKeys()` wrapper and config-editor wiring from `main.ts`.
- Lane P (format variants and preset groundwork) closed. Stage 1.5 complete.

## contentFormatKey consolidation + architecture doc rewrite (2026-05-21)

- Consolidated `contentFormatKey` bridge: removed `contentFormatKey` and `contentFormatKeyByDocumentFormatId` from `PreviewState`, removed `ContentFormatKeyByDocumentFormatId` type, removed `switchContentFormat()` from controller and context interfaces. All bucket lookups now use `DEFAULT_CONTENT_FORMAT_KEY` constant. Persistence shape unchanged for backward compatibility.
- Files touched: `preview-app-context.ts`, `main.ts`, `profile-state-controller.ts`, `csv-draft-controller.ts`, `preview-document-bridge.ts`, `document-target-controller.ts`, `verify-document-persistence.ts`.
- Rewrote `docs/architecture.md` from aspirational 4-layer sketch to actual codebase map: 16 packages, controller structure, adapter/renderer split, document model types, export backends, verification scripts.
- Renamed `packages/operator-overlay-layout` → `packages/document-model` (npm package `@brand-layout-ops/document-model`). Updated all 25 source file imports, vite.config.ts alias, package.json, package-lock.json, README.md, STATUS.md, ROADMAP.md, and architecture docs.
- Updated `ROADMAP.md` drift signals (removed resolved contentFormatKey signal, resolved operator-overlay-layout rename, updated shell-controller signal) and content-format retirement section.
- Validation: `npx tsc --noEmit` clean, `verify:document-persistence` passes.

## Kernel unit tests (2026-05-21)

- Added Vitest as devDependency and `test` / `test:watch` npm scripts.
- Created 56 unit tests across three kernel packages:
  - `graph-runtime` (11 tests): OperatorRegistry register/get/unknown-key, topologicallySortGraph linear/diamond/single/independent/cycle, evaluateGraph async/input-passing, evaluateGraphSync sync-chain/async-throws.
  - `layout-grid` (20 tests): computeLayoutGridMetrics basic/non-negative/safe-area/ignore-safe-area/single-col-row/zero-baseline/monotonic-keylines/row-baseline-alignment, getKeylineXPx first/last/clamped, snapXPxToKeyline nearest/far-left, getColumnSpanWidthPx single/two/full/clamped, snapBaselineToGrid zero-offset/positive-offset/valid-reconstruction.
  - `layout-text` (25 tests): createApproximateTextMeasurer single-char/wider/larger-font/ascent-descent/whitespace/custom-ratios, wrapTextLines empty/whitespace/short/long/paragraph-breaks/oversized-word/word-boundaries, measureTextBlock max-width/ascent-descent, getMinimumFirstBaselineInsetPx positive/scaled, resolveTextPlacement empty-null/whitespace-null/correct-anchors/positive-bounds/wrapping/clamped-keyline/clamped-row/clamped-span.
- Validation: all 56 tests pass, `npx tsc --noEmit` clean.

## Generic operator preset system (2026-05-21)

- Added `OperatorPresetDefinition` type to `packages/core-types/src/index.ts`.
- Generalized `operator-preset-controller.ts`: internal storage moved from a single `userHaloPresetDefinitions` array to a `Map<string, OperatorPresetDefinition[]>` keyed by operator slug. Added `getUserPresetDefinitions(operatorKey)` and `saveCurrentPreset(operatorKey, label, config, description?)` generic methods. Halo-specific convenience wrappers (`getUserHaloPresetDefinitions`, `saveCurrentHaloPreset`) retained as thin wrappers for backward compat.
- Added `getUserPresetDefinitions` and `saveCurrentPreset` to `PreviewAppContext` interface and wired in `main.ts`.
- Created shared `operator-preset-picker.ts` — reusable preset picker UI builder (select + apply + save) that any operator section can use.
- Added built-in presets to `packages/document-model/src/background-graph.ts`:
  - Fuzzy Boids: Gentle Drift, Tight Swarm, Scattered Wander
  - Scatter: Sparse Fill, Dense Circle, Weighted Cloud
  - Phyllotaxis: Sunflower, Tight Whorl, Static Field
- Wired preset pickers into `fuzzy-boids-section.ts`, `scatter-section.ts`, and `phyllotaxis-section.ts`.
- Per-format config storage stays Halo-only (other operators are deterministic and scale-agnostic).
- Persistence shape unchanged: `operator-presets.json` at `operators.<key>` arrays.
- Validation: `npx tsc --noEmit` clean, 56 unit tests pass.

## Comprehensive repo audit and housekeeping (2026-05-21)

- Ran two competing audit subagents (GPT-5.4 and Opus 4.6) to identify stale files, architectural drift, dead code, and documentation inconsistencies.
- Archived 420+ lines of old HISTORY.md entries to `docs/archive/2026-early.md` (was 666 lines, now ~246).
- Added `tmp/` to `.gitignore` and untracked 25 committed debugging artifacts.
- Removed stale `projects/` files: HTML browser snapshots, untitled placeholder, proof artifact.
- Deleted stale one-off audit reports from `docs/`.
- Updated `README.md` "Later additions": SVG export and field generators are now marked as shipped.
- Updated `docs/future-backends.md`: SVG export is described as shipped rather than future.
- Updated `ROADMAP.md`: Stages 0+1 marked complete, Stage 1.5 annotated as active, Stage 3 annotated as partially landed. Drift signals table refreshed with current file sizes and new architectural signals (`contentFormatKey` bridge, `operator-overlay-layout` scope mismatch, dead Formats dialog).
- Triaged stale May 13 demo priority section in `TODO.md` and added audit housekeeping + architectural TODO items.
- Removed dead `ensureFormatsDialog()` and `openFormatsDialog()` from `preview-shell-controller.ts`; `Formats...` menu and `D` shortcut now call `openFormatsPanel()` directly.
- Removed dead `saveOutputFormatKey` / `loadOutputFormatKeys` no-op stubs from `sample-document.ts`, `main.ts`, `profile-state-controller.ts`, and `preview-document-bridge.ts`.
- Fixed `verify-ui-regressions.ts` fixture mismatch: automation now uses `video-intro-export.brand-layout-ops.json` (the canonical fixture per docs) instead of `video-intro-export.json`.
- Updated `STATUS.md`: trimmed completed-lane detail, closed demo rehearsal, updated active queue.
- Validation: `npx tsc --noEmit` clean.

- Added a dedicated SVG export backend in `apps/overlay-preview/src/svg-document-serializer.ts` that walks the same geometry as the Three.js renderer and outputs a standalone SVG document. Covers background spokes, intro/post-finale dots, thin/thick spokes with echo markers, release labels, mascot overlay, and authored text/logo overlay.
- Extracted shared pure-math geometry helpers into `packages/operator-halo-field/src/halo-geometry-helpers.ts` so both the Three.js renderer and the SVG serializer share the same radial-fade, reveal-alpha, spoke-reveal, fold-seam, ray-circle-segment, thick-spoke-width, echo-marker-geometry, content-band-metrics, and text-label-font-size functions.
- Added `print_a4_2480x3508` and `print_a3_3508x4961` to `OUTPUT_PROFILE_ORDER` and `OUTPUT_PROFILES` in `packages/core-types/src/index.ts`.
- Wired `Export SVG` menu item and `exportSvgDocument()` in the preview shell, export controller, and app context.
- Fixed XML-invalid `font-family` attribute: replaced CSS-style double-quoted `"Ubuntu Sans"` with XML-safe single-quoted `'Ubuntu Sans'` inside the SVG `font-family` attribute.
- Fixed nested `<svg>` wrapper: authored overlay markup is now unwrapped from its outer `<svg>` tags into `<g class="authored-overlay">` before embedding.
- Inlined mascot SVG assets: mascot face and halo are now fetched as raw SVG text, stripped of their outer `<svg>` wrapper, and embedded as inline markup with viewBox-to-pixel transforms instead of `<image href="data:...">` elements.
- Replaced 16-segment-per-spoke background spoke rendering with single `<line>` per spoke using `<linearGradient>` (8 stops) for smooth radial fade, producing cleaner Illustrator-friendly output.
- Fixed the 0 KB save bug: moved `buildPersistedDocument()` + `JSON.stringify()` inside a dedicated try/catch so serialization errors after `showSaveFilePicker` no longer leave empty files on disk.
- Added empty-content guard in `writeDocumentFileText`: refuses to write empty or whitespace-only content.
- Added writable-stream abort on error: `FileSystemWritableFileStream` is now aborted if write or verification fails after `createWritable` succeeds.
- Replaced `void` with `.catch()` on Ctrl+S / Ctrl+Shift+S keyboard shortcuts so save failures are logged to console instead of silently swallowed.
- Validation: `npx tsc --noEmit` clean, dev server running, SVG export verified in browser.

- Extended the drag-only authoring guides in `apps/overlay-preview/src/authoring-controller.ts` and `apps/overlay-preview/src/styles.css` so selected text blocks show one soft full-width red baseline line per wrapped row only while they are actively being dragged.
- Restored non-heading text deletion from both the selected-text Parameters action row and the keyboard path in `apps/overlay-preview/src/overlay-editing-controller.ts`, `apps/overlay-preview/src/overlay-section.ts`, and `apps/overlay-preview/src/preview-shell-controller.ts`, with `Delete` and `Backspace` both routed through the same delete action.
- Added snapshot-based preview-document undo or redo and extracted the policy into `apps/overlay-preview/src/preview-history-controller.ts`, leaving `apps/overlay-preview/src/main.ts` as controller wiring while a single-flight guard prevents rapid repeated shortcut presses from interleaving history transitions.
- Stabilized the checked-in `projects/1080p.brand-layout-ops.json` demo document for recording: the working file now defaults back to Full HD, keeps the lighter gray `#2b2b2b` background across saved format profiles, starts with guides off, and carries the latest inline-text or AV export defaults used in rehearsal.
- Preserved the current story-format live variant separately as `projects/1080p.brand-layout-ops-v2.json` so the newly stabilized Full HD recording file and the user-adjusted baseline-guide-on variant both remain available.
- Validation: `npm run typecheck` in the isolated branch worktree and a live branch-preview check at `http://127.0.0.1:4175/#document=1080p.brand-layout-ops.json` covering `Delete Text`, undo, redo, and rapid repeated `Ctrl` or `Cmd+Z` plus `Ctrl` or `Cmd+Shift+Z` shortcut presses.

## Desktop Parameters rail restoration (2026-05-12)

- Restored the overlay preview's desktop Parameters rail behavior in `apps/overlay-preview/src/preview-shell-controller.ts` by lowering the dock breakpoint to match normal integrated-browser desktop widths, keeping the BF `is-medium` aside size class when pinned, and preventing the top-nav `Parameters` control from collapsing the rail in docked mode.
- Restored the earlier narrower default rail width in `apps/overlay-preview/src/styles.css` while keeping BF's resizable-aside contract live, and hid the drawer-only `Close` affordance when the pinned desktop rail is showing ordinary Parameters content.
- Confirmed the fix stays on the upstream BF contract: the vendored BF `os` shell already includes pinned resizable-aside support, so no new upstream BF layout request was needed for this slice.
- Validation: `npm run typecheck`, clean editor diagnostics for the touched files, and live preview checks at `http://127.0.0.1:4173/` confirming reload settles into `has-pinned-aside` + `bf-aside is-medium is-pinned`, the top-nav `Parameters` control no longer collapses the desktop rail, the desktop `Close` control is hidden in Parameters mode, and the BF resize handle reports as active again.

## Standalone BF snapshot for overlay preview (2026-05-11)

- Moved the overlay preview off the live `file:../baseline-foundry` dependency and onto a vendored local Baseline Foundry snapshot: the preview now imports a repo-local BF `os` tier stylesheet, bundles a local Ubuntu Sans variable font, and vendors the top-navigation, panel-drawer, range-control, and resizable-aside helpers so both dev and production builds no longer require the sibling BF clone.
- Removed the explicit sibling BF path from `apps/overlay-preview/vite.config.ts`, refreshed the lockfile, and verified the preview still builds with `node_modules/baseline-foundry` absent.
- Validation: `npm run preview:build`, `npm uninstall baseline-foundry`, `npm install --package-lock-only`, and a live `http://127.0.0.1:4173/` smoke check with the existing preview task still serving.

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

Older long-term entries archived to `docs/archive/2026-early.md` on 2026-05-21.
