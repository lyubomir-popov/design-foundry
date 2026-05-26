import type {
  InstanceRecord,
  InstanceSet,
  OperatorDefinition,
  OperatorParameterSchema,
  PointField,
  PrototypeDefinition,
  Vector3
} from "@design-foundry/core-types";

export const SVG_INSTANCING_OPERATOR_KEY = "operator.svg-instancing";

export interface SvgInstancingParams {
  defaultSvgAssetPath: string;
  defaultPrototypeId?: string;
  svgAssetPathAttribute?: string;
  prototypeIdAttribute?: string;
  pscaleAttribute?: string;
  scaleAttribute?: string;
  copyPointAttributes?: boolean;
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    return { x: uniformScale, y: uniformScale, z: uniformScale };
  }

  return fallback;
}

function multiplyScale(scale: Vector3, pscale: number): Vector3 {
  return {
    x: scale.x * pscale,
    y: scale.y * pscale,
    z: scale.z * pscale
  };
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveAssetPath(pointAttributes: Record<string, unknown>, params: SvgInstancingParams): string {
  const attributeKey = params.svgAssetPathAttribute ?? "svg_asset_path";
  const attributeAssetPath = toNonEmptyString(pointAttributes[attributeKey]);
  if (attributeAssetPath) {
    return attributeAssetPath;
  }

  const defaultAssetPath = toNonEmptyString(params.defaultSvgAssetPath);
  if (!defaultAssetPath) {
    throw new Error(
      `SVG instancing requires either point attribute "${attributeKey}" or params.defaultSvgAssetPath.`
    );
  }

  return defaultAssetPath;
}

function resolvePrototypeId(pointAttributes: Record<string, unknown>, params: SvgInstancingParams): string {
  const attributeKey = params.prototypeIdAttribute ?? "prototype_id";
  const attributePrototypeId = toNonEmptyString(pointAttributes[attributeKey]);
  if (attributePrototypeId) {
    return attributePrototypeId;
  }

  return toNonEmptyString(params.defaultPrototypeId) ?? "svg-prototype";
}

function buildPrototypeMap(pointField: PointField, params: SvgInstancingParams): Map<string, PrototypeDefinition> {
  const prototypes = new Map<string, PrototypeDefinition>();

  for (const point of pointField.points) {
    const prototypeId = resolvePrototypeId(point.attributes, params);
    const assetPath = resolveAssetPath(point.attributes, params);

    const existing = prototypes.get(prototypeId);
    if (existing) {
      if (existing.source !== assetPath) {
        throw new Error(
          `Prototype id "${prototypeId}" resolved to multiple SVG assets (${existing.source} vs ${assetPath}).`
        );
      }
      continue;
    }

    prototypes.set(prototypeId, {
      id: prototypeId,
      kind: "svg",
      source: assetPath
    });
  }

  return prototypes;
}

export function resolveSvgInstancing(pointField: PointField, params: SvgInstancingParams): InstanceSet {
  const pscaleAttribute = params.pscaleAttribute ?? "pscale";
  const scaleAttribute = params.scaleAttribute ?? "scale";
  const copyPointAttributes = params.copyPointAttributes ?? true;
  const prototypesById = buildPrototypeMap(pointField, params);

  const instances: InstanceRecord[] = pointField.points.map((point, index) => {
    const prototypeId = resolvePrototypeId(point.attributes, params);
    const baseScale = toVector3(point.attributes[scaleAttribute], { x: 1, y: 1, z: 1 });
    const pscale = toNumber(point.attributes[pscaleAttribute], 1);

    return {
      id: `svg-instance-${index}`,
      pointId: point.id,
      prototypeId,
      position: point.position,
      rotationEuler: { x: 0, y: 0, z: 0 },
      scale: multiplyScale(baseScale, pscale),
      pscale,
      normal: { x: 0, y: 0, z: 1 },
      up: { x: 0, y: 1, z: 0 },
      attributes: copyPointAttributes ? { ...point.attributes } : {}
    };
  });

  return {
    prototypes: Array.from(prototypesById.values()),
    instances,
    detail: {
      source_point_count: pointField.points.length,
      instance_count: instances.length,
      prototype_count: prototypesById.size,
      generator: "svg-instancing",
      ...pointField.detail
    }
  };
}

export const SVG_INSTANCING_PARAMETER_SCHEMA: OperatorParameterSchema = {
  sections: [
    { key: "source", title: "Source" },
    { key: "mapping", title: "Point Mapping" }
  ],
  fields: [
    {
      kind: "textarea",
      sectionKey: "source",
      path: "defaultSvgAssetPath",
      label: "Default SVG asset path",
      placeholder: "./assets/icon.svg",
      rows: 2
    },
    {
      kind: "textarea",
      sectionKey: "source",
      path: "defaultPrototypeId",
      label: "Default prototype id",
      rows: 1
    },
    {
      kind: "textarea",
      sectionKey: "mapping",
      path: "svgAssetPathAttribute",
      label: "SVG path attribute",
      rows: 1
    },
    {
      kind: "textarea",
      sectionKey: "mapping",
      path: "prototypeIdAttribute",
      label: "Prototype id attribute",
      rows: 1
    },
    {
      kind: "textarea",
      sectionKey: "mapping",
      path: "pscaleAttribute",
      label: "Pscale attribute",
      rows: 1
    },
    {
      kind: "textarea",
      sectionKey: "mapping",
      path: "scaleAttribute",
      label: "Scale attribute",
      rows: 1
    },
    {
      kind: "boolean",
      sectionKey: "mapping",
      path: "copyPointAttributes",
      label: "Copy point attributes"
    }
  ]
};

export const svgInstancingOperator: OperatorDefinition<SvgInstancingParams> = {
  key: SVG_INSTANCING_OPERATOR_KEY,
  version: "0.1.0",
  parameterSchema: SVG_INSTANCING_PARAMETER_SCHEMA,
  inputs: [
    {
      key: "pointField",
      kind: "point-field",
      description: "Points that should receive SVG instances."
    }
  ],
  outputs: [
    {
      key: "instanceSet",
      kind: "instance-set",
      description: "Resolved SVG instance set for downstream render adapters."
    }
  ],
  run({ params, inputs }) {
    const pointField = inputs.pointField as PointField | undefined;
    if (!pointField) {
      throw new Error("SVG instancing requires a pointField input.");
    }

    return {
      instanceSet: resolveSvgInstancing(pointField, params)
    };
  }
};
