// K5 validation: verify the Canvas2D renderer adapter.
//
// Since Node.js lacks CanvasRenderingContext2D, we use a recording mock
// that captures method calls. This validates the renderer's logic
// (correct calls, correct order) without a pixel-level canvas.

import assert from "node:assert/strict";
import type { DisplayList, RectItem, EllipseItem, LineItem, PathItem, GlyphRunItem, GroupItem } from "@design-foundry/render-ir";
import { Canvas2DRenderer } from "@design-foundry/render-canvas2d";

// ---------------------------------------------------------------------------
// Mock CanvasRenderingContext2D
// ---------------------------------------------------------------------------

type Call = { method: string; args: unknown[] };

function createMockCtx(): { ctx: any; calls: Call[]; canvas: { width: number; height: number } } {
  const calls: Call[] = [];
  const canvas = { width: 0, height: 0 };

  const handler: ProxyHandler<object> = {
    get(_target, prop: string) {
      if (prop === "canvas") return canvas;
      if (prop === "globalAlpha") return 1;

      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
      };
    },
    set(_target, prop: string, value: unknown) {
      calls.push({ method: `set:${prop}`, args: [value] });
      return true;
    },
  };

  const ctx = new Proxy({}, handler);
  return { ctx, calls, canvas };
}

function findCalls(calls: Call[], method: string): Call[] {
  return calls.filter((c) => c.method === method);
}

function hasCall(calls: Call[], method: string): boolean {
  return calls.some((c) => c.method === method);
}

// ---------------------------------------------------------------------------
// 1. Basic construction
// ---------------------------------------------------------------------------

console.log("1. Renderer construction...");
{
  const { ctx } = createMockCtx();
  const renderer = new Canvas2DRenderer(ctx);
  assert.ok(renderer, "Canvas2DRenderer instantiates");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 2. Viewport background
// ---------------------------------------------------------------------------

console.log("\n2. Viewport background...");
{
  const { ctx, calls, canvas } = createMockCtx();
  const renderer = new Canvas2DRenderer(ctx);
  const dl: DisplayList = {
    viewport: { width: 800, height: 600, background: { r: 0, g: 0, b: 0, a: 1 } },
    items: [],
  };

  renderer.render(dl);

  assert.equal(canvas.width, 800, "canvas width set");
  assert.equal(canvas.height, 600, "canvas height set");
  assert.ok(hasCall(calls, "clearRect"), "canvas cleared");
  assert.ok(hasCall(calls, "fillRect"), "background filled");
  assert.ok(
    calls.some((c) => c.method === "set:fillStyle" && String(c.args[0]).includes("rgb(")),
    "fill style set for background",
  );
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 3. RectItem rendering
// ---------------------------------------------------------------------------

console.log("\n3. RectItem rendering...");
{
  const { ctx, calls } = createMockCtx();
  const renderer = new Canvas2DRenderer(ctx);
  const dl: DisplayList = {
    viewport: { width: 100, height: 100 },
    items: [
      {
        kind: "rect" as const,
        x: 10,
        y: 20,
        width: 50,
        height: 30,
        fill: { color: { r: 1, g: 0, b: 0, a: 1 } },
      },
    ],
  };

  renderer.render(dl);

  assert.ok(hasCall(calls, "rect"), "rect() called");
  assert.ok(hasCall(calls, "fill"), "fill() called");
  const rectCall = findCalls(calls, "rect")[0]!;
  assert.deepEqual(rectCall.args, [10, 20, 50, 30], "rect dimensions correct");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 4. RectItem with corner radii
// ---------------------------------------------------------------------------

console.log("\n4. RectItem with corner radii...");
{
  const { ctx, calls } = createMockCtx();
  const renderer = new Canvas2DRenderer(ctx);
  const dl: DisplayList = {
    viewport: { width: 100, height: 100 },
    items: [
      {
        kind: "rect" as const,
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        cornerRadii: [5, 5, 5, 5],
        fill: { color: { r: 0, g: 1, b: 0, a: 1 } },
      },
    ],
  };

  renderer.render(dl);

  assert.ok(hasCall(calls, "roundRect"), "roundRect() called for rounded corners");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 5. EllipseItem rendering
// ---------------------------------------------------------------------------

console.log("\n5. EllipseItem rendering...");
{
  const { ctx, calls } = createMockCtx();
  const renderer = new Canvas2DRenderer(ctx);
  const dl: DisplayList = {
    viewport: { width: 100, height: 100 },
    items: [
      {
        kind: "ellipse" as const,
        cx: 50,
        cy: 50,
        rx: 30,
        ry: 20,
        fill: { color: { r: 0, g: 0, b: 1, a: 1 } },
      },
    ],
  };

  renderer.render(dl);

  assert.ok(hasCall(calls, "ellipse"), "ellipse() called");
  const eCall = findCalls(calls, "ellipse")[0]!;
  assert.equal(eCall.args[0], 50, "cx correct");
  assert.equal(eCall.args[1], 50, "cy correct");
  assert.equal(eCall.args[2], 30, "rx correct");
  assert.equal(eCall.args[3], 20, "ry correct");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 6. LineItem rendering
// ---------------------------------------------------------------------------

console.log("\n6. LineItem rendering...");
{
  const { ctx, calls } = createMockCtx();
  const renderer = new Canvas2DRenderer(ctx);
  const dl: DisplayList = {
    viewport: { width: 100, height: 100 },
    items: [
      {
        kind: "line" as const,
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 100,
        stroke: { color: { r: 1, g: 1, b: 1, a: 1 } },
      },
    ],
  };

  renderer.render(dl);

  assert.ok(hasCall(calls, "moveTo"), "moveTo() called");
  assert.ok(hasCall(calls, "lineTo"), "lineTo() called");
  assert.ok(hasCall(calls, "stroke"), "stroke() called");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 7. PathItem rendering
// ---------------------------------------------------------------------------

console.log("\n7. PathItem rendering...");
{
  const { ctx, calls } = createMockCtx();
  const renderer = new Canvas2DRenderer(ctx);
  const dl: DisplayList = {
    viewport: { width: 100, height: 100 },
    items: [
      {
        kind: "path" as const,
        commands: [
          { kind: "M" as const, x: 10, y: 10 },
          { kind: "L" as const, x: 90, y: 10 },
          { kind: "C" as const, x1: 90, y1: 50, x2: 10, y2: 50, x: 10, y: 90 },
          { kind: "Z" as const },
        ],
        fill: { color: { r: 0.5, g: 0.5, b: 0.5, a: 0.8 } },
      },
    ],
  };

  renderer.render(dl);

  assert.ok(hasCall(calls, "beginPath"), "beginPath() called");
  assert.ok(hasCall(calls, "moveTo"), "moveTo() for M command");
  assert.ok(hasCall(calls, "lineTo"), "lineTo() for L command");
  assert.ok(hasCall(calls, "bezierCurveTo"), "bezierCurveTo() for C command");
  assert.ok(hasCall(calls, "closePath"), "closePath() for Z command");
  assert.ok(hasCall(calls, "fill"), "fill() called");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 8. GlyphRunItem fallback text
// ---------------------------------------------------------------------------

console.log("\n8. GlyphRunItem text fallback...");
{
  const { ctx, calls } = createMockCtx();
  const renderer = new Canvas2DRenderer(ctx);
  const dl: DisplayList = {
    viewport: { width: 200, height: 50 },
    items: [
      {
        kind: "glyph-run" as const,
        x: 10,
        y: 30,
        run: {
          text: "Hello",
          fontSize: 16,
          fontRef: { kind: "font", uri: "arial.ttf" },
          glyphs: [],
        },
        fill: { color: { r: 0, g: 0, b: 0, a: 1 } },
      },
    ],
  };

  renderer.render(dl);

  assert.ok(hasCall(calls, "fillText"), "fillText() called for glyph-run fallback");
  const ftCall = findCalls(calls, "fillText")[0]!;
  assert.equal(ftCall.args[0], "Hello", "text content correct");
  assert.equal(ftCall.args[1], 10, "x position correct");
  assert.equal(ftCall.args[2], 30, "y position correct");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 9. GroupItem with transform + children
// ---------------------------------------------------------------------------

console.log("\n9. GroupItem with transform...");
{
  const { ctx, calls } = createMockCtx();
  const renderer = new Canvas2DRenderer(ctx);
  const dl: DisplayList = {
    viewport: { width: 100, height: 100 },
    items: [
      {
        kind: "group" as const,
        transform: [2, 0, 10, 0, 2, 20, 0, 0, 1],
        children: [
          {
            kind: "rect" as const,
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            fill: { color: { r: 1, g: 0, b: 0, a: 1 } },
          },
        ],
      },
    ],
  };

  renderer.render(dl);

  assert.ok(hasCall(calls, "save"), "save() called for group");
  assert.ok(hasCall(calls, "transform"), "transform() applied");
  assert.ok(hasCall(calls, "rect"), "child rect rendered");
  assert.ok(hasCall(calls, "restore"), "restore() called after group");

  const transformCall = findCalls(calls, "transform")[0]!;
  // Mat3 row-major [2, 0, 10, 0, 2, 20, 0, 0, 1]
  // Canvas2D: transform(a=m[0], b=m[3], c=m[1], d=m[4], e=m[2], f=m[5])
  assert.deepEqual(transformCall.args, [2, 0, 0, 2, 10, 20], "transform matrix mapping correct");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 10. GroupItem with clip
// ---------------------------------------------------------------------------

console.log("\n10. GroupItem with clip...");
{
  const { ctx, calls } = createMockCtx();
  const renderer = new Canvas2DRenderer(ctx);
  const dl: DisplayList = {
    viewport: { width: 100, height: 100 },
    items: [
      {
        kind: "group" as const,
        clip: [
          { kind: "M" as const, x: 0, y: 0 },
          { kind: "L" as const, x: 100, y: 0 },
          { kind: "L" as const, x: 100, y: 100 },
          { kind: "L" as const, x: 0, y: 100 },
          { kind: "Z" as const },
        ],
        children: [
          {
            kind: "ellipse" as const,
            cx: 50,
            cy: 50,
            rx: 80,
            ry: 80,
            fill: { color: { r: 1, g: 1, b: 0, a: 1 } },
          },
        ],
      },
    ],
  };

  renderer.render(dl);

  assert.ok(hasCall(calls, "clip"), "clip() called");
  assert.ok(hasCall(calls, "ellipse"), "child ellipse rendered inside clip");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 11. Per-item transform and opacity
// ---------------------------------------------------------------------------

console.log("\n11. Per-item transform and opacity...");
{
  const { ctx, calls } = createMockCtx();
  const renderer = new Canvas2DRenderer(ctx);
  const dl: DisplayList = {
    viewport: { width: 100, height: 100 },
    items: [
      {
        kind: "rect" as const,
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        transform: [1, 0, 5, 0, 1, 5, 0, 0, 1],
        opacity: 0.5,
        fill: { color: { r: 1, g: 0, b: 0, a: 1 } },
      },
    ],
  };

  renderer.render(dl);

  // Per-item transform wraps in save/restore
  const saveCount = findCalls(calls, "save").length;
  const restoreCount = findCalls(calls, "restore").length;
  assert.ok(saveCount > 0, "save() for per-item transform");
  assert.equal(saveCount, restoreCount, "save/restore balanced");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 12. Stroke with dash pattern
// ---------------------------------------------------------------------------

console.log("\n12. Stroke with dash pattern...");
{
  const { ctx, calls } = createMockCtx();
  const renderer = new Canvas2DRenderer(ctx);
  const dl: DisplayList = {
    viewport: { width: 100, height: 100 },
    items: [
      {
        kind: "rect" as const,
        x: 10,
        y: 10,
        width: 80,
        height: 80,
        stroke: { color: { r: 0, g: 0, b: 0, a: 1 } },
        strokeStyle: { width: 2, dashArray: [5, 3], dashOffset: 1, cap: "round" as const, join: "round" as const },
      },
    ],
  };

  renderer.render(dl);

  assert.ok(hasCall(calls, "setLineDash"), "setLineDash() called");
  assert.ok(hasCall(calls, "stroke"), "stroke() called");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 13. Multiple items in order
// ---------------------------------------------------------------------------

console.log("\n13. Multiple items render in order...");
{
  const { ctx, calls } = createMockCtx();
  const renderer = new Canvas2DRenderer(ctx);
  const dl: DisplayList = {
    viewport: { width: 100, height: 100 },
    items: [
      {
        kind: "rect" as const,
        x: 0, y: 0, width: 50, height: 50,
        fill: { color: { r: 1, g: 0, b: 0, a: 1 } },
      },
      {
        kind: "ellipse" as const,
        cx: 50, cy: 50, rx: 20, ry: 20,
        fill: { color: { r: 0, g: 1, b: 0, a: 1 } },
      },
    ],
  };

  renderer.render(dl);

  const rectIdx = calls.findIndex((c) => c.method === "rect");
  const ellipseIdx = calls.findIndex((c) => c.method === "ellipse");
  assert.ok(rectIdx < ellipseIdx, "rect rendered before ellipse (draw order preserved)");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 14. Path with arc command (SVG A)
// ---------------------------------------------------------------------------

console.log("\n14. Path with arc command...");
{
  const { ctx, calls } = createMockCtx();
  const renderer = new Canvas2DRenderer(ctx);
  const dl: DisplayList = {
    viewport: { width: 200, height: 200 },
    items: [
      {
        kind: "path" as const,
        commands: [
          { kind: "M" as const, x: 50, y: 100 },
          { kind: "A" as const, rx: 50, ry: 50, rotation: 0, largeArc: false, sweep: true, x: 150, y: 100 },
        ],
        stroke: { color: { r: 0, g: 0, b: 0, a: 1 } },
        strokeStyle: { width: 2 },
      },
    ],
  };

  renderer.render(dl);

  // Arc should call ellipse(), NOT fall back to lineTo only
  assert.ok(hasCall(calls, "ellipse"), "ellipse() called for circular arc (not lineTo fallback)");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 15. Path with elliptical arc (non-uniform radii)
// ---------------------------------------------------------------------------

console.log("\n15. Path with elliptical arc...");
{
  const { ctx, calls } = createMockCtx();
  const renderer = new Canvas2DRenderer(ctx);
  const dl: DisplayList = {
    viewport: { width: 200, height: 200 },
    items: [
      {
        kind: "path" as const,
        commands: [
          { kind: "M" as const, x: 30, y: 100 },
          { kind: "A" as const, rx: 80, ry: 40, rotation: 0, largeArc: true, sweep: false, x: 170, y: 100 },
          { kind: "Z" as const },
        ],
        fill: { color: { r: 1, g: 0, b: 0, a: 0.5 } },
      },
    ],
  };

  renderer.render(dl);

  assert.ok(hasCall(calls, "ellipse"), "ellipse() called for elliptical arc");
  assert.ok(hasCall(calls, "closePath"), "closePath() for Z command after arc");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 16. Non-uniform corner radii
// ---------------------------------------------------------------------------

console.log("\n16. Non-uniform corner radii...");
{
  const { ctx, calls } = createMockCtx();
  const renderer = new Canvas2DRenderer(ctx);
  const dl: DisplayList = {
    viewport: { width: 100, height: 100 },
    items: [
      {
        kind: "rect" as const,
        x: 5, y: 5, width: 90, height: 90,
        cornerRadii: [20, 5, 10, 0],
        fill: { color: { r: 0, g: 1, b: 0, a: 1 } },
      },
    ],
  };

  renderer.render(dl);

  assert.ok(hasCall(calls, "roundRect"), "roundRect() called for non-uniform corners");
  const rrCall = findCalls(calls, "roundRect")[0]!;
  // Non-uniform: array of 4 radii
  assert.deepEqual(rrCall.args, [5, 5, 90, 90, [20, 5, 10, 0]], "non-uniform radii passed correctly");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
console.log("\n✓ All 16 render-canvas2d tests passed.");
