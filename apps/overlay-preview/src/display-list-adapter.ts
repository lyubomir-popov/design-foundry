/**
 * display-list-adapter.ts — Bridges operator outputs to render-ir DisplayList.
 *
 * First K9 slice: converts PointField-based scene families (phyllotaxis,
 * scatter, boids) into DisplayList items. This is the adapter layer
 * described in PIVOT.md §7 step 3.
 *
 * The adapter lives in overlay-preview for now. If other consumers need
 * it, promote to a shared package.
 */

import type { ColorRgba, LayoutGridMetrics, LogoPlacement, PointField, PointRecord, ResolvedTextPlacement, TextStyleSpec, Vector3 } from "@design-foundry/core-types";
import { getColumnSpanWidthPx, getKeylineXPx } from "@design-foundry/layout-grid";
import type {
  Color,
  DisplayList,
  DisplayListItem,
  EllipseItem,
  GlyphRunItem,
  ImageItem,
  RectItem,
  LineItem,
  Viewport,
} from "@design-foundry/render-ir";

// ---------------------------------------------------------------------------
// Color conversion (core-types 0–255 RGB → render-ir 0–1)
// ---------------------------------------------------------------------------

function toIrColor(c: ColorRgba): Color {
  // core-types ColorRgba uses 0–255 for RGB, 0–1 for alpha.
  // render-ir Color uses 0–1 for all channels.
  return {
    r: c.r / 255,
    g: c.g / 255,
    b: c.b / 255,
    a: c.a ?? 1,
  };
}

// ---------------------------------------------------------------------------
// Point-field → DisplayList
// ---------------------------------------------------------------------------

/** Style resolver for a single point. */
export interface PointStyleResolver {
  /** Per-point radius in pixels. */
  radiusPx(point: PointRecord, index: number, count: number): number;
  /** Per-point opacity (0–1). */
  alpha(point: PointRecord, index: number, count: number): number;
  /** Per-point color (core-types ColorRgba, 0–255 RGB). */
  color(point: PointRecord, index: number, count: number): ColorRgba;
  /** Whether the point should be drawn at all. */
  visible?(point: PointRecord, index: number, count: number): boolean;
}

/** Default white dot at fixed radius. */
const DEFAULT_POINT_STYLE: PointStyleResolver = {
  radiusPx: () => 2,
  alpha: () => 0.96,
  color: () => ({ r: 255, g: 255, b: 255, a: 1 }),
};

export interface PointFieldDisplayListOptions {
  viewport: Viewport;
  style?: PointStyleResolver;
}

/**
 * Convert a PointField to a DisplayList of circles.
 *
 * Each point becomes an EllipseItem centered at the point's position.
 * The style resolver controls radius, color, and opacity per point.
 */
export function pointFieldToDisplayList(
  field: PointField,
  options: PointFieldDisplayListOptions,
): DisplayList {
  const style = options.style ?? DEFAULT_POINT_STYLE;
  const { points } = field;
  const count = points.length;
  const items: DisplayListItem[] = [];

  for (let i = 0; i < count; i++) {
    const point = points[i]!;
    if (style.visible !== undefined && !style.visible(point, i, count)) continue;

    const r = style.radiusPx(point, i, count);
    if (r <= 0) continue;

    const alpha = style.alpha(point, i, count);
    if (alpha <= 0) continue;

    const color = toIrColor(style.color(point, i, count));

    const item: EllipseItem = {
      kind: "ellipse",
      cx: point.position.x,
      cy: point.position.y,
      rx: r,
      ry: r,
      fill: { color },
      opacity: alpha,
    };

    items.push(item);
  }

  return { viewport: options.viewport, items };
}

// ---------------------------------------------------------------------------
// Scene-family style resolvers
// ---------------------------------------------------------------------------

/** Phyllotaxis: radius scales with radial distance from center. */
export function phyllotaxisStyleResolver(maxRadiusPx: number): PointStyleResolver {
  return {
    radiusPx(point, index, count) {
      const pointRadius = Number(point.attributes.philo_radius ?? 0);
      const normalized = maxRadiusPx <= 0
        ? (count <= 1 ? 0 : index / Math.max(1, count - 1))
        : Math.min(1, Math.max(0, pointRadius / maxRadiusPx));
      return 0.95 + normalized * 2.2;
    },
    alpha: () => 0.96,
    color: () => ({ r: 255, g: 255, b: 255, a: 1 }),
  };
}

/** Scatter: radius and alpha scale with density weight. */
export function scatterStyleResolver(): PointStyleResolver {
  return {
    radiusPx(point) {
      const densityWeight = Number(point.attributes.scatter_density_weight ?? 0.8);
      return Math.min(3.8, Math.max(1.1, 1.1 + densityWeight * 2.4));
    },
    alpha(point) {
      const densityWeight = Number(point.attributes.scatter_density_weight ?? 0.8);
      return 0.42 + densityWeight * 0.5;
    },
    color: () => ({ r: 255, g: 255, b: 255, a: 1 }),
  };
}

/** Fuzzy boids: fixed radius, visibility gated by boid_active. */
export function fuzzyBoidsStyleResolver(dotSizePx: number): PointStyleResolver {
  const r = Math.max(0.5, dotSizePx);
  return {
    radiusPx: () => r,
    alpha: () => 1,
    color(point) {
      const c = point.attributes.color as ColorRgba | undefined;
      return c ?? { r: 255, g: 255, b: 255, a: 1 };
    },
    visible(point) {
      return Boolean(point.attributes.boid_active);
    },
  };
}

// ---------------------------------------------------------------------------
// Safe-area → DisplayList
// ---------------------------------------------------------------------------

export interface SafeAreaInsets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/**
 * Convert safe-area insets to semi-transparent overlay bars.
 * Matches the existing svg-overlay-adapter behavior.
 */
export function safeAreaToDisplayList(
  viewport: Viewport,
  insets: SafeAreaInsets | null | undefined,
  backgroundColor?: Color,
): DisplayList {
  if (!insets) return { viewport, items: [] };

  const { width: w, height: h } = viewport;
  const top = insets.top ?? 0;
  const right = insets.right ?? 0;
  const bottom = insets.bottom ?? 0;
  const left = insets.left ?? 0;

  if (top <= 0 && right <= 0 && bottom <= 0 && left <= 0) {
    return { viewport, items: [] };
  }

  const bgColor = backgroundColor ?? { r: 0.125, g: 0.125, b: 0.125, a: 1 };
  const items: RectItem[] = [];

  if (top > 0) {
    items.push({
      kind: "rect", x: 0, y: 0, width: w, height: top,
      fill: { color: bgColor }, opacity: 0.85,
    });
  }
  if (bottom > 0) {
    items.push({
      kind: "rect", x: 0, y: h - bottom, width: w, height: bottom,
      fill: { color: bgColor }, opacity: 0.85,
    });
  }
  if (left > 0) {
    items.push({
      kind: "rect", x: 0, y: top, width: left, height: h - top - bottom,
      fill: { color: bgColor }, opacity: 0.85,
    });
  }
  if (right > 0) {
    items.push({
      kind: "rect", x: w - right, y: top, width: right, height: h - top - bottom,
      fill: { color: bgColor }, opacity: 0.85,
    });
  }

  return { viewport, items };
}

// ---------------------------------------------------------------------------
// Guide mode type (mirrors svg-overlay-adapter.ts)
// ---------------------------------------------------------------------------

export type GuideMode = "off" | "composition" | "baseline";

// ---------------------------------------------------------------------------
// Guide helpers — IR colors from fixed RGBA strings
// ---------------------------------------------------------------------------

const GUIDE_COLOR: Color       = { r: 1, g: 1, b: 1, a: 0.12 };
const ACCENT_COLOR: Color      = { r: 1, g: 1, b: 1, a: 0.22 };
const LABEL_COLOR: Color       = { r: 1, g: 1, b: 1, a: 0.35 };
const MARGIN_COLOR: Color      = { r: 235 / 255, g: 180 / 255, b: 65 / 255, a: 0.06 };
const COLUMN_FILL_COLOR: Color = { r: 100 / 255, g: 160 / 255, b: 255 / 255, a: 0.04 };
const BOUNDARY_COLOR: Color    = { r: 1, g: 1, b: 1, a: 0.18 };
const ROW_FILL_COLOR: Color    = { r: 1, g: 1, b: 1, a: 0.03 };
const ROW_GUTTER_COLOR: Color  = { r: 1, g: 100 / 255, b: 100 / 255, a: 0.03 };
const BASELINE_COLOR: Color    = { r: 1, g: 1, b: 1, a: 0.15 };

function labelGlyph(text: string, x: number, y: number, fontSize: number, color: Color, opacity?: number): GlyphRunItem {
  return {
    kind: "glyph-run",
    x,
    y,
    run: {
      fontRef: { kind: "font", uri: "system:monospace" },
      fontSize,
      glyphs: [],
      text,
      fontFamily: "monospace",
    },
    fill: { color },
    ...(opacity !== undefined ? { opacity } : {}),
  };
}

// ---------------------------------------------------------------------------
// Guide grid → DisplayList
// ---------------------------------------------------------------------------

export interface FrameDimensions {
  widthPx: number;
  heightPx: number;
}

/**
 * Convert layout grid metrics + guide mode to a DisplayList of guide
 * overlays. Matches the visual output of `createGuideMarkup()` in
 * svg-overlay-adapter.ts.
 */
export function guideGridToDisplayList(
  grid: LayoutGridMetrics,
  frame: FrameDimensions,
  guideMode: GuideMode,
  viewport: Viewport,
): DisplayList {
  if (guideMode === "off") return { viewport, items: [] };

  const items: DisplayListItem[] = [];
  const cW = grid.contentRightPx - grid.contentLeftPx;
  const cH = grid.contentBottomPx - grid.contentTopPx;

  // Content area boundary (dashed rect)
  if (cW > 0 && cH > 0) {
    items.push({
      kind: "rect",
      x: grid.contentLeftPx,
      y: grid.contentTopPx,
      width: cW,
      height: cH,
      stroke: { color: BOUNDARY_COLOR },
      strokeStyle: { width: 0.5, dashArray: [6, 4] },
    } satisfies RectItem);
  }

  // Margin zones
  const layoutW = grid.layoutRightPx - grid.layoutLeftPx;
  if (grid.topMarginPx > 0) {
    items.push({
      kind: "rect",
      x: grid.layoutLeftPx,
      y: grid.layoutTopPx,
      width: layoutW,
      height: grid.topMarginPx,
      fill: { color: MARGIN_COLOR },
    } satisfies RectItem);
    items.push(labelGlyph("margin-top", grid.contentLeftPx + 4, grid.layoutTopPx + grid.topMarginPx - 4, 9, LABEL_COLOR, 0.6));
  }
  if (grid.bottomMarginPx > 0) {
    items.push({
      kind: "rect",
      x: grid.layoutLeftPx,
      y: grid.contentBottomPx,
      width: layoutW,
      height: grid.bottomMarginPx,
      fill: { color: MARGIN_COLOR },
    } satisfies RectItem);
  }
  if (grid.leftMarginPx > 0) {
    items.push({
      kind: "rect",
      x: grid.layoutLeftPx,
      y: grid.contentTopPx,
      width: grid.leftMarginPx,
      height: cH,
      fill: { color: MARGIN_COLOR },
    } satisfies RectItem);
  }
  if (grid.rightMarginPx > 0) {
    items.push({
      kind: "rect",
      x: grid.contentRightPx,
      y: grid.contentTopPx,
      width: grid.rightMarginPx,
      height: cH,
      fill: { color: MARGIN_COLOR },
    } satisfies RectItem);
  }

  // Column fills and keylines
  for (let ki = 1; ki <= grid.columnCount; ki++) {
    const x = getKeylineXPx(grid, ki);
    const spanW = getColumnSpanWidthPx(grid, ki, 1);

    if (spanW > 0) {
      items.push({
        kind: "rect",
        x,
        y: grid.contentTopPx,
        width: spanW,
        height: cH,
        fill: { color: COLUMN_FILL_COLOR },
      } satisfies RectItem);
    }

    // Keyline (solid line at left edge)
    items.push({
      kind: "line",
      x1: x,
      y1: grid.contentTopPx,
      x2: x,
      y2: grid.contentBottomPx,
      stroke: { color: ACCENT_COLOR },
      strokeStyle: { width: 1 },
    } satisfies LineItem);

    // Keyline label
    items.push(labelGlyph(`K${ki}`, x + 4, grid.contentTopPx + 12, 10, LABEL_COLOR));

    // Right edge (dashed)
    const endX = x + spanW;
    if (Math.abs(endX - x) > 2) {
      items.push({
        kind: "line",
        x1: endX,
        y1: grid.contentTopPx,
        x2: endX,
        y2: grid.contentBottomPx,
        stroke: { color: GUIDE_COLOR },
        strokeStyle: { width: 0.5, dashArray: [4, 4] },
      } satisfies LineItem);
    }
  }

  // Row bands
  if (grid.rowCount > 0) {
    const rowStepPx = grid.rowHeightPx + grid.rowGutterPx;
    for (let ri = 0; ri < grid.rowCount; ri++) {
      const y = grid.contentTopPx + ri * rowStepPx;
      items.push({
        kind: "rect",
        x: grid.contentLeftPx,
        y,
        width: cW,
        height: grid.rowHeightPx,
        fill: { color: ROW_FILL_COLOR },
        stroke: { color: GUIDE_COLOR },
        strokeStyle: { width: 0.5 },
      } satisfies RectItem);

      if (ri < grid.rowCount - 1 && grid.rowGutterPx > 0) {
        items.push({
          kind: "rect",
          x: grid.contentLeftPx,
          y: y + grid.rowHeightPx,
          width: cW,
          height: grid.rowGutterPx,
          fill: { color: ROW_GUTTER_COLOR },
        } satisfies RectItem);
      }
    }
  }

  // Baseline grid
  if (guideMode === "baseline" && grid.baselineStepPx > 0) {
    for (let y = grid.contentTopPx; y < grid.contentBottomPx; y += grid.baselineStepPx) {
      items.push({
        kind: "line",
        x1: grid.contentLeftPx,
        y1: y,
        x2: grid.contentRightPx,
        y2: y,
        stroke: { color: BASELINE_COLOR },
        strokeStyle: { width: 0.5 },
      } satisfies LineItem);
    }
  }

  return { viewport, items };
}

// ---------------------------------------------------------------------------
// Text placement → DisplayList
// ---------------------------------------------------------------------------

const TEXT_FONT_FAMILY = "'Ubuntu Sans', 'Ubuntu', sans-serif";
const TEXT_COLOR: Color = { r: 1, g: 1, b: 1, a: 1 };

/**
 * Convert a ResolvedTextPlacement + style to a DisplayList.
 * Each wrapped line becomes a separate GlyphRunItem positioned
 * at the correct baseline y-coordinate.
 */
export function textPlacementToDisplayList(
  text: ResolvedTextPlacement,
  style: TextStyleSpec,
  viewport: Viewport,
): DisplayList {
  const fontWeight = style.fontWeight ?? 400;
  const items: GlyphRunItem[] = text.wrappedLines.map((line, i) => ({
    kind: "glyph-run" as const,
    x: text.anchorXPx,
    y: text.anchorBaselineYPx + i * style.lineHeightPx,
    run: {
      fontRef: { kind: "font" as const, uri: "system:ubuntu-sans" },
      fontSize: style.fontSizePx,
      glyphs: [],
      text: line,
      fontFamily: TEXT_FONT_FAMILY,
      fontWeight,
    },
    fill: { color: TEXT_COLOR },
  }));

  return { viewport, items };
}

// ---------------------------------------------------------------------------
// Logo placement → DisplayList
// ---------------------------------------------------------------------------

/**
 * Convert a LogoPlacement to a DisplayList containing a single ImageItem.
 */
export function logoPlacementToDisplayList(
  logo: LogoPlacement | null | undefined,
  viewport: Viewport,
): DisplayList {
  if (!logo) return { viewport, items: [] };

  const item: ImageItem = {
    kind: "image",
    assetRef: { kind: "image", uri: logo.assetPath ?? "" },
    x: logo.bounds.left,
    y: logo.bounds.top,
    width: logo.bounds.width,
    height: logo.bounds.height,
  };

  return { viewport, items: [item] };
}
