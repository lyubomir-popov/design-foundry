// Generic operator-graph edge validation. Lifted from the production
// implementation in
// `design-foundry/packages/operator-overlay-layout/src/background-graph.ts`
// (`validateOverlayBackgroundEdge`, `wouldOverlayBackgroundEdgeCreateCycle`)
// and generalized to operate on `OperatorGraph` / `GraphEdge` / operator
// definitions resolved through an `OperatorRegistry`.
//
// Why this lives in graph-runtime:
//   - Same algorithm now used by overlay scenes (background graph) and any
//     future generic operator graph (a4 layout pipelines, diagram layout
//     pipelines once unified).
//   - Lets overlay-layout thin-wrap this for its specific port kinds rather
//     than carrying its own DAG validation.

import type {
  GraphEdge,
  GraphNode,
  OperatorGraph,
  OperatorPort
} from "@design-foundry/core-types";
import type { OperatorRegistry } from "./index.js";

export type EdgeValidationCode =
  | "missing-source-node"
  | "missing-target-node"
  | "same-node"
  | "unknown-source-operator"
  | "unknown-target-operator"
  | "unknown-output-port"
  | "unknown-input-port"
  | "kind-mismatch"
  | "duplicate-edge"
  | "occupied-input"
  | "cycle";

export interface EdgeValidationResult {
  isValid: boolean;
  code?: EdgeValidationCode;
  outputPort?: OperatorPort;
  inputPort?: OperatorPort;
  existingEdge?: GraphEdge | null;
}

export interface ValidateGraphEdgeOptions {
  /**
   * If true, an existing edge into the same input port is treated as
   * replaceable rather than a hard `occupied-input` failure. Cycle check is
   * still run against the edge set with the displaced edge removed.
   */
  allowReplacingInput?: boolean;
}

function edgeKey(edge: GraphEdge): string {
  return `${edge.fromNodeId}:${edge.fromPortKey}:${edge.toNodeId}:${edge.toPortKey}`;
}

export function findIncomingEdge(
  graph: Pick<OperatorGraph, "edges">,
  toNodeId: string,
  toPortKey: string
): GraphEdge | null {
  return (
    graph.edges.find(
      (edge) => edge.toNodeId === toNodeId && edge.toPortKey === toPortKey
    ) ?? null
  );
}

/**
 * True when adding `candidateEdge` to `graph` would create a directed cycle.
 * Uses iterative DFS from `candidateEdge.toNodeId`; if we can reach
 * `candidateEdge.fromNodeId` along existing edges, the new edge would close
 * a cycle.
 */
export function wouldEdgeCreateCycle(
  graph: Pick<OperatorGraph, "nodes" | "edges">,
  candidateEdge: GraphEdge
): boolean {
  const outgoingByNodeId = new Map<string, string[]>();
  for (const node of graph.nodes) {
    outgoingByNodeId.set(node.id, []);
  }
  for (const edge of graph.edges) {
    const list = outgoingByNodeId.get(edge.fromNodeId) ?? [];
    list.push(edge.toNodeId);
    outgoingByNodeId.set(edge.fromNodeId, list);
  }

  const pending: string[] = [candidateEdge.toNodeId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    if (current === candidateEdge.fromNodeId) return true;
    visited.add(current);
    for (const next of outgoingByNodeId.get(current) ?? []) {
      pending.push(next);
    }
  }
  return false;
}

function findPort(
  ports: OperatorPort[] | undefined,
  key: string
): OperatorPort | undefined {
  return ports?.find((port) => port.key === key);
}

/**
 * Validate that `candidateEdge` can be added to `graph`. Resolves operator
 * port definitions through `registry`.
 *
 * Returns a result with `isValid: true` and the resolved input/output ports
 * on success, otherwise `isValid: false` with an `EdgeValidationCode` and
 * (when applicable) the existing displaced edge.
 */
export function validateGraphEdge(
  graph: Pick<OperatorGraph, "nodes" | "edges">,
  candidateEdge: GraphEdge,
  registry: OperatorRegistry,
  options: ValidateGraphEdgeOptions = {}
): EdgeValidationResult {
  const nodesById = new Map<string, GraphNode>(graph.nodes.map((node) => [node.id, node]));
  const sourceNode = nodesById.get(candidateEdge.fromNodeId);
  if (!sourceNode) {
    return { isValid: false, code: "missing-source-node" };
  }
  const targetNode = nodesById.get(candidateEdge.toNodeId);
  if (!targetNode) {
    return { isValid: false, code: "missing-target-node" };
  }
  if (candidateEdge.fromNodeId === candidateEdge.toNodeId) {
    return { isValid: false, code: "same-node" };
  }

  let sourceDef;
  try {
    sourceDef = registry.get(sourceNode.operatorKey);
  } catch {
    return { isValid: false, code: "unknown-source-operator" };
  }
  let targetDef;
  try {
    targetDef = registry.get(targetNode.operatorKey);
  } catch {
    return { isValid: false, code: "unknown-target-operator" };
  }

  const outputPort = findPort(sourceDef.outputs, candidateEdge.fromPortKey);
  if (!outputPort) {
    return { isValid: false, code: "unknown-output-port" };
  }
  const inputPort = findPort(targetDef.inputs, candidateEdge.toPortKey);
  if (!inputPort) {
    return { isValid: false, code: "unknown-input-port" };
  }

  if (outputPort.kind !== inputPort.kind) {
    return { isValid: false, code: "kind-mismatch", outputPort, inputPort };
  }

  const duplicate = graph.edges.find((edge) => edgeKey(edge) === edgeKey(candidateEdge));
  if (duplicate) {
    return {
      isValid: false,
      code: "duplicate-edge",
      outputPort,
      inputPort,
      existingEdge: duplicate
    };
  }

  const existingEdge = findIncomingEdge(
    graph,
    candidateEdge.toNodeId,
    candidateEdge.toPortKey
  );
  if (existingEdge && !options.allowReplacingInput) {
    return {
      isValid: false,
      code: "occupied-input",
      outputPort,
      inputPort,
      existingEdge
    };
  }

  const cycleCheckEdges =
    existingEdge && options.allowReplacingInput
      ? graph.edges.filter((edge) => edge !== existingEdge)
      : graph.edges;

  if (
    wouldEdgeCreateCycle({ nodes: graph.nodes, edges: cycleCheckEdges }, candidateEdge)
  ) {
    return {
      isValid: false,
      code: "cycle",
      outputPort,
      inputPort,
      existingEdge
    };
  }

  return { isValid: true, outputPort, inputPort, existingEdge };
}
