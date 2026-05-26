// @design-foundry/render-canvas2d
//
// Canvas2D renderer adapter for render-ir. Consumes a DisplayList and
// draws it onto an OffscreenCanvas or HTMLCanvasElement via the 2D
// rendering context. This is the second render backend (after SVG) and
// validates that the IR can drive multiple backends (K5).
//
// Design: stateless — each render() call resets the canvas and draws
// the full display list. Incremental rendering is a future concern.

import type {
  Color,
  Mat3,
  Paint,
  Stroke,
  PathCommands,
  ImageFit,
  DisplayList,
  DisplayListItem,
  RectItem,
  EllipseItem,
  LineItem,
  PathItem,
  GlyphRunItem,
  ImageItem,
  GroupItem,
  Renderer,
  Viewport,
} from "@design-foundry/render-ir";

// ---------------------------------------------------------------------------
// Value formatters
// ---------------------------------------------------------------------------

function fmtColor(c: Color): string {
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  if (c.a >= 1) return `rgb(${r},${g},${b})`;
  return `rgba(${r},${g},${b},${c.a})`;
}

// ---------------------------------------------------------------------------
// SVG arc → Canvas2D arc conversion (SVG spec F.6)
// ---------------------------------------------------------------------------

/**
 * Convert SVG endpoint-parameterization arc to Canvas2D ellipse() calls.
 * Implements the algorithm from the SVG 1.1 spec, appendix F.6.
 */
function drawSvgArc(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x1: number, y1: number,
  rxIn: number, ryIn: number,
  rotationDeg: number,
  largeArc: boolean, sweep: boolean,
  x2: number, y2: number,
): void {
  // F.6.2 — degenerate cases
  if (x1 === x2 && y1 === y2) return;
  if (rxIn === 0 || ryIn === 0) { ctx.lineTo(x2, y2); return; }

  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  const phi = (rotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // F.6.5.1 — transform to unit-circle space
  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  // F.6.6 — ensure radii are large enough
  let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const sqrtL = Math.sqrt(lambda);
    rx *= sqrtL;
    ry *= sqrtL;
  }

  // F.6.5.2 — compute center point
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const x1p2 = x1p * x1p;
  const y1p2 = y1p * y1p;
  let sq = (rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2) / (rx2 * y1p2 + ry2 * x1p2);
  if (sq < 0) sq = 0;
  let root = Math.sqrt(sq);
  if (largeArc === sweep) root = -root;

  const cxp = root * (rx * y1p) / ry;
  const cyp = root * -(ry * x1p) / rx;

  // F.6.5.3 — transform center back
  const cxOut = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cyOut = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  // F.6.5.5/6 — compute start angle and sweep angle
  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;

  const startAngle = Math.atan2(uy, ux);
  let dTheta = Math.atan2(vy, vx) - startAngle;

  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  // Draw using Canvas2D ellipse()
  ctx.ellipse(cxOut, cyOut, rx, ry, phi, startAngle, startAngle + dTheta, !sweep);
}

// ---------------------------------------------------------------------------
// Path builder
// ---------------------------------------------------------------------------

function tracePath(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, cmds: PathCommands): void {
  ctx.beginPath();
  // Track current point for arc endpoint → center conversion.
  let cx = 0, cy = 0;
  for (const cmd of cmds) {
    switch (cmd.kind) {
      case "M": ctx.moveTo(cmd.x, cmd.y); cx = cmd.x; cy = cmd.y; break;
      case "L": ctx.lineTo(cmd.x, cmd.y); cx = cmd.x; cy = cmd.y; break;
      case "C": ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y); cx = cmd.x; cy = cmd.y; break;
      case "Q": ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y); cx = cmd.x; cy = cmd.y; break;
      case "A": {
        drawSvgArc(ctx, cx, cy, cmd.rx, cmd.ry, cmd.rotation, cmd.largeArc, cmd.sweep, cmd.x, cmd.y);
        cx = cmd.x; cy = cmd.y;
        break;
      }
      case "Z": ctx.closePath(); break;
    }
  }
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

function applyTransform(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, m: Mat3): void {
  // Canvas2D setTransform(a, b, c, d, e, f) where:
  // a = scaleX, b = skewY, c = skewX, d = scaleY, e = tx, f = ty
  // Mat3 row-major: [scaleX, skewX, tx, skewY, scaleY, ty, 0, 0, 1]
  ctx.transform(m[0], m[3], m[1], m[4], m[2], m[5]);
}

// ---------------------------------------------------------------------------
// Stroke / fill helpers
// ---------------------------------------------------------------------------

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function applyStroke(ctx: Ctx2D, paint: Paint, style: Stroke | undefined): void {
  ctx.strokeStyle = fmtColor(paint.color);
  if (style !== undefined) {
    ctx.lineWidth = style.width;
    if (style.cap !== undefined) ctx.lineCap = style.cap;
    if (style.join !== undefined) ctx.lineJoin = style.join;
    if (style.miterLimit !== undefined) ctx.miterLimit = style.miterLimit;
    if (style.dashArray !== undefined && style.dashArray.length > 0) {
      ctx.setLineDash(style.dashArray as number[]);
    } else {
      ctx.setLineDash([]);
    }
    if (style.dashOffset !== undefined) ctx.lineDashOffset = style.dashOffset;
  } else {
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
  }
}

// ---------------------------------------------------------------------------
// Item renderers
// ---------------------------------------------------------------------------

function renderRect(ctx: Ctx2D, r: RectItem): void {
  if (r.cornerRadii !== undefined) {
    const [tl, tr, br, bl] = r.cornerRadii;
    const uniform = tl === tr && tr === br && br === bl;
    if (uniform && tl > 0) {
      // Canvas2D roundRect
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.width, r.height, tl);
    } else if (!uniform) {
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.width, r.height, [tl, tr, br, bl]);
    } else {
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.width, r.height);
    }
  } else {
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.width, r.height);
  }

  if (r.fill !== undefined) {
    ctx.fillStyle = fmtColor(r.fill.color);
    ctx.fill();
  }
  if (r.stroke !== undefined) {
    applyStroke(ctx, r.stroke, r.strokeStyle);
    ctx.stroke();
  }
}

function renderEllipse(ctx: Ctx2D, e: EllipseItem): void {
  ctx.beginPath();
  ctx.ellipse(e.cx, e.cy, e.rx, e.ry, 0, 0, Math.PI * 2);

  if (e.fill !== undefined) {
    ctx.fillStyle = fmtColor(e.fill.color);
    ctx.fill();
  }
  if (e.stroke !== undefined) {
    applyStroke(ctx, e.stroke, e.strokeStyle);
    ctx.stroke();
  }
}

function renderLine(ctx: Ctx2D, l: LineItem): void {
  applyStroke(ctx, l.stroke, l.strokeStyle);
  ctx.beginPath();
  ctx.moveTo(l.x1, l.y1);
  ctx.lineTo(l.x2, l.y2);
  ctx.stroke();
}

function renderPath(ctx: Ctx2D, p: PathItem): void {
  tracePath(ctx, p.commands);

  if (p.fill !== undefined) {
    ctx.fillStyle = fmtColor(p.fill.color);
    ctx.fill(p.fillRule === "evenodd" ? "evenodd" : "nonzero");
  }
  if (p.stroke !== undefined) {
    applyStroke(ctx, p.stroke, p.strokeStyle);
    ctx.stroke();
  }
}

function renderGlyphRun(ctx: Ctx2D, g: GlyphRunItem): void {
  // Fallback: render using the original text string.
  // ShapedRun carries glyph IDs and advances from text-shape (K3), but
  // per-glyph outline rendering needs a font-outline extraction step
  // not yet built. Until then, use the text string as fallback.
  if (g.fill !== undefined) {
    ctx.fillStyle = fmtColor(g.fill.color);
  }
  const weight = g.run.fontWeight !== undefined ? `${g.run.fontWeight} ` : "";
  const family = g.run.fontFamily ?? "sans-serif";
  ctx.font = `${weight}${g.run.fontSize}px ${family}`;
  ctx.fillText(g.run.text, g.x, g.y);
}

function renderImage(ctx: Ctx2D, i: ImageItem, assets: ReadonlyMap<string, CanvasImageSource>): void {
  const source = assets.get(i.assetRef.uri);
  if (source === undefined) return; // asset not loaded — skip silently
  ctx.drawImage(source, i.x, i.y, i.width, i.height);
}

function renderGroup(ctx: Ctx2D, g: GroupItem, assets: ReadonlyMap<string, CanvasImageSource>): void {
  ctx.save();

  if (g.transform !== undefined) applyTransform(ctx, g.transform);
  if (g.opacity !== undefined) ctx.globalAlpha *= g.opacity;

  if (g.clip !== undefined) {
    tracePath(ctx, g.clip);
    ctx.clip();
  }

  for (const child of g.children) {
    renderItem(ctx, child, assets);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

function renderItem(ctx: Ctx2D, item: DisplayListItem, assets: ReadonlyMap<string, CanvasImageSource>): void {
  // Save/restore for per-item transform and opacity
  const needsWrap = item.transform !== undefined || item.opacity !== undefined;

  if (needsWrap) {
    ctx.save();
    if (item.transform !== undefined) applyTransform(ctx, item.transform);
    if (item.opacity !== undefined) ctx.globalAlpha *= item.opacity;
  }

  switch (item.kind) {
    case "rect":      renderRect(ctx, item); break;
    case "ellipse":   renderEllipse(ctx, item); break;
    case "line":      renderLine(ctx, item); break;
    case "path":      renderPath(ctx, item); break;
    case "glyph-run": renderGlyphRun(ctx, item); break;
    case "image":     renderImage(ctx, item, assets); break;
    case "group":     renderGroup(ctx, item, assets); break;
  }

  if (needsWrap) {
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Options for the Canvas2D renderer. */
export interface Canvas2DRendererOptions {
  /**
   * Pre-loaded image assets keyed by their AssetRef URI.
   * Images referenced in the display list must be provided here;
   * the renderer does not load assets on its own.
   */
  readonly assets?: ReadonlyMap<string, CanvasImageSource>;
}

/**
 * Canvas2D renderer — consumes a `DisplayList` and draws it onto
 * a CanvasRenderingContext2D or OffscreenCanvasRenderingContext2D.
 *
 * The renderer clears the canvas and draws the full display list on
 * each call. The canvas is resized to match the viewport if needed.
 *
 * Note: this implements `Renderer<void>` rather than producing a
 * return artifact — the side effect IS the canvas drawing.
 */
export class Canvas2DRenderer implements Renderer<void> {
  private readonly ctx: Ctx2D;
  private readonly assets: ReadonlyMap<string, CanvasImageSource>;

  constructor(ctx: Ctx2D, options?: Canvas2DRendererOptions) {
    this.ctx = ctx;
    this.assets = options?.assets ?? new Map();
  }

  render(displayList: DisplayList): void {
    const { viewport, items } = displayList;
    const ctx = this.ctx;
    const canvas = ctx.canvas;

    // Resize canvas to match viewport
    if (canvas.width !== viewport.width || canvas.height !== viewport.height) {
      canvas.width = viewport.width;
      canvas.height = viewport.height;
    }

    // Clear
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    // DPR scaling
    const dpr = viewport.devicePixelRatio ?? 1;
    if (dpr !== 1) {
      ctx.save();
      ctx.scale(dpr, dpr);
    }

    // Background
    if (viewport.background !== undefined) {
      ctx.fillStyle = fmtColor(viewport.background);
      ctx.fillRect(0, 0, viewport.width, viewport.height);
    }

    // Reset state
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    // Draw items
    for (const item of items) {
      renderItem(ctx, item, this.assets);
    }

    if (dpr !== 1) {
      ctx.restore();
    }
  }
}
