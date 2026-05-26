import { describe, it, expect } from "vitest";
import type { FrameSize, GridSettings, LayoutGridMetrics, SafeAreaInsets, TextFieldPlacementSpec, TextStyleSpec } from "@design-foundry/core-types";
import { computeLayoutGridMetrics } from "@design-foundry/layout-grid";
import {
  createApproximateTextMeasurer,
  wrapTextLines,
  measureTextBlock,
  getMinimumFirstBaselineInsetPx,
  resolveTextPlacement
} from "./index.js";

// --- test fixtures ---

const STYLE: TextStyleSpec = { key: "body", fontSizePx: 24, lineHeightPx: 32 };
const SMALL_STYLE: TextStyleSpec = { key: "caption", fontSizePx: 12, lineHeightPx: 16 };

function makeMeasurer() {
  return createApproximateTextMeasurer();
}

function makeMetrics(): LayoutGridMetrics {
  return computeLayoutGridMetrics(
    { widthPx: 1920, heightPx: 1080 },
    { top: 0, right: 0, bottom: 0, left: 0 },
    {
      baselineStepPx: 8,
      rowCount: 4,
      columnCount: 6,
      marginTopBaselines: 2,
      marginBottomBaselines: 2,
      marginLeftBaselines: 2,
      marginRightBaselines: 2,
      rowGutterBaselines: 1,
      columnGutterBaselines: 1,
      fitWithinSafeArea: false
    }
  );
}

// --- createApproximateTextMeasurer ---

describe("createApproximateTextMeasurer", () => {
  const measurer = makeMeasurer();

  it("measures a single character", () => {
    const result = measurer.measureLine("H", STYLE);
    expect(result.widthPx).toBeGreaterThan(0);
    expect(result.ascentPx).toBeGreaterThan(0);
    expect(result.descentPx).toBeGreaterThan(0);
  });

  it("wider text measures wider", () => {
    const short = measurer.measureLine("Hi", STYLE);
    const long = measurer.measureLine("Hello World", STYLE);
    expect(long.widthPx).toBeGreaterThan(short.widthPx);
  });

  it("larger font produces wider measurement", () => {
    const small = measurer.measureLine("Test", SMALL_STYLE);
    const large = measurer.measureLine("Test", STYLE);
    expect(large.widthPx).toBeGreaterThan(small.widthPx);
  });

  it("ascent + descent approximates font size", () => {
    const result = measurer.measureLine("H", STYLE);
    expect(result.ascentPx + result.descentPx).toBeCloseTo(STYLE.fontSizePx, 0);
  });

  it("whitespace is narrower than letters", () => {
    const space = measurer.measureLine(" ", STYLE);
    const letter = measurer.measureLine("M", STYLE);
    expect(space.widthPx).toBeLessThan(letter.widthPx);
  });

  it("respects custom width ratios", () => {
    const wide = createApproximateTextMeasurer({ averageGlyphWidthRatio: 0.9 });
    const narrow = createApproximateTextMeasurer({ averageGlyphWidthRatio: 0.3 });
    const wideResult = wide.measureLine("test", STYLE);
    const narrowResult = narrow.measureLine("test", STYLE);
    expect(wideResult.widthPx).toBeGreaterThan(narrowResult.widthPx);
  });
});

// --- wrapTextLines ---

describe("wrapTextLines", () => {
  const measurer = makeMeasurer();

  it("returns empty array for empty string", () => {
    expect(wrapTextLines("", 500, STYLE, measurer)).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(wrapTextLines("   ", 500, STYLE, measurer)).toEqual([]);
  });

  it("does not wrap short text", () => {
    const lines = wrapTextLines("Hi", 500, STYLE, measurer);
    expect(lines).toEqual(["Hi"]);
  });

  it("wraps long text into multiple lines", () => {
    const longText = "This is a much longer sentence that should wrap across multiple lines when constrained";
    const lines = wrapTextLines(longText, 200, STYLE, measurer);
    expect(lines.length).toBeGreaterThan(1);
  });

  it("preserves paragraph breaks", () => {
    const lines = wrapTextLines("Line one\nLine two", 500, STYLE, measurer);
    expect(lines).toEqual(["Line one", "Line two"]);
  });

  it("handles single word wider than max width", () => {
    const lines = wrapTextLines("Supercalifragilisticexpialidocious", 10, STYLE, measurer);
    expect(lines).toEqual(["Supercalifragilisticexpialidocious"]);
  });

  it("wraps at word boundaries, not mid-word", () => {
    const lines = wrapTextLines("Hello World", 100, STYLE, measurer);
    for (const line of lines) {
      expect(line).not.toMatch(/^\s/); // no leading spaces
    }
  });
});

// --- measureTextBlock ---

describe("measureTextBlock", () => {
  const measurer = makeMeasurer();

  it("returns max width across lines", () => {
    const result = measureTextBlock(["short", "much longer line here"], STYLE, measurer);
    const longLine = measurer.measureLine("much longer line here", STYLE);
    expect(result.widthPx).toBeCloseTo(longLine.widthPx, 1);
  });

  it("returns ascent and descent from the tallest line", () => {
    const result = measureTextBlock(["Test"], STYLE, measurer);
    expect(result.ascentPx).toBeGreaterThan(0);
    expect(result.descentPx).toBeGreaterThan(0);
  });
});

// --- getMinimumFirstBaselineInsetPx ---

describe("getMinimumFirstBaselineInsetPx", () => {
  const measurer = makeMeasurer();

  it("returns positive inset", () => {
    const inset = getMinimumFirstBaselineInsetPx(STYLE, measurer);
    expect(inset).toBeGreaterThan(0);
  });

  it("scales with font size", () => {
    const small = getMinimumFirstBaselineInsetPx(SMALL_STYLE, measurer);
    const large = getMinimumFirstBaselineInsetPx(STYLE, measurer);
    expect(large).toBeGreaterThan(small);
  });
});

// --- resolveTextPlacement ---

describe("resolveTextPlacement", () => {
  const measurer = makeMeasurer();
  const metrics = makeMetrics();

  function makeField(overrides: Partial<TextFieldPlacementSpec> = {}): TextFieldPlacementSpec {
    return {
      id: "field-1",
      styleKey: "body",
      text: "Hello World",
      keylineIndex: 1,
      rowIndex: 1,
      offsetBaselines: 2,
      columnSpan: 3,
      ...overrides
    };
  }

  it("returns null for empty text", () => {
    expect(resolveTextPlacement(metrics, makeField({ text: "" }), STYLE, measurer)).toBeNull();
  });

  it("returns null for whitespace-only text", () => {
    expect(resolveTextPlacement(metrics, makeField({ text: "   " }), STYLE, measurer)).toBeNull();
  });

  it("returns placement with correct anchors", () => {
    const placement = resolveTextPlacement(metrics, makeField(), STYLE, measurer);
    expect(placement).not.toBeNull();
    expect(placement!.id).toBe("field-1");
    expect(placement!.anchorXPx).toBe(metrics.columnKeylinePositionsPx[0]);
    expect(placement!.keylineIndex).toBe(1);
    expect(placement!.rowIndex).toBe(1);
    expect(placement!.offsetBaselines).toBe(2);
  });

  it("computes bounds with positive dimensions", () => {
    const placement = resolveTextPlacement(metrics, makeField(), STYLE, measurer)!;
    expect(placement.bounds.width).toBeGreaterThan(0);
    expect(placement.bounds.height).toBeGreaterThan(0);
    expect(placement.bounds.right).toBeGreaterThan(placement.bounds.left);
    expect(placement.bounds.bottom).toBeGreaterThan(placement.bounds.top);
  });

  it("wraps long text into multiple lines", () => {
    const longText = "This is a much longer sentence that should definitely wrap across multiple lines";
    const placement = resolveTextPlacement(metrics, makeField({ text: longText, columnSpan: 1 }), STYLE, measurer)!;
    expect(placement.wrappedLines.length).toBeGreaterThan(1);
  });

  it("clamps keylineIndex to valid range", () => {
    const placement = resolveTextPlacement(metrics, makeField({ keylineIndex: 100 }), STYLE, measurer)!;
    expect(placement.keylineIndex).toBeLessThanOrEqual(metrics.columnCount);
  });

  it("clamps rowIndex to valid range", () => {
    const placement = resolveTextPlacement(metrics, makeField({ rowIndex: 100 }), STYLE, measurer)!;
    expect(placement.rowIndex).toBeLessThanOrEqual(metrics.rowCount);
  });

  it("clamps columnSpan to available columns from keyline", () => {
    // From keyline 5 in a 6-column grid, max span is 2
    const placement = resolveTextPlacement(metrics, makeField({ keylineIndex: 5, columnSpan: 10 }), STYLE, measurer)!;
    expect(placement.columnSpan).toBeLessThanOrEqual(2);
  });
});
