// K10 validation: visual parity between old pipeline and kernel renderer path.
//
// Tests that the kernel adapter layer produces numerically identical
// style decisions (radius, alpha, color, visibility) as the legacy
// ad-hoc drawing code, and that the same DisplayList produces
// structurally consistent output through SVG, Canvas2D, and PDF.

import assert from "node:assert/strict";
import type {
  ColorRgba,
  LayoutGridMetrics,
  LogoPlacement,
  PointField,
  PointRecord,
  ResolvedTextPlacement,
  TextStyleSpec,
  LayoutBounds,
} from "@design-foundry/core-types";
import type {
  DisplayList,
  DisplayListItem,
  EllipseItem,
  GlyphRunItem,
  ImageItem,
  LineItem,
  RectItem,
  Viewport,
} from "@design-foundry/render-ir";
import { SvgRenderer } from "@design-foundry/render-svg";
import { Canvas2DRenderer } from "@design-foundry/render-canvas2d";
import { PdfRenderer } from "@design-foundry/render-pdf";
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
import {
  createGuideMarkup,
  createSafeAreaMarkup,
  createTextMarkup,
  createLogoMarkup,
  type FrameDimensions,
  type SafeAreaInsets,
} from "../apps/overlay-preview/src/svg-overlay-adapter.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const viewport: Viewport = { width: 1920, height: 1080 };

function makePoint(x: number, y: number, attrs: Record<string, unknown> = {}): PointRecord {
  return { id: `pt-${x}-${y}`, position: { x, y, z: 0 }, attributes: attrs };
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

function assertClose(actual: number, expected: number, tolerance: number, msg: string): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${msg}: expected ${expected} ± ${tolerance}, got ${actual}`
  );
}

// ---------------------------------------------------------------------------
// 1. Phyllotaxis style parity: adapter vs legacy formula
// ---------------------------------------------------------------------------

console.log("1. Phyllotaxis style parity...");
{
  const maxRadius = 300;
  const resolver = phyllotaxisStyleResolver(maxRadius);
  const count = 100;

  // Test several representative points
  for (const idx of [0, 1, 49, 99]) {
    const philoRadius = (idx / (count - 1)) * maxRadius;
    const point = makePoint(100, 100, { philo_radius: philoRadius });

    // Adapter resolver
    const adapterRadius = resolver.radiusPx(point, idx, count);
    const adapterAlpha = resolver.alpha(point, idx, count);

    // Legacy formula (from scene-family-preview.ts getPhyllotaxisPointStyle)
    const normalizedRadius = maxRadius <= 0
      ? (count <= 1 ? 0 : idx / Math.max(1, count - 1))
      : Math.min(1, Math.max(0, philoRadius / maxRadius));
    const legacyRadius = 0.95 + normalizedRadius * 2.2;
    const legacyAlpha = 0.96;

    assertClose(adapterRadius, legacyRadius, 0.0001, `point ${idx} radius`);
    assertClose(adapterAlpha, legacyAlpha, 0.0001, `point ${idx} alpha`);
  }

  // Edge case: maxRadius = 0
  const zeroResolver = phyllotaxisStyleResolver(0);
  const p0 = makePoint(0, 0, { philo_radius: 0 });
  const p99 = makePoint(0, 0, { philo_radius: 100 });
  // With maxRadius=0, falls back to index-based normalization
  const r0 = zeroResolver.radiusPx(p0, 0, 100);
  const r99 = zeroResolver.radiusPx(p99, 99, 100);
  assertClose(r0, 0.95, 0.0001, "maxRadius=0, index=0");
  assertClose(r99, 0.95 + 2.2, 0.0001, "maxRadius=0, index=99");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 2. Scatter style parity: adapter vs legacy formula
// ---------------------------------------------------------------------------

console.log("\n2. Scatter style parity...");
{
  const resolver = scatterStyleResolver();

  for (const weight of [0, 0.2, 0.5, 0.8, 1.0]) {
    const point = makePoint(0, 0, { scatter_density_weight: weight });

    // Adapter
    const adapterRadius = resolver.radiusPx(point, 0, 10);
    const adapterAlpha = resolver.alpha(point, 0, 10);

    // Legacy (from scene-family-preview.ts getPointRadius / getPointAlpha for scatter)
    const legacyRadius = Math.min(3.8, Math.max(1.1, 1.1 + weight * 2.4));
    const legacyAlpha = 0.42 + weight * 0.5;

    assertClose(adapterRadius, legacyRadius, 0.0001, `weight ${weight} radius`);
    assertClose(adapterAlpha, legacyAlpha, 0.0001, `weight ${weight} alpha`);
  }

  // Default weight (attribute missing → 0.8)
  const defaultPoint = makePoint(0, 0);
  const defaultR = resolver.radiusPx(defaultPoint, 0, 1);
  const defaultA = resolver.alpha(defaultPoint, 0, 1);
  assertClose(defaultR, Math.min(3.8, Math.max(1.1, 1.1 + 0.8 * 2.4)), 0.0001, "default weight radius");
  assertClose(defaultA, 0.42 + 0.8 * 0.5, 0.0001, "default weight alpha");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 3. Boids style parity: adapter vs legacy formula
// ---------------------------------------------------------------------------

console.log("\n3. Boids style parity...");
{
  const dotSize = 3;
  const resolver = fuzzyBoidsStyleResolver(dotSize);

  // Active boid
  const active = makePoint(10, 20, { boid_active: true, color: { r: 200, g: 100, b: 50, a: 0.9 } });
  assert.equal(resolver.visible!(active, 0, 1), true, "active boid visible");
  assertClose(resolver.radiusPx(active, 0, 1), 3, 0.0001, "dotSize radius");
  assertClose(resolver.alpha(active, 0, 1), 1, 0.0001, "active alpha");

  const c = resolver.color(active, 0, 1);
  assert.equal(c.r, 200, "color.r from attribute");
  assert.equal(c.g, 100, "color.g from attribute");

  // Inactive boid
  const inactive = makePoint(10, 20, { boid_active: false });
  assert.equal(resolver.visible!(inactive, 0, 1), false, "inactive boid hidden");

  // Missing boid_active (falsy → hidden, matching legacy: Boolean(undefined) === false)
  const missing = makePoint(10, 20);
  assert.equal(resolver.visible!(missing, 0, 1), false, "missing boid_active → hidden");

  // Edge: dotSizePx < 0.5 clamped to 0.5
  const tinyResolver = fuzzyBoidsStyleResolver(0.1);
  assertClose(tinyResolver.radiusPx(active, 0, 1), 0.5, 0.0001, "dotSize clamped to 0.5");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 4. Safe area parity: adapter vs legacy markup
// ---------------------------------------------------------------------------

console.log("\n4. Safe area parity...");
{
  const frame: FrameDimensions = { widthPx: 1920, heightPx: 1080 };
  const insets: SafeAreaInsets = { top: 60, right: 80, bottom: 60, left: 80 };
  const bgColor = "#303030";

  // Legacy
  const legacySvg = createSafeAreaMarkup(frame, insets, bgColor);
  const legacyRectCount = countOccurrences(legacySvg, "<rect");

  // Adapter
  const irColor = { r: 0x30 / 255, g: 0x30 / 255, b: 0x30 / 255, a: 1 };
  const dl = safeAreaToDisplayList(viewport, insets, irColor);

  assert.equal(dl.items.length, legacyRectCount, "same number of bars");
  assert.equal(dl.items.length, 4, "four bars");

  // Verify geometry matches
  const topBar = dl.items[0]! as RectItem;
  assert.equal(topBar.x, 0, "top x=0");
  assert.equal(topBar.y, 0, "top y=0");
  assert.equal(topBar.width, 1920, "top full width");
  assert.equal(topBar.height, 60, "top height=inset");

  const bottomBar = dl.items[1]! as RectItem;
  assert.equal(bottomBar.y, 1080 - 60, "bottom y");

  const leftBar = dl.items[2]! as RectItem;
  assert.equal(leftBar.width, 80, "left width=inset");
  assert.equal(leftBar.height, 1080 - 60 - 60, "left height excludes top+bottom");

  const rightBar = dl.items[3]! as RectItem;
  assert.equal(rightBar.x, 1920 - 80, "right x");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 5. Guide grid parity: adapter element counts vs legacy markup
// ---------------------------------------------------------------------------

console.log("\n5. Guide grid parity...");
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
  const frame: FrameDimensions = { widthPx: 1920, heightPx: 1080 };

  // Legacy
  const legacySvg = createGuideMarkup(grid, frame, "composition");
  const legacyRects = countOccurrences(legacySvg, "<rect");
  const legacyLines = countOccurrences(legacySvg, "<line");
  const legacyTexts = countOccurrences(legacySvg, "<text");

  // Adapter
  const dl = guideGridToDisplayList(grid, frame, "composition", viewport);
  const irRects = dl.items.filter((i) => i.kind === "rect").length;
  const irLines = dl.items.filter((i) => i.kind === "line").length;
  const irTexts = dl.items.filter((i) => i.kind === "glyph-run").length;

  // Both should produce the same structural elements
  assert.equal(irRects, legacyRects, `rect count: adapter ${irRects} vs legacy ${legacyRects}`);
  assert.equal(irLines, legacyLines, `line count: adapter ${irLines} vs legacy ${legacyLines}`);
  assert.equal(irTexts, legacyTexts, `text count: adapter ${irTexts} vs legacy ${legacyTexts}`);
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 6. Guide grid baseline mode parity
// ---------------------------------------------------------------------------

console.log("\n6. Guide grid baseline parity...");
{
  const grid: LayoutGridMetrics = {
    baselineStepPx: 24,
    rowCount: 1,
    columnCount: 2,
    leftMarginPx: 20,
    rightMarginPx: 20,
    topMarginPx: 20,
    bottomMarginPx: 20,
    rowGutterPx: 0,
    columnGutterPx: 10,
    rowHeightPx: 1040,
    columnWidthPx: 925,
    layoutLeftPx: 0,
    layoutTopPx: 0,
    layoutRightPx: 1920,
    layoutBottomPx: 1080,
    contentLeftPx: 20,
    contentTopPx: 20,
    contentRightPx: 1900,
    contentBottomPx: 1060,
    columnKeylinePositionsPx: [20, 955],
  };
  const frame: FrameDimensions = { widthPx: 1920, heightPx: 1080 };

  const legacySvg = createGuideMarkup(grid, frame, "baseline");
  const legacyLines = countOccurrences(legacySvg, "<line");

  const dl = guideGridToDisplayList(grid, frame, "baseline", viewport);
  const irLines = dl.items.filter((i) => i.kind === "line").length;

  assert.equal(irLines, legacyLines, `baseline line count: adapter ${irLines} vs legacy ${legacyLines}`);

  // Baseline lines: (1060-20)/24 = 43.3 → 44 lines from y=20 to y<1060
  const expectedBaselines = Math.floor((1060 - 20) / 24);
  // Plus keylines and column right edges
  assert.ok(irLines > expectedBaselines, `baseline lines present (${irLines} > ${expectedBaselines})`);
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 7. Text markup parity: adapter positions vs legacy
// ---------------------------------------------------------------------------

console.log("\n7. Text markup parity...");
{
  const bounds: LayoutBounds = { left: 100, top: 200, right: 500, bottom: 320, width: 400, height: 120 };
  const text: ResolvedTextPlacement = {
    id: "title",
    styleKey: "heading",
    text: "Hello World Line",
    wrappedLines: ["Hello World", "Line Two", "Line Three"],
    lineHeightPx: 36,
    keylineIndex: 1,
    rowIndex: 0,
    offsetBaselines: 0,
    columnSpan: 2,
    anchorXPx: 100,
    anchorBaselineYPx: 240,
    maxWidthPx: 400,
    bounds,
  };
  const style: TextStyleSpec = {
    key: "heading",
    fontSizePx: 28,
    lineHeightPx: 36,
    fontWeight: 700,
  };

  // Legacy markup
  const legacySvg = createTextMarkup(text, style);

  // Adapter
  const dl = textPlacementToDisplayList(text, style, viewport);

  // Same number of text runs as wrapped lines
  assert.equal(dl.items.length, 3, "one item per line");

  // Verify positions
  const line1 = dl.items[0]! as GlyphRunItem;
  assert.equal(line1.x, 100, "x = anchorXPx");
  assert.equal(line1.y, 240, "first line y = anchorBaselineYPx");
  assert.equal(line1.run.fontSize, 28, "font size");
  assert.equal(line1.run.fontWeight, 700, "font weight");

  const line2 = dl.items[1]! as GlyphRunItem;
  assert.equal(line2.y, 240 + 36, "second line y = anchor + lineHeight");

  const line3 = dl.items[2]! as GlyphRunItem;
  assert.equal(line3.y, 240 + 72, "third line y = anchor + 2×lineHeight");

  // Legacy uses tspan dy offsets which produce the same positions:
  // first tspan dy=0 (y=240), second dy=36 (y=276), third dy=36 (y=312)
  assert.ok(legacySvg.includes('dy="0"'), "legacy first dy=0");
  assert.ok(legacySvg.includes(`dy="${style.lineHeightPx}"`), "legacy subsequent dy=lineHeight");
  assert.ok(legacySvg.includes(`y="${text.anchorBaselineYPx}"`), "legacy anchor y");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 8. Logo markup parity: adapter vs legacy
// ---------------------------------------------------------------------------

console.log("\n8. Logo markup parity...");
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

  const legacySvg = createLogoMarkup(logo);
  const dl = logoPlacementToDisplayList(logo, viewport);

  assert.equal(dl.items.length, 1, "one image item");
  const img = dl.items[0]! as ImageItem;

  // Same geometry
  assert.equal(img.x, 60, "x from bounds.left");
  assert.equal(img.y, 900, "y from bounds.top");
  assert.equal(img.width, 120, "width from bounds");
  assert.equal(img.height, 40, "height from bounds");
  assert.equal(img.assetRef.uri, "/assets/logo.svg", "asset path");

  // Legacy also has same geometry
  assert.ok(legacySvg.includes('x="60"'), "legacy x");
  assert.ok(legacySvg.includes('y="900"'), "legacy y");
  assert.ok(legacySvg.includes('width="120"'), "legacy width");
  assert.ok(legacySvg.includes('height="40"'), "legacy height");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 9. Cross-renderer: same DisplayList → SVG, Canvas2D, PDF all succeed
// ---------------------------------------------------------------------------

console.log("\n9. Cross-renderer consistency...");
{
  // Build a representative display list with every item type
  const dl: DisplayList = {
    viewport: { width: 800, height: 600, background: { r: 0.1, g: 0.1, b: 0.15, a: 1 } },
    items: [
      {
        kind: "rect", x: 10, y: 10, width: 100, height: 50,
        fill: { color: { r: 1, g: 0, b: 0, a: 0.8 } },
      } satisfies RectItem,
      {
        kind: "ellipse", cx: 200, cy: 200, rx: 30, ry: 30,
        fill: { color: { r: 0, g: 1, b: 0, a: 1 } },
      } satisfies EllipseItem,
      {
        kind: "line", x1: 0, y1: 0, x2: 800, y2: 600,
        stroke: { color: { r: 1, g: 1, b: 1, a: 0.5 } },
        strokeStyle: { width: 2 },
      } satisfies LineItem,
      {
        kind: "glyph-run", x: 50, y: 100,
        run: {
          fontRef: { kind: "font", uri: "system:monospace" },
          fontSize: 14,
          glyphs: [],
          text: "Test Label",
          fontFamily: "monospace",
          fontWeight: 400,
        },
        fill: { color: { r: 1, g: 1, b: 1, a: 1 } },
      } satisfies GlyphRunItem,
      {
        kind: "image",
        assetRef: { kind: "image", uri: "/test.png" },
        x: 400, y: 300, width: 100, height: 100,
      } satisfies ImageItem,
    ],
  };

  // SVG renderer
  const svgRenderer = new SvgRenderer();
  const svgOutput = svgRenderer.render(dl);
  assert.ok(svgOutput.startsWith("<svg"), "SVG output valid");
  assert.ok(svgOutput.includes("<rect"), "SVG has rect");
  assert.ok(svgOutput.includes("<ellipse"), "SVG has ellipse");
  assert.ok(svgOutput.includes("<line"), "SVG has line");
  assert.ok(svgOutput.includes("<text"), "SVG has text");
  assert.ok(svgOutput.includes("<image"), "SVG has image");
  assert.ok(svgOutput.includes('font-family="monospace"'), "SVG has font-family");

  // Canvas2D renderer — mock context
  const calls: string[] = [];
  const mockCtx = {
    canvas: { width: 0, height: 0 },
    clearRect: () => { calls.push("clearRect"); },
    fillRect: () => { calls.push("fillRect"); },
    beginPath: () => { calls.push("beginPath"); },
    moveTo: () => { calls.push("moveTo"); },
    lineTo: () => { calls.push("lineTo"); },
    arc: () => { calls.push("arc"); },
    ellipse: () => { calls.push("ellipse"); },
    rect: () => { calls.push("rect"); },
    fill: () => { calls.push("fill"); },
    stroke: () => { calls.push("stroke"); },
    closePath: () => {},
    roundRect: () => { calls.push("roundRect"); },
    fillText: () => { calls.push("fillText"); },
    drawImage: () => { calls.push("drawImage"); },
    save: () => {},
    restore: () => {},
    clip: () => {},
    set fillStyle(_: string) {},
    set strokeStyle(_: string) {},
    set lineWidth(_: number) {},
    set lineCap(_: string) {},
    set lineJoin(_: string) {},
    set miterLimit(_: number) {},
    set globalAlpha(_: number) {},
    set font(_: string) {},
    setLineDash: () => {},
    set lineDashOffset(_: number) {},
    setTransform: () => {},
    scale: () => {},
  } as unknown as CanvasRenderingContext2D;

  const canvasRenderer = new Canvas2DRenderer(mockCtx);
  canvasRenderer.render(dl);
  assert.ok(calls.includes("clearRect"), "Canvas2D cleared");
  assert.ok(calls.includes("fillRect"), "Canvas2D drew rect");
  assert.ok(calls.includes("ellipse") || calls.includes("arc"), "Canvas2D drew ellipse");
  assert.ok(calls.includes("fillText"), "Canvas2D drew text");

  // PDF renderer
  const pdfRenderer = new PdfRenderer();
  const pdfBytes = await pdfRenderer.render(dl);
  assert.ok(pdfBytes instanceof Uint8Array, "PDF output is Uint8Array");
  assert.ok(pdfBytes.length > 100, "PDF has content");
  // Verify PDF trailer
  const pdfText = new TextDecoder().decode(pdfBytes.slice(-30));
  assert.ok(pdfText.includes("%%EOF"), "PDF has valid trailer");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 10. Cross-renderer: adapter-produced display lists work through all backends
// ---------------------------------------------------------------------------

console.log("\n10. Full pipeline: PointField → adapter → SVG + Canvas2D...");
{
  const field: PointField = {
    points: [
      makePoint(100, 200, { philo_radius: 50 }),
      makePoint(300, 400, { philo_radius: 150 }),
      makePoint(500, 600, { philo_radius: 250 }),
    ],
    detail: { max_radius: 300 },
  };

  const style = phyllotaxisStyleResolver(300);
  const dl = pointFieldToDisplayList(field, { viewport, style });

  // SVG
  const svgRenderer = new SvgRenderer();
  const svgOutput = svgRenderer.render(dl);
  const ellipseCount = countOccurrences(svgOutput, "<ellipse");
  assert.equal(ellipseCount, 3, "SVG: 3 ellipses for 3 points");

  // Canvas2D mock
  let arcCount = 0;
  const mockCtx2 = {
    canvas: { width: 0, height: 0 },
    clearRect: () => {},
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    ellipse: () => { arcCount++; },
    rect: () => {},
    fill: () => {},
    stroke: () => {},
    closePath: () => {},
    roundRect: () => {},
    fillText: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {},
    clip: () => {},
    set fillStyle(_: string) {},
    set strokeStyle(_: string) {},
    set lineWidth(_: number) {},
    set lineCap(_: string) {},
    set lineJoin(_: string) {},
    set miterLimit(_: number) {},
    set globalAlpha(_: number) {},
    set font(_: string) {},
    setLineDash: () => {},
    set lineDashOffset(_: number) {},
    setTransform: () => {},
    scale: () => {},
  } as unknown as CanvasRenderingContext2D;

  const canvasRenderer = new Canvas2DRenderer(mockCtx2);
  canvasRenderer.render(dl);
  assert.equal(arcCount, 3, "Canvas2D: 3 ellipse calls for 3 points");

  // PDF
  const pdfRenderer = new PdfRenderer();
  const pdfBytes = await pdfRenderer.render(dl);
  assert.ok(pdfBytes.length > 100, "PDF output has content");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 11. Cross-renderer: guide grid through all backends
// ---------------------------------------------------------------------------

console.log("\n11. Full pipeline: guide grid → SVG + PDF...");
{
  const grid: LayoutGridMetrics = {
    baselineStepPx: 12,
    rowCount: 1,
    columnCount: 2,
    leftMarginPx: 40,
    rightMarginPx: 40,
    topMarginPx: 40,
    bottomMarginPx: 40,
    rowGutterPx: 0,
    columnGutterPx: 20,
    rowHeightPx: 1000,
    columnWidthPx: 890,
    layoutLeftPx: 0,
    layoutTopPx: 0,
    layoutRightPx: 1920,
    layoutBottomPx: 1080,
    contentLeftPx: 40,
    contentTopPx: 40,
    contentRightPx: 1880,
    contentBottomPx: 1040,
    columnKeylinePositionsPx: [40, 950],
  };
  const frame: FrameDimensions = { widthPx: 1920, heightPx: 1080 };

  const dl = guideGridToDisplayList(grid, frame, "composition", viewport);

  // SVG
  const svgOutput = new SvgRenderer().render(dl);
  assert.ok(svgOutput.includes("K1"), "SVG guide has K1 label");
  assert.ok(svgOutput.includes("K2"), "SVG guide has K2 label");
  assert.ok(svgOutput.includes("margin-top"), "SVG guide has margin label");

  // PDF
  const pdfBytes = await new PdfRenderer().render(dl);
  assert.ok(pdfBytes.length > 200, "PDF guide output has content");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 12. Color conversion parity
// ---------------------------------------------------------------------------

console.log("\n12. Color conversion round-trip...");
{
  // The adapter converts ColorRgba (0–255 RGB) to render-ir Color (0–1).
  // Verify the SVG renderer then converts back to correct CSS color strings.
  const field: PointField = {
    points: [makePoint(100, 100)],
    detail: {},
  };
  const customStyle = {
    radiusPx: () => 5,
    alpha: () => 1,
    color: () => ({ r: 128, g: 64, b: 255, a: 1 } as ColorRgba),
  };

  const dl = pointFieldToDisplayList(field, { viewport, style: customStyle });
  const svgOutput = new SvgRenderer().render(dl);

  // The IR color should be r=128/255, g=64/255, b=255/255
  // SVG renderer formats as rgb(r*255, g*255, b*255) → rgb(128,64,255)
  assert.ok(
    svgOutput.includes("128") && svgOutput.includes("64") && svgOutput.includes("255"),
    "color round-trips through IR correctly"
  );
}
console.log("   PASS");

// ---------------------------------------------------------------------------
console.log("\n✓ All 12 visual parity tests passed.");
