import {
  cloneOverlayBackgroundGraph,
  createDefaultOverlayBackgroundGraph,
  createDefaultOverlayFuzzyBoidsConfig,
  createDefaultOverlayPhyllotaxisConfig,
  createDefaultOverlaySceneFamilyConfigs,
  createDefaultOverlayScatterConfig,
  findOverlayBackgroundIncomingEdge,
  getOverlaySceneFamilyKeyForBackgroundOperator,
  getOverlaySceneFamilyKeyForBackgroundGraph,
  OVERLAY_BACKGROUND_FUZZY_BOIDS_NODE_ID,
  OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY,
  OVERLAY_BACKGROUND_HALO_NODE_ID,
  OVERLAY_BACKGROUND_HALO_OPERATOR_KEY,
  OVERLAY_BACKGROUND_PHYLLOTAXIS_NODE_ID,
  OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY,
  OVERLAY_BACKGROUND_SCATTER_NODE_ID,
  OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY,
  type OverlayBackgroundEdge,
  type OverlayBackgroundNode,
  type OverlayBackgroundOperatorKey,
  type OverlaySceneFamilyKey,
  validateOverlayBackgroundEdge
} from "@design-foundry/operator-overlay-layout";

import {
  OVERLAY_LAYOUT_OPERATOR_SELECTION_ID,
  type PreviewState,
  type SelectedOperatorId
} from "./preview-app-context.js";

export interface BackgroundGraphControllerOptions {
  readonly state: PreviewState;
}

export interface BackgroundGraphController {
  normalizeSelectedBackgroundNodeId(preferredNodeId?: string | null): string | null;
  normalizeSelectedOperatorId(preferredOperatorId?: string | null): SelectedOperatorId;
  getAvailableBackgroundOperatorKeys(): OverlayBackgroundOperatorKey[];
  addBackgroundNode(operatorKey: OverlayBackgroundOperatorKey): string | null;
  setSelectedOperator(operatorId: string | null): boolean;
  getSelectedOperatorId(): SelectedOperatorId;
  setSelectedBackgroundNode(nodeId: string | null): boolean;
  getSelectedBackgroundNode(): OverlayBackgroundNode | null;
  getSelectedOperatorGroup(): string;
  updateSelectedBackgroundNode(updater: (node: OverlayBackgroundNode) => OverlayBackgroundNode): boolean;
  connectBackgroundEdge(edge: OverlayBackgroundEdge): boolean;
  disconnectBackgroundInput(nodeId: string, portKey: string): boolean;
  removeBackgroundNode(nodeId: string): boolean;
  syncDocumentBackgroundGraph(): void;
  getSceneFamilyLabel(sceneFamilyKey: OverlaySceneFamilyKey): string;
}

export function createBackgroundGraphController(
  options: BackgroundGraphControllerOptions
): BackgroundGraphController {
  const { state } = options;
  const AVAILABLE_BACKGROUND_OPERATOR_KEYS: OverlayBackgroundOperatorKey[] = [
    OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY,
    OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY,
    OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY,
    OVERLAY_BACKGROUND_HALO_OPERATOR_KEY
  ];

  function getFallbackSceneFamilyGraph(sceneFamilyKey: OverlaySceneFamilyKey) {
    return createDefaultOverlayBackgroundGraph(
      sceneFamilyKey,
      createDefaultOverlaySceneFamilyConfigs(state.outputProfileKey),
      state.outputProfileKey
    );
  }

  function setCurrentSceneFamilyGraph(nextBackgroundGraph: ReturnType<typeof cloneOverlayBackgroundGraph>): void {
    const clonedGraph = cloneOverlayBackgroundGraph(nextBackgroundGraph);
    state.documentProject = {
      ...state.documentProject,
      backgroundGraph: clonedGraph,
      sceneFamilyGraphs: {
        ...state.documentProject.sceneFamilyGraphs,
        [state.documentProject.sceneFamilyKey]: cloneOverlayBackgroundGraph(clonedGraph)
      }
    };
  }

  function getAvailableBackgroundOperatorKeys(): OverlayBackgroundOperatorKey[] {
    return [...AVAILABLE_BACKGROUND_OPERATOR_KEYS];
  }

  function getBackgroundNodeBaseId(operatorKey: OverlayBackgroundOperatorKey): string {
    switch (operatorKey) {
      case OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY:
        return OVERLAY_BACKGROUND_PHYLLOTAXIS_NODE_ID;
      case OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY:
        return OVERLAY_BACKGROUND_FUZZY_BOIDS_NODE_ID;
      case OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY:
        return OVERLAY_BACKGROUND_SCATTER_NODE_ID;
      default:
        return OVERLAY_BACKGROUND_HALO_NODE_ID;
    }
  }

  function createUniqueBackgroundNodeId(operatorKey: OverlayBackgroundOperatorKey): string {
    const baseId = getBackgroundNodeBaseId(operatorKey);
    const existingIds = new Set(state.documentProject.backgroundGraph.nodes.map((node) => node.id));
    if (!existingIds.has(baseId)) {
      return baseId;
    }

    let suffix = 2;
    while (existingIds.has(`${baseId}-${suffix}`)) {
      suffix += 1;
    }

    return `${baseId}-${suffix}`;
  }

  function createDefaultBackgroundNode(operatorKey: OverlayBackgroundOperatorKey, nodeId: string): OverlayBackgroundNode {
    switch (operatorKey) {
      case OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY:
        return {
          id: nodeId,
          operatorKey,
          params: createDefaultOverlayPhyllotaxisConfig(state.outputProfileKey)
        };
      case OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY:
        return {
          id: nodeId,
          operatorKey,
          params: createDefaultOverlayFuzzyBoidsConfig(state.outputProfileKey)
        };
      case OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY:
        return {
          id: nodeId,
          operatorKey,
          params: createDefaultOverlayScatterConfig(state.outputProfileKey)
        };
      default:
        return {
          id: nodeId,
          operatorKey: OVERLAY_BACKGROUND_HALO_OPERATOR_KEY,
          params: {}
        };
    }
  }

  function addBackgroundNode(operatorKey: OverlayBackgroundOperatorKey): string | null {
    const nextNodeId = createUniqueBackgroundNodeId(operatorKey);
    const nextNode = createDefaultBackgroundNode(operatorKey, nextNodeId);

    setCurrentSceneFamilyGraph({
      ...state.documentProject.backgroundGraph,
      nodes: [...state.documentProject.backgroundGraph.nodes, nextNode]
    });
    normalizeSelectedBackgroundNodeId(nextNodeId);
    return nextNodeId;
  }

  function normalizeSelectedBackgroundNodeId(
    preferredNodeId: string | null = state.selectedBackgroundNodeId
  ): string | null {
    const activeNode = state.documentProject.backgroundGraph.nodes.find(
      (node) => node.id === state.documentProject.backgroundGraph.activeNodeId
    );
    const preferredNode = preferredNodeId
      ? state.documentProject.backgroundGraph.nodes.find((node) => node.id === preferredNodeId)
      : null;
    const nextSelectedNodeId = preferredNode?.id ?? activeNode?.id ?? state.documentProject.backgroundGraph.nodes[0]?.id ?? null;
    state.selectedBackgroundNodeId = nextSelectedNodeId;
    return nextSelectedNodeId;
  }

  function normalizeSelectedOperatorId(
    preferredOperatorId: string | null = state.selectedOperatorId
  ): SelectedOperatorId {
    if (preferredOperatorId === OVERLAY_LAYOUT_OPERATOR_SELECTION_ID) {
      normalizeSelectedBackgroundNodeId();
      state.selectedOperatorId = OVERLAY_LAYOUT_OPERATOR_SELECTION_ID;
      return state.selectedOperatorId;
    }

    const nextSelectedNodeId = normalizeSelectedBackgroundNodeId(preferredOperatorId);
    state.selectedOperatorId = nextSelectedNodeId ?? OVERLAY_LAYOUT_OPERATOR_SELECTION_ID;
    return state.selectedOperatorId;
  }

  function setSelectedOperator(operatorId: string | null): boolean {
    const previousOperatorId = normalizeSelectedOperatorId();
    normalizeSelectedOperatorId(operatorId);
    return state.selectedOperatorId !== previousOperatorId;
  }

  function getSelectedOperatorId(): SelectedOperatorId {
    return normalizeSelectedOperatorId();
  }

  function setSelectedBackgroundNode(nodeId: string | null): boolean {
    const previousOperatorId = normalizeSelectedOperatorId();
    const nextSelectedNodeId = normalizeSelectedBackgroundNodeId(nodeId);
    state.selectedOperatorId = nextSelectedNodeId ?? OVERLAY_LAYOUT_OPERATOR_SELECTION_ID;
    return state.selectedOperatorId !== previousOperatorId;
  }

  function getSelectedBackgroundNode(): OverlayBackgroundNode | null {
    const selectedNodeId = normalizeSelectedBackgroundNodeId();
    if (!selectedNodeId) {
      return null;
    }

    return state.documentProject.backgroundGraph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  }

  function getSelectedOperatorGroup(): string {
    const selectedOperatorId = normalizeSelectedOperatorId();
    if (selectedOperatorId === OVERLAY_LAYOUT_OPERATOR_SELECTION_ID) {
      return OVERLAY_LAYOUT_OPERATOR_SELECTION_ID;
    }

    const selectedNode = getSelectedBackgroundNode();
    return selectedNode
      ? getOverlaySceneFamilyKeyForBackgroundOperator(selectedNode.operatorKey)
      : OVERLAY_LAYOUT_OPERATOR_SELECTION_ID;
  }

  function updateSelectedBackgroundNode(
    updater: (node: OverlayBackgroundNode) => OverlayBackgroundNode
  ): boolean {
    const selectedNodeId = normalizeSelectedBackgroundNodeId();
    if (!selectedNodeId) {
      return false;
    }

    let didUpdate = false;
    const nextNodes = state.documentProject.backgroundGraph.nodes.map((node) => {
      if (node.id !== selectedNodeId) {
        return node;
      }

      const nextNode = updater(node);
      didUpdate = nextNode !== node;
      return nextNode;
    });

    if (!didUpdate) {
      return false;
    }

    setCurrentSceneFamilyGraph({
      ...state.documentProject.backgroundGraph,
      nodes: nextNodes
    });
    normalizeSelectedBackgroundNodeId(selectedNodeId);
    return true;
  }

  function connectBackgroundEdge(edge: OverlayBackgroundEdge): boolean {
    const graph = state.documentProject.backgroundGraph;
    const validation = validateOverlayBackgroundEdge(graph, edge, { allowReplacingInput: true });
    if (!validation.isValid) {
      return false;
    }

    const nextEdges = graph.edges.filter((existingEdge) => existingEdge !== validation.existingEdge);
    nextEdges.push({ ...edge });

    setCurrentSceneFamilyGraph({
      ...graph,
      edges: nextEdges
    });
    normalizeSelectedBackgroundNodeId(state.selectedBackgroundNodeId);
    return true;
  }

  function disconnectBackgroundInput(nodeId: string, portKey: string): boolean {
    const graph = state.documentProject.backgroundGraph;
    const existingEdge = findOverlayBackgroundIncomingEdge(graph, nodeId, portKey);
    if (!existingEdge) {
      return false;
    }

    setCurrentSceneFamilyGraph({
      ...graph,
      edges: graph.edges.filter((edge) => edge !== existingEdge)
    });
    normalizeSelectedBackgroundNodeId(state.selectedBackgroundNodeId);
    return true;
  }

  function removeBackgroundNode(nodeId: string): boolean {
    const graph = state.documentProject.backgroundGraph;
    const nodeIndex = graph.nodes.findIndex((node) => node.id === nodeId);
    if (nodeIndex === -1 || graph.nodes.length <= 1) {
      return false;
    }

    const nextNodes = graph.nodes.filter((node) => node.id !== nodeId);
    const nextEdges = graph.edges.filter(
      (edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId
    );
    const nextActiveNodeId = graph.activeNodeId === nodeId
      ? nextNodes[nextNodes.length - 1].id
      : graph.activeNodeId;

    setCurrentSceneFamilyGraph({
      activeNodeId: nextActiveNodeId,
      nodes: nextNodes,
      edges: nextEdges
    });
    normalizeSelectedBackgroundNodeId();
    return true;
  }

  function syncDocumentBackgroundGraph(): void {
    const currentGraphSceneFamilyKey = getOverlaySceneFamilyKeyForBackgroundGraph(
      state.documentProject.backgroundGraph,
      state.documentProject.sceneFamilyKey
    );
    const nextSceneFamilyGraphs = {
      ...state.documentProject.sceneFamilyGraphs,
      [currentGraphSceneFamilyKey]: cloneOverlayBackgroundGraph(state.documentProject.backgroundGraph)
    };
    const nextBackgroundGraph = cloneOverlayBackgroundGraph(
      nextSceneFamilyGraphs[state.documentProject.sceneFamilyKey]
      ?? getFallbackSceneFamilyGraph(state.documentProject.sceneFamilyKey)
    );
    // Ensure the active family is always present in the sparse map
    nextSceneFamilyGraphs[state.documentProject.sceneFamilyKey] = cloneOverlayBackgroundGraph(nextBackgroundGraph);

    state.documentProject = {
      ...state.documentProject,
      sceneFamilyGraphs: nextSceneFamilyGraphs,
      backgroundGraph: nextBackgroundGraph
    };
    normalizeSelectedBackgroundNodeId(state.selectedBackgroundNodeId);
    normalizeSelectedOperatorId(state.selectedOperatorId);
  }

  function getSceneFamilyLabel(sceneFamilyKey: OverlaySceneFamilyKey): string {
    return sceneFamilyKey
      .split("-")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  }

  return {
    normalizeSelectedBackgroundNodeId,
    normalizeSelectedOperatorId,
    getAvailableBackgroundOperatorKeys,
    addBackgroundNode,
    setSelectedOperator,
    getSelectedOperatorId,
    setSelectedBackgroundNode,
    getSelectedBackgroundNode,
    getSelectedOperatorGroup,
    updateSelectedBackgroundNode,
    connectBackgroundEdge,
    disconnectBackgroundInput,
    removeBackgroundNode,
    syncDocumentBackgroundGraph,
    getSceneFamilyLabel
  };
}