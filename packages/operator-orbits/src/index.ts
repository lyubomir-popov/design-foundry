import type { ColorRgba, OperatorDefinition, PointField, PrototypeLibrary, Vector3 } from "@design-foundry/core-types";

export const ORBITS_OPERATOR_KEY = "operator.orbits";

export interface OrbitRingSpec {
  pointCount: number;
  radiusPx: number;
  angularVelocityDegPerSecond: number;
  angleOffsetDeg?: number;
  prototypeIds?: string[];
  pscale?: number;
  color?: ColorRgba;
  zPx?: number;
}

export interface OrbitsParams {
  timeSeconds: number;
  center?: Partial<Vector3>;
  rings: OrbitRingSpec[];
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

function resolvePrototypeId(
  ring: OrbitRingSpec,
  defaultPrototypeIds: string[],
  pointIndex: number
): string | undefined {
  const ringPrototypeIds = ring.prototypeIds?.filter((value) => value.trim()) ?? [];
  const availablePrototypeIds = ringPrototypeIds.length > 0 ? ringPrototypeIds : defaultPrototypeIds;
  if (!availablePrototypeIds.length) {
    return undefined;
  }

  return availablePrototypeIds[pointIndex % availablePrototypeIds.length];
}

export function resolveOrbitField(params: OrbitsParams): PointField {
  const center = toVector3(params.center, { x: 0, y: 0, z: 0 });
  const normal = toVector3(params.normal, { x: 0, y: 0, z: 1 });
  const up = toVector3(params.up, { x: 0, y: 1, z: 0 });
  const timeSeconds = toNumber(params.timeSeconds, 0);
  const defaultPrototypeIds = params.defaultPrototypeIds?.filter((value) => value.trim()) ?? [];
  const defaultPscale = Math.max(0, toNumber(params.defaultPscale, 1));
  const safeRings = params.rings ?? [];

  const points = safeRings.flatMap((ring, ringIndex) => {
    const pointCount = Math.max(0, Math.round(toNumber(ring.pointCount, 0)));
    const radiusPx = Math.max(0, toNumber(ring.radiusPx, 0));
    const angularVelocityDegPerSecond = toNumber(ring.angularVelocityDegPerSecond, 0);
    const baseAngleOffsetDeg = toNumber(ring.angleOffsetDeg, 0);
    const zPx = toNumber(ring.zPx, 0);
    const pscale = Math.max(0, toNumber(ring.pscale, defaultPscale));

    return Array.from({ length: pointCount }, (_, pointIndex) => {
      const fractionalTurn = pointCount <= 0 ? 0 : pointIndex / pointCount;
      const angleDeg = baseAngleOffsetDeg + fractionalTurn * 360 + angularVelocityDegPerSecond * timeSeconds;
      const angleRad = toRadians(angleDeg);
      const prototypeId = resolvePrototypeId(ring, defaultPrototypeIds, pointIndex);

      return {
        id: `orbit-${ringIndex}-point-${pointIndex}`,
        position: {
          x: center.x + Math.cos(angleRad) * radiusPx,
          y: center.y + Math.sin(angleRad) * radiusPx,
          z: center.z + zPx
        },
        attributes: {
          orbit_index: ringIndex,
          orbit_point_index: pointIndex,
          orbit_radius_px: radiusPx,
          orbit_angle_deg: angleDeg,
          orbit_time_seconds: timeSeconds,
          pscale,
          normal,
          up,
          ...(prototypeId ? { prototype_id: prototypeId } : {}),
          ...(ring.color ? { color: ring.color } : {})
        }
      };
    });
  });

  return {
    points,
    detail: {
      center,
      ring_count: safeRings.length,
      point_count: points.length,
      time_seconds: timeSeconds
    }
  };
}

export const orbitsOperator: OperatorDefinition<OrbitsParams> = {
  key: ORBITS_OPERATOR_KEY,
  version: "0.1.0",
  inputs: [
    {
      key: "center",
      kind: "vector3",
      description: "Optional external center to offset the orbit field."
    }
  ],
  outputs: [
    {
      key: "pointField",
      kind: "point-field",
      description: "Resolved orbit points carrying prototype, scale, and color attributes for downstream instancing."
    }
  ],
  run({ params, inputs }) {
    const inputCenter = inputs.center as Partial<Vector3> | undefined;
    const resolvedParams: OrbitsParams = inputCenter
      ? {
          ...params,
          center: inputCenter
        }
      : params;

    return {
      pointField: resolveOrbitField(resolvedParams)
    };
  }
};

export function createPrototypeLibraryFromRecords(prototypes: PrototypeLibrary["prototypes"]): PrototypeLibrary {
  return {
    prototypes,
    detail: {
      prototype_count: prototypes.length
    }
  };
}