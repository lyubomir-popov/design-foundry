// @design-foundry/render-svg
//
// SVG renderer adapter for render-ir. Consumes a DisplayList and produces
// a self-contained SVG document string. This is the first render backend
// and serves as the validation harness for the render-ir type design (K2).

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
} from "@design-foundry/render-ir";

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

/**
 * Map our row-major Mat3 to SVG's `matrix(a,b,c,d,e,f)`.
 *
 * Mat3 layout (row-major):
 * ```
 * [0] scaleX  [1] skewX   [2] tx
 * [3] skewY   [4] scaleY  [5] ty
 * [6] 0       [7] 0       [8] 1
 * ```
 *
 * SVG matrix(a,b,c,d,e,f) = matrix(scaleX, skewY, skewX, scaleY, tx, ty)
 */
function fmtTransform(m: Mat3): string {
  return `matrix(${m[0]},${m[3]},${m[1]},${m[4]},${m[2]},${m[5]})`;
}

function fmtPathCommands(cmds: PathCommands): string {
  const parts: string[] = [];
  for (const cmd of cmds) {
    switch (cmd.kind) {
      case "M": parts.push(`M${cmd.x} ${cmd.y}`); break;
      case "L": parts.push(`L${cmd.x} ${cmd.y}`); break;
      case "C": parts.push(`C${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y}`); break;
      case "Q": parts.push(`Q${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y}`); break;
      case "A": parts.push(`A${cmd.rx} ${cmd.ry} ${cmd.rotation} ${cmd.largeArc ? 1 : 0} ${cmd.sweep ? 1 : 0} ${cmd.x} ${cmd.y}`); break;
      case "Z": parts.push("Z"); break;
    }
  }
  return parts.join(" ");
}

function fmtImageFit(fit: ImageFit): string {
  switch (fit) {
    case "contain": return "xMidYMid meet";
    case "cover": return "xMidYMid slice";
    case "fill": return "none";
    case "none": return "xMidYMid";
  }
}

// ---------------------------------------------------------------------------
// Attribute builders
// ---------------------------------------------------------------------------

function baseAttrs(item: DisplayListItem): string {
  let a = "";
  if (item.id !== undefined) a += ` id="${escapeXml(item.id)}"`;
  if (item.transform !== undefined) a += ` transform="${fmtTransform(item.transform)}"`;
  if (item.opacity !== undefined) a += ` opacity="${item.opacity}"`;
  return a;
}

function fillAttr(paint: Paint | undefined): string {
  if (paint === undefined) return ` fill="none"`;
  return ` fill="${fmtColor(paint.color)}"`;
}

function strokeAttrs(paint: Paint | undefined, style: Stroke | undefined): string {
  if (paint === undefined) return "";
  let a = ` stroke="${fmtColor(paint.color)}"`;
  if (style !== undefined) {
    a += ` stroke-width="${style.width}"`;
    if (style.cap !== undefined) a += ` stroke-linecap="${style.cap}"`;
    if (style.join !== undefined) a += ` stroke-linejoin="${style.join}"`;
    if (style.miterLimit !== undefined) a += ` stroke-miterlimit="${style.miterLimit}"`;
    if (style.dashArray !== undefined && style.dashArray.length > 0)
      a += ` stroke-dasharray="${style.dashArray.join(" ")}"`;
    if (style.dashOffset !== undefined) a += ` stroke-dashoffset="${style.dashOffset}"`;
  }
  return a;
}

// ---------------------------------------------------------------------------
// Per-item renderers
// ---------------------------------------------------------------------------

function renderRect(r: RectItem): string {
  if (r.cornerRadii !== undefined) {
    const [tl, tr, br, bl] = r.cornerRadii;
    const uniform = tl === tr && tr === br && br === bl;
    if (!uniform) {
      // Non-uniform corner radii — emit as <path> with arc commands.
      const { x, y, width: w, height: h } = r;
      const d: string[] = [];
      d.push(`M${x + tl} ${y}`);
      d.push(`L${x + w - tr} ${y}`);
      if (tr > 0) d.push(`A${tr} ${tr} 0 0 1 ${x + w} ${y + tr}`);
      d.push(`L${x + w} ${y + h - br}`);
      if (br > 0) d.push(`A${br} ${br} 0 0 1 ${x + w - br} ${y + h}`);
      d.push(`L${x + bl} ${y + h}`);
      if (bl > 0) d.push(`A${bl} ${bl} 0 0 1 ${x} ${y + h - bl}`);
      d.push(`L${x} ${y + tl}`);
      if (tl > 0) d.push(`A${tl} ${tl} 0 0 1 ${x + tl} ${y}`);
      d.push("Z");
      return `<path${baseAttrs(r)} d="${d.join(" ")}"${fillAttr(r.fill)}${strokeAttrs(r.stroke, r.strokeStyle)}/>`;
    }
    // Uniform radii — fall through to <rect> with rx/ry.
    let el = `<rect${baseAttrs(r)} x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}"`;
    if (tl > 0) el += ` rx="${tl}" ry="${tl}"`;
    el += `${fillAttr(r.fill)}${strokeAttrs(r.stroke, r.strokeStyle)}/>`;
    return el;
  }
  return `<rect${baseAttrs(r)} x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}"${fillAttr(r.fill)}${strokeAttrs(r.stroke, r.strokeStyle)}/>`;
}

function renderEllipse(e: EllipseItem): string {
  return `<ellipse${baseAttrs(e)} cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}"${fillAttr(e.fill)}${strokeAttrs(e.stroke, e.strokeStyle)}/>`;
}

function renderLine(l: LineItem): string {
  return `<line${baseAttrs(l)} x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}"${strokeAttrs(l.stroke, l.strokeStyle)}/>`;
}

function renderPath(p: PathItem): string {
  let el = `<path${baseAttrs(p)} d="${fmtPathCommands(p.commands)}"${fillAttr(p.fill)}${strokeAttrs(p.stroke, p.strokeStyle)}`;
  if (p.fillRule !== undefined) el += ` fill-rule="${p.fillRule}"`;
  el += "/>";
  return el;
}

function renderGlyphRun(g: GlyphRunItem): string {
  // Fallback: render using the original text string carried in the run.
  // ShapedRun carries glyph IDs and advances from text-shape (K3), but
  // per-glyph path outline rendering requires a font-outline extraction
  // step not yet built. Until then, use the text string as fallback.
  const { run } = g;
  const family = run.fontFamily !== undefined ? ` font-family="${escapeXml(run.fontFamily)}"` : "";
  const weight = run.fontWeight !== undefined ? ` font-weight="${run.fontWeight}"` : "";
  return `<text${baseAttrs(g)} x="${g.x}" y="${g.y}" font-size="${run.fontSize}"${family}${weight}${fillAttr(g.fill)}>${escapeXml(run.text)}</text>`;
}

function renderImage(i: ImageItem): string {
  let el = `<image${baseAttrs(i)} href="${escapeXml(i.assetRef.uri)}" x="${i.x}" y="${i.y}" width="${i.width}" height="${i.height}"`;
  if (i.fit !== undefined) el += ` preserveAspectRatio="${fmtImageFit(i.fit)}"`;
  el += "/>";
  return el;
}

function renderGroup(g: GroupItem, allocClipId: () => number): string {
  let open = `<g${baseAttrs(g)}`;
  let clipDef = "";

  if (g.clip !== undefined) {
    const clipId = `df-clip-${allocClipId()}`;
    clipDef = `<defs><clipPath id="${clipId}"><path d="${fmtPathCommands(g.clip)}"/></clipPath></defs>`;
    open += ` clip-path="url(#${clipId})"`;
  }

  const children = g.children.map((c) => renderItem(c, allocClipId)).join("\n");
  return `${open}>\n${clipDef}${children}\n</g>`;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

function renderItem(item: DisplayListItem, allocClipId: () => number): string {
  switch (item.kind) {
    case "rect":      return renderRect(item);
    case "ellipse":   return renderEllipse(item);
    case "line":      return renderLine(item);
    case "path":      return renderPath(item);
    case "glyph-run": return renderGlyphRun(item);
    case "image":     return renderImage(item);
    case "group":     return renderGroup(item, allocClipId);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * SVG renderer — consumes a `DisplayList` and produces a self-contained
 * SVG document string with `xmlns`, `width`, `height`, and `viewBox`.
 */
export class SvgRenderer implements Renderer<string> {
  render(displayList: DisplayList): string {
    let nextClip = 0;
    const allocClipId = (): number => nextClip++;

    const { viewport, items } = displayList;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewport.width}" height="${viewport.height}" viewBox="0 0 ${viewport.width} ${viewport.height}">`;

    if (viewport.background !== undefined) {
      svg += `\n<rect width="${viewport.width}" height="${viewport.height}" fill="${fmtColor(viewport.background)}"/>`;
    }

    for (const item of items) {
      svg += "\n" + renderItem(item, allocClipId);
    }

    svg += "\n</svg>";
    return svg;
  }
}
