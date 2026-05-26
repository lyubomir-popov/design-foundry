// Override application: replay the override log on top of generator output.
// Modeled on `applyDesignerOverrides` in
// `a4-generator/packages/document-schema/src/index.ts`, generalized to walk
// nested groups.

import type { Document, Node, Override, Page } from "./index.js";
import { isGroupNode } from "./index.js";

export function cloneDocument(document: Document): Document {
  return JSON.parse(JSON.stringify(document)) as Document;
}

function applyOverridesToNode(node: Node, overrides: Override[]): Node {
  let current: Node = { ...node } as Node;
  for (const override of overrides) {
    current = { ...current, [override.property]: override.value } as Node;
  }
  if (isGroupNode(current)) {
    return current;
  }
  return current;
}

function rebuildNodes(nodes: Node[], byNodeId: Map<string, Override[]>): Node[] {
  return nodes.map((node) => {
    const overrides = byNodeId.get(node.id) ?? [];
    const applied = applyOverridesToNode(node, overrides);
    if (isGroupNode(applied)) {
      return {
        ...applied,
        children: rebuildNodes(applied.children, byNodeId)
      };
    }
    return applied;
  });
}

/**
 * Returns a new `Document` with all `overrides` replayed on top of every
 * matching node (including descendants of group nodes). Order within each
 * node's override list is preserved (last write wins per property).
 */
export function applyOverrides(document: Document): Document {
  const next = cloneDocument(document);
  const byNodeId = new Map<string, Override[]>();
  for (const override of next.overrides) {
    const list = byNodeId.get(override.nodeId) ?? [];
    list.push(override);
    byNodeId.set(override.nodeId, list);
  }
  next.pages = next.pages.map((page): Page => ({
    ...page,
    nodes: rebuildNodes(page.nodes, byNodeId)
  }));
  return next;
}
