// Exercises every `EdgeValidationCode` path in
// `@design-foundry/graph-runtime/edge-validation`. This is the parity
// guard for Phase 3 of the unification plan
// (/memories/session/plan.md).

import assert from "node:assert/strict";

import type {
  GraphEdge,
  GraphNode,
  OperatorDefinition,
  OperatorGraph
} from "@design-foundry/core-types";
import { OperatorRegistry } from "@design-foundry/graph-runtime";
import {
  validateGraphEdge,
  wouldEdgeCreateCycle
} from "@design-foundry/graph-runtime/edge-validation";

function noopRun(): Record<string, unknown> {
  return {};
}

// Operators used in the test graph. Two output kinds (`point-field`,
// `vector3`) so we can exercise `kind-mismatch`.
const sourceOp: OperatorDefinition = {
  key: "test.source",
  version: "0.1.0",
  inputs: [],
  outputs: [
    { key: "points", kind: "point-field" },
    { key: "anchor", kind: "vector3" }
  ],
  run: noopRun
};

const sinkOp: OperatorDefinition = {
  key: "test.sink",
  version: "0.1.0",
  inputs: [{ key: "field", kind: "point-field" }],
  outputs: [],
  run: noopRun
};

const passthroughOp: OperatorDefinition = {
  key: "test.passthrough",
  version: "0.1.0",
  inputs: [{ key: "in", kind: "point-field" }],
  outputs: [{ key: "out", kind: "point-field" }],
  run: noopRun
};

const registry = new OperatorRegistry();
registry.register(sourceOp);
registry.register(sinkOp);
registry.register(passthroughOp);

const nodes: GraphNode[] = [
  { id: "src", operatorKey: "test.source", params: {} },
  { id: "pass", operatorKey: "test.passthrough", params: {} },
  { id: "sink", operatorKey: "test.sink", params: {} }
];

const baseEdge: GraphEdge = {
  fromNodeId: "src",
  fromPortKey: "points",
  toNodeId: "sink",
  toPortKey: "field"
};

function graphWith(edges: GraphEdge[]): OperatorGraph {
  return { nodes, edges };
}

// --- happy path ------------------------------------------------------------
{
  const result = validateGraphEdge(graphWith([]), baseEdge, registry);
  assert.equal(result.isValid, true, "base edge should validate");
  assert.equal(result.outputPort?.kind, "point-field");
  assert.equal(result.inputPort?.kind, "point-field");
}

// --- missing nodes ---------------------------------------------------------
{
  const missingSource = validateGraphEdge(
    graphWith([]),
    { ...baseEdge, fromNodeId: "ghost" },
    registry
  );
  assert.equal(missingSource.code, "missing-source-node");

  const missingTarget = validateGraphEdge(
    graphWith([]),
    { ...baseEdge, toNodeId: "ghost" },
    registry
  );
  assert.equal(missingTarget.code, "missing-target-node");
}

// --- same node -------------------------------------------------------------
{
  const sameNode = validateGraphEdge(
    graphWith([]),
    { ...baseEdge, fromNodeId: "sink" },
    registry
  );
  assert.equal(sameNode.code, "same-node");
}

// --- unknown ports ---------------------------------------------------------
{
  const badOutput = validateGraphEdge(
    graphWith([]),
    { ...baseEdge, fromPortKey: "nope" },
    registry
  );
  assert.equal(badOutput.code, "unknown-output-port");

  const badInput = validateGraphEdge(
    graphWith([]),
    { ...baseEdge, toPortKey: "nope" },
    registry
  );
  assert.equal(badInput.code, "unknown-input-port");
}

// --- kind mismatch ---------------------------------------------------------
{
  const mismatch = validateGraphEdge(
    graphWith([]),
    { ...baseEdge, fromPortKey: "anchor" }, // vector3 → point-field
    registry
  );
  assert.equal(mismatch.code, "kind-mismatch");
}

// --- duplicate edge --------------------------------------------------------
{
  const duplicate = validateGraphEdge(graphWith([baseEdge]), baseEdge, registry);
  assert.equal(duplicate.code, "duplicate-edge");
  assert.ok(duplicate.existingEdge, "duplicate should surface existing edge");
}

// --- occupied input (different source, same target port) -------------------
{
  const occupiedEdge: GraphEdge = {
    fromNodeId: "pass",
    fromPortKey: "out",
    toNodeId: "sink",
    toPortKey: "field"
  };
  const occupied = validateGraphEdge(graphWith([baseEdge]), occupiedEdge, registry);
  assert.equal(occupied.code, "occupied-input");

  // With allowReplacingInput, the cycle check runs against edges minus the
  // displaced edge; here that means no cycle and the result is valid.
  const replaced = validateGraphEdge(graphWith([baseEdge]), occupiedEdge, registry, {
    allowReplacingInput: true
  });
  assert.equal(replaced.isValid, true, "replacement should validate");
  assert.ok(replaced.existingEdge, "replacement should surface displaced edge");
}

// --- cycle -----------------------------------------------------------------
{
  // src -> pass exists; adding pass -> src would close a cycle.
  const passToSinkOk: GraphEdge = {
    fromNodeId: "src",
    fromPortKey: "points",
    toNodeId: "pass",
    toPortKey: "in"
  };
  const candidate: GraphEdge = {
    fromNodeId: "pass",
    fromPortKey: "out",
    // The cycle check is independent of port wiring; reuse "field" since
    // sink doesn't matter — we point back at src instead.
    toNodeId: "src",
    toPortKey: "points"
  };
  // src has no input port "points", so we'd hit unknown-input-port first.
  // Verify cycle detection directly via the lower-level helper.
  const wouldCycle = wouldEdgeCreateCycle(
    { nodes, edges: [passToSinkOk] },
    candidate
  );
  assert.equal(wouldCycle, true, "pass -> src after src -> pass must be a cycle");

  // And confirm the validator returns "cycle" when ports do line up: add a
  // synthetic loop operator whose input/output kinds match.
  const loopOp: OperatorDefinition = {
    key: "test.loop",
    version: "0.1.0",
    inputs: [{ key: "in", kind: "point-field" }],
    outputs: [{ key: "out", kind: "point-field" }],
    run: noopRun
  };
  registry.register(loopOp);
  const loopNodes: GraphNode[] = [
    { id: "a", operatorKey: "test.loop", params: {} },
    { id: "b", operatorKey: "test.loop", params: {} }
  ];
  const aToB: GraphEdge = { fromNodeId: "a", fromPortKey: "out", toNodeId: "b", toPortKey: "in" };
  const bToA: GraphEdge = { fromNodeId: "b", fromPortKey: "out", toNodeId: "a", toPortKey: "in" };
  const cycleResult = validateGraphEdge(
    { nodes: loopNodes, edges: [aToB] },
    bToA,
    registry
  );
  assert.equal(cycleResult.code, "cycle");
}

// --- unknown operator ------------------------------------------------------
{
  const orphan: GraphNode[] = [
    { id: "orphan-src", operatorKey: "test.does-not-exist", params: {} },
    ...nodes
  ];
  const orphanEdge: GraphEdge = {
    fromNodeId: "orphan-src",
    fromPortKey: "x",
    toNodeId: "sink",
    toPortKey: "field"
  };
  const orphanResult = validateGraphEdge({ nodes: orphan, edges: [] }, orphanEdge, registry);
  assert.equal(orphanResult.code, "unknown-source-operator");
}

console.log("edge-validation: OK (all 10 codes covered)");
