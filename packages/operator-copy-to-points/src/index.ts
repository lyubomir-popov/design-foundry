import type {
  ColorRgba,
  InstanceRecord,
  InstanceSet,
  OperatorDefinition,
  PointField,
  PrototypeDefinition,
  PrototypeLibrary,
  Quaternion,
  Vector3
} from "@design-foundry/core-types";

export interface CopyToPointsParams {
  defaultPrototypeId?: string;
  prototypeIdAttribute?: string;
  pscaleAttribute?: string;
  scaleAttribute?: string;
  normalAttribute?: string;
  upAttribute?: string;
  orientAttribute?: string;
  colorAttribute?: string;
  copyPointAttributes?: boolean;
}

function toNumber(value: unknown, fallback: number): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toVector3(value: unknown, fallback: Vector3): Vector3 {
  if (Array.isArray(value) && value.length >= 3) {
    return {
      x: toNumber(value[0], fallback.x),
      y: toNumber(value[1], fallback.y),
      z: toNumber(value[2], fallback.z)
    };
  }

  if (value && typeof value === "object") {
    const candidate = value as Partial<Vector3>;
    return {
      x: toNumber(candidate.x, fallback.x),
      y: toNumber(candidate.y, fallback.y),
      z: toNumber(candidate.z, fallback.z)
    };
  }

  const uniformScale = Number(value);
  if (Number.isFinite(uniformScale)) {
    return {
      x: uniformScale,
      y: uniformScale,
      z: uniformScale
    };
  }

  return fallback;
}

function toQuaternion(value: unknown): Quaternion | undefined {
  if (Array.isArray(value) && value.length >= 4) {
    return {
      x: toNumber(value[0], 0),
      y: toNumber(value[1], 0),
      z: toNumber(value[2], 0),
      w: toNumber(value[3], 1)
    };
  }

  if (value && typeof value === "object") {
    const candidate = value as Partial<Quaternion>;
    if (
      [candidate.x, candidate.y, candidate.z, candidate.w].some((component) => typeof component !== "undefined")
    ) {
      return {
        x: toNumber(candidate.x, 0),
        y: toNumber(candidate.y, 0),
        z: toNumber(candidate.z, 0),
        w: toNumber(candidate.w, 1)
      };
    }
  }

  return undefined;
}

function toColor(value: unknown): ColorRgba | undefined {
  if (Array.isArray(value) && value.length >= 3) {
    return {
      r: toNumber(value[0], 1),
      g: toNumber(value[1], 1),
      b: toNumber(value[2], 1),
      ...(typeof value[3] !== "undefined" ? { a: toNumber(value[3], 1) } : {})
    };
  }

  if (value && typeof value === "object") {
    const candidate = value as Partial<ColorRgba>;
    if (
      [candidate.r, candidate.g, candidate.b].some((component) => typeof component !== "undefined")
    ) {
      return {
        r: toNumber(candidate.r, 1),
        g: toNumber(candidate.g, 1),
        b: toNumber(candidate.b, 1),
        ...(typeof candidate.a !== "undefined" ? { a: toNumber(candidate.a, 1) } : {})
      };
    }
  }

  return undefined;
}

function multiplyScale(scale: Vector3, pscale: number): Vector3 {
  return {
    x: scale.x * pscale,
    y: scale.y * pscale,
    z: scale.z * pscale
  };
}

function getPrototypeId(pointAttributes: Record<string, unknown>, params: CopyToPointsParams): string {
  const prototypeIdAttribute = params.prototypeIdAttribute || "prototype_id";
  const attributeValue = pointAttributes[prototypeIdAttribute];
  if (typeof attributeValue === "string" && attributeValue.trim()) {
    return attributeValue.trim();
  }
  if (typeof params.defaultPrototypeId === "string" && params.defaultPrototypeId.trim()) {
    return params.defaultPrototypeId.trim();
  }

  throw new Error(
    `Copy-to-points needs either point attribute "${prototypeIdAttribute}" or params.defaultPrototypeId.`
  );
}

function getPrototypeMap(prototypeLibrary: PrototypeLibrary): Map<string, PrototypeDefinition> {
  return new Map(prototypeLibrary.prototypes.map((prototype) => [prototype.id, prototype]));
}

export function resolveCopyToPoints(
  pointField: PointField,
  prototypeLibrary: PrototypeLibrary,
  params: CopyToPointsParams = {}
): InstanceSet {
  const prototypeMap = getPrototypeMap(prototypeLibrary);
  const pscaleAttribute = params.pscaleAttribute || "pscale";
  const scaleAttribute = params.scaleAttribute || "scale";
  const normalAttribute = params.normalAttribute || "normal";
  const upAttribute = params.upAttribute || "up";
  const orientAttribute = params.orientAttribute || "orient";
  const colorAttribute = params.colorAttribute || "color";
  const copyPointAttributes = params.copyPointAttributes ?? true;

  const instances: InstanceRecord[] = pointField.points.map((point, index) => {
    const prototypeId = getPrototypeId(point.attributes, params);
    const prototype = prototypeMap.get(prototypeId);
    if (!prototype) {
      throw new Error(`Unknown prototype "${prototypeId}" for point ${point.id}.`);
    }

    const baseScale = toVector3(point.attributes[scaleAttribute], { x: 1, y: 1, z: 1 });
    const pscale = toNumber(point.attributes[pscaleAttribute], 1);
    const scale = multiplyScale(baseScale, pscale);
    const normal = toVector3(point.attributes[normalAttribute], { x: 0, y: 0, z: 1 });
    const up = toVector3(point.attributes[upAttribute], { x: 0, y: 1, z: 0 });
    const orient = toQuaternion(point.attributes[orientAttribute]);
    const color = toColor(point.attributes[colorAttribute]);

    return {
      id: `instance-${index}`,
      pointId: point.id,
      prototypeId: prototype.id,
      position: point.position,
      rotationEuler: { x: 0, y: 0, z: 0 },
      scale,
      pscale,
      normal,
      up,
      ...(orient ? { orient } : {}),
      ...(color ? { color } : {}),
      attributes: copyPointAttributes ? { ...point.attributes } : {}
    };
  });

  return {
    prototypes: prototypeLibrary.prototypes,
    instances,
    detail: {
      source_point_count: pointField.points.length,
      instance_count: instances.length,
      prototype_count: prototypeLibrary.prototypes.length,
      ...pointField.detail
    }
  };
}

export const copyToPointsOperator: OperatorDefinition<CopyToPointsParams> = {
  key: "operator.copy-to-points",
  version: "0.1.0",
  inputs: [
    {
      key: "pointField",
      kind: "point-field",
      description: "Points carrying instancing attributes such as pscale, normal, color, and prototype selection."
    },
    {
      key: "prototypeLibrary",
      kind: "prototype-library",
      description: "Prototype geometry or SVG definitions that can be instanced onto points."
    }
  ],
  outputs: [
    {
      key: "instanceSet",
      kind: "instance-set",
      description: "Resolved instances ready for a Three.js or future SVG renderer adapter."
    }
  ],
  run({ params, inputs }) {
    const pointField = inputs.pointField as PointField | undefined;
    const prototypeLibrary = inputs.prototypeLibrary as PrototypeLibrary | undefined;
    if (!pointField) {
      throw new Error("Copy-to-points requires a pointField input.");
    }
    if (!prototypeLibrary) {
      throw new Error("Copy-to-points requires a prototypeLibrary input.");
    }

    return {
      instanceSet: resolveCopyToPoints(pointField, prototypeLibrary, params)
    };
  }
};