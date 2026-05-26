// Unit-agnostic grid math. Distilled from:
//   - `design-foundry/packages/layout-grid/src/index.ts` (pixel-flavored)
//   - `a4-generator/packages/layout-grid/src/index.ts`     (point-flavored)
//
// Numeric values are pure scalars; callers tag them as pt or px at the
// boundary. The pixel wrapper in `./index.ts` is now a thin adapter over
// this module, and a4-generator will adopt a point-flavored adapter in
// Phase 2 (see /memories/session/plan.md).

export interface GridCoreInput {
  /** Outer canvas dimensions (page or frame). */
  canvasWidth: number;
  canvasHeight: number;
  /**
   * Optional safe area, in canvas units. Treated as inward insets. The grid
   * is resolved inside the safe area when `fitWithinSafeArea` is true.
   */
  safeArea?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  fitWithinSafeArea?: boolean;
  /** Baseline unit (e.g. 12pt, or 8px). */
  baselineStep: number;
  /** Margins between the safe-area rect and the content rect. */
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  columnCount: number;
  columnGutter: number;
  rowCount: number;
  rowGutter: number;
}

export interface GridCoreOptions {
  /** Snap every spacing value (including horizontal) to baseline multiples. */
  enforceBaselineMultiples?: boolean;
  /** Snap only vertical spacing to baseline multiples. */
  enforceVerticalBaselineMultiples?: boolean;
  /**
   * When true, treat `marginBottom` as a minimum; bottom margin grows to
   * absorb leftover vertical space so the row stack stays baseline-faithful.
   * Matches a4-generator's `resolveGridMetrics` semantics.
   */
  growBottomMarginToAbsorbSlack?: boolean;
}

export interface GridCoreMetrics {
  baselineStep: number;
  columnCount: number;
  rowCount: number;
  layoutLeft: number;
  layoutTop: number;
  layoutRight: number;
  layoutBottom: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  columnGutter: number;
  rowGutter: number;
  columnWidth: number;
  rowHeight: number;
  contentLeft: number;
  contentTop: number;
  contentRight: number;
  contentBottom: number;
  contentWidth: number;
  contentHeight: number;
  /** Left edge of each column. Length === columnCount. */
  columnKeylines: number[];
  /** Top edge of each row. Length === rowCount. */
  rowTops: number[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToMultiple(value: number, step: number): number {
  return Math.max(0, Math.round(value / step)) * step;
}

export function resolveGridCore(
  input: GridCoreInput,
  options: GridCoreOptions = {}
): GridCoreMetrics {
  const baselineStep = Math.max(1, input.baselineStep);
  const enforceAll = options.enforceBaselineMultiples === true;
  const enforceVertical = enforceAll || options.enforceVerticalBaselineMultiples === true;
  const normalizeH = (v: number): number =>
    enforceAll ? roundToMultiple(v, baselineStep) : Math.max(0, v);
  const normalizeV = (v: number): number =>
    enforceVertical ? roundToMultiple(v, baselineStep) : Math.max(0, v);

  const columnCount = Math.max(1, Math.round(input.columnCount));
  const rowCount = Math.max(1, Math.round(input.rowCount));
  const useSafeArea = Boolean(input.fitWithinSafeArea && input.safeArea);
  const safe = input.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const layoutLeft = useSafeArea ? Math.max(0, safe.left) : 0;
  const layoutTop = useSafeArea ? Math.max(0, safe.top) : 0;
  const layoutRight = useSafeArea
    ? Math.max(layoutLeft, input.canvasWidth - Math.max(0, safe.right))
    : input.canvasWidth;
  const layoutBottom = useSafeArea
    ? Math.max(layoutTop, input.canvasHeight - Math.max(0, safe.bottom))
    : input.canvasHeight;
  const layoutWidth = Math.max(0, layoutRight - layoutLeft);
  const layoutHeight = Math.max(0, layoutBottom - layoutTop);

  const marginLeft = normalizeH(input.marginLeft);
  const marginRight = normalizeH(input.marginRight);
  const marginTop = normalizeV(input.marginTop);
  const requestedMarginBottom = normalizeV(input.marginBottom);
  const minMarginBottom = options.growBottomMarginToAbsorbSlack
    ? Math.max(requestedMarginBottom, marginTop)
    : requestedMarginBottom;

  const columnGutter = normalizeH(input.columnGutter);
  const requestedRowGutter = normalizeV(input.rowGutter);
  const rowGapCount = Math.max(0, rowCount - 1);
  const availableRowStack = Math.max(0, layoutHeight - marginTop - minMarginBottom);

  let rowGutter: number;
  if (rowGapCount === 0) {
    rowGutter = 0;
  } else if (options.growBottomMarginToAbsorbSlack) {
    const maxRowGutter = enforceVertical
      ? Math.floor(availableRowStack / (rowGapCount * baselineStep)) * baselineStep
      : availableRowStack / rowGapCount;
    rowGutter = Math.min(requestedRowGutter, Math.max(0, maxRowGutter));
  } else {
    rowGutter = requestedRowGutter;
  }

  const totalRowGutter = rowGutter * rowGapCount;
  const maxRowHeightSpace = availableRowStack - totalRowGutter;
  const rowHeight = Math.max(
    0,
    Math.floor(Math.max(0, maxRowHeightSpace) / (rowCount * baselineStep)) * baselineStep
  );

  const marginBottom = options.growBottomMarginToAbsorbSlack
    ? Math.max(
        minMarginBottom,
        layoutHeight - marginTop - rowHeight * rowCount - totalRowGutter
      )
    : Math.max(
        0,
        layoutHeight - marginTop - rowHeight * rowCount - totalRowGutter
      );

  const contentLeft = layoutLeft + marginLeft;
  const contentTop = layoutTop + marginTop;
  const contentRight = layoutRight - marginRight;
  const contentBottom = layoutBottom - marginBottom;
  const contentWidth = Math.max(0, contentRight - contentLeft);
  const contentHeight = Math.max(0, contentBottom - contentTop);
  const columnWidth = columnCount <= 0
    ? 0
    : (contentWidth - columnGutter * Math.max(0, columnCount - 1)) / columnCount;

  const columnKeylines = Array.from({ length: columnCount }, (_, index) =>
    contentLeft + index * (columnWidth + columnGutter)
  );
  const rowTops = Array.from({ length: rowCount }, (_, index) =>
    contentTop + index * (rowHeight + rowGutter)
  );

  return {
    baselineStep,
    columnCount,
    rowCount,
    layoutLeft,
    layoutTop,
    layoutRight,
    layoutBottom,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    columnGutter,
    rowGutter,
    columnWidth,
    rowHeight,
    contentLeft,
    contentTop,
    contentRight,
    contentBottom,
    contentWidth,
    contentHeight,
    columnKeylines,
    rowTops
  };
}

// ---------------------------------------------------------------------------
// Snap helpers (unit-agnostic)
// ---------------------------------------------------------------------------

export function getKeyline(metrics: GridCoreMetrics, columnIndex1Based: number): number {
  const safeIndex = clamp(
    Math.round(columnIndex1Based),
    1,
    Math.max(1, metrics.columnCount)
  );
  return metrics.columnKeylines[safeIndex - 1] ?? metrics.contentLeft;
}

export function getColumnSpanWidth(
  metrics: GridCoreMetrics,
  columnStart1Based: number,
  columnSpan: number
): number {
  const safeStart = clamp(
    Math.round(columnStart1Based),
    1,
    Math.max(1, metrics.columnCount)
  );
  const maxSpan = Math.max(1, metrics.columnCount - safeStart + 1);
  const safeSpan = clamp(Math.round(columnSpan), 1, maxSpan);
  return Math.max(
    0,
    safeSpan * metrics.columnWidth + Math.max(0, safeSpan - 1) * metrics.columnGutter
  );
}

export function getRowTop(metrics: GridCoreMetrics, rowIndex1Based: number): number {
  const safeIndex = clamp(
    Math.round(rowIndex1Based),
    1,
    Math.max(1, metrics.rowCount)
  );
  return metrics.rowTops[safeIndex - 1] ?? metrics.contentTop;
}

export function getRowSpanHeight(
  metrics: GridCoreMetrics,
  rowStart1Based: number,
  rowSpan: number
): number {
  const safeStart = clamp(
    Math.round(rowStart1Based),
    1,
    Math.max(1, metrics.rowCount)
  );
  const maxSpan = Math.max(1, metrics.rowCount - safeStart + 1);
  const safeSpan = clamp(Math.round(rowSpan), 1, maxSpan);
  return Math.max(
    0,
    safeSpan * metrics.rowHeight + Math.max(0, safeSpan - 1) * metrics.rowGutter
  );
}

export function snapXToKeyline(
  metrics: GridCoreMetrics,
  x: number
): { columnIndex: number; anchorX: number } {
  const keylines = metrics.columnKeylines.length > 0
    ? metrics.columnKeylines
    : [metrics.contentLeft];
  let bestIndex = 1;
  let bestAnchor = keylines[0]!;
  let bestDistance = Math.abs(x - bestAnchor);
  for (let i = 1; i < keylines.length; i += 1) {
    const candidate = keylines[i]!;
    const distance = Math.abs(x - candidate);
    if (distance < bestDistance) {
      bestIndex = i + 1;
      bestAnchor = candidate;
      bestDistance = distance;
    }
  }
  return { columnIndex: bestIndex, anchorX: bestAnchor };
}

export function snapBaselineToGrid(
  metrics: GridCoreMetrics,
  y: number
): { rowIndex: number; offsetBaselines: number } {
  const rowStep = metrics.rowHeight + metrics.rowGutter;
  let best = {
    rowIndex: 1,
    offsetBaselines: 0,
    distance: Number.POSITIVE_INFINITY
  };
  for (let rowIndex = 1; rowIndex <= Math.max(1, metrics.rowCount); rowIndex += 1) {
    const rowTop = metrics.contentTop + (rowIndex - 1) * rowStep;
    const offsetBaselines = Math.round((y - rowTop) / Math.max(1, metrics.baselineStep));
    const snapped = rowTop + offsetBaselines * metrics.baselineStep;
    const distance = Math.abs(y - snapped);
    if (distance < best.distance) {
      best = { rowIndex, offsetBaselines, distance };
    }
  }
  return { rowIndex: best.rowIndex, offsetBaselines: best.offsetBaselines };
}

export function getBaselineY(
  metrics: GridCoreMetrics,
  baselineRow0Based: number
): number {
  const safeRow = Math.max(0, Math.round(baselineRow0Based));
  return metrics.contentTop + safeRow * metrics.baselineStep;
}

export function getLastBaselineRow(metrics: GridCoreMetrics): number {
  return Math.floor(metrics.contentHeight / metrics.baselineStep);
}
