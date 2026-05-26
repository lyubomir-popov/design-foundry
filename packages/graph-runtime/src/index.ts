import type { GraphEdge, GraphNode, OperatorDefinition, OperatorGraph } from "@design-foundry/core-types";

export class OperatorRegistry {
  private readonly definitions = new Map<string, OperatorDefinition>();

  register(definition: OperatorDefinition): void {
    this.definitions.set(definition.key, definition);
  }

  get(operatorKey: string): OperatorDefinition {
    const definition = this.definitions.get(operatorKey);
    if (!definition) {
      throw new Error(`Unknown operator: ${operatorKey}`);
    }
    return definition;
  }
}

function buildIncomingEdgeMap(nodes: GraphNode[], edges: GraphEdge[]): Map<string, GraphEdge[]> {
  const incoming = new Map<string, GraphEdge[]>();
  for (const node of nodes) {
    incoming.set(node.id, []);
  }
  for (const edge of edges) {
    incoming.get(edge.toNodeId)?.push(edge);
  }
  return incoming;
}

  function collectNodeInputs(
    edges: GraphEdge[],
    outputs: Map<string, Record<string, unknown>>,
    nodeId: string
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    for (const edge of edges.filter((candidate) => candidate.toNodeId === nodeId)) {
      const sourceOutputs = outputs.get(edge.fromNodeId);
      inputs[edge.toPortKey] = sourceOutputs?.[edge.fromPortKey];
    }
    return inputs;
  }

  function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
    return typeof (value as PromiseLike<T> | null | undefined)?.then === "function";
  }

export function topologicallySortGraph(graph: OperatorGraph): GraphNode[] {
  const remaining = new Map(graph.nodes.map((node) => [node.id, node]));
  const incoming = buildIncomingEdgeMap(graph.nodes, graph.edges);
  const sorted: GraphNode[] = [];

  while (remaining.size > 0) {
    const ready = Array.from(remaining.values()).find((node) => (incoming.get(node.id)?.length || 0) === 0);
    if (!ready) {
      throw new Error("Graph contains a cycle or unresolved dependency.");
    }

    sorted.push(ready);
    remaining.delete(ready.id);

    for (const edge of graph.edges.filter((candidate) => candidate.fromNodeId === ready.id)) {
      const nextIncoming = incoming.get(edge.toNodeId) || [];
      incoming.set(
        edge.toNodeId,
        nextIncoming.filter((candidate) => candidate !== edge)
      );
    }
  }

  return sorted;
}

export async function evaluateGraph(graph: OperatorGraph, registry: OperatorRegistry): Promise<Map<string, Record<string, unknown>>> {
  const sorted = topologicallySortGraph(graph);
  const outputs = new Map<string, Record<string, unknown>>();

  for (const node of sorted) {
    const definition = registry.get(node.operatorKey);
    const inputs = collectNodeInputs(graph.edges, outputs, node.id);
    const result = await definition.run({ nodeId: node.id, params: node.params, inputs });
    outputs.set(node.id, result);
  }

  return outputs;
}

export function evaluateGraphSync(graph: OperatorGraph, registry: OperatorRegistry): Map<string, Record<string, unknown>> {
  const sorted = topologicallySortGraph(graph);
  const outputs = new Map<string, Record<string, unknown>>();

  for (const node of sorted) {
    const definition = registry.get(node.operatorKey);
    const inputs = collectNodeInputs(graph.edges, outputs, node.id);
    const result = definition.run({ nodeId: node.id, params: node.params, inputs });
    if (isPromiseLike(result)) {
      throw new Error(`Operator ${node.operatorKey} returned a Promise during synchronous graph evaluation.`);
    }
    outputs.set(node.id, result);
  }

  return outputs;
}