# Baseline Foundry

Lean baseline-aligned design system focused on:

- editorial typescale
- element-owned spacing
- grid primitives
- page and section rhythm
- a small amount of demo/runtime support

This repo is the clean sibling to `portable-vertical-rhythm`.
That older package remains the compatibility line for `brand-layout-ops`.
This repo is the forward-looking line: smaller, more versatile, and centered on baseline, prose flow, and grid rather than broad component parity.

## Principles

See `docs/TODO.md` for the full set. Summary:

- Baseline alignment is non-negotiable.
- Editorial spacing is element-owned; app-tier is zero-nudge, container-owned.
- Grid and layout primitives are small and composable.
- Dogfooding: demos use only `bf-*` classes.

For a longer write-up on empirical nudges, cap-unit alignment, raw metrics, and compensated metrics, see `docs/comparing-baseline-alignment-techniques.md`. Its visual companion lives at `demo/components/engine-illustration.html`.

## Output

Build output includes:

- `dist/styles.css`
- `dist/tokens.json`
- `dist/surfaces.json`
- `dist/tiers/editorial/styles.css`
- `dist/tiers/editorial/tokens.json`
- `dist/tiers/editorial/surfaces.json`
- `dist/tiers/documentation/styles.css`
- `dist/tiers/documentation/tokens.json`
- `dist/tiers/documentation/surfaces.json`
- `dist/tiers/app/styles.css`
- `dist/tiers/app/tokens.json`
- `dist/tiers/app/surfaces.json`
- `dist/tiers/os/styles.css`
- `dist/tiers/os/tokens.json`
- `dist/tiers/os/surfaces.json`
- `dist/presets/prose/styles.css`
- `dist/presets/prose/tokens.json`
- `dist/presets/prose/surfaces.json`
- `dist/presets/panel/styles.css`
- `dist/presets/panel/tokens.json`
- `dist/presets/panel/surfaces.json`
- `dist/presets/app-tier/styles.css`
- `dist/presets/app-tier/tokens.json`
- `dist/presets/app-tier/surfaces.json`
- `dist/index.js`
- `dist/build.js`

## Quick Start

```bash
npm install
npm run setup:demo-font
npm run playwright:install
npm run build
npm run test
npm run screenshots:components
npm run demo
```

List or build tiers directly with:

```bash
npm run build:theme -- --list-tiers
npm run build:theme -- --tier=os
```

List or build presets directly with:

```bash
npm run build:theme -- --list-presets
npm run build:theme -- --preset=panel
```

While `npm run demo` is running, edits under `config/**/*.json` now rerun `npm run build:theme` automatically and force a full page reload.

`npm run setup:demo-font` downloads the font files needed for metric-driven nudge generation.

The generated `dist/styles.css` emits matching `@font-face` rules so the demo and downstream consumers can render the font without a separate loader step.

The demo runs at:

- [http://127.0.0.1:4174/](http://127.0.0.1:4174/) — Living spec home
- [http://127.0.0.1:4174/demo/spec/typography.html](http://127.0.0.1:4174/demo/spec/typography.html)
- [http://127.0.0.1:4174/demo/panel.html](http://127.0.0.1:4174/demo/panel.html) — OS tier addendum
- [http://127.0.0.1:4174/demo/components/index.html](http://127.0.0.1:4174/demo/components/index.html)
- [http://127.0.0.1:4174/demo/components/engine-illustration.html](http://127.0.0.1:4174/demo/components/engine-illustration.html) — Three-way raw / compensated / cap comparison

Standalone Canonical example batches also live under `examples/grid/` and `examples/spacing/`. Each family has one shared stylesheet (`grid-examples.css` / `spacing-examples.css`) and stays aligned with the source prompts in `grid-examples.prompt.md` and `spacing-examples.prompt.md`.

## Component QA

The repo includes isolated component demo pages for visual rhythm and interaction checks. `demo/components/index.html` is the visual atlas, and the authoritative saved-page inventory lives in `scripts/component-demo-shared.ts` so the README does not need to mirror that list.

All component/spec/control pages now share the same thin page chrome: hamburger page list plus tone, baseline-grid, and tier controls. That chrome is excluded from screenshot comparisons and disabled during Playwright hit-testing so behavior checks interact with the component under test rather than the surrounding shell.

Component QA currently covers:

- Playwright screenshot capture for the saved demo inventory
- baseline verification for baseline-aligned surfaces
- behavior verification for pinned-aside resize, drawer overlay, and application-layout interactions
- the narrow-panel regression page so dense controls and media must still fit a tight rail

The grouped overview pages still exist as convenience entry points:

- `demo/components/controls.html`
- `demo/components/surfaces-navigation.html`

Install Playwright once with:

```bash
npm run playwright:install
```

Then capture the current component screenshots with:

```bash
npm run screenshots:components
```

Run the browser-enforced baseline verification with:

```bash
npm run verify:components
```

Run the browser-enforced resize behavior verification with:

```bash
npm run verify:behavior
```

Or do both in one pass:

```bash
npm run qa:components
```

The screenshots and manifest are written to:

- `tmp/screenshots/components/`

Those screenshots also power the visual atlas at `demo/components/index.html`, so run `npm run screenshots:components` when new demos are added or the saved preview set changes. The atlas frames now use `object-fit: contain`, so the saved previews can stay legible even when different components naturally want different capture widths.

The baseline verification report is also written to:

- `tmp/screenshots/components/baseline-report.json`

`npm test` now includes this Playwright baseline check, so once Chromium is installed the grid-alignment gate is part of the normal regression suite.

## Theme Model

The default theme uses Ubuntu Sans Variable and generates metric-driven typography tokens, spacing tokens, layout values, component density tokens, and a published surface manifest. Four first-class tiers plus legacy preset aliases:

| Tier/Preset | Purpose |
|---|---|
| `editorial` | Root default, widest long-form composition |
| `documentation` | Tighter chapter-reading tier |
| `app` | Canonical-facing application chrome |
| `os` | Dense OS-style addendum with editorial alignment and compact control geometry |

Legacy aliases: `prose` → editorial, `panel` → os, `app-tier` → app.

Independent surface contract:

- each built-in tier emits a complete scoped token surface instead of inheriting editorial defaults through diffs
- tier choice is a top-level class on any `.bf-theme` container: `.bf-tier-editorial`, `.bf-tier-documentation`, `.bf-tier-app`, `.bf-tier-os`
- multiple containers can coexist side by side under the same stylesheet
- `dist/surfaces.json` stores the runtime tokens and the font-metric artifact that produced each shipped surface
- the published manifest omits local build-machine config/baseline file paths, so the shipped JSON stays portable
- `app` keeps zero-nudge runtime tokens while still retaining its computed font metrics in the manifest

Action/field padding is part of that surface contract too. Every tier now emits `controlInlinePaddingAction` and `controlInlinePaddingField` alongside the legacy `controlInlinePadding` compatibility alias. Field/value surfaces such as inputs, selects, textareas, search inputs, choice rows, and checkbox/radio label spacing read the field token. Action/navigation surfaces such as buttons, file buttons, tabs, segmented controls, chips, pagination, side-navigation toggles, accordion tabs, and top-navigation affordances read the action token. Chips stay with actions because they behave like compact filters/toggles rather than text-entry controls. Built-in tiers now follow two stable ratios instead of bespoke per-tier fractions: editorial and documentation use `1rem` actions with `0.5rem` fields, while app and OS use `0.5rem` actions with `0.25rem` fields.

Example:

```html
<section class="bf-theme bf-tier-editorial">
	<div class="bf-prose">
		<h1>Editorial surface</h1>
		<p>Metric-derived nudges stay on.</p>
	</div>
</section>

<section class="bf-theme bf-tier-app">
	<div class="bf-prose">
		<h1>App surface</h1>
		<p>Runtime nudges are zeroed, but the stored font metrics still exist in surfaces.json.</p>
	</div>
</section>

<section class="bf-theme bf-tier-os">
	<div class="bf-prose">
		<h1>OS surface</h1>
		<p>Metrics stay on, but the measure and control geometry compress toward dense system surfaces.</p>
	</div>
</section>
```

Engine choice remains separate: `.bf-engine-metrics` is the default production path, `.bf-engine-cap` is demo-only.

See `config/tiers/` and `config/presets/` for the source configs.

## Public API

Browser-safe exports:

- `initBaselineGridToggles`
- `initCodeSnippets`
- `initContextualMenus`
- `initListTree`
- `initApplicationLayouts`
- `initPanelDrawers`
- `initResizableAsides`
- `initTooltips`
- `setupBaselineGridToggle`

Node/build exports:

- `buildThemeFromConfig`
- `buildThemeFromTier`
- `buildThemeFromPreset`
- `deriveBaselineTokensFromConfig`
- `readThemeConfig`

Static assets:

- `baseline-foundry/styles.css`
- `baseline-foundry/tokens.json`
- `baseline-foundry/surfaces.json`
- `baseline-foundry/tiers/editorial.css`
- `baseline-foundry/tiers/editorial.tokens.json`
- `baseline-foundry/tiers/editorial.surfaces.json`
- `baseline-foundry/tiers/documentation.css`
- `baseline-foundry/tiers/documentation.tokens.json`
- `baseline-foundry/tiers/documentation.surfaces.json`
- `baseline-foundry/tiers/app.css`
- `baseline-foundry/tiers/app.tokens.json`
- `baseline-foundry/tiers/app.surfaces.json`
- `baseline-foundry/tiers/os.css`
- `baseline-foundry/tiers/os.tokens.json`
- `baseline-foundry/tiers/os.surfaces.json`
- `baseline-foundry/presets/prose.css`
- `baseline-foundry/presets/prose.tokens.json`
- `baseline-foundry/presets/prose.surfaces.json`
- `baseline-foundry/presets/panel.css`
- `baseline-foundry/presets/panel.tokens.json`
- `baseline-foundry/presets/panel.surfaces.json`
- `baseline-foundry/presets/app-tier.css`
- `baseline-foundry/presets/app-tier.tokens.json`
- `baseline-foundry/presets/app-tier.surfaces.json`

## Downstream Fonts

The built-in default is Ubuntu Sans Variable, but downstream repos are not locked to it.
Point the build at a downstream theme config and derive fresh nudges from that font's real metrics.

The key rule is simple:

- **do not reuse nudges from a different font**
- **do not switch font-family in CSS without regenerating tokens**
- **derive a fresh `nudgeTop` set for the actual font files that will ship**

### What the downstream config needs

Create a theme JSON that follows the same shape as the tier configs under `config/tiers/`.
The font files are resolved relative to that config file, so a downstream repo can keep its own font assets and still use the same build path.

At minimum, define:

- `baselineUnit`
- `fontFiles`
- `fontStacks`
- `elements`
- `roles`
- `layout`
- `components`

Example sketch for a downstream Ubuntu Sans theme:

```json
{
	"baselineUnit": 0.25,
	"fontFiles": [
		{
			"family": "ubuntu-sans",
			"path": "../apps/overlay-preview/public/assets/fonts/UbuntuSans-Regular.ttf",
			"cssFamily": "Ubuntu Sans",
			"fontStyle": "normal",
			"fontWeight": "100 800",
			"fontDisplay": "swap"
		}
	],
	"fontStacks": {
		"ubuntu-sans": "\"Ubuntu Sans\", \"Ubuntu\", system-ui, sans-serif"
	},
	"elements": [
		{
			"identifier": "body",
			"fontSize": 0.75,
			"lineHeight": 4,
			"spaceAfter": 1,
			"fontFamily": "ubuntu-sans",
			"fontWeight": 400,
			"fontStyle": "normal"
		}
	],
	"roles": {
		"body": "body"
	},
	"layout": {
		"contentMaxWidthRem": 90,
		"contentPaddingInlineRem": 1,
		"measureRem": 40,
		"sectionSpaceBaselineUnits": 8,
		"sectionSpaceDeepBaselineUnits": 16,
		"stripSpaceBaselineUnits": 8,
		"gridGapInlineBaselineUnits": 2,
		"gridGapBlockBaselineUnits": 2,
		"pageMarginBaselineUnits": 2
	},
	"components": {
		"borderWidthPx": 1,
		"radiusRem": 0,
		"controlBlockPaddingRem": 0.5,
		"controlCompactBlockPaddingRem": 0.25,
		"controlInlinePaddingRem": 1,
		"controlVisualSizeRem": 0.75,
		"fieldGapBaselineUnits": 1,
		"panelPaddingInlineBaselineUnits": 2,
		"panelPaddingBlockBaselineUnits": 2,
		"accordionIndentBaselineUnits": 3
	}
}
```

### Generate full downstream CSS and tokens

Use the Node/build subpath so the downstream repo does not need to duplicate any build logic:

```ts
import { buildThemeFromConfig } from "baseline-foundry/build";

await buildThemeFromConfig("config/ubuntu-foundry-theme.json", {
	distDir: "generated/foundry/ubuntu",
	baselineDir: ".generated/baseline/ubuntu"
});
```

If a downstream surface bundle should ship multiple named fonts or brand variants in one stylesheet, pass a label for the default surface plus sibling named surfaces:

```ts
await buildThemeFromConfig("config/ibm-plex-foundry-theme.json", {
	distDir: "generated/foundry/smoke",
	baselineDir: ".generated/baseline/smoke",
	surfaceLabel: "IBM Plex Sans",
	additionalSurfaces: [
		{
			name: "ubuntu-smoke",
			label: "Ubuntu Sans",
			className: "bf-surface-ubuntu-smoke",
			configPath: "config/ubuntu-foundry-theme.json"
		}
	]
});
```

That does three things:

1. writes the reduced baseline-generator input JSON
2. runs `@lyubomir-popov/baseline-nudge-generator`
3. emits `tokens.json`, `styles.css`, and `surfaces.json` for the downstream font or surface set

`surfaces.json` will then expose each named surface's runtime tokens, stored metrics, and optional UI label under one manifest-backed bundle.

### Derive nudges only

If the downstream repo wants the font metrics and `nudgeTop` values but plans to own CSS generation itself, use `deriveBaselineTokensFromConfig`:

```ts
import { deriveBaselineTokensFromConfig } from "baseline-foundry/build";

const result = await deriveBaselineTokensFromConfig("config/ubuntu-foundry-theme.json", {
	baselineDir: ".generated/baseline/ubuntu"
});

console.log(result.tokens.elements.body.nudgeTop);
console.log(result.baselineConfigPath);
console.log(result.baselineTokensPath);
```

### Direct utility usage

`baseline-foundry` uses `@lyubomir-popov/baseline-nudge-generator` under the hood.
The reduced config passed to that utility contains only:

- `baselineUnit`
- `fontFiles` with build-time font paths
- `elements` with `identifier`, `fontSize`, `lineHeight`, `spaceAfter`, `fontFamily`, `fontWeight`, and `fontStyle`

Equivalent direct usage looks like this:

```ts
import { generateFromConfig } from "@lyubomir-popov/baseline-nudge-generator";

await generateFromConfig(".generated/baseline/ubuntu/ubuntu-foundry-theme.baseline.json", ".generated/baseline/ubuntu");
```

The generated `tokens.json` then contains the derived metric nudges per element, including `nudgeTop`, which `baseline-foundry` turns into the scoped `--bf-<role>-nudge-start` / `--bf-<role>-nudge-end` variables inside each emitted surface.

### Practical downstream advice

- Regenerate tokens whenever the downstream font files change.
- Regenerate tokens whenever font size, line-height, or baseline unit changes.
- Keep at least one non-`runtimeOnly` font file in `fontFiles`; that is the file the nudge generator reads for metrics.
- If a downstream repo ships multiple runtime faces, mark only the non-metric extras as `runtimeOnly`.
- Keep metrics as the default engine for production fonts; `.bf-engine-cap` remains an opt-in fallback, not the default path.

## Demo

The demo surface at `/` shows editorial prose rhythm, tier switching, dark theme, grid, spacing, and component specimens. Component demos live under `demo/components/` with a visual atlas at `demo/components/index.html`. The authoritative saved-page inventory is in `scripts/component-demo-shared.ts`.

## Start Here

If you resume this repo in a new chat, read:

1. `llm-handoff-context.md`
2. `docs/TODO.md`
3. `.github/agents/agent.md`
