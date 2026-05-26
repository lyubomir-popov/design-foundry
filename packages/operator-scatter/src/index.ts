import type {
  ColorRgba,
  OperatorDefinition,
  OperatorParameterSchema,
  PointField,
  PointRecord,
  Vector3
} from "@design-foundry/core-types";

export const SCATTER_OPERATOR_KEY = "operator.scatter";

export type ScatterDistributionMode = "uniform" | "density-weighted";
export type ScatterShapeKind = "ellipse" | "rect" | "rounded-rect" | "svg-path";

export interface ScatterShapeParams {
  kind: ScatterShapeKind;
  widthPx: number;
  heightPx: number;
  cornerRadiusPx?: number;
  svgPath?: string;
  origin?: Partial<Vector3>;
}

export interface ScatterParams {
  pointCount: number;
  seed?: number;
  distributionMode?: ScatterDistributionMode;
  marginPx?: number;
  shape: ScatterShapeParams;
}

export interface ScatterOutputs extends Record<string, unknown> {
  pointField: PointField;
}

export interface ScatterShapeBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ScatterEllipseShape {
  kind: "ellipse";
  center: Vector3;
  radiusXPx: number;
  radiusYPx: number;
  bounds: ScatterShapeBounds;
}

export interface ScatterRectShape {
  kind: "rect" | "rounded-rect";
  center: Vector3;
  widthPx: number;
  heightPx: number;
  cornerRadiusPx: number;
  bounds: ScatterShapeBounds;
}

export interface ScatterPathShape {
  kind: "svg-path";
  center: Vector3;
  points: Vector3[];
  rawPath: string;
  bounds: ScatterShapeBounds;
}

export type ScatterResolvedShape = ScatterEllipseShape | ScatterRectShape | ScatterPathShape;

interface ScatterRelaxResult {
  points: PointRecord[];
  targetSpacingPx: number;
  iterations: number;
}

const DEFAULT_SCATTER_POINT_COLOR: ColorRgba = {
  r: 255,
  g: 255,
  b: 255,
  a: 1
};

function toNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
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

function addVectors(left: Vector3, right: Vector3): Vector3 {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z
  };
}

function createBounds(center: Vector3, widthPx: number, heightPx: number): ScatterShapeBounds {
  const safeWidthPx = Math.max(1, widthPx);
  const safeHeightPx = Math.max(1, heightPx);
  return {
    left: center.x - safeWidthPx * 0.5,
    top: center.y - safeHeightPx * 0.5,
    right: center.x + safeWidthPx * 0.5,
    bottom: center.y + safeHeightPx * 0.5,
    width: safeWidthPx,
    height: safeHeightPx
  };
}

function createBoundsFromPoints(points: Vector3[]): ScatterShapeBounds {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  }

  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
    return createBounds({ x: 0, y: 0, z: 0 }, 1, 1);
  }

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
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

function tokenizeSvgPath(pathData: string): string[] {
  return pathData.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) ?? [];
}

function parseSvgPolygonPath(pathData: string, center: Vector3): Vector3[] {
  const tokens = tokenizeSvgPath(pathData);
  if (tokens.length === 0) {
    return [];
  }

  let index = 0;
  let command = "";
  let cursor = { x: 0, y: 0 };
  let subpathStart = { x: 0, y: 0 };
  const localPoints: Array<{ x: number; y: number }> = [];

  const isCommandToken = (token: string | undefined): token is string => Boolean(token && /^[a-zA-Z]$/.test(token));

  const readNumber = (): number | null => {
    const token = tokens[index];
    if (isCommandToken(token) || token === undefined) {
      return null;
    }

    index += 1;
    const value = Number(token);
    return Number.isFinite(value) ? value : null;
  };

  while (index < tokens.length) {
    const nextToken = tokens[index];
    if (isCommandToken(nextToken)) {
      command = nextToken;
      index += 1;
    }

    if (!command) {
      break;
    }

    switch (command) {
      case "M":
      case "m": {
        let isFirstPair = true;
        while (index < tokens.length && !isCommandToken(tokens[index])) {
          const x = readNumber();
          const y = readNumber();
          if (x === null || y === null) {
            break;
          }

          cursor = command === "m" ? { x: cursor.x + x, y: cursor.y + y } : { x, y };
          if (isFirstPair) {
            subpathStart = { ...cursor };
            isFirstPair = false;
          }

          localPoints.push({ ...cursor });
        }
        break;
      }
      case "L":
      case "l": {
        while (index < tokens.length && !isCommandToken(tokens[index])) {
          const x = readNumber();
          const y = readNumber();
          if (x === null || y === null) {
            break;
          }

          cursor = command === "l" ? { x: cursor.x + x, y: cursor.y + y } : { x, y };
          localPoints.push({ ...cursor });
        }
        break;
      }
      case "H":
      case "h": {
        while (index < tokens.length && !isCommandToken(tokens[index])) {
          const x = readNumber();
          if (x === null) {
            break;
          }

          cursor = command === "h" ? { x: cursor.x + x, y: cursor.y } : { x, y: cursor.y };
          localPoints.push({ ...cursor });
        }
        break;
      }
      case "V":
      case "v": {
        while (index < tokens.length && !isCommandToken(tokens[index])) {
          const y = readNumber();
          if (y === null) {
            break;
          }

          cursor = command === "v" ? { x: cursor.x, y: cursor.y + y } : { x: cursor.x, y };
          localPoints.push({ ...cursor });
        }
        break;
      }
      case "Z":
      case "z": {
        cursor = { ...subpathStart };
        break;
      }
      default:
        return [];
    }
  }

  const uniquePoints = localPoints.filter((point, pointIndex) => {
    const previousPoint = localPoints[pointIndex - 1];
    return !previousPoint || previousPoint.x !== point.x || previousPoint.y !== point.y;
  });

  if (uniquePoints.length < 3) {
    return [];
  }

  return uniquePoints.map((point) => ({
    x: center.x + point.x,
    y: center.y + point.y,
    z: center.z
  }));
}

function pointToSegmentDistance(point: Vector3, start: Vector3, end: Vector3): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared <= 0.00001) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = clamp(((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / segmentLengthSquared, 0, 1);
  const projectionX = start.x + segmentX * t;
  const projectionY = start.y + segmentY * t;
  return Math.hypot(point.x - projectionX, point.y - projectionY);
}

function isPointInPolygon(point: Vector3, polygon: Vector3[]): boolean {
  let isInside = false;

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const left = polygon[index];
    const right = polygon[previousIndex];
    const intersects = ((left.y > point.y) !== (right.y > point.y))
      && (point.x < ((right.x - left.x) * (point.y - left.y)) / Math.max(0.00001, right.y - left.y) + left.x);

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function isPointInShape(point: Vector3, shape: ScatterResolvedShape, marginPx: number): boolean {
  if (shape.kind === "ellipse") {
    const radiusXPx = Math.max(0.001, shape.radiusXPx - marginPx);
    const radiusYPx = Math.max(0.001, shape.radiusYPx - marginPx);
    const normalizedX = (point.x - shape.center.x) / radiusXPx;
    const normalizedY = (point.y - shape.center.y) / radiusYPx;
    return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
  }

  if (shape.kind === "rect") {
    return point.x >= shape.bounds.left + marginPx
      && point.x <= shape.bounds.right - marginPx
      && point.y >= shape.bounds.top + marginPx
      && point.y <= shape.bounds.bottom - marginPx;
  }

  if (shape.kind === "rounded-rect") {
    const halfWidth = Math.max(0.001, shape.widthPx * 0.5 - marginPx);
    const halfHeight = Math.max(0.001, shape.heightPx * 0.5 - marginPx);
    const radiusPx = clamp(shape.cornerRadiusPx - marginPx, 0, Math.min(halfWidth, halfHeight));
    const distanceX = Math.abs(point.x - shape.center.x);
    const distanceY = Math.abs(point.y - shape.center.y);

    if (distanceX > halfWidth || distanceY > halfHeight) {
      return false;
    }

    if (distanceX <= halfWidth - radiusPx || distanceY <= halfHeight - radiusPx) {
      return true;
    }

    const cornerX = distanceX - (halfWidth - radiusPx);
    const cornerY = distanceY - (halfHeight - radiusPx);
    return cornerX * cornerX + cornerY * cornerY <= radiusPx * radiusPx;
  }

  if (shape.kind === "svg-path") {
    if (!isPointInPolygon(point, shape.points)) {
      return false;
    }

    if (marginPx <= 0) {
      return true;
    }

    for (let index = 0; index < shape.points.length; index += 1) {
      const start = shape.points[index];
      const end = shape.points[(index + 1) % shape.points.length];
      if (pointToSegmentDistance(point, start, end) < marginPx) {
        return false;
      }
    }

    return true;
  }

  return false;
}

function getDensityWeight(point: Vector3, bounds: ScatterShapeBounds, center: Vector3): number {
  const radiusX = Math.max(1, bounds.width * 0.5);
  const radiusY = Math.max(1, bounds.height * 0.5);
  const normalizedDistance = Math.hypot((point.x - center.x) / radiusX, (point.y - center.y) / radiusY);
  return clamp(1 - normalizedDistance * 0.85, 0.08, 1);
}

function getPolygonArea(points: Vector3[]): number {
  if (points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }

  return Math.abs(area) * 0.5;
}

function getScatterShapeArea(shape: ScatterResolvedShape, marginPx: number): number {
  if (shape.kind === "ellipse") {
    return Math.PI
      * Math.max(0.001, shape.radiusXPx - marginPx)
      * Math.max(0.001, shape.radiusYPx - marginPx);
  }

  if (shape.kind === "svg-path") {
    return Math.max(0.001, getPolygonArea(shape.points));
  }

  if (shape.kind === "rect") {
    return Math.max(0.001, shape.widthPx - marginPx * 2)
      * Math.max(0.001, shape.heightPx - marginPx * 2);
  }

  if (shape.kind === "rounded-rect") {
    const widthPx = Math.max(0.001, shape.widthPx - marginPx * 2);
    const heightPx = Math.max(0.001, shape.heightPx - marginPx * 2);
    const radiusPx = clamp(shape.cornerRadiusPx - marginPx, 0, Math.min(widthPx, heightPx) * 0.5);
    return widthPx * heightPx - (4 - Math.PI) * radiusPx * radiusPx;
  }

  return Math.max(0.001, shape.widthPx * shape.heightPx);
}

function getRelaxTargetSpacingPx(shape: ScatterResolvedShape, marginPx: number, pointCount: number): number {
  if (pointCount <= 1) {
    return 0;
  }

  const areaPx = Math.max(1, getScatterShapeArea(shape, marginPx));
  return Math.max(2, Math.sqrt(areaPx / pointCount) * 0.82);
}

function getDeterministicUnitVector(pairIndex: number, iteration: number): { x: number; y: number } {
  const phase = Math.sin((pairIndex + 1) * 12.9898 + (iteration + 1) * 78.233) * 43758.5453;
  const angle = (phase - Math.floor(phase)) * Math.PI * 2;
  return {
    x: Math.cos(angle),
    y: Math.sin(angle)
  };
}

function movePointWithinShape(
  point: Vector3,
  deltaX: number,
  deltaY: number,
  shape: ScatterResolvedShape,
  marginPx: number
): Vector3 {
  let stepScale = 1;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = {
      x: point.x + deltaX * stepScale,
      y: point.y + deltaY * stepScale,
      z: point.z
    };

    if (isPointInShape(candidate, shape, marginPx)) {
      return candidate;
    }

    stepScale *= 0.5;
  }

  return point;
}

function relaxScatterPoints(
  sourcePoints: PointRecord[],
  shape: ScatterResolvedShape,
  marginPx: number,
  distributionMode: ScatterDistributionMode
): ScatterRelaxResult {
  if (sourcePoints.length < 2) {
    return {
      points: sourcePoints,
      targetSpacingPx: 0,
      iterations: 0
    };
  }

  const points = sourcePoints.map((point) => ({
    ...point,
    position: { ...point.position },
    attributes: { ...point.attributes }
  }));

  const targetSpacingPx = getRelaxTargetSpacingPx(shape, marginPx, points.length);
  const cellSizePx = Math.max(4, targetSpacingPx);
  const maxIterations = Math.min(10, Math.max(4, Math.round(4 + Math.log2(points.length + 1) * 0.6)));
  const maxStepPx = Math.max(1, targetSpacingPx * 0.35);
  let completedIterations = 0;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const cellMap = new Map<string, number[]>();
    const displacementX = new Float64Array(points.length);
    const displacementY = new Float64Array(points.length);

    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const cellX = Math.floor((point.position.x - shape.bounds.left) / cellSizePx);
      const cellY = Math.floor((point.position.y - shape.bounds.top) / cellSizePx);
      const key = `${cellX},${cellY}`;
      const bucket = cellMap.get(key);
      if (bucket) {
        bucket.push(index);
      } else {
        cellMap.set(key, [index]);
      }
    }

    for (let leftIndex = 0; leftIndex < points.length; leftIndex += 1) {
      const leftPoint = points[leftIndex];
      const baseCellX = Math.floor((leftPoint.position.x - shape.bounds.left) / cellSizePx);
      const baseCellY = Math.floor((leftPoint.position.y - shape.bounds.top) / cellSizePx);

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const bucket = cellMap.get(`${baseCellX + offsetX},${baseCellY + offsetY}`);
          if (!bucket) {
            continue;
          }

          for (const rightIndex of bucket) {
            if (rightIndex <= leftIndex) {
              continue;
            }

            const rightPoint = points[rightIndex];
            let deltaX = leftPoint.position.x - rightPoint.position.x;
            let deltaY = leftPoint.position.y - rightPoint.position.y;
            let distanceSq = deltaX * deltaX + deltaY * deltaY;

            let pairTargetSpacingPx = targetSpacingPx;
            if (distributionMode === "density-weighted") {
              const averageDensityWeight = clamp(
                (Number(leftPoint.attributes.scatter_density_weight ?? 1) + Number(rightPoint.attributes.scatter_density_weight ?? 1)) * 0.5,
                0.08,
                1
              );
              pairTargetSpacingPx *= 1.35 - averageDensityWeight * 0.63;
            }

            if (distanceSq >= pairTargetSpacingPx * pairTargetSpacingPx) {
              continue;
            }

            let distancePx = Math.sqrt(distanceSq);
            if (distancePx <= 0.0001) {
              const direction = getDeterministicUnitVector(leftIndex * points.length + rightIndex, iteration);
              deltaX = direction.x;
              deltaY = direction.y;
              distancePx = 1;
              distanceSq = 1;
            }

            const overlapPx = pairTargetSpacingPx - distancePx;
            if (overlapPx <= 0) {
              continue;
            }

            const pushScale = (overlapPx * 0.5) / Math.sqrt(distanceSq);
            displacementX[leftIndex] += deltaX * pushScale;
            displacementY[leftIndex] += deltaY * pushScale;
            displacementX[rightIndex] -= deltaX * pushScale;
            displacementY[rightIndex] -= deltaY * pushScale;
          }
        }
      }
    }

    let didMove = false;
    for (let index = 0; index < points.length; index += 1) {
      const deltaX = displacementX[index];
      const deltaY = displacementY[index];
      const displacementLengthPx = Math.hypot(deltaX, deltaY);
      if (displacementLengthPx <= 0.001) {
        continue;
      }

      const dampedScale = Math.min(1, maxStepPx / displacementLengthPx) * 0.85;
      const nextPosition = movePointWithinShape(
        points[index].position,
        deltaX * dampedScale,
        deltaY * dampedScale,
        shape,
        marginPx
      );

      if (nextPosition !== points[index].position) {
        points[index].position = nextPosition;
        didMove = true;
      }
    }

    completedIterations = iteration + 1;
    if (!didMove) {
      break;
    }
  }

  for (const point of points) {
    const densityWeight = getDensityWeight(point.position, shape.bounds, shape.center);
    point.attributes.scatter_density_weight = densityWeight;
    point.attributes.pscale = 0.55 + densityWeight * 0.75;
  }

  return {
    points,
    targetSpacingPx,
    iterations: completedIterations
  };
}

export function resolveScatterShape(params: ScatterParams, centroidInput?: Partial<Vector3> | null): ScatterResolvedShape {
  const centroid = toVector3(centroidInput);
  const origin = toVector3(params.shape.origin);
  const center = addVectors(centroid, origin);
  const widthPx = Math.max(1, toNumber(params.shape.widthPx, 1));
  const heightPx = Math.max(1, toNumber(params.shape.heightPx, 1));

  if (params.shape.kind === "ellipse") {
    return {
      kind: "ellipse",
      center,
      radiusXPx: widthPx * 0.5,
      radiusYPx: heightPx * 0.5,
      bounds: createBounds(center, widthPx, heightPx)
    };
  }

  if (params.shape.kind === "rect") {
    return {
      kind: "rect",
      center,
      widthPx,
      heightPx,
      cornerRadiusPx: 0,
      bounds: createBounds(center, widthPx, heightPx)
    };
  }

  if (params.shape.kind === "rounded-rect") {
    return {
      kind: "rounded-rect",
      center,
      widthPx,
      heightPx,
      cornerRadiusPx: clamp(toNumber(params.shape.cornerRadiusPx, Math.min(widthPx, heightPx) * 0.15), 0, Math.min(widthPx, heightPx) * 0.5),
      bounds: createBounds(center, widthPx, heightPx)
    };
  }

  const points = parseSvgPolygonPath(params.shape.svgPath ?? "", center);
  if (points.length >= 3) {
    return {
      kind: "svg-path",
      center,
      points,
      rawPath: params.shape.svgPath ?? "",
      bounds: createBoundsFromPoints(points)
    };
  }

  return {
    kind: "rect",
    center,
    widthPx,
    heightPx,
    cornerRadiusPx: 0,
    bounds: createBounds(center, widthPx, heightPx)
  };
}

export function resolveScatterPointField(params: ScatterParams, centroidInput?: Partial<Vector3> | null): PointField {
  const shape = resolveScatterShape(params, centroidInput);
  const rng = createRng(toNumber(params.seed, 1));
  const pointCount = Math.max(0, Math.round(toNumber(params.pointCount, 0)));
  const marginPx = Math.max(0, toNumber(params.marginPx, 0));
  const distributionMode: ScatterDistributionMode = params.distributionMode === "density-weighted" ? "density-weighted" : "uniform";
  const points: PointRecord[] = [];
  const maxAttempts = Math.max(64, pointCount * 240);

  let attempts = 0;
  while (points.length < pointCount && attempts < maxAttempts) {
    attempts += 1;
    const position: Vector3 = {
      x: shape.bounds.left + rng() * shape.bounds.width,
      y: shape.bounds.top + rng() * shape.bounds.height,
      z: shape.center.z
    };

    if (!isPointInShape(position, shape, marginPx)) {
      continue;
    }

    const densityWeight = getDensityWeight(position, shape.bounds, shape.center);
    if (distributionMode === "density-weighted" && rng() > densityWeight) {
      continue;
    }

    points.push({
      id: `scatter-${points.length}`,
      position,
      attributes: {
        scatter_index: points.length,
        scatter_density_weight: densityWeight,
        shape_kind: shape.kind,
        distribution_mode: distributionMode,
        pscale: 0.55 + densityWeight * 0.75,
        color: DEFAULT_SCATTER_POINT_COLOR
      }
    });
  }

  const relaxedScatter = relaxScatterPoints(points, shape, marginPx, distributionMode);

  return {
    points: relaxedScatter.points,
    detail: {
      center: shape.center,
      requested_point_count: pointCount,
      point_count: relaxedScatter.points.length,
      attempts,
      max_attempts: maxAttempts,
      margin_px: marginPx,
      distribution_mode: distributionMode,
      shape_kind: shape.kind,
      shape_bounds: shape.bounds,
      relax_iterations: relaxedScatter.iterations,
      relax_target_spacing_px: relaxedScatter.targetSpacingPx
    }
  };
}

export function resolveScatterOutputs(params: ScatterParams, centroidInput?: Partial<Vector3> | null): ScatterOutputs {
  return {
    pointField: resolveScatterPointField(params, centroidInput)
  };
}

export const SCATTER_PARAMETER_SCHEMA: OperatorParameterSchema = {
  sections: [
    { key: "scatter", title: "Scatter" },
    { key: "shape", title: "Shape" }
  ],
  fields: [
    { kind: "number", sectionKey: "scatter", path: "pointCount", label: "Points", min: 1, max: 4000, step: 1 },
    { kind: "number", sectionKey: "scatter", path: "seed", label: "Seed", min: 0, max: 9999, step: 1 },
    { kind: "select", sectionKey: "scatter", path: "distributionMode", label: "Distribution", options: [
      { label: "Uniform", value: "uniform" },
      { label: "Density-weighted", value: "density-weighted" }
    ] },
    { kind: "slider", sectionKey: "scatter", path: "marginPx", label: "Margin", min: 0, max: 120, step: 1 },
    { kind: "select", sectionKey: "shape", path: "shape.kind", label: "Shape", options: [
      { label: "Ellipse", value: "ellipse" },
      { label: "Rectangle", value: "rect" },
      { label: "Rounded rect", value: "rounded-rect" }
    ] },
    { kind: "slider", sectionKey: "shape", path: "shape.widthPx", label: "Width", min: 40, max: 1200, step: 1 },
    { kind: "slider", sectionKey: "shape", path: "shape.heightPx", label: "Height", min: 40, max: 1200, step: 1 },
    { kind: "slider", sectionKey: "shape", path: "shape.cornerRadiusPx", label: "Corner radius", min: 0, max: 240, step: 1 }
  ]
};

export const scatterOperator: OperatorDefinition<ScatterParams> = {
  key: SCATTER_OPERATOR_KEY,
  version: "0.1.0",
  parameterSchema: SCATTER_PARAMETER_SCHEMA,
  inputs: [
    {
      key: "centroid",
      kind: "vector3",
      description: "Optional centroid input used as the scatter shape center."
    }
  ],
  outputs: [
    {
      key: "pointField",
      kind: "point-field",
      description: "Scattered points generated inside the requested SVG-like boundary."
    }
  ],
  run(context) {
    return {
      pointField: resolveScatterPointField(context.params, context.inputs.centroid as Partial<Vector3> | null | undefined)
    } satisfies Record<string, unknown>;
  }
};