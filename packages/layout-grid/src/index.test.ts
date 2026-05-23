import { describe, it, expect } from "vitest";
import type { FrameSize, GridSettings, SafeAreaInsets } from "@brand-layout-ops/core-types";
import { computeLayoutGridMetrics, getKeylineXPx, snapXPxToKeyline, getColumnSpanWidthPx, snapBaselineToGrid } from "./index.js";

// --- test fixtures ---

const HD_FRAME: FrameSize = { widthPx: 1920, heightPx: 1080 };
const NO_SAFE_AREA: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const SAFE_AREA: SafeAreaInsets = { top: 60, right: 60, bottom: 60, left: 60 };

function makeGrid(overrides: Partial<GridSettings> = {}): GridSettings {
  return {
    baselineStepPx: 8,
    rowCount: 4,
    columnCount: 6,
    marginTopBaselines: 2,
    marginBottomBaselines: 2,
    marginLeftBaselines: 2,
    marginRightBaselines: 2,
    rowGutterBaselines: 1,
    columnGutterBaselines: 1,
    fitWithinSafeArea: false,
    ...overrides
  };
}

// --- computeLayoutGridMetrics ---

describe("computeLayoutGridMetrics", () => {
  it("computes basic grid metrics for a 1920×1080 frame", () => {
    const metrics = computeLayoutGridMetrics(HD_FRAME, NO_SAFE_AREA, makeGrid());
    expect(metrics.baselineStepPx).toBe(8);
    expect(metrics.rowCount).toBe(4);
    expect(metrics.columnCount).toBe(6);
    expect(metrics.leftMarginPx).toBe(16); // 2 * 8
    expect(metrics.rightMarginPx).toBe(16);
    expect(metrics.topMarginPx).toBe(16);
    expect(metrics.columnKeylinePositionsPx).toHaveLength(6);
  });

  it("produces non-negative dimensions", () => {
    const metrics = computeLayoutGridMetrics(HD_FRAME, NO_SAFE_AREA, makeGrid());
    expect(metrics.rowHeightPx).toBeGreaterThanOrEqual(0);
    expect(metrics.columnWidthPx).toBeGreaterThanOrEqual(0);
    expect(metrics.contentRightPx).toBeGreaterThanOrEqual(metrics.contentLeftPx);
    expect(metrics.contentBottomPx).toBeGreaterThanOrEqual(metrics.contentTopPx);
  });

  it("respects safe area when fitWithinSafeArea is true", () => {
    const metrics = computeLayoutGridMetrics(HD_FRAME, SAFE_AREA, makeGrid({ fitWithinSafeArea: true }));
    expect(metrics.layoutLeftPx).toBe(60);
    expect(metrics.layoutTopPx).toBe(60);
    expect(metrics.layoutRightPx).toBe(1860); // 1920 - 60
    expect(metrics.layoutBottomPx).toBe(1020); // 1080 - 60
  });

  it("ignores safe area when fitWithinSafeArea is false", () => {
    const metrics = computeLayoutGridMetrics(HD_FRAME, SAFE_AREA, makeGrid({ fitWithinSafeArea: false }));
    expect(metrics.layoutLeftPx).toBe(0);
    expect(metrics.layoutTopPx).toBe(0);
    expect(metrics.layoutRightPx).toBe(1920);
    expect(metrics.layoutBottomPx).toBe(1080);
  });

  it("handles single column and single row", () => {
    const metrics = computeLayoutGridMetrics(HD_FRAME, NO_SAFE_AREA, makeGrid({ columnCount: 1, rowCount: 1 }));
    expect(metrics.columnCount).toBe(1);
    expect(metrics.rowCount).toBe(1);
    expect(metrics.columnKeylinePositionsPx).toHaveLength(1);
  });

  it("rounds baseline step up to at least 1", () => {
    const metrics = computeLayoutGridMetrics(HD_FRAME, NO_SAFE_AREA, makeGrid({ baselineStepPx: 0 }));
    expect(metrics.baselineStepPx).toBe(1);
  });

  it("keyline positions are monotonically increasing", () => {
    const metrics = computeLayoutGridMetrics(HD_FRAME, NO_SAFE_AREA, makeGrid());
    for (let i = 1; i < metrics.columnKeylinePositionsPx.length; i++) {
      expect(metrics.columnKeylinePositionsPx[i]).toBeGreaterThan(metrics.columnKeylinePositionsPx[i - 1]);
    }
  });

  it("row height aligns to baseline grid", () => {
    const metrics = computeLayoutGridMetrics(HD_FRAME, NO_SAFE_AREA, makeGrid());
    expect(metrics.rowHeightPx % metrics.baselineStepPx).toBe(0);
  });
});

// --- getKeylineXPx ---

describe("getKeylineXPx", () => {
  const metrics = computeLayoutGridMetrics(HD_FRAME, NO_SAFE_AREA, makeGrid());

  it("returns first keyline for index 1", () => {
    expect(getKeylineXPx(metrics, 1)).toBe(metrics.columnKeylinePositionsPx[0]);
  });

  it("returns last keyline for index = columnCount", () => {
    expect(getKeylineXPx(metrics, 6)).toBe(metrics.columnKeylinePositionsPx[5]);
  });

  it("clamps out-of-range indices", () => {
    expect(getKeylineXPx(metrics, 0)).toBe(metrics.columnKeylinePositionsPx[0]);
    expect(getKeylineXPx(metrics, 100)).toBe(metrics.columnKeylinePositionsPx[5]);
  });
});

// --- snapXPxToKeyline ---

describe("snapXPxToKeyline", () => {
  const metrics = computeLayoutGridMetrics(HD_FRAME, NO_SAFE_AREA, makeGrid());

  it("snaps to the nearest keyline", () => {
    const firstKeyline = metrics.columnKeylinePositionsPx[0];
    const secondKeyline = metrics.columnKeylinePositionsPx[1];
    const midpoint = (firstKeyline + secondKeyline) / 2;
    const snap = snapXPxToKeyline(metrics, firstKeyline + 1);
    expect(snap.keylineIndex).toBe(1);
    expect(snap.anchorXPx).toBe(firstKeyline);

    // just past midpoint should snap to second
    const snapMid = snapXPxToKeyline(metrics, midpoint + 1);
    expect(snapMid.keylineIndex).toBe(2);
  });

  it("returns keylineIndex 1 for far-left positions", () => {
    const snap = snapXPxToKeyline(metrics, -1000);
    expect(snap.keylineIndex).toBe(1);
  });
});

// --- getColumnSpanWidthPx ---

describe("getColumnSpanWidthPx", () => {
  const metrics = computeLayoutGridMetrics(HD_FRAME, NO_SAFE_AREA, makeGrid());

  it("single column span equals column width", () => {
    const width = getColumnSpanWidthPx(metrics, 1, 1);
    expect(width).toBeCloseTo(metrics.columnWidthPx, 1);
  });

  it("two-column span includes one gutter", () => {
    const width = getColumnSpanWidthPx(metrics, 1, 2);
    expect(width).toBeCloseTo(metrics.columnWidthPx * 2 + metrics.columnGutterPx, 1);
  });

  it("full span uses all columns", () => {
    const width = getColumnSpanWidthPx(metrics, 1, 6);
    expect(width).toBeCloseTo(
      metrics.columnWidthPx * 6 + metrics.columnGutterPx * 5,
      1
    );
  });

  it("clamps span to available columns from the start keyline", () => {
    // From keyline 5, max span is 2 (columns 5 and 6)
    const width2 = getColumnSpanWidthPx(metrics, 5, 10);
    const width2expected = getColumnSpanWidthPx(metrics, 5, 2);
    expect(width2).toBeCloseTo(width2expected, 1);
  });
});

// --- snapBaselineToGrid ---

describe("snapBaselineToGrid", () => {
  const metrics = computeLayoutGridMetrics(HD_FRAME, NO_SAFE_AREA, makeGrid());

  it("snaps to the content top with 0 offset", () => {
    const snap = snapBaselineToGrid(metrics, metrics.contentTopPx);
    expect(snap.rowIndex).toBe(1);
    expect(snap.offsetBaselines).toBe(0);
  });

  it("returns positive offset for positions below the first row top", () => {
    const snap = snapBaselineToGrid(metrics, metrics.contentTopPx + metrics.baselineStepPx * 3);
    expect(snap.rowIndex).toBe(1);
    expect(snap.offsetBaselines).toBe(3);
  });

  it("returns a valid rowIndex and integer offsetBaselines for any position", () => {
    const rowStepPx = metrics.rowHeightPx + metrics.rowGutterPx;
    const row2MidPx = metrics.contentTopPx + rowStepPx + metrics.rowHeightPx / 2;
    const snap = snapBaselineToGrid(metrics, row2MidPx);
    expect(snap.rowIndex).toBeGreaterThanOrEqual(1);
    expect(snap.rowIndex).toBeLessThanOrEqual(metrics.rowCount);
    expect(Number.isInteger(snap.offsetBaselines)).toBe(true);
    // reconstructed y should be within half a baseline step of the input
    const reconstructedYPx =
      metrics.contentTopPx +
      (snap.rowIndex - 1) * rowStepPx +
      snap.offsetBaselines * metrics.baselineStepPx;
    expect(Math.abs(reconstructedYPx - row2MidPx)).toBeLessThanOrEqual(
      metrics.baselineStepPx / 2
    );
  });
});
