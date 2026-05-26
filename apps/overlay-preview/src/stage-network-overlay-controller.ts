import { topologicallySortGraph } from "@design-foundry/graph-runtime";
import {
  findOverlayBackgroundInputPort,
  findOverlayBackgroundOutputPort,
  getOverlaySceneFamilyKeyForBackgroundOperator,
  OVERLAY_BACKGROUND_FUZZY_SEED_NODE_ID,
  OVERLAY_BACKGROUND_HALO_OPERATOR_KEY,
  OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY,
  type OverlayBackgroundEdge,
  type OverlayBackgroundNode,
  type OverlaySceneFamilyKey
} from "@design-foundry/operator-overlay-layout";

import {
  OVERLAY_LAYOUT_OPERATOR_SELECTION_ID,
  type SceneFamilyPreviewSnapshot,
  type PreviewState
} from "./preview-app-context.js";
import {
  getActivePreviewCompositionLayers,
  getActivePreviewOutputSink,
  getPreviewOutputSinks
} from "./preview-composition.js";

const OVERLAY_LAYOUT_NODE_ID = "__overlay_layout__";
const PREVIEW_COMPOSITE_NODE_ID = "__preview_composite__";
const PREVIEW_OUTPUT_NODE_ID = "__preview_output__";

type NetworkOverlayNodeKind = "background" | "overlay" | "composite" | "output";

interface NetworkOverlayNode {
  id: string;
  label: string;
  meta: string[];
  depth: number;
  sortOrder: number;
  kind: NetworkOverlayNodeKind;
  selectable: boolean;
  selected: boolean;
  operatorId?: string;
}

interface NetworkOverlayEdge {
  fromId: string;
  toId: string;
  label: string;
}

interface NodeRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

export interface StageNetworkOverlayControllerDeps {
  readonly state: PreviewState;
  getStageEl(): HTMLElement | null;
  getOverlayEl(): HTMLElement | null;
  getSelectedOperatorId(): string;
  getSceneFamilyLabel(key: OverlaySceneFamilyKey): string;
  getSceneFamilyPreviewState(): SceneFamilyPreviewSnapshot | null;
  selectBackgroundNode(nodeId: string): void;
  selectOverlayLayout(): void;
}

export interface StageNetworkOverlayController {
  render(): void;
}

function getBackgroundNodeLabel(
  node: OverlayBackgroundNode,
  getSceneFamilyLabel: StageNetworkOverlayControllerDeps["getSceneFamilyLabel"]
): string {
  if (node.operatorKey === OVERLAY_BACKGROUND_HALO_OPERATOR_KEY) {
    return "Halo Field";
  }

  if (node.operatorKey === OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY && node.id === OVERLAY_BACKGROUND_FUZZY_SEED_NODE_ID) {
    return "Phyllotaxis Seed";
  }

  return getSceneFamilyLabel(getOverlaySceneFamilyKeyForBackgroundOperator(node.operatorKey));
}

function getDepthByNodeId(nodes: OverlayBackgroundNode[], edges: OverlayBackgroundEdge[]): Map<string, number> {
  const graph = { nodes, edges };
  const sortedNodes = (() => {
    try {
      return topologicallySortGraph(graph);
    } catch {
      return nodes;
    }
  })();
  const depthByNodeId = new Map(sortedNodes.map((node) => [node.id, 0]));

  for (const node of sortedNodes) {
    const nodeDepth = depthByNodeId.get(node.id) ?? 0;
    for (const edge of edges) {
      if (edge.fromNodeId !== node.id) {
        continue;
      }

      depthByNodeId.set(edge.toNodeId, Math.max(depthByNodeId.get(edge.toNodeId) ?? 0, nodeDepth + 1));
    }
  }

  return depthByNodeId;
}

function createSvgEl<K extends keyof SVGElementTagNameMap>(
  tagName: K
): SVGElementTagNameMap[K] {
  return document.createElementNS("http://www.w3.org/2000/svg", tagName);
}

export function createStageNetworkOverlayController(
  deps: StageNetworkOverlayControllerDeps
): StageNetworkOverlayController {
  function buildOverlayNodesAndEdges(): { nodes: NetworkOverlayNode[]; edges: NetworkOverlayEdge[] } {
    const backgroundGraph = deps.state.documentProject.backgroundGraph;
    const selectedOperatorId = deps.getSelectedOperatorId();
    const previewState = deps.getSceneFamilyPreviewState();
    const compositionLayers = getActivePreviewCompositionLayers({
      state: deps.state,
      simulationBackend: previewState?.simulationBackend ?? null
    });
    const outputSinks = getPreviewOutputSinks();
    const activeOutputSink = getActivePreviewOutputSink();
    const implementedExportSinks = outputSinks.filter(
      (sink) => sink.implemented && !sink.active && sink.id !== "automation-frame"
    );
    const plannedSinks = outputSinks.filter((sink) => !sink.implemented);
    const depthByNodeId = getDepthByNodeId(backgroundGraph.nodes, backgroundGraph.edges);
    const maxBackgroundDepth = Math.max(...depthByNodeId.values(), 0);

    const nodesById = new Map(backgroundGraph.nodes.map((node) => [node.id, node]));

    const backgroundNodes = backgroundGraph.nodes.map((node, index) => {
      const incomingCount = backgroundGraph.edges.filter((edge) => edge.toNodeId === node.id).length;
      const outgoingCount = backgroundGraph.edges.filter((edge) => edge.fromNodeId === node.id).length;

      return {
        id: node.id,
        label: getBackgroundNodeLabel(node, deps.getSceneFamilyLabel),
        meta: [
          node.id === backgroundGraph.activeNodeId ? "Background output" : "Upstream operator",
          `${incomingCount} in / ${outgoingCount} out`,
          node.operatorKey
        ],
        depth: depthByNodeId.get(node.id) ?? 0,
        sortOrder: index,
        kind: "background" as const,
        selectable: true,
        selected: selectedOperatorId === node.id,
        operatorId: node.id
      };
    });

    const overlayNode: NetworkOverlayNode = {
      id: OVERLAY_LAYOUT_NODE_ID,
      label: "Overlay Layout",
      meta: [
        deps.state.overlayVisible ? "Visible in preview" : "Hidden in preview",
        "2D text, logo, guides"
      ],
      depth: maxBackgroundDepth,
      sortOrder: backgroundNodes.length + 1,
      kind: "overlay",
      selectable: true,
      selected: selectedOperatorId === OVERLAY_LAYOUT_OPERATOR_SELECTION_ID,
      operatorId: OVERLAY_LAYOUT_OPERATOR_SELECTION_ID
    };

    const compositeNode: NetworkOverlayNode = {
      id: PREVIEW_COMPOSITE_NODE_ID,
      label: "Preview Composite",
      meta: compositionLayers.map((layer) => `Order ${layer.order}: ${layer.label}`),
      depth: maxBackgroundDepth + 1,
      sortOrder: 0,
      kind: "composite",
      selectable: false,
      selected: false
    };

    const outputNode: NetworkOverlayNode = {
      id: PREVIEW_OUTPUT_NODE_ID,
      label: "Output Sinks",
      meta: [
        `${deps.state.params.frame.widthPx}×${deps.state.params.frame.heightPx}`,
        `${activeOutputSink.label} (active)`,
        implementedExportSinks.map((sink) => sink.label).join(" / "),
        plannedSinks.length > 0 ? `${plannedSinks.map((sink) => sink.label).join(" / ")} planned` : ""
      ].filter((line) => line.length > 0),
      depth: maxBackgroundDepth + 2,
      sortOrder: 0,
      kind: "output",
      selectable: false,
      selected: false
    };

    const nodes = [...backgroundNodes, overlayNode, compositeNode, outputNode];

    const edges: NetworkOverlayEdge[] = backgroundGraph.edges.map((edge) => {
      const fromNode = nodesById.get(edge.fromNodeId);
      const toNode = nodesById.get(edge.toNodeId);
      const fromPort = fromNode ? findOverlayBackgroundOutputPort(fromNode.operatorKey, edge.fromPortKey) : null;
      const toPort = toNode ? findOverlayBackgroundInputPort(toNode.operatorKey, edge.toPortKey) : null;
      const label = fromPort && toPort
        ? `${fromPort.label} → ${toPort.label}`
        : (toPort?.label ?? edge.toPortKey);

      return {
        fromId: edge.fromNodeId,
        toId: edge.toNodeId,
        label
      };
    });

    edges.push(
      {
        fromId: backgroundGraph.activeNodeId,
        toId: PREVIEW_COMPOSITE_NODE_ID,
        label: "scene"
      },
      {
        fromId: OVERLAY_LAYOUT_NODE_ID,
        toId: PREVIEW_COMPOSITE_NODE_ID,
        label: "overlay"
      },
      {
        fromId: PREVIEW_COMPOSITE_NODE_ID,
        toId: PREVIEW_OUTPUT_NODE_ID,
        label: "composed frame"
      }
    );

    return { nodes, edges };
  }

  function handleNodeSelection(operatorId: string | undefined): void {
    if (operatorId === OVERLAY_LAYOUT_OPERATOR_SELECTION_ID) {
      deps.selectOverlayLayout();
      return;
    }

    if (operatorId) {
      deps.selectBackgroundNode(operatorId);
    }
  }

  function render(): void {
    const overlayEl = deps.getOverlayEl();
    const stageEl = deps.getStageEl();
    if (!overlayEl || !stageEl) {
      return;
    }

    if (!deps.state.networkOverlayVisible) {
      overlayEl.replaceChildren();
      overlayEl.setAttribute("aria-hidden", "true");
      return;
    }

    const stageRect = stageEl.getBoundingClientRect();
    if (stageRect.width <= 0 || stageRect.height <= 0) {
      overlayEl.replaceChildren();
      overlayEl.setAttribute("aria-hidden", "true");
      return;
    }

    overlayEl.setAttribute("aria-hidden", "false");

    const { nodes, edges } = buildOverlayNodesAndEdges();
    const depthCount = Math.max(...nodes.map((node) => node.depth), 0) + 1;
    const buckets = new Map<number, NetworkOverlayNode[]>();
    for (const node of nodes) {
      const bucket = buckets.get(node.depth) ?? [];
      bucket.push(node);
      buckets.set(node.depth, bucket);
    }

    for (const bucket of buckets.values()) {
      bucket.sort((left, right) => left.sortOrder - right.sortOrder);
    }

    const edgeLayer = createSvgEl("svg");
    edgeLayer.classList.add("is-network-overlay-edges");
    edgeLayer.setAttribute("viewBox", `0 0 ${stageRect.width} ${stageRect.height}`);
    edgeLayer.setAttribute("preserveAspectRatio", "none");

    const nodeLayer = document.createElement("div");
    nodeLayer.className = "is-network-overlay-nodes";

    const paddingXPx = 72;
    const paddingYPx = 56;
    const availableWidthPx = Math.max(1, stageRect.width - (paddingXPx * 2));
    const availableHeightPx = Math.max(1, stageRect.height - (paddingYPx * 2));

    for (const node of nodes) {
      const columnXPx = depthCount === 1
        ? stageRect.width * 0.5
        : paddingXPx + ((node.depth / Math.max(1, depthCount - 1)) * availableWidthPx);
      const bucket = buckets.get(node.depth) ?? [node];
      const rowIndex = bucket.findIndex((entry) => entry.id === node.id);
      const rowYPx = paddingYPx + (((rowIndex + 1) / (bucket.length + 1)) * availableHeightPx);

      const card = node.selectable ? document.createElement("button") : document.createElement("div");
      card.className = `bf-option-card is-network-overlay-node is-${node.kind}`;
      if (node.selected) {
        card.classList.add("is-selected");
      }

      card.style.left = `${columnXPx}px`;
      card.style.top = `${rowYPx}px`;
      card.setAttribute("data-network-node-id", node.id);

      if (card instanceof HTMLButtonElement) {
        card.type = "button";
        card.addEventListener("click", () => {
          handleNodeSelection(node.operatorId);
        });
      }

      const title = document.createElement("span");
      title.className = "bf-option-card-label";
      title.textContent = node.label;
      card.append(title);

      for (const metaLine of node.meta) {
        const meta = document.createElement("span");
        meta.className = "bf-option-card-meta is-network-overlay-meta";
        meta.textContent = metaLine;
        card.append(meta);
      }

      nodeLayer.append(card);
    }

    overlayEl.replaceChildren(edgeLayer, nodeLayer);

    const overlayRect = overlayEl.getBoundingClientRect();
    const nodeRects = new Map<string, NodeRect>();
    for (const element of nodeLayer.querySelectorAll<HTMLElement>("[data-network-node-id]")) {
      const rect = element.getBoundingClientRect();
      const left = rect.left - overlayRect.left;
      const top = rect.top - overlayRect.top;
      const width = rect.width;
      const height = rect.height;
      const nodeId = element.getAttribute("data-network-node-id");
      if (!nodeId) {
        continue;
      }

      nodeRects.set(nodeId, {
        left,
        top,
        right: left + width,
        bottom: top + height,
        centerX: left + (width * 0.5),
        centerY: top + (height * 0.5)
      });
    }

    for (const edge of edges) {
      const fromRect = nodeRects.get(edge.fromId);
      const toRect = nodeRects.get(edge.toId);
      if (!fromRect || !toRect) {
        continue;
      }

      const startX = fromRect.right;
      const startY = fromRect.centerY;
      const endX = toRect.left;
      const endY = toRect.centerY;
      const controlOffsetPx = Math.max(24, Math.min(88, Math.abs(endX - startX) * 0.5));

      const path = createSvgEl("path");
      path.classList.add("is-network-overlay-edge");
      path.setAttribute(
        "d",
        `M ${startX} ${startY} C ${startX + controlOffsetPx} ${startY}, ${endX - controlOffsetPx} ${endY}, ${endX} ${endY}`
      );
      edgeLayer.append(path);

      const label = createSvgEl("text");
      label.classList.add("is-network-overlay-edge-label");
      label.setAttribute("x", String((startX + endX) * 0.5));
      label.setAttribute("y", String(((startY + endY) * 0.5) - 6));
      label.textContent = edge.label;
      edgeLayer.append(label);
    }
  }

  return {
    render
  };
}