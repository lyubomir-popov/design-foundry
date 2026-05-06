import type { OperatorDefinition } from "@brand-layout-ops/core-types";
import {
  COMPOSITION_SIZE_PX,
  UBUNTU_RELEASE_LABELS,
  buildPostFinaleHaloFieldState,
  buildRuntimeTiming,
  clamp,
  lerp,
  radians,
  smoothstep,
  type PostFinaleFieldState,
  type RuntimeTiming,
  type HaloFieldConfig,
  type MascotBox
} from "@brand-layout-ops/operator-halo-field";

export const UBUNTU_SUMMIT_ANIMATION_OPERATOR_KEY = "operator.ubuntu-summit-animation";

export type UbuntuSummitAnimationPhase = "dot-intro" | "finale" | "screensaver";

export interface UbuntuSummitAnimationParams {
  haloConfig: HaloFieldConfig;
  playbackTimeSec: number;
  frameWidthPx?: number;
  frameHeightPx?: number;
  previousTransitionState?: UbuntuSummitAnimationTransitionState;
  forceDotFinal?: boolean;
  forceMascotFinal?: boolean;
}

export interface UbuntuSummitAnimationRevealState {
  haloU: number;
  startAngleRad: number;
  innerRadiusPx: number;
  outerRadiusPx: number;
}

interface UbuntuSummitMascotFadeConfig {
  enabled: boolean;
  duration_sec: number;
}

interface UbuntuSummitHeadTurnConfig {
  enabled: boolean;
  duration_sec: number;
  peak_angle_deg: number;
  reverse_angle_deg: number;
  overshoot_angle_deg: number;
  peak_frac: number;
  reverse_frac: number;
  dot_overlap_sec: number;
  overshoot_frac: number;
}

interface UbuntuSummitBlinkConfig {
  enabled: boolean;
  start_delay_sec: number;
  duration_sec: number;
  close_frac: number;
  hold_closed_frac: number;
  eye_scale_y_closed: number;
}

interface UbuntuSummitSneezeConfig {
  enabled: boolean;
  nose_bob_up_px: number;
}

interface UbuntuSummitMascotMotionConfig {
  mascot_fade: UbuntuSummitMascotFadeConfig;
  head_turn: UbuntuSummitHeadTurnConfig;
  blink: UbuntuSummitBlinkConfig;
  sneeze: UbuntuSummitSneezeConfig;
}

export interface UbuntuSummitAnimationMotionTiming {
  mascotFadeDurationSec: number;
  headTurnDurationSec: number;
  headTurnOverlapSec: number;
  blinkAnchorSec: number;
  blinkStartSec: number;
  blinkEndSec: number;
}

export interface UbuntuSummitAnimationMascotMotionState {
  mascotFadeU: number;
  headTurnDeg: number;
  closingBlinkU: number;
  loopBlinkU: number;
  sneezeU: number;
  headTurnEyeSquintU: number;
  eyeClosureU: number;
  eyeScaleY: number;
  noseBobPx: number;
}

export interface UbuntuSummitAnimationTransitionState {
  configFingerprint: string;
  previousPlaybackTimeSec: number | null;
  spokeWidthPhaseUBySource: ReadonlyArray<readonly [number, number]>;
  spokeClipCenterXBySource: ReadonlyArray<readonly [number, number]>;
  lastWidthTransitionTimeSec: number | null;
}

export interface UbuntuSummitAnimationFrameState {
  effectivePlaybackTimeSec: number;
  dotTimeSec: number;
  isDotComplete: boolean;
  isPlaybackComplete: boolean;
  useScreensaverField: boolean;
  effectiveOrbitCount: number;
  effectiveSpokeCount: number;
  haloU: number;
  haloOuterRadiusPx: number;
  fullFrameOuterRadiusPx: number;
  reveal: UbuntuSummitAnimationRevealState | null;
  motionTiming: UbuntuSummitAnimationMotionTiming;
  mascotMotion: UbuntuSummitAnimationMascotMotionState;
  screensaverFieldState: PostFinaleFieldState | null;
  nextTransitionState: UbuntuSummitAnimationTransitionState;
}

const haloConfigFingerprintCache = new WeakMap<HaloFieldConfig, string>();

function getHaloConfigFingerprint(config: HaloFieldConfig): string {
  const cachedFingerprint = haloConfigFingerprintCache.get(config);
  if (cachedFingerprint) {
    return cachedFingerprint;
  }

  const nextFingerprint = JSON.stringify(config);
  haloConfigFingerprintCache.set(config, nextFingerprint);
  return nextFingerprint;
}

export interface UbuntuSummitAnimationSceneDescriptor {
  family: "ubuntu-summit-animation";
  playbackTimeSec: number;
  phase: UbuntuSummitAnimationPhase;
  forceDotFinal: boolean;
  forceMascotFinal: boolean;
  haloConfig: HaloFieldConfig;
  mascotBox: MascotBox | null;
  releaseLabels: readonly string[];
  runtimeTiming: RuntimeTiming;
  loopTimeSec: number;
  frameState: UbuntuSummitAnimationFrameState;
}

function toNumber(value: unknown, fallback: number): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

const DEFAULT_MASCOT_MOTION_CONFIG: UbuntuSummitMascotMotionConfig = {
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
  }
};

function resolveMotionConfig(config: HaloFieldConfig): UbuntuSummitMascotMotionConfig {
  return {
    mascot_fade: {
      ...DEFAULT_MASCOT_MOTION_CONFIG.mascot_fade,
      ...config.mascot_fade
    },
    head_turn: {
      ...DEFAULT_MASCOT_MOTION_CONFIG.head_turn,
      ...config.head_turn
    },
    blink: {
      ...DEFAULT_MASCOT_MOTION_CONFIG.blink,
      ...config.blink
    },
    sneeze: {
      ...DEFAULT_MASCOT_MOTION_CONFIG.sneeze,
      ...config.sneeze
    }
  };
}

function buildUbuntuSummitMotionTiming(
  config: HaloFieldConfig,
  motionConfig: UbuntuSummitMascotMotionConfig
): {
  runtimeTiming: RuntimeTiming;
  motionTiming: UbuntuSummitAnimationMotionTiming;
} {
  const runtimeTiming = buildRuntimeTiming(config);
  const mascotFadeDurationSec = motionConfig.mascot_fade.enabled
    ? Math.max(0, motionConfig.mascot_fade.duration_sec)
    : 0;
  const headTurnDurationSec = motionConfig.head_turn.enabled
    ? Math.max(0, motionConfig.head_turn.duration_sec)
    : 0;
  const headTurnOverlapSec = motionConfig.head_turn.enabled
    ? clamp(motionConfig.head_turn.dot_overlap_sec, 0, headTurnDurationSec)
    : 0;
  const finaleEnabled = config.finale?.enabled ?? false;
  const blinkAnchorSec = finaleEnabled ? runtimeTiming.finale_end_sec : runtimeTiming.dot_end_sec;
  const blinkStartSec = blinkAnchorSec + Math.max(0, motionConfig.blink.start_delay_sec);
  const blinkEndSec = motionConfig.blink.enabled
    ? blinkStartSec + Math.max(0.0001, motionConfig.blink.duration_sec)
    : blinkAnchorSec;

  return {
    runtimeTiming: {
      ...runtimeTiming,
      playback_end_sec: Math.max(runtimeTiming.finale_end_sec, blinkEndSec)
    },
    motionTiming: {
      mascotFadeDurationSec,
      headTurnDurationSec,
      headTurnOverlapSec,
      blinkAnchorSec,
      blinkStartSec,
      blinkEndSec
    }
  };
}

function computeMascotFadeAmount(
  playbackTimeSec: number,
  motionConfig: UbuntuSummitMascotMotionConfig
): number {
  if (!motionConfig.mascot_fade.enabled) {
    return 1;
  }

  return smoothstep(0, Math.max(0.0001, motionConfig.mascot_fade.duration_sec), playbackTimeSec);
}

function computeHeadTurnDeg(
  localTimeSec: number,
  motionConfig: UbuntuSummitMascotMotionConfig
): number {
  if (!motionConfig.head_turn.enabled) {
    return 0;
  }

  const durationSec = Math.max(0.0001, motionConfig.head_turn.duration_sec);
  if (localTimeSec <= 0 || localTimeSec >= durationSec) {
    return 0;
  }

  const turnU = clamp(localTimeSec / durationSec, 0, 1);
  const peakFrac = clamp(motionConfig.head_turn.peak_frac, 0.05, 0.45);
  const reverseFrac = clamp(motionConfig.head_turn.reverse_frac, peakFrac + 0.05, 0.85);
  const overshootFrac = clamp(motionConfig.head_turn.overshoot_frac, reverseFrac + 0.05, 0.98);

  if (turnU < peakFrac) {
    return lerp(0, motionConfig.head_turn.peak_angle_deg, smoothstep(0, peakFrac, turnU));
  }

  if (turnU < reverseFrac) {
    return lerp(
      motionConfig.head_turn.peak_angle_deg,
      motionConfig.head_turn.reverse_angle_deg,
      smoothstep(peakFrac, reverseFrac, turnU)
    );
  }

  if (turnU < overshootFrac) {
    return lerp(
      motionConfig.head_turn.reverse_angle_deg,
      motionConfig.head_turn.overshoot_angle_deg,
      smoothstep(reverseFrac, overshootFrac, turnU)
    );
  }

  return lerp(
    motionConfig.head_turn.overshoot_angle_deg,
    0,
    smoothstep(overshootFrac, 1, turnU)
  );
}

function computeBlinkCurve(
  blinkU: number,
  motionConfig: UbuntuSummitMascotMotionConfig
): number {
  const closeFrac = clamp(motionConfig.blink.close_frac, 0.05, 0.9);
  const holdEndFrac = clamp(
    closeFrac + motionConfig.blink.hold_closed_frac,
    closeFrac,
    0.98
  );

  if (blinkU < closeFrac) {
    return smoothstep(0, closeFrac, blinkU);
  }

  if (blinkU < holdEndFrac) {
    return 1;
  }

  return 1 - smoothstep(holdEndFrac, 1, blinkU);
}

function computeClosingBlinkAmount(
  playbackTimeSec: number,
  motionConfig: UbuntuSummitMascotMotionConfig,
  motionTiming: UbuntuSummitAnimationMotionTiming
): number {
  if (
    !motionConfig.blink.enabled ||
    playbackTimeSec < motionTiming.blinkStartSec ||
    playbackTimeSec > motionTiming.blinkEndSec
  ) {
    return 0;
  }

  const blinkU = clamp(
    (playbackTimeSec - motionTiming.blinkStartSec) / Math.max(0.0001, motionConfig.blink.duration_sec),
    0,
    1
  );
  return computeBlinkCurve(blinkU, motionConfig);
}

function computeLoopBlinkAmount(
  playbackTimeSec: number,
  runtimeTiming: RuntimeTiming,
  config: HaloFieldConfig,
  motionConfig: UbuntuSummitMascotMotionConfig
): number {
  if (
    !motionConfig.sneeze.enabled ||
    !motionConfig.blink.enabled ||
    playbackTimeSec <= runtimeTiming.playback_end_sec ||
    !hasDynamicScreensaverMotion(config)
  ) {
    return 0;
  }

  const cycleSec = Math.max(0.001, Number(config.screensaver?.cycle_sec || 60));
  const eventSpacingSec = cycleSec * 0.5;
  if (eventSpacingSec <= 0) {
    return 0;
  }

  const sneezeDurationSec = Math.max(0.0001, motionConfig.blink.duration_sec);
  const loopTimeSec = playbackTimeSec - runtimeTiming.playback_end_sec;
  const nearestEventIndex = Math.round(loopTimeSec / eventSpacingSec);
  const nearestEventTimeSec = nearestEventIndex * eventSpacingSec;
  const eventOffsetSec = loopTimeSec - nearestEventTimeSec;
  const halfDurationSec = sneezeDurationSec * 0.5;
  if (Math.abs(eventOffsetSec) > halfDurationSec) {
    return 0;
  }

  const sneezeU = clamp((eventOffsetSec + halfDurationSec) / sneezeDurationSec, 0, 1);
  return computeBlinkCurve(sneezeU, motionConfig);
}

function computeHeadTurnEyeSquintAmount(
  playbackTimeSec: number,
  motionConfig: UbuntuSummitMascotMotionConfig
): number {
  if (!motionConfig.head_turn.enabled) {
    return 0;
  }

  const durationSec = Math.max(0.0001, motionConfig.head_turn.duration_sec);
  if (playbackTimeSec <= 0 || playbackTimeSec >= durationSec) {
    return 0;
  }

  const easeSec = Math.min(0.03, durationSec * 0.18);
  const closeAmount = smoothstep(0, easeSec, playbackTimeSec);
  const openAmount = 1 - smoothstep(durationSec - easeSec, durationSec, playbackTimeSec);
  return clamp(closeAmount * openAmount, 0, 1);
}

function buildMascotMotionState(
  playbackTimeSec: number,
  runtimeTiming: RuntimeTiming,
  motionTiming: UbuntuSummitAnimationMotionTiming,
  config: HaloFieldConfig,
  motionConfig: UbuntuSummitMascotMotionConfig,
  forceMascotFinal: boolean
): UbuntuSummitAnimationMascotMotionState {
  const mascotFadeU = forceMascotFinal ? 1 : computeMascotFadeAmount(playbackTimeSec, motionConfig);
  const headTurnDeg = forceMascotFinal ? 0 : computeHeadTurnDeg(playbackTimeSec, motionConfig);
  const closingBlinkU = forceMascotFinal
    ? 0
    : computeClosingBlinkAmount(playbackTimeSec, motionConfig, motionTiming);
  const loopBlinkU = computeLoopBlinkAmount(playbackTimeSec, runtimeTiming, config, motionConfig);
  const sneezeU = forceMascotFinal ? loopBlinkU : Math.max(closingBlinkU, loopBlinkU);
  const headTurnEyeSquintU = forceMascotFinal ? 0 : computeHeadTurnEyeSquintAmount(playbackTimeSec, motionConfig);
  const eyeClosureU = Math.max(sneezeU, headTurnEyeSquintU);
  const eyeScaleY = lerp(1, clamp(motionConfig.blink.eye_scale_y_closed, 0.02, 1), eyeClosureU);
  const noseBobPx = motionConfig.sneeze.enabled
    ? motionConfig.sneeze.nose_bob_up_px * eyeClosureU
    : 0;

  return {
    mascotFadeU,
    headTurnDeg,
    closingBlinkU,
    loopBlinkU,
    sneezeU,
    headTurnEyeSquintU,
    eyeClosureU,
    eyeScaleY,
    noseBobPx
  };
}

function getFullFrameOuterRadius(
  config: HaloFieldConfig,
  frameWidthPx: number,
  frameHeightPx: number
): number {
  const cx = toNumber(config.composition.center_x_px, 0);
  const cy = toNumber(config.composition.center_y_px, 0);
  const dx = Math.max(cx, Math.max(0, frameWidthPx) - cx);
  const dy = Math.max(cy, Math.max(0, frameHeightPx) - cy);
  return Math.hypot(dx, dy);
}

function hasDynamicScreensaverMotion(config: HaloFieldConfig): boolean {
  const maxOrbitCount = Math.max(1, Number(config.generator_wrangle.num_orbits || 1));
  const minOrbitCount = clamp(
    Number(config.generator_wrangle.min_active_orbits || 1),
    1,
    maxOrbitCount
  );
  const orbitMotion = config.screensaver?.pulse_orbits !== false && maxOrbitCount - minOrbitCount > 0.001;
  const maxSpokeCount = Math.max(1, Number(config.generator_wrangle.spoke_count || 1));
  const minSpokeCount = clamp(
    Number(config.screensaver?.min_spoke_count ?? maxSpokeCount),
    1,
    maxSpokeCount
  );
  const spokeMotion = Boolean(config.screensaver?.pulse_spokes) && maxSpokeCount - minSpokeCount > 0.001;
  return orbitMotion || spokeMotion;
}

function getScreensaverPulseU(config: HaloFieldConfig, timeSec: number, screensaverStartTimeSec: number): number {
  const safeCycleSec = Math.max(0.001, Number(config.screensaver?.cycle_sec || 60));
  if (timeSec <= screensaverStartTimeSec) {
    return 1;
  }

  const loopTimeSec = timeSec - screensaverStartTimeSec;
  const rawPulseU = 0.5 + 0.5 * Math.cos((loopTimeSec / safeCycleSec) * Math.PI * 2);
  const rampInSec = Math.max(0, Number(config.screensaver?.ramp_in_sec ?? 0));
  if (rampInSec <= 0) {
    return rawPulseU;
  }

  return lerp(1, rawPulseU, smoothstep(0, rampInSec, loopTimeSec));
}

function getEffectiveOrbitCount(
  config: HaloFieldConfig,
  timeSec: number,
  screensaverStartTimeSec: number
): number {
  const maxOrbitCount = Math.max(1, Number(config.generator_wrangle.num_orbits || 1));
  const minOrbitCount = clamp(
    Number(config.generator_wrangle.min_active_orbits || 1),
    1,
    maxOrbitCount
  );
  if (
    !config.screensaver?.pulse_orbits ||
    !hasDynamicScreensaverMotion(config) ||
    timeSec <= screensaverStartTimeSec
  ) {
    return maxOrbitCount;
  }

  const pulseU = getScreensaverPulseU(config, timeSec, screensaverStartTimeSec);
  return clamp(lerp(minOrbitCount, maxOrbitCount, pulseU), minOrbitCount, maxOrbitCount);
}

function getEffectiveSpokeCount(
  config: HaloFieldConfig,
  timeSec: number,
  screensaverStartTimeSec: number
): number {
  const maxSpokeCount = Math.max(1, Number(config.generator_wrangle.spoke_count || 1));
  const minSpokeCount = clamp(
    Number(config.screensaver?.min_spoke_count ?? maxSpokeCount),
    1,
    maxSpokeCount
  );
  if (
    !config.screensaver?.pulse_spokes ||
    !hasDynamicScreensaverMotion(config) ||
    timeSec <= screensaverStartTimeSec
  ) {
    return maxSpokeCount;
  }

  const pulseU = getScreensaverPulseU(config, timeSec, screensaverStartTimeSec);
  return clamp(lerp(minSpokeCount, maxSpokeCount, pulseU), minSpokeCount, maxSpokeCount);
}

function getFinaleHaloU(
  playbackTimeSec: number,
  runtimeTiming: RuntimeTiming,
  config: HaloFieldConfig,
  forceFinal: boolean
): number {
  if (!config.finale?.enabled) {
    return 0;
  }

  if (forceFinal) {
    return 1;
  }

  return smoothstep(runtimeTiming.finale_start_sec, runtimeTiming.finale_end_sec, playbackTimeSec);
}

function getRevealState(
  config: HaloFieldConfig,
  box: MascotBox | null,
  fullFrameOuterRadiusPx: number,
  haloU: number,
  forceFinal: boolean
): UbuntuSummitAnimationRevealState | null {
  if (!box) {
    return null;
  }

  return {
    haloU: config.finale?.enabled ? (forceFinal ? 1 : haloU) : 1,
    startAngleRad:
      radians((config.finale?.start_angle_deg ?? 0) + (config.finale?.mask_angle_offset_deg ?? 0)) +
      radians(config.composition.global_rotation_deg || 0),
    innerRadiusPx: box.draw_size_px * clamp(config.finale?.halo_inner_radius_u ?? 0.2, 0.01, 0.5),
    outerRadiusPx: fullFrameOuterRadiusPx
  };
}

function toTransitionEntries(map: Map<number, number>): Array<[number, number]> {
  return Array.from(map.entries());
}

function toTransitionMap(entries: ReadonlyArray<readonly [number, number]> | undefined): Map<number, number> {
  return new Map((entries ?? []).map(([key, value]) => [Number(key), Number(value)]));
}

function createEmptyTransitionState(configFingerprint: string): UbuntuSummitAnimationTransitionState {
  return {
    configFingerprint,
    previousPlaybackTimeSec: null,
    spokeWidthPhaseUBySource: [],
    spokeClipCenterXBySource: [],
    lastWidthTransitionTimeSec: null
  };
}

export function getUbuntuSummitMascotBox(config: HaloFieldConfig): MascotBox | null {
  const scale = Math.max(0, toNumber(config.composition.scale, 0));
  if (scale <= 0) {
    return null;
  }

  return {
    center_x_px: toNumber(config.composition.center_x_px, 0),
    center_y_px: toNumber(config.composition.center_y_px, 0),
    draw_size_px: COMPOSITION_SIZE_PX * scale
  };
}

export function getUbuntuSummitAnimationPhase(
  playbackTimeSec: number,
  runtimeTiming: RuntimeTiming,
  forceDotFinal = false
): UbuntuSummitAnimationPhase {
  if (!forceDotFinal && playbackTimeSec <= runtimeTiming.dot_end_sec) {
    return "dot-intro";
  }

  if (playbackTimeSec <= runtimeTiming.playback_end_sec) {
    return "finale";
  }

  return "screensaver";
}

export function buildUbuntuSummitAnimationSceneDescriptor(
  params: UbuntuSummitAnimationParams
): UbuntuSummitAnimationSceneDescriptor {
  const playbackTimeSec = Math.max(0, toNumber(params.playbackTimeSec, 0));
  const frameWidthPx = Math.max(0, toNumber(params.frameWidthPx, 0));
  const frameHeightPx = Math.max(0, toNumber(params.frameHeightPx, 0));
  const motionConfig = resolveMotionConfig(params.haloConfig);
  const { runtimeTiming, motionTiming } = buildUbuntuSummitMotionTiming(params.haloConfig, motionConfig);
  const phase = getUbuntuSummitAnimationPhase(
    playbackTimeSec,
    runtimeTiming,
    Boolean(params.forceDotFinal)
  );
  const mascotBox = getUbuntuSummitMascotBox(params.haloConfig);
  const fullFrameOuterRadiusPx = getFullFrameOuterRadius(params.haloConfig, frameWidthPx, frameHeightPx);
  const effectivePlaybackTimeSec = Math.max(0, playbackTimeSec);
  const isDotComplete = effectivePlaybackTimeSec >= runtimeTiming.dot_end_sec;
  const isPlaybackComplete = effectivePlaybackTimeSec >= runtimeTiming.playback_end_sec;
  const screensaverStartTimeSec = runtimeTiming.playback_end_sec;
  const useScreensaverField = isPlaybackComplete && Boolean(params.haloConfig.screensaver) && hasDynamicScreensaverMotion(params.haloConfig);
  const effectiveOrbitCount = getEffectiveOrbitCount(
    params.haloConfig,
    effectivePlaybackTimeSec,
    screensaverStartTimeSec
  );
  const effectiveSpokeCount = getEffectiveSpokeCount(
    params.haloConfig,
    effectivePlaybackTimeSec,
    screensaverStartTimeSec
  );
  const configFingerprint = getHaloConfigFingerprint(params.haloConfig);
  const previousTransitionState = params.previousTransitionState?.configFingerprint === configFingerprint
    ? params.previousTransitionState
    : createEmptyTransitionState(configFingerprint);
  const hasPlaybackRewound = previousTransitionState.previousPlaybackTimeSec !== null
    && effectivePlaybackTimeSec < previousTransitionState.previousPlaybackTimeSec;
  const previousWidthPhaseUBySource = hasPlaybackRewound
    ? new Map<number, number>()
    : toTransitionMap(previousTransitionState.spokeWidthPhaseUBySource);
  const previousClipCenterXBySource = hasPlaybackRewound
    ? new Map<number, number>()
    : toTransitionMap(previousTransitionState.spokeClipCenterXBySource);
  const lastWidthTransitionTimeSec = hasPlaybackRewound
    ? null
    : previousTransitionState.lastWidthTransitionTimeSec;
  const haloU = getFinaleHaloU(
    effectivePlaybackTimeSec,
    runtimeTiming,
    params.haloConfig,
    isPlaybackComplete
  );
  const screensaverFieldState = useScreensaverField
    ? buildPostFinaleHaloFieldState({
        config: params.haloConfig,
        mascotBox,
        playbackTimeSec: effectivePlaybackTimeSec,
        effectiveSpokeCount,
        effectiveOrbitCount,
        previousWidthPhaseUBySource,
        previousClipCenterXBySource,
        lastWidthTransitionTimeSec,
        fullFrameOuterRadiusPx
      })
    : null;
  const nextTransitionState: UbuntuSummitAnimationTransitionState = screensaverFieldState
    ? {
        configFingerprint,
        previousPlaybackTimeSec: effectivePlaybackTimeSec,
        spokeWidthPhaseUBySource: toTransitionEntries(screensaverFieldState.next_spoke_width_phase_u_by_source),
        spokeClipCenterXBySource: toTransitionEntries(screensaverFieldState.next_spoke_clip_center_x_by_source),
        lastWidthTransitionTimeSec: screensaverFieldState.spoke_width_transition_playback_time_sec
      }
    : {
        configFingerprint,
        previousPlaybackTimeSec: effectivePlaybackTimeSec,
        spokeWidthPhaseUBySource: [],
        spokeClipCenterXBySource: [],
        lastWidthTransitionTimeSec: null
      };
  const reveal = getRevealState(
    params.haloConfig,
    mascotBox,
    fullFrameOuterRadiusPx,
    haloU,
    isPlaybackComplete
  );
  const mascotMotion = buildMascotMotionState(
    effectivePlaybackTimeSec,
    runtimeTiming,
    motionTiming,
    params.haloConfig,
    motionConfig,
    Boolean(params.forceMascotFinal)
  );
  const haloOuterRadiusPx = screensaverFieldState
    ? screensaverFieldState.halo_outer_radius_px
    : mascotBox ? mascotBox.draw_size_px * 0.5 : 0;

  return {
    family: "ubuntu-summit-animation",
    playbackTimeSec,
    phase,
    forceDotFinal: Boolean(params.forceDotFinal),
    forceMascotFinal: Boolean(params.forceMascotFinal),
    haloConfig: params.haloConfig,
    mascotBox,
    releaseLabels: UBUNTU_RELEASE_LABELS,
    runtimeTiming,
    loopTimeSec: Math.max(0, playbackTimeSec - runtimeTiming.playback_end_sec),
    frameState: {
      effectivePlaybackTimeSec,
      dotTimeSec: Math.min(effectivePlaybackTimeSec, runtimeTiming.dot_end_sec),
      isDotComplete,
      isPlaybackComplete,
      useScreensaverField,
      effectiveOrbitCount,
      effectiveSpokeCount,
      haloU,
      haloOuterRadiusPx,
      fullFrameOuterRadiusPx,
      reveal,
      motionTiming,
      mascotMotion,
      screensaverFieldState,
      nextTransitionState
    }
  };
}

export const ubuntuSummitAnimationOperator: OperatorDefinition<UbuntuSummitAnimationParams> = {
  key: UBUNTU_SUMMIT_ANIMATION_OPERATOR_KEY,
  version: "0.1.0",
  inputs: [],
  outputs: [
    {
      key: "sceneDescriptor",
      kind: "scene-family-animation",
      description: "Coarse scene-family descriptor for the full Ubuntu Summit mascot animation parity port."
    }
  ],
  run({ params }) {
    return {
      sceneDescriptor: buildUbuntuSummitAnimationSceneDescriptor(params)
    };
  }
};