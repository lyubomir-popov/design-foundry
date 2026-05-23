# Product Roadmap

## Product shape

This product is a browser-native operator graph for branded editorial and motion output.

It should behave like a simplified Houdini for brand work with a rigorous, InDesign-like layout engine layered into the same document model:

- reusable operators
- inspectable intermediate data
- deterministic layouts
- interchangeable preview and export backends

The key product shape is not "Figma for brand design." It is a structured operator app where:

- a document can define one or more authored format variants instead of treating sizes only as export targets
- documents should be real local project files, not only browser-local state
- source defaults can seed new documents, but authored operator settings and graph wiring belong to the document itself
- layout stays rigorous and document-driven rather than freeform first
- scene families can be swapped behind the same layout and export stack
- halo, boids, phyllotaxis, and future generators should be peers at the scene layer rather than bespoke app branches
- composition should grow toward a true layer stack where multiple background, image, text, and future media layers can be ordered intentionally instead of freezing the current Three.js-under-text arrangement into a permanent special case
- shell-level project actions such as new, open, save, duplicate, reset default, and export should live in dedicated authoring chrome rather than being treated as just another parameter section
- stills, video, SVG, PDF, and EPS remain backend concerns instead of mutating the kernel semantics

The preferred document analogy is closer to draw.io or local Canva-style projects than browser-local preset CRUD:

- open an existing local document
- save the current state as a new document
- persist in-editor text placement, added or removed text blocks, and logo changes in the document itself
- treat CSV as an optional import or source path, not the primary persistence model for authored layout state

It should not try to become a full freeform design tool first.

## Current architectural guardrails

Use these to keep short-term work aligned with the product shape:

- A scene family must stay swappable. Halo, boids, phyllotaxis, and later generators should sit behind the same document, layout, and export stack.
- The layout engine stays rigorous and document-owned. Renderer adapters and preview-only helpers must not become the canonical home for layout semantics.
- Preview code is an adapter, not the product core. If a rule must survive renderer changes, it belongs in shared types, kernels, operator outputs, or backend contracts.
- Background graph execution should converge on one graph-shaped authority. `project.sceneFamilyGraphs` is the persisted family store; `project.backgroundGraph` is a derived live projection and should stay runtime-only in new files.
- The authored document should keep one authoritative instance of each editable layer or operator. Selection UIs, parameter panes, and shell chrome may point at that state, but they must not create editable shadow models.
- UI work should reduce hardcoded preview ownership over time. Prefer manifests, typed operator surfaces, and shared parameter rendering over adding more bespoke shell builders.
- Shell-level project actions belong in authoring chrome, not buried in operator panels.
- Export stays backend-driven. PNG, MP4, SVG, PDF, and EPS should share scene or document authority rather than each inventing their own semantics.
- Content-format as a user-facing concept is retired. Each document carries authored state, and the operator graph remains the north star for how content, layout, and export relate.

### Standing rules

1. Keep halo stable and closed unless a concrete regression appears.
2. Keep label orientation in adapters, not kernels.
3. Keep mascot composition adapter-side until reuse is concrete.
4. Visual output parity matters more than renderer parity.

## Current technical drift signals

These are not roadmap stages; they are current code-shape risks worth watching while execution work continues.

| Signal | Severity | Detail |
|--------|----------|--------|
| `main.ts` at ~1129 lines | Medium | The app is mostly controllerized, but the composition root still carries DOM query helpers, overlay-visibility glue, and final bootstrap wiring. Keep extracting only where the seam becomes genuinely reusable or clarifying. |
| `operator-halo-field/src/index.ts` at ~1467 lines | Medium | Contains both operator logic and extracted geometry helpers. Reaches into preview-level profile concepts via `getOutputProfileMetrics`. |
| `preview-shell-controller.ts` at ~1157 lines | Medium | Carries DOM query helpers and shell bootstrap wiring. The dead Formats dialog code was removed in the May 2026 audit. |
| ~~`operator-overlay-layout` scope mismatch~~ | Resolved | Renamed to `packages/document-model` (`@brand-layout-ops/document-model`) in the May 2026 audit. |

## Operator-surface north star

The current multi-surface parameter shell is still an interim shape. The longer-term target is a list-first or graph-first operator view where:

- the document's active operator graph is visible as a list first and a node graph later
- selecting an operator shows only that operator's typed parameters in the parameter pane
- document, file, playback, and export settings stay shell-level rather than posing as operator parameters
- operator panels are driven by manifests or schemas through shared parameter rendering instead of preview-local DOM builders
- typed graph payloads such as `PointField` stay first-order so operators can feed one another without preview-only glue

The current audit adds two constraints to that direction:

- the Parameters rail should stop acting as a mixed control plane for rendered-output switching, graph wiring, and operator fields in the same rebuild-heavy surface
- pane-open state and surface selection should be explicit controller state, not hidden one-shot flags consumed during rebuild
- operator insertion should eventually move to a Houdini-like add-operator tab or menu surface, so temporary `Family` / `Add` controls do not live in the Layers navigator long term

This implies a gradual shift, not a rewrite: section builders move out of the composition root first, operator-owned panels stabilize second, and only then does a selected-operator pane become a composition decision instead of a structural rewrite.

## Document/project model — Adobe-style variants over a Houdini core

The working unit in this product is a **document-project hybrid**: one `.brand-layout-ops.json` file that carries authored layout state, operator graphs, content bindings, and format-variant definitions together. The user-facing workflow should feel closer to InDesign alternate layouts, while the internal graph and execution model still borrows heavily from Houdini.

### Format variants

A single document can define multiple format variants. Each variant starts from a shared size preset or from another variant, but becomes a real authored surface once the user adjusts the grid, keylines, or overlay placement for that format.

This is not a pure Houdini ROP model. It is closer to Adobe alternate layouts with a Houdini-style execution layer underneath:

| Houdini concept | brand-layout-ops equivalent |
|-----------------|---------------------------|
| `.hip` file | `.brand-layout-ops.json` document |
| SOPs (geometry operators) | `sceneFamilyGraphs` — per-family operator graphs |
| Display flag / current ROP | `backgroundGraph` — runtime projection of the active family |
| Global preset menu | Shared document-size preset library |
| Alternate layouts / artboards | Authored format variants inside one document |
| Render to disk from ROPs | Output operator exports one or more authored variants |

**How format variants should persist:**

1. User chooses a global size preset or custom size and creates a new format variant.
2. The new variant gets an initial grid and overlay placement guess, optionally derived from another variant.
3. Grid changes, keyline changes, and overlay repositioning then become authored state for that variant, not transient export settings.
4. When the user saves (`Ctrl+S` or `File → Save`), the full document including all format variants is written to disk.
5. Export presets stay separate from authoring: they describe how to render the chosen variants, not how those variants are laid out.

**Auto-adjust and derivation:**

- Creating a new format variant from an existing one should carry forward a good first guess rather than starting from scratch.
- The carryover should remap layout intent, not just raw pixels: column count, row count, keylines, and overlay anchors should adapt to the new dimensions.
- A landscape-to-portrait switch may reduce columns or change row rhythm, but the derived variant should still preserve recognizable composition intent.
- The result must stay easy to override. Auto-adjust is a starting point for finesse, not a locked responsive system.
- The current compatibility-groundwork model now records `formatPresetKey` and `derivedFromFormatId` per format so preset origin and derivation can be preserved before the larger saved-file model is redesigned.
- The working preset rule is now explicit: a global preset seeds frame size, safe area, and baseline-grid structure together; document variants then own any later safe-area or grid overrides instead of mutating the global preset itself.
- The first concrete runtime slice now follows that rule when a format bucket is created: preset-backed variants keep preset safe-area and grid structure, while the source format still provides the initial authored layout guess.

**Benefits of variant-driven documents:**

- One campaign document can hold Instagram portrait, square, story, and landscape variants without forcing the user to rebuild each from zero.
- Shared content, scene families, and operator graphs can stay aligned across variants while each format keeps its own grid and placement decisions.
- Auto-adjust provides a strong starting point when deriving a new variant, reducing repetitive layout setup while keeping the final call with the designer.
- Bulk export still works, but it exports authored variants rather than pretending every size is the same layout with a different render target.

**Risks and best practices:**

- **Not every project needs multiple variants.** A single 1080×1350 format for one campaign is perfectly valid. Multi-variant is opt-in, not mandatory complexity.
- **Variants should stay within the same campaign intent.** If content, scene family, or operator graph would diverge substantially, use separate documents.
- **The active preview shows one variant at a time.** The shell should make switching explicit, and export can render one or many variants.
- **Global presets are seeds, not authority.** The preset library provides starting sizes; the document owns the authored variants and their per-format adjustments.
- **Export presets belong with output.** Named export preset CRUD should move toward the future Houdini-like output operator rather than staying as shell-only modal state.

### Audit outcome — May 2026

The latest editor and model audit narrows the document-shape decision:

- Keep the fast radio-button workflow for switching formats in the live shell. That interaction is good and should survive.
- Do not collapse authored variants into a pure Houdini-style output-node concept. Background animation, overlay layout, safe area, grid, and related tweaks are authored state, not just render targets.
- Do not move to one-document-per-size as the primary model either. That would make routine campaign work heavier and would fight the current quick-switch workflow.
- Prefer a hybrid: one document is the campaign container, each switched format is an authored variant inside that document, and output/export recipes remain a separate output concern.
- Cross-document reuse is a separate problem from variant switching. If the user wants a tweaked background animation or foreground layout to carry into future documents, that should come from reusable template or preset seeds, not by forcing documents or variants to impersonate export nodes.
- Same-size authored duplicate variants remain optional future work. They should unlock only when there is a concrete workflow that needs multiple authored alternatives at the same dimensions.
- Presets should be copy-on-apply. The normal workflow is: start from a known-good preset, make local adaptations for the current format or dimensions, save the file, and expect those adapted settings to reopen with the document without explicitly saving a new preset. Saving back into the preset library is an optional reuse action, not the default persistence path.
- This implies a clean ownership split: documents persist concrete operator instances and their adapted settings, operator presets provide reusable seeds for those instances, and output presets describe delivery only.

### Persistence architecture summary

```
sceneFamilyGraphs     ← persisted, carries ALL operator graphs per family
backgroundGraph       ← runtime-only, rebuilt from sceneFamilyGraphs[sceneFamilyKey]
project.targets       ← current persisted format rows; should evolve toward authored format variants
project.sceneFamilyKey ← persisted, which family is active
params (overlay)      ← persisted, authored text, logo, layout state
exportSettings        ← persisted, per-profile export config
contentFormatKey      ← internal plumbing (retired concept, no UI surface)
```

The file on disk carries everything needed to reconstruct the full runtime state. Runtime-only projections like `backgroundGraph` are rebuilt during normalization/load — the same way Houdini rebuilds display-flag geometry from SOPs on scene open rather than caching the viewport mesh. The authoring model above that runtime should stay variant-first, not output-first.

## Near-term design questions

These are important, but they are not active execution items until explicitly promoted into `TODO.md`.

- How far should the shell/operator boundary go before the Layers palette and rendered-output switching stop living inside the same Parameters rail as operator fields?
- What is the smallest durable state model that removes the current mirrored `current` vs `per-format` persistence choreography without forcing a premature saved-file rewrite?
- Reusable size presets should live in a global library rather than hiding behind per-document CRUD or source-default writeback.
- If copy-on-apply operator presets expand beyond Halo, they should converge on one shared operator-preset library surface instead of growing bespoke picker UI one operator at a time.
- Global size presets should stay coupled to their default safe area and grid seed. Those defaults are the first guess, not immutable authority, so document variants must remain free to override or replace them.
- Variant derivation and auto-adjust should carry forward a useful first guess for grid intent, keylines, and overlay anchoring when a new format is derived from another.
- Output recipes should belong to the future output operator surface. Output should render authored variants, not define them.
- GPU or alternate execution backends should stay opt-in and justified by profiling, not by architecture fashion.
- `operator-spokes` should remain coarse until finer decomposition produces real reuse.
- Paragraph-style authoring should wait for a stable operator-scoped authoring shell.

### Content-format retirement

Content-format as a user-facing concept is dead. The document authoring model replaces it:

- Each document **is** its own content variant. Instead of switching formats within one document, you save separate documents or rely on CSV row selection for per-row content.
- The `contentFormatKey` runtime routing was consolidated in the May 2026 audit: `PreviewState` no longer carries `contentFormatKey` or `contentFormatKeyByDocumentFormatId`, `switchContentFormat()` is removed, and all bucket lookups use the hardcoded `DEFAULT_CONTENT_FORMAT_KEY` constant. The persistence shape still writes `contentFormatKey` for backward compatibility.
- The Houdini north star reinforces this: a `.hip` file does not have "content modes" — it has authored state, operator graphs, and outputs. So should this product.

## Roadmap

### Stage 0. Kernel extraction ✓

Goal:

- establish the shared graph and kernel packages

Status: **Complete.**

Deliverables:

- core types
- graph runtime
- grid kernel
- text kernel
- layout engine
- rebuild plan and handoff docs

### Stage 1. Parity rebuild ✓

Goal:

- reproduce the current app's working overlay and scene behavior in this repo

Status: **Complete.** All parity milestones (Phases 1–6) closed.

Deliverables:

- runnable preview app
- overlay layout operator
- parameter UI engine
- selected-element interaction layer
- coarse spokes and orbits operators

Success criteria:

- the new repo can match current overlay placement and editing behavior closely enough to replace the current architecture for ongoing work

### Stage 1.5. Format-variant authoring refinement ✓

This was the bridge between closed parity work and broader operatorized scene building.

Status: **Complete.** Stable format ids, preset-backed seeding, copy-on-apply operator presets (all four background operators), panel-hosted Formats, Tab-key Add Node menu, and Layers navigator cleanup all landed. Remaining design questions (shared operator-preset library surface, same-size authored variants) deferred to Stage 3 or later when concrete needs emerge.

Goal:

- make the authored-format model honest before broader operatorized scene building resumes

Deliverables:

- stable format ids through output-profile mutation
- preset-backed versus derived-variant seeding rules
- compatibility-safe active-format save/load behavior
- a deliberate decision on same-size authored variants and the timing of any saved-file migration

Success criteria:

- format switching, derivation, and persistence behave like authored layout variants rather than export-target mutation, without forcing a premature saved-file schema break

### Stage 2. Operatorized scene building

Goal:

- make procedural scene composition reusable rather than app-specific

Deliverables:

- point or field generator operator
- SVG instancing operator
- compositing or layer-stack operator family
- background and layout composition in one graph
- typed point or field handoff between operators so generators can seed downstream solvers without preview-local glue
- swappable scene-family operators that can drive the same document through different motion systems

Success criteria:

- one campaign document can mix structured layout with procedural motion without bespoke glue code, and can swap one scene family for another without rewriting the layout or export path
- operator outputs can be passed forward as first-order graph payloads rather than being collapsed into preview-only state

### Stage 3. Local document model maturation (partially landed)

Goal:

- finish hardening the authored layout state and format-variant model as real local documents instead of leaving important behavior in runtime compatibility bridges

Status: **Substantially complete.** Open/save/save-as, recent documents, document-owned scene-family graphs, per-format variant persistence, and SVG export are all shipped. Remaining: cleaner separation of authored vs imported content, same-size authored variants, and the larger saved-file schema simplification.

Deliverables:

- local filesystem-backed document format for overlay and scene state
- open, save, save-as, and recent-document workflow
- persistence for in-editor text placement, added or removed text fields, logo asset changes, and per-document output settings
- document-owned scene-family selection plus saved background or operator graph state so the same document model can point at halo today and boids, phyllotaxis, or other background operator stacks later
- document-owned per-node parameter state and connection data for swappable background or scene-family stacks
- document-owned format-variant groups so one document can carry multiple authored formats instead of being trapped in a single preview session
- clearer separation between authored document state and imported content sources like CSV

Success criteria:

- a user can treat the app like a real local project editor: open a document, edit text and placement, add or remove fields, change the logo, save, duplicate as a new document, and reopen later without relying on browser localStorage
- the document model is broad enough that scene-family swaps, target-size additions, and PNG or image-sequence or MP4 export all remain document-driven instead of becoming preview-only glue
- the saved document, not browser-local UI state, is authoritative for scene-family choice, operator settings, and graph wiring

### Stage 4. Stakeholder and operator surfaces

Goal:

- separate the operator-facing tuning surface from the stakeholder-facing export surface

Deliverables:

- operator mode for graph and parameter tuning
- contextual parameter panels driven by the selected operator, layer, or graph node instead of one monolithic document accordion
- a list-first layer or network palette that lets the document root, background operators, overlay root, and overlay child objects expose their own scoped controls, with a graphical node editor later if needed
- the network view reads the persisted operator graph from the document model instead of introducing a second source of truth
- dedicated shell navigation for project and export actions so file operations do not stay mixed into the operator parameter stack
- a ROP-style output operator surface that owns named export presets and render-target policy instead of burying that state in shell-only dialogs
- stakeholder mode for template, row, and format selection
- document-size selection from a global preset library shared across projects, without exposing low-level operator tuning
- content validation and safer writeback
- stakeholder actions that operate on document files instead of only transient browser state

### Stage 5. Export backends

Goal:

- support screen and print-oriented outputs through dedicated backends

Deliverables:

- PNG and MP4 parity
- SVG export backend
- PDF or EPS-capable backend
- CMYK intent path with controlled replacement or backend conversion

### Stage 6. Broader brand scene system

Goal:

- support multiple branded scene families beyond the current mascot motion use case

Deliverables:

- reusable operator libraries
- template packages
- scene presets
- global document-size presets and template CRUD for new branded scene families
- better packaging and dependency management per project

## Product warnings

### Warning 1. Over-splitting too early

If every visual sub-step becomes its own package too soon, the graph becomes harder to reason about than the current monolith.

### Warning 2. Renderer-led regression

If Three.js owns placement or document semantics, the rebuild will fail its main purpose.

### Warning 4. Preview-shell product drift

If canonical document rules, scene defaults, or operator surfaces keep living in the overlay-preview app, the repo will slowly recreate a bespoke Ubuntu Summit editor instead of becoming a reusable operator product.

### Warning 3. Print complexity too early

SVG, EPS, PDF, and CMYK matter, but they must remain backend-driven until the kernel is stable.