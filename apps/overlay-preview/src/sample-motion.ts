import type { ColorRgba, FrameSize, Vector3 } from "@design-foundry/core-types";
import type { OrbitsParams } from "@design-foundry/operator-orbits";
import type { SpokesParams } from "@design-foundry/operator-spokes";

export type MotionLayerMode = "none" | "orbits" | "spokes" | "both";

export interface PreviewMotionState {
  mode: MotionLayerMode;
  animate: boolean;
  speed: number;
  timeSeconds: number;
  opacity: number;
}

function createColor(r: number, g: number, b: number, a = 1): ColorRgba {
  return { r, g, b, a };
}

function getStageUnit(frame: FrameSize): number {
  return Math.max(320, Math.min(frame.widthPx, frame.heightPx));
}

export function getPreviewMotionCenter(frame: FrameSize): Vector3 {
  return {
    x: frame.widthPx * 0.5,
    y: frame.heightPx * 0.58,
    z: 0
  };
}

export function createDefaultMotionState(): PreviewMotionState {
  return {
    mode: "both",
    animate: true,
    speed: 0.8,
    timeSeconds: 0,
    opacity: 0.92
  };
}

export function buildPreviewOrbitParams(frame: FrameSize, timeSeconds: number): OrbitsParams {
  const unit = getStageUnit(frame);
  const center = getPreviewMotionCenter(frame);

  return {
    timeSeconds,
    center,
    defaultPscale: 1,
    rings: [
      {
        pointCount: 12,
        radiusPx: unit * 0.055,
        angularVelocityDegPerSecond: 14,
        pscale: 0.28,
        color: createColor(1, 1, 1, 0.42)
      },
      {
        pointCount: 18,
        radiusPx: unit * 0.082,
        angularVelocityDegPerSecond: -12,
        angleOffsetDeg: 6,
        pscale: 0.34,
        color: createColor(1, 1, 1, 0.48)
      },
      {
        pointCount: 24,
        radiusPx: unit * 0.108,
        angularVelocityDegPerSecond: 10,
        angleOffsetDeg: -10,
        pscale: 0.38,
        color: createColor(1, 0.95, 0.9, 0.52)
      },
      {
        pointCount: 30,
        radiusPx: unit * 0.136,
        angularVelocityDegPerSecond: -8,
        angleOffsetDeg: 4,
        pscale: 0.42,
        color: createColor(1, 0.92, 0.82, 0.58)
      },
      {
        pointCount: 36,
        radiusPx: unit * 0.164,
        angularVelocityDegPerSecond: 7,
        angleOffsetDeg: -12,
        pscale: 0.46,
        color: createColor(1, 0.9, 0.76, 0.62)
      },
      {
        pointCount: 42,
        radiusPx: unit * 0.194,
        angularVelocityDegPerSecond: -5,
        angleOffsetDeg: 10,
        pscale: 0.5,
        color: createColor(1, 0.94, 0.88, 0.56)
      },
      {
        pointCount: 48,
        radiusPx: unit * 0.224,
        angularVelocityDegPerSecond: 4,
        angleOffsetDeg: -16,
        pscale: 0.54,
        color: createColor(1, 1, 1, 0.46)
      },
      {
        pointCount: 60,
        radiusPx: unit * 0.258,
        angularVelocityDegPerSecond: -3,
        angleOffsetDeg: 0,
        pscale: 0.58,
        color: createColor(1, 1, 1, 0.36)
      }
    ]
  };
}

export function buildPreviewSpokesParams(frame: FrameSize, timeSeconds: number): SpokesParams {
  const unit = getStageUnit(frame);
  const center = getPreviewMotionCenter(frame);

  return {
    timeSeconds,
    center,
    defaultPscale: 0.8,
    bands: [
      {
        spokeCount: 60,
        pointsPerSpoke: 8,
        innerRadiusPx: unit * 0.055,
        outerRadiusPx: unit * 0.26,
        angularVelocityDegPerSecond: 6,
        pscaleStart: 0.18,
        pscaleEnd: 0.46,
        color: createColor(1, 1, 1, 0.28)
      },
      {
        spokeCount: 30,
        pointsPerSpoke: 6,
        innerRadiusPx: unit * 0.17,
        outerRadiusPx: unit * 0.34,
        angleOffsetDeg: 6,
        angularVelocityDegPerSecond: -3,
        pscaleStart: 0.2,
        pscaleEnd: 0.52,
        color: createColor(1, 0.92, 0.82, 0.16)
      }
    ]
  };
}