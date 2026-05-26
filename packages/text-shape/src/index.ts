// @design-foundry/text-shape
//
// Text-shaping wrapper around harfbuzzjs (HarfBuzz compiled to WASM).
// Input: font binary + text + options.
// Output: ShapedRun from @design-foundry/render-ir.
//
// This package owns all text-shaping concerns for the workspace.
// Consumers should not import harfbuzzjs directly.

import * as hb from "harfbuzzjs";
import type {
  ShapedRun,
  ShapedGlyph,
  AssetRef,
} from "@design-foundry/render-ir";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ShapeOptions {
  /** Text direction. Defaults to auto-detected via guessSegmentProperties. */
  readonly direction?: "ltr" | "rtl" | "ttb" | "btt";
  /** ISO 15924 script tag (e.g. "Latn"). */
  readonly script?: string;
  /** BCP 47 language tag (e.g. "en"). */
  readonly language?: string;
  /** OpenType feature strings (e.g. ["kern", "-liga"]). */
  readonly features?: readonly string[];
}

// ---------------------------------------------------------------------------
// Font handle
// ---------------------------------------------------------------------------

/** Opaque handle to a loaded font. Call destroyFont() when done. */
export interface FontHandle {
  readonly ref: AssetRef;
  readonly upem: number;
  /** @internal */ readonly _blob: InstanceType<typeof hb.Blob>;
  /** @internal */ readonly _face: InstanceType<typeof hb.Face>;
  /** @internal */ readonly _font: InstanceType<typeof hb.Font>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load a font from raw binary data (TTF / OTF / WOFF2).
 * The returned handle holds WASM-side resources; call `destroyFont()`
 * when the font is no longer needed.
 */
export function loadFont(data: ArrayBuffer, uri: string): FontHandle {
  const blob = new hb.Blob(data);
  const face = new hb.Face(blob, 0);
  const font = new hb.Font(face);
  return {
    ref: { kind: "font", uri },
    upem: face.upem,
    _blob: blob,
    _face: face,
    _font: font,
  };
}

/**
 * Shape a text string using the given font at the given size.
 *
 * Returns a `ShapedRun` matching the render-ir type: glyph IDs, cluster
 * indices, advances and offsets are all in document-space pixels scaled
 * from font units by `fontSize / upem`.
 */
export function shape(
  font: FontHandle,
  text: string,
  fontSize: number,
  options?: ShapeOptions,
): ShapedRun {
  const buffer = new hb.Buffer();
  buffer.addText(text);

  if (options?.direction !== undefined) {
    switch (options.direction) {
      case "ltr": buffer.setDirection(hb.Direction.LTR); break;
      case "rtl": buffer.setDirection(hb.Direction.RTL); break;
      case "ttb": buffer.setDirection(hb.Direction.TTB); break;
      case "btt": buffer.setDirection(hb.Direction.BTT); break;
    }
  }
  if (options?.script !== undefined) {
    buffer.setScript(options.script);
  }
  if (options?.language !== undefined) {
    buffer.setLanguage(options.language);
  }
  buffer.guessSegmentProperties();

  const features = options?.features?.map((f) => {
    const parsed = hb.Feature.fromString(f);
    if (parsed === undefined) throw new Error(`Invalid OpenType feature string: ${f}`);
    return parsed;
  });

  // Set font scale to fontSize in 64ths of a pixel (HarfBuzz convention:
  // scale is in 26.6 fixed-point by default — but harfbuzzjs exposes raw
  // integers and the positions come back in font units × scale / upem).
  // Simplest correct approach: set scale = upem so positions come back in
  // font units, then scale by fontSize / upem ourselves.
  font._font.setScale(font.upem, font.upem);

  hb.shape(font._font, buffer, features);

  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();
  const scale = fontSize / font.upem;

  const glyphs: ShapedGlyph[] = new Array(infos.length);
  for (let i = 0; i < infos.length; i++) {
    const info = infos[i]!;
    const pos = positions[i]!;
    glyphs[i] = {
      glyphId: info.codepoint,
      cluster: info.cluster,
      xAdvance: pos.xAdvance * scale,
      yAdvance: pos.yAdvance * scale,
      xOffset: pos.xOffset * scale,
      yOffset: pos.yOffset * scale,
    };
  }

  return {
    fontRef: font.ref,
    fontSize,
    glyphs,
    text,
  };
}

/**
 * Release WASM-side resources held by a FontHandle.
 * The handle must not be used after this call.
 */
export function destroyFont(_handle: FontHandle): void {
  // harfbuzzjs v1 classes are GC'd by the WASM instance's destructor
  // tracking. Explicit destruction is not currently exposed, but the
  // function exists so consumers adopt correct lifecycle habits and
  // we can add explicit cleanup when harfbuzzjs supports it.
}
