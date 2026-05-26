import type { LayoutBounds, LogoPlacementSpec, ResolvedTextPlacement, TextFieldPlacementSpec, TextMeasureResult, TextMeasurer, TextStyleSpec } from "@design-foundry/core-types";
import { computeLayoutGridMetrics, getColumnSpanWidthPx, getKeylineXPx } from "@design-foundry/layout-grid";
import { resolveLayerScene } from "@design-foundry/layout-engine";

interface LegacyTextGeometry {
  anchorXPx: number;
  anchorBaselineYPx: number;
  bounds: LayoutBounds;
}

function assertNear(actual: number, expected: number, label: string, epsilon = 0.0001): void {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`);
  }
}

function assertBoundsNear(actual: LayoutBounds, expected: LayoutBounds, label: string): void {
  assertNear(actual.left, expected.left, `${label}.left`);
  assertNear(actual.top, expected.top, `${label}.top`);
  assertNear(actual.width, expected.width, `${label}.width`);
  assertNear(actual.height, expected.height, `${label}.height`);
  assertNear(actual.right, expected.right, `${label}.right`);
  assertNear(actual.bottom, expected.bottom, `${label}.bottom`);
}

function createDeterministicMeasurer(resultsByText: Record<string, TextMeasureResult>): TextMeasurer {
  return {
    measureLine(text: string, style: TextStyleSpec): TextMeasureResult {
      const exact = resultsByText[text];
      if (exact) {
        return exact;
      }

      const fallbackWidthPx = Math.max(24, text.length * Math.max(6, style.fontSizePx * 0.5));
      return {
        widthPx: fallbackWidthPx,
        ascentPx: Math.max(1, style.fontSizePx * 0.8),
        descentPx: Math.max(1, style.fontSizePx * 0.2)
      };
    }
  };
}

function measureWrappedLines(lines: string[], style: TextStyleSpec, measurer: TextMeasurer): TextMeasureResult {
  let widthPx = 0;
  let ascentPx = 0;
  let descentPx = 0;
  const fallbackAscentPx = Math.max(1, style.fontSizePx * 0.8);
  const fallbackDescentPx = Math.max(1, style.fontSizePx * 0.2);

  for (const line of lines) {
    const measured = measurer.measureLine(line || " ", style);
    widthPx = Math.max(widthPx, measured.widthPx);
    ascentPx = Math.max(ascentPx, measured.ascentPx || fallbackAscentPx);
    descentPx = Math.max(descentPx, measured.descentPx || fallbackDescentPx);
  }

  return {
    widthPx,
    ascentPx,
    descentPx
  };
}

function computeLegacyTextGeometry(
  field: TextFieldPlacementSpec,
  style: TextStyleSpec,
  grid: ReturnType<typeof computeLayoutGridMetrics>,
  wrappedLines: string[],
  measurer: TextMeasurer
): LegacyTextGeometry {
  const safeKeylineIndex = Math.max(1, Math.min(grid.columnCount, Math.round(field.keylineIndex)));
  const maxAvailableSpan = Math.max(1, grid.columnCount - safeKeylineIndex + 1);
  const safeColumnSpan = Math.max(1, Math.min(maxAvailableSpan, Math.round(field.columnSpan)));
  const safeRowIndex = Math.max(1, Math.min(grid.rowCount, Math.round(field.rowIndex)));
  const safeOffsetBaselines = Math.round(field.offsetBaselines);
  const maxWidthPx = getColumnSpanWidthPx(grid, safeKeylineIndex, safeColumnSpan);
  const measured = measureWrappedLines(wrappedLines, style, measurer);
  const rowTopPx = grid.contentTopPx + (safeRowIndex - 1) * (grid.rowHeightPx + grid.rowGutterPx);
  const anchorXPx = getKeylineXPx(grid, safeKeylineIndex);
  const anchorBaselineYPx = rowTopPx + safeOffsetBaselines * grid.baselineStepPx;
  const textHeightPx = measured.ascentPx + measured.descentPx + Math.max(0, wrappedLines.length - 1) * style.lineHeightPx;
  const bounds: LayoutBounds = {
    left: anchorXPx,
    top: anchorBaselineYPx - measured.ascentPx,
    width: Math.max(24, Math.min(maxWidthPx, measured.widthPx || maxWidthPx)),
    height: Math.max(style.lineHeightPx, textHeightPx),
    right: anchorXPx + Math.max(24, Math.min(maxWidthPx, measured.widthPx || maxWidthPx)),
    bottom: anchorBaselineYPx - measured.ascentPx + Math.max(style.lineHeightPx, textHeightPx)
  };

  return {
    anchorXPx,
    anchorBaselineYPx,
    bounds
  };
}

function computeLegacyLogoBounds(
  logo: LogoPlacementSpec,
  frame: { widthPx: number; heightPx: number },
  safeArea: { top: number; right: number; bottom: number; left: number },
  fitWithinSafeArea: boolean
): LayoutBounds {
  const originLeftPx = fitWithinSafeArea ? safeArea.left : 0;
  const originTopPx = fitWithinSafeArea ? safeArea.top : 0;
  const left = originLeftPx + logo.xPx;
  const top = originTopPx + logo.yPx;

  return {
    left,
    top,
    width: logo.widthPx,
    height: logo.heightPx,
    right: left + logo.widthPx,
    bottom: top + logo.heightPx
  };
}

const input = {
  frame: {
    widthPx: 1080,
    heightPx: 1350
  },
  safeArea: {
    top: 48,
    right: 48,
    bottom: 48,
    left: 48
  },
  grid: {
    baselineStepPx: 8,
    rowCount: 12,
    columnCount: 6,
    marginTopBaselines: 6,
    marginBottomBaselines: 6,
    marginLeftBaselines: 5,
    marginRightBaselines: 5,
    rowGutterBaselines: 2,
    columnGutterBaselines: 2,
    fitWithinSafeArea: true
  },
  textStyles: [
    {
      key: "eyebrow",
      fontSizePx: 28,
      lineHeightPx: 32,
      fontWeight: 600
    },
    {
      key: "headline",
      fontSizePx: 58,
      lineHeightPx: 64,
      fontWeight: 700
    }
  ],
  textFields: [
    {
      id: "eyebrow",
      styleKey: "eyebrow",
      text: "Ubuntu Summit 2026",
      keylineIndex: 1,
      rowIndex: 2,
      offsetBaselines: 1,
      columnSpan: 2
    },
    {
      id: "headline",
      styleKey: "headline",
      text: "Deterministic branded layout",
      keylineIndex: 2,
      rowIndex: 4,
      offsetBaselines: 0,
      columnSpan: 4
    }
  ],
  logo: {
    id: "brand-mark",
    xPx: 16,
    yPx: 20,
    widthPx: 148,
    heightPx: 44
  }
} satisfies {
  frame: { widthPx: number; heightPx: number };
  safeArea: { top: number; right: number; bottom: number; left: number };
  grid: {
    baselineStepPx: number;
    rowCount: number;
    columnCount: number;
    marginTopBaselines: number;
    marginBottomBaselines: number;
    marginLeftBaselines: number;
    marginRightBaselines: number;
    rowGutterBaselines: number;
    columnGutterBaselines: number;
    fitWithinSafeArea: boolean;
  };
  textStyles: TextStyleSpec[];
  textFields: TextFieldPlacementSpec[];
  logo: LogoPlacementSpec;
};

const deterministicMeasurements: Record<string, TextMeasureResult> = {
  "Ubuntu": { widthPx: 96, ascentPx: 20, descentPx: 6 },
  "Summit": { widthPx: 94, ascentPx: 20, descentPx: 6 },
  "2026": { widthPx: 58, ascentPx: 20, descentPx: 6 },
  "Ubuntu Summit": { widthPx: 178, ascentPx: 20, descentPx: 6 },
  "Summit 2026": { widthPx: 160, ascentPx: 20, descentPx: 6 },
  "Ubuntu Summit 2026": { widthPx: 244, ascentPx: 20, descentPx: 6 },
  "Deterministic": { widthPx: 304, ascentPx: 45, descentPx: 11 },
  "branded": { widthPx: 186, ascentPx: 45, descentPx: 11 },
  "layout": { widthPx: 154, ascentPx: 45, descentPx: 11 },
  "Deterministic branded": { widthPx: 470, ascentPx: 45, descentPx: 11 },
  "branded layout": { widthPx: 350, ascentPx: 45, descentPx: 11 },
  "Deterministic branded layout": { widthPx: 640, ascentPx: 45, descentPx: 11 }
};

const measurer = createDeterministicMeasurer(deterministicMeasurements);
const scene = resolveLayerScene(input, measurer);
const grid = computeLayoutGridMetrics(input.frame, input.safeArea, input.grid);

for (const field of input.textFields) {
  const style = input.textStyles.find((candidate) => candidate.key === field.styleKey);
  const placement = scene.texts.find((candidate): candidate is ResolvedTextPlacement => candidate.id === field.id);
  if (!style || !placement) {
    throw new Error(`Missing placement for ${field.id}`);
  }

  const expected = computeLegacyTextGeometry(
    field,
    style,
    grid,
    placement.wrappedLines,
    measurer
  );

  assertNear(placement.anchorXPx, expected.anchorXPx, `${field.id}.anchorXPx`);
  assertNear(placement.anchorBaselineYPx, expected.anchorBaselineYPx, `${field.id}.anchorBaselineYPx`);
  assertBoundsNear(placement.bounds, expected.bounds, `${field.id}.bounds`);
}

if (!scene.logo) {
  throw new Error("Expected scene.logo to be resolved.");
}

const expectedLogoBounds = computeLegacyLogoBounds(
  input.logo,
  input.frame,
  input.safeArea,
  input.grid.fitWithinSafeArea
);
assertBoundsNear(scene.logo.bounds, expectedLogoBounds, "logo.bounds");

console.log("export geometry parity passed");