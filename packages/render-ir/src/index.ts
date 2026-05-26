// @design-foundry/render-ir
//
// Flat display-list intermediate representation (Skia / Flutter pattern).
// Pure types — no logic, no dependencies. Serializable, diff-able,
// snapshot-testable.
//
// Operators produce DisplayList values. Renderer adapters consume them.
// The IR is deliberately self-contained: it does not import from
// @design-foundry/core-types so that it stays a dependency-free leaf
// package usable by any consumer in or outside this workspace.

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

/**
 * RGBA color. Channels are 0–1. Alpha is required — there is no implicit
 * opaque in a display list.
 */
export interface Color {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

/**
 * 3×3 affine matrix in row-major order.
 *
 * ```
 * ┌            ┐
 * │ 0  1  2 │   scaleX  skewX   tx
 * │ 3  4  5 │ = skewY   scaleY  ty
 * │ 6  7  8 │   0       0       1
 * └            ┘
 * ```
 *
 * Identity: `[1, 0, 0,  0, 1, 0,  0, 0, 1]`
 */
export type Mat3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

// ---------------------------------------------------------------------------
// Paint & stroke
// ---------------------------------------------------------------------------

/**
 * Fill or stroke paint. Solid color only for now — the type is a named
 * struct (not a bare Color alias) so that gradient / pattern variants can
 * be added later without a breaking shape change.
 */
export interface Paint {
  readonly color: Color;
}

/** Stroke styling applied alongside a stroke Paint. */
export interface Stroke {
  readonly width: number;
  readonly cap?: 'butt' | 'round' | 'square';
  readonly join?: 'miter' | 'round' | 'bevel';
  readonly miterLimit?: number;
  readonly dashArray?: readonly number[];
  readonly dashOffset?: number;
}

// ---------------------------------------------------------------------------
// Path commands
// ---------------------------------------------------------------------------

/** SVG-style path command. Each variant is a discriminated union member. */
export type PathCommand =
  | { readonly kind: 'M'; readonly x: number; readonly y: number }
  | { readonly kind: 'L'; readonly x: number; readonly y: number }
  | {
      readonly kind: 'C';
      readonly x1: number; readonly y1: number;
      readonly x2: number; readonly y2: number;
      readonly x: number;  readonly y: number;
    }
  | {
      readonly kind: 'Q';
      readonly x1: number; readonly y1: number;
      readonly x: number;  readonly y: number;
    }
  | {
      readonly kind: 'A';
      readonly rx: number; readonly ry: number;
      readonly rotation: number;
      readonly largeArc: boolean;
      readonly sweep: boolean;
      readonly x: number; readonly y: number;
    }
  | { readonly kind: 'Z' };

export type PathCommands = readonly PathCommand[];

// ---------------------------------------------------------------------------
// Text / glyph shaping
// ---------------------------------------------------------------------------

/** Single positioned glyph inside a ShapedRun. */
export interface ShapedGlyph {
  readonly glyphId: number;
  /** Character index in the original text that this glyph maps to. */
  readonly cluster: number;
  readonly xAdvance: number;
  readonly yAdvance: number;
  readonly xOffset: number;
  readonly yOffset: number;
}

/**
 * A shaped text run — the output of text shaping (harfbuzzjs / K3).
 * The display list carries only shaped text; unshaped strings are a
 * higher-level concern resolved before the IR is produced.
 */
export interface ShapedRun {
  readonly fontRef: AssetRef;
  readonly fontSize: number;
  readonly glyphs: readonly ShapedGlyph[];
  /** Original text for accessibility and fallback rendering. */
  readonly text: string;
  /** CSS font-family for fallback rendering when glyph outlines are unavailable. */
  readonly fontFamily?: string;
  /** CSS font-weight (e.g. 400, 700) for fallback rendering. */
  readonly fontWeight?: number;
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

/** Reference to an external asset (font binary or raster image). */
export interface AssetRef {
  readonly kind: 'font' | 'image';
  /** URL, data-URI, or asset-registry key. */
  readonly uri: string;
}

/** How a raster image is fitted into its target rect. */
export type ImageFit = 'contain' | 'cover' | 'fill' | 'none';

// ---------------------------------------------------------------------------
// Viewport
// ---------------------------------------------------------------------------

/** Root viewport describing the render target dimensions. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio?: number;
  readonly background?: Color;
}

// ---------------------------------------------------------------------------
// Display-list items
// ---------------------------------------------------------------------------

/**
 * Shared base fields for every display-list item.
 *
 * - `id` — optional stable identifier for diffing, hit-testing, and
 *   animation identity tracking.
 * - `transform` — optional local transform applied before drawing.
 * - `opacity` — optional layer-level opacity (0–1), composited with
 *   paint-level alpha.
 */
interface DisplayListItemBase {
  readonly id?: string;
  readonly transform?: Mat3;
  readonly opacity?: number;
}

export interface RectItem extends DisplayListItemBase {
  readonly kind: 'rect';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Per-corner radii: [topLeft, topRight, bottomRight, bottomLeft]. */
  readonly cornerRadii?: readonly [number, number, number, number];
  readonly fill?: Paint;
  readonly stroke?: Paint;
  readonly strokeStyle?: Stroke;
}

export interface EllipseItem extends DisplayListItemBase {
  readonly kind: 'ellipse';
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly fill?: Paint;
  readonly stroke?: Paint;
  readonly strokeStyle?: Stroke;
}

export interface LineItem extends DisplayListItemBase {
  readonly kind: 'line';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly stroke: Paint;
  readonly strokeStyle?: Stroke;
}

export interface PathItem extends DisplayListItemBase {
  readonly kind: 'path';
  readonly commands: PathCommands;
  readonly fill?: Paint;
  readonly stroke?: Paint;
  readonly strokeStyle?: Stroke;
  readonly fillRule?: 'nonzero' | 'evenodd';
}

export interface GlyphRunItem extends DisplayListItemBase {
  readonly kind: 'glyph-run';
  readonly x: number;
  readonly y: number;
  readonly run: ShapedRun;
  readonly fill?: Paint;
}

export interface ImageItem extends DisplayListItemBase {
  readonly kind: 'image';
  readonly assetRef: AssetRef;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fit?: ImageFit;
}

export interface GroupItem extends DisplayListItemBase {
  readonly kind: 'group';
  readonly children: readonly DisplayListItem[];
  /** Optional clip region. Content outside this path is not drawn. */
  readonly clip?: PathCommands;
}

/** Discriminated union of every drawable primitive. */
export type DisplayListItem =
  | RectItem
  | EllipseItem
  | LineItem
  | PathItem
  | GlyphRunItem
  | ImageItem
  | GroupItem;

// ---------------------------------------------------------------------------
// Display list
// ---------------------------------------------------------------------------

/** A complete display list: a viewport plus an ordered list of items. */
export interface DisplayList {
  readonly viewport: Viewport;
  readonly items: readonly DisplayListItem[];
}

// ---------------------------------------------------------------------------
// Renderer interface
// ---------------------------------------------------------------------------

/**
 * A renderer consumes a DisplayList and produces a backend-specific
 * artifact (SVG string, Canvas2D result, PDF bytes, etc.).
 */
export interface Renderer<TArtifact> {
  render(displayList: DisplayList): TArtifact;
}
