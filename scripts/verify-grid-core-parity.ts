// Regression: drive the unit-agnostic `resolveGridCore` with the canonical
// A4 50/50 preset and confirm key metrics match a4-generator's legacy
// `resolveGridMetrics` (run with `enforceVerticalBaselineMultiples` to
// match its rigorous default). This guards Phase 2's grid unification.

import assert from "node:assert/strict";

import {
  resolveGridCore,
  getKeyline,
  getColumnSpanWidth
} from "@design-foundry/layout-grid/core";

// Canonical A4 50/50 grid preset, mirrored from
// `a4-generator/packages/layout-grid/src/index.ts:CANONICAL_A4_50_50_GRID`.
// Values are in PDF points.
const A4_WIDTH_PT = 595.275590551;
const A4_HEIGHT_PT = 841.889763778;

const metrics = resolveGridCore(
  {
    canvasWidth: A4_WIDTH_PT,
    canvasHeight: A4_HEIGHT_PT,
    baselineStep: 12,
    marginTop: 24,
    marginRight: 24,
    marginBottom: 24,
    marginLeft: 24,
    columnCount: 4,
    columnGutter: 18,
    rowCount: 6,
    rowGutter: 12
  },
  { enforceVerticalBaselineMultiples: true, growBottomMarginToAbsorbSlack: true }
);

// Expected values captured from the legacy a4 resolver. If a4 ever changes
// its math, regenerate by running its `resolveRigorousGridMetrics(...)`.
const EXPECTED_COLUMN_COUNT = 4;
const EXPECTED_ROW_COUNT = 6;
const EXPECTED_BASELINE_STEP = 12;
const EXPECTED_MARGIN_TOP = 24;
const EXPECTED_MARGIN_LEFT = 24;
const EXPECTED_COLUMN_GUTTER = 18;

assert.equal(metrics.columnCount, EXPECTED_COLUMN_COUNT, "column count");
assert.equal(metrics.rowCount, EXPECTED_ROW_COUNT, "row count");
assert.equal(metrics.baselineStep, EXPECTED_BASELINE_STEP, "baseline step");
assert.equal(metrics.marginTop, EXPECTED_MARGIN_TOP, "margin top");
assert.equal(metrics.marginLeft, EXPECTED_MARGIN_LEFT, "margin left");
assert.equal(metrics.columnGutter, EXPECTED_COLUMN_GUTTER, "column gutter");

// First keyline should equal contentLeft (= marginLeft, since no safe area).
assert.equal(getKeyline(metrics, 1), metrics.contentLeft, "first keyline = contentLeft");
assert.equal(getKeyline(metrics, 1), 24, "first keyline at marginLeft");

// Last keyline + columnWidth must equal contentRight (within fp tolerance).
const lastKeylineLeft = getKeyline(metrics, EXPECTED_COLUMN_COUNT);
const lastKeylineRight = lastKeylineLeft + metrics.columnWidth;
assert.ok(
  Math.abs(lastKeylineRight - metrics.contentRight) < 1e-9,
  `last keyline right ${lastKeylineRight} should equal contentRight ${metrics.contentRight}`
);

// Full column span = contentWidth (no gutter past last column).
const fullSpan = getColumnSpanWidth(metrics, 1, EXPECTED_COLUMN_COUNT);
assert.ok(
  Math.abs(fullSpan - metrics.contentWidth) < 1e-9,
  `full column span ${fullSpan} should equal contentWidth ${metrics.contentWidth}`
);

// Row heights must be exact baseline multiples.
assert.equal(
  metrics.rowHeight % metrics.baselineStep,
  0,
  `rowHeight ${metrics.rowHeight} must be a baseline multiple`
);

// Bottom margin must absorb slack such that total height matches canvas.
const totalHeight =
  metrics.marginTop +
  metrics.rowCount * metrics.rowHeight +
  Math.max(0, metrics.rowCount - 1) * metrics.rowGutter +
  metrics.marginBottom;
assert.ok(
  Math.abs(totalHeight - A4_HEIGHT_PT) < 1e-6,
  `total stack ${totalHeight} should equal canvas height ${A4_HEIGHT_PT}`
);

console.log("grid-core parity: OK");
console.log(`  columnWidth = ${metrics.columnWidth}`);
console.log(`  rowHeight   = ${metrics.rowHeight}`);
console.log(`  marginBottom= ${metrics.marginBottom}`);
