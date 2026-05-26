import type { ColorRgba, OperatorDefinition, OperatorParameterSchema, PointField, Vector3 } from "@design-foundry/core-types";

export interface PhyllotaxisParams {
  numPoints: number;
  radius: number;
  radiusFalloff: number;
  angleOffsetDeg: number;
  origin?: Partial<Vector3>;
}

const DEFAULT_PHYLLOTAXIS_POINT_COLOR: ColorRgba = {
  r: 255,
  g: 255,
  b: 255,
  a: 1
};

function toVector3(value: Partial<Vector3> | null | undefined): Vector3 {
  return {
    x: Number(value?.x ?? 0),
    y: Number(value?.y ?? 0),
    z: Number(value?.z ?? 0)
  };
}

function addVectors(left: Vector3, right: Vector3): Vector3 {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z
  };
}

function polarToCartesian(theta: number, radius: number): Vector3 {
  return {
    x: Math.cos(theta) * radius,
    y: Math.sin(theta) * radius,
    z: 0
  };
}

export function resolvePhyllotaxisField(
  params: PhyllotaxisParams,
  centroidInput?: Partial<Vector3> | null
): PointField {
  const numPoints = Math.max(0, Math.round(Number(params.numPoints ?? 0)));
  const simulationRadius = Math.max(0, Number(params.radius ?? 0));
  const radiusFalloff = Number(params.radiusFalloff ?? 1);
  const angleOffsetDeg = Number(params.angleOffsetDeg ?? 0);
  const phi = (1 + Math.sqrt(5)) * 0.5;
  let goldenAngle = 2 * Math.PI * (1 - 1 / phi);
  goldenAngle += angleOffsetDeg * Math.PI / 180;

  const centroid = toVector3(centroidInput);
  const origin = toVector3(params.origin);
  const center = addVectors(centroid, origin);

  let maxRadius = 0;
  const points = [];

  for (let index = 0; index < numPoints; index += 1) {
    const normalizedIndex = numPoints <= 0 ? 0 : index / Math.max(1, numPoints);
    const pointRadius = simulationRadius * Math.pow(normalizedIndex, radiusFalloff);
    const theta = goldenAngle * index;
    const position = addVectors(center, polarToCartesian(theta, pointRadius));

    points.push({
      id: `phyllotaxis-${index}`,
      position,
      attributes: {
        philo_index: index,
        philo_radius: pointRadius,
        color: DEFAULT_PHYLLOTAXIS_POINT_COLOR
      }
    });
    maxRadius = Math.max(maxRadius, pointRadius);
  }

  return {
    points,
    detail: {
      center,
      max_radius: maxRadius,
      num_points: numPoints,
      radius: simulationRadius,
      radius_falloff: radiusFalloff,
      angle_offset_deg: angleOffsetDeg,
      golden_angle_rad: goldenAngle
    }
  };
}

export const PHYLLOTAXIS_PARAMETER_SCHEMA: OperatorParameterSchema = {
  sections: [
    { key: "distribution", title: "Distribution" }
  ],
  fields: [
    { kind: "number", sectionKey: "distribution", path: "numPoints", label: "Points", min: 1, max: 4000, step: 1 },
    { kind: "slider", sectionKey: "distribution", path: "radius", label: "Radius", min: 1, max: 1200, step: 1 },
    { kind: "slider", sectionKey: "distribution", path: "radiusFalloff", label: "Radius falloff", min: 0.05, max: 2, step: 0.01 },
    { kind: "slider", sectionKey: "distribution", path: "angleOffsetDeg", label: "Angle offset", min: -180, max: 180, step: 0.1 }
  ]
};

export const phyllotaxisOperator: OperatorDefinition<PhyllotaxisParams> = {
  key: "operator.phyllotaxis",
  version: "0.1.0",
  parameterSchema: PHYLLOTAXIS_PARAMETER_SCHEMA,
  inputs: [
    {
      key: "centroid",
      kind: "vector3",
      description: "Optional centroid input to offset the phyllotaxis center."
    }
  ],
  outputs: [
    {
      key: "pointField",
      kind: "point-field",
      description: "Generated phyllotaxis points with radius metadata and detail attributes."
    }
  ],
  run({ params, inputs }) {
    return {
      pointField: resolvePhyllotaxisField(params, inputs.centroid as Partial<Vector3> | null | undefined)
    };
  }
};