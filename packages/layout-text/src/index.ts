import type { LayoutBounds, LayoutGridMetrics, ResolvedTextPlacement, TextFieldPlacementSpec, TextMeasureResult, TextMeasurer, TextStyleSpec } from "@design-foundry/core-types";
import { getColumnSpanWidthPx, getKeylineXPx } from "@design-foundry/layout-grid";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface ApproximateTextMeasureOptions {
  averageGlyphWidthRatio?: number;
  uppercaseWidthRatio?: number;
  digitWidthRatio?: number;
  narrowGlyphWidthRatio?: number;
  wideGlyphWidthRatio?: number;
  whitespaceWidthRatio?: number;
  punctuationWidthRatio?: number;
  ascentRatio?: number;
  descentRatio?: number;
}

const DEFAULT_APPROXIMATE_TEXT_MEASURE_OPTIONS: Required<ApproximateTextMeasureOptions> = {
  averageGlyphWidthRatio: 0.56,
  uppercaseWidthRatio: 0.62,
  digitWidthRatio: 0.56,
  narrowGlyphWidthRatio: 0.38,
  wideGlyphWidthRatio: 0.72,
  whitespaceWidthRatio: 0.33,
  punctuationWidthRatio: 0.28,
  ascentRatio: 0.78,
  descentRatio: 0.22
};

function getCharacterWidthRatio(character: string, options: Required<ApproximateTextMeasureOptions>): number {
  if (/\s/.test(character)) {
    return options.whitespaceWidthRatio;
  }

  if (/[.,;:!'"`\-_|()[\]{}]/.test(character)) {
    return options.punctuationWidthRatio;
  }

  if (/[ilIjtfr]/.test(character)) {
    return options.narrowGlyphWidthRatio;
  }

  if (/[MW@#%&]/.test(character)) {
    return options.wideGlyphWidthRatio;
  }

  if (/[A-Z]/.test(character)) {
    return options.uppercaseWidthRatio;
  }

  if (/[0-9]/.test(character)) {
    return options.digitWidthRatio;
  }

  return options.averageGlyphWidthRatio;
}

export function createApproximateTextMeasurer(options: ApproximateTextMeasureOptions = {}): TextMeasurer {
  const resolvedOptions: Required<ApproximateTextMeasureOptions> = {
    ...DEFAULT_APPROXIMATE_TEXT_MEASURE_OPTIONS,
    ...options
  };

  return {
    measureLine(text: string, style: TextStyleSpec): TextMeasureResult {
      const fontSizePx = Math.max(1, style.fontSizePx);
      const widthPx = Array.from(String(text || "")).reduce(
        (sum, character) => sum + getCharacterWidthRatio(character, resolvedOptions) * fontSizePx,
        0
      );

      return {
        widthPx,
        ascentPx: fontSizePx * resolvedOptions.ascentRatio,
        descentPx: fontSizePx * resolvedOptions.descentRatio
      };
    }
  };
}

export function wrapTextLines(text: string, maxWidthPx: number, style: TextStyleSpec, measurer: TextMeasurer): string[] {
  const safeText = String(text || "").trim();
  if (!safeText) {
    return [];
  }

  const paragraphs = safeText.split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }

    let currentLine = words[0];
    for (let index = 1; index < words.length; index += 1) {
      const nextLine = `${currentLine} ${words[index]}`;
      if (maxWidthPx > 0 && measurer.measureLine(nextLine, style).widthPx > maxWidthPx) {
        lines.push(currentLine);
        currentLine = words[index];
      } else {
        currentLine = nextLine;
      }
    }
    lines.push(currentLine);
  }

  return lines;
}

export function measureTextBlock(lines: string[], style: TextStyleSpec, measurer: TextMeasurer): TextMeasureResult {
  const fallbackFontSizePx = Math.max(1, style.fontSizePx);
  let widthPx = 0;
  let ascentPx = 0;
  let descentPx = 0;
  for (const line of lines) {
    const measured = measurer.measureLine(line || " ", style);
    widthPx = Math.max(widthPx, measured.widthPx);
    ascentPx = Math.max(ascentPx, measured.ascentPx || fallbackFontSizePx * 0.8);
    descentPx = Math.max(descentPx, measured.descentPx || fallbackFontSizePx * 0.2);
  }
  return { widthPx, ascentPx, descentPx };
}

export function getMinimumFirstBaselineInsetPx(style: TextStyleSpec, measurer: TextMeasurer): number {
  const measured = measurer.measureLine("H", style);
  return Math.max(0, measured.ascentPx || style.fontSizePx * 0.8);
}

export function resolveTextPlacement(metrics: LayoutGridMetrics, field: TextFieldPlacementSpec, style: TextStyleSpec, measurer: TextMeasurer): ResolvedTextPlacement | null {
  const safeText = String(field.text || "").trim();
  if (!safeText) {
    return null;
  }

  const safeKeylineIndex = clamp(Math.round(field.keylineIndex), 1, Math.max(1, metrics.columnCount));
  const maxAvailableSpan = Math.max(1, metrics.columnCount - safeKeylineIndex + 1);
  const safeColumnSpan = clamp(Math.round(field.columnSpan), 1, maxAvailableSpan);
  const safeRowIndex = clamp(Math.round(field.rowIndex), 1, Math.max(1, metrics.rowCount));
  const safeOffsetBaselines = Math.round(field.offsetBaselines);
  const maxWidthPx = Math.round(getColumnSpanWidthPx(metrics, safeKeylineIndex, safeColumnSpan));
  const wrappedLines = wrapTextLines(safeText, maxWidthPx, style, measurer);
  if (!wrappedLines.length) {
    return null;
  }

  const measured = measureTextBlock(wrappedLines, style, measurer);
  const rowTopPx = metrics.contentTopPx + (safeRowIndex - 1) * (metrics.rowHeightPx + metrics.rowGutterPx);
  const anchorXPx = getKeylineXPx(metrics, safeKeylineIndex);
  const anchorBaselineYPx = Math.round(rowTopPx + safeOffsetBaselines * metrics.baselineStepPx);
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
    id: field.id,
    styleKey: field.styleKey,
    text: safeText,
    wrappedLines,
    lineHeightPx: style.lineHeightPx,
    keylineIndex: safeKeylineIndex,
    rowIndex: safeRowIndex,
    offsetBaselines: safeOffsetBaselines,
    columnSpan: safeColumnSpan,
    anchorXPx,
    anchorBaselineYPx,
    maxWidthPx,
    bounds
  };
}