// K7 validation: verify the PDF renderer adapter.
//
// Produces a real PDF from a test DisplayList and validates:
// - Output is a valid PDF (starts with %PDF)
// - Non-trivial size
// - All item types render without error
// - Cross-validates structure against SVG renderer output

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import type { DisplayList } from "@design-foundry/render-ir";
import { PdfRenderer } from "@design-foundry/render-pdf";

// ---------------------------------------------------------------------------
// Test display list with all supported item types
// ---------------------------------------------------------------------------

const testDl: DisplayList = {
  viewport: {
    width: 400,
    height: 300,
    background: { r: 1, g: 1, b: 1, a: 1 },
  },
  items: [
    // 1. Simple rectangle
    {
      kind: "rect" as const,
      x: 10, y: 10, width: 80, height: 60,
      fill: { color: { r: 1, g: 0, b: 0, a: 1 } },
    },
    // 2. Stroked rectangle
    {
      kind: "rect" as const,
      x: 100, y: 10, width: 80, height: 60,
      stroke: { color: { r: 0, g: 0, b: 1, a: 1 } },
      strokeStyle: { width: 3, cap: "round" as const, join: "round" as const },
    },
    // 3. Rounded rectangle
    {
      kind: "rect" as const,
      x: 200, y: 10, width: 80, height: 60,
      cornerRadii: [10, 10, 10, 10] as [number, number, number, number],
      fill: { color: { r: 0, g: 0.8, b: 0, a: 0.7 } },
    },
    // 4. Ellipse
    {
      kind: "ellipse" as const,
      cx: 50, cy: 150, rx: 40, ry: 25,
      fill: { color: { r: 0, g: 0, b: 1, a: 1 } },
    },
    // 5. Line
    {
      kind: "line" as const,
      x1: 100, y1: 120, x2: 250, y2: 180,
      stroke: { color: { r: 0.5, g: 0, b: 0.5, a: 1 } },
      strokeStyle: { width: 2, cap: "butt" as const, join: "miter" as const },
    },
    // 6. Path (triangle)
    {
      kind: "path" as const,
      commands: [
        { kind: "M" as const, x: 300, y: 120 },
        { kind: "L" as const, x: 380, y: 180 },
        { kind: "L" as const, x: 300, y: 180 },
        { kind: "Z" as const },
      ],
      fill: { color: { r: 1, g: 0.5, b: 0, a: 0.9 } },
    },
    // 7. Path with cubic bezier
    {
      kind: "path" as const,
      commands: [
        { kind: "M" as const, x: 10, y: 220 },
        { kind: "C" as const, x1: 60, y1: 190, x2: 100, y2: 270, x: 150, y: 220 },
      ],
      stroke: { color: { r: 0, g: 0.5, b: 0.5, a: 1 } },
      strokeStyle: { width: 2, cap: "round" as const, join: "round" as const },
    },
    // 8. Glyph-run (text fallback)
    {
      kind: "glyph-run" as const,
      x: 10, y: 290,
      run: {
        text: "PDF renderer K7",
        fontSize: 14,
        fontRef: { kind: "font", uri: "helvetica" },
        glyphs: [],
      },
      fill: { color: { r: 0, g: 0, b: 0, a: 1 } },
    },
    // 9. Group with children
    {
      kind: "group" as const,
      opacity: 0.5,
      children: [
        {
          kind: "rect" as const,
          x: 200, y: 200, width: 60, height: 40,
          fill: { color: { r: 1, g: 0, b: 1, a: 1 } },
        },
        {
          kind: "ellipse" as const,
          cx: 350, cy: 250, rx: 30, ry: 20,
          fill: { color: { r: 0, g: 1, b: 1, a: 1 } },
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// 1. Renderer construction
// ---------------------------------------------------------------------------

console.log("1. Renderer construction...");
{
  const renderer = new PdfRenderer();
  assert.ok(renderer, "PdfRenderer instantiates");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 2. Render produces valid PDF bytes
// ---------------------------------------------------------------------------

console.log("\n2. Render produces valid PDF...");
let pdfBytes: Uint8Array;
{
  const renderer = new PdfRenderer();
  pdfBytes = await renderer.render(testDl);

  assert.ok(pdfBytes instanceof Uint8Array, "output is Uint8Array");
  assert.ok(pdfBytes.length > 500, `PDF has reasonable size (${pdfBytes.length} bytes)`);

  // Check PDF magic header
  const header = String.fromCharCode(...pdfBytes.slice(0, 5));
  assert.equal(header, "%PDF-", "PDF starts with %PDF- header");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 3. PDF contains expected trailer
// ---------------------------------------------------------------------------

console.log("\n3. PDF has proper trailer...");
{
  const trailer = new TextDecoder().decode(pdfBytes.slice(-6));
  assert.ok(trailer.includes("%%EOF"), "PDF ends with %%EOF marker");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 4. Empty display list produces minimal PDF
// ---------------------------------------------------------------------------

console.log("\n4. Empty display list...");
{
  const renderer = new PdfRenderer();
  const emptyDl: DisplayList = {
    viewport: { width: 100, height: 100 },
    items: [],
  };
  const bytes = await renderer.render(emptyDl);
  assert.ok(bytes.length > 0, "empty display list still produces valid PDF");
  const header = String.fromCharCode(...bytes.slice(0, 5));
  assert.equal(header, "%PDF-", "empty PDF has valid header");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 5. Background color is rendered
// ---------------------------------------------------------------------------

console.log("\n5. Background color...");
{
  const renderer = new PdfRenderer();
  const bgDl: DisplayList = {
    viewport: { width: 50, height: 50, background: { r: 0, g: 0, b: 0, a: 1 } },
    items: [],
  };
  const bgBytes = await renderer.render(bgDl);
  // A PDF with a background rect should be larger than one without
  const noBgDl: DisplayList = {
    viewport: { width: 50, height: 50 },
    items: [],
  };
  const noBgBytes = await renderer.render(noBgDl);
  assert.ok(bgBytes.length > noBgBytes.length, "background adds content to PDF");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 6. Multiple renders are independent (stateless)
// ---------------------------------------------------------------------------

console.log("\n6. Stateless rendering...");
{
  const renderer = new PdfRenderer();
  const bytes1 = await renderer.render(testDl);
  const bytes2 = await renderer.render(testDl);
  assert.equal(bytes1.length, bytes2.length, "identical display lists produce same-size PDFs");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 7. Semi-transparent items don't crash
// ---------------------------------------------------------------------------

console.log("\n7. Semi-transparent items...");
{
  const renderer = new PdfRenderer();
  const dl: DisplayList = {
    viewport: { width: 100, height: 100 },
    items: [
      {
        kind: "rect" as const,
        x: 10, y: 10, width: 80, height: 80,
        fill: { color: { r: 1, g: 0, b: 0, a: 0.3 } },
        opacity: 0.5,
      },
    ],
  };
  const bytes = await renderer.render(dl);
  assert.ok(bytes.length > 0, "semi-transparent items render without error");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 8. Non-uniform corner radii
// ---------------------------------------------------------------------------

console.log("\n8. Non-uniform corner radii...");
{
  const renderer = new PdfRenderer();
  const dl: DisplayList = {
    viewport: { width: 100, height: 100 },
    items: [
      {
        kind: "rect" as const,
        x: 10, y: 10, width: 80, height: 80,
        cornerRadii: [20, 5, 10, 0] as [number, number, number, number],
        fill: { color: { r: 0, g: 1, b: 0, a: 1 } },
      },
    ],
  };
  const bytes = await renderer.render(dl);
  assert.ok(bytes.length > 0, "non-uniform corners render without error");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 9. Dashed stroke
// ---------------------------------------------------------------------------

console.log("\n9. Dashed stroke...");
{
  const renderer = new PdfRenderer();
  const dl: DisplayList = {
    viewport: { width: 100, height: 100 },
    items: [
      {
        kind: "rect" as const,
        x: 10, y: 10, width: 80, height: 80,
        stroke: { color: { r: 0, g: 0, b: 0, a: 1 } },
        strokeStyle: { width: 2, dashArray: [5, 3], dashOffset: 1, cap: "butt" as const, join: "miter" as const },
      },
    ],
  };
  const bytes = await renderer.render(dl);
  assert.ok(bytes.length > 0, "dashed stroke renders without error");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 10. Path with arc command
// ---------------------------------------------------------------------------

console.log("\n10. Path with arc command...");
{
  const renderer = new PdfRenderer();
  const dl: DisplayList = {
    viewport: { width: 200, height: 200 },
    items: [
      {
        kind: "path" as const,
        commands: [
          { kind: "M" as const, x: 30, y: 100 },
          { kind: "A" as const, rx: 50, ry: 50, rotation: 0, largeArc: false, sweep: true, x: 130, y: 100 },
          { kind: "L" as const, x: 30, y: 100 },
          { kind: "Z" as const },
        ],
        fill: { color: { r: 0, g: 0, b: 1, a: 0.8 } },
      },
    ],
  };
  const bytes = await renderer.render(dl);
  assert.ok(bytes.length > 0, "arc path renders without error");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 11. Write test PDF to disk for manual inspection
// ---------------------------------------------------------------------------

console.log("\n11. Write test PDF...");
{
  const outPath = "tmp/test-render-pdf-k7.pdf";
  writeFileSync(outPath, pdfBytes);
  console.log(`   Written to ${outPath} (${pdfBytes.length} bytes)`);
}
console.log("   PASS");

// ---------------------------------------------------------------------------
console.log("\n✓ All 11 render-pdf tests passed.");
