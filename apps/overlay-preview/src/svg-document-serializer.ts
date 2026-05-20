/**
 * svg-document-serializer.ts — Produces a complete SVG document string
 * from the current frame state. This is a dedicated export backend
 * (per docs/future-backends.md) that consumes the same data structures
 * as the Three.js interactive renderer but outputs SVG markup.
 *
 * Coordinate system: Three.js uses Y-up (0,0 bottom-left). SVG uses
 * Y-down (0,0 top-left). All world coordinates are flipped via
 * svgY = heightPx − worldY before being written to markup.
 */

import type { ColorRgba, PointField, PointRecord } from "@brand-layout-ops/core-types";
import type { UbuntuSummitAnimationSceneDescriptor } from "@brand-layout-ops/operator-ubuntu-summit-animation";
import {
  type HaloFieldConfig,
  type MascotBox,
  type Spoke,
  type PostFinaleFieldState,
  type RuntimePoint,
  type RuntimeTiming,
  TAU,
  clamp,
  lerp,
  smoothstep,
  wrapPositive,
  getEchoMarkerVariant,
  buildIntroHaloFieldState,
  buildRuntimePoints,
  UBUNTU_RELEASE_LABELS,
  MASCOT_VIEWBOX_SIZE,
  // Shared geometry helpers
  BACKGROUND_SPOKE_WIDTH_PX,
  MASCOT_REFERENCE_HALO_OPACITY,
  MASCOT_EYE_SPECS,
  MASCOT_NOSE_PATH_D,
  getGeometryScale,
  getRadialFadeAlpha,
  getRevealLocalAlpha,
  getSpokeRevealAlpha,
  getFoldSeamAlpha,
  getWorldRayCircleSegment,
  getThickSpokeWidthPx,
  getEchoMarkerGeometry,
  getSharedContentStartRadius,
  getContentBandMetrics,
  getTextLabelFontSizePx,
  type HaloRevealState,
} from "@brand-layout-ops/operator-halo-field";
import { escapeXml } from "./svg-overlay-adapter.js";
import type {
  SceneFamilyPreviewState,
  PhyllotaxisSceneFamilyPreviewState,
  ScatterSceneFamilyPreviewState,
  CpuFuzzyBoidsSceneFamilyPreviewState,
  WorkerFuzzyBoidsSceneFamilyPreviewState,
} from "./scene-family-preview.js";

// ─── Types ────────────────────────────────────────────────────────────

export interface SvgDocumentOptions {
  widthPx: number;
  heightPx: number;
  transparentBackground: boolean;
  /** Pre-serialized authored overlay SVG inner markup (text, logo, safe-area). */
  overlayMarkup?: string | null;
  /** Raw SVG markup of the mascot face asset. Null to omit mascot face. */
  mascotFaceSvgMarkup?: string | null;
  /** Raw SVG markup of the mascot halo asset. Null to omit halo ring. */
  mascotHaloSvgMarkup?: string | null;
}

export interface HaloSvgInput {
  sceneDescriptor: UbuntuSummitAnimationSceneDescriptor;
}

export interface SceneFamilySvgInput {
  previewState: SceneFamilyPreviewState;
  backgroundColor: string;
}

// ─── SVG builder helpers ──────────────────────────────────────────────

/** XML-safe font-family value — single quotes inside double-quoted attribute. */
const SVG_FONT_FAMILY = "'Ubuntu Sans', 'Ubuntu', sans-serif";

/**
 * Strip the outer <svg ...>...</svg> wrapper from serialized overlay markup,
 * returning only the inner content wrapped in a <g>.  This avoids a nested
 * <svg> element inside the export document.
 */
function unwrapOverlaySvg(markup: string): string {
  const openTagEnd = markup.indexOf(">");
  if (openTagEnd < 0) return markup;
  const closeTagStart = markup.lastIndexOf("</svg>");
  const inner = closeTagStart > openTagEnd
    ? markup.slice(openTagEnd + 1, closeTagStart)
    : markup.slice(openTagEnd + 1);
  return inner.trim() ? `<g class="authored-overlay">${inner}</g>` : "";
}

function svgLine(
  x1: number, y1: number, x2: number, y2: number,
  strokeWidth: number, stroke: string, alpha: number
): string {
  if (alpha <= 0 || strokeWidth <= 0) return "";
  const attrs = alpha < 1 ? ` stroke-opacity="${n(alpha)}"` : "";
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${n(strokeWidth)}" stroke-linecap="round"${attrs}/>`;
}

function svgCircle(
  cx: number, cy: number, r: number,
  fill: string, alpha: number
): string {
  if (alpha <= 0 || r <= 0) return "";
  const attrs = alpha < 1 ? ` fill-opacity="${n(alpha)}"` : "";
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"${attrs}/>`;
}

function n(v: number): string {
  return Number(v.toFixed(3)).toString();
}

function colorRgbaToHex(c: ColorRgba): string {
  const r = Math.round(clamp(c.r, 0, 255));
  const g = Math.round(clamp(c.g, 0, 255));
  const b = Math.round(clamp(c.b, 0, 255));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function estimateTextWidthPx(text: string, fontSizePx: number): number {
  return text.length * fontSizePx * 0.52;
}

// ─── Marker SVG generators ───────────────────────────────────────────

function svgPlusMarker(
  cx: number, cy: number, size: number, sw: number, stroke: string, alpha: number
): string {
  const half = size * 0.5;
  return svgLine(cx - half, cy, cx + half, cy, sw, stroke, alpha) +
    svgLine(cx, cy - half, cx, cy + half, sw, stroke, alpha);
}

function svgTriangleMarker(
  cx: number, cy: number, side: number, sw: number, stroke: string, alpha: number, angle: number
): string {
  const r = side / Math.sqrt(3);
  const pts: string[] = [];
  for (let i = 0; i < 3; i++) {
    const a = angle + (TAU * i) / 3;
    pts.push(`${n(cx + Math.cos(a) * r)},${n(cy + Math.sin(a) * r)}`);
  }
  const attrs = alpha < 1 ? ` stroke-opacity="${n(alpha)}"` : "";
  return `<polygon points="${pts.join(" ")}" fill="none" stroke="${stroke}" stroke-width="${n(sw)}" stroke-linejoin="round"${attrs}/>`;
}

function svgDiamondMarker(
  cx: number, cy: number, size: number, sw: number, stroke: string, alpha: number, angle: number
): string {
  const half = size * 0.5;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const offsets = [[half, 0], [0, half], [-half, 0], [0, -half]] as const;
  const pts = offsets.map(([lx, ly]) =>
    `${n(cx + cos * lx - sin * ly)},${n(cy + sin * lx + cos * ly)}`
  );
  const attrs = alpha < 1 ? ` stroke-opacity="${n(alpha)}"` : "";
  return `<polygon points="${pts.join(" ")}" fill="none" stroke="${stroke}" stroke-width="${n(sw)}" stroke-linejoin="round"${attrs}/>`;
}

function svgRadialDashMarker(
  cx: number, cy: number, len: number, sw: number, stroke: string, alpha: number, angle: number
): string {
  const half = len * 0.5;
  const dx = Math.cos(angle) * half;
  const dy = Math.sin(angle) * half;
  return svgLine(cx - dx, cy - dy, cx + dx, cy + dy, sw, stroke, alpha);
}

function svgStarMarker(
  cx: number, cy: number, size: number, sw: number, stroke: string, alpha: number
): string {
  let out = "";
  const half = size * 0.5;
  for (let i = 0; i < 3; i++) {
    const a = (TAU * i) / 6;
    const cos = Math.cos(a) * half;
    const sin = Math.sin(a) * half;
    out += svgLine(cx - cos, cy - sin, cx + cos, cy + sin, sw, stroke, alpha);
  }
  return out;
}

function svgHexagonMarker(
  cx: number, cy: number, size: number, sw: number, stroke: string, alpha: number, angle: number
): string {
  const r = size * 0.5;
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = angle + (TAU * i) / 6;
    pts.push(`${n(cx + Math.cos(a) * r)},${n(cy + Math.sin(a) * r)}`);
  }
  const attrs = alpha < 1 ? ` stroke-opacity="${n(alpha)}"` : "";
  return `<polygon points="${pts.join(" ")}" fill="none" stroke="${stroke}" stroke-width="${n(sw)}" stroke-linejoin="round"${attrs}/>`;
}

// ─── Halo SVG serialization ──────────────────────────────────────────

interface SvgLayerOutput {
  defs: string;
  markup: string;
}

/**
 * Sample the radial fade function at evenly-spaced points along a spoke and
 * emit a single `<line>` per spoke with a `<linearGradient>` that encodes the
 * opacity ramp.  This replaces the previous approach of N discrete segments
 * and produces cleaner, Illustrator-friendly SVG.
 */
function serializeBackgroundSpokes(
  spokes: Spoke[],
  fullFrameR: number,
  config: HaloFieldConfig,
  heightPx: number
): SvgLayerOutput {
  const color = config.spoke_lines.construction_color || "#333333";
  const bgWidth = BACKGROUND_SPOKE_WIDTH_PX * getGeometryScale(null, config);
  const cx = config.composition.center_x_px;
  const cy = config.composition.center_y_px;
  let defs = "";
  let markup = "";
  let gradientIndex = 0;

  // Number of gradient stops — enough to capture the radial fade curve smoothly.
  const GRADIENT_STOPS = 8;

  for (const spoke of spokes) {
    if (spoke.seam_overlay_only) continue;
    const spokeAlpha = clamp(spoke.alpha ?? 1, 0, 1);
    if (spokeAlpha <= 0) continue;

    const cosA = Math.cos(spoke.angle);
    const sinA = Math.sin(spoke.angle);

    // Check if the spoke has any visible portion
    const startR = spoke.start_radius;
    let hasVisible = false;
    for (let i = 0; i <= GRADIENT_STOPS; i++) {
      const t = i / GRADIENT_STOPS;
      const r = lerp(startR, fullFrameR, t);
      if (getRadialFadeAlpha(r, fullFrameR, config) > 0) {
        hasVisible = true;
        break;
      }
    }
    if (!hasVisible) continue;

    // Line endpoints
    const sx = cx + cosA * startR;
    const sy = heightPx - (cy + sinA * startR);
    const ex = cx + cosA * fullFrameR;
    const ey = heightPx - (cy + sinA * fullFrameR);

    // Build gradient stops
    const gradId = `bg-spoke-grad-${gradientIndex++}`;
    let stops = "";
    for (let i = 0; i <= GRADIENT_STOPS; i++) {
      const t = i / GRADIENT_STOPS;
      const r = lerp(startR, fullFrameR, t);
      const fade = getRadialFadeAlpha(r, fullFrameR, config);
      const stopAlpha = spokeAlpha * fade;
      const pct = n(t * 100);
      stops += `<stop offset="${pct}%" stop-color="${color}" stop-opacity="${n(stopAlpha)}"/>`;
    }

    defs += `<linearGradient id="${gradId}" gradientUnits="userSpaceOnUse" x1="${n(sx)}" y1="${n(sy)}" x2="${n(ex)}" y2="${n(ey)}">${stops}</linearGradient>`;
    markup += `<line x1="${n(sx)}" y1="${n(sy)}" x2="${n(ex)}" y2="${n(ey)}" stroke="url(#${gradId})" stroke-width="${n(bgWidth)}" stroke-linecap="round"/>`;
  }

  return {
    defs,
    markup: markup ? `<g class="background-spokes">${markup}</g>` : ""
  };
}

function serializeIntroPoints(
  runtimePoints: RuntimePoint[],
  timeSec: number,
  forceFinal: boolean,
  config: HaloFieldConfig,
  timing: RuntimeTiming,
  heightPx: number
): string {
  const color = config.point_style.color || "#ffffff";
  const alphaRampDur = Math.max(0, config.transition_wrangle.alpha_ramp_duration_sec || 0);
  let markup = "";

  for (const pt of runtimePoints) {
    if (!forceFinal && timeSec < pt.birth_sec) continue;
    if (!forceFinal && config.transition_wrangle.hide_invisible_by_pscale && timeSec < pt.visible_sec) continue;

    let angle = pt.target_angle;
    if (!forceFinal) {
      const liveAgeSec = Math.max(0, timeSec - pt.birth_sec);
      const liveAngle = timing.spawn_angle_rad - pt.speed_rad_per_sec * liveAgeSec;
      const capDurSec = Math.max(0.0001, timing.dot_end_sec - pt.capture_start_sec);
      const rawCapU = clamp((timeSec - pt.capture_start_sec) / capDurSec, 0, 1);
      const capU = rawCapU * rawCapU * (3 - 2 * rawCapU);
      const deltaAngle = wrapPositive(liveAngle - pt.target_angle, TAU);
      angle = liveAngle - deltaAngle * capU;
    }

    const px = pt.center_x_px + Math.cos(angle) * pt.radius;
    const svgY = heightPx - (pt.center_y_px + Math.sin(angle) * pt.radius);

    let pointAlpha = config.point_style.alpha;
    if (!forceFinal && alphaRampDur > 0) {
      const alphaStart = Math.max(pt.birth_sec, pt.visible_sec);
      pointAlpha *= smoothstep(alphaStart, alphaStart + alphaRampDur, timeSec);
    }
    if (pointAlpha <= 0) continue;

    if (!forceFinal) {
      const flashCapDur = Math.max(0.0001, timing.dot_end_sec - pt.capture_start_sec);
      const flashRawU = clamp((timeSec - pt.capture_start_sec) / flashCapDur, 0, 1);
      if (flashRawU >= 0.8) {
        const flashU = (flashRawU - 0.8) / 0.2;
        pointAlpha = Math.min(1, pointAlpha * (1 + 1.8 * Math.sin(flashU * Math.PI)));
      }
    }

    markup += svgCircle(px, svgY, pt.radius_px, color, pointAlpha);
  }

  return markup ? `<g class="dots">${markup}</g>` : "";
}

function serializePostFinalePoints(
  fieldState: PostFinaleFieldState,
  config: HaloFieldConfig,
  heightPx: number
): string {
  const color = config.point_style.color || "#ffffff";
  let markup = "";

  for (const pt of fieldState.points) {
    const alpha = config.point_style.alpha * pt.alpha;
    if (alpha <= 0 || pt.radius_px <= 0) continue;
    const svgY = heightPx - pt.y;
    markup += svgCircle(pt.x, svgY, pt.radius_px, color, alpha);
  }

  return markup ? `<g class="dots">${markup}</g>` : "";
}

function serializeHaloSpokesAndEchoes(
  spokes: Spoke[],
  visibleSpokeCount: number,
  box: MascotBox | null,
  haloOuterR: number,
  fullFrameR: number,
  config: HaloFieldConfig,
  baseAlpha: number,
  reveal: HaloRevealState | null,
  heightPx: number,
  stageMinDimPx: number
): string {
  if (!box || baseAlpha <= 0) return "";

  const cx = config.composition.center_x_px;
  const cy = config.composition.center_y_px;
  const geoScale = getGeometryScale(box, config);
  const thinColor = config.spoke_lines.reference_color || "#666666";
  const thickColor = config.spoke_lines.color || "#ffffff";
  const echoColor = config.spoke_lines.echo_color || config.spoke_lines.color || "#444444";
  const outerWidthPx = Math.max(0, config.spoke_lines.width_px || 0) * geoScale;
  const thickEnabled =
    (config.spoke_lines.phase_start_width_px ?? 0) > 0 ||
    (config.spoke_lines.phase_end_width_px ?? 0) > 0;
  const echoCount = Math.max(0, Math.round(config.spoke_lines.echo_count || 0));
  const echoDotScaleMult = clamp(config.spoke_lines.echo_width_mult ?? 1, 0.01, 1);
  const echoWaveCount = Math.max(0, config.spoke_lines.echo_wave_count || 0);
  const echoFadeMult = clamp(config.spoke_lines.echo_opacity_mult ?? 1, 0, 1);
  const echoStyle = config.spoke_lines.echo_style || "dots";
  const echoMarkerScaleMult = Math.max(0.1, config.spoke_lines.echo_marker_scale_mult ?? 1);
  const maxSpokeCount = Math.max(1, config.generator_wrangle.spoke_count || 1);
  const minSpokeCount = clamp(
    config.screensaver?.min_spoke_count ?? maxSpokeCount, 1, maxSpokeCount
  );
  const currentVisCount = clamp(visibleSpokeCount || maxSpokeCount, 1, maxSpokeCount);
  const sparseScaleBoost = Math.max(0, config.spoke_lines.echo_sparse_scale_boost ?? 0);
  const sparseU = maxSpokeCount <= minSpokeCount
    ? 0
    : clamp(
      (maxSpokeCount - currentVisCount) / Math.max(0.0001, maxSpokeCount - minSpokeCount),
      0, 1
    );
  const echoSparseScaleMult = 1 + sparseScaleBoost * sparseU;
  const echoMarkerWidthPx = Math.max(
    0.5 * geoScale,
    Math.max(0, config.spoke_lines.echo_marker_stroke_px ?? config.spoke_lines.width_px ?? 0) * geoScale
  );
  const echoSpacingOffsetPx = Math.max(0, config.spoke_lines.echo_spacing_offset_px ?? 0) * geoScale;
  const minimumContentStartRadius = getSharedContentStartRadius(haloOuterR, config);
  const minimumMarkerStartRadius = minimumContentStartRadius + echoSpacingOffsetPx;
  const rippleMinScale = 0.45;
  const rippleMaxScale = 1.55;
  const rippleFadeStartU = lerp(0.2, 0.85, echoFadeMult);

  let thinMarkup = "";
  let thickMarkup = "";
  let echoMarkup = "";
  const fontSize = getTextLabelFontSizePx(config, stageMinDimPx);

  for (const spoke of spokes) {
    const foldSeam = getFoldSeamAlpha(spoke.angle, config);
    const spokeAlpha = baseAlpha * clamp(spoke.alpha ?? 1, 0, 1) * foldSeam;
    if (spokeAlpha <= 0) continue;

    // Thin spoke line
    if (!spoke.seam_overlay_only && outerWidthPx > 0) {
      const worldSx = cx + Math.cos(spoke.angle) * spoke.start_radius;
      const worldSy = cy + Math.sin(spoke.angle) * spoke.start_radius;
      const worldEx = cx + Math.cos(spoke.angle) * haloOuterR;
      const worldEy = cy + Math.sin(spoke.angle) * haloOuterR;
      const midX = (worldSx + worldEx) * 0.5 - cx;
      const midY = (worldSy + worldEy) * 0.5 - cy;
      const revealA = getSpokeRevealAlpha(midX, midY, reveal);
      if (revealA > 0) {
        thinMarkup += svgLine(
          worldSx, heightPx - worldSy,
          worldEx, heightPx - worldEy,
          outerWidthPx, thinColor, spokeAlpha * revealA
        );
      }
    }

    // Thick spoke line
    if (thickEnabled) {
      const seg = getWorldRayCircleSegment(
        cx, cy, spoke.angle,
        spoke.inner_clip_center_x_px, spoke.inner_clip_center_y_px,
        spoke.phase_clip_radius_px ?? spoke.phase_field_radius_px,
        spoke.start_radius, haloOuterR
      );
      if (seg) {
        const segMidX = (seg.start_x + seg.end_x) * 0.5 - cx;
        const segMidY = (seg.start_y + seg.end_y) * 0.5 - cy;
        const revealA = getSpokeRevealAlpha(segMidX, segMidY, reveal);
        if (revealA > 0) {
          thickMarkup += svgLine(
            seg.start_x, heightPx - seg.start_y,
            seg.end_x, heightPx - seg.end_y,
            getThickSpokeWidthPx(spoke, geoScale, config),
            thickColor, spokeAlpha * revealA
          );
        }
      }
    }

    // Echo dots/markers
    const dotTemplates = spoke.echo_dots;
    const orbitStep = spoke.echo_dot_step_px;
    if (
      spoke.seam_overlay_only ||
      !dotTemplates.length ||
      orbitStep <= 0 ||
      echoCount <= 0 ||
      spoke.inner_clip_offset_px <= 0
    ) continue;

    // Estimate label band for clearance
    const labelBandMetrics = config.spoke_text?.enabled
      ? getEstimatedSpokeLabelBandMetrics(spoke, haloOuterR, fullFrameR, fontSize, maxSpokeCount, config)
      : null;

    const maxOrbitIdx = Math.ceil(
      (fullFrameR - spoke.echo_dot_origin_radius) / orbitStep
    );
    const rippleSpan = Math.max(1, fullFrameR - spoke.echo_dot_origin_radius);
    let lastPlacedMarkerCenterR = Number.NEGATIVE_INFINITY;
    let lastPlacedMarkerOuterRadiusPx = 0;

    for (let oi = 0; oi <= maxOrbitIdx; oi++) {
      const tmpl = dotTemplates[Math.min(oi, dotTemplates.length - 1)];
      const dotR = spoke.echo_dot_origin_radius + oi * orbitStep;

      const wdx = cx + Math.cos(spoke.angle) * dotR;
      const wdy = cy + Math.sin(spoke.angle) * dotR;
      const clipDist = Math.hypot(
        wdx - spoke.inner_clip_center_x_px,
        wdy - spoke.inner_clip_center_y_px
      );
      if (clipDist <= spoke.phase_field_radius_px + 0.01) continue;

      const echoIdx = Math.ceil(
        (clipDist - spoke.phase_field_radius_px) / spoke.inner_clip_offset_px
      );
      if (echoIdx < 1 || echoIdx > echoCount) continue;

      const rippleU = clamp(
        (dotR - spoke.echo_dot_origin_radius) / rippleSpan, 0, 1
      );
      const ripplePhase = rippleU * echoWaveCount * TAU;
      const rippleScale = echoWaveCount > 0
        ? lerp(rippleMinScale, rippleMaxScale, 0.5 + 0.5 * Math.cos(ripplePhase))
        : 1;
      const cappedMult = Math.min(
        1, Math.pow(echoDotScaleMult, echoIdx) * rippleScale
      );
      const dotRadiusPx = tmpl.radius_px * cappedMult;
      if (dotRadiusPx <= 0) continue;

      const variant = getEchoMarkerVariant(
        echoStyle,
        spoke.source_spoke_id ?? spoke.display_slot_id,
        oi,
        config.spoke_lines.echo_shape_seed ?? 0,
        config.spoke_lines.echo_mix_shape_pct ?? 0.56
      );
      const markerGeometry = getEchoMarkerGeometry(
        variant, dotRadiusPx, tmpl.radius_px, geoScale,
        echoMarkerScaleMult, echoSparseScaleMult
      );

      if (
        labelBandMetrics
        && dotR + markerGeometry.outerRadiusPx >= labelBandMetrics.clearStartR
        && dotR - markerGeometry.outerRadiusPx <= labelBandMetrics.clearEndR
      ) continue;

      const dotAlpha =
        spokeAlpha *
        (1 - smoothstep(rippleFadeStartU, 1, rippleU)) *
        getRadialFadeAlpha(dotR, fullFrameR, config) *
        getRevealLocalAlpha(wdx - cx, wdy - cy, reveal, maxSpokeCount);
      if (dotAlpha <= 0) continue;

      if (dotR - markerGeometry.outerRadiusPx <= minimumMarkerStartRadius + 0.01) continue;

      if (Number.isFinite(lastPlacedMarkerCenterR)) {
        const minimumMarkerGapPx =
          lastPlacedMarkerOuterRadiusPx + markerGeometry.outerRadiusPx + echoSpacingOffsetPx;
        if (dotR - lastPlacedMarkerCenterR <= minimumMarkerGapPx - 0.01) continue;
      }

      lastPlacedMarkerCenterR = dotR;
      lastPlacedMarkerOuterRadiusPx = markerGeometry.outerRadiusPx;

      const svgWdx = wdx;
      const svgWdy = heightPx - wdy;

      if (variant === "plus") {
        echoMarkup += svgPlusMarker(svgWdx, svgWdy, markerGeometry.sizePx, echoMarkerWidthPx, echoColor, dotAlpha);
      } else if (variant === "triangles") {
        echoMarkup += svgTriangleMarker(svgWdx, svgWdy, markerGeometry.triangleSidePx, echoMarkerWidthPx, echoColor, dotAlpha, -(spoke.angle + Math.PI));
      } else if (variant === "diamond") {
        echoMarkup += svgDiamondMarker(svgWdx, svgWdy, markerGeometry.sizePx, echoMarkerWidthPx, echoColor, dotAlpha, -spoke.angle);
      } else if (variant === "radial_dash") {
        echoMarkup += svgRadialDashMarker(svgWdx, svgWdy, markerGeometry.dashLengthPx, echoMarkerWidthPx, echoColor, dotAlpha, -spoke.angle);
      } else if (variant === "star") {
        echoMarkup += svgStarMarker(svgWdx, svgWdy, markerGeometry.sizePx, echoMarkerWidthPx, echoColor, dotAlpha);
      } else if (variant === "hexagon") {
        echoMarkup += svgHexagonMarker(svgWdx, svgWdy, markerGeometry.sizePx * 1.1, echoMarkerWidthPx, echoColor, dotAlpha, -spoke.angle);
      } else {
        echoMarkup += svgCircle(svgWdx, svgWdy, dotRadiusPx, echoColor, dotAlpha);
      }
    }
  }

  let out = "";
  if (thinMarkup) out += `<g class="thin-spokes">${thinMarkup}</g>`;
  if (thickMarkup) out += `<g class="thick-spokes">${thickMarkup}</g>`;
  if (echoMarkup) out += `<g class="echo-markers">${echoMarkup}</g>`;
  return out;
}

function getEstimatedSpokeLabelBandMetrics(
  spoke: Spoke | null,
  haloOuterR: number,
  fullFrameR: number,
  fontSizePx: number,
  maxSpokeCount: number,
  config: HaloFieldConfig
): { clearStartR: number; clearEndR: number } | null {
  const labelSlotId = wrapPositive(
    Math.round(spoke?.label_slot_id ?? spoke?.display_slot_id ?? 0),
    maxSpokeCount
  );
  if (labelSlotId >= UBUNTU_RELEASE_LABELS.length) return null;
  const label = UBUNTU_RELEASE_LABELS[labelSlotId];
  if (!label) return null;

  const estimatedWidth = estimateTextWidthPx(label, fontSizePx);
  return getContentBandMetrics(haloOuterR, fullFrameR, estimatedWidth, config);
}

function serializeReleaseLabels(
  spokes: Spoke[],
  box: MascotBox | null,
  haloOuterR: number,
  fullFrameR: number,
  config: HaloFieldConfig,
  baseAlpha: number,
  reveal: HaloRevealState | null,
  heightPx: number,
  stageMinDimPx: number
): string {
  if (!box || baseAlpha <= 0 || !config.spoke_text?.enabled) return "";

  const cx = config.composition.center_x_px;
  const cy = config.composition.center_y_px;
  const fontSize = getTextLabelFontSizePx(config, stageMinDimPx);
  const bgColor = config.composition.background_color || "#202020";
  const textColor = config.spoke_lines.reference_color || "#666666";
  const labelPadX = Math.max(4, Math.round(fontSize * 0.28));
  const labelPadY = Math.max(2, Math.round(fontSize * 0.18));
  const maxSlots = Math.max(1, Math.round(config.generator_wrangle.spoke_count || 1));
  let markup = "";

  for (const spoke of spokes) {
    if (spoke.seam_overlay_only) continue;

    const bandMetrics = getEstimatedSpokeLabelBandMetrics(
      spoke, haloOuterR, fullFrameR, fontSize, maxSlots, config
    );
    if (!bandMetrics) continue;

    const labelSlotId = wrapPositive(
      Math.round(spoke.label_slot_id ?? spoke.display_slot_id ?? 0),
      maxSlots
    );
    const label = UBUNTU_RELEASE_LABELS[labelSlotId];
    if (!label) continue;

    const foldSeam = getFoldSeamAlpha(spoke.angle, config);
    const spokeAlpha = baseAlpha * clamp(spoke.alpha ?? 1, 0, 1) * foldSeam;
    if (spokeAlpha <= 0) continue;

    const contentStartR = getSharedContentStartRadius(haloOuterR, config);
    const startRadius = Math.min(fullFrameR, contentStartR);

    const worldX = cx + Math.cos(spoke.angle) * startRadius;
    const worldY = cy + Math.sin(spoke.angle) * startRadius;
    const svgX = worldX;
    const svgY = heightPx - worldY;

    const revealAlpha = getRevealLocalAlpha(
      worldX - (box.center_x_px ?? cx),
      worldY - (box.center_y_px ?? cy),
      reveal, maxSlots
    );
    if (revealAlpha <= 0) continue;

    const radialFade = getRadialFadeAlpha(startRadius, fullFrameR, config);
    const alpha = spokeAlpha * revealAlpha * radialFade;
    if (alpha <= 0) continue;

    // SVG rotation: negate the angle for Y-down coordinate system
    let labelRotation = -spoke.angle * (180 / Math.PI);
    const normRotRad = wrapPositive(-spoke.angle + Math.PI, TAU) - Math.PI;
    const shouldFlip = normRotRad > Math.PI * 0.5 || normRotRad < -Math.PI * 0.5;
    if (shouldFlip) labelRotation += 180;

    const textAnchor = shouldFlip ? "end" : "start";
    const estWidth = estimateTextWidthPx(label, fontSize);

    // Background rect + text
    const bgRectX = shouldFlip ? -estWidth - labelPadX : -labelPadX;
    const bgRectY = -fontSize * 0.38 - labelPadY;
    const bgRectW = estWidth + labelPadX * 2;
    const bgRectH = fontSize * 0.56 + labelPadY * 2;

    markup += `<g transform="translate(${n(svgX)},${n(svgY)}) rotate(${n(labelRotation)})" opacity="${n(alpha)}">`;
    markup += `<rect x="${n(bgRectX)}" y="${n(bgRectY)}" width="${n(bgRectW)}" height="${n(bgRectH)}" fill="${bgColor}"/>`;
    markup += `<text x="0" y="0" fill="${textColor}" font-family="${SVG_FONT_FAMILY}" font-size="${fontSize}" text-anchor="${textAnchor}" dominant-baseline="central">${escapeXml(label)}</text>`;
    markup += `</g>`;
  }

  return markup ? `<g class="release-labels">${markup}</g>` : "";
}

/**
 * Extract the inner content of an SVG file, stripping the outer <svg> tag
 * and any <?xml?> processing instructions.  Returns the inner markup that
 * can be placed inside a <g> with an appropriate transform.
 */
function extractSvgInnerMarkup(rawSvg: string): { inner: string; viewBox: string | null } {
  // Strip <?xml ...?>
  let s = rawSvg.replace(/<\?xml[^?]*\?>/gi, "").trim();

  // Extract viewBox from the opening <svg> tag
  const viewBoxMatch = s.match(/\bviewBox\s*=\s*"([^"]*)"/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : null;

  // Strip opening <svg ...> and closing </svg>
  const openEnd = s.indexOf(">");
  const closeStart = s.lastIndexOf("</svg>");
  if (openEnd >= 0 && closeStart > openEnd) {
    s = s.slice(openEnd + 1, closeStart);
  }
  return { inner: s.trim(), viewBox };
}

function serializeMascotOverlay(
  sceneDescriptor: UbuntuSummitAnimationSceneDescriptor,
  heightPx: number,
  mascotFaceSvgMarkup: string | null,
  mascotHaloSvgMarkup: string | null
): string {
  const mascotBox = sceneDescriptor.mascotBox;
  const mascotMotion = sceneDescriptor.frameState.mascotMotion;
  if (!mascotBox) return "";

  const baseAlpha = clamp(mascotMotion.mascotFadeU, 0, 1);
  if (baseAlpha <= 0) return "";

  const sizePx = mascotBox.draw_size_px;
  const centerX = mascotBox.center_x_px;
  const centerY = heightPx - mascotBox.center_y_px;
  const bgColor = sceneDescriptor.haloConfig.composition.background_color || "#202020";
  const eyeScaleY = clamp(mascotMotion.eyeScaleY, 0.02, 1);
  const headTurnDeg = sceneDescriptor.frameState.mascotMotion.headTurnDeg;
  const unitScale = sizePx / MASCOT_VIEWBOX_SIZE;
  const haloAlpha = baseAlpha
    * clamp(sceneDescriptor.frameState.haloU, 0, 1)
    * MASCOT_REFERENCE_HALO_OPACITY;

  let markup = `<g class="mascot" transform="translate(${n(centerX)},${n(centerY)}) rotate(${n(headTurnDeg)})">`;

  // Mascot halo ring — inline SVG content
  if (sceneDescriptor.haloConfig.spoke_lines.show_reference_halo && mascotHaloSvgMarkup && haloAlpha > 0) {
    const halo = extractSvgInnerMarkup(mascotHaloSvgMarkup);
    // Scale the halo viewBox content to fit sizePx × sizePx, centered
    const vb = halo.viewBox?.split(/[\s,]+/).map(Number) ?? [0, 0, 600, 600];
    const scaleX = sizePx / (vb[2] || 600);
    const scaleY = sizePx / (vb[3] || 600);
    markup += `<g transform="translate(${n(-sizePx * 0.5)},${n(-sizePx * 0.5)}) scale(${n(scaleX)},${n(scaleY)})" opacity="${n(haloAlpha)}">`;
    markup += halo.inner;
    markup += `</g>`;
  }

  // Mascot face — inline SVG content
  if (mascotFaceSvgMarkup) {
    const face = extractSvgInnerMarkup(mascotFaceSvgMarkup);
    const vb = face.viewBox?.split(/[\s,]+/).map(Number) ?? [0, 0, 600, 600];
    const scaleX = sizePx / (vb[2] || 600);
    const scaleY = sizePx / (vb[3] || 600);
    markup += `<g transform="translate(${n(-sizePx * 0.5)},${n(-sizePx * 0.5)}) scale(${n(scaleX)},${n(scaleY)})" opacity="${n(baseAlpha)}">`;
    markup += face.inner;
    markup += `</g>`;
  }

  // Fixed white nose
  markup += `<g transform="translate(${n(-sizePx * 0.5)},${n(-sizePx * 0.5)}) scale(${n(unitScale)})" opacity="${n(baseAlpha)}">`;
  markup += `<path d="${MASCOT_NOSE_PATH_D}" fill="#ffffff"/>`;
  markup += `</g>`;

  // Animated cutout nose (bob offset)
  markup += `<g transform="translate(${n(-sizePx * 0.5)},${n(-sizePx * 0.5 - mascotMotion.noseBobPx)}) scale(${n(unitScale)})" opacity="${n(baseAlpha)}">`;
  markup += `<path d="${MASCOT_NOSE_PATH_D}" fill="${bgColor}"/>`;
  markup += `</g>`;

  // Eyes
  for (const eye of MASCOT_EYE_SPECS) {
    const localX = sizePx * (eye.cx / MASCOT_VIEWBOX_SIZE - 0.5);
    const localY = sizePx * (eye.cy / MASCOT_VIEWBOX_SIZE - 0.5);
    const radiusX = sizePx * (eye.radius / MASCOT_VIEWBOX_SIZE);
    const radiusY = Math.max(0.75, radiusX * eyeScaleY);
    markup += `<ellipse cx="${n(localX)}" cy="${n(localY)}" rx="${n(radiusX)}" ry="${n(radiusY)}" fill="#ffffff" opacity="${n(baseAlpha)}"/>`;
  }

  markup += `</g>`;
  return markup;
}

// ─── Scene family SVG serialization ──────────────────────────────────

function serializePointFieldSvg(
  pointField: PointField,
  getStyle: (point: PointRecord, index: number) => { color: string; alpha: number; radiusPx: number },
  heightPx: number
): string {
  let markup = "";
  pointField.points.forEach((point, index) => {
    const style = getStyle(point, index);
    if (style.alpha <= 0 || style.radiusPx <= 0) return;
    const svgY = heightPx - point.position.y;
    markup += svgCircle(point.position.x, svgY, style.radiusPx, style.color, style.alpha);
  });
  return markup;
}

function serializePhyllotaxisSvg(
  state: PhyllotaxisSceneFamilyPreviewState,
  heightPx: number
): string {
  const count = state.pointField.points.length;
  return serializePointFieldSvg(state.pointField, (point, index) => {
    const pointRadius = Number(point.attributes.philo_radius ?? 0);
    const normalizedRadius = state.maxRadiusPx <= 0
      ? (count <= 1 ? 0 : index / Math.max(1, count - 1))
      : clamp(pointRadius / state.maxRadiusPx, 0, 1);
    return {
      color: "#ffffff",
      alpha: 0.96,
      radiusPx: 0.95 + normalizedRadius * 2.2
    };
  }, heightPx);
}

function serializeScatterSvg(
  state: ScatterSceneFamilyPreviewState,
  heightPx: number
): string {
  const count = state.pointField.points.length;
  return serializePointFieldSvg(state.pointField, (point, index) => {
    const densityWeight = Number(point.attributes.scatter_density_weight ?? 0.8);
    return {
      color: "#ffffff",
      alpha: 0.42 + densityWeight * 0.5,
      radiusPx: clamp(1.1 + densityWeight * 2.4, 1.1, 3.8)
    };
  }, heightPx);
}

function normalizeColor(color: ColorRgba | string | undefined): string {
  if (!color) return "#ffffff";
  if (typeof color === "string") return color;
  return colorRgbaToHex(color);
}

function serializeFuzzyBoidsSvg(
  state: CpuFuzzyBoidsSceneFamilyPreviewState,
  heightPx: number
): string {
  const radiusPx = Math.max(0.5, state.dotSizePx);
  let markup = "";
  state.boidField.boids.forEach((boid, index) => {
    const point = state.pointField.points[index];
    if (!point) return;
    if (!Boolean(boid.attributes.boid_active)) return;
    const color = normalizeColor(boid.attributes.color as ColorRgba | undefined);
    const svgY = heightPx - point.position.y;
    markup += svgCircle(point.position.x, svgY, radiusPx, color, 1);
  });
  return markup;
}

function serializeWorkerFuzzyBoidsSvg(
  state: WorkerFuzzyBoidsSceneFamilyPreviewState,
  heightPx: number
): string {
  const { positionsPx, activeMask, boidCount } = state.workerSnapshot;
  const radiusPx = Math.max(0.5, state.dotSizePx);
  let markup = "";
  for (let index = 0; index < boidCount; index++) {
    if (!activeMask[index]) continue;
    const offset = index * 2;
    const x = positionsPx[offset];
    const y = heightPx - positionsPx[offset + 1];
    markup += svgCircle(x, y, radiusPx, "#ffffff", 1);
  }
  return markup;
}

function serializeSceneFamilyLayer(
  previewState: SceneFamilyPreviewState,
  heightPx: number
): string {
  let inner = "";
  switch (previewState.sceneFamilyKey) {
    case "phyllotaxis":
      inner = serializePhyllotaxisSvg(previewState, heightPx);
      break;
    case "scatter":
      inner = serializeScatterSvg(previewState as ScatterSceneFamilyPreviewState, heightPx);
      break;
    case "fuzzy-boids":
      if ("simulationBackend" in previewState) {
        if (previewState.simulationBackend === "cpu") {
          inner = serializeFuzzyBoidsSvg(previewState as CpuFuzzyBoidsSceneFamilyPreviewState, heightPx);
        } else if (previewState.simulationBackend === "cpu-worker") {
          inner = serializeWorkerFuzzyBoidsSvg(previewState as WorkerFuzzyBoidsSceneFamilyPreviewState, heightPx);
        }
        // GPU boids have no CPU geometry — cannot serialize to SVG
      }
      break;
  }
  return inner ? `<g class="scene-family">${inner}</g>` : "";
}

// ─── Main API ─────────────────────────────────────────────────────────

export function serializeHaloSvgDocument(
  input: HaloSvgInput,
  options: SvgDocumentOptions
): string {
  const { sceneDescriptor } = input;
  const { widthPx, heightPx, transparentBackground } = options;
  const config = sceneDescriptor.haloConfig;
  const mascotBox = sceneDescriptor.mascotBox;
  const frameState = sceneDescriptor.frameState;
  const bgColor = config.composition.background_color || "#202020";
  const stageMinDimPx = Math.min(widthPx, heightPx);

  // Rebuild intro field and runtime points (same as halo-renderer.ts ensureSceneData)
  const introField = buildIntroHaloFieldState(config, mascotBox);
  const runtimePoints = buildRuntimePoints(config, introField, sceneDescriptor.runtimeTiming);

  const fullFrameR = frameState.fullFrameOuterRadiusPx;
  const screensaverFieldState = frameState.screensaverFieldState;
  const haloOuterR = frameState.haloOuterRadiusPx;
  const spokes = screensaverFieldState?.spokes ?? introField?.spokes ?? [];
  const visibleSpokeCount = screensaverFieldState?.visible_spoke_count
    ?? introField?.visible_spoke_count ?? 0;
  const reveal = frameState.reveal as HaloRevealState | null;
  const sceneBaseAlpha = clamp(frameState.mascotMotion.mascotFadeU, 0, 1);

  // Build SVG layers in render order
  let body = "";
  let defs = "";

  // Background
  if (!transparentBackground) {
    body += `<rect width="${widthPx}" height="${heightPx}" fill="${bgColor}"/>`;
  }

  // 1. Background construction spokes
  const bgSpokes = serializeBackgroundSpokes(spokes, fullFrameR, config, heightPx);
  defs += bgSpokes.defs;
  body += bgSpokes.markup;

  // 2. Dots
  if (screensaverFieldState) {
    body += serializePostFinalePoints(screensaverFieldState, config, heightPx);
  } else {
    body += serializeIntroPoints(
      runtimePoints, frameState.dotTimeSec, frameState.isDotComplete,
      config, sceneDescriptor.runtimeTiming, heightPx
    );
  }

  // 3. Thin spokes + thick spokes + echo markers
  body += serializeHaloSpokesAndEchoes(
    spokes, visibleSpokeCount, mascotBox,
    haloOuterR, fullFrameR, config,
    sceneBaseAlpha, reveal, heightPx, stageMinDimPx
  );

  // 4. Release labels
  body += serializeReleaseLabels(
    spokes, mascotBox, haloOuterR, fullFrameR, config,
    sceneBaseAlpha, reveal, heightPx, stageMinDimPx
  );

  // 5. Mascot
  body += serializeMascotOverlay(
    sceneDescriptor, heightPx,
    options.mascotFaceSvgMarkup ?? null,
    options.mascotHaloSvgMarkup ?? null
  );

  // 6. Authored overlay
  if (options.overlayMarkup) {
    body += unwrapOverlaySvg(options.overlayMarkup);
  }

  const fullBody = defs ? `<defs>${defs}</defs>\n` + body : body;
  return wrapSvgDocument(fullBody, widthPx, heightPx);
}

export function serializeSceneFamilySvgDocument(
  input: SceneFamilySvgInput,
  options: SvgDocumentOptions
): string {
  const { widthPx, heightPx, transparentBackground } = options;
  let body = "";

  if (!transparentBackground) {
    body += `<rect width="${widthPx}" height="${heightPx}" fill="${input.backgroundColor}"/>`;
  }

  body += serializeSceneFamilyLayer(input.previewState, heightPx);

  if (options.overlayMarkup) {
    body += unwrapOverlaySvg(options.overlayMarkup);
  }

  return wrapSvgDocument(body, widthPx, heightPx);
}

function wrapSvgDocument(body: string, widthPx: number, heightPx: number): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
    `  viewBox="0 0 ${widthPx} ${heightPx}" width="${widthPx}" height="${heightPx}">`,
    body,
    `</svg>`
  ].join("\n");
}

// ─── Asset loading helpers ────────────────────────────────────────────

export async function loadSvgAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read blob"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function loadSvgMarkup(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}
