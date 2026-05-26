// K2 validation harness: verify the render-ir → SVG pipeline produces
// correct output for every primitive type, and compare one scene against
// the existing svg-overlay-adapter output to confirm IR expressiveness.

import assert from "node:assert/strict";

import type {
  DisplayList,
  RectItem,
  EllipseItem,
  LineItem,
  PathItem,
  GlyphRunItem,
  ImageItem,
  GroupItem,
} from "@design-foundry/render-ir";
import { SvgRenderer } from "@design-foundry/render-svg";
import {
  createSafeAreaMarkup,
  type FrameDimensions,
  type SafeAreaInsets,
} from "../apps/overlay-preview/src/svg-overlay-adapter.js";

const renderer = new SvgRenderer();

// ── Helpers ───────────────────────────────────────────────────────────

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) { count++; pos += needle.length; }
  return count;
}

function assertContains(svg: string, needle: string, label: string): void {
  assert.ok(svg.includes(needle), `SVG should contain ${label}: ${needle}`);
}

// ── 1. Structural sanity ─────────────────────────────────────────────

console.log("1. Structural sanity...");
{
  const dl: DisplayList = {
    viewport: { width: 800, height: 600 },
    items: [],
  };
  const svg = renderer.render(dl);
  assertContains(svg, 'xmlns="http://www.w3.org/2000/svg"', "xmlns");
  assertContains(svg, 'width="800"', "width");
  assertContains(svg, 'height="600"', "height");
  assertContains(svg, 'viewBox="0 0 800 600"', "viewBox");
  assert.ok(svg.startsWith("<svg"), "should start with <svg");
  assert.ok(svg.endsWith("</svg>"), "should end with </svg>");
}
console.log("   PASS");

// ── 2. Viewport background ──────────────────────────────────────────

console.log("2. Viewport background...");
{
  const dl: DisplayList = {
    viewport: { width: 100, height: 100, background: { r: 0, g: 0, b: 0, a: 1 } },
    items: [],
  };
  const svg = renderer.render(dl);
  assertContains(svg, 'fill="rgb(0,0,0)"', "bg fill");
  assert.equal(countOccurrences(svg, "<rect"), 1, "exactly one bg rect");
}
console.log("   PASS");

// ── 3. RectItem ─────────────────────────────────────────────────────

console.log("3. RectItem...");
{
  const rect: RectItem = {
    kind: "rect", x: 10, y: 20, width: 100, height: 50,
    fill: { color: { r: 1, g: 0, b: 0, a: 0.5 } },
    stroke: { color: { r: 0, g: 0, b: 1, a: 1 } },
    strokeStyle: { width: 2, dashArray: [4, 2] },
  };
  const svg = renderer.render({ viewport: { width: 200, height: 200 }, items: [rect] });
  assertContains(svg, 'x="10"', "rect x");
  assertContains(svg, 'y="20"', "rect y");
  assertContains(svg, 'width="100"', "rect w");
  assertContains(svg, 'height="50"', "rect h");
  assertContains(svg, "rgba(255,0,0,0.5)", "fill color");
  assertContains(svg, "rgb(0,0,255)", "stroke color");
  assertContains(svg, 'stroke-width="2"', "stroke width");
  assertContains(svg, 'stroke-dasharray="4 2"', "dash array");
}
console.log("   PASS");

// ── 4. RectItem with uniform corner radii ───────────────────────────

console.log("4. RectItem with uniform corner radii...");
{
  const rect: RectItem = {
    kind: "rect", x: 0, y: 0, width: 80, height: 40,
    cornerRadii: [8, 8, 8, 8],
    fill: { color: { r: 0, g: 1, b: 0, a: 1 } },
  };
  const svg = renderer.render({ viewport: { width: 100, height: 100 }, items: [rect] });
  assertContains(svg, 'rx="8"', "uniform rx");
  assertContains(svg, 'ry="8"', "uniform ry");
  assert.equal(countOccurrences(svg, "<rect"), 1, "should use <rect>, not <path>");
}
console.log("   PASS");

// ── 5. RectItem with non-uniform corner radii ───────────────────────

console.log("5. RectItem with non-uniform corner radii...");
{
  const rect: RectItem = {
    kind: "rect", x: 0, y: 0, width: 100, height: 100,
    cornerRadii: [10, 20, 30, 0],
    fill: { color: { r: 1, g: 1, b: 1, a: 1 } },
  };
  const svg = renderer.render({ viewport: { width: 200, height: 200 }, items: [rect] });
  assertContains(svg, "<path", "non-uniform uses <path>");
  assertContains(svg, "A10 10", "TL arc");
  assertContains(svg, "A20 20", "TR arc");
  assertContains(svg, "A30 30", "BR arc");
}
console.log("   PASS");

// ── 6. EllipseItem ──────────────────────────────────────────────────

console.log("6. EllipseItem...");
{
  const ellipse: EllipseItem = {
    kind: "ellipse", cx: 50, cy: 50, rx: 30, ry: 20,
    fill: { color: { r: 1, g: 1, b: 0, a: 1 } },
  };
  const svg = renderer.render({ viewport: { width: 100, height: 100 }, items: [ellipse] });
  assertContains(svg, "<ellipse", "ellipse element");
  assertContains(svg, 'cx="50"', "cx");
  assertContains(svg, 'ry="20"', "ry");
}
console.log("   PASS");

// ── 7. LineItem ─────────────────────────────────────────────────────

console.log("7. LineItem...");
{
  const line: LineItem = {
    kind: "line", x1: 0, y1: 0, x2: 100, y2: 100,
    stroke: { color: { r: 1, g: 1, b: 1, a: 0.5 } },
    strokeStyle: { width: 1, cap: "round" },
  };
  const svg = renderer.render({ viewport: { width: 100, height: 100 }, items: [line] });
  assertContains(svg, "<line", "line element");
  assertContains(svg, 'x2="100"', "x2");
  assertContains(svg, 'stroke-linecap="round"', "linecap");
}
console.log("   PASS");

// ── 8. PathItem ─────────────────────────────────────────────────────

console.log("8. PathItem...");
{
  const path: PathItem = {
    kind: "path",
    commands: [
      { kind: "M", x: 10, y: 80 },
      { kind: "Q", x1: 50, y1: 10, x: 90, y: 80 },
      { kind: "Z" },
    ],
    fill: { color: { r: 0, g: 0.5, b: 1, a: 1 } },
    fillRule: "evenodd",
  };
  const svg = renderer.render({ viewport: { width: 100, height: 100 }, items: [path] });
  assertContains(svg, 'd="M10 80 Q50 10 90 80 Z"', "path d");
  assertContains(svg, 'fill-rule="evenodd"', "fill rule");
}
console.log("   PASS");

// ── 9. GlyphRunItem (fallback text rendering) ───────────────────────

console.log("9. GlyphRunItem (text fallback)...");
{
  const glyph: GlyphRunItem = {
    kind: "glyph-run", x: 20, y: 40,
    run: {
      fontRef: { kind: "font", uri: "fonts/Inter.woff2" },
      fontSize: 24,
      glyphs: [],
      text: "Hello <world> & friends",
    },
    fill: { color: { r: 1, g: 1, b: 1, a: 1 } },
  };
  const svg = renderer.render({ viewport: { width: 200, height: 100 }, items: [glyph] });
  assertContains(svg, "<text", "text element");
  assertContains(svg, 'font-size="24"', "font size");
  assertContains(svg, "Hello &lt;world&gt; &amp; friends", "escaped text content");
}
console.log("   PASS");

// ── 10. ImageItem ───────────────────────────────────────────────────

console.log("10. ImageItem...");
{
  const img: ImageItem = {
    kind: "image",
    assetRef: { kind: "image", uri: "assets/logo.png" },
    x: 10, y: 10, width: 200, height: 100,
    fit: "cover",
  };
  const svg = renderer.render({ viewport: { width: 300, height: 200 }, items: [img] });
  assertContains(svg, "<image", "image element");
  assertContains(svg, 'href="assets/logo.png"', "href");
  assertContains(svg, 'preserveAspectRatio="xMidYMid slice"', "cover fit");
}
console.log("   PASS");

// ── 11. GroupItem with transform ────────────────────────────────────

console.log("11. GroupItem with transform...");
{
  const group: GroupItem = {
    kind: "group",
    transform: [1, 0, 50, 0, 1, 50, 0, 0, 1], // translate(50, 50)
    children: [
      { kind: "rect", x: 0, y: 0, width: 20, height: 20, fill: { color: { r: 1, g: 0, b: 0, a: 1 } } },
    ],
  };
  const svg = renderer.render({ viewport: { width: 100, height: 100 }, items: [group] });
  assertContains(svg, "<g", "group element");
  assertContains(svg, "matrix(1,0,0,1,50,50)", "translate transform");
  assertContains(svg, "</g>", "group close");
}
console.log("   PASS");

// ── 12. GroupItem with clip ─────────────────────────────────────────

console.log("12. GroupItem with clip path...");
{
  const group: GroupItem = {
    kind: "group",
    clip: [
      { kind: "M", x: 0, y: 0 },
      { kind: "L", x: 100, y: 0 },
      { kind: "L", x: 100, y: 100 },
      { kind: "L", x: 0, y: 100 },
      { kind: "Z" },
    ],
    children: [
      { kind: "ellipse", cx: 50, cy: 50, rx: 80, ry: 80, fill: { color: { r: 0, g: 0, b: 1, a: 1 } } },
    ],
  };
  const svg = renderer.render({ viewport: { width: 200, height: 200 }, items: [group] });
  assertContains(svg, "<clipPath", "clipPath element");
  assertContains(svg, 'clip-path="url(#df-clip-0)"', "clip-path reference");
  assertContains(svg, "<ellipse", "clipped child");
}
console.log("   PASS");

// ── 13. Stable id attribute ─────────────────────────────────────────

console.log("13. Stable id attribute...");
{
  const rect: RectItem = {
    kind: "rect", id: "safe-area-top", x: 0, y: 0, width: 100, height: 10,
    fill: { color: { r: 0, g: 0, b: 0, a: 0.85 } },
  };
  const svg = renderer.render({ viewport: { width: 100, height: 100 }, items: [rect] });
  assertContains(svg, 'id="safe-area-top"', "id attribute");
}
console.log("   PASS");

// ── 14. Arc path command ────────────────────────────────────────────

console.log("14. Arc path command...");
{
  const arc: PathItem = {
    kind: "path",
    commands: [
      { kind: "M", x: 10, y: 80 },
      { kind: "A", rx: 25, ry: 25, rotation: 0, largeArc: false, sweep: true, x: 50, y: 80 },
    ],
    stroke: { color: { r: 1, g: 1, b: 1, a: 1 } },
    strokeStyle: { width: 1 },
  };
  const svg = renderer.render({ viewport: { width: 100, height: 100 }, items: [arc] });
  assertContains(svg, "A25 25 0 0 1 50 80", "arc command");
}
console.log("   PASS");

// ── 15. Cross-validation: safe-area bars vs existing adapter ────────

console.log("15. Cross-validation: safe-area bars...");
{
  const frame: FrameDimensions = { widthPx: 1920, heightPx: 1080 };
  const safeArea: SafeAreaInsets = { top: 100, right: 100, bottom: 100, left: 100 };

  // Existing adapter output
  const adapterSvg = createSafeAreaMarkup(frame, safeArea, "#202020");

  // Count bars in existing output
  const adapterRectCount = countOccurrences(adapterSvg, "<rect");
  assert.equal(adapterRectCount, 4, "adapter produces 4 rects");

  // Equivalent render-ir display list
  const bgColor = { r: 0x20 / 255, g: 0x20 / 255, b: 0x20 / 255, a: 0.85 };
  const dl: DisplayList = {
    viewport: { width: 1920, height: 1080 },
    items: [
      {
        kind: "group", id: "safe-area",
        children: [
          { kind: "rect", x: 0, y: 0, width: 1920, height: 100, fill: { color: bgColor } } as RectItem,
          { kind: "rect", x: 0, y: 980, width: 1920, height: 100, fill: { color: bgColor } } as RectItem,
          { kind: "rect", x: 0, y: 100, width: 100, height: 880, fill: { color: bgColor } } as RectItem,
          { kind: "rect", x: 1820, y: 100, width: 100, height: 880, fill: { color: bgColor } } as RectItem,
        ],
      },
    ],
  };
  const irSvg = renderer.render(dl);
  const irRectCount = countOccurrences(irSvg, "<rect");
  assert.equal(irRectCount, 4, "render-ir produces same 4 rects");

  // Verify geometry matches: same bar dimensions
  assertContains(irSvg, 'width="1920" height="100"', "top bar size");
  assertContains(irSvg, 'y="980"', "bottom bar y");
  assertContains(irSvg, 'width="100" height="880"', "side bar size");
  assertContains(irSvg, 'x="1820"', "right bar x");

  // Verify the adapter also has matching geometry
  assertContains(adapterSvg, 'width="1920" height="100"', "adapter top bar");
  assertContains(adapterSvg, 'y="980"', "adapter bottom bar y");
  assertContains(adapterSvg, 'width="100" height="880"', "adapter side bar");
}
console.log("   PASS");

// ── Summary ─────────────────────────────────────────────────────────

console.log("\n✓ All 15 render-ir SVG tests passed.");
