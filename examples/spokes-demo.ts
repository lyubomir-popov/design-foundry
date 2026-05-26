import type { OperatorDefinition, OperatorGraph, PrototypeLibrary } from "@design-foundry/core-types";
import { OperatorRegistry, evaluateGraph } from "@design-foundry/graph-runtime";
import { copyToPointsOperator } from "../packages/operator-copy-to-points/src/index.js";
import { createPrototypeLibraryFromRecords } from "../packages/operator-orbits/src/index.js";
import { SPOKES_OPERATOR_KEY, spokesOperator } from "../packages/operator-spokes/src/index.js";

const PROTOTYPE_LIBRARY_OPERATOR_KEY = "demo.prototype-library";

const prototypeLibrary: PrototypeLibrary = createPrototypeLibraryFromRecords([
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
]);

const prototypeLibraryOperator: OperatorDefinition = {
  key: PROTOTYPE_LIBRARY_OPERATOR_KEY,
  version: "0.1.0",
  inputs: [],
  outputs: [
    {
      key: "prototypeLibrary",
      kind: "prototype-library",
      description: "Static prototype library used for demo instancing."
    }
  ],
  run() {
    return {
      prototypeLibrary
    };
  }
};

const registry = new OperatorRegistry();
registry.register(spokesOperator);
registry.register(copyToPointsOperator);
registry.register(prototypeLibraryOperator);

const graph: OperatorGraph = {
  nodes: [
    {
      id: "spokes",
      operatorKey: SPOKES_OPERATOR_KEY,
      params: {
        timeSeconds: 1.5,
        center: { x: 360, y: 240, z: 0 },
        defaultPrototypeIds: ["dot", "spark"],
        defaultPscale: 0.8,
        bands: [
          {
            spokeCount: 10,
            pointsPerSpoke: 5,
            innerRadiusPx: 24,
            outerRadiusPx: 180,
            angularVelocityDegPerSecond: 8,
            pscaleStart: 0.45,
            pscaleEnd: 0.9,
            color: { r: 1, g: 0.86, b: 0.64, a: 1 }
          },
          {
            spokeCount: 18,
            pointsPerSpoke: 4,
            innerRadiusPx: 110,
            outerRadiusPx: 300,
            angleOffsetDeg: 10,
            angularVelocityDegPerSecond: -5,
            pscaleStart: 0.7,
            pscaleEnd: 1.25,
            prototypeIds: ["spark", "dot", "spark"],
            color: { r: 0.82, g: 0.92, b: 1, a: 0.95 }
          }
        ]
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
        defaultPrototypeId: "dot"
      }
    }
  ],
  edges: [
    {
      fromNodeId: "spokes",
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
const pointField = outputs.get("spokes")?.pointField;
const instanceSet = outputs.get("copy-to-points")?.instanceSet;

if (!pointField || !instanceSet) {
  throw new Error("Spokes demo did not produce the expected outputs.");
}

console.log(JSON.stringify({ pointField, instanceSet }, null, 2));