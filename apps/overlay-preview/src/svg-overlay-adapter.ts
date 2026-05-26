/**
 * SVG overlay adapter — pure markup generators for the text, logo,
 * guide, and safe-area overlay layers.
 *
 * These are adapter functions ("how do I draw this?") per architecture.md
 * and should not read app state directly.
 */

import type {
  LayoutGridMetrics,
  LogoPlacement,
  ResolvedTextPlacement,
  TextStyleSpec
} from "@design-foundry/core-types";
import { getColumnSpanWidthPx, getKeylineXPx } from "@design-foundry/layout-grid";

// ── Types ─────────────────────────────────────────────────────────────

export interface FrameDimensions {
  widthPx: number;
  heightPx: number;
}

export interface SafeAreaInsets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export type GuideMode = "off" | "composition" | "baseline";

// ── Utilities ─────────────────────────────────────────────────────────

export function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Markup generators ─────────────────────────────────────────────────

export function createSafeAreaMarkup(
  frame: FrameDimensions,
  safeArea: SafeAreaInsets | null | undefined,
  backgroundColor: string
): string {
  if (!safeArea) return "";

  const { widthPx, heightPx } = frame;
  const top = safeArea.top ?? 0;
  const right = safeArea.right ?? 0;
  const bottom = safeArea.bottom ?? 0;
  const left = safeArea.left ?? 0;

  if (top <= 0 && right <= 0 && bottom <= 0 && left <= 0) return "";

  const bgColor = backgroundColor || "#202020";
  const bars: string[] = [];

  if (top > 0) bars.push(`<rect x="0" y="0" width="${widthPx}" height="${top}" fill="${bgColor}" opacity="0.85"/>`);
  if (bottom > 0) bars.push(`<rect x="0" y="${heightPx - bottom}" width="${widthPx}" height="${bottom}" fill="${bgColor}" opacity="0.85"/>`);
  if (left > 0) bars.push(`<rect x="0" y="${top}" width="${left}" height="${heightPx - top - bottom}" fill="${bgColor}" opacity="0.85"/>`);
  if (right > 0) bars.push(`<rect x="${widthPx - right}" y="${top}" width="${right}" height="${heightPx - top - bottom}" fill="${bgColor}" opacity="0.85"/>`);

  return `<g class="safe-area-fill">${bars.join("")}</g>`;
}

export function createGuideMarkup(
  grid: LayoutGridMetrics,
  frame: FrameDimensions,
  guideMode: GuideMode
): string {
  if (guideMode === "off") return "";

  const lines: string[] = [];
  const guideColor = "rgba(255,255,255,0.12)";
  const accentColor = "rgba(255,255,255,0.22)";
  const labelColor = "rgba(255,255,255,0.35)";
  const marginColor = "rgba(235,180,65,0.06)";
  const columnFillColor = "rgba(100,160,255,0.04)";
  const boundaryColor = "rgba(255,255,255,0.18)";

  // Content area boundary
  const cW = grid.contentRightPx - grid.contentLeftPx;
  const cH = grid.contentBottomPx - grid.contentTopPx;
  if (cW > 0 && cH > 0) {
    lines.push(`<rect x="${grid.contentLeftPx}" y="${grid.contentTopPx}" width="${cW}" height="${cH}" fill="none" stroke="${boundaryColor}" stroke-width="0.5" stroke-dasharray="6 4"/>`);
  }

  // Margin zones (tinted overlays)
  if (grid.topMarginPx > 0) {
    lines.push(`<rect x="${grid.layoutLeftPx}" y="${grid.layoutTopPx}" width="${grid.layoutRightPx - grid.layoutLeftPx}" height="${grid.topMarginPx}" fill="${marginColor}"/>`);
    lines.push(`<text x="${grid.contentLeftPx + 4}" y="${grid.layoutTopPx + grid.topMarginPx - 4}" fill="${labelColor}" font-size="9" font-family="monospace" opacity="0.6">margin-top</text>`);
  }
  if (grid.bottomMarginPx > 0) {
    lines.push(`<rect x="${grid.layoutLeftPx}" y="${grid.contentBottomPx}" width="${grid.layoutRightPx - grid.layoutLeftPx}" height="${grid.bottomMarginPx}" fill="${marginColor}"/>`);
  }
  if (grid.leftMarginPx > 0) {
    lines.push(`<rect x="${grid.layoutLeftPx}" y="${grid.contentTopPx}" width="${grid.leftMarginPx}" height="${cH}" fill="${marginColor}"/>`);
  }
  if (grid.rightMarginPx > 0) {
    lines.push(`<rect x="${grid.contentRightPx}" y="${grid.contentTopPx}" width="${grid.rightMarginPx}" height="${cH}" fill="${marginColor}"/>`);
  }

  // Column fills and keylines
  for (let ki = 1; ki <= grid.columnCount; ki++) {
    const x = getKeylineXPx(grid, ki);
    const spanW = getColumnSpanWidthPx(grid, ki, 1);

    // Column fill
    if (spanW > 0) {
      lines.push(`<rect x="${x}" y="${grid.contentTopPx}" width="${spanW}" height="${cH}" fill="${columnFillColor}"/>`);
    }

    // Keyline (left edge of column)
    lines.push(`<line x1="${x}" y1="${grid.contentTopPx}" x2="${x}" y2="${grid.contentBottomPx}" stroke="${accentColor}" stroke-width="1"/>`);
    lines.push(`<text x="${x + 4}" y="${grid.contentTopPx + 12}" fill="${labelColor}" font-size="10" font-family="monospace">K${ki}</text>`);

    // Right edge of column (dashed)
    const endX = x + spanW;
    if (Math.abs(endX - x) > 2) {
      lines.push(`<line x1="${endX}" y1="${grid.contentTopPx}" x2="${endX}" y2="${grid.contentBottomPx}" stroke="${guideColor}" stroke-width="0.5" stroke-dasharray="4 4"/>`);
    }
  }

  // Row bands
  if (grid.rowCount > 0) {
    const rowStepPx = grid.rowHeightPx + grid.rowGutterPx;
    for (let ri = 0; ri < grid.rowCount; ri++) {
      const y = grid.contentTopPx + ri * rowStepPx;
      lines.push(`<rect x="${grid.contentLeftPx}" y="${y}" width="${cW}" height="${grid.rowHeightPx}" fill="rgba(255,255,255,0.03)" stroke="${guideColor}" stroke-width="0.5"/>`);
      // Row gutter
      if (ri < grid.rowCount - 1 && grid.rowGutterPx > 0) {
        const gutterY = y + grid.rowHeightPx;
        lines.push(`<rect x="${grid.contentLeftPx}" y="${gutterY}" width="${cW}" height="${grid.rowGutterPx}" fill="rgba(255,100,100,0.03)"/>`);
      }
    }
  }

  // Baseline grid
  if (guideMode === "baseline" && grid.baselineStepPx > 0) {
    for (let y = grid.contentTopPx; y < grid.contentBottomPx; y += grid.baselineStepPx) {
      lines.push(`<line x1="${grid.contentLeftPx}" y1="${y}" x2="${grid.contentRightPx}" y2="${y}" stroke="rgba(255,255,255,0.15)" stroke-width="0.5"/>`);
    }
  }

  return `<g class="guides">${lines.join("")}</g>`;
}

export function createTextMarkup(text: ResolvedTextPlacement, style: TextStyleSpec): string {
  const displayLines = text.wrappedLines;
  const fontWeight = style.fontWeight ?? 400;

  const tspans = displayLines.map((line, i) =>
    `<tspan x="${text.anchorXPx}" dy="${i === 0 ? 0 : style.lineHeightPx}">${escapeXml(line)}</tspan>`
  ).join("");

  return `<g data-field-id="${escapeXml(text.id)}">
    <text x="${text.anchorXPx}" y="${text.anchorBaselineYPx}" fill="#ffffff" font-size="${style.fontSizePx}" font-weight="${fontWeight}" font-family="'Ubuntu Sans', 'Ubuntu', sans-serif">
      ${tspans}
    </text>
  </g>`;
}

export function createLogoMarkup(logo: LogoPlacement | null | undefined): string {
  if (!logo) return "";

  const assetHref = logo.assetPath ?? "";
  return `<g data-logo-id="${escapeXml(logo.id ?? "logo")}">
    <image href="${escapeXml(assetHref)}" x="${logo.bounds.left}" y="${logo.bounds.top}" width="${logo.bounds.width}" height="${logo.bounds.height}"/>
  </g>`;
}
