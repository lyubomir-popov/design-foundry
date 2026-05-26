// K9a validation: verify the PointField → DisplayList adapter.
//
// Tests the display-list-adapter that bridges operator outputs
// (PointField, safe areas) into render-ir DisplayList format.
// This is the first concrete step of K9 (overlay-preview integration).

import assert from "node:assert/strict";
import type { PointField, PointRecord, ColorRgba, LayoutGridMetrics, ResolvedTextPlacement, TextStyleSpec, LogoPlacement, LayoutBounds } from "@design-foundry/core-types";
import type { DisplayList, EllipseItem, GlyphRunItem, ImageItem, LineItem, RectItem, Viewport } from "@design-foundry/render-ir";
import {
  pointFieldToDisplayList,
  safeAreaToDisplayList,
  phyllotaxisStyleResolver,
  scatterStyleResolver,
  fuzzyBoidsStyleResolver,
  guideGridToDisplayList,
  textPlacementToDisplayList,
  logoPlacementToDisplayList,
} from "../apps/overlay-preview/src/display-list-adapter.js";

const viewport: Viewport = { width: 1920, height: 1080 };

function makePoint(x: number, y: number, attrs: Record<string, unknown> = {}): PointRecord {
  return { id: `pt-${x}-${y}`, position: { x, y, z: 0 }, attributes: attrs };
}

function makeField(points: PointRecord[]): PointField {
  return { points, detail: {} };
}

// ---------------------------------------------------------------------------
// 1. Basic point field conversion
// ---------------------------------------------------------------------------

console.log("1. Basic point field → DisplayList...");
{
  const field = makeField([
    makePoint(100, 200),
    makePoint(300, 400),
  ]);

  const dl = pointFieldToDisplayList(field, { viewport });

  assert.equal(dl.items.length, 2, "two items from two points");
  assert.equal(dl.viewport.width, 1920, "viewport preserved");
  assert.equal(dl.viewport.height, 1080, "viewport preserved");

  const first = dl.items[0]! as EllipseItem;
  assert.equal(first.kind, "ellipse", "items are ellipses");
  assert.equal(first.cx, 100, "cx from point.position.x");
  assert.equal(first.cy, 200, "cy from point.position.y");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 2. Empty point field
// ---------------------------------------------------------------------------

console.log("\n2. Empty point field...");
{
  const dl = pointFieldToDisplayList(makeField([]), { viewport });
  assert.equal(dl.items.length, 0, "no items from empty field");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 3. Color conversion (0–255 → 0–1)
// ---------------------------------------------------------------------------

console.log("\n3. Color conversion (0–255 → 0–1)...");
{
  const field = makeField([makePoint(50, 50)]);

  const customStyle = {
    radiusPx: () => 3,
    alpha: () => 1,
    color: () => ({ r: 255, g: 128, b: 0, a: 0.5 } as ColorRgba),
  };

  const dl = pointFieldToDisplayList(field, { viewport, style: customStyle });
  const item = dl.items[0]! as EllipseItem;

  assert.ok(item.fill !== undefined, "fill is set");
  assert.ok(Math.abs(item.fill!.color.r - 1.0) < 0.01, "r: 255 → 1.0");
  assert.ok(Math.abs(item.fill!.color.g - 0.502) < 0.01, "g: 128 → ~0.502");
  assert.ok(Math.abs(item.fill!.color.b - 0.0) < 0.01, "b: 0 → 0.0");
  assert.ok(Math.abs(item.fill!.color.a - 0.5) < 0.01, "a: 0.5 → 0.5 (passthrough)");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 4. Phyllotaxis style resolver
// ---------------------------------------------------------------------------

console.log("\n4. Phyllotaxis style resolver...");
{
  const field = makeField([
    makePoint(100, 100, { philo_radius: 0 }),
    makePoint(200, 200, { philo_radius: 50 }),
    makePoint(300, 300, { philo_radius: 100 }),
  ]);

  const style = phyllotaxisStyleResolver(100);
  const dl = pointFieldToDisplayList(field, { viewport, style });

  assert.equal(dl.items.length, 3, "three items");

  // First point (radius 0/100 = 0 normalized) → small dot
  const first = dl.items[0]! as EllipseItem;
  assert.ok(first.rx >= 0.95 && first.rx <= 1.0, `small radius: ${first.rx}`);

  // Last point (radius 100/100 = 1 normalized) → large dot
  const last = dl.items[2]! as EllipseItem;
  assert.ok(last.rx >= 3.0 && last.rx <= 3.2, `large radius: ${last.rx}`);

  // Radius increases with distance
  assert.ok((dl.items[2]! as EllipseItem).rx > (dl.items[0]! as EllipseItem).rx, "radius scales up");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 5. Scatter style resolver
// ---------------------------------------------------------------------------

console.log("\n5. Scatter style resolver...");
{
  const field = makeField([
    makePoint(100, 100, { scatter_density_weight: 0 }),
    makePoint(200, 200, { scatter_density_weight: 0.5 }),
    makePoint(300, 300, { scatter_density_weight: 1.0 }),
  ]);

  const style = scatterStyleResolver();
  const dl = pointFieldToDisplayList(field, { viewport, style });

  assert.equal(dl.items.length, 3, "three items");

  // Density weight affects radius and alpha
  const low = dl.items[0]! as EllipseItem;
  const high = dl.items[2]! as EllipseItem;
  assert.ok(high.rx > low.rx, "higher density → larger radius");
  assert.ok((high.opacity ?? 1) > (low.opacity ?? 0), "higher density → more opaque");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 6. Fuzzy boids style resolver — visibility gating
// ---------------------------------------------------------------------------

console.log("\n6. Fuzzy boids visibility gating...");
{
  const field = makeField([
    makePoint(100, 100, { boid_active: true }),
    makePoint(200, 200, { boid_active: false }),
    makePoint(300, 300, { boid_active: true }),
  ]);

  const style = fuzzyBoidsStyleResolver(3);
  const dl = pointFieldToDisplayList(field, { viewport, style });

  assert.equal(dl.items.length, 2, "inactive boid filtered out");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 7. Safe area → DisplayList
// ---------------------------------------------------------------------------

console.log("\n7. Safe area bars...");
{
  const dl = safeAreaToDisplayList(viewport, { top: 60, bottom: 60, left: 96, right: 96 });

  assert.equal(dl.items.length, 4, "four bars");

  const topBar = dl.items[0]! as RectItem;
  assert.equal(topBar.kind, "rect", "bars are rects");
  assert.equal(topBar.x, 0, "top bar x = 0");
  assert.equal(topBar.y, 0, "top bar y = 0");
  assert.equal(topBar.width, 1920, "top bar full width");
  assert.equal(topBar.height, 60, "top bar height = inset");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 8. Safe area — null/empty insets
// ---------------------------------------------------------------------------

console.log("\n8. Safe area edge cases...");
{
  const dlNull = safeAreaToDisplayList(viewport, null);
  assert.equal(dlNull.items.length, 0, "null insets → no items");

  const dlEmpty = safeAreaToDisplayList(viewport, {});
  assert.equal(dlEmpty.items.length, 0, "empty insets → no items");

  const dlPartial = safeAreaToDisplayList(viewport, { top: 40 });
  assert.equal(dlPartial.items.length, 1, "one inset → one bar");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 9. Round-trip: adapter output is valid render-ir input
// ---------------------------------------------------------------------------

console.log("\n9. Adapter output is valid render-ir...");
{
  const field = makeField([
    makePoint(960, 540),
    makePoint(480, 270),
  ]);

  const dl = pointFieldToDisplayList(field, {
    viewport: { width: 1920, height: 1080, background: { r: 0, g: 0, b: 0, a: 1 } },
  });

  // Structural checks: all items have valid kind, all required fields present
  for (const item of dl.items) {
    assert.equal(item.kind, "ellipse", "all items are ellipses");
    const e = item as EllipseItem;
    assert.equal(typeof e.cx, "number", "cx is number");
    assert.equal(typeof e.cy, "number", "cy is number");
    assert.equal(typeof e.rx, "number", "rx is number");
    assert.equal(typeof e.ry, "number", "ry is number");
    assert.ok(e.fill !== undefined, "fill is set");
    assert.ok(e.fill!.color.r >= 0 && e.fill!.color.r <= 1, "color.r in 0–1");
    assert.ok(e.fill!.color.g >= 0 && e.fill!.color.g <= 1, "color.g in 0–1");
    assert.ok(e.fill!.color.b >= 0 && e.fill!.color.b <= 1, "color.b in 0–1");
    assert.ok(e.fill!.color.a >= 0 && e.fill!.color.a <= 1, "color.a in 0–1");
  }
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 10. Large field performance sanity
// ---------------------------------------------------------------------------

console.log("\n10. Large field (5000 points)...");
{
  const points: PointRecord[] = [];
  for (let i = 0; i < 5000; i++) {
    points.push(makePoint(Math.random() * 1920, Math.random() * 1080, { boid_active: true }));
  }
  const field = makeField(points);
  const style = fuzzyBoidsStyleResolver(3);

  const start = performance.now();
  const dl = pointFieldToDisplayList(field, { viewport, style });
  const elapsed = performance.now() - start;

  assert.equal(dl.items.length, 5000, "all points rendered");
  assert.ok(elapsed < 50, `5000 points in ${elapsed.toFixed(1)}ms (< 50ms)`);
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 11. Guide grid — composition mode
// ---------------------------------------------------------------------------

console.log("\n11. Guide grid — composition mode...");
{
  const grid: LayoutGridMetrics = {
    baselineStepPx: 12,
    rowCount: 2,
    columnCount: 3,
    leftMarginPx: 40,
    rightMarginPx: 40,
    topMarginPx: 60,
    bottomMarginPx: 60,
    rowGutterPx: 20,
    columnGutterPx: 20,
    rowHeightPx: 200,
    columnWidthPx: 560,
    layoutLeftPx: 0,
    layoutTopPx: 0,
    layoutRightPx: 1920,
    layoutBottomPx: 1080,
    contentLeftPx: 40,
    contentTopPx: 60,
    contentRightPx: 1880,
    contentBottomPx: 1020,
    columnKeylinePositionsPx: [40, 620, 1200],
  };
  const frame = { widthPx: 1920, heightPx: 1080 };
  const dl = guideGridToDisplayList(grid, frame, "composition", viewport);

  // Should have: 1 boundary rect + 4 margin rects + 1 margin label
  // + 3 column fills + 3 keylines + 3 keyline labels + 3 dashed right edges
  // + 2 row rects + 1 row gutter
  // = ~21 items (varies with grid shape)
  assert.ok(dl.items.length > 10, `produced ${dl.items.length} items`);

  // First item is the content boundary dashed rect
  const boundary = dl.items[0]! as RectItem;
  assert.equal(boundary.kind, "rect", "boundary is rect");
  assert.ok(boundary.strokeStyle !== undefined, "boundary has stroke style");
  assert.deepEqual(boundary.strokeStyle!.dashArray, [6, 4], "dashed boundary");

  // Verify there's at least one line (keyline)
  const lines = dl.items.filter((i) => i.kind === "line") as LineItem[];
  assert.ok(lines.length >= 3, `at least 3 keylines, got ${lines.length}`);

  // Verify there's at least one glyph-run (label)
  const labels = dl.items.filter((i) => i.kind === "glyph-run") as GlyphRunItem[];
  assert.ok(labels.length >= 1, `at least 1 label, got ${labels.length}`);
  const k1Label = labels.find((l) => l.run.text === "K1");
  assert.ok(k1Label, "K1 keyline label present");
  assert.equal(k1Label!.run.fontFamily, "monospace", "labels use monospace");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 12. Guide grid — off mode
// ---------------------------------------------------------------------------

console.log("\n12. Guide grid — off mode...");
{
  const grid: LayoutGridMetrics = {
    baselineStepPx: 12, rowCount: 1, columnCount: 1,
    leftMarginPx: 0, rightMarginPx: 0, topMarginPx: 0, bottomMarginPx: 0,
    rowGutterPx: 0, columnGutterPx: 0, rowHeightPx: 1080, columnWidthPx: 1920,
    layoutLeftPx: 0, layoutTopPx: 0, layoutRightPx: 1920, layoutBottomPx: 1080,
    contentLeftPx: 0, contentTopPx: 0, contentRightPx: 1920, contentBottomPx: 1080,
    columnKeylinePositionsPx: [0],
  };
  const dl = guideGridToDisplayList(grid, { widthPx: 1920, heightPx: 1080 }, "off", viewport);
  assert.equal(dl.items.length, 0, "off mode produces no items");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 13. Guide grid — baseline mode adds baseline lines
// ---------------------------------------------------------------------------

console.log("\n13. Guide grid — baseline mode...");
{
  const grid: LayoutGridMetrics = {
    baselineStepPx: 24, rowCount: 0, columnCount: 0,
    leftMarginPx: 0, rightMarginPx: 0, topMarginPx: 0, bottomMarginPx: 0,
    rowGutterPx: 0, columnGutterPx: 0, rowHeightPx: 0, columnWidthPx: 0,
    layoutLeftPx: 0, layoutTopPx: 0, layoutRightPx: 200, layoutBottomPx: 100,
    contentLeftPx: 0, contentTopPx: 0, contentRightPx: 200, contentBottomPx: 96,
    columnKeylinePositionsPx: [],
  };
  const smallVp: Viewport = { width: 200, height: 100 };
  const compDl = guideGridToDisplayList(grid, { widthPx: 200, heightPx: 100 }, "composition", smallVp);
  const baseDl = guideGridToDisplayList(grid, { widthPx: 200, heightPx: 100 }, "baseline", smallVp);

  // Baseline mode should have more items (the baseline grid lines)
  assert.ok(baseDl.items.length > compDl.items.length, "baseline mode adds extra lines");

  // Baseline lines: 0, 24, 48, 72 = 4 lines
  const baselineLines = baseDl.items.filter(
    (i) => i.kind === "line" && (i as LineItem).strokeStyle?.width === 0.5
  );
  assert.ok(baselineLines.length >= 4, `at least 4 baseline lines, got ${baselineLines.length}`);
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 14. Text placement → DisplayList
// ---------------------------------------------------------------------------

console.log("\n14. Text placement → DisplayList...");
{
  const bounds: LayoutBounds = { left: 100, top: 200, right: 500, bottom: 280, width: 400, height: 80 };
  const text: ResolvedTextPlacement = {
    id: "title",
    styleKey: "heading",
    text: "Hello World",
    wrappedLines: ["Hello", "World"],
    lineHeightPx: 32,
    keylineIndex: 1,
    rowIndex: 0,
    offsetBaselines: 0,
    columnSpan: 2,
    anchorXPx: 100,
    anchorBaselineYPx: 230,
    maxWidthPx: 400,
    bounds,
  };
  const style: TextStyleSpec = {
    key: "heading",
    fontSizePx: 24,
    lineHeightPx: 32,
    fontWeight: 700,
  };

  const dl = textPlacementToDisplayList(text, style, viewport);
  assert.equal(dl.items.length, 2, "one item per wrapped line");

  const line1 = dl.items[0]! as GlyphRunItem;
  assert.equal(line1.kind, "glyph-run", "items are glyph-runs");
  assert.equal(line1.x, 100, "x from anchorXPx");
  assert.equal(line1.y, 230, "first line y = anchorBaselineYPx");
  assert.equal(line1.run.text, "Hello", "first line text");
  assert.equal(line1.run.fontSize, 24, "font size from style");
  assert.equal(line1.run.fontWeight, 700, "font weight from style");
  assert.ok(line1.run.fontFamily!.includes("Ubuntu"), "Ubuntu font family");

  const line2 = dl.items[1]! as GlyphRunItem;
  assert.equal(line2.y, 230 + 32, "second line y offset by lineHeight");
  assert.equal(line2.run.text, "World", "second line text");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 15. Text placement — single line
// ---------------------------------------------------------------------------

console.log("\n15. Text placement — single line...");
{
  const bounds: LayoutBounds = { left: 50, top: 100, right: 250, bottom: 130, width: 200, height: 30 };
  const text: ResolvedTextPlacement = {
    id: "subtitle",
    styleKey: "body",
    text: "One liner",
    wrappedLines: ["One liner"],
    lineHeightPx: 20,
    keylineIndex: 1,
    rowIndex: 0,
    offsetBaselines: 0,
    columnSpan: 1,
    anchorXPx: 50,
    anchorBaselineYPx: 120,
    maxWidthPx: 200,
    bounds,
  };
  const style: TextStyleSpec = {
    key: "body",
    fontSizePx: 16,
    lineHeightPx: 20,
  };

  const dl = textPlacementToDisplayList(text, style, viewport);
  assert.equal(dl.items.length, 1, "single line = one item");
  const item = dl.items[0]! as GlyphRunItem;
  assert.equal(item.run.fontWeight, 400, "default weight is 400");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 16. Logo placement → DisplayList
// ---------------------------------------------------------------------------

console.log("\n16. Logo placement → DisplayList...");
{
  const logo: LogoPlacement = {
    id: "canonical-logo",
    xPx: 60,
    yPx: 900,
    widthPx: 120,
    heightPx: 40,
    assetPath: "/assets/logo.svg",
    bounds: { left: 60, top: 900, right: 180, bottom: 940, width: 120, height: 40 },
  };

  const dl = logoPlacementToDisplayList(logo, viewport);
  assert.equal(dl.items.length, 1, "one image item");

  const img = dl.items[0]! as ImageItem;
  assert.equal(img.kind, "image", "item is image");
  assert.equal(img.x, 60, "x from bounds.left");
  assert.equal(img.y, 900, "y from bounds.top");
  assert.equal(img.width, 120, "width from bounds");
  assert.equal(img.height, 40, "height from bounds");
  assert.equal(img.assetRef.kind, "image", "asset kind is image");
  assert.equal(img.assetRef.uri, "/assets/logo.svg", "asset URI from assetPath");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 17. Logo placement — null/undefined
// ---------------------------------------------------------------------------

console.log("\n17. Logo placement — null/undefined...");
{
  const dlNull = logoPlacementToDisplayList(null, viewport);
  assert.equal(dlNull.items.length, 0, "null logo → no items");

  const dlUndef = logoPlacementToDisplayList(undefined, viewport);
  assert.equal(dlUndef.items.length, 0, "undefined logo → no items");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 18. SVG round-trip: guide grid renders through SvgRenderer
// ---------------------------------------------------------------------------

console.log("\n18. SVG round-trip: guide grid through SvgRenderer...");
{
  const { SvgRenderer } = await import("@design-foundry/render-svg");
  const grid: LayoutGridMetrics = {
    baselineStepPx: 12, rowCount: 1, columnCount: 2,
    leftMarginPx: 20, rightMarginPx: 20, topMarginPx: 20, bottomMarginPx: 20,
    rowGutterPx: 0, columnGutterPx: 10, rowHeightPx: 960, columnWidthPx: 925,
    layoutLeftPx: 0, layoutTopPx: 0, layoutRightPx: 1920, layoutBottomPx: 1080,
    contentLeftPx: 20, contentTopPx: 20, contentRightPx: 1900, contentBottomPx: 1060,
    columnKeylinePositionsPx: [20, 955],
  };
  const dl = guideGridToDisplayList(grid, { widthPx: 1920, heightPx: 1080 }, "composition", viewport);
  const renderer = new SvgRenderer();
  const svgString = renderer.render(dl);

  assert.ok(svgString.startsWith("<svg"), "output starts with <svg");
  assert.ok(svgString.includes("</svg>"), "output ends with </svg>");
  // Should contain rects for boundary, margins, columns; lines for keylines; text for labels
  assert.ok(svgString.includes("<rect"), "contains rect elements");
  assert.ok(svgString.includes("<line"), "contains line elements");
  assert.ok(svgString.includes("<text"), "contains text elements");
  assert.ok(svgString.includes("K1"), "contains K1 keyline label");
  assert.ok(svgString.includes("monospace"), "labels use monospace font");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
console.log("\n✓ All 18 display-list-adapter tests passed.");
