/**
 * operator-halo-field — Faithful port of racoon-anim halo-field.js
 *
 * Computes the spoke × orbit dot‐grid state used by the Three.js renderer.
 * All numeric constants match the reference defaults for landscape_1280x720.
 */

import type { OperatorParameterSchema } from "@brand-layout-ops/core-types";
import { getOutputProfileMetrics } from "@brand-layout-ops/core-types";

// ─── Math helpers (ported from config-schema.js) ──────────────────────
export const TAU = Math.PI * 2;
export const COMPOSITION_SIZE_PX = 600;
export const MASCOT_VIEWBOX_SIZE = 600;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function radians(deg: number): number {
  return deg * Math.PI / 180;
}

export function wrapPositive(value: number, modulus: number): number {
  const w = value % modulus;
  return w < 0 ? w + modulus : w;
}

export function hash01(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function computeFrontierScale(
  distanceU: number,
  amount: number,
  widthU: number,
  bias: number,
  minScale = 0
): number {
  const safeWidth = Math.max(0.0001, widthU);
  const safeBias = Math.max(0.001, bias);
  const frontierU = Math.pow(smoothstep(0, safeWidth, distanceU), safeBias);
  return Math.max(minScale, 1 - amount * (1 - frontierU));
}

// ─── Types ────────────────────────────────────────────────────────────

export interface HaloFieldConfig {
  mascot_fade: {
    enabled: boolean;
    duration_sec: number;
  };
  head_turn: {
    enabled: boolean;
    duration_sec: number;
    peak_angle_deg: number;
    reverse_angle_deg: number;
    overshoot_angle_deg: number;
    peak_frac: number;
    reverse_frac: number;
    dot_overlap_sec: number;
    overshoot_frac: number;
  };
  blink: {
    enabled: boolean;
    start_delay_sec: number;
    duration_sec: number;
    close_frac: number;
    hold_closed_frac: number;
    eye_scale_y_closed: number;
  };
  sneeze: {
    enabled: boolean;
    nose_bob_up_px: number;
  };
  composition: {
    center_x_px: number;
    center_y_px: number;
    center_offset_y_px: number;
    scale: number;
    radial_scale: number;
    global_rotation_deg: number;
    background_color: string;
  };
  generator_wrangle: {
    inner_radius: number;
    outer_radius: number;
    num_orbits: number;
    spoke_count: number;
    phase_count: number;
    min_active_orbits: number;
    base_angle_deg: number;
    pattern_offset_spokes: number;
    anim_start_angle_deg?: number;
  };
  transition_wrangle: {
    base_pscale: number;
    orbital_frontier_amount: number;
    orbital_frontier_width_u: number;
    orbital_frontier_bias: number;
    phase_frontier_amount: number;
    phase_frontier_width_u: number;
    phase_frontier_bias: number;
    alpha_ramp_duration_sec: number;
    hide_invisible_by_pscale: boolean;
    duration_sec: number;
    spins: number;
    emit_frac: number;
    capture_start_frac: number;
    orbit_stagger_frac: number;
    speed_mult_per_orbit: number;
    inner_faster: boolean;
    spawn_angle_offset_deg: number;
    occlusion_arc_deg?: number;
    animate_orbit_count: boolean;
    orbit_count_start_frac: number;
    orbit_count_end_frac: number;
  };
  point_style: {
    color: string;
    alpha: number;
    base_pscale_px_per_unit: number;
    min_scale: number;
    min_diameter_px: number;
  };
  spoke_lines: {
    enabled: boolean;
    width_px: number;
    color: string;
    reference_color: string;
    construction_color: string;
    echo_color: string;
    echo_count: number;
    echo_style: string;
    echo_shape_seed: number;
    echo_mix_shape_pct: number;
    echo_width_mult: number;
    echo_wave_count: number;
    echo_opacity_mult: number;
    echo_marker_stroke_px: number;
    echo_marker_scale_mult: number;
    echo_sparse_scale_boost: number;
    echo_spacing_offset_px: number;
    phase_start_width_px: number;
    phase_end_width_px: number;
    start_radius_px: number;
    content_clearance_px: number;
    show_reference_halo: boolean;
    show_debug_masks: boolean;
  };
  spoke_text?: {
    enabled: boolean;
    font_size_px: number;
    radial_u: number;
  };
  screensaver?: {
    cycle_sec: number;
    pulse_orbits: boolean;
    pulse_spokes: boolean;
    min_spoke_count: number;
    ramp_in_sec?: number;
    phase_boundary_transition_sec: number;
  };
  finale?: {
    enabled: boolean;
    delay_after_dots_sec: number;
    duration_sec: number;
    start_angle_deg: number;
    mask_angle_offset_deg?: number;
    halo_inner_radius_u: number;
  };
  vignette?: {
    enabled: boolean;
    shape_fade: number;
    shape_fade_start: number;
    shape_fade_end: number;
  };
}

/**
 * Schema-driven parameter definition for the halo-field config panel.
 * Maps 1:1 to the controls in the previous handcoded halo-config-section.
 */
export const HALO_FIELD_CONFIG_SCHEMA: OperatorParameterSchema = {
  sections: [
    { key: "composition", title: "Composition" },
    { key: "generator", title: "Generator" },
    { key: "angles", title: "Angles" },
    { key: "colors", title: "Colors" },
    { key: "spokeDetails", title: "Spoke Details" },
    { key: "content", title: "Spoke Content" },
    { key: "echoDetails", title: "Echo Shape Details" },
    { key: "echoPattern", title: "Echo Pattern" },
    { key: "screensaver", title: "Screensaver / Breath" },
    { key: "motionToggles", title: "Motion Toggles" },
    { key: "motionTiming", title: "Motion Timing" },
    { key: "finaleMotion", title: "Finale & Nose" },
    { key: "headTurn", title: "Head Turn" },
    { key: "motionCurve", title: "Motion Curve" },
    { key: "blinkCurve", title: "Blink Curve" },
    { key: "toggles", title: "Screensaver Toggles" },
    { key: "debug", title: "Debug" }
  ],
  fields: [
    // ── Composition ─────────────────────────────────────────────
    { path: "composition.scale", label: "Scale", kind: "slider", sectionKey: "composition", min: 0.1, max: 2, step: 0.01 },
    { path: "composition.radial_scale", label: "Radial Scale", kind: "slider", sectionKey: "composition", min: 0.1, max: 2, step: 0.01 },
    { path: "composition.center_offset_y_px", label: "Center Y Offset", kind: "slider", sectionKey: "composition", min: -500, max: 500, step: 1 },
    { path: "generator_wrangle.inner_radius", label: "Orbit Inner Radius", kind: "slider", sectionKey: "composition", min: 0, max: 1, step: 0.001 },
    { path: "generator_wrangle.outer_radius", label: "Halo Outer Radius", kind: "slider", sectionKey: "composition", min: 0, max: 1, step: 0.001 },

    // ── Generator ───────────────────────────────────────────────
    { path: "generator_wrangle.spoke_count", label: "Spokes", kind: "number", sectionKey: "generator", min: 4, max: 120, step: 1 },
    { path: "generator_wrangle.num_orbits", label: "Orbits", kind: "number", sectionKey: "generator", min: 1, max: 16, step: 1 },
    { path: "generator_wrangle.min_active_orbits", label: "Min Active Orbits", kind: "number", sectionKey: "generator", min: 1, max: 16, step: 1 },
    { path: "generator_wrangle.phase_count", label: "Phase Count", kind: "number", sectionKey: "generator", min: 1, max: 6, step: 1 },

    // ── Angles & Spoke Geometry ─────────────────────────────────
    { path: "generator_wrangle.base_angle_deg", label: "Base Angle", kind: "slider", sectionKey: "angles", min: -180, max: 180, step: 0.1 },
    { path: "generator_wrangle.pattern_offset_spokes", label: "Pattern Offset", kind: "number", sectionKey: "angles", min: -120, max: 120, step: 1 },

    // ── Colors ──────────────────────────────────────────────────
    { path: "composition.background_color", label: "Background", kind: "color", sectionKey: "colors" },
    { path: "point_style.color", label: "Dot Color", kind: "color", sectionKey: "colors" },
    { path: "spoke_lines.construction_color", label: "Construction", kind: "color", sectionKey: "colors" },
    { path: "spoke_lines.reference_color", label: "Reference", kind: "color", sectionKey: "colors" },
    { path: "spoke_lines.color", label: "Spoke Color", kind: "color", sectionKey: "colors" },
    { path: "spoke_lines.echo_color", label: "Echo Color", kind: "color", sectionKey: "colors" },

    // ── Spoke Details ───────────────────────────────────────────
    { path: "spoke_lines.width_px", label: "Spoke Width", kind: "slider", sectionKey: "spokeDetails", min: 0, max: 16, step: 0.5 },
    { path: "spoke_lines.start_radius_px", label: "Spoke Line Start", kind: "slider", sectionKey: "spokeDetails", min: 0, max: 400, step: 1 },
    { path: "spoke_lines.echo_count", label: "Echo Count", kind: "number", sectionKey: "spokeDetails", min: 0, max: 32, step: 1 },
    { path: "spoke_lines.echo_style", label: "Echo Style", kind: "select", sectionKey: "spokeDetails", options: [
      { label: "Mixed", value: "mixed" },
      { label: "Dots", value: "dots" },
      { label: "Plus", value: "plus" },
      { label: "Triangles", value: "triangles" },
      { label: "Diamond", value: "diamond" },
      { label: "Star", value: "star" },
      { label: "Hexagon", value: "hexagon" },
      { label: "Radial Dash", value: "radial_dash" }
    ] },
    { path: "spoke_lines.phase_start_width_px", label: "Phase Width", kind: "slider", sectionKey: "spokeDetails", min: 0, max: 32, step: 1 },

    // ── Shared Spoke Content ───────────────────────────────────
    { path: "spoke_lines.content_clearance_px", label: "Content Clearance", kind: "slider", sectionKey: "content", min: 0, max: 200, step: 1 },
    { path: "spoke_lines.echo_spacing_offset_px", label: "Echo Gap", kind: "slider", sectionKey: "content", min: 0, max: 64, step: 0.5 },
    { path: "spoke_text.font_size_px", label: "Label Size", kind: "slider", sectionKey: "content", min: 3, max: 24, step: 0.5, visibleWhen: { path: "spoke_text.enabled", operator: "eq", value: true } },

    // ── Echo Shape Details ──────────────────────────────────────
    { path: "spoke_lines.phase_end_width_px", label: "Phase End Width", kind: "slider", sectionKey: "echoDetails", min: 0, max: 32, step: 1 },
    { path: "spoke_lines.echo_marker_stroke_px", label: "Echo Stroke", kind: "slider", sectionKey: "echoDetails", min: 0, max: 12, step: 0.5 },
    { path: "spoke_lines.echo_marker_scale_mult", label: "Echo Scale", kind: "slider", sectionKey: "echoDetails", min: 0.1, max: 6, step: 0.1 },
    { path: "spoke_lines.echo_sparse_scale_boost", label: "Sparse Boost", kind: "slider", sectionKey: "echoDetails", min: 0, max: 6, step: 0.1 },

    // ── Echo Pattern ────────────────────────────────────────────
    { path: "spoke_lines.echo_shape_seed", label: "Shape Seed", kind: "number", sectionKey: "echoPattern", min: 0, max: 9999, step: 1 },
    { path: "spoke_lines.echo_mix_shape_pct", label: "Mix Shape %", kind: "slider", sectionKey: "echoPattern", min: 0, max: 1, step: 0.01 },
    { path: "spoke_lines.echo_wave_count", label: "Ripple Count", kind: "slider", sectionKey: "echoPattern", min: 0, max: 12, step: 1 },
    { path: "spoke_lines.echo_opacity_mult", label: "Echo Fade", kind: "slider", sectionKey: "echoPattern", min: 0, max: 1, step: 0.01 },

    // ── Screensaver / Breath ────────────────────────────────────
    { path: "screensaver.cycle_sec", label: "Breath Cycle", kind: "slider", sectionKey: "screensaver", min: 0, max: 60, step: 0.1 },
    { path: "screensaver.ramp_in_sec", label: "Breath Ramp In", kind: "slider", sectionKey: "screensaver", min: 0, max: 60, step: 0.1 },
    { path: "screensaver.min_spoke_count", label: "Min Spokes", kind: "slider", sectionKey: "screensaver", min: 1, max: 180, step: 1 },
    { path: "screensaver.phase_boundary_transition_sec", label: "Boundary Ease", kind: "slider", sectionKey: "screensaver", min: 0, max: 1.5, step: 0.01 },

    // ── Motion Toggles ──────────────────────────────────────────
    { path: "mascot_fade.enabled", label: "Mascot Fade", kind: "boolean", sectionKey: "motionToggles" },
    { path: "head_turn.enabled", label: "Head Turn", kind: "boolean", sectionKey: "motionToggles" },
    { path: "blink.enabled", label: "Closing Blink", kind: "boolean", sectionKey: "motionToggles" },
    { path: "finale.enabled", label: "Finale Sweep", kind: "boolean", sectionKey: "motionToggles" },

    // ── Motion Timing ───────────────────────────────────────────
    { path: "mascot_fade.duration_sec", label: "Fade Duration", kind: "slider", sectionKey: "motionTiming", min: 0, max: 3, step: 0.01 },
    { path: "head_turn.duration_sec", label: "Head Turn Duration", kind: "slider", sectionKey: "motionTiming", min: 0, max: 1, step: 0.01 },
    { path: "head_turn.dot_overlap_sec", label: "Dot Overlap", kind: "slider", sectionKey: "motionTiming", min: 0, max: 1, step: 0.01 },
    { path: "blink.start_delay_sec", label: "Blink Delay", kind: "slider", sectionKey: "motionTiming", min: 0, max: 1, step: 0.01 },

    // ── Finale & Nose ───────────────────────────────────────────
    { path: "finale.delay_after_dots_sec", label: "Finale Delay", kind: "slider", sectionKey: "finaleMotion", min: 0, max: 4, step: 0.01 },
    { path: "finale.duration_sec", label: "Finale Duration", kind: "slider", sectionKey: "finaleMotion", min: 0, max: 6, step: 0.01 },
    { path: "blink.duration_sec", label: "Blink Duration", kind: "slider", sectionKey: "finaleMotion", min: 0, max: 1, step: 0.01 },
    { path: "sneeze.nose_bob_up_px", label: "Nose Bob", kind: "slider", sectionKey: "finaleMotion", min: 0, max: 20, step: 0.1 },

    // ── Head Turn ───────────────────────────────────────────────
    { path: "head_turn.peak_angle_deg", label: "Peak Angle", kind: "slider", sectionKey: "headTurn", min: -90, max: 90, step: 0.1 },
    { path: "head_turn.reverse_angle_deg", label: "Reverse Angle", kind: "slider", sectionKey: "headTurn", min: -90, max: 90, step: 0.1 },
    { path: "head_turn.overshoot_angle_deg", label: "Overshoot Angle", kind: "slider", sectionKey: "headTurn", min: -90, max: 90, step: 0.1 },
    { path: "sneeze.enabled", label: "Loop Sneeze", kind: "boolean", sectionKey: "headTurn" },

    // ── Motion Curve ────────────────────────────────────────────
    { path: "head_turn.peak_frac", label: "Peak Timing", kind: "slider", sectionKey: "motionCurve", min: 0, max: 1, step: 0.01 },
    { path: "head_turn.reverse_frac", label: "Reverse Timing", kind: "slider", sectionKey: "motionCurve", min: 0, max: 1, step: 0.01 },
    { path: "head_turn.overshoot_frac", label: "Overshoot Timing", kind: "slider", sectionKey: "motionCurve", min: 0, max: 1, step: 0.01 },
    { path: "blink.eye_scale_y_closed", label: "Closed Eye Scale", kind: "slider", sectionKey: "motionCurve", min: 0, max: 1, step: 0.01 },

    // ── Blink Curve ─────────────────────────────────────────────
    { path: "blink.close_frac", label: "Blink Close", kind: "slider", sectionKey: "blinkCurve", min: 0, max: 1, step: 0.01 },
    { path: "blink.hold_closed_frac", label: "Hold Closed", kind: "slider", sectionKey: "blinkCurve", min: 0, max: 1, step: 0.01 },

    // ── Screensaver Toggles ─────────────────────────────────────
    { path: "screensaver.pulse_orbits", label: "Pulse Orbits", kind: "boolean", sectionKey: "toggles" },
    { path: "screensaver.pulse_spokes", label: "Pulse Spokes", kind: "boolean", sectionKey: "toggles" },
    { path: "vignette.enabled", label: "Construction Fade", kind: "boolean", sectionKey: "toggles" },
    { path: "spoke_text.enabled", label: "Release Labels", kind: "boolean", sectionKey: "toggles" },

    // ── Debug ───────────────────────────────────────────────────
    { path: "spoke_lines.show_reference_halo", label: "Reference Halo", kind: "boolean", sectionKey: "debug" },
    { path: "spoke_lines.show_debug_masks", label: "Debug Masks", kind: "boolean", sectionKey: "debug" }
  ]
};

export interface MascotBox {
  center_x_px: number;
  center_y_px: number;
  draw_size_px: number;
}

export interface EchoDot {
  radius_px: number;
}

export interface PointSpec {
  spoke_id: number;
  target_angle: number;
  orbit_id: number;
  radius: number;
  x: number;
  y: number;
  diameter_px: number;
  radius_px: number;
}

export interface Spoke {
  source_spoke_id: number;
  display_slot_id: number;
  label_slot_id: number;
  spoke_pattern_id: number;
  angle: number;
  alpha?: number;
  phase_u: number;
  width_phase_u?: number;
  seam_overlay_only?: boolean;
  start_radius: number;
  echo_dot_origin_radius: number;
  echo_dot_step_px: number;
  echo_dots: EchoDot[];
  inner_clip_offset_px: number;
  inner_clip_center_x_px: number;
  inner_clip_center_y_px: number;
  phase_clip_radius_px: number;
  phase_field_radius_px: number;
}

export interface IntroFieldState {
  box: MascotBox | null;
  geometry_scale: number;
  orbit_counts: number[];
  max_orbit_count: number;
  point_specs: PointSpec[];
  spokes: Spoke[];
  visible_spoke_count: number;
}

/** Per-point animation data for the spiral intro. */
export interface RuntimePoint {
  center_x_px: number;
  center_y_px: number;
  radius: number;
  target_angle: number;
  orbit_id: number;
  speed_rad_per_sec: number;
  birth_sec: number;
  visible_sec: number;
  capture_start_sec: number;
  diameter_px: number;
  radius_px: number;
}

/** Timeline milestones for the 3-phase sequence. */
export interface RuntimeTiming {
  start_delay_sec: number;
  dot_end_sec: number;
  finale_start_sec: number;
  finale_end_sec: number;
  playback_end_sec: number;
  spawn_angle_rad: number;
}

export interface PostFinaleFieldState {
  box: MascotBox | null;
  points: Array<{ x: number; y: number; radius_px: number; alpha: number }>;
  spokes: Spoke[];
  visible_spoke_count: number;
  halo_outer_radius_px: number;
  full_frame_outer_radius_px: number;
  next_spoke_width_phase_u_by_source: Map<number, number>;
  next_spoke_clip_center_x_by_source: Map<number, number>;
  spoke_width_transition_playback_time_sec: number;
}

// ─── Phase metrics ────────────────────────────────────────────────────

interface PhaseMetrics {
  fill_u: number;
  phase_frontier_u: number;
  phase_mask_center_x_px: number;
}

export function getDisplayPhaseMetrics(
  angleRad: number,
  baseAngleRad: number,
  slotCount: number,
  phaseCount: number,
  spokePatternId: number,
  centerXPx: number,
  phaseMaskCenterOffsetXPx: number
): PhaseMetrics {
  if (phaseCount !== 2) {
    const segmentId = Math.min(
      phaseCount - 1,
      Math.floor(spokePatternId * phaseCount / slotCount)
    );
    const segStart = Math.floor(segmentId * slotCount / phaseCount);
    const segEnd = Math.floor((segmentId + 1) * slotCount / phaseCount) - 1;
    const segLen = Math.max(1, segEnd - segStart + 1);
    const segIdx = spokePatternId - segStart;
    const fillU = segLen <= 1 ? 1 : segIdx / (segLen - 1);
    return {
      fill_u: fillU,
      phase_frontier_u: fillU,
      phase_mask_center_x_px:
        segmentId === 0
          ? centerXPx - phaseMaskCenterOffsetXPx
          : centerXPx + phaseMaskCenterOffsetXPx
    };
  }

  const displayU = wrapPositive(angleRad - baseAngleRad, TAU) / TAU;
  const isUpper = displayU > 0 && displayU <= 0.5;
  const fillU = isUpper
    ? displayU / 0.5
    : (displayU > 0.5 ? (displayU - 0.5) / 0.5 : 1);
  return {
    fill_u: fillU,
    phase_frontier_u: fillU,
    phase_mask_center_x_px: isUpper
      ? centerXPx - phaseMaskCenterOffsetXPx
      : centerXPx + phaseMaskCenterOffsetXPx
  };
}

export function getPhaseMaskGeometry(
  box: MascotBox | null,
  centerXPx: number,
  centerYPx: number,
  outerRadiusPx: number
) {
  const geometryScale = box ? box.draw_size_px / MASCOT_VIEWBOX_SIZE : 1;
  const legacyRadiusPx = 250 * geometryScale;
  const haloClearRadiusPx = Math.max(
    0,
    outerRadiusPx || 0,
    box ? box.draw_size_px * 0.5 : 0
  );
  const fieldRadiusPx = Math.max(legacyRadiusPx, haloClearRadiusPx + 4 * geometryScale);
  const centerOffsetXPx = 50 * geometryScale;
  return {
    legacy_radius_px: legacyRadiusPx,
    field_radius_px: fieldRadiusPx,
    center_offset_x_px: centerOffsetXPx,
    center_y_px: centerYPx,
    left_center_x_px: centerXPx - centerOffsetXPx,
    right_center_x_px: centerXPx + centerOffsetXPx
  };
}

function getWidthTransitionPhaseMetrics(
  angleRad: number,
  baseAngleRad: number,
  slotCount: number,
  phaseCount: number,
  spokePatternId: number,
  centerXPx: number,
  phaseMaskCenterOffsetXPx: number
): PhaseMetrics {
  const pm = getDisplayPhaseMetrics(
    angleRad, baseAngleRad, slotCount, phaseCount,
    spokePatternId, centerXPx, phaseMaskCenterOffsetXPx
  );
  if (phaseCount !== 2 || slotCount <= 1) return pm;

  const spokeSlotU = 1 / slotCount;
  const displayU = wrapPositive(angleRad - baseAngleRad, TAU) / TAU;
  if (!(displayU > 0 && displayU < spokeSlotU * 3)) return pm;

  const skew = 1 - smoothstep(spokeSlotU, spokeSlotU * 3, displayU);
  if (skew <= 0) return pm;

  const skewedU = clamp(displayU + spokeSlotU * skew, 0, 0.5);
  const skewedAngle = baseAngleRad + TAU * skewedU;
  return getDisplayPhaseMetrics(
    skewedAngle, baseAngleRad, slotCount, phaseCount,
    spokePatternId, centerXPx, phaseMaskCenterOffsetXPx
  );
}

// ─── Field base context ───────────────────────────────────────────────

interface FieldBaseContext {
  generator: HaloFieldConfig["generator_wrangle"];
  transition: HaloFieldConfig["transition_wrangle"];
  center_x_px: number;
  center_y_px: number;
  geometry_scale: number;
  inner_radius_px: number;
  outer_radius_px: number;
  radius_span_px: number;
  base_pscale_px: number;
  min_diameter_px: number;
  point_style_min_scale: number;
  phase_mask_legacy_radius_px: number;
  phase_mask_field_radius_px: number;
  phase_mask_center_offset_x_px: number;
  use_reference_phase_masks: boolean;
  base_angle_rad: number;
}

function getClampedSpokeLineStartRadiusPx(
  config: HaloFieldConfig,
  ctx: FieldBaseContext
): number {
  return clamp(
    config.spoke_lines.start_radius_px * ctx.geometry_scale,
    0,
    ctx.outer_radius_px
  );
}

function createFieldBase(config: HaloFieldConfig, mascotBox: MascotBox | null): FieldBaseContext {
  const gen = config.generator_wrangle;
  const trans = config.transition_wrangle;
  const cx = config.composition.center_x_px;
  const cy = config.composition.center_y_px;
  const radialScale = config.composition.radial_scale;
  const rotationRad = radians(config.composition.global_rotation_deg || 0);
  const geoScale = mascotBox ? mascotBox.draw_size_px / MASCOT_VIEWBOX_SIZE : 1;
  const innerPx = COMPOSITION_SIZE_PX * radialScale * gen.inner_radius * geoScale;
  const outerPx = COMPOSITION_SIZE_PX * radialScale * gen.outer_radius * geoScale;
  const span = Math.max(0, outerPx - innerPx);
  const basePscalePx = trans.base_pscale * config.point_style.base_pscale_px_per_unit * geoScale;
  const minDiaPx = (config.point_style.min_diameter_px ?? 0.9) * geoScale;
  const pm = getPhaseMaskGeometry(mascotBox, cx, cy, outerPx);

  return {
    generator: gen,
    transition: trans,
    center_x_px: cx,
    center_y_px: cy,
    geometry_scale: geoScale,
    inner_radius_px: innerPx,
    outer_radius_px: outerPx,
    radius_span_px: span,
    base_pscale_px: basePscalePx,
    min_diameter_px: minDiaPx,
    point_style_min_scale: config.point_style.min_scale,
    phase_mask_legacy_radius_px: pm.legacy_radius_px,
    phase_mask_field_radius_px: pm.field_radius_px,
    phase_mask_center_offset_x_px: pm.center_offset_x_px,
    use_reference_phase_masks: gen.phase_count === 2,
    base_angle_rad: radians(gen.base_angle_deg) + rotationRad
  };
}

// ─── Phase state for a single angle ──────────────────────────────────

function getPhaseStateForAngle(
  angleRad: number,
  ctx: FieldBaseContext,
  spokePatternId: number
) {
  const pm = getDisplayPhaseMetrics(
    angleRad,
    ctx.base_angle_rad,
    ctx.generator.spoke_count,
    ctx.generator.phase_count,
    spokePatternId,
    ctx.center_x_px,
    ctx.phase_mask_center_offset_x_px
  );
  return {
    fill_u: pm.fill_u,
    phase_frontier_scale: computeFrontierScale(
      pm.phase_frontier_u,
      ctx.transition.phase_frontier_amount,
      ctx.transition.phase_frontier_width_u,
      ctx.transition.phase_frontier_bias,
      ctx.point_style_min_scale
    ),
    phase_mask_center_x_px: pm.phase_mask_center_x_px
  };
}

// ─── Build spoke-orbit intersection points ────────────────────────────

function buildSpokeOrbitPoints(
  ctx: FieldBaseContext,
  angleRad: number,
  clipCenterXPx: number,
  fillEndRadiusPx: number,
  reachU: number,
  phaseFrontierScale: number,
  orbitCount: number,
  orbitStepPx: number,
  maxOrbitIndex: number
) {
  const pointSpecs: Array<{
    orbit_id: number;
    radius: number;
    x: number;
    y: number;
    diameter_px: number;
    radius_px: number;
  }> = [];
  const echoDots: EchoDot[] = [];

  for (let oi = 0; oi <= maxOrbitIndex; oi++) {
    const rPx = ctx.inner_radius_px + oi * orbitStepPx;
    if (rPx > ctx.outer_radius_px + 0.01) break;

    const orbitU = ctx.radius_span_px <= 0
      ? 0
      : clamp((rPx - ctx.inner_radius_px) / Math.max(0.0001, ctx.radius_span_px), 0, 1);
    const px = ctx.center_x_px + Math.cos(angleRad) * rPx;
    const py = ctx.center_y_px + Math.sin(angleRad) * rPx;
    const orbitalFS = computeFrontierScale(
      Math.max(0, reachU - orbitU),
      ctx.transition.orbital_frontier_amount,
      ctx.transition.orbital_frontier_width_u,
      ctx.transition.orbital_frontier_bias,
      ctx.point_style_min_scale
    );
    const diaPx = Math.max(ctx.min_diameter_px, ctx.base_pscale_px * orbitalFS * phaseFrontierScale);
    const dotR = diaPx * 0.5;

    const pmDist = Math.hypot(px - clipCenterXPx, py - ctx.center_y_px);
    const fits = ctx.use_reference_phase_masks
      ? pmDist + dotR <= ctx.phase_mask_legacy_radius_px + 0.01
      : rPx + dotR <= fillEndRadiusPx + 0.01;

    if (!fits) continue;

    echoDots.push({ radius_px: dotR });
    pointSpecs.push({
      orbit_id: oi,
      radius: rPx,
      x: px,
      y: py,
      diameter_px: diaPx,
      radius_px: dotR
    });
  }
  return { point_specs: pointSpecs, echo_dots: echoDots };
}

// ─── Build intro halo field state ─────────────────────────────────────

export function buildIntroHaloFieldState(
  config: HaloFieldConfig,
  mascotBox: MascotBox | null
): IntroFieldState {
  const ctx = createFieldBase(config, mascotBox);
  const gen = ctx.generator;
  const orbitStepPx = gen.num_orbits <= 1 ? 0 : ctx.radius_span_px / (gen.num_orbits - 1);
  const maxOrbitIdx = Math.max(0, gen.num_orbits - 1);
  const spokes: Spoke[] = new Array(gen.spoke_count);
  const pointSpecs: PointSpec[] = [];
  const orbitCounts = new Array(gen.num_orbits).fill(0);
  const labelAnchorSlot = Math.floor(gen.spoke_count * 0.5);
  const spokeLineStartRadiusPx = getClampedSpokeLineStartRadiusPx(config, ctx);

  for (let si = 0; si < gen.spoke_count; si++) {
    const spid = wrapPositive(si - gen.pattern_offset_spokes, gen.spoke_count);
    const angle = ctx.base_angle_rad + TAU * si / gen.spoke_count;
    const ps = getPhaseStateForAngle(angle, ctx, spid);
    const contActive = clamp(
      gen.min_active_orbits + ps.fill_u * (gen.num_orbits - gen.min_active_orbits),
      gen.min_active_orbits,
      gen.num_orbits
    );
    const reachU = gen.num_orbits <= 1 ? 1 : (contActive - 1) / (gen.num_orbits - 1);
    const fillEndR = ctx.inner_radius_px + ctx.radius_span_px * reachU;
    const sp = buildSpokeOrbitPoints(
      ctx, angle, ps.phase_mask_center_x_px, fillEndR,
      reachU, ps.phase_frontier_scale,
      gen.num_orbits, orbitStepPx, maxOrbitIdx
    );

    spokes[si] = {
      source_spoke_id: wrapPositive(Math.round(gen.spoke_count * 0.5) - si, gen.spoke_count),
      display_slot_id: si,
      label_slot_id: wrapPositive(labelAnchorSlot - si, gen.spoke_count),
      spoke_pattern_id: spid,
      angle,
      phase_u: ps.fill_u,
      start_radius: spokeLineStartRadiusPx,
      echo_dot_origin_radius: ctx.inner_radius_px,
      echo_dot_step_px: orbitStepPx,
      echo_dots: sp.echo_dots,
      inner_clip_offset_px: ctx.phase_mask_center_offset_x_px,
      inner_clip_center_x_px: ps.phase_mask_center_x_px,
      inner_clip_center_y_px: ctx.center_y_px,
      phase_clip_radius_px: ctx.phase_mask_legacy_radius_px,
      phase_field_radius_px: ctx.phase_mask_field_radius_px
    };

    for (const pt of sp.point_specs) {
      orbitCounts[pt.orbit_id]++;
      pointSpecs.push({ spoke_id: si, target_angle: angle, ...pt });
    }
  }

  return {
    box: mascotBox,
    geometry_scale: ctx.geometry_scale,
    orbit_counts: orbitCounts,
    max_orbit_count: Math.max(1, ...orbitCounts),
    point_specs: pointSpecs,
    spokes,
    visible_spoke_count: gen.spoke_count
  };
}

// ─── Build post-finale (screensaver) halo field state ─────────────────

export function buildPostFinaleHaloFieldState(opts: {
  config: HaloFieldConfig;
  mascotBox: MascotBox | null;
  playbackTimeSec: number;
  effectiveSpokeCount: number;
  effectiveOrbitCount: number;
  previousWidthPhaseUBySource: Map<number, number>;
  previousClipCenterXBySource: Map<number, number>;
  lastWidthTransitionTimeSec: number | null;
  fullFrameOuterRadiusPx: number;
}): PostFinaleFieldState {
  const {
    config, mascotBox, playbackTimeSec,
    effectiveSpokeCount, effectiveOrbitCount,
    previousWidthPhaseUBySource, previousClipCenterXBySource,
    lastWidthTransitionTimeSec, fullFrameOuterRadiusPx
  } = opts;
  const ctx = createFieldBase(config, mascotBox);
  const gen = ctx.generator;
  const orbitStepPx =
    effectiveOrbitCount <= 1 || ctx.radius_span_px <= 0
      ? ctx.radius_span_px
      : ctx.radius_span_px / Math.max(0.0001, effectiveOrbitCount - 1);
  const maxCentralOrbitIdx = orbitStepPx > 0
    ? Math.max(0, Math.ceil(ctx.radius_span_px / orbitStepPx))
    : 0;
  const maxSpokeCount = Math.max(1, Math.round(gen.spoke_count || 1));
  const totalTurns = maxSpokeCount / Math.max(1, effectiveSpokeCount);
  const seamDisplayU = 0.5;
  const wtDur = Math.max(0, Number(config.screensaver?.phase_boundary_transition_sec || 0));
  const wtDelta = lastWidthTransitionTimeSec == null
    ? null
    : playbackTimeSec - lastWidthTransitionTimeSec;
  const snapWT = wtDur <= 0 || wtDelta == null || wtDelta <= 0 || wtDelta > 0.25;
  const wtLerp = snapWT ? 1 : 1 - Math.exp(-wtDelta! / wtDur);

  const nextWPU = new Map<number, number>();
  const nextCCX = new Map<number, number>();
  const haloOuterR = mascotBox ? mascotBox.draw_size_px * 0.5 : ctx.outer_radius_px;
  const spokeLineStartRadiusPx = getClampedSpokeLineStartRadiusPx(config, ctx);
  const points: Array<{ x: number; y: number; radius_px: number; alpha: number }> = [];
  const spokes: Spoke[] = [];

  for (let srcIdx = 0; srcIdx < maxSpokeCount; srcIdx++) {
    const stripU = srcIdx / maxSpokeCount;
    const wrappedTurn = stripU * totalTurns;
    if (wrappedTurn >= 1) continue;

    const displayU = wrapPositive(seamDisplayU - wrappedTurn, 1);
    const displaySlot = wrapPositive(Math.round(displayU * maxSpokeCount), maxSpokeCount);
    const angle = ctx.base_angle_rad + TAU * displayU;
    const spid = wrapPositive(srcIdx - gen.pattern_offset_spokes, maxSpokeCount);
    const ps = getPhaseStateForAngle(angle, ctx, spid);
    const wtPM = getWidthTransitionPhaseMetrics(
      angle, ctx.base_angle_rad, maxSpokeCount, gen.phase_count,
      spid, ctx.center_x_px, ctx.phase_mask_center_offset_x_px
    );
    const prevWPU = previousWidthPhaseUBySource.get(srcIdx);
    const prevCCX = previousClipCenterXBySource.get(srcIdx);
    const targetWPU = wtPM.fill_u;
    const targetCCX = wtPM.phase_mask_center_x_px;
    const wpu = prevWPU == null ? targetWPU : lerp(prevWPU, targetWPU, wtLerp);
    const ccx = prevCCX == null ? targetCCX : lerp(prevCCX, targetCCX, wtLerp);
    nextWPU.set(srcIdx, wpu);
    nextCCX.set(srcIdx, ccx);

    const contActive = clamp(
      gen.min_active_orbits + ps.fill_u * (effectiveOrbitCount - gen.min_active_orbits),
      gen.min_active_orbits,
      effectiveOrbitCount
    );
    const reachU = effectiveOrbitCount <= 1
      ? 1
      : clamp((contActive - 1) / Math.max(0.0001, effectiveOrbitCount - 1), 0, 1);
    const fillEndR = ctx.inner_radius_px + ctx.radius_span_px * reachU;
    const sp = buildSpokeOrbitPoints(
      ctx, angle, ccx, fillEndR,
      reachU, ps.phase_frontier_scale,
      effectiveOrbitCount, orbitStepPx, maxCentralOrbitIdx
    );

    const spoke: Spoke = {
      source_spoke_id: srcIdx,
      display_slot_id: displaySlot,
      label_slot_id: srcIdx,
      spoke_pattern_id: spid,
      angle,
      alpha: 1,
      phase_u: ps.fill_u,
      width_phase_u: wpu,
      seam_overlay_only: false,
      start_radius: spokeLineStartRadiusPx,
      echo_dot_origin_radius: ctx.inner_radius_px,
      echo_dot_step_px: orbitStepPx,
      echo_dots: sp.echo_dots,
      inner_clip_offset_px: ctx.phase_mask_center_offset_x_px,
      inner_clip_center_x_px: ccx,
      inner_clip_center_y_px: ctx.center_y_px,
      phase_clip_radius_px: ctx.phase_mask_legacy_radius_px,
      phase_field_radius_px: ctx.phase_mask_field_radius_px
    };
    spokes.push(spoke);

    for (const pt of sp.point_specs) {
      points.push({ x: pt.x, y: pt.y, radius_px: pt.radius_px, alpha: 1 });
    }
  }

  return {
    box: mascotBox,
    points,
    spokes,
    visible_spoke_count: effectiveSpokeCount,
    halo_outer_radius_px: haloOuterR,
    full_frame_outer_radius_px: fullFrameOuterRadiusPx,
    next_spoke_width_phase_u_by_source: nextWPU,
    next_spoke_clip_center_x_by_source: nextCCX,
    spoke_width_transition_playback_time_sec: playbackTimeSec
  };
}

// ─── Echo marker variant selection ────────────────────────────────────

export type EchoMarkerVariant =
  | "dots" | "plus" | "triangles" | "diamond"
  | "radial_dash" | "star" | "hexagon";

const MIXED_SHAPES: EchoMarkerVariant[] = [
  "dots", "plus", "triangles", "diamond", "radial_dash", "star", "hexagon"
];

export function getEchoMarkerVariant(
  echoStyle: string,
  spokeId: number,
  orbitIndex: number,
  shapeSeed = 0,
  mixShapePct = 0.56
): EchoMarkerVariant {
  if (echoStyle === "dots") return "dots";
  if (echoStyle === "plus") return "plus";
  if (echoStyle === "triangles") return "triangles";
  if (echoStyle !== "mixed") return "dots";

  const h = hash01(spokeId + shapeSeed * 31, orbitIndex + shapeSeed * 17);
  if (h > mixShapePct) return "dots";

  const variantIndex = Math.floor(h / mixShapePct * (MIXED_SHAPES.length - 1));
  return MIXED_SHAPES[clamp(variantIndex + 1, 1, MIXED_SHAPES.length - 1)];
}

// ─── 3-phase timeline builder ─────────────────────────────────────────

/**
 * Compute the timeline milestones for dot-intro → finale-sweep → screensaver.
 * Ported from racoon-anim rendering.js build_scene_data().
 */
export function buildRuntimeTiming(config: HaloFieldConfig): RuntimeTiming {
  const transition = config.transition_wrangle;
  const gen = config.generator_wrangle;
  const fadeDelaySec = config.mascot_fade.enabled
    ? Math.max(0, config.mascot_fade.duration_sec)
    : 0;
  const headTurnDelaySec = config.head_turn.enabled
    ? Math.max(0, config.head_turn.duration_sec)
    : 0;
  const headTurnOverlapSec = config.head_turn.enabled
    ? clamp(config.head_turn.dot_overlap_sec ?? 0, 0, headTurnDelaySec)
    : 0;
  const startDelaySec = Math.max(
    fadeDelaySec,
    Math.max(0, headTurnDelaySec - headTurnOverlapSec)
  );

  const durationSec = Math.max(0.001, transition.duration_sec);
  const dotEndSec = startDelaySec + durationSec;

  const finaleEnabled = config.finale?.enabled ?? false;
  const finaleDelay = Math.max(0, config.finale?.delay_after_dots_sec ?? 0);
  const finaleStartSec = dotEndSec + finaleDelay;
  const finaleEndSec = finaleEnabled
    ? finaleStartSec + Math.max(0.001, config.finale?.duration_sec ?? 1)
    : finaleStartSec;

  const blinkAnchorSec = finaleEnabled ? finaleEndSec : dotEndSec;
  const blinkStartSec = blinkAnchorSec + Math.max(0, config.blink.start_delay_sec ?? 0);
  const blinkEndSec = config.blink.enabled
    ? blinkStartSec + Math.max(0.0001, config.blink.duration_sec ?? 0)
    : blinkAnchorSec;
  const playbackEndSec = Math.max(finaleEndSec, blinkEndSec);

  const rotationRad = radians(config.composition.global_rotation_deg || 0);
  const spawnAngleRad =
    radians((gen.anim_start_angle_deg ?? 0) + transition.spawn_angle_offset_deg) + rotationRad;

  return {
    start_delay_sec: startDelaySec,
    dot_end_sec: dotEndSec,
    finale_start_sec: finaleStartSec,
    finale_end_sec: finaleEndSec,
    playback_end_sec: playbackEndSec,
    spawn_angle_rad: spawnAngleRad
  };
}

/**
 * Build per-point animation data: birth/visible/capture timing + rotation speed.
 * Ported from racoon-anim rendering.js build_scene_data() point loop.
 */
export function buildRuntimePoints(
  config: HaloFieldConfig,
  introField: IntroFieldState,
  timing: RuntimeTiming
): RuntimePoint[] {
  const transition = config.transition_wrangle;
  const gen = config.generator_wrangle;

  const durationSec = Math.max(0.001, transition.duration_sec);
  const emitDurationSec = durationSec * clamp(transition.emit_frac, 0.001, 1);
  const shotIntervalSec = introField.max_orbit_count > 1
    ? emitDurationSec / (introField.max_orbit_count - 1)
    : emitDurationSec;

  const baseSpeedDegSec = 360 * transition.spins / durationSec;
  const captureStartSec = timing.start_delay_sec + transition.capture_start_frac * durationSec;

  // Orbit-count unlock
  const orbitCountFrom = clamp(transition.orbit_count_start_frac ?? 0, 0, 1) * gen.num_orbits;
  const orbitCountTo = clamp(transition.orbit_count_end_frac ?? 1, 0, 1) * gen.num_orbits;
  const orbitCountStartSec = timing.start_delay_sec + (transition.orbit_count_start_frac ?? 0) * durationSec;
  const orbitCountEndSec = timing.start_delay_sec + (transition.orbit_count_end_frac ?? 1) * durationSec;

  const orbitRankCounts = new Array(gen.num_orbits).fill(0);
  const points: RuntimePoint[] = [];
  const cx = config.composition.center_x_px;
  const cy = config.composition.center_y_px;

  for (const pt of introField.point_specs) {
    const oid = pt.orbit_id;
    const orbitRank = orbitRankCounts[oid];
    const speedIdx = transition.inner_faster
      ? oid
      : (gen.num_orbits - 1 - oid);
    const speedDegSec = baseSpeedDegSec *
      Math.pow(Math.max(0.0001, transition.speed_mult_per_orbit), speedIdx);

    const visibleDelaySec = (transition.occlusion_arc_deg ?? 0) /
      Math.max(0.0001, speedDegSec);

    const rawBirthSec = timing.start_delay_sec +
      orbitRank * shotIntervalSec +
      oid * transition.orbit_stagger_frac * shotIntervalSec;

    let orbitUnlockSec = timing.start_delay_sec;
    if (transition.animate_orbit_count && orbitCountTo > orbitCountFrom) {
      const orbitTargetIdx = oid + 1;
      const orbitUnlockU = clamp(
        (orbitTargetIdx - orbitCountFrom) / (orbitCountTo - orbitCountFrom), 0, 1
      );
      orbitUnlockSec = lerp(orbitCountStartSec, orbitCountEndSec, orbitUnlockU);
    }

    const birthSec = Math.max(rawBirthSec, orbitUnlockSec);
    const visibleSec = birthSec + visibleDelaySec;
    const ptCaptureStart = Math.max(captureStartSec, visibleSec);

    points.push({
      center_x_px: cx,
      center_y_px: cy,
      radius: pt.radius,
      target_angle: pt.target_angle,
      orbit_id: oid,
      speed_rad_per_sec: radians(speedDegSec),
      birth_sec: birthSec,
      visible_sec: visibleSec,
      capture_start_sec: ptCaptureStart,
      diameter_px: pt.diameter_px,
      radius_px: pt.radius_px
    });

    orbitRankCounts[oid]++;
  }

  return points;
}

// ─── Default halo field config (landscape 1280×720) ──────────────────

export function createDefaultHaloFieldConfig(): HaloFieldConfig {
  return {
    mascot_fade: {
      enabled: false,
      duration_sec: 3
    },
    head_turn: {
      enabled: true,
      duration_sec: 0.333,
      peak_angle_deg: -30,
      reverse_angle_deg: 30,
      overshoot_angle_deg: -3,
      peak_frac: 0.25,
      reverse_frac: 0.56,
      dot_overlap_sec: 1,
      overshoot_frac: 0.75
    },
    blink: {
      enabled: true,
      start_delay_sec: 0.04,
      duration_sec: 0.12,
      close_frac: 0.42,
      hold_closed_frac: 0.12,
      eye_scale_y_closed: 0.08
    },
    sneeze: {
      enabled: true,
      nose_bob_up_px: 1.5
    },
    composition: {
      center_x_px: 640,
      center_y_px: 334,
      center_offset_y_px: -26,
      scale: 0.5,
      radial_scale: 1,
      global_rotation_deg: 0,
      background_color: "#202020"
    },
    generator_wrangle: {
      inner_radius: 0.26,
      outer_radius: 0.513,
      num_orbits: 8,
      spoke_count: 60,
      phase_count: 2,
      min_active_orbits: 3,
      base_angle_deg: 0,
      pattern_offset_spokes: 1,
      anim_start_angle_deg: 0
    },
    transition_wrangle: {
      duration_sec: 1,
      spins: 3,
      emit_frac: 0.05,
      alpha_ramp_duration_sec: 0.14,
      animate_orbit_count: true,
      orbit_count_start_frac: 0,
      orbit_count_end_frac: 1,
      capture_start_frac: 0.25,
      orbit_stagger_frac: 1,
      speed_mult_per_orbit: 0.85,
      inner_faster: true,
      spawn_angle_offset_deg: 0,
      occlusion_arc_deg: 0,
      hide_invisible_by_pscale: true,
      base_pscale: 0.74,
      orbital_frontier_amount: -1,
      orbital_frontier_width_u: 1,
      orbital_frontier_bias: 0.676,
      phase_frontier_amount: 0.655,
      phase_frontier_width_u: 0.57,
      phase_frontier_bias: 1
    },
    point_style: {
      color: "#ffffff",
      alpha: 1,
      base_pscale_px_per_unit: 4,
      min_scale: 0.3,
      min_diameter_px: 1.1
    },
    spoke_lines: {
      enabled: true,
      show_reference_halo: false,
      show_debug_masks: false,
      construction_color: "#333333",
      reference_color: "#666666",
      color: "#ffffff",
      echo_color: "#444444",
      width_px: 3,
      echo_marker_stroke_px: 2.2,
      echo_marker_scale_mult: 1.5,
      echo_sparse_scale_boost: 0.5,
      echo_spacing_offset_px: 0,
      phase_start_width_px: 8,
      phase_end_width_px: 4,
      echo_count: 16,
      echo_style: "mixed",
      echo_shape_seed: 0,
      echo_mix_shape_pct: 0.56,
      echo_width_mult: 0.88,
      echo_wave_count: 4,
      echo_opacity_mult: 0.5,
      start_radius_px: 150,
      content_clearance_px: 24
    },
    spoke_text: {
      enabled: true,
      font_size_px: 18,
      radial_u: 0
    },
    screensaver: {
      cycle_sec: 60,
      pulse_orbits: true,
      pulse_spokes: true,
      min_spoke_count: 24,
      ramp_in_sec: 2,
      phase_boundary_transition_sec: 0.04
    },
    finale: {
      enabled: true,
      delay_after_dots_sec: 0,
      duration_sec: 0.75,
      start_angle_deg: 0,
      mask_angle_offset_deg: 1.5,
      halo_inner_radius_u: 0.255
    },
    vignette: {
      enabled: false,
      shape_fade: 1,
      shape_fade_start: 0.3,
      shape_fade_end: 0.85
    }
  };
}

// ─── Per-profile halo overrides ───────────────────────────────────────
// Each profile stores only the fields that differ from the landscape baseline.
// Each profile stores only the fields that differ from the landscape baseline.

type HaloProfileOverride = {
  [K in keyof HaloFieldConfig]?: Partial<HaloFieldConfig[K]>;
};

const HALO_PROFILE_OVERRIDES: Record<string, HaloProfileOverride> = {
  landscape_1280x720: {
    composition: { center_offset_y_px: -26 }
  },
  fullhd_1920x1080: {
    composition: { center_offset_y_px: 0 }
  },
  instagram_1080x1350: {
    composition: { scale: 0.67, center_offset_y_px: -121 },
    spoke_text: { font_size_px: 14 },
    vignette: { shape_fade_start: 0.24, shape_fade_end: 0.88 }
  },
  story_1080x1920: {
    composition: { scale: 0.75, center_offset_y_px: -156 },
    spoke_text: { font_size_px: 14 },
    vignette: { shape_fade_start: 0.23, shape_fade_end: 0.79 }
  },
  screen_3840x2160: {
    composition: { scale: 0.75, center_offset_y_px: 82 },
    spoke_text: { font_size_px: 14 }
  },
  tablet_2560x1600: {
    composition: { scale: 0.75, background_color: "#2b2b2b", center_offset_y_px: 0 },
    spoke_text: { font_size_px: 14 }
  }
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function deepMerge(base: any, overrides: any): any {
  const result = { ...base };
  for (const key of Object.keys(overrides)) {
    const ov = overrides[key];
    const bv = base[key];
    if (ov != null && typeof ov === "object" && !Array.isArray(ov) && typeof bv === "object" && bv != null) {
      result[key] = deepMerge(bv, ov);
    } else if (ov !== undefined) {
      result[key] = ov;
    }
  }
  return result;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Create a HaloFieldConfig tuned for a specific output profile.
 * Falls back to the landscape baseline for unknown profile keys.
 */
export function createHaloFieldConfigForProfile(profileKey: string): HaloFieldConfig {
  const base = createDefaultHaloFieldConfig();
  const overrides = HALO_PROFILE_OVERRIDES[profileKey];
  if (!overrides || Object.keys(overrides).length === 0) return base;
  return deepMerge(base, overrides) as HaloFieldConfig;
}

// ─── Halo config merge helpers ────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function mergeHaloConfigWithBaseConfig(baseConfig: HaloFieldConfig, rawHaloConfig: unknown): HaloFieldConfig {
  const defaults = { ...baseConfig };
  if (!isRecord(rawHaloConfig)) {
    return defaults;
  }

  const mascotFade = isRecord(rawHaloConfig.mascot_fade) ? rawHaloConfig.mascot_fade : {};
  const headTurn = isRecord(rawHaloConfig.head_turn) ? rawHaloConfig.head_turn : {};
  const blink = isRecord(rawHaloConfig.blink) ? rawHaloConfig.blink : {};
  const sneeze = isRecord(rawHaloConfig.sneeze) ? rawHaloConfig.sneeze : {};
  const composition = isRecord(rawHaloConfig.composition) ? rawHaloConfig.composition : {};
  const generatorWrangle = isRecord(rawHaloConfig.generator_wrangle) ? rawHaloConfig.generator_wrangle : {};
  const transitionWrangle = isRecord(rawHaloConfig.transition_wrangle) ? rawHaloConfig.transition_wrangle : {};
  const pointStyle = isRecord(rawHaloConfig.point_style) ? rawHaloConfig.point_style : {};
  const spokeLines = isRecord(rawHaloConfig.spoke_lines) ? rawHaloConfig.spoke_lines : {};
  const spokeText = isRecord(rawHaloConfig.spoke_text) ? rawHaloConfig.spoke_text : {};
  const screensaver = isRecord(rawHaloConfig.screensaver) ? rawHaloConfig.screensaver : {};
  const finale = isRecord(rawHaloConfig.finale) ? rawHaloConfig.finale : {};
  const vignette = isRecord(rawHaloConfig.vignette) ? rawHaloConfig.vignette : {};

  return {
    ...defaults,
    ...rawHaloConfig,
    mascot_fade: { ...defaults.mascot_fade, ...mascotFade },
    head_turn: { ...defaults.head_turn, ...headTurn },
    blink: { ...defaults.blink, ...blink },
    sneeze: { ...defaults.sneeze, ...sneeze },
    composition: { ...defaults.composition, ...composition },
    generator_wrangle: { ...defaults.generator_wrangle, ...generatorWrangle },
    transition_wrangle: { ...defaults.transition_wrangle, ...transitionWrangle },
    point_style: { ...defaults.point_style, ...pointStyle },
    spoke_lines: { ...defaults.spoke_lines, ...spokeLines },
    spoke_text: { ...defaults.spoke_text!, ...spokeText },
    screensaver: { ...defaults.screensaver!, ...screensaver },
    finale: { ...defaults.finale!, ...finale },
    vignette: { ...defaults.vignette!, ...vignette }
  } as HaloFieldConfig;
}

/**
 * Merge a raw (possibly partial) halo config with profile-tuned defaults,
 * then resolve center_y_px from profile metrics + center_offset_y_px.
 */
export function getHaloConfigForProfile(profileKey: string, rawHaloConfig?: unknown): HaloFieldConfig {
  const config = mergeHaloConfigWithBaseConfig(createHaloFieldConfigForProfile(profileKey), rawHaloConfig);
  const metrics = getOutputProfileMetrics(profileKey);
  config.composition.center_x_px = metrics.centerXPx;
  config.composition.center_y_px = metrics.centerYPx + (config.composition.center_offset_y_px ?? 0);
  return config;
}

// ─── Ubuntu release labels ────────────────────────────────────────────

export const UBUNTU_RELEASE_LABELS: readonly string[] = Object.freeze([
  "26.04 Resolute Raccoon",
  "25.10 Questing Quokka",
  "25.04 Plucky Puffin",
  "24.10 Oracular Oriole",
  "24.04 Noble Numbat",
  "23.10 Mantic Minotaur",
  "23.04 Lunar Lobster",
  "22.10 Kinetic Kudu",
  "22.04 Jammy Jellyfish",
  "21.10 Impish Indri",
  "21.04 Hirsute Hippo",
  "20.10 Groovy gorilla",
  "20.04 Focal Fossa",
  "19.10 Eoan Ermine",
  "19.04 Disco Dingo",
  "18.10 Cosmic Cuttlefish",
  "18.04 Bionic Beaver",
  "17.10 Artful Aardvark",
  "17.04 Zesty Zapus",
  "16.10 Yakkety Yak",
  "16.04 Xenial Xerus",
  "15.10 Wily Werewolf",
  "15.04 Vivid Vervet",
  "14.10 Utopic Unicorn",
  "14.04 Trusty Tahr",
  "13.10 Saucy Salamander",
  "13.04 Raring Ringtail",
  "12.10 Quantal Quetzal",
  "12.04 Precise Pangolin",
  "11.10 Oneiric Ocelot",
  "11.04 Natty Narwhal",
  "10.10 Maverick Meerkat",
  "10.04 Lucid Lynx",
  "9.10 Karmic Koala",
  "9.04 Jaunty Jackalope",
  "8.10 Intrepid Ibex",
  "8.04 Hardy Heron",
  "7.10 Gutsy Gibbon",
  "7.04 Feisty Fawn",
  "6.10 Edgy Eft",
  "6.06 Dapper Drake",
  "5.10 Breezy Badger",
  "5.04 Hoary Hedgehog",
  "4.10 Warty Warthog"
]);
