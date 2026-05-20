/**
 * halo-geometry-helpers.ts — Pure geometry math functions shared by
 * both the Three.js interactive renderer and the SVG export backend.
 *
 * These functions compute positions, alphas, and sizes for halo field
 * elements. They have NO dependency on Three.js, Canvas, or DOM.
 *
 * Math utilities are inlined here to avoid circular imports with index.ts.
 */

import type { HaloFieldConfig, MascotBox, Spoke, EchoMarkerVariant } from "./index.js";

// ─── Inlined math (avoids circular import with index.ts) ─────────────

const TAU = Math.PI * 2;
const MASCOT_VIEWBOX_SIZE = 600;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function wrapPositive(value: number, modulus: number): number {
  const w = value % modulus;
  return w < 0 ? w + modulus : w;
}

// ─── Constants ────────────────────────────────────────────────────────

export const BACKGROUND_SPOKE_FADE_SEGMENTS = 16;
export const BACKGROUND_SPOKE_WIDTH_PX = 1;
export const ECHO_PLUS_SIZE_PX = 8;
export const ECHO_TEXT_BASE_FONT_SIZE_PX = 18;
export const TEXT_LABEL_MARGIN_PX = 16;
export const TEXT_LABEL_FONT_FAMILY = '"Ubuntu Sans", "Ubuntu", sans-serif';
export const MASCOT_REFERENCE_HALO_OPACITY = 0.3;

export const MASCOT_EYE_SPECS = [
  { cx: 260, cy: 290.25, radius: 8 },
  { cx: 340, cy: 290.25, radius: 8 }
] as const;

export const MASCOT_NOSE_PATH_D =
  "M314.719,325.951c1.206.283,1.861,1.609,1.362,2.749-3.479,7.962-8.503,15.086-14.69,20.992-.78.744-2.004.744-2.784,0-6.186-5.905-11.211-13.029-14.69-20.992-.498-1.14.156-2.466,1.362-2.749,4.728-1.111,9.655-1.701,14.719-1.701s9.991.59,14.719,1.701Z";

// ─── Reveal state (shared type) ───────────────────────────────────────

export interface HaloRevealState {
  haloU: number;
  startAngleRad: number;
  innerRadiusPx: number;
  outerRadiusPx: number;
}

// ─── Geometry scale ───────────────────────────────────────────────────

export function getGeometryScale(box: MascotBox | null, config: HaloFieldConfig): number {
  if (box) return box.draw_size_px / MASCOT_VIEWBOX_SIZE;
  return Math.max(0.01, config.composition.scale || 1);
}

// ─── Radial fade (vignette) ───────────────────────────────────────────

export function getRadialFadeAlpha(radius: number, fullR: number, config: HaloFieldConfig): number {
  if (config.vignette?.enabled === false) return 1;
  const strength = clamp(config.vignette?.shape_fade ?? 1, 0, 1);
  if (strength <= 0 || fullR <= 0) return 1;
  const startU = clamp(config.vignette?.shape_fade_start ?? 0.3, 0, 1);
  const endU = clamp(config.vignette?.shape_fade_end ?? 1.0, startU + 0.01, 1);
  const innerR = fullR * startU;
  const outerR = fullR * endU;
  const fadeU = clamp((radius - innerR) / Math.max(1, outerR - innerR), 0, 1);
  return 1 - strength * fadeU;
}

// ─── Reveal alpha functions ───────────────────────────────────────────

/** Soft-edged angle sweep reveal alpha (for echo dots). */
export function getRevealLocalAlpha(
  localX: number, localY: number,
  reveal: HaloRevealState | null,
  spokeCount: number
): number {
  if (!reveal) return 1;
  if (reveal.haloU >= 0.999) return 1;
  if (reveal.haloU <= 0) return 0;

  const r = Math.hypot(localX, localY);
  if (r < reveal.innerRadiusPx - 0.01 || r > reveal.outerRadiusPx + 0.01) return 0;

  const pointAngle = Math.atan2(localY, localX);
  const sweepDist = wrapPositive(reveal.startAngleRad - pointAngle, TAU);
  const sweepLimit = TAU * reveal.haloU;
  const softness = TAU * 0.45 / Math.max(1, spokeCount);
  return 1 - smoothstep(sweepLimit, sweepLimit + softness, sweepDist);
}

/** Hard-edged angle sweep reveal alpha (for spokes/markers). */
export function getSpokeRevealAlpha(
  localX: number, localY: number,
  reveal: HaloRevealState | null
): number {
  if (!reveal) return 1;
  if (reveal.haloU >= 0.999) return 1;
  if (reveal.haloU <= 0) return 0;

  const r = Math.hypot(localX, localY);
  if (r < reveal.innerRadiusPx - 0.01 || r > reveal.outerRadiusPx + 0.01) return 0;

  const pointAngle = Math.atan2(localY, localX);
  const sweepDist = wrapPositive(reveal.startAngleRad - pointAngle, TAU);
  const sweepLimit = TAU * reveal.haloU;
  return sweepDist <= sweepLimit ? 1 : 0;
}

// ─── Fold seam alpha ──────────────────────────────────────────────────

export function getFoldSeamAlpha(angleRad: number, config: HaloFieldConfig): number {
  const baseAngleRad =
    (config.generator_wrangle.base_angle_deg ?? 0) * (Math.PI / 180) +
    (config.composition.global_rotation_deg ?? 0) * (Math.PI / 180);
  const displayU = wrapPositive(angleRad - baseAngleRad, TAU) / TAU;
  const seamDisplayU = 0.5;
  if (displayU <= seamDisplayU) return 1;
  const fadeWidthU = 3.5 / Math.max(1, config.generator_wrangle.spoke_count || 1);
  return smoothstep(0, fadeWidthU, displayU - seamDisplayU);
}

// ─── Ray-circle intersection ──────────────────────────────────────────

export function getWorldRayCircleSegment(
  oxPx: number, oyPx: number, angle: number,
  ccxPx: number, ccyPx: number, radiusPx: number,
  rayStart: number, rayEnd: number
): { start_x: number; start_y: number; end_x: number; end_y: number } | null {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const rcx = ccxPx - oxPx;
  const rcy = ccyPx - oyPx;
  const proj = dx * rcx + dy * rcy;
  const cDistSq = rcx * rcx + rcy * rcy;
  const disc = proj * proj - (cDistSq - radiusPx * radiusPx);
  if (disc <= 0) return null;

  const root = Math.sqrt(disc);
  const entry = proj - root;
  const exit = proj + root;
  const sr = Math.max(rayStart, Math.min(entry, exit));
  const er = Math.min(rayEnd, Math.max(entry, exit));
  if (er <= sr) return null;

  return {
    start_x: oxPx + dx * sr,
    start_y: oyPx + dy * sr,
    end_x: oxPx + dx * er,
    end_y: oyPx + dy * er
  };
}

// ─── Thick spoke width ───────────────────────────────────────────────

export function getThickSpokeWidthPx(spoke: Spoke, geoScale: number, config: HaloFieldConfig): number {
  const startPx = Math.max(0, config.spoke_lines.phase_start_width_px ?? 0);
  const endPx = Math.max(0, config.spoke_lines.phase_end_width_px ?? 0);
  const wpu = clamp(spoke.width_phase_u ?? spoke.phase_u ?? 1, 0, 1);
  return lerp(startPx, endPx, wpu) * geoScale;
}

// ─── Echo marker geometry ─────────────────────────────────────────────

export interface EchoMarkerGeometry {
  variant: EchoMarkerVariant;
  outerRadiusPx: number;
  sizePx: number;
  triangleSidePx: number;
  dashLengthPx: number;
}

export function getEchoMarkerGeometry(
  variant: EchoMarkerVariant,
  dotRadiusPx: number,
  templateRadiusPx: number,
  geoScale: number,
  echoMarkerScaleMult: number,
  echoSparseScaleMult: number
): EchoMarkerGeometry {
  const scaleFactor =
    ECHO_PLUS_SIZE_PX * geoScale *
    clamp(dotRadiusPx / Math.max(0.0001, templateRadiusPx), 0.25, 4) *
    echoMarkerScaleMult * echoSparseScaleMult;
  const triangleSidePx = Math.max(
    6.4 * geoScale,
    dotRadiusPx * 3.2 * echoMarkerScaleMult * echoSparseScaleMult
  );
  const dashLengthPx = scaleFactor * 0.75;

  let outerRadiusPx = dotRadiusPx;
  if (variant === "plus" || variant === "diamond" || variant === "star") {
    outerRadiusPx = scaleFactor * 0.5;
  } else if (variant === "triangles") {
    outerRadiusPx = triangleSidePx / Math.sqrt(3);
  } else if (variant === "radial_dash") {
    outerRadiusPx = dashLengthPx * 0.5;
  } else if (variant === "hexagon") {
    outerRadiusPx = scaleFactor * 1.1 * 0.5;
  }

  return { variant, outerRadiusPx, sizePx: scaleFactor, triangleSidePx, dashLengthPx };
}

// ─── Content band metrics ─────────────────────────────────────────────

export interface ContentBandMetrics {
  startRadius: number;
  endRadius: number;
  clearStartR: number;
  clearEndR: number;
}

export function getSharedContentStartRadius(haloOuterR: number, config: HaloFieldConfig): number {
  return haloOuterR + Math.max(0, config.spoke_lines.content_clearance_px ?? 0);
}

export function getContentBandMetrics(
  haloOuterR: number,
  fullFrameR: number,
  contentLengthPx: number,
  config: HaloFieldConfig
): ContentBandMetrics {
  const contentStartRadius = Math.min(fullFrameR, getSharedContentStartRadius(haloOuterR, config));
  const startRadius = contentStartRadius;
  const endRadius = clamp(
    startRadius + contentLengthPx,
    startRadius,
    fullFrameR
  );
  return {
    startRadius,
    endRadius,
    clearStartR: Math.max(contentStartRadius, startRadius - TEXT_LABEL_MARGIN_PX),
    clearEndR: Math.min(fullFrameR, endRadius + TEXT_LABEL_MARGIN_PX)
  };
}

// ─── Text label font size (stage-independent) ─────────────────────────

export function getTextLabelFontSizePx(
  config: HaloFieldConfig,
  stageMinDimPx: number
): number {
  return Math.max(
    3,
    Math.round(
      Math.max(3, config.spoke_text?.font_size_px ?? ECHO_TEXT_BASE_FONT_SIZE_PX) *
      Math.max(0.01, stageMinDimPx / 1080) *
      Math.max(0.01, config.composition.scale || 1)
    )
  );
}
