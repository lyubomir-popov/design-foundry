// @design-foundry/render-pdf
//
// PDF renderer adapter for render-ir using pdf-lib.
// Produces sRGB vector PDF output (CMYK deferred per PIVOT.md).
//
// Design: stateless — each render() creates a fresh PDFDocument.
// Coordinate system: render-ir uses top-left origin; PDF uses
// bottom-left. The renderer flips Y per item.

import {
  PDFDocument,
  rgb,
  LineCapStyle,
  LineJoinStyle,
  StandardFonts,
} from "pdf-lib";

import type {
  Color,
  Mat3,
  Paint,
  Stroke,
  PathCommands,
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
} from "@design-foundry/render-ir";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toRgb(c: Color) {
  return rgb(c.r, c.g, c.b);
}

/** Convert render-ir line cap to pdf-lib enum. */
function toCap(cap: string | undefined): LineCapStyle {
  switch (cap) {
    case "round":  return LineCapStyle.Round;
    case "square": return LineCapStyle.Projecting;
    default:       return LineCapStyle.Butt;
  }
}

/** Convert render-ir line join to pdf-lib enum. */
function toJoin(join: string | undefined): LineJoinStyle {
  switch (join) {
    case "round": return LineJoinStyle.Round;
    case "bevel": return LineJoinStyle.Bevel;
    default:      return LineJoinStyle.Miter;
  }
}

/**
 * Convert PathCommands to an SVG path data string.
 * pdf-lib's drawSvgPath() parses this and handles the Y-flip internally.
 */
function pathCommandsToSvgString(cmds: PathCommands): string {
  const parts: string[] = [];
  for (const cmd of cmds) {
    switch (cmd.kind) {
      case "M": parts.push(`M ${cmd.x} ${cmd.y}`); break;
      case "L": parts.push(`L ${cmd.x} ${cmd.y}`); break;
      case "C": parts.push(`C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y}`); break;
      case "Q": parts.push(`Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y}`); break;
      case "A": parts.push(`A ${cmd.rx} ${cmd.ry} ${cmd.rotation} ${cmd.largeArc ? 1 : 0} ${cmd.sweep ? 1 : 0} ${cmd.x} ${cmd.y}`); break;
      case "Z": parts.push("Z"); break;
    }
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Item renderers
// ---------------------------------------------------------------------------

import type { PDFPage } from "pdf-lib";

/**
 * Page height is needed to flip Y coordinates from top-left to bottom-left.
 */
function flipY(y: number, pageH: number): number {
  return pageH - y;
}

function renderRect(page: PDFPage, r: RectItem, pageH: number, opacity: number): void {
  const pdfY = flipY(r.y + r.height, pageH);

  // pdf-lib drawRectangle doesn't support non-uniform corner radii;
  // for rounded rects, fall back to drawSvgPath.
  if (r.cornerRadii !== undefined && r.cornerRadii.some((v) => v > 0)) {
    // Build an SVG path for the rounded rectangle
    const [tl, tr, br, bl] = r.cornerRadii;
    const x = r.x, y_top = r.y, w = r.width, h = r.height;
    const path = [
      `M ${x + tl} ${y_top}`,
      `L ${x + w - tr} ${y_top}`,
      tr > 0 ? `A ${tr} ${tr} 0 0 1 ${x + w} ${y_top + tr}` : "",
      `L ${x + w} ${y_top + h - br}`,
      br > 0 ? `A ${br} ${br} 0 0 1 ${x + w - br} ${y_top + h}` : "",
      `L ${x + bl} ${y_top + h}`,
      bl > 0 ? `A ${bl} ${bl} 0 0 1 ${x} ${y_top + h - bl}` : "",
      `L ${x} ${y_top + tl}`,
      tl > 0 ? `A ${tl} ${tl} 0 0 1 ${x + tl} ${y_top}` : "",
      "Z",
    ].filter(Boolean).join(" ");

    page.drawSvgPath(path, {
      x: 0,
      y: pageH,
      ...r.fill !== undefined ? { color: toRgb(r.fill.color), opacity: r.fill.color.a * opacity } : {},
      ...r.stroke !== undefined ? { borderColor: toRgb(r.stroke.color), borderOpacity: r.stroke.color.a * opacity } : {},
      borderWidth: r.strokeStyle?.width ?? (r.stroke !== undefined ? 1 : 0),
      ...r.strokeStyle !== undefined ? { borderLineCap: toCap(r.strokeStyle.cap) } : {},
    });
    return;
  }

  page.drawRectangle({
    x: r.x,
    y: pdfY,
    width: r.width,
    height: r.height,
    ...r.fill !== undefined ? { color: toRgb(r.fill.color), opacity: r.fill.color.a * opacity } : {},
    ...r.stroke !== undefined ? { borderColor: toRgb(r.stroke.color), borderOpacity: r.stroke.color.a * opacity } : {},
    borderWidth: r.strokeStyle?.width ?? (r.stroke !== undefined ? 1 : 0),
    ...r.strokeStyle?.dashArray !== undefined ? { borderDashArray: r.strokeStyle.dashArray as number[] } : {},
    ...r.strokeStyle?.dashOffset !== undefined ? { borderDashPhase: r.strokeStyle.dashOffset } : {},
    ...r.strokeStyle !== undefined ? { borderLineCap: toCap(r.strokeStyle.cap) } : {},
  });
}

function renderEllipse(page: PDFPage, e: EllipseItem, pageH: number, opacity: number): void {
  page.drawEllipse({
    x: e.cx,
    y: flipY(e.cy, pageH),
    xScale: e.rx,
    yScale: e.ry,
    ...e.fill !== undefined ? { color: toRgb(e.fill.color), opacity: e.fill.color.a * opacity } : {},
    ...e.stroke !== undefined ? { borderColor: toRgb(e.stroke.color), borderOpacity: e.stroke.color.a * opacity } : {},
    borderWidth: e.strokeStyle?.width ?? (e.stroke !== undefined ? 1 : 0),
    ...e.strokeStyle?.dashArray !== undefined ? { borderDashArray: e.strokeStyle.dashArray as number[] } : {},
    ...e.strokeStyle?.dashOffset !== undefined ? { borderDashPhase: e.strokeStyle.dashOffset } : {},
    ...e.strokeStyle !== undefined ? { borderLineCap: toCap(e.strokeStyle.cap) } : {},
  });
}

function renderLine(page: PDFPage, l: LineItem, pageH: number, opacity: number): void {
  page.drawLine({
    start: { x: l.x1, y: flipY(l.y1, pageH) },
    end: { x: l.x2, y: flipY(l.y2, pageH) },
    color: toRgb(l.stroke.color),
    thickness: l.strokeStyle?.width ?? 1,
    opacity: l.stroke.color.a * opacity,
    ...l.strokeStyle?.dashArray !== undefined ? { dashArray: l.strokeStyle.dashArray as number[] } : {},
    ...l.strokeStyle?.dashOffset !== undefined ? { dashPhase: l.strokeStyle.dashOffset } : {},
    ...l.strokeStyle !== undefined ? { lineCap: toCap(l.strokeStyle.cap) } : {},
  });
}

function renderPath(page: PDFPage, p: PathItem, pageH: number, opacity: number): void {
  const svgPath = pathCommandsToSvgString(p.commands);
  if (svgPath.length === 0) return;

  page.drawSvgPath(svgPath, {
    x: 0,
    y: pageH, // pdf-lib uses this as the origin for the SVG path
    ...p.fill !== undefined ? { color: toRgb(p.fill.color), opacity: p.fill.color.a * opacity } : {},
    ...p.stroke !== undefined ? { borderColor: toRgb(p.stroke.color), borderOpacity: p.stroke.color.a * opacity } : {},
    borderWidth: p.strokeStyle?.width ?? (p.stroke !== undefined ? 1 : 0),
    ...p.strokeStyle !== undefined ? { borderLineCap: toCap(p.strokeStyle.cap) } : {},
    ...p.strokeStyle?.dashArray !== undefined ? { borderDashArray: p.strokeStyle.dashArray as number[] } : {},
    ...p.strokeStyle?.dashOffset !== undefined ? { borderDashPhase: p.strokeStyle.dashOffset } : {},
  });
}

async function renderGlyphRun(
  page: PDFPage,
  g: GlyphRunItem,
  pageH: number,
  opacity: number,
  fontCache: Map<string, Awaited<ReturnType<PDFDocument["embedFont"]>>>,
  doc: PDFDocument,
): Promise<void> {
  // Fallback: render using the original text string with a standard font.
  // ShapedRun carries glyph IDs and advances from text-shape (K3), but
  // per-glyph outline rendering needs font embedding + glyph extraction
  // not yet built. Until then, use Helvetica fallback.
  let font = fontCache.get("Helvetica");
  if (font === undefined) {
    font = await doc.embedFont(StandardFonts.Helvetica);
    fontCache.set("Helvetica", font);
  }

  page.drawText(g.run.text, {
    x: g.x,
    y: flipY(g.y, pageH),
    font,
    size: g.run.fontSize,
    ...g.fill !== undefined ? { color: toRgb(g.fill.color) } : {},
    opacity: g.fill !== undefined ? g.fill.color.a * opacity : opacity,
  });
}

async function renderGroup(
  page: PDFPage,
  g: GroupItem,
  pageH: number,
  opacity: number,
  fontCache: Map<string, Awaited<ReturnType<PDFDocument["embedFont"]>>>,
  doc: PDFDocument,
): Promise<void> {
  // Groups are complex in pdf-lib — transforms, clips, and child rendering
  // all need to work together. For K7, we render children with inherited opacity.
  // Full transform + clip support would require the low-level operator API.
  const childOpacity = g.opacity !== undefined ? opacity * g.opacity : opacity;

  for (const child of g.children) {
    await renderItem(page, child, pageH, childOpacity, fontCache, doc);
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

async function renderItem(
  page: PDFPage,
  item: DisplayListItem,
  pageH: number,
  opacity: number,
  fontCache: Map<string, Awaited<ReturnType<PDFDocument["embedFont"]>>>,
  doc: PDFDocument,
): Promise<void> {
  const itemOpacity = item.opacity !== undefined ? opacity * item.opacity : opacity;

  switch (item.kind) {
    case "rect":      renderRect(page, item, pageH, itemOpacity); break;
    case "ellipse":   renderEllipse(page, item, pageH, itemOpacity); break;
    case "line":      renderLine(page, item, pageH, itemOpacity); break;
    case "path":      renderPath(page, item, pageH, itemOpacity); break;
    case "glyph-run": await renderGlyphRun(page, item, pageH, itemOpacity, fontCache, doc); break;
    case "image":     /* images require pre-embedding — deferred to K8+ */ break;
    case "group":     await renderGroup(page, item, pageH, itemOpacity, fontCache, doc); break;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * PDF renderer — consumes a `DisplayList` and produces PDF bytes.
 *
 * sRGB color space only. CMYK is a future extension (see PIVOT.md).
 *
 * The renderer uses pdf-lib to create a single-page vector PDF.
 * Each render() call creates a fresh PDFDocument (stateless).
 *
 * Implements `Renderer<Promise<Uint8Array>>` — the promise resolves
 * to the PDF file bytes.
 */
export class PdfRenderer implements Renderer<Promise<Uint8Array>> {
  async render(displayList: DisplayList): Promise<Uint8Array> {
    const { viewport, items } = displayList;
    const doc = await PDFDocument.create();
    const page = doc.addPage([viewport.width, viewport.height]);
    const pageH = viewport.height;
    const fontCache = new Map<string, Awaited<ReturnType<PDFDocument["embedFont"]>>>();

    // Background
    if (viewport.background !== undefined) {
      page.drawRectangle({
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
        color: toRgb(viewport.background),
        opacity: viewport.background.a,
      });
    }

    // Draw items
    for (const item of items) {
      await renderItem(page, item, pageH, 1, fontCache, doc);
    }

    return doc.save();
  }
}
