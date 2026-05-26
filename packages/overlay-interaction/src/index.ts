import type { LayoutGridMetrics, LogoPlacementSpec, TextFieldPlacementSpec } from "@design-foundry/core-types";
import { getKeylineXPx, snapBaselineToGrid, snapXPxToKeyline } from "@design-foundry/layout-grid";

export type DragAxisLock = "free" | "x" | "y";

export interface DragDelta {
  deltaXPx: number;
  deltaYPx: number;
  axisLock?: DragAxisLock;
}

function applyAxisLock(drag: DragDelta): { deltaXPx: number; deltaYPx: number } {
  switch (drag.axisLock) {
    case "x":
      return { deltaXPx: drag.deltaXPx, deltaYPx: 0 };
    case "y":
      return { deltaXPx: 0, deltaYPx: drag.deltaYPx };
    default:
      return { deltaXPx: drag.deltaXPx, deltaYPx: drag.deltaYPx };
  }
}

function getTextFieldBaselineYPx(metrics: LayoutGridMetrics, field: TextFieldPlacementSpec): number {
  const rowTopPx = metrics.contentTopPx + (field.rowIndex - 1) * (metrics.rowHeightPx + metrics.rowGutterPx);
  return rowTopPx + field.offsetBaselines * metrics.baselineStepPx;
}

export function placeTextFieldAtPosition(
  field: TextFieldPlacementSpec,
  metrics: LayoutGridMetrics,
  anchorXPx: number,
  baselineYPx: number
): TextFieldPlacementSpec {
  const { keylineIndex } = snapXPxToKeyline(metrics, anchorXPx);
  const snappedBaseline = snapBaselineToGrid(metrics, baselineYPx);

  return {
    ...field,
    keylineIndex,
    rowIndex: snappedBaseline.rowIndex,
    offsetBaselines: snappedBaseline.offsetBaselines
  };
}

export function moveTextField(
  field: TextFieldPlacementSpec,
  metrics: LayoutGridMetrics,
  drag: DragDelta
): TextFieldPlacementSpec {
  const currentAnchorXPx = getKeylineXPx(metrics, field.keylineIndex);
  const currentBaselineYPx = getTextFieldBaselineYPx(metrics, field);
  const { deltaXPx, deltaYPx } = applyAxisLock(drag);

  return placeTextFieldAtPosition(
    field,
    metrics,
    currentAnchorXPx + deltaXPx,
    currentBaselineYPx + deltaYPx
  );
}

export function moveLogo(logo: LogoPlacementSpec, drag: DragDelta): LogoPlacementSpec {
  const { deltaXPx, deltaYPx } = applyAxisLock(drag);

  return {
    ...logo,
    xPx: logo.xPx + deltaXPx,
    yPx: logo.yPx + deltaYPx
  };
}