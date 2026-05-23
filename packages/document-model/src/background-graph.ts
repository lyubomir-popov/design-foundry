import {
  DEFAULT_OUTPUT_PROFILE_KEY,
  getOutputProfile,
  type FrameSize,
  type OperatorPort,
  type OperatorParameterSchema,
  type OperatorPresetDefinition
} from "@brand-layout-ops/core-types";
import {
  cloneOverlayJson,
  isRecord,
  normalizeOverlayBoolean,
  normalizeOverlayDocumentString,
  normalizeOverlayNumber
} from "./overlay-internals.js";

export const OVERLAY_SCENE_FAMILY_ORDER = [
  "halo",
  "phyllotaxis",
  "fuzzy-boids",
  "scatter"
] as const;

export type OverlaySceneFamilyKey = typeof OVERLAY_SCENE_FAMILY_ORDER[number];

export const DEFAULT_OVERLAY_SCENE_FAMILY_KEY: OverlaySceneFamilyKey = OVERLAY_SCENE_FAMILY_ORDER[0];

export type OverlayFuzzyBoidsBoundsKind = "none" | "radial" | "box";
export type OverlayScatterDistributionMode = "uniform" | "density-weighted";
export type OverlayScatterShapeKind = "ellipse" | "rect" | "rounded-rect" | "svg-path";

const MIN_OVERLAY_FUZZY_BOIDS_NEIGHBORS = 6;
const MAX_OVERLAY_FUZZY_BOIDS_NEIGHBORS = 24;
const DEFAULT_OVERLAY_FUZZY_BOIDS_NEIGHBORS = 12;

export interface OverlayFuzzyBoidsConfig {
  numBoids: number;
  seed: number;
  subSteps: number;
  spawnRadiusPx: number;
  staggerStartSeconds: number;
  initialSpeed: number;
  initialSpeedJitter: number;
  massMin: number;
  massMax: number;
  pscaleMin: number;
  pscaleMax: number;
  maxNeighbors: number;

  // Separation (VEX: separation by n)
  separationMinDist: number;
  separationMaxDist: number;
  separationMaxStrength: number;

  // Fuzzy alignment (VEX: fuzzy alignment wrangle)
  alignNearThreshold: number;
  alignFarThreshold: number;
  alignSpeedThreshold: number;

  // Cohesion (VEX: cohesion wrangle)
  cohesionMinDist: number;
  cohesionMaxDist: number;
  cohesionMaxAccel: number;
  attractToOrigin: boolean;

  // Integration (VEX: integrate wrangle)
  minSpeedLimit: number;
  maxSpeedLimit: number;
  minAccelLimit: number;
  maxAccelLimit: number;

  // Preview
  dotSizePx: number;

  // Bounds
  boundsKind: OverlayFuzzyBoidsBoundsKind;
  boundsRadiusPx: number;
  boundsMarginPx: number;
  boundsForcePxPerSecond2: number;
}

export interface OverlayPhyllotaxisConfig {
  numPoints: number;
  radiusPx: number;
  radiusFalloff: number;
  angleOffsetDeg: number;
  animationEnabled: boolean;
  animationSpeedDegPerSecond: number;
}

/** Config-level schema for the phyllotaxis graph node params. */
export const OVERLAY_PHYLLOTAXIS_CONFIG_SCHEMA: OperatorParameterSchema = {
  sections: [
    { key: "geometry", title: "Geometry" },
    { key: "animation", title: "Animation" }
  ],
  fields: [
    { kind: "number", sectionKey: "geometry", path: "numPoints", label: "Point Count", min: 1, max: 4000, step: 1 },
    { kind: "slider", sectionKey: "geometry", path: "radiusPx", label: "Radius", min: 1, max: 1200, step: 1 },
    { kind: "slider", sectionKey: "geometry", path: "radiusFalloff", label: "Radius Falloff", min: 0.05, max: 2, step: 0.01 },
    { kind: "slider", sectionKey: "animation", path: "angleOffsetDeg", label: "Angle Offset", min: -180, max: 180, step: 0.1 },
    { kind: "boolean", sectionKey: "animation", path: "animationEnabled", label: "Animate" },
    { kind: "slider", sectionKey: "animation", path: "animationSpeedDegPerSecond", label: "Animation Speed", min: -90, max: 90, step: 0.1 }
  ]
};

export interface OverlayScatterConfig {
  pointCount: number;
  seed: number;
  distributionMode: OverlayScatterDistributionMode;
  marginPx: number;
  shapeKind: OverlayScatterShapeKind;
  widthPx: number;
  heightPx: number;
  cornerRadiusPx: number;
  svgPath: string;
}

/** Config-level schema for the scatter graph node params. */
export const OVERLAY_SCATTER_CONFIG_SCHEMA: OperatorParameterSchema = {
  sections: [
    { key: "points", title: "Point Distribution" },
    { key: "shape", title: "Shape" }
  ],
  fields: [
    { kind: "number", sectionKey: "points", path: "pointCount", label: "Point Count", min: 1, max: 4000, step: 1 },
    { kind: "number", sectionKey: "points", path: "seed", label: "Seed", min: 0, max: 9999, step: 1 },
    { kind: "select", sectionKey: "points", path: "distributionMode", label: "Distribution", options: [
      { label: "Uniform", value: "uniform" },
      { label: "Density Weighted", value: "density-weighted" }
    ]},
    { kind: "slider", sectionKey: "points", path: "marginPx", label: "Margin", min: 0, max: 120, step: 1 },
    { kind: "select", sectionKey: "shape", path: "shapeKind", label: "Shape", options: [
      { label: "Ellipse", value: "ellipse" },
      { label: "Rectangle", value: "rect" },
      { label: "Rounded Rect", value: "rounded-rect" },
      { label: "SVG Path", value: "svg-path" }
    ]},
    { kind: "slider", sectionKey: "shape", path: "widthPx", label: "Width", min: 40, max: 1200, step: 1,
      visibleWhen: { path: "shapeKind", operator: "neq", value: "svg-path" } },
    { kind: "slider", sectionKey: "shape", path: "heightPx", label: "Height", min: 40, max: 1200, step: 1,
      visibleWhen: { path: "shapeKind", operator: "neq", value: "svg-path" } },
    { kind: "slider", sectionKey: "shape", path: "cornerRadiusPx", label: "Corner Radius", min: 0, max: 240, step: 1,
      visibleWhen: { path: "shapeKind", operator: "eq", value: "rounded-rect" } },
    { kind: "textarea", sectionKey: "shape", path: "svgPath", label: "SVG Path", rows: 5,
      placeholder: "M, L, H, V, Z commands in local coordinates",
      visibleWhen: { path: "shapeKind", operator: "eq", value: "svg-path" } }
  ]
};

/** Config-level schema for the fuzzy-boids graph node params. */
export const OVERLAY_FUZZY_BOIDS_CONFIG_SCHEMA: OperatorParameterSchema = {
  sections: [
    { key: "flock", title: "Flock" },
    { key: "speed", title: "Speed & Integration" },
    { key: "separation", title: "Separation" },
    { key: "alignment", title: "Fuzzy Alignment" },
    { key: "cohesion", title: "Cohesion" },
    { key: "scale", title: "Particle Scale & Mass" },
    { key: "bounds", title: "Bounds" }
  ],
  fields: [
    // Flock
    { kind: "number", sectionKey: "flock", path: "numBoids", label: "Boid Count", min: 1, max: 2000, step: 1 },
    { kind: "number", sectionKey: "flock", path: "seed", label: "Seed", min: 0, max: 9999, step: 1 },
    { kind: "number", sectionKey: "flock", path: "subSteps", label: "Sub Steps", min: 1, max: 20, step: 1 },
    { kind: "slider", sectionKey: "flock", path: "spawnRadiusPx", label: "Spawn Radius", min: 0, max: 600, step: 1 },
    { kind: "slider", sectionKey: "flock", path: "staggerStartSeconds", label: "Stagger Start", min: 0, max: 10, step: 0.1 },
    { kind: "number", sectionKey: "flock", path: "maxNeighbors", label: "Max Neighbors", min: 6, max: 24, step: 1 },
    { kind: "slider", sectionKey: "flock", path: "dotSizePx", label: "Dot Size (px)", min: 0.5, max: 12, step: 0.25 },
    // Speed & Integration
    { kind: "slider", sectionKey: "speed", path: "initialSpeed", label: "Initial Speed", min: 0, max: 20, step: 0.5 },
    { kind: "slider", sectionKey: "speed", path: "initialSpeedJitter", label: "Speed Jitter", min: 0, max: 1, step: 0.01 },
    { kind: "slider", sectionKey: "speed", path: "minSpeedLimit", label: "Min Speed", min: 0, max: 50, step: 0.5 },
    { kind: "slider", sectionKey: "speed", path: "maxSpeedLimit", label: "Max Speed", min: 0, max: 100, step: 0.5 },
    { kind: "slider", sectionKey: "speed", path: "minAccelLimit", label: "Min Accel", min: 0, max: 100, step: 0.5 },
    { kind: "slider", sectionKey: "speed", path: "maxAccelLimit", label: "Max Accel", min: 0, max: 200, step: 0.5 },
    // Separation
    { kind: "slider", sectionKey: "separation", path: "separationMinDist", label: "Sep. Min Dist", min: 0, max: 20, step: 0.1 },
    { kind: "slider", sectionKey: "separation", path: "separationMaxDist", label: "Sep. Max Dist", min: 0.1, max: 50, step: 0.1 },
    { kind: "slider", sectionKey: "separation", path: "separationMaxStrength", label: "Sep. Strength", min: 0, max: 5, step: 0.01 },
    // Fuzzy Alignment
    { kind: "slider", sectionKey: "alignment", path: "alignNearThreshold", label: "Align Near", min: 0, max: 20, step: 0.1 },
    { kind: "slider", sectionKey: "alignment", path: "alignFarThreshold", label: "Align Far", min: 0.1, max: 50, step: 0.1 },
    { kind: "slider", sectionKey: "alignment", path: "alignSpeedThreshold", label: "Align Speed", min: 0, max: 200, step: 1 },
    // Cohesion
    { kind: "slider", sectionKey: "cohesion", path: "cohesionMinDist", label: "Coh. Min Dist", min: 0, max: 100, step: 0.5 },
    { kind: "slider", sectionKey: "cohesion", path: "cohesionMaxDist", label: "Coh. Max Dist", min: 1, max: 500, step: 1 },
    { kind: "slider", sectionKey: "cohesion", path: "cohesionMaxAccel", label: "Coh. Max Accel", min: 0, max: 20, step: 0.1 },
    // Scale & Mass
    { kind: "slider", sectionKey: "scale", path: "pscaleMin", label: "P-Scale Min", min: 0.05, max: 5, step: 0.05 },
    { kind: "slider", sectionKey: "scale", path: "pscaleMax", label: "P-Scale Max", min: 0.05, max: 5, step: 0.05 },
    { kind: "slider", sectionKey: "scale", path: "massMin", label: "Mass Min", min: 0.01, max: 5, step: 0.01 },
    { kind: "slider", sectionKey: "scale", path: "massMax", label: "Mass Max", min: 0.01, max: 5, step: 0.01 },
    // Bounds
    { kind: "select", sectionKey: "bounds", path: "boundsKind", label: "Bounds", options: [
      { value: "none", label: "None" },
      { value: "box", label: "Box" },
      { value: "radial", label: "Radial" }
    ]},
    { kind: "slider", sectionKey: "bounds", path: "boundsRadiusPx", label: "Bounds Radius", min: 0, max: 1000, step: 1,
      visibleWhen: { path: "boundsKind", operator: "eq", value: "radial" } },
    { kind: "slider", sectionKey: "bounds", path: "boundsMarginPx", label: "Bounds Margin", min: 0, max: 300, step: 1 },
    { kind: "slider", sectionKey: "bounds", path: "boundsForcePxPerSecond2", label: "Bounds Force", min: 0, max: 200000, step: 1000 }
  ]
};

export interface OverlaySceneFamilyConfigs {
  phyllotaxis: OverlayPhyllotaxisConfig;
  fuzzyBoids: OverlayFuzzyBoidsConfig;
  scatter: OverlayScatterConfig;
}

/**
 * Sparse map of scene-family graphs. Only families the user has configured
 * carry an entry. Missing keys mean "not yet added to this document."
 */
export type OverlaySceneFamilyGraphs = Partial<Record<OverlaySceneFamilyKey, OverlayBackgroundGraph>>;

function getOverlaySceneFrame(profileKey: string = DEFAULT_OUTPUT_PROFILE_KEY): FrameSize {
  const profile = getOutputProfile(profileKey);
  return {
    widthPx: profile.widthPx,
    heightPx: profile.heightPx
  };
}

function getOverlayFullFrameRadiusPx(frame: FrameSize): number {
  return Math.ceil(Math.hypot(frame.widthPx, frame.heightPx) * 0.5);
}

function getOverlaySceneMarginPx(frame: FrameSize, ratio = 0.04, minimumPx = 24): number {
  return Math.max(minimumPx, Math.round(Math.min(frame.widthPx, frame.heightPx) * ratio));
}

export function createDefaultOverlayFuzzyBoidsConfig(profileKey: string = DEFAULT_OUTPUT_PROFILE_KEY): OverlayFuzzyBoidsConfig {
  const frame = getOverlaySceneFrame(profileKey);
  const fullFrameRadiusPx = getOverlayFullFrameRadiusPx(frame);
  return {
    numBoids: 50,
    seed: 1,
    subSteps: 2,
    spawnRadiusPx: fullFrameRadiusPx,
    staggerStartSeconds: 0,
    initialSpeed: 9,
    initialSpeedJitter: 0.25,
    massMin: 0.85,
    massMax: 1.15,
    pscaleMin: 0.4,
    pscaleMax: 1.1,
    maxNeighbors: DEFAULT_OVERLAY_FUZZY_BOIDS_NEIGHBORS,

    // Separation — exact Houdini defaults (world units)
    separationMinDist: 0,
    separationMaxDist: 5,
    separationMaxStrength: 0.25,

    // Fuzzy alignment — exact Houdini defaults (world units)
    alignNearThreshold: 1,
    alignFarThreshold: 5,
    alignSpeedThreshold: 50,

    // Cohesion — exact Houdini defaults (world units)
    cohesionMinDist: 20,
    cohesionMaxDist: 200,
    cohesionMaxAccel: 2.5,
    attractToOrigin: false,

    // Integration — exact Houdini defaults (world units)
    minSpeedLimit: 4,
    maxSpeedLimit: 12,
    minAccelLimit: 0,
    maxAccelLimit: 50,

    // Preview
    dotSizePx: 3,

    // Bounds (pixel-space containment — replaces Houdini SDF volumes)
    boundsKind: "box",
    boundsRadiusPx: fullFrameRadiusPx,
    boundsMarginPx: getOverlaySceneMarginPx(frame, 0.15, 80),
    boundsForcePxPerSecond2: 50000
  };
}

export function createDefaultOverlayPhyllotaxisConfig(profileKey: string = DEFAULT_OUTPUT_PROFILE_KEY): OverlayPhyllotaxisConfig {
  const frame = getOverlaySceneFrame(profileKey);
  return {
    numPoints: 720,
    radiusPx: getOverlayFullFrameRadiusPx(frame),
    radiusFalloff: 0.68,
    angleOffsetDeg: 0,
    animationEnabled: true,
    animationSpeedDegPerSecond: 14
  };
}

export function createDefaultOverlayScatterConfig(profileKey: string = DEFAULT_OUTPUT_PROFILE_KEY): OverlayScatterConfig {
  const frame = getOverlaySceneFrame(profileKey);
  return {
    pointCount: 420,
    seed: 1,
    distributionMode: "uniform",
    marginPx: getOverlaySceneMarginPx(frame),
    shapeKind: "rect",
    widthPx: frame.widthPx,
    heightPx: frame.heightPx,
    cornerRadiusPx: 64,
    svgPath: "M -220 0 L -120 -150 L 120 -150 L 220 0 L 120 150 L -120 150 Z"
  };
}

export function createDefaultOverlaySceneFamilyConfigs(profileKey: string = DEFAULT_OUTPUT_PROFILE_KEY): OverlaySceneFamilyConfigs {
  return {
    phyllotaxis: createDefaultOverlayPhyllotaxisConfig(profileKey),
    fuzzyBoids: createDefaultOverlayFuzzyBoidsConfig(profileKey),
    scatter: createDefaultOverlayScatterConfig(profileKey)
  };
}

// --- Built-in operator presets ---

export const FUZZY_BOIDS_PRESET_DEFINITIONS: readonly OperatorPresetDefinition[] = Object.freeze([
  {
    key: "gentle-drift",
    label: "Gentle Drift",
    description: "A calm flock with wide spacing, low cohesion, and slow speed for ambient motion.",
    config: {
      numBoids: 30,
      initialSpeed: 4,
      initialSpeedJitter: 0.1,
      separationMinDist: 2,
      separationMaxDist: 12,
      separationMaxStrength: 0.15,
      alignNearThreshold: 3,
      alignFarThreshold: 10,
      alignSpeedThreshold: 30,
      cohesionMinDist: 40,
      cohesionMaxDist: 300,
      cohesionMaxAccel: 1,
      minSpeedLimit: 2,
      maxSpeedLimit: 8,
      maxAccelLimit: 20,
      dotSizePx: 3.5
    }
  },
  {
    key: "tight-swarm",
    label: "Tight Swarm",
    description: "A dense, fast-moving cluster with strong cohesion and tight separation for energy.",
    config: {
      numBoids: 120,
      initialSpeed: 14,
      initialSpeedJitter: 0.4,
      separationMinDist: 0,
      separationMaxDist: 3,
      separationMaxStrength: 0.5,
      alignNearThreshold: 0.5,
      alignFarThreshold: 4,
      alignSpeedThreshold: 80,
      cohesionMinDist: 10,
      cohesionMaxDist: 100,
      cohesionMaxAccel: 5,
      minSpeedLimit: 6,
      maxSpeedLimit: 20,
      maxAccelLimit: 80,
      dotSizePx: 2
    }
  },
  {
    key: "scattered-wander",
    label: "Scattered Wander",
    description: "Independent particles with minimal flocking — each point wanders on its own.",
    config: {
      numBoids: 60,
      initialSpeed: 6,
      initialSpeedJitter: 0.5,
      separationMinDist: 0,
      separationMaxDist: 8,
      separationMaxStrength: 0.1,
      alignNearThreshold: 0.5,
      alignFarThreshold: 2,
      alignSpeedThreshold: 10,
      cohesionMinDist: 50,
      cohesionMaxDist: 400,
      cohesionMaxAccel: 0.5,
      minSpeedLimit: 3,
      maxSpeedLimit: 10,
      maxAccelLimit: 15,
      dotSizePx: 4
    }
  }
]);

export const SCATTER_PRESET_DEFINITIONS: readonly OperatorPresetDefinition[] = Object.freeze([
  {
    key: "sparse-fill",
    label: "Sparse Fill",
    description: "A light scatter of points across the full frame for subtle background texture.",
    config: {
      pointCount: 80,
      distributionMode: "uniform",
      shapeKind: "rect"
    }
  },
  {
    key: "dense-circle",
    label: "Dense Circle",
    description: "A dense cluster of points packed into an ellipse for a focused central field.",
    config: {
      pointCount: 800,
      distributionMode: "uniform",
      shapeKind: "ellipse",
      widthPx: 600,
      heightPx: 600
    }
  },
  {
    key: "weighted-cloud",
    label: "Weighted Cloud",
    description: "Density-weighted distribution that concentrates points toward the center of the shape.",
    config: {
      pointCount: 500,
      distributionMode: "density-weighted",
      shapeKind: "ellipse"
    }
  }
]);

export const PHYLLOTAXIS_PRESET_DEFINITIONS: readonly OperatorPresetDefinition[] = Object.freeze([
  {
    key: "sunflower",
    label: "Sunflower",
    description: "Classic golden-angle spiral with high point count and moderate falloff.",
    config: {
      numPoints: 1200,
      radiusFalloff: 0.5,
      angleOffsetDeg: 0,
      animationEnabled: true,
      animationSpeedDegPerSecond: 8
    }
  },
  {
    key: "tight-whorl",
    label: "Tight Whorl",
    description: "Fewer points in a compact spiral with steep falloff for a dense central cluster.",
    config: {
      numPoints: 300,
      radiusFalloff: 1.2,
      angleOffsetDeg: 0,
      animationEnabled: true,
      animationSpeedDegPerSecond: 20
    }
  },
  {
    key: "static-field",
    label: "Static Field",
    description: "A frozen spiral with no animation — useful as a fixed pattern layer.",
    config: {
      numPoints: 720,
      radiusFalloff: 0.68,
      angleOffsetDeg: 0,
      animationEnabled: false,
      animationSpeedDegPerSecond: 0
    }
  }
]);

export const OVERLAY_BACKGROUND_HALO_OPERATOR_KEY = "background.halo";
export const OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY = "operator.phyllotaxis";
export const OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY = "operator.fuzzy-boids";
export const OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY = "operator.scatter";

export type OverlayBackgroundOperatorKey =
  | typeof OVERLAY_BACKGROUND_HALO_OPERATOR_KEY
  | typeof OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY
  | typeof OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY
  | typeof OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY;

export const OVERLAY_BACKGROUND_HALO_NODE_ID = "background-halo";
export const OVERLAY_BACKGROUND_PHYLLOTAXIS_NODE_ID = "background-phyllotaxis";
export const OVERLAY_BACKGROUND_FUZZY_SEED_NODE_ID = "background-fuzzy-seed";
export const OVERLAY_BACKGROUND_FUZZY_BOIDS_NODE_ID = "background-fuzzy-boids";
export const OVERLAY_BACKGROUND_SCATTER_NODE_ID = "background-scatter";

export interface OverlayBackgroundPortDefinition extends OperatorPort {
  label: string;
}

export interface OverlayBackgroundOperatorPorts {
  inputs: OverlayBackgroundPortDefinition[];
  outputs: OverlayBackgroundPortDefinition[];
}

export interface OverlayBackgroundEdge {
  fromNodeId: string;
  fromPortKey: string;
  toNodeId: string;
  toPortKey: string;
}

export interface OverlayHaloBackgroundNode {
  id: string;
  operatorKey: typeof OVERLAY_BACKGROUND_HALO_OPERATOR_KEY;
  params: Record<string, never>;
}

export interface OverlayPhyllotaxisBackgroundNode {
  id: string;
  operatorKey: typeof OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY;
  params: OverlayPhyllotaxisConfig;
}

export interface OverlayFuzzyBoidsBackgroundNode {
  id: string;
  operatorKey: typeof OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY;
  params: OverlayFuzzyBoidsConfig;
}

export interface OverlayScatterBackgroundNode {
  id: string;
  operatorKey: typeof OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY;
  params: OverlayScatterConfig;
}

export type OverlayBackgroundNode =
  | OverlayHaloBackgroundNode
  | OverlayPhyllotaxisBackgroundNode
  | OverlayFuzzyBoidsBackgroundNode
  | OverlayScatterBackgroundNode;

export interface OverlayBackgroundGraph {
  activeNodeId: string;
  nodes: OverlayBackgroundNode[];
  edges: OverlayBackgroundEdge[];
}

export type OverlayBackgroundConnectionValidationCode =
  | "missing-source-node"
  | "missing-target-node"
  | "same-node"
  | "unknown-output-port"
  | "unknown-input-port"
  | "kind-mismatch"
  | "duplicate-edge"
  | "occupied-input"
  | "cycle";

export interface OverlayBackgroundConnectionValidationResult {
  isValid: boolean;
  code?: OverlayBackgroundConnectionValidationCode;
  outputPort?: OverlayBackgroundPortDefinition;
  inputPort?: OverlayBackgroundPortDefinition;
  existingEdge?: OverlayBackgroundEdge | null;
}

const OVERLAY_BACKGROUND_OPERATOR_PORTS = {
  [OVERLAY_BACKGROUND_HALO_OPERATOR_KEY]: {
    inputs: [],
    outputs: []
  },
  [OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY]: {
    inputs: [{
      key: "centroid",
      label: "Centroid",
      kind: "vector3",
      description: "Optional centroid input used to offset the phyllotaxis center."
    }],
    outputs: [{
      key: "pointField",
      label: "Point Field",
      kind: "point-field",
      description: "Generated phyllotaxis points for scene-family preview."
    }]
  },
  [OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY]: {
    inputs: [{
      key: "center",
      label: "Center",
      kind: "vector3",
      description: "Optional external center used as the flock anchor and bounds origin."
    }, {
      key: "seedField",
      label: "Seed Field",
      kind: "point-field",
      description: "Optional seed point field used to initialize boid positions and inherited attributes."
    }],
    outputs: [{
      key: "boidField",
      label: "Boid Field",
      kind: "boid-field",
      description: "Resolved boid records for scene-family preview."
    }, {
      key: "pointField",
      label: "Point Field",
      kind: "point-field",
      description: "Point-field projection of the preview boid simulation."
    }]
  },
  [OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY]: {
    inputs: [{
      key: "centroid",
      label: "Centroid",
      kind: "vector3",
      description: "Optional centroid input used as the scatter shape center."
    }],
    outputs: [{
      key: "pointField",
      label: "Point Field",
      kind: "point-field",
      description: "Scatter point field for scene-family preview."
    }]
  }
} satisfies Record<OverlayBackgroundOperatorKey, OverlayBackgroundOperatorPorts>;

function cloneOverlayBackgroundPortDefinition(
  port: OverlayBackgroundPortDefinition
): OverlayBackgroundPortDefinition {
  return { ...port };
}

function getOverlayBackgroundOperatorPortsInternal(
  operatorKey: OverlayBackgroundOperatorKey
): OverlayBackgroundOperatorPorts {
  return OVERLAY_BACKGROUND_OPERATOR_PORTS[operatorKey];
}

function getOverlayBackgroundEdgeKey(edge: OverlayBackgroundEdge): string {
  return `${edge.fromNodeId}:${edge.fromPortKey}:${edge.toNodeId}:${edge.toPortKey}`;
}

function wouldOverlayBackgroundEdgeCreateCycle(
  graph: Pick<OverlayBackgroundGraph, "nodes" | "edges">,
  candidateEdge: OverlayBackgroundEdge
): boolean {
  const outgoingNodeIdsByNodeId = new Map<string, string[]>();

  for (const node of graph.nodes) {
    outgoingNodeIdsByNodeId.set(node.id, []);
  }

  for (const edge of graph.edges) {
    const outgoingNodeIds = outgoingNodeIdsByNodeId.get(edge.fromNodeId) ?? [];
    outgoingNodeIds.push(edge.toNodeId);
    outgoingNodeIdsByNodeId.set(edge.fromNodeId, outgoingNodeIds);
  }

  const pendingNodeIds = [candidateEdge.toNodeId];
  const visitedNodeIds = new Set<string>();

  while (pendingNodeIds.length > 0) {
    const currentNodeId = pendingNodeIds.pop();
    if (!currentNodeId || visitedNodeIds.has(currentNodeId)) {
      continue;
    }

    if (currentNodeId === candidateEdge.fromNodeId) {
      return true;
    }

    visitedNodeIds.add(currentNodeId);

    for (const nextNodeId of outgoingNodeIdsByNodeId.get(currentNodeId) ?? []) {
      pendingNodeIds.push(nextNodeId);
    }
  }

  return false;
}

export function getOverlayBackgroundOperatorPorts(
  operatorKey: OverlayBackgroundOperatorKey
): OverlayBackgroundOperatorPorts {
  const ports = getOverlayBackgroundOperatorPortsInternal(operatorKey);
  return {
    inputs: ports.inputs.map(cloneOverlayBackgroundPortDefinition),
    outputs: ports.outputs.map(cloneOverlayBackgroundPortDefinition)
  };
}

export function getOverlayBackgroundInputPorts(
  operatorKey: OverlayBackgroundOperatorKey
): OverlayBackgroundPortDefinition[] {
  return getOverlayBackgroundOperatorPorts(operatorKey).inputs;
}

export function getOverlayBackgroundOutputPorts(
  operatorKey: OverlayBackgroundOperatorKey
): OverlayBackgroundPortDefinition[] {
  return getOverlayBackgroundOperatorPorts(operatorKey).outputs;
}

export function findOverlayBackgroundInputPort(
  operatorKey: OverlayBackgroundOperatorKey,
  portKey: string
): OverlayBackgroundPortDefinition | null {
  const port = getOverlayBackgroundOperatorPortsInternal(operatorKey).inputs.find((candidate) => candidate.key === portKey);
  return port ? cloneOverlayBackgroundPortDefinition(port) : null;
}

export function findOverlayBackgroundOutputPort(
  operatorKey: OverlayBackgroundOperatorKey,
  portKey: string
): OverlayBackgroundPortDefinition | null {
  const port = getOverlayBackgroundOperatorPortsInternal(operatorKey).outputs.find((candidate) => candidate.key === portKey);
  return port ? cloneOverlayBackgroundPortDefinition(port) : null;
}

export function getOverlayBackgroundCompatibleOutputPorts(
  sourceOperatorKey: OverlayBackgroundOperatorKey,
  targetOperatorKey: OverlayBackgroundOperatorKey,
  targetInputPortKey: string
): OverlayBackgroundPortDefinition[] {
  const inputPort = findOverlayBackgroundInputPort(targetOperatorKey, targetInputPortKey);
  if (!inputPort) {
    return [];
  }

  return getOverlayBackgroundOutputPorts(sourceOperatorKey).filter((port) => port.kind === inputPort.kind);
}

export function findOverlayBackgroundIncomingEdge(
  graph: Pick<OverlayBackgroundGraph, "edges">,
  toNodeId: string,
  toPortKey: string
): OverlayBackgroundEdge | null {
  return graph.edges.find((edge) => edge.toNodeId === toNodeId && edge.toPortKey === toPortKey) ?? null;
}

export function validateOverlayBackgroundEdge(
  graph: Pick<OverlayBackgroundGraph, "nodes" | "edges">,
  candidateEdge: OverlayBackgroundEdge,
  options: { allowReplacingInput?: boolean } = {}
): OverlayBackgroundConnectionValidationResult {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const sourceNode = nodesById.get(candidateEdge.fromNodeId);
  if (!sourceNode) {
    return {
      isValid: false,
      code: "missing-source-node"
    };
  }

  const targetNode = nodesById.get(candidateEdge.toNodeId);
  if (!targetNode) {
    return {
      isValid: false,
      code: "missing-target-node"
    };
  }

  if (candidateEdge.fromNodeId === candidateEdge.toNodeId) {
    return {
      isValid: false,
      code: "same-node"
    };
  }

  const outputPort = findOverlayBackgroundOutputPort(sourceNode.operatorKey, candidateEdge.fromPortKey);
  if (!outputPort) {
    return {
      isValid: false,
      code: "unknown-output-port"
    };
  }

  const inputPort = findOverlayBackgroundInputPort(targetNode.operatorKey, candidateEdge.toPortKey);
  if (!inputPort) {
    return {
      isValid: false,
      code: "unknown-input-port"
    };
  }

  if (outputPort.kind !== inputPort.kind) {
    return {
      isValid: false,
      code: "kind-mismatch",
      outputPort,
      inputPort
    };
  }

  const duplicateEdge = graph.edges.find((edge) => getOverlayBackgroundEdgeKey(edge) === getOverlayBackgroundEdgeKey(candidateEdge));
  if (duplicateEdge) {
    return {
      isValid: false,
      code: "duplicate-edge",
      outputPort,
      inputPort,
      existingEdge: duplicateEdge
    };
  }

  const existingEdge = findOverlayBackgroundIncomingEdge(graph, candidateEdge.toNodeId, candidateEdge.toPortKey);
  if (existingEdge && !options.allowReplacingInput) {
    return {
      isValid: false,
      code: "occupied-input",
      outputPort,
      inputPort,
      existingEdge
    };
  }

  const cycleCheckEdges = existingEdge && options.allowReplacingInput
    ? graph.edges.filter((edge) => edge !== existingEdge)
    : graph.edges;

  if (wouldOverlayBackgroundEdgeCreateCycle({ nodes: graph.nodes, edges: cycleCheckEdges }, candidateEdge)) {
    return {
      isValid: false,
      code: "cycle",
      outputPort,
      inputPort,
      existingEdge
    };
  }

  return {
    isValid: true,
    outputPort,
    inputPort,
    existingEdge
  };
}

function createDefaultOverlayFuzzySeedConfig(
  fuzzyBoidsConfig: OverlayFuzzyBoidsConfig,
  profileKey: string = DEFAULT_OUTPUT_PROFILE_KEY
): OverlayPhyllotaxisConfig {
  const defaultPhyllotaxisConfig = createDefaultOverlayPhyllotaxisConfig(profileKey);
  return {
    numPoints: Math.max(1, Math.round(fuzzyBoidsConfig.numBoids)),
    radiusPx: Math.max(defaultPhyllotaxisConfig.radiusPx, fuzzyBoidsConfig.spawnRadiusPx),
    radiusFalloff: defaultPhyllotaxisConfig.radiusFalloff,
    angleOffsetDeg: 0,
    animationEnabled: true,
    animationSpeedDegPerSecond: 8
  };
}

export function getOverlayBackgroundOperatorKey(sceneFamilyKey: OverlaySceneFamilyKey): OverlayBackgroundOperatorKey {
  switch (sceneFamilyKey) {
    case "phyllotaxis":
      return OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY;
    case "fuzzy-boids":
      return OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY;
    case "scatter":
      return OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY;
    default:
      return OVERLAY_BACKGROUND_HALO_OPERATOR_KEY;
  }
}

export function getOverlaySceneFamilyKeyForBackgroundOperator(
  operatorKey: OverlayBackgroundOperatorKey
): OverlaySceneFamilyKey {
  switch (operatorKey) {
    case OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY:
      return "phyllotaxis";
    case OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY:
      return "fuzzy-boids";
    case OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY:
      return "scatter";
    default:
      return "halo";
  }
}

export function getOverlaySceneFamilyKeyForBackgroundGraph(
  graph: OverlayBackgroundGraph,
  fallbackKey: OverlaySceneFamilyKey = DEFAULT_OVERLAY_SCENE_FAMILY_KEY
): OverlaySceneFamilyKey {
  const activeNode = graph.nodes.find((node) => node.id === graph.activeNodeId) ?? graph.nodes[0];
  if (!activeNode) {
    return fallbackKey;
  }

  return getOverlaySceneFamilyKeyForBackgroundOperator(activeNode.operatorKey);
}

export function createDefaultOverlayBackgroundGraph(
  sceneFamilyKey: OverlaySceneFamilyKey = DEFAULT_OVERLAY_SCENE_FAMILY_KEY,
  sceneFamilyConfigs: OverlaySceneFamilyConfigs = createDefaultOverlaySceneFamilyConfigs(),
  profileKey: string = DEFAULT_OUTPUT_PROFILE_KEY
): OverlayBackgroundGraph {
  switch (sceneFamilyKey) {
    case "phyllotaxis":
      return {
        activeNodeId: OVERLAY_BACKGROUND_PHYLLOTAXIS_NODE_ID,
        nodes: [{
          id: OVERLAY_BACKGROUND_PHYLLOTAXIS_NODE_ID,
          operatorKey: OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY,
          params: cloneOverlayJson(sceneFamilyConfigs.phyllotaxis)
        }],
        edges: []
      };
    case "fuzzy-boids":
      return {
        activeNodeId: OVERLAY_BACKGROUND_FUZZY_BOIDS_NODE_ID,
        nodes: [
          {
            id: OVERLAY_BACKGROUND_FUZZY_SEED_NODE_ID,
            operatorKey: OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY,
            params: createDefaultOverlayFuzzySeedConfig(sceneFamilyConfigs.fuzzyBoids, profileKey)
          },
          {
            id: OVERLAY_BACKGROUND_FUZZY_BOIDS_NODE_ID,
            operatorKey: OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY,
            params: cloneOverlayJson(sceneFamilyConfigs.fuzzyBoids)
          }
        ],
        edges: [{
          fromNodeId: OVERLAY_BACKGROUND_FUZZY_SEED_NODE_ID,
          fromPortKey: "pointField",
          toNodeId: OVERLAY_BACKGROUND_FUZZY_BOIDS_NODE_ID,
          toPortKey: "seedField"
        }]
      };
    case "scatter":
      return {
        activeNodeId: OVERLAY_BACKGROUND_SCATTER_NODE_ID,
        nodes: [{
          id: OVERLAY_BACKGROUND_SCATTER_NODE_ID,
          operatorKey: OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY,
          params: cloneOverlayJson(sceneFamilyConfigs.scatter)
        }],
        edges: []
      };
    default:
      return {
        activeNodeId: OVERLAY_BACKGROUND_HALO_NODE_ID,
        nodes: [{
          id: OVERLAY_BACKGROUND_HALO_NODE_ID,
          operatorKey: OVERLAY_BACKGROUND_HALO_OPERATOR_KEY,
          params: {}
        }],
        edges: []
      };
  }
}

export function createDefaultOverlaySceneFamilyGraphs(
  sceneFamilyConfigs: OverlaySceneFamilyConfigs = createDefaultOverlaySceneFamilyConfigs(),
  profileKey: string = DEFAULT_OUTPUT_PROFILE_KEY,
  activeSceneFamilyKey: OverlaySceneFamilyKey = DEFAULT_OVERLAY_SCENE_FAMILY_KEY
): OverlaySceneFamilyGraphs {
  return {
    [activeSceneFamilyKey]: createDefaultOverlayBackgroundGraph(activeSceneFamilyKey, sceneFamilyConfigs, profileKey)
  };
}

export function cloneOverlayBackgroundGraph(graph: OverlayBackgroundGraph): OverlayBackgroundGraph {
  return cloneOverlayJson(graph);
}

export function cloneOverlaySceneFamilyGraphs(
  sceneFamilyGraphs: OverlaySceneFamilyGraphs
): OverlaySceneFamilyGraphs {
  return cloneOverlayJson(sceneFamilyGraphs);
}

export function normalizeOverlaySceneFamilyKey(
  rawSceneFamilyKey: unknown,
  fallbackKey: OverlaySceneFamilyKey = DEFAULT_OVERLAY_SCENE_FAMILY_KEY
): OverlaySceneFamilyKey {
  if (typeof rawSceneFamilyKey !== "string") {
    return fallbackKey;
  }

  return OVERLAY_SCENE_FAMILY_ORDER.includes(rawSceneFamilyKey as OverlaySceneFamilyKey)
    ? rawSceneFamilyKey as OverlaySceneFamilyKey
    : fallbackKey;
}

function normalizeOverlayFuzzyBoidsBoundsKind(
  rawBoundsKind: unknown,
  fallbackKind: OverlayFuzzyBoidsBoundsKind
): OverlayFuzzyBoidsBoundsKind {
  return rawBoundsKind === "none" || rawBoundsKind === "radial" || rawBoundsKind === "box"
    ? rawBoundsKind
    : fallbackKind;
}

function normalizeOverlayScatterDistributionMode(
  rawDistributionMode: unknown,
  fallbackMode: OverlayScatterDistributionMode
): OverlayScatterDistributionMode {
  return rawDistributionMode === "uniform" || rawDistributionMode === "density-weighted"
    ? rawDistributionMode
    : fallbackMode;
}

function normalizeOverlayScatterShapeKind(
  rawShapeKind: unknown,
  fallbackKind: OverlayScatterShapeKind
): OverlayScatterShapeKind {
  return rawShapeKind === "ellipse"
    || rawShapeKind === "rect"
    || rawShapeKind === "rounded-rect"
    || rawShapeKind === "svg-path"
    ? rawShapeKind
    : fallbackKind;
}

export function cloneOverlaySceneFamilyConfigs(
  sceneFamilyConfigs: OverlaySceneFamilyConfigs
): OverlaySceneFamilyConfigs {
  return cloneOverlayJson(sceneFamilyConfigs);
}

/**
 * Extract per-family configs from the current background graph node params.
 * Used to snapshot live graph state back into sceneFamilyConfigs at family-switch
 * boundaries so future graph seeding preserves the user's last edited values.
 */
export function extractOverlaySceneFamilyConfigsFromGraph(
  graph: OverlayBackgroundGraph,
  fallback: OverlaySceneFamilyConfigs
): OverlaySceneFamilyConfigs {
  const result = cloneOverlayJson(fallback);
  for (const node of graph.nodes) {
    switch (node.operatorKey) {
      case OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY:
        if (node.id !== OVERLAY_BACKGROUND_FUZZY_SEED_NODE_ID) {
          result.phyllotaxis = cloneOverlayJson(node.params) as OverlayPhyllotaxisConfig;
        }
        break;
      case OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY:
        result.fuzzyBoids = cloneOverlayJson(node.params) as OverlayFuzzyBoidsConfig;
        break;
      case OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY:
        result.scatter = cloneOverlayJson(node.params) as OverlayScatterConfig;
        break;
    }
  }
  return result;
}

function normalizeOverlayPhyllotaxisConfig(
  rawConfig: unknown,
  fallbackConfig: OverlayPhyllotaxisConfig = createDefaultOverlayPhyllotaxisConfig()
): OverlayPhyllotaxisConfig {
  const rawPhyllotaxis = isRecord(rawConfig) ? rawConfig : {};
  return {
    numPoints: Math.max(1, Math.round(normalizeOverlayNumber(rawPhyllotaxis.numPoints, fallbackConfig.numPoints))),
    radiusPx: Math.max(normalizeOverlayNumber(rawPhyllotaxis.radiusPx, fallbackConfig.radiusPx), fallbackConfig.radiusPx),
    radiusFalloff: normalizeOverlayNumber(rawPhyllotaxis.radiusFalloff, fallbackConfig.radiusFalloff),
    angleOffsetDeg: normalizeOverlayNumber(rawPhyllotaxis.angleOffsetDeg, fallbackConfig.angleOffsetDeg),
    animationEnabled: normalizeOverlayBoolean(rawPhyllotaxis.animationEnabled, fallbackConfig.animationEnabled),
    animationSpeedDegPerSecond: normalizeOverlayNumber(
      rawPhyllotaxis.animationSpeedDegPerSecond,
      fallbackConfig.animationSpeedDegPerSecond
    )
  };
}

function normalizeOverlayFuzzyBoidsConfig(
  rawConfig: unknown,
  fallbackConfig: OverlayFuzzyBoidsConfig = createDefaultOverlayFuzzyBoidsConfig()
): OverlayFuzzyBoidsConfig {
  const rawFuzzyBoids = isRecord(rawConfig) ? rawConfig : {};
  return {
    numBoids: Math.max(1, Math.round(normalizeOverlayNumber(rawFuzzyBoids.numBoids, fallbackConfig.numBoids))),
    seed: Math.max(0, Math.round(normalizeOverlayNumber(rawFuzzyBoids.seed, fallbackConfig.seed))),
    subSteps: Math.max(1, Math.round(normalizeOverlayNumber(rawFuzzyBoids.subSteps, fallbackConfig.subSteps))),
    spawnRadiusPx: normalizeOverlayNumber(rawFuzzyBoids.spawnRadiusPx, fallbackConfig.spawnRadiusPx),
    staggerStartSeconds: normalizeOverlayNumber(rawFuzzyBoids.staggerStartSeconds, fallbackConfig.staggerStartSeconds),
    initialSpeed: normalizeOverlayNumber(rawFuzzyBoids.initialSpeed, fallbackConfig.initialSpeed),
    initialSpeedJitter: normalizeOverlayNumber(rawFuzzyBoids.initialSpeedJitter, fallbackConfig.initialSpeedJitter),
    massMin: normalizeOverlayNumber(rawFuzzyBoids.massMin, fallbackConfig.massMin),
    massMax: normalizeOverlayNumber(rawFuzzyBoids.massMax, fallbackConfig.massMax),
    pscaleMin: normalizeOverlayNumber(rawFuzzyBoids.pscaleMin, fallbackConfig.pscaleMin),
    pscaleMax: normalizeOverlayNumber(rawFuzzyBoids.pscaleMax, fallbackConfig.pscaleMax),
    maxNeighbors: Math.min(
      MAX_OVERLAY_FUZZY_BOIDS_NEIGHBORS,
      Math.max(
        MIN_OVERLAY_FUZZY_BOIDS_NEIGHBORS,
        Math.round(normalizeOverlayNumber(rawFuzzyBoids.maxNeighbors, fallbackConfig.maxNeighbors))
      )
    ),
    separationMinDist: normalizeOverlayNumber(rawFuzzyBoids.separationMinDist, fallbackConfig.separationMinDist),
    separationMaxDist: normalizeOverlayNumber(rawFuzzyBoids.separationMaxDist, fallbackConfig.separationMaxDist),
    separationMaxStrength: normalizeOverlayNumber(rawFuzzyBoids.separationMaxStrength, fallbackConfig.separationMaxStrength),
    alignNearThreshold: normalizeOverlayNumber(rawFuzzyBoids.alignNearThreshold, fallbackConfig.alignNearThreshold),
    alignFarThreshold: normalizeOverlayNumber(rawFuzzyBoids.alignFarThreshold, fallbackConfig.alignFarThreshold),
    alignSpeedThreshold: normalizeOverlayNumber(rawFuzzyBoids.alignSpeedThreshold, fallbackConfig.alignSpeedThreshold),
    cohesionMinDist: normalizeOverlayNumber(rawFuzzyBoids.cohesionMinDist, fallbackConfig.cohesionMinDist),
    cohesionMaxDist: normalizeOverlayNumber(rawFuzzyBoids.cohesionMaxDist, fallbackConfig.cohesionMaxDist),
    cohesionMaxAccel: normalizeOverlayNumber(rawFuzzyBoids.cohesionMaxAccel, fallbackConfig.cohesionMaxAccel),
    attractToOrigin: normalizeOverlayBoolean(rawFuzzyBoids.attractToOrigin, fallbackConfig.attractToOrigin),
    minSpeedLimit: normalizeOverlayNumber(rawFuzzyBoids.minSpeedLimit, fallbackConfig.minSpeedLimit),
    maxSpeedLimit: normalizeOverlayNumber(rawFuzzyBoids.maxSpeedLimit, fallbackConfig.maxSpeedLimit),
    minAccelLimit: normalizeOverlayNumber(rawFuzzyBoids.minAccelLimit, fallbackConfig.minAccelLimit),
    maxAccelLimit: normalizeOverlayNumber(rawFuzzyBoids.maxAccelLimit, fallbackConfig.maxAccelLimit),
    dotSizePx: Math.max(0.5, normalizeOverlayNumber(rawFuzzyBoids.dotSizePx, fallbackConfig.dotSizePx)),
    boundsKind: normalizeOverlayFuzzyBoidsBoundsKind(rawFuzzyBoids.boundsKind, fallbackConfig.boundsKind),
    boundsRadiusPx: normalizeOverlayNumber(rawFuzzyBoids.boundsRadiusPx, fallbackConfig.boundsRadiusPx),
    boundsMarginPx: normalizeOverlayNumber(rawFuzzyBoids.boundsMarginPx, fallbackConfig.boundsMarginPx),
    boundsForcePxPerSecond2: normalizeOverlayNumber(
      rawFuzzyBoids.boundsForcePxPerSecond2,
      fallbackConfig.boundsForcePxPerSecond2
    )
  };
}

function normalizeOverlayScatterConfig(
  rawConfig: unknown,
  fallbackConfig: OverlayScatterConfig = createDefaultOverlayScatterConfig()
): OverlayScatterConfig {
  const rawScatter = isRecord(rawConfig) ? rawConfig : {};
  return {
    pointCount: Math.max(1, Math.round(normalizeOverlayNumber(rawScatter.pointCount, fallbackConfig.pointCount))),
    seed: Math.max(0, Math.round(normalizeOverlayNumber(rawScatter.seed, fallbackConfig.seed))),
    distributionMode: normalizeOverlayScatterDistributionMode(rawScatter.distributionMode, fallbackConfig.distributionMode),
    marginPx: normalizeOverlayNumber(rawScatter.marginPx, fallbackConfig.marginPx),
    shapeKind: normalizeOverlayScatterShapeKind(rawScatter.shapeKind, fallbackConfig.shapeKind),
    widthPx: Math.max(normalizeOverlayNumber(rawScatter.widthPx, fallbackConfig.widthPx), fallbackConfig.widthPx),
    heightPx: Math.max(normalizeOverlayNumber(rawScatter.heightPx, fallbackConfig.heightPx), fallbackConfig.heightPx),
    cornerRadiusPx: normalizeOverlayNumber(rawScatter.cornerRadiusPx, fallbackConfig.cornerRadiusPx),
    svgPath: normalizeOverlayDocumentString(rawScatter.svgPath, fallbackConfig.svgPath)
  };
}

export function normalizeOverlaySceneFamilyConfigs(
  rawConfigs: unknown,
  profileKey: string = DEFAULT_OUTPUT_PROFILE_KEY
): OverlaySceneFamilyConfigs {
  const defaults = createDefaultOverlaySceneFamilyConfigs(profileKey);
  if (!isRecord(rawConfigs)) {
    return defaults;
  }

  return {
    phyllotaxis: normalizeOverlayPhyllotaxisConfig(rawConfigs.phyllotaxis, defaults.phyllotaxis),
    fuzzyBoids: normalizeOverlayFuzzyBoidsConfig(rawConfigs.fuzzyBoids, defaults.fuzzyBoids),
    scatter: normalizeOverlayScatterConfig(rawConfigs.scatter, defaults.scatter)
  };
}

export function normalizeOverlaySceneFamilyGraphs(
  rawGraphs: unknown,
  profileKey: string = DEFAULT_OUTPUT_PROFILE_KEY,
  rawLegacyConfigs: unknown = undefined,
  activeSceneFamilyKey: OverlaySceneFamilyKey = DEFAULT_OVERLAY_SCENE_FAMILY_KEY
): OverlaySceneFamilyGraphs {
  const legacySceneFamilyConfigs = normalizeOverlaySceneFamilyConfigs(rawLegacyConfigs, profileKey);
  if (!isRecord(rawGraphs)) {
    return createDefaultOverlaySceneFamilyGraphs(legacySceneFamilyConfigs, profileKey, activeSceneFamilyKey);
  }

  // Only normalize keys that exist in the incoming data (sparse)
  const result: OverlaySceneFamilyGraphs = {};
  for (const key of OVERLAY_SCENE_FAMILY_ORDER) {
    const rawEntry = key === "fuzzy-boids"
      ? (rawGraphs["fuzzy-boids"] ?? rawGraphs.fuzzyBoids)
      : rawGraphs[key];
    if (rawEntry !== undefined) {
      result[key] = normalizeOverlayBackgroundGraph(rawEntry, key, legacySceneFamilyConfigs);
    }
  }

  // Ensure at least the active family has a graph
  if (!result[activeSceneFamilyKey]) {
    result[activeSceneFamilyKey] = createDefaultOverlayBackgroundGraph(
      activeSceneFamilyKey,
      legacySceneFamilyConfigs,
      profileKey
    );
  }

  return result;
}

function normalizeOverlayBackgroundOperatorKey(rawOperatorKey: unknown): OverlayBackgroundOperatorKey | null {
  return rawOperatorKey === OVERLAY_BACKGROUND_HALO_OPERATOR_KEY
    || rawOperatorKey === OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY
    || rawOperatorKey === OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY
    || rawOperatorKey === OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY
    ? rawOperatorKey
    : null;
}

function createNormalizedOverlayBackgroundNode(
  rawNode: unknown,
  nodeIndex: number,
  sceneFamilyConfigs: OverlaySceneFamilyConfigs,
  fallbackNodesById: Map<string, OverlayBackgroundNode>
): OverlayBackgroundNode | null {
  if (!isRecord(rawNode)) {
    return null;
  }

  const operatorKey = normalizeOverlayBackgroundOperatorKey(rawNode.operatorKey);
  if (!operatorKey) {
    return null;
  }

  const fallbackNodeId = `background-node-${nodeIndex + 1}`;
  const nodeId = normalizeOverlayDocumentString(rawNode.id, fallbackNodeId);
  const fallbackNode = fallbackNodesById.get(nodeId);

  switch (operatorKey) {
    case OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY:
      return {
        id: nodeId,
        operatorKey,
        params: normalizeOverlayPhyllotaxisConfig(
          rawNode.params,
          fallbackNode?.operatorKey === operatorKey ? fallbackNode.params : sceneFamilyConfigs.phyllotaxis
        )
      };
    case OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY:
      return {
        id: nodeId,
        operatorKey,
        params: normalizeOverlayFuzzyBoidsConfig(
          rawNode.params,
          fallbackNode?.operatorKey === operatorKey ? fallbackNode.params : sceneFamilyConfigs.fuzzyBoids
        )
      };
    case OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY:
      return {
        id: nodeId,
        operatorKey,
        params: normalizeOverlayScatterConfig(
          rawNode.params,
          fallbackNode?.operatorKey === operatorKey ? fallbackNode.params : sceneFamilyConfigs.scatter
        )
      };
    default:
      return {
        id: nodeId,
        operatorKey,
        params: {}
      };
  }
}

export function normalizeOverlayBackgroundGraph(
  rawGraph: unknown,
  sceneFamilyKey: OverlaySceneFamilyKey,
  sceneFamilyConfigs: OverlaySceneFamilyConfigs
): OverlayBackgroundGraph {
  const fallbackGraph = createDefaultOverlayBackgroundGraph(sceneFamilyKey, sceneFamilyConfigs);
  if (!isRecord(rawGraph) || !Array.isArray(rawGraph.nodes)) {
    return fallbackGraph;
  }

  const fallbackNodesById = new Map(fallbackGraph.nodes.map((node) => [node.id, node]));
  const nodes: OverlayBackgroundNode[] = [];
  const seenNodeIds = new Set<string>();

  rawGraph.nodes.forEach((rawNode, nodeIndex) => {
    const normalizedNode = createNormalizedOverlayBackgroundNode(rawNode, nodeIndex, sceneFamilyConfigs, fallbackNodesById);
    if (!normalizedNode || seenNodeIds.has(normalizedNode.id)) {
      return;
    }

    nodes.push(normalizedNode);
    seenNodeIds.add(normalizedNode.id);
  });

  if (nodes.length === 0) {
    return fallbackGraph;
  }

  const activeNodeId = normalizeOverlayDocumentString(rawGraph.activeNodeId, fallbackGraph.activeNodeId);
  const activeNode = nodes.find((node) => node.id === activeNodeId);
  if (!activeNode || getOverlaySceneFamilyKeyForBackgroundOperator(activeNode.operatorKey) !== sceneFamilyKey) {
    return fallbackGraph;
  }

  const edges: OverlayBackgroundEdge[] = [];

  if (Array.isArray(rawGraph.edges)) {
    rawGraph.edges.forEach((rawEdge) => {
      if (!isRecord(rawEdge)) {
        return;
      }

      const fromNodeId = normalizeOverlayDocumentString(rawEdge.fromNodeId, "");
      const fromPortKey = normalizeOverlayDocumentString(rawEdge.fromPortKey, "");
      const toNodeId = normalizeOverlayDocumentString(rawEdge.toNodeId, "");
      const toPortKey = normalizeOverlayDocumentString(rawEdge.toPortKey, "");
      if (
        fromNodeId.length === 0
        || fromPortKey.length === 0
        || toNodeId.length === 0
        || toPortKey.length === 0
      ) {
        return;
      }

      const candidateEdge = { fromNodeId, fromPortKey, toNodeId, toPortKey };
      const validation = validateOverlayBackgroundEdge({ nodes, edges }, candidateEdge);
      if (!validation.isValid) {
        return;
      }

      edges.push(candidateEdge);
    });
  }

  return {
    activeNodeId,
    nodes,
    edges
  };
}
