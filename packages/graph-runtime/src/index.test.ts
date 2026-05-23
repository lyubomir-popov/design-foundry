import { describe, it, expect } from "vitest";
import type { GraphNode, GraphEdge, OperatorDefinition, OperatorGraph } from "@brand-layout-ops/core-types";
import { OperatorRegistry, topologicallySortGraph, evaluateGraph, evaluateGraphSync } from "./index.js";

// --- helpers ---

function makeNode(id: string, operatorKey: string, params: Record<string, unknown> = {}): GraphNode {
  return { id, operatorKey, params };
}

function makeEdge(from: string, fromPort: string, to: string, toPort: string): GraphEdge {
  return { fromNodeId: from, fromPortKey: fromPort, toNodeId: to, toPortKey: toPort };
}

function makeOperator(key: string, run: OperatorDefinition["run"]): OperatorDefinition {
  return { key, version: "1", inputs: [], outputs: [], run };
}

// --- OperatorRegistry ---

describe("OperatorRegistry", () => {
  it("registers and retrieves an operator", () => {
    const registry = new OperatorRegistry();
    const op = makeOperator("add", () => ({ sum: 0 }));
    registry.register(op);
    expect(registry.get("add")).toBe(op);
  });

  it("throws for an unknown operator", () => {
    const registry = new OperatorRegistry();
    expect(() => registry.get("missing")).toThrow("Unknown operator: missing");
  });
});

// --- topologicallySortGraph ---

describe("topologicallySortGraph", () => {
  it("sorts a linear chain A → B → C", () => {
    const graph: OperatorGraph = {
      nodes: [makeNode("c", "op"), makeNode("a", "op"), makeNode("b", "op")],
      edges: [makeEdge("a", "out", "b", "in"), makeEdge("b", "out", "c", "in")]
    };
    const sorted = topologicallySortGraph(graph);
    const ids = sorted.map((n) => n.id);
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("b"));
    expect(ids.indexOf("b")).toBeLessThan(ids.indexOf("c"));
  });

  it("handles a single node with no edges", () => {
    const graph: OperatorGraph = { nodes: [makeNode("solo", "op")], edges: [] };
    const sorted = topologicallySortGraph(graph);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe("solo");
  });

  it("handles independent nodes with no edges", () => {
    const graph: OperatorGraph = {
      nodes: [makeNode("a", "op"), makeNode("b", "op"), makeNode("c", "op")],
      edges: []
    };
    const sorted = topologicallySortGraph(graph);
    expect(sorted).toHaveLength(3);
  });

  it("handles a diamond: A → B, A → C, B → D, C → D", () => {
    const graph: OperatorGraph = {
      nodes: [makeNode("d", "op"), makeNode("b", "op"), makeNode("c", "op"), makeNode("a", "op")],
      edges: [
        makeEdge("a", "out", "b", "in"),
        makeEdge("a", "out", "c", "in"),
        makeEdge("b", "out", "d", "in1"),
        makeEdge("c", "out", "d", "in2")
      ]
    };
    const sorted = topologicallySortGraph(graph);
    const ids = sorted.map((n) => n.id);
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("b"));
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("c"));
    expect(ids.indexOf("b")).toBeLessThan(ids.indexOf("d"));
    expect(ids.indexOf("c")).toBeLessThan(ids.indexOf("d"));
  });

  it("throws on a cycle", () => {
    const graph: OperatorGraph = {
      nodes: [makeNode("a", "op"), makeNode("b", "op")],
      edges: [makeEdge("a", "out", "b", "in"), makeEdge("b", "out", "a", "in")]
    };
    expect(() => topologicallySortGraph(graph)).toThrow(/cycle/i);
  });
});

// --- evaluateGraph / evaluateGraphSync ---

describe("evaluateGraph", () => {
  it("passes inputs from upstream to downstream", async () => {
    const registry = new OperatorRegistry();
    registry.register(makeOperator("source", ({ params }) => ({ value: (params as { v: number }).v })));
    registry.register(makeOperator("double", ({ inputs }) => ({ value: (inputs.value as number) * 2 })));

    const graph: OperatorGraph = {
      nodes: [makeNode("src", "source", { v: 5 }), makeNode("dbl", "double")],
      edges: [makeEdge("src", "value", "dbl", "value")]
    };

    const outputs = await evaluateGraph(graph, registry);
    expect(outputs.get("src")).toEqual({ value: 5 });
    expect(outputs.get("dbl")).toEqual({ value: 10 });
  });

  it("works with async operators", async () => {
    const registry = new OperatorRegistry();
    registry.register(makeOperator("async-op", async () => ({ result: 42 })));

    const graph: OperatorGraph = { nodes: [makeNode("a", "async-op")], edges: [] };
    const outputs = await evaluateGraph(graph, registry);
    expect(outputs.get("a")).toEqual({ result: 42 });
  });
});

describe("evaluateGraphSync", () => {
  it("evaluates a sync graph", () => {
    const registry = new OperatorRegistry();
    registry.register(makeOperator("const", ({ params }) => ({ out: (params as { n: number }).n })));
    registry.register(makeOperator("sum", ({ inputs }) => ({
      out: (inputs.a as number) + (inputs.b as number)
    })));

    const graph: OperatorGraph = {
      nodes: [makeNode("x", "const", { n: 3 }), makeNode("y", "const", { n: 7 }), makeNode("z", "sum")],
      edges: [makeEdge("x", "out", "z", "a"), makeEdge("y", "out", "z", "b")]
    };

    const outputs = evaluateGraphSync(graph, registry);
    expect(outputs.get("z")).toEqual({ out: 10 });
  });

  it("throws when an operator returns a Promise", () => {
    const registry = new OperatorRegistry();
    registry.register(makeOperator("bad", async () => ({ out: 1 })));

    const graph: OperatorGraph = { nodes: [makeNode("a", "bad")], edges: [] };
    expect(() => evaluateGraphSync(graph, registry)).toThrow(/Promise/);
  });
});
