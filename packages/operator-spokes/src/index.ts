import type { ColorRgba, OperatorDefinition, PointField, Vector3 } from "@design-foundry/core-types";

export const SPOKES_OPERATOR_KEY = "operator.spokes";

export interface SpokeBandSpec {
  spokeCount: number;
  pointsPerSpoke: number;
  innerRadiusPx: number;
  outerRadiusPx: number;
  angleOffsetDeg?: number;
  angularVelocityDegPerSecond?: number;
  prototypeIds?: string[];
  pscaleStart?: number;
  pscaleEnd?: number;
  color?: ColorRgba;
  zPx?: number;
}

export interface SpokesParams {
  timeSeconds: number;
  center?: Partial<Vector3>;
  bands: SpokeBandSpec[];
  defaultPrototypeIds?: string[];
  defaultPscale?: number;
  normal?: Partial<Vector3>;
  up?: Partial<Vector3>;
}

function toNumber(value: unknown, fallback: number): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toVector3(value: Partial<Vector3> | null | undefined, fallback: Vector3): Vector3 {
  return {
    x: toNumber(value?.x, fallback.x),
    y: toNumber(value?.y, fallback.y),
    z: toNumber(value?.z, fallback.z)
  };
}

function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function resolvePrototypeId(band: SpokeBandSpec, defaultPrototypeIds: string[], pointIndex: number): string | undefined {
  const bandPrototypeIds = band.prototypeIds?.filter((value) => value.trim()) ?? [];
  const availablePrototypeIds = bandPrototypeIds.length > 0 ? bandPrototypeIds : defaultPrototypeIds;
  if (!availablePrototypeIds.length) {
    return undefined;
  }

  return availablePrototypeIds[pointIndex % availablePrototypeIds.length];
}

export function resolveSpokeField(params: SpokesParams): PointField {
  const center = toVector3(params.center, { x: 0, y: 0, z: 0 });
  const normal = toVector3(params.normal, { x: 0, y: 0, z: 1 });
  const up = toVector3(params.up, { x: 0, y: 1, z: 0 });
  const timeSeconds = toNumber(params.timeSeconds, 0);
  const defaultPrototypeIds = params.defaultPrototypeIds?.filter((value) => value.trim()) ?? [];
  const defaultPscale = Math.max(0, toNumber(params.defaultPscale, 1));
  const safeBands = params.bands ?? [];

  const points = safeBands.flatMap((band, bandIndex) => {
    const spokeCount = Math.max(0, Math.round(toNumber(band.spokeCount, 0)));
    const pointsPerSpoke = Math.max(0, Math.round(toNumber(band.pointsPerSpoke, 0)));
    const innerRadiusPx = Math.max(0, toNumber(band.innerRadiusPx, 0));
    const outerRadiusPx = Math.max(innerRadiusPx, toNumber(band.outerRadiusPx, innerRadiusPx));
    const angleOffsetDeg = toNumber(band.angleOffsetDeg, 0);
    const angularVelocityDegPerSecond = toNumber(band.angularVelocityDegPerSecond, 0);
    const pscaleStart = Math.max(0, toNumber(band.pscaleStart, defaultPscale));
    const pscaleEnd = Math.max(0, toNumber(band.pscaleEnd, pscaleStart));
    const zPx = toNumber(band.zPx, 0);

    return Array.from({ length: spokeCount }, (_, spokeIndex) => {
      const spokeFraction = spokeCount <= 0 ? 0 : spokeIndex / spokeCount;
      const angleDeg = angleOffsetDeg + spokeFraction * 360 + angularVelocityDegPerSecond * timeSeconds;
      const angleRad = toRadians(angleDeg);

      return Array.from({ length: pointsPerSpoke }, (_, pointIndex) => {
        const radialT = pointsPerSpoke <= 1 ? 0 : pointIndex / (pointsPerSpoke - 1);
        const radiusPx = lerp(innerRadiusPx, outerRadiusPx, radialT);
        const pscale = lerp(pscaleStart, pscaleEnd, radialT);
        const prototypeId = resolvePrototypeId(band, defaultPrototypeIds, pointIndex);

        return {
          id: `spoke-${bandIndex}-${spokeIndex}-${pointIndex}`,
          position: {
            x: center.x + Math.cos(angleRad) * radiusPx,
            y: center.y + Math.sin(angleRad) * radiusPx,
            z: center.z + zPx
          },
          attributes: {
            spoke_band_index: bandIndex,
            spoke_index: spokeIndex,
            spoke_point_index: pointIndex,
            spoke_radius_px: radiusPx,
            spoke_angle_deg: angleDeg,
            spoke_t: radialT,
            spoke_time_seconds: timeSeconds,
            pscale,
            normal,
            up,
            ...(prototypeId ? { prototype_id: prototypeId } : {}),
            ...(band.color ? { color: band.color } : {})
          }
        };
      });
    }).flat();
  });

  return {
    points,
    detail: {
      center,
      band_count: safeBands.length,
      point_count: points.length,
      time_seconds: timeSeconds
    }
  };
}

export const spokesOperator: OperatorDefinition<SpokesParams> = {
  key: SPOKES_OPERATOR_KEY,
  version: "0.1.0",
  inputs: [
    {
      key: "center",
      kind: "vector3",
      description: "Optional external center to offset the spoke field."
    }
  ],
  outputs: [
    {
      key: "pointField",
      kind: "point-field",
      description: "Resolved spoke points carrying prototype, scale, and color attributes for downstream instancing."
    }
  ],
  run({ params, inputs }) {
    const inputCenter = inputs.center as Partial<Vector3> | undefined;
    const resolvedParams: SpokesParams = inputCenter
      ? {
          ...params,
          center: inputCenter
        }
      : params;

    return {
      pointField: resolveSpokeField(resolvedParams)
    };
  }
};