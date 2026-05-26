import type { OperatorDefinition, OperatorGraph, PrototypeLibrary } from "@design-foundry/core-types";
import { OperatorRegistry, evaluateGraph } from "@design-foundry/graph-runtime";
import { copyToPointsOperator } from "../packages/operator-copy-to-points/src/index.js";
import { FUZZY_BOIDS_OPERATOR_KEY, fuzzyBoidsOperator } from "../packages/operator-fuzzy-boids/src/index.js";
import { phyllotaxisOperator } from "../packages/operator-phyllotaxis/src/index.js";

const PROTOTYPE_LIBRARY_OPERATOR_KEY = "demo.prototype-library";
const FRAME_WIDTH_PX = 1280;
const FRAME_HEIGHT_PX = 720;
const FRAME_CENTER = { x: FRAME_WIDTH_PX * 0.5, y: FRAME_HEIGHT_PX * 0.5, z: 0 };
const FULL_FRAME_RADIUS_PX = Math.ceil(Math.hypot(FRAME_WIDTH_PX, FRAME_HEIGHT_PX) * 0.5);

const prototypeLibrary: PrototypeLibrary = {
  prototypes: [
    {
      id: "dot",
      kind: "mesh",
      source: "./assets/dot.glb"
    },
    {
      id: "spark",
      kind: "svg",
      source: "./assets/spark.svg"
    }
  ],
  detail: {}
};

const prototypeLibraryOperator: OperatorDefinition = {
  key: PROTOTYPE_LIBRARY_OPERATOR_KEY,
  version: "0.1.0",
  inputs: [],
  outputs: [
    {
      key: "prototypeLibrary",
      kind: "prototype-library",
      description: "Static prototype library used for boid instancing demo output."
    }
  ],
  run() {
    return {
      prototypeLibrary
    };
  }
};

const registry = new OperatorRegistry();
registry.register(phyllotaxisOperator);
registry.register(fuzzyBoidsOperator);
registry.register(copyToPointsOperator);
registry.register(prototypeLibraryOperator);

const graph: OperatorGraph = {
  nodes: [
    {
      id: "phyllotaxis",
      operatorKey: "operator.phyllotaxis",
      params: {
        numPoints: 48,
        radius: FULL_FRAME_RADIUS_PX,
        radiusFalloff: 0.55,
        angleOffsetDeg: 0,
        origin: FRAME_CENTER
      }
    },
    {
      id: "fuzzy-boids",
      operatorKey: FUZZY_BOIDS_OPERATOR_KEY,
      params: {
        timeSeconds: 3.5,
        deltaTimeSeconds: 1 / 24,
        subSteps: 2,
        worldScale: Math.min(FRAME_WIDTH_PX, FRAME_HEIGHT_PX) / 6,
        seed: 7,
        spawnRadiusPx: FULL_FRAME_RADIUS_PX,
        staggerStartSeconds: 0,
        initialSpeed: 9,
        initialSpeedJitter: 0.25,
        massMin: 0.85,
        massMax: 1.15,
        pscaleMin: 0.45,
        pscaleMax: 1.15,
        maxNeighbors: 6,
        separationMinDist: 0,
        separationMaxDist: 5,
        separationMaxStrength: 0.25,
        alignNearThreshold: 1,
        alignFarThreshold: 5,
        alignSpeedThreshold: 50,
        cohesionMinDist: 20,
        cohesionMaxDist: 200,
        cohesionMaxAccel: 2.5,
        minSpeedLimit: 4,
        maxSpeedLimit: 12,
        minAccelLimit: 0,
        maxAccelLimit: 50,
        bounds: {
          kind: "box",
          widthPx: FRAME_WIDTH_PX,
          heightPx: FRAME_HEIGHT_PX,
          marginPx: 48,
          forcePxPerSecond2: 220
        },
        prototypeIds: ["dot", "spark", "dot"]
      }
    },
    {
      id: "prototype-library",
      operatorKey: PROTOTYPE_LIBRARY_OPERATOR_KEY,
      params: {}
    },
    {
      id: "copy-to-points",
      operatorKey: "operator.copy-to-points",
      params: {
        defaultPrototypeId: "dot",
        normalAttribute: "N"
      }
    }
  ],
  edges: [
    {
      fromNodeId: "phyllotaxis",
      fromPortKey: "pointField",
      toNodeId: "fuzzy-boids",
      toPortKey: "seedField"
    },
    {
      fromNodeId: "fuzzy-boids",
      fromPortKey: "pointField",
      toNodeId: "copy-to-points",
      toPortKey: "pointField"
    },
    {
      fromNodeId: "prototype-library",
      fromPortKey: "prototypeLibrary",
      toNodeId: "copy-to-points",
      toPortKey: "prototypeLibrary"
    }
  ]
};

const outputs = await evaluateGraph(graph, registry);
const boidField = outputs.get("fuzzy-boids")?.boidField;
const pointField = outputs.get("fuzzy-boids")?.pointField;
const instanceSet = outputs.get("copy-to-points")?.instanceSet;

if (!boidField || !pointField || !instanceSet) {
  throw new Error("Fuzzy boids demo did not produce the expected outputs.");
}

console.log(JSON.stringify({ boidField, pointField, instanceSet }, null, 2));