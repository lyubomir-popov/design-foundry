import type { FrameSize, GridSettings, LayoutGridMetrics, SafeAreaInsets } from "@design-foundry/core-types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeLayoutGridMetrics(frame: FrameSize, safeArea: SafeAreaInsets, grid: GridSettings): LayoutGridMetrics {
  const baselineStepPx = Math.max(1, Math.round(grid.baselineStepPx));
  const rowCount = Math.max(1, Math.round(grid.rowCount));
  const columnCount = Math.max(1, Math.round(grid.columnCount));
  const useSafeArea = Boolean(grid.fitWithinSafeArea);
  const layoutLeftPx = useSafeArea ? Math.max(0, safeArea.left) : 0;
  const layoutTopPx = useSafeArea ? Math.max(0, safeArea.top) : 0;
  const layoutRightPx = useSafeArea ? Math.max(layoutLeftPx, frame.widthPx - Math.max(0, safeArea.right)) : frame.widthPx;
  const layoutBottomPx = useSafeArea ? Math.max(layoutTopPx, frame.heightPx - Math.max(0, safeArea.bottom)) : frame.heightPx;
  const layoutWidthPx = Math.max(0, layoutRightPx - layoutLeftPx);
  const layoutHeightPx = Math.max(0, layoutBottomPx - layoutTopPx);

  const legacySideMarginBaselines = Math.max(0, Number(grid.marginSideBaselines ?? 0));
  const leftMarginPx = Math.max(0, Number(grid.marginLeftBaselines ?? legacySideMarginBaselines)) * baselineStepPx;
  const rightMarginPx = Math.max(0, Number(grid.marginRightBaselines ?? legacySideMarginBaselines)) * baselineStepPx;
  const topMarginPx = Math.max(0, Number(grid.marginTopBaselines)) * baselineStepPx;
  const minimumBottomMarginPx = Math.max(0, Number(grid.marginBottomBaselines)) * baselineStepPx;
  const rowGutterPx = Math.max(0, Math.round(grid.rowGutterBaselines)) * baselineStepPx;
  const columnGutterPx = Math.max(0, Math.round(grid.columnGutterBaselines)) * baselineStepPx;
  const maxRowHeightSpace = layoutHeightPx - topMarginPx - minimumBottomMarginPx - rowGutterPx * Math.max(0, rowCount - 1);
  const rowHeightPx = Math.max(0, Math.floor(Math.max(0, maxRowHeightSpace) / (rowCount * baselineStepPx)) * baselineStepPx);
  const bottomMarginPx = Math.max(
    0,
    layoutHeightPx - topMarginPx - rowHeightPx * rowCount - rowGutterPx * Math.max(0, rowCount - 1)
  );
  const contentWidthPx = Math.max(0, layoutWidthPx - leftMarginPx - rightMarginPx - columnGutterPx * Math.max(0, columnCount - 1));
  const columnWidthPx = columnCount <= 0 ? 0 : contentWidthPx / columnCount;
  const columnKeylinePositionsPx = Array.from({ length: columnCount }, (_, index) => (
    Math.round(layoutLeftPx + leftMarginPx + index * (columnWidthPx + columnGutterPx))
  ));

  return {
    baselineStepPx,
    rowCount,
    columnCount,
    leftMarginPx,
    rightMarginPx,
    topMarginPx,
    bottomMarginPx,
    rowGutterPx,
    columnGutterPx,
    rowHeightPx,
    columnWidthPx,
    layoutLeftPx,
    layoutTopPx,
    layoutRightPx,
    layoutBottomPx,
    contentLeftPx: layoutLeftPx + leftMarginPx,
    contentTopPx: layoutTopPx + topMarginPx,
    contentRightPx: layoutRightPx - rightMarginPx,
    contentBottomPx: layoutBottomPx - bottomMarginPx,
    columnKeylinePositionsPx
  };
}

export function getKeylineXPx(metrics: LayoutGridMetrics, keylineIndex: number): number {
  const safeIndex = clamp(Math.round(keylineIndex), 1, Math.max(1, metrics.columnCount));
  return metrics.columnKeylinePositionsPx[safeIndex - 1] ?? metrics.contentLeftPx;
}

export function snapXPxToKeyline(metrics: LayoutGridMetrics, xPx: number): { keylineIndex: number; anchorXPx: number } {
  const keylinePositions = metrics.columnKeylinePositionsPx.length > 0
    ? metrics.columnKeylinePositionsPx
    : [metrics.contentLeftPx];

  let bestIndex = 1;
  let bestAnchorXPx = keylinePositions[0] ?? metrics.contentLeftPx;
  let bestDistancePx = Math.abs(xPx - bestAnchorXPx);

  for (let index = 1; index < keylinePositions.length; index += 1) {
    const candidateXPx = keylinePositions[index] ?? metrics.contentLeftPx;
    const distancePx = Math.abs(xPx - candidateXPx);
    if (distancePx < bestDistancePx) {
      bestIndex = index + 1;
      bestAnchorXPx = candidateXPx;
      bestDistancePx = distancePx;
    }
  }

  return {
    keylineIndex: bestIndex,
    anchorXPx: bestAnchorXPx
  };
}

export function getColumnSpanWidthPx(metrics: LayoutGridMetrics, keylineIndex: number, columnSpan: number): number {
  const safeIndex = clamp(Math.round(keylineIndex), 1, Math.max(1, metrics.columnCount));
  const maxAvailableSpan = Math.max(1, metrics.columnCount - safeIndex + 1);
  const safeSpan = clamp(Math.round(columnSpan), 1, maxAvailableSpan);
  return Math.max(0, safeSpan * metrics.columnWidthPx + Math.max(0, safeSpan - 1) * metrics.columnGutterPx);
}

export function snapBaselineToGrid(metrics: LayoutGridMetrics, baselineYPx: number): { rowIndex: number; offsetBaselines: number } {
  const rowStepPx = metrics.rowHeightPx + metrics.rowGutterPx;
  let best = {
    rowIndex: 1,
    offsetBaselines: 0,
    distancePx: Number.POSITIVE_INFINITY
  };

  for (let rowIndex = 1; rowIndex <= Math.max(1, metrics.rowCount); rowIndex += 1) {
    const rowTopPx = metrics.contentTopPx + (rowIndex - 1) * rowStepPx;
    const offsetBaselines = Math.round((baselineYPx - rowTopPx) / Math.max(1, metrics.baselineStepPx));
    const snappedBaselineYPx = rowTopPx + offsetBaselines * metrics.baselineStepPx;
    const distancePx = Math.abs(baselineYPx - snappedBaselineYPx);
    if (distancePx < best.distancePx) {
      best = { rowIndex, offsetBaselines, distancePx };
    }
  }

  return {
    rowIndex: best.rowIndex,
    offsetBaselines: best.offsetBaselines
  };
}