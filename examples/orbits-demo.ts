import type { OperatorDefinition, OperatorGraph, PrototypeLibrary } from "@design-foundry/core-types";
import { OperatorRegistry, evaluateGraph } from "@design-foundry/graph-runtime";
import { copyToPointsOperator } from "../packages/operator-copy-to-points/src/index.js";
import { createPrototypeLibraryFromRecords, orbitsOperator, ORBITS_OPERATOR_KEY } from "../packages/operator-orbits/src/index.js";

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
registry.register(orbitsOperator);
registry.register(copyToPointsOperator);
registry.register(prototypeLibraryOperator);

const graph: OperatorGraph = {
  nodes: [
    {
      id: "orbits",
      operatorKey: ORBITS_OPERATOR_KEY,
      params: {
        timeSeconds: 2.25,
        center: { x: 320, y: 220, z: 0 },
        defaultPrototypeIds: ["dot", "spark"],
        defaultPscale: 1,
        rings: [
          {
            pointCount: 8,
            radiusPx: 80,
            angularVelocityDegPerSecond: 18,
            pscale: 0.7,
            color: { r: 1, g: 0.88, b: 0.64, a: 1 }
          },
          {
            pointCount: 14,
            radiusPx: 156,
            angularVelocityDegPerSecond: -11,
            angleOffsetDeg: 12,
            pscale: 0.95,
            color: { r: 0.78, g: 0.9, b: 1, a: 1 }
          },
          {
            pointCount: 22,
            radiusPx: 248,
            angularVelocityDegPerSecond: 7,
            angleOffsetDeg: -8,
            pscale: 1.2,
            prototypeIds: ["spark", "dot", "dot"],
            color: { r: 1, g: 1, b: 1, a: 0.85 }
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
      fromNodeId: "orbits",
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
const pointField = outputs.get("orbits")?.pointField;
const instanceSet = outputs.get("copy-to-points")?.instanceSet;

if (!pointField || !instanceSet) {
  throw new Error("Orbits demo did not produce the expected outputs.");
}

console.log(JSON.stringify({ pointField, instanceSet }, null, 2));