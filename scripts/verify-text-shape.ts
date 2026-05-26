// K3 validation: shape "Ag" using harfbuzzjs through the text-shape wrapper,
// assert non-zero advance width and exactly two glyphs.

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { loadFont, shape, destroyFont } from "@design-foundry/text-shape";

// ---------------------------------------------------------------------------
// Find a usable font
// ---------------------------------------------------------------------------

const FONT_CANDIDATES = [
  // Windows
  "C:\\Windows\\Fonts\\arial.ttf",
  "C:\\Windows\\Fonts\\segoeui.ttf",
  "C:\\Windows\\Fonts\\calibri.ttf",
  // macOS
  "/System/Library/Fonts/Helvetica.ttc",
  "/System/Library/Fonts/SFPro.ttf",
  // Linux
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
];

const fontPath = FONT_CANDIDATES.find((p) => existsSync(p));
if (!fontPath) {
  console.error("⚠ No system font found. Tried:", FONT_CANDIDATES);
  console.error("  Skipping text-shape verification.");
  process.exit(0);
}
console.log(`Using font: ${fontPath}`);

// ---------------------------------------------------------------------------
// Load font
// ---------------------------------------------------------------------------

const fontData = readFileSync(fontPath);
const font = loadFont(fontData.buffer as ArrayBuffer, fontPath);

console.log(`Font loaded: upem=${font.upem}`);
assert.ok(font.upem > 0, "font upem should be positive");

// ---------------------------------------------------------------------------
// 1. Shape "Ag" — two glyphs, non-zero advances
// ---------------------------------------------------------------------------

console.log('\n1. Shape "Ag" at 24px...');
{
  const run = shape(font, "Ag", 24);

  assert.equal(run.text, "Ag", "run.text preserves original text");
  assert.equal(run.fontSize, 24, "run.fontSize matches input");
  assert.equal(run.fontRef.uri, fontPath, "run.fontRef.uri matches");
  assert.equal(run.glyphs.length, 2, "exactly 2 glyphs for 'Ag'");

  const [g0, g1] = run.glyphs;

  // "A" glyph
  assert.ok(g0!.glyphId > 0, "A glyph ID should be positive");
  assert.ok(g0!.xAdvance > 0, "A xAdvance should be positive");
  assert.equal(g0!.cluster, 0, "A cluster index should be 0");

  // "g" glyph
  assert.ok(g1!.glyphId > 0, "g glyph ID should be positive");
  assert.ok(g1!.xAdvance > 0, "g xAdvance should be positive");
  assert.equal(g1!.cluster, 1, "g cluster index should be 1");

  // Total advance should be non-zero and reasonable
  const totalAdvance = g0!.xAdvance + g1!.xAdvance;
  assert.ok(totalAdvance > 10 && totalAdvance < 100, `total advance ${totalAdvance} should be reasonable at 24px`);

  console.log(`   Glyphs: [${g0!.glyphId}, ${g1!.glyphId}]`);
  console.log(`   Advances: [${g0!.xAdvance.toFixed(2)}, ${g1!.xAdvance.toFixed(2)}]`);
  console.log("   PASS");
}

// ---------------------------------------------------------------------------
// 2. Font size scaling — same text at different sizes
// ---------------------------------------------------------------------------

console.log("\n2. Font size scaling...");
{
  const run12 = shape(font, "Ag", 12);
  const run24 = shape(font, "Ag", 24);

  const advance12 = run12.glyphs.reduce((s, g) => s + g.xAdvance, 0);
  const advance24 = run24.glyphs.reduce((s, g) => s + g.xAdvance, 0);

  // 24px advances should be exactly 2× the 12px advances
  const ratio = advance24 / advance12;
  assert.ok(
    Math.abs(ratio - 2) < 0.001,
    `advance ratio should be 2.0, got ${ratio.toFixed(4)}`,
  );
  console.log(`   12px total advance: ${advance12.toFixed(2)}`);
  console.log(`   24px total advance: ${advance24.toFixed(2)}`);
  console.log(`   Ratio: ${ratio.toFixed(4)}`);
  console.log("   PASS");
}

// ---------------------------------------------------------------------------
// 3. Direction — RTL shaping
// ---------------------------------------------------------------------------

console.log("\n3. RTL direction...");
{
  const run = shape(font, "AB", 24, { direction: "rtl" });
  assert.equal(run.glyphs.length, 2, "2 glyphs for 'AB' in RTL");
  // In RTL, cluster order is reversed
  assert.ok(run.glyphs[0]!.cluster >= run.glyphs[1]!.cluster,
    "RTL clusters should be in reverse order");
  console.log("   PASS");
}

// ---------------------------------------------------------------------------
// 4. Empty string
// ---------------------------------------------------------------------------

console.log("\n4. Empty string...");
{
  const run = shape(font, "", 24);
  assert.equal(run.glyphs.length, 0, "empty text produces no glyphs");
  assert.equal(run.text, "", "text preserved");
  console.log("   PASS");
}

// ---------------------------------------------------------------------------
// 5. Longer string — cluster tracking
// ---------------------------------------------------------------------------

console.log('\n5. Longer string "Hello"...');
{
  const run = shape(font, "Hello", 16);
  assert.equal(run.glyphs.length, 5, "5 glyphs for 'Hello'");

  // Clusters should be monotonically increasing for LTR Latin
  for (let i = 1; i < run.glyphs.length; i++) {
    assert.ok(
      run.glyphs[i]!.cluster >= run.glyphs[i - 1]!.cluster,
      `cluster ${i} should be >= cluster ${i - 1}`,
    );
  }

  const totalAdvance = run.glyphs.reduce((s, g) => s + g.xAdvance, 0);
  assert.ok(totalAdvance > 0, "total advance should be positive");
  console.log(`   Total advance: ${totalAdvance.toFixed(2)}`);
  console.log("   PASS");
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

destroyFont(font);

console.log("\n✓ All 5 text-shape tests passed.");
