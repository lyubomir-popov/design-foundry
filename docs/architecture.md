# Architecture

## Goal

Provide a stable kernel for a browser-native operator graph that can drive branded layout, procedural background generation, composition, preview, and export.

## Layer map

### 1. Core types — `packages/core-types`

Shared interface definitions consumed by every other package: `FrameSize`, `Vector3`, `Quaternion`, `ColorRgba`, `OutputProfile`, `LayoutGridMetrics`, `TextStyleSpec`, `LogoPlacementSpec`, `OperatorDefinition`, `GraphNode`, `GraphEdge`.

### 2. Graph runtime — `packages/graph-runtime`

Operator evaluation engine. `OperatorRegistry` holds operator definitions by key. `topologicallySortGraph()` resolves execution order. `evaluateGraph()` / `evaluateGraphSync()` run the graph and return per-node outputs.

### 3. Layout kernels

Pure computation packages with no renderer or DOM dependencies.

| Package | Key exports |
|---------|------------|
| `layout-grid` | `computeLayoutGridMetrics()`, `getKeylineXPx()`, `snapXPxToKeyline()`, `getColumnSpanWidthPx()`, `snapBaselineToGrid()` |
| `layout-text` | `createApproximateTextMeasurer()`, `wrapTextLines()`, `measureTextBlock()`, `resolveTextPlacement()` |
| `layout-engine` | `resolveLayerScene()` — computes a complete layout scene from grid, text fields, styles, and logo placement |

### 4. Operators

Each operator exposes an `OperatorDefinition` manifest with typed params. Parameter UI is auto-generated from these manifests by `packages/parameter-ui`.

| Package | Domain |
|---------|--------|
| `document-model` | Document schema, background graph, CSV resolution, format presets, document persistence helpers |
| `operator-halo-field` | VEX-faithful halo spoke × orbit dot-grid computation, shared geometry helpers for Three.js and SVG |
| `operator-copy-to-points` | Instance prototypes at point positions with attribute mapping |
| `operator-fuzzy-boids` | Boid simulation (separation, alignment, cohesion, bounds) |
| `operator-phyllotaxis` | Fibonacci spiral layout |
| `operator-scatter` | Random point scatter |
| `operator-orbits` | Orbit path generation |
| `operator-spokes` | Radial spoke generation |

### 5. Document model — `packages/document-model/src/document-schema.ts`

The canonical document types:

- `OverlayDocumentProject` — full document tree (metadata + format variants + operator state)
- `OverlayDocumentFormat` — id, label, outputProfileKey, formatPresetKey, derivedFromFormatId
- `OverlaySourceDefaultSnapshot` — runtime state: outputProfileKey, contentFormatKey, profileFormatBuckets, exportSettings, haloConfig, guideMode
- File kind: `brand-layout-ops.document`, version 1

### 6. App — `apps/overlay-preview`

**Composition root:** `main.ts` wires controllers and passes typed `PreviewAppContext` to all subsystems.

**Controller structure:**

| Controller | Responsibility |
|------------|---------------|
| `document-workspace.ts` | Open, save, close, new document orchestration |
| `document-target-controller.ts` | Format/profile selection and switching |
| `profile-state-controller.ts` | Output profile switching |
| `preview-history-controller.ts` | Undo/redo snapshot stack |
| `config-editor-controller.ts` | Inspector rebuild + Layers palette |
| `overlay-editing-controller.ts` | Logo/text drag, resize, interactivity |
| `authoring-controller.ts` | Parameter editing and authoring guides |
| `stage-render-controller.ts` | Render pipeline orchestration |
| `stage-network-overlay-controller.ts` | Graph visualization overlay |
| `export-controller.ts` | PNG/MP4/SVG export entry point |
| `operator-preset-controller.ts` | Preset browsing and copy-on-apply |
| `preview-shell-controller.ts` | Shell bootstrap, keyboard shortcuts, menus |
| `background-graph-controller.ts` | Scene family graph mutations |
| `csv-draft-controller.ts` | Inline CSV editor |
| `playback-controller.ts` | Animation frame timing |

**Composition layer:** `preview-composition.ts` defines the layer registry (halo-webgl, scene-preview-cpu/gpu, halo-labels, authored-overlay) and output sinks (frame-preview, png-still, png-sequence, svg-document, pdf-document).

**Scene families:** `scene-family-preview.ts` maps scene types (halo, phyllotaxis, scatter, fuzzy-boids) to their preview builders. Each has a dedicated section file (e.g. `halo-config-section.ts`, `fuzzy-boids-section.ts`).

### 7. Adapters

Adapters consume kernel outputs. They must not become sources of truth.

| Adapter | File |
|---------|------|
| Three.js halo renderer | `apps/overlay-preview/src/halo-renderer.ts` + `three-primitives.ts` |
| SVG export | `apps/overlay-preview/src/svg-document-serializer.ts` + `svg-overlay-adapter.ts` |
| PNG sequence export | `scripts/export-headless.ts` (Playwright automation) |
| MP4 encode | `scripts/encode-mp4.ts` (FFmpeg wrapper) |

### 8. Verification scripts

| Script | Purpose |
|--------|---------|
| `verify-document-persistence.ts` | Document round-trip serialization tests |
| `verify-ui-regressions.ts` | Headless Playwright UI regression checks |
| `export-geometry-parity.ts` | Export geometry validation |

## Design rules

- If a function answers "where does this go?" or "what width should this be?", it belongs in a kernel.
- If a function answers "how do I draw this?", it belongs in an adapter.
- Operator manifests drive parameter UI — `parameter-ui/schema-renderer.ts` auto-generates forms from operator definitions.
- Three.js is one renderer, not the authority. SVG and future backends consume the same kernel data without WebGL dependencies.
- Controllers receive typed `PreviewAppContext` instead of reaching into `main.ts` globals.