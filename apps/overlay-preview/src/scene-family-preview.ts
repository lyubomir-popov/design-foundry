import type { BoidField, ColorRgba, OperatorDefinition, PointField, PointRecord, Vector3 } from "@design-foundry/core-types";
import { OperatorRegistry, evaluateGraphSync } from "@design-foundry/graph-runtime";
import { FuzzyBoidsSimulation, type FuzzyBoidsParams } from "@design-foundry/operator-fuzzy-boids";
import { resolvePhyllotaxisField, type PhyllotaxisParams } from "@design-foundry/operator-phyllotaxis";
import type {
  OverlayBackgroundGraph,
  OverlayFuzzyBoidsConfig,
  OverlayPhyllotaxisConfig,
  OverlayScatterConfig,
  OverlaySceneFamilyKey
} from "@design-foundry/operator-overlay-layout";
import {
  OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY,
  OVERLAY_BACKGROUND_HALO_OPERATOR_KEY,
  OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY,
  OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY
} from "@design-foundry/operator-overlay-layout";
import {
  resolveScatterPointField,
  type ScatterDistributionMode,
  type ScatterParams,
} from "@design-foundry/operator-scatter";
import type { HaloFieldConfig } from "@design-foundry/operator-halo-field";
import { Canvas2DRenderer } from "@design-foundry/render-canvas2d";
import type { Color, Viewport } from "@design-foundry/render-ir";
import {
  FuzzyBoidsPreviewWorkerClient,
  type WorkerBoidsPreviewSnapshot
} from "./fuzzy-boids-preview-worker-client.js";
import {
  pointFieldToDisplayList,
  phyllotaxisStyleResolver,
  scatterStyleResolver,
  fuzzyBoidsStyleResolver,
} from "./display-list-adapter.js";
import { GpuFuzzyBoidsSpike } from "./gpu-fuzzy-boids-spike.js";

const fuzzyBoidsSimulation = new FuzzyBoidsSimulation();
const gpuFuzzyBoidsSpike = new GpuFuzzyBoidsSpike();
const fuzzyBoidsPreviewWorkerClient = new FuzzyBoidsPreviewWorkerClient();
let fuzzyBoidsPreviewGraphKey = "";
let requestSceneFamilyPreviewRefresh: (() => void) | null = null;

export type FuzzyBoidsPreviewConfig = OverlayFuzzyBoidsConfig;
export type PhyllotaxisPreviewConfig = OverlayPhyllotaxisConfig;
export type ScatterPreviewConfig = OverlayScatterConfig;

type PreviewableSceneFamilyKey = Exclude<OverlaySceneFamilyKey, "halo">;
export type SceneFamilyPreviewMode = "interactive" | "export";

interface BaseSceneFamilyPreviewState {
  sceneFamilyKey: PreviewableSceneFamilyKey;
}

interface PointFieldSceneFamilyPreviewState extends BaseSceneFamilyPreviewState {
  pointField: PointField;
}

export interface PhyllotaxisSceneFamilyPreviewState extends PointFieldSceneFamilyPreviewState {
  sceneFamilyKey: "phyllotaxis";
  maxRadiusPx: number;
}

export interface CpuFuzzyBoidsSceneFamilyPreviewState extends PointFieldSceneFamilyPreviewState {
  sceneFamilyKey: "fuzzy-boids";
  boidField: BoidField;
  dotSizePx: number;
  simulationBackend: "cpu";
}

export interface GpuFuzzyBoidsSceneFamilyPreviewState extends BaseSceneFamilyPreviewState {
  sceneFamilyKey: "fuzzy-boids";
  dotSizePx: number;
  simulationBackend: "gpu-spike";
}

export interface WorkerFuzzyBoidsSceneFamilyPreviewState extends BaseSceneFamilyPreviewState {
  sceneFamilyKey: "fuzzy-boids";
  dotSizePx: number;
  simulationBackend: "cpu-worker";
  workerSnapshot: WorkerBoidsPreviewSnapshot;
}

export type FuzzyBoidsSceneFamilyPreviewState =
  | CpuFuzzyBoidsSceneFamilyPreviewState
  | WorkerFuzzyBoidsSceneFamilyPreviewState
  | GpuFuzzyBoidsSceneFamilyPreviewState;

export interface ScatterSceneFamilyPreviewState extends PointFieldSceneFamilyPreviewState {
  sceneFamilyKey: "scatter";
  distributionMode: ScatterDistributionMode;
}

export type SceneFamilyPreviewState =
  | PhyllotaxisSceneFamilyPreviewState
  | FuzzyBoidsSceneFamilyPreviewState
  | ScatterSceneFamilyPreviewState;

interface SceneFamilyPalette {
  point: ColorRgba;
  accent: ColorRgba;
  echo: ColorRgba;
  reference: ColorRgba;
}

interface PointRenderStyle {
  color: ColorRgba;
  alpha: number;
  radiusPx: number;
}

const DEFAULT_SCENE_FAMILY_COLOR: ColorRgba = {
  r: 255,
  g: 255,
  b: 255,
  a: 1
};

const PREVIEW_HIGH_DENSITY_BOID_THRESHOLD = 1200;

export function setSceneFamilyPreviewRefreshCallback(callback: (() => void) | null): void {
  requestSceneFamilyPreviewRefresh = callback;
  fuzzyBoidsPreviewWorkerClient.setOnUpdate(callback);
}

export interface BuildSceneFamilyPreviewStateOptions {
  backgroundGraph: OverlayBackgroundGraph;
  widthPx: number;
  heightPx: number;
  playbackTimeSec: number;
  haloConfig: HaloFieldConfig;
  mode?: SceneFamilyPreviewMode;
}

export interface RenderSceneFamilyPreviewFrameOptions {
  canvas: HTMLCanvasElement;
  widthPx: number;
  heightPx: number;
  transparentBackground: boolean;
  haloConfig: HaloFieldConfig;
  previewState: SceneFamilyPreviewState;
  /** When true, use the render-ir kernel path (Canvas2DRenderer + DisplayList adapter). */
  useKernelRenderer?: boolean;
}

type BackgroundGraphEdge = OverlayBackgroundGraph["edges"][number];
type FuzzyBoidsPreviewBackend = "cpu" | "cpu-worker" | "gpu-spike";

interface FuzzyBoidsPreviewOutputs extends Record<string, unknown> {
  simulationBackend: FuzzyBoidsPreviewBackend;
  dotSizePx: number;
  pointField?: PointField;
  boidField?: BoidField;
  workerSnapshot?: WorkerBoidsPreviewSnapshot;
}

function asPartialVector3Input(value: unknown): Partial<Vector3> | null {
  return value && typeof value === "object"
    ? value as Partial<Vector3>
    : null;
}

function resolveVector3Input(value: unknown, fallback: Vector3): Vector3 {
  const vector = asPartialVector3Input(value);
  return {
    x: Number(vector?.x ?? fallback.x),
    y: Number(vector?.y ?? fallback.y),
    z: Number(vector?.z ?? fallback.z)
  };
}

function buildIncomingEdgesByNodeId(graph: OverlayBackgroundGraph): Map<string, BackgroundGraphEdge[]> {
  const incomingEdgesByNodeId = new Map<string, BackgroundGraphEdge[]>();
  for (const edge of graph.edges) {
    const incomingEdges = incomingEdgesByNodeId.get(edge.toNodeId) ?? [];
    incomingEdges.push(edge);
    incomingEdgesByNodeId.set(edge.toNodeId, incomingEdges);
  }
  return incomingEdgesByNodeId;
}

function resolvePreviewPhyllotaxisParams(
  params: OverlayPhyllotaxisConfig,
  center: Vector3,
  playbackTimeSec: number
): PhyllotaxisParams {
  return {
    numPoints: params.numPoints,
    radius: params.radiusPx,
    radiusFalloff: params.radiusFalloff,
    angleOffsetDeg: params.angleOffsetDeg + (params.animationEnabled ? playbackTimeSec * params.animationSpeedDegPerSecond : 0),
    origin: center
  };
}

function resolvePreviewScatterParams(
  params: OverlayScatterConfig,
  center: Vector3
): ScatterParams {
  return {
    pointCount: params.pointCount,
    seed: params.seed,
    distributionMode: params.distributionMode,
    marginPx: params.marginPx,
    shape: {
      kind: params.shapeKind,
      widthPx: params.widthPx,
      heightPx: params.heightPx,
      cornerRadiusPx: params.cornerRadiusPx,
      svgPath: params.svgPath,
      origin: center
    }
  };
}

function resolvePreviewFuzzyBoidsParams(
  params: OverlayFuzzyBoidsConfig,
  center: Vector3,
  widthPx: number,
  heightPx: number,
  playbackTimeSec: number
): FuzzyBoidsParams {
  const effectiveSubSteps = params.numBoids >= PREVIEW_HIGH_DENSITY_BOID_THRESHOLD
    ? 1
    : params.subSteps;

  return {
    timeSeconds: playbackTimeSec,
    deltaTimeSeconds: 1 / 30,
    subSteps: effectiveSubSteps,
    worldScale: Math.min(widthPx, heightPx) / 6,
    numBoids: params.numBoids,
    seed: params.seed,
    center,
    spawnRadiusPx: params.spawnRadiusPx,
    staggerStartSeconds: params.staggerStartSeconds,
    initialSpeed: params.initialSpeed,
    initialSpeedJitter: params.initialSpeedJitter,
    massMin: params.massMin,
    massMax: params.massMax,
    pscaleMin: params.pscaleMin,
    pscaleMax: params.pscaleMax,
    maxNeighbors: params.maxNeighbors,
    separationMinDist: params.separationMinDist,
    separationMaxDist: params.separationMaxDist,
    separationMaxStrength: params.separationMaxStrength,
    alignNearThreshold: params.alignNearThreshold,
    alignFarThreshold: params.alignFarThreshold,
    alignSpeedThreshold: params.alignSpeedThreshold,
    cohesionMinDist: params.cohesionMinDist,
    cohesionMaxDist: params.cohesionMaxDist,
    cohesionMaxAccel: params.cohesionMaxAccel,
    attractToOrigin: params.attractToOrigin,
    minSpeedLimit: params.minSpeedLimit,
    maxSpeedLimit: params.maxSpeedLimit,
    minAccelLimit: params.minAccelLimit,
    maxAccelLimit: params.maxAccelLimit,
    bounds: {
      kind: params.boundsKind,
      radiusPx: params.boundsRadiusPx,
      marginPx: params.boundsMarginPx,
      forcePxPerSecond2: params.boundsForcePxPerSecond2,
      ...(params.boundsKind === "box"
        ? {
          widthPx,
          heightPx
        }
        : {})
    }
  };
}

function createHaloPreviewOperator(): OperatorDefinition<Record<string, never>> {
  return {
    key: OVERLAY_BACKGROUND_HALO_OPERATOR_KEY,
    version: "0.1.0",
    inputs: [],
    outputs: [],
    run() {
      return {};
    }
  };
}

function createPhyllotaxisPreviewOperator(
  options: BuildSceneFamilyPreviewStateOptions,
  center: Vector3
): OperatorDefinition<OverlayPhyllotaxisConfig> {
  return {
    key: OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY,
    version: "0.1.0",
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
        description: "Generated phyllotaxis points for scene-family preview."
      }
    ],
    run({ params, inputs }) {
      return {
        pointField: resolvePhyllotaxisField(
          resolvePreviewPhyllotaxisParams(params, center, options.playbackTimeSec),
          asPartialVector3Input(inputs.centroid)
        )
      } satisfies Record<string, unknown>;
    }
  };
}

function createScatterPreviewOperator(
  center: Vector3
): OperatorDefinition<OverlayScatterConfig> {
  return {
    key: OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY,
    version: "0.1.0",
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
        description: "Scatter point field for scene-family preview."
      }
    ],
    run({ params, inputs }) {
      return {
        pointField: resolveScatterPointField(
          resolvePreviewScatterParams(params, center),
          asPartialVector3Input(inputs.centroid)
        )
      } satisfies Record<string, unknown>;
    }
  };
}

function createFuzzyBoidsPreviewOperator(
  options: BuildSceneFamilyPreviewStateOptions,
  center: Vector3,
  nodesById: Map<string, OverlayBackgroundGraph["nodes"][number]>,
  incomingEdgesByNodeId: Map<string, BackgroundGraphEdge[]>
): OperatorDefinition<OverlayFuzzyBoidsConfig> {
  return {
    key: OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY,
    version: "0.1.0",
    inputs: [
      {
        key: "center",
        kind: "vector3",
        description: "Optional external center used as the flock anchor and bounds origin."
      },
      {
        key: "seedField",
        kind: "point-field",
        description: "Optional seed point field used to initialize boid positions and inherited attributes."
      }
    ],
    outputs: [
      {
        key: "boidField",
        kind: "boid-field",
        description: "Resolved boid records for scene-family preview."
      },
      {
        key: "pointField",
        kind: "point-field",
        description: "Point-field projection of the preview boid simulation."
      }
    ],
    run({ nodeId, params, inputs }) {
      const resolvedCenter = resolveVector3Input(inputs.center, center);
      const seedField = inputs.seedField as PointField | null | undefined;
      const seedEdge = (incomingEdgesByNodeId.get(nodeId) ?? []).find((edge) => edge.toPortKey === "seedField");
      const seedSourceNode = seedEdge ? nodesById.get(seedEdge.fromNodeId) ?? null : null;
      const fuzzyParams = resolvePreviewFuzzyBoidsParams(
        params,
        resolvedCenter,
        options.widthPx,
        options.heightPx,
        options.playbackTimeSec
      );

      const topologyKey = JSON.stringify({
        activeNodeId: options.backgroundGraph.activeNodeId,
        fuzzyNodeId: nodeId,
        seedSourceNodeId: seedSourceNode?.id ?? null,
        seedSourceParams: seedSourceNode?.params ?? null
      });
      if (topologyKey !== fuzzyBoidsPreviewGraphKey) {
        fuzzyBoidsSimulation.reset();
        gpuFuzzyBoidsSpike.reset();
        fuzzyBoidsPreviewWorkerClient.reset();
        fuzzyBoidsPreviewGraphKey = topologyKey;
      }

      const dotSizePx = Math.max(0.5, params.dotSizePx ?? 3);
      if (gpuFuzzyBoidsSpike.preparePreview(fuzzyParams, resolvedCenter, seedField ?? null)) {
        return {
          simulationBackend: "gpu-spike",
          dotSizePx
        } satisfies FuzzyBoidsPreviewOutputs;
      }

      if (options.mode === "interactive" && fuzzyBoidsPreviewWorkerClient.isSupported()) {
        const structuralKey = JSON.stringify({
          topologyKey,
          params: {
            ...fuzzyParams,
            timeSeconds: 0
          }
        });
        const exactKey = JSON.stringify({
          topologyKey,
          params: fuzzyParams
        });
        const workerSnapshot = fuzzyBoidsPreviewWorkerClient.requestResolve(
          fuzzyParams,
          resolvedCenter,
          seedField ?? null,
          structuralKey,
          exactKey
        );

        if (workerSnapshot) {
          return {
            simulationBackend: "cpu-worker",
            dotSizePx,
            workerSnapshot
          } satisfies FuzzyBoidsPreviewOutputs;
        }
      }

      const fuzzyBoids = fuzzyBoidsSimulation.resolve(fuzzyParams, resolvedCenter, seedField ?? null);
      return {
        simulationBackend: "cpu",
        dotSizePx,
        pointField: fuzzyBoids.pointField,
        boidField: fuzzyBoids.boidField
      } satisfies FuzzyBoidsPreviewOutputs;
    }
  };
}

function createSceneFamilyPreviewRegistry(
  options: BuildSceneFamilyPreviewStateOptions,
  center: Vector3
): OperatorRegistry {
  const registry = new OperatorRegistry();
  const nodesById = new Map(options.backgroundGraph.nodes.map((node) => [node.id, node]));
  const incomingEdgesByNodeId = buildIncomingEdgesByNodeId(options.backgroundGraph);
  registry.register(createHaloPreviewOperator());
  registry.register(createPhyllotaxisPreviewOperator(options, center));
  registry.register(createScatterPreviewOperator(center));
  registry.register(createFuzzyBoidsPreviewOperator(options, center, nodesById, incomingEdgesByNodeId));
  return registry;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeCanvasSize(canvas: HTMLCanvasElement, widthPx: number, heightPx: number): void {
  if (canvas.width !== widthPx) {
    canvas.width = widthPx;
  }
  if (canvas.height !== heightPx) {
    canvas.height = heightPx;
  }
}

function parseHexColor(rawColor: string): ColorRgba | null {
  const normalized = rawColor.trim();
  if (!normalized.startsWith("#")) {
    return null;
  }

  const hex = normalized.slice(1);
  if (hex.length === 3) {
    const [red, green, blue] = hex.split("");
    return {
      r: parseInt(`${red}${red}`, 16),
      g: parseInt(`${green}${green}`, 16),
      b: parseInt(`${blue}${blue}`, 16),
      a: 1
    };
  }

  if (hex.length === 6 || hex.length === 8) {
    const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: alpha
    };
  }

  return null;
}

function normalizeColor(color: ColorRgba | string | undefined, fallback: ColorRgba = DEFAULT_SCENE_FAMILY_COLOR): ColorRgba {
  if (!color) {
    return { ...fallback };
  }

  if (typeof color === "string") {
    return parseHexColor(color) ?? { ...fallback };
  }

  return {
    r: Number(color.r ?? fallback.r),
    g: Number(color.g ?? fallback.g),
    b: Number(color.b ?? fallback.b),
    a: Number(color.a ?? fallback.a ?? 1)
  };
}

function toCanvasColor(color: ColorRgba | string, alpha = 1): string {
  if (typeof color === "string") {
    const parsed = parseHexColor(color);
    if (parsed) {
      return toCanvasColor(parsed, alpha);
    }

    return color;
  }

  const colorAlpha = typeof color.a === "number" ? color.a : 1;
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${clamp(colorAlpha * alpha, 0, 1)})`;
}

function getPreviewCenter(widthPx: number, heightPx: number, haloConfig: HaloFieldConfig): Vector3 {
  return {
    x: Number(haloConfig.composition.center_x_px ?? widthPx * 0.5),
    y: Number(haloConfig.composition.center_y_px ?? heightPx * 0.5),
    z: 0
  };
}

function getPointRadius(point: PointRecord, pointIndex: number, pointCount: number, sceneFamilyKey: PreviewableSceneFamilyKey): number {
  if (sceneFamilyKey === "fuzzy-boids") {
    const pscale = Number(point.attributes.pscale ?? 0.8);
    return clamp(1.25 + pscale * 1.8, 1.25, 4.5);
  }

  if (sceneFamilyKey === "scatter") {
    const densityWeight = Number(point.attributes.scatter_density_weight ?? 0.8);
    return clamp(1.1 + densityWeight * 2.4, 1.1, 3.8);
  }

  const normalizedIndex = pointCount <= 1 ? 0 : pointIndex / Math.max(1, pointCount - 1);
  return 0.9 + normalizedIndex * 2.1;
}

function getPointAlpha(point: PointRecord, pointIndex: number, pointCount: number, sceneFamilyKey: PreviewableSceneFamilyKey): number {
  if (sceneFamilyKey === "fuzzy-boids") {
    return Boolean(point.attributes.boid_active) ? 1 : 0;
  }

  if (sceneFamilyKey === "scatter") {
    const densityWeight = Number(point.attributes.scatter_density_weight ?? 0.8);
    return 0.42 + densityWeight * 0.5;
  }

  return 0.96;
}



function drawPointDot(
  ctx: CanvasRenderingContext2D,
  point: PointRecord,
  style: PointRenderStyle
): void {
  ctx.fillStyle = toCanvasColor(style.color, style.alpha);
  ctx.beginPath();
  ctx.arc(point.position.x, point.position.y, style.radiusPx, 0, Math.PI * 2);
  ctx.fill();
}

function getPhyllotaxisPointStyle(
  point: PointRecord,
  pointIndex: number,
  pointCount: number,
  previewState: PhyllotaxisSceneFamilyPreviewState
): PointRenderStyle {
  const pointRadius = Number(point.attributes.philo_radius ?? 0);
  const normalizedRadius = previewState.maxRadiusPx <= 0
    ? (pointCount <= 1 ? 0 : pointIndex / Math.max(1, pointCount - 1))
    : clamp(pointRadius / previewState.maxRadiusPx, 0, 1);

  return {
    color: DEFAULT_SCENE_FAMILY_COLOR,
    alpha: 0.96,
    radiusPx: 0.95 + normalizedRadius * 2.2
  };
}

function drawPhyllotaxisPreview(
  ctx: CanvasRenderingContext2D,
  previewState: PhyllotaxisSceneFamilyPreviewState
): void {
  previewState.pointField.points.forEach((point, pointIndex) => {
    drawPointDot(
      ctx,
      point,
      getPhyllotaxisPointStyle(point, pointIndex, previewState.pointField.points.length, previewState)
    );
  });
}

function drawScatterPreview(
  ctx: CanvasRenderingContext2D,
  previewState: ScatterSceneFamilyPreviewState
): void {
  previewState.pointField.points.forEach((point, pointIndex) => {
    drawPointDot(ctx, point, {
      color: DEFAULT_SCENE_FAMILY_COLOR,
      alpha: getPointAlpha(point, pointIndex, previewState.pointField.points.length, previewState.sceneFamilyKey),
      radiusPx: getPointRadius(point, pointIndex, previewState.pointField.points.length, previewState.sceneFamilyKey)
    });
  });
}

function drawFuzzyBoidsPreview(
  ctx: CanvasRenderingContext2D,
  previewState: CpuFuzzyBoidsSceneFamilyPreviewState
): void {
  previewState.boidField.boids.forEach((boid, pointIndex) => {
    const point = previewState.pointField.points[pointIndex];
    if (!point) {
      return;
    }

    const pointAlpha = getPointAlpha(point, pointIndex, previewState.pointField.points.length, previewState.sceneFamilyKey);
    const isActive = Boolean(boid.attributes.boid_active);

    if (!isActive) {
      return;
    }

    drawPointDot(ctx, point, {
      color: normalizeColor(boid.attributes.color as ColorRgba | undefined, DEFAULT_SCENE_FAMILY_COLOR),
      alpha: pointAlpha,
      radiusPx: Math.max(0.5, previewState.dotSizePx)
    });
  });
}

function drawWorkerFuzzyBoidsPreview(
  ctx: CanvasRenderingContext2D,
  previewState: WorkerFuzzyBoidsSceneFamilyPreviewState
): void {
  const { positionsPx, activeMask, boidCount } = previewState.workerSnapshot;
  const radiusPx = Math.max(0.5, previewState.dotSizePx);

  ctx.fillStyle = toCanvasColor(DEFAULT_SCENE_FAMILY_COLOR, 1);
  ctx.beginPath();
  for (let index = 0; index < boidCount; index += 1) {
    if (!activeMask[index]) {
      continue;
    }

    const offset = index * 2;
    const x = positionsPx[offset];
    const y = positionsPx[offset + 1];
    ctx.moveTo(x + radiusPx, y);
    ctx.arc(x, y, radiusPx, 0, Math.PI * 2);
  }
  ctx.fill();
}

export function clearSceneFamilyPreviewCanvas(canvas: HTMLCanvasElement, widthPx: number, heightPx: number): void {
  normalizeCanvasSize(canvas, widthPx, heightPx);
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, widthPx, heightPx);
}

export function clearGpuFuzzyBoidsPreviewCanvas(canvas: HTMLCanvasElement, widthPx: number, heightPx: number): void {
  gpuFuzzyBoidsSpike.clearPreviewCanvas(canvas, widthPx, heightPx);
}

export function buildSceneFamilyPreviewState(
  options: BuildSceneFamilyPreviewStateOptions
): SceneFamilyPreviewState | null {
  const center = getPreviewCenter(options.widthPx, options.heightPx, options.haloConfig);
  const nodesById = new Map(options.backgroundGraph.nodes.map((node) => [node.id, node]));
  const activeNode = nodesById.get(options.backgroundGraph.activeNodeId);
  if (!activeNode || activeNode.operatorKey === OVERLAY_BACKGROUND_HALO_OPERATOR_KEY) {
    return null;
  }

  let resultMap: Map<string, Record<string, unknown>>;
  try {
    resultMap = evaluateGraphSync(
      options.backgroundGraph,
      createSceneFamilyPreviewRegistry(options, center)
    );
  } catch {
    return null;
  }

  const resolvedActiveNode = resultMap.get(activeNode.id);
  if (!resolvedActiveNode) {
    return null;
  }

  if (activeNode.operatorKey === OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY) {
    const pointField = resolvedActiveNode.pointField as PointField | undefined;
    if (!pointField) {
      return null;
    }

    return {
      sceneFamilyKey: "phyllotaxis",
      pointField,
      maxRadiusPx: Number(pointField.detail.max_radius ?? (activeNode.params as OverlayPhyllotaxisConfig).radiusPx ?? 0)
    };
  }

  if (activeNode.operatorKey === OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY) {
    const pointField = resolvedActiveNode.pointField as PointField | undefined;
    if (!pointField) {
      return null;
    }

    return {
      sceneFamilyKey: "scatter",
      pointField,
      distributionMode: (activeNode.params as OverlayScatterConfig).distributionMode ?? "uniform"
    };
  }

  if (activeNode.operatorKey === OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY) {
    const previewOutputs = resolvedActiveNode as FuzzyBoidsPreviewOutputs;
    const dotSizePx = Math.max(0.5, Number(previewOutputs.dotSizePx ?? (activeNode.params as OverlayFuzzyBoidsConfig).dotSizePx ?? 3));

    if (previewOutputs.simulationBackend === "gpu-spike") {
      return {
        sceneFamilyKey: "fuzzy-boids",
        dotSizePx,
        simulationBackend: "gpu-spike"
      };
    }

    if (previewOutputs.simulationBackend === "cpu-worker" && previewOutputs.workerSnapshot) {
      return {
        sceneFamilyKey: "fuzzy-boids",
        dotSizePx,
        simulationBackend: "cpu-worker",
        workerSnapshot: previewOutputs.workerSnapshot
      };
    }

    if (previewOutputs.pointField && previewOutputs.boidField) {
      return {
        sceneFamilyKey: "fuzzy-boids",
        pointField: previewOutputs.pointField,
        boidField: previewOutputs.boidField,
        dotSizePx,
        simulationBackend: "cpu"
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// K9b — kernel renderer path
// ---------------------------------------------------------------------------

/** Only scene families that carry a PointField can use the kernel path. */
function canUseKernelPath(previewState: SceneFamilyPreviewState): boolean {
  return "pointField" in previewState && (previewState as PointFieldSceneFamilyPreviewState).pointField !== undefined;
}

function resolveStyleForPreviewState(previewState: SceneFamilyPreviewState) {
  if (previewState.sceneFamilyKey === "phyllotaxis") {
    return phyllotaxisStyleResolver(previewState.maxRadiusPx);
  }
  if (previewState.sceneFamilyKey === "scatter") {
    return scatterStyleResolver();
  }
  if (previewState.sceneFamilyKey === "fuzzy-boids" && previewState.simulationBackend === "cpu") {
    return fuzzyBoidsStyleResolver(previewState.dotSizePx);
  }
  return undefined;
}

function renderViaKernel(options: RenderSceneFamilyPreviewFrameOptions): void {
  const context = options.canvas.getContext("2d");
  if (!context) return;

  const state = options.previewState as PointFieldSceneFamilyPreviewState;
  const style = resolveStyleForPreviewState(options.previewState);
  if (!style) return;

  const bgColorRaw = options.haloConfig.composition.background_color || "#202020";
  const parsedBg = parseHexColor(bgColorRaw);
  const background: Color | undefined = options.transparentBackground
    ? undefined
    : parsedBg
      ? { r: parsedBg.r / 255, g: parsedBg.g / 255, b: parsedBg.b / 255, a: parsedBg.a ?? 1 }
      : { r: 0.125, g: 0.125, b: 0.125, a: 1 };

  const viewport: Viewport = {
    width: options.widthPx,
    height: options.heightPx,
    ...(background !== undefined ? { background } : {}),
  };

  const displayList = pointFieldToDisplayList(state.pointField, { viewport, style });
  const renderer = new Canvas2DRenderer(context);
  renderer.render(displayList);
}

export function renderSceneFamilyPreviewFrame(
  options: RenderSceneFamilyPreviewFrameOptions
): void {
  if (options.previewState.sceneFamilyKey === "fuzzy-boids" && options.previewState.simulationBackend === "gpu-spike") {
    gpuFuzzyBoidsSpike.renderPreviewCanvas(
      options.canvas,
      options.widthPx,
      options.heightPx,
      options.previewState.dotSizePx,
      options.transparentBackground,
      options.haloConfig.composition.background_color || "#202020"
    );
    return;
  }

  // -----------------------------------------------------------------------
  // K9b kernel renderer path — opt-in via useKernelRenderer flag.
  // Builds a DisplayList from the preview state and renders it with
  // Canvas2DRenderer, replacing the ad-hoc drawPointDot loops below.
  // -----------------------------------------------------------------------
  if (options.useKernelRenderer && canUseKernelPath(options.previewState)) {
    renderViaKernel(options);
    return;
  }

  normalizeCanvasSize(options.canvas, options.widthPx, options.heightPx);
  const context = options.canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, options.widthPx, options.heightPx);

  if (!options.transparentBackground) {
    context.fillStyle = options.haloConfig.composition.background_color || "#202020";
    context.fillRect(0, 0, options.widthPx, options.heightPx);
  }

  if (options.previewState.sceneFamilyKey === "phyllotaxis") {
    drawPhyllotaxisPreview(context, options.previewState);
    return;
  }

  if (options.previewState.sceneFamilyKey === "scatter") {
    drawScatterPreview(context, options.previewState);
    return;
  }

  if (options.previewState.sceneFamilyKey === "fuzzy-boids" && options.previewState.simulationBackend === "cpu-worker") {
    drawWorkerFuzzyBoidsPreview(context, options.previewState);
    return;
  }

  drawFuzzyBoidsPreview(context, options.previewState);
}