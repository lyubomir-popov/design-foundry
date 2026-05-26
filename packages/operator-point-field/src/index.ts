import type {
  OperatorDefinition,
  OperatorParameterSchema,
  PointField,
  Vector3
} from "@design-foundry/core-types";

export const POINT_FIELD_OPERATOR_KEY = "operator.point-field";

export type PointFieldGeneratorMode = "grid" | "ring";

export interface PointFieldGeneratorParams {
  mode: PointFieldGeneratorMode;
  pointCount: number;
  seed?: number;
  jitterPx?: number;
  columns?: number;
  widthPx?: number;
  heightPx?: number;
  radiusPx?: number;
  origin?: Partial<Vector3>;
}

const DEFAULT_POINT_COLOR = { r: 255, g: 255, b: 255, a: 1 };

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toVector3(value: Partial<Vector3> | null | undefined): Vector3 {
  return {
    x: toNumber(value?.x, 0),
    y: toNumber(value?.y, 0),
    z: toNumber(value?.z, 0)
  };
}

function addVectors(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  };
}

function createRng(seed: number): () => number {
  let state = Math.floor(seed) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function resolveGridPoints(
  count: number,
  center: Vector3,
  rng: () => number,
  params: PointFieldGeneratorParams,
  jitterPx: number
): PointField {
  const columns = Math.max(1, Math.round(toNumber(params.columns, Math.ceil(Math.sqrt(count)))));
  const rows = Math.max(1, Math.ceil(count / columns));
  const widthPx = Math.max(1, toNumber(params.widthPx, 640));
  const heightPx = Math.max(1, toNumber(params.heightPx, 360));
  const spacingX = columns <= 1 ? 0 : widthPx / (columns - 1);
  const spacingY = rows <= 1 ? 0 : heightPx / (rows - 1);

  const points = Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const baseX = columns <= 1 ? 0 : -widthPx * 0.5 + column * spacingX;
    const baseY = rows <= 1 ? 0 : -heightPx * 0.5 + row * spacingY;
    const jitterX = (rng() * 2 - 1) * jitterPx;
    const jitterY = (rng() * 2 - 1) * jitterPx;

    return {
      id: `point-grid-${index}`,
      position: {
        x: center.x + baseX + jitterX,
        y: center.y + baseY + jitterY,
        z: center.z
      },
      attributes: {
        generator_mode: "grid",
        generator_index: index,
        generator_column: column,
        generator_row: row,
        color: DEFAULT_POINT_COLOR
      }
    };
  });

  return {
    points,
    detail: {
      generator_mode: "grid",
      point_count: count,
      columns,
      rows,
      width_px: widthPx,
      height_px: heightPx,
      jitter_px: jitterPx
    }
  };
}

function resolveRingPoints(
  count: number,
  center: Vector3,
  rng: () => number,
  params: PointFieldGeneratorParams,
  jitterPx: number
): PointField {
  const radiusPx = Math.max(1, toNumber(params.radiusPx, 320));
  const points = Array.from({ length: count }, (_, index) => {
    const angle = (index / Math.max(1, count)) * Math.PI * 2;
    const radialNoise = (rng() * 2 - 1) * jitterPx;
    const jitterX = (rng() * 2 - 1) * jitterPx * 0.5;
    const jitterY = (rng() * 2 - 1) * jitterPx * 0.5;
    const localRadius = Math.max(0, radiusPx + radialNoise);

    return {
      id: `point-ring-${index}`,
      position: {
        x: center.x + Math.cos(angle) * localRadius + jitterX,
        y: center.y + Math.sin(angle) * localRadius + jitterY,
        z: center.z
      },
      attributes: {
        generator_mode: "ring",
        generator_index: index,
        generator_angle_rad: angle,
        generator_radius_px: localRadius,
        color: DEFAULT_POINT_COLOR
      }
    };
  });

  return {
    points,
    detail: {
      generator_mode: "ring",
      point_count: count,
      radius_px: radiusPx,
      jitter_px: jitterPx
    }
  };
}

export function resolvePointField(
  params: PointFieldGeneratorParams,
  centroidInput?: Partial<Vector3> | null
): PointField {
  const count = Math.max(0, Math.round(toNumber(params.pointCount, 0)));
  const mode: PointFieldGeneratorMode = params.mode === "ring" ? "ring" : "grid";
  const seed = Math.round(toNumber(params.seed, 1));
  const jitterPx = clamp(toNumber(params.jitterPx, 0), 0, 1000);
  const center = addVectors(toVector3(params.origin), toVector3(centroidInput));
  const rng = createRng(seed);

  if (count === 0) {
    return {
      points: [],
      detail: {
        generator_mode: mode,
        point_count: 0,
        seed,
        jitter_px: jitterPx
      }
    };
  }

  const field = mode === "ring"
    ? resolveRingPoints(count, center, rng, params, jitterPx)
    : resolveGridPoints(count, center, rng, params, jitterPx);

  return {
    ...field,
    detail: {
      ...field.detail,
      seed,
      center
    }
  };
}

export const POINT_FIELD_PARAMETER_SCHEMA: OperatorParameterSchema = {
  sections: [
    { key: "generator", title: "Generator" },
    { key: "shape", title: "Shape" }
  ],
  fields: [
    {
      kind: "select",
      sectionKey: "generator",
      path: "mode",
      label: "Mode",
      options: [
        { label: "Grid", value: "grid" },
        { label: "Ring", value: "ring" }
      ]
    },
    {
      kind: "number",
      sectionKey: "generator",
      path: "pointCount",
      label: "Point count",
      min: 0,
      max: 100000,
      step: 1
    },
    {
      kind: "number",
      sectionKey: "generator",
      path: "seed",
      label: "Seed",
      min: 0,
      max: 1000000,
      step: 1
    },
    {
      kind: "slider",
      sectionKey: "generator",
      path: "jitterPx",
      label: "Jitter (px)",
      min: 0,
      max: 100,
      step: 1
    },
    {
      kind: "number",
      sectionKey: "shape",
      path: "columns",
      label: "Columns",
      min: 1,
      max: 1000,
      step: 1,
      visibleWhen: {
        path: "mode",
        operator: "eq",
        value: "grid"
      }
    },
    {
      kind: "slider",
      sectionKey: "shape",
      path: "widthPx",
      label: "Grid width",
      min: 1,
      max: 4000,
      step: 1,
      visibleWhen: {
        path: "mode",
        operator: "eq",
        value: "grid"
      }
    },
    {
      kind: "slider",
      sectionKey: "shape",
      path: "heightPx",
      label: "Grid height",
      min: 1,
      max: 4000,
      step: 1,
      visibleWhen: {
        path: "mode",
        operator: "eq",
        value: "grid"
      }
    },
    {
      kind: "slider",
      sectionKey: "shape",
      path: "radiusPx",
      label: "Ring radius",
      min: 1,
      max: 4000,
      step: 1,
      visibleWhen: {
        path: "mode",
        operator: "eq",
        value: "ring"
      }
    }
  ]
};

export const pointFieldOperator: OperatorDefinition<PointFieldGeneratorParams> = {
  key: POINT_FIELD_OPERATOR_KEY,
  version: "0.1.0",
  parameterSchema: POINT_FIELD_PARAMETER_SCHEMA,
  inputs: [
    {
      key: "centroid",
      kind: "vector3",
      description: "Optional centroid to offset the generated point field."
    }
  ],
  outputs: [
    {
      key: "pointField",
      kind: "point-field",
      description: "Generated point field payload for downstream graph operators."
    }
  ],
  run(context) {
    return {
      pointField: resolvePointField(
        context.params,
        context.inputs.centroid as Partial<Vector3> | null | undefined
      )
    };
  }
};
