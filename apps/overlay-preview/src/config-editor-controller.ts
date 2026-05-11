/**
 * config-editor-controller.ts — Inspector pane registration and rebuild.
 *
 * Owns the accordion section registry, the operator selector UI, and the
 * policy for rebuilding the split layers/parameter rails.
 */

import { initRangeControls } from "./vendor/baseline-foundry/index.js";

import {
  findOverlayBackgroundIncomingEdge,
  findOverlayBackgroundOutputPort,
  getOverlayFieldDisplayLabel,
  getOverlayBackgroundCompatibleOutputPorts,
  getOverlayBackgroundInputPorts,
  getOverlaySceneFamilyKeyForBackgroundOperator,
  OVERLAY_BACKGROUND_FUZZY_SEED_NODE_ID,
  OVERLAY_BACKGROUND_HALO_OPERATOR_KEY,
  OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY,
  OVERLAY_SCENE_FAMILY_ORDER,
  validateOverlayBackgroundEdge,
  type OverlayBackgroundEdge,
  type OverlayBackgroundNode,
  type OverlayBackgroundOperatorKey,
  type OverlaySceneFamilyKey
} from "@brand-layout-ops/operator-overlay-layout";
import {
  createParameterSectionRegistry,
  setupAccordion,
  type ParameterSectionDefinition
} from "@brand-layout-ops/parameter-ui";

import {
  OVERLAY_LAYOUT_OPERATOR_SELECTION_ID,
  type PreviewState,
  type Selection
} from "./preview-app-context.js";

export interface ConfigEditorControllerDeps {
  readonly state: PreviewState;
  readonly sectionDefinitions: ParameterSectionDefinition[];
  getConfigEditor(): HTMLElement | null;
  getLayersEditor(): HTMLElement | null;
  getSelectedOperatorId(): string;
  getSelectedOperatorGroup(): string;
  getSceneFamilyLabel(key: OverlaySceneFamilyKey): string;
  getAvailableBackgroundOperatorKeys(): OverlayBackgroundOperatorKey[];
  addBackgroundNode(operatorKey: OverlayBackgroundOperatorKey): string | null;
  connectBackgroundEdge(edge: OverlayBackgroundEdge): boolean;
  disconnectBackgroundInput(nodeId: string, portKey: string): boolean;
  setSelectedOperator(operatorId: string | null): boolean;
  selectOverlayItem(selection: Selection | null): void;
  syncDocumentBackgroundGraph(): void;
  removeBackgroundNode(nodeId: string): boolean;
  markDocumentDirty(): void;
  syncBackgroundRendererVisibility(): void;
  renderStage(): Promise<void>;
}

export interface ConfigEditorController {
  buildConfigEditor(): void;
  getRenderedSectionElement(sectionKey: string): HTMLElement | null;
}

interface RenderedSection {
  section: ParameterSectionDefinition;
  element: HTMLElement;
}

interface BackgroundConnectionOption {
  edge: OverlayBackgroundEdge;
  label: string;
}

interface PendingOperatorSectionRestore {
  preferredSectionKey: string | null;
  fallbackToFirstSection: boolean;
}

interface BackgroundNodePanelElements {
  panel: HTMLElement;
  sectionKey: string;
}

const OVERLAY_LOGO_LAYER_TOKEN = "overlay:logo";

function getOverlayTextLayerToken(fieldId: string): string {
  return `overlay:text:${fieldId}`;
}

export function createConfigEditorController(deps: ConfigEditorControllerDeps): ConfigEditorController {
  const { state } = deps;
  const configSectionRegistry = createParameterSectionRegistry(deps.sectionDefinitions);
  const operatorSectionStateByGroup = new Map<string, string | null>();
  let pendingOperatorSectionRestore: PendingOperatorSectionRestore | null = null;
  let renderedSectionElementsByKey = new Map<string, HTMLElement>();
  let layerPaletteInputIdSequence = 0;

  function getOperatorSectionState(groupKey: string): string | null {
    return operatorSectionStateByGroup.get(groupKey) ?? null;
  }

  function hasOperatorSectionState(groupKey: string): boolean {
    return operatorSectionStateByGroup.has(groupKey);
  }

  function setOperatorSectionState(groupKey: string, sectionKey: string | null): void {
    operatorSectionStateByGroup.set(groupKey, sectionKey);
  }

  function getConfigSections(): ParameterSectionDefinition[] {
    return configSectionRegistry.getSections();
  }

  function getBackgroundNodeLabel(node: OverlayBackgroundNode): string {
    if (node.operatorKey === OVERLAY_BACKGROUND_HALO_OPERATOR_KEY) {
      return "Halo Field";
    }

    if (node.operatorKey === OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY && node.id === OVERLAY_BACKGROUND_FUZZY_SEED_NODE_ID) {
      return "Phyllotaxis Seed";
    }

    return deps.getSceneFamilyLabel(getOverlaySceneFamilyKeyForBackgroundOperator(node.operatorKey));
  }

  function getBackgroundOperatorLabel(operatorKey: OverlayBackgroundOperatorKey): string {
    if (operatorKey === OVERLAY_BACKGROUND_HALO_OPERATOR_KEY) {
      return "Halo Field";
    }

    return deps.getSceneFamilyLabel(getOverlaySceneFamilyKeyForBackgroundOperator(operatorKey));
  }

  function getBackgroundNodeStatus(node: OverlayBackgroundNode): string {
    const nodesById = new Map(state.documentProject.backgroundGraph.nodes.map((entry) => [entry.id, entry]));
    const incomingLabels = state.documentProject.backgroundGraph.edges
      .filter((edge) => edge.toNodeId === node.id)
      .map((edge) => nodesById.get(edge.fromNodeId))
      .filter((entry): entry is OverlayBackgroundNode => entry !== undefined)
      .map((entry) => getBackgroundNodeLabel(entry));
    const outgoingLabels = state.documentProject.backgroundGraph.edges
      .filter((edge) => edge.fromNodeId === node.id)
      .map((edge) => nodesById.get(edge.toNodeId))
      .filter((entry): entry is OverlayBackgroundNode => entry !== undefined)
      .map((entry) => getBackgroundNodeLabel(entry));

    const statusParts = [
      node.id === state.documentProject.backgroundGraph.activeNodeId ? "Output" : "Upstream"
    ];

    if (incomingLabels.length > 0) {
      statusParts.push(`Receives ${incomingLabels.join(", ")}`);
    }

    if (outgoingLabels.length > 0) {
      statusParts.push(`Feeds ${outgoingLabels.join(", ")}`);
    }

    if (incomingLabels.length === 0 && outgoingLabels.length === 0) {
      statusParts.push("No saved connections");
    }

    return statusParts.join(" | ");
  }

  function serializeBackgroundConnectionOption(edge: Pick<OverlayBackgroundEdge, "fromNodeId" | "fromPortKey">): string {
    return JSON.stringify([edge.fromNodeId, edge.fromPortKey]);
  }

  function getBackgroundConnectionSourceLabel(edge: OverlayBackgroundEdge): string {
    const sourceNode = state.documentProject.backgroundGraph.nodes.find((node) => node.id === edge.fromNodeId) ?? null;
    const sourceLabel = sourceNode ? getBackgroundNodeLabel(sourceNode) : edge.fromNodeId;
    const outputPort = sourceNode ? findOverlayBackgroundOutputPort(sourceNode.operatorKey, edge.fromPortKey) : null;

    return outputPort ? `${sourceLabel} -> ${outputPort.label}` : sourceLabel;
  }

  function getBackgroundConnectionOptions(
    node: OverlayBackgroundNode,
    inputPortKey: string
  ): BackgroundConnectionOption[] {
    return state.documentProject.backgroundGraph.nodes.flatMap((sourceNode) => {
      const outputPorts = getOverlayBackgroundCompatibleOutputPorts(sourceNode.operatorKey, node.operatorKey, inputPortKey);
      return outputPorts.flatMap((outputPort) => {
        const edge = {
          fromNodeId: sourceNode.id,
          fromPortKey: outputPort.key,
          toNodeId: node.id,
          toPortKey: inputPortKey
        } satisfies OverlayBackgroundEdge;
        const validation = validateOverlayBackgroundEdge(state.documentProject.backgroundGraph, edge, { allowReplacingInput: true });
        if (!validation.isValid && validation.code !== "duplicate-edge") {
          return [];
        }

        return [{
          edge,
          label: `${getBackgroundNodeLabel(sourceNode)} -> ${outputPort.label}`
        }];
      });
    });
  }

  function getSelectedBackgroundNode(): OverlayBackgroundNode | null {
    const selectedOperatorId = deps.getSelectedOperatorId();
    if (selectedOperatorId === OVERLAY_LAYOUT_OPERATOR_SELECTION_ID) {
      return null;
    }

    return state.documentProject.backgroundGraph.nodes.find((node) => node.id === selectedOperatorId) ?? null;
  }

  function removeBackgroundNodeAndSelectFallback(node: OverlayBackgroundNode): void {
    if (!deps.removeBackgroundNode(node.id)) {
      return;
    }

    deps.setSelectedOperator(state.documentProject.backgroundGraph.activeNodeId);
    queueOperatorSectionRestore({ fallbackToFirstSection: true });
    deps.markDocumentDirty();
    buildConfigEditor();
    void deps.renderStage();
  }

  function buildBackgroundConnectionControls(node: OverlayBackgroundNode): HTMLElement | null {
    const connectionFields = getOverlayBackgroundInputPorts(node.operatorKey).flatMap((inputPort) => {
      const existingEdge = findOverlayBackgroundIncomingEdge(state.documentProject.backgroundGraph, node.id, inputPort.key);
      const options = getBackgroundConnectionOptions(node, inputPort.key);
      if (!existingEdge && options.length === 0) {
        return [];
      }

      const field = document.createElement("div");
      field.className = "is-layer-connection-field";

      const heading = document.createElement("div");
      heading.className = "is-layer-connection-heading";

      const label = document.createElement("span");
      label.className = "is-layer-connection-label";
      label.textContent = inputPort.label;

      const meta = document.createElement("span");
      meta.className = "is-layer-connection-meta";
      meta.textContent = existingEdge
        ? `Current: ${getBackgroundConnectionSourceLabel(existingEdge)}`
        : "No source connected.";

      heading.append(label, meta);
      field.append(heading);

      if (options.length === 0) {
        const controls = document.createElement("div");
        controls.className = "is-layer-connection-controls";

        if (existingEdge) {
          const disconnectButton = document.createElement("button");
          disconnectButton.type = "button";
          disconnectButton.className = "bf-button is-base is-dense is-layer-connection-disconnect";
          disconnectButton.textContent = "Disconnect";
          disconnectButton.addEventListener("click", () => {
            if (!deps.disconnectBackgroundInput(node.id, inputPort.key)) {
              return;
            }

            deps.setSelectedOperator(node.id);
            deps.markDocumentDirty();
            if (!refreshSelectedBackgroundNodeControls(node.id)) {
              queueOperatorSectionRestore();
              buildConfigEditor();
            }
            void deps.renderStage();
          });
          controls.append(disconnectButton);
        }

        field.append(controls);
        return [field];
      }

      const controls = document.createElement("div");
      controls.className = "is-layer-connection-controls";

      const select = document.createElement("select");
      select.className = "bf-input is-layer-connection-select";

      for (const option of options) {
        const optionEl = document.createElement("option");
        optionEl.value = serializeBackgroundConnectionOption(option.edge);
        optionEl.textContent = option.label;
        select.append(optionEl);
      }

      const currentValue = existingEdge ? serializeBackgroundConnectionOption(existingEdge) : null;
      const defaultValue = currentValue && options.some((option) => serializeBackgroundConnectionOption(option.edge) === currentValue)
        ? currentValue
        : serializeBackgroundConnectionOption(options[0].edge);
      select.value = defaultValue;

      const connectButton = document.createElement("button");
      connectButton.type = "button";
      connectButton.className = "bf-button is-base is-dense";

      function getSelectedOption(): BackgroundConnectionOption | null {
        return options.find((option) => serializeBackgroundConnectionOption(option.edge) === select.value) ?? null;
      }

      function syncConnectButtonState(): void {
        const selectedOption = getSelectedOption();
        const isCurrentSelection = existingEdge !== null
          && selectedOption !== null
          && selectedOption.edge.fromNodeId === existingEdge.fromNodeId
          && selectedOption.edge.fromPortKey === existingEdge.fromPortKey;

        connectButton.disabled = selectedOption === null || isCurrentSelection;
        connectButton.textContent = existingEdge
          ? (isCurrentSelection ? "Connected" : "Replace")
          : "Connect";
      }

      connectButton.addEventListener("click", () => {
        const selectedOption = getSelectedOption();
        if (!selectedOption || !deps.connectBackgroundEdge(selectedOption.edge)) {
          return;
        }

        deps.setSelectedOperator(node.id);
        deps.markDocumentDirty();
        if (!refreshSelectedBackgroundNodeControls(node.id)) {
          queueOperatorSectionRestore();
          buildConfigEditor();
        }
        void deps.renderStage();
      });
      select.addEventListener("change", syncConnectButtonState);
      syncConnectButtonState();

      controls.append(select, connectButton);

      if (existingEdge) {
        const disconnectButton = document.createElement("button");
        disconnectButton.type = "button";
        disconnectButton.className = "bf-button is-base is-dense is-layer-connection-disconnect";
        disconnectButton.textContent = "Disconnect";
        disconnectButton.addEventListener("click", () => {
          if (!deps.disconnectBackgroundInput(node.id, inputPort.key)) {
            return;
          }

          deps.setSelectedOperator(node.id);
          deps.markDocumentDirty();
          if (!refreshSelectedBackgroundNodeControls(node.id)) {
            queueOperatorSectionRestore();
            buildConfigEditor();
          }
          void deps.renderStage();
        });
        controls.append(disconnectButton);
      }

      field.append(controls);
      return [field];
    });

    if (connectionFields.length === 0) {
      return null;
    }

    const container = document.createElement("div");
    container.className = "is-layer-connection-list";
    container.append(...connectionFields);
    return container;
  }

  function buildBackgroundNodeControlsPanel(node: OverlayBackgroundNode): BackgroundNodePanelElements | null {
    const connectionControls = buildBackgroundConnectionControls(node);
    const canRemoveNode = state.documentProject.backgroundGraph.nodes.length > 1;

    if (!connectionControls && !canRemoveNode) {
      return null;
    }

    const sectionKey = `background-node-controls:${node.id}`;
    const group = document.createElement("li");
    group.dataset.sectionKey = sectionKey;
    group.className = "bf-accordion-group";

    const heading = document.createElement("h3");
    heading.className = "bf-accordion-heading";

    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "bf-accordion-tab";
    tab.textContent = "Node";
    tab.setAttribute("aria-expanded", "false");

    const panelId = nextLayerPaletteInputId("background-node-controls-panel");
    tab.setAttribute("aria-controls", panelId);
    heading.append(tab);
    group.append(heading);

    const panel = document.createElement("div");
    panel.id = panelId;
    panel.className = "bf-accordion-panel";
    panel.setAttribute("aria-hidden", "true");

    const body = document.createElement("div");
    body.className = "bf-accordion-body bf-stack is-compact-stack";

    if (connectionControls) {
      const connectionField = document.createElement("div");
      connectionField.className = "bf-field";

      const connectionLabel = document.createElement("span");
      connectionLabel.className = "bf-form-label";
      connectionLabel.textContent = "Inputs";

      connectionField.append(connectionLabel, connectionControls);
      body.append(connectionField);
    }

    if (canRemoveNode) {
      const actions = document.createElement("div");
      actions.className = "bf-cluster";

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "bf-button is-base is-dense";
      removeButton.textContent = `Remove ${getBackgroundNodeSelectionLabel(node)}`;
      removeButton.addEventListener("click", () => {
        removeBackgroundNodeAndSelectFallback(node);
      });

      actions.append(removeButton);
      body.append(actions);
    }

    panel.append(body);
    group.append(panel);

    return { panel: group, sectionKey };
  }

  function refreshSelectedBackgroundNodeControls(nodeId: string): boolean {
    const selectedNode = state.documentProject.backgroundGraph.nodes.find((node) => node.id === nodeId) ?? null;
    if (!selectedNode) {
      return false;
    }

    const nextPanel = buildBackgroundNodeControlsPanel(selectedNode);
    if (!nextPanel) {
      return false;
    }

    const container = deps.getConfigEditor();
    const currentPanel = container?.querySelector<HTMLElement>(`[data-section-key="${nextPanel.sectionKey}"]`) ?? null;
    if (!currentPanel) {
      return false;
    }

    const accordion = currentPanel.closest<HTMLElement>(".bf-accordion");
    const wasExpanded = currentPanel.querySelector<HTMLElement>(".bf-accordion-tab")?.getAttribute("aria-expanded") === "true";

    currentPanel.replaceWith(nextPanel.panel);

    if (accordion) {
      setupAccordion(accordion);
    }

    if (wasExpanded) {
      openAccordionSection(nextPanel.panel, deps.getSelectedOperatorGroup());
    }

    return true;
  }

  function findRenderedSection(renderedSections: RenderedSection[], key: string | null): HTMLElement | null {
    if (!key) {
      return null;
    }

    return renderedSections.find((entry) => entry.section.key === key)?.element ?? null;
  }

  function queueOperatorSectionRestore(options?: {
    preferredSectionKey?: string | null;
    fallbackToFirstSection?: boolean;
  }): void {
    const selectedGroup = deps.getSelectedOperatorGroup();
    pendingOperatorSectionRestore = {
      preferredSectionKey: options?.preferredSectionKey ?? getOperatorSectionState(selectedGroup),
      fallbackToFirstSection: options?.fallbackToFirstSection ?? false
    };
  }

  function trackOperatorAccordionState(accordion: HTMLElement, groupKey: string): void {
    accordion.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(".bf-accordion-tab");
      if (!target) {
        return;
      }

      const owningAccordion = target.closest<HTMLElement>(".bf-accordion");
      if (owningAccordion !== accordion) {
        return;
      }

      const sectionGroup = target.closest<HTMLElement>("[data-section-key]");
      if (!sectionGroup) {
        return;
      }

      const isOpen = target.getAttribute("aria-expanded") === "true";
      setOperatorSectionState(groupKey, isOpen ? null : sectionGroup.dataset.sectionKey ?? null);
    });
  }

  function selectionsMatch(left: Selection | null, right: Selection | null): boolean {
    return left?.kind === right?.kind && left?.id === right?.id;
  }

  function getSelectedLayerToken(): string {
    const selectedOperatorId = deps.getSelectedOperatorId();
    if (selectedOperatorId !== OVERLAY_LAYOUT_OPERATOR_SELECTION_ID) {
      return selectedOperatorId;
    }

    if (state.selected?.kind === "text") {
      return getOverlayTextLayerToken(state.selected.id);
    }

    if (state.selected?.kind === "logo") {
      return OVERLAY_LOGO_LAYER_TOKEN;
    }

    return OVERLAY_LAYOUT_OPERATOR_SELECTION_ID;
  }

  function activateOverlayLayer(selection: Selection | null): void {
    const didChangeOperator = deps.setSelectedOperator(OVERLAY_LAYOUT_OPERATOR_SELECTION_ID);
    if (!didChangeOperator && selectionsMatch(state.selected, selection)) {
      return;
    }

    queueOperatorSectionRestore({ fallbackToFirstSection: true });
    deps.selectOverlayItem(selection);
  }

  function nextLayerPaletteInputId(prefix: string): string {
    layerPaletteInputIdSequence += 1;
    return `layer-palette-${prefix}-${layerPaletteInputIdSequence}`;
  }

  function createSideNavigationSection(title: string): { heading: HTMLElement; list: HTMLUListElement } {
    const heading = document.createElement("h3");
    heading.className = "bf-side-navigation-heading";
    heading.textContent = title;

    const list = document.createElement("ul");
    list.className = "bf-side-navigation-list";
    return { heading, list };
  }

  function createSideNavigationItem(options: {
    label: string;
    selected: boolean;
    onSelect: () => void;
  }): HTMLLIElement {
    const item = document.createElement("li");
    item.className = "bf-side-navigation-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "bf-side-navigation-link";
    if (options.selected) {
      button.setAttribute("aria-current", "page");
    }
    button.addEventListener("click", options.onSelect);

    const label = document.createElement("span");
    label.className = "bf-side-navigation-label";
    label.textContent = options.label;

    button.append(label);
    item.append(button);
    return item;
  }

  function getBackgroundNodeSelectionLabel(node: OverlayBackgroundNode): string {
    const baseLabel = getBackgroundNodeLabel(node);
    const duplicateCount = state.documentProject.backgroundGraph.nodes.filter((entry) => entry.operatorKey === node.operatorKey).length;
    return duplicateCount > 1 ? `${baseLabel} (${node.id})` : baseLabel;
  }

  function buildLayerPaletteEl(): HTMLElement {
    const section = document.createElement("div");
    section.className = "bf-stack is-compact-stack";

    const selectedLayerToken = getSelectedLayerToken();

    const { heading: overlayHeading, list: overlayList } = createSideNavigationSection("Overlay");

    overlayList.append(createSideNavigationItem({
      label: "Layout",
      selected: selectedLayerToken === OVERLAY_LAYOUT_OPERATOR_SELECTION_ID,
      onSelect: () => {
        activateOverlayLayer(null);
      }
    }));

    for (const field of state.params.textFields) {
      overlayList.append(createSideNavigationItem({
        label: getOverlayFieldDisplayLabel(state.params, field.id),
        selected: selectedLayerToken === getOverlayTextLayerToken(field.id),
        onSelect: () => {
          activateOverlayLayer({ kind: "text", id: field.id });
        }
      }));
    }

    if (state.params.logo) {
      overlayList.append(createSideNavigationItem({
        label: "Logo",
        selected: selectedLayerToken === OVERLAY_LOGO_LAYER_TOKEN,
        onSelect: () => {
          activateOverlayLayer({ kind: "logo", id: state.params.logo?.id ?? "brand-mark" });
        }
      }));
    }

    const { heading: backgroundHeading, list: backgroundList } = createSideNavigationSection("Background");

    for (const node of state.documentProject.backgroundGraph.nodes) {
      backgroundList.append(createSideNavigationItem({
        label: getBackgroundNodeSelectionLabel(node),
        selected: node.id === selectedLayerToken,
        onSelect: () => {
          if (!deps.setSelectedOperator(node.id)) {
            return;
          }

          queueOperatorSectionRestore({ fallbackToFirstSection: true });
          buildConfigEditor();
        }
      }));
    }

    section.append(overlayHeading, overlayList, backgroundHeading, backgroundList);
    return section;
  }

  function openAccordionSection(group: HTMLElement | null, groupKey: string): boolean {
    const tab = group?.querySelector<HTMLElement>(".bf-accordion-tab");
    const panelId = tab?.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;
    if (!tab || !panel) {
      return false;
    }

    tab.setAttribute("aria-expanded", "true");
    panel.setAttribute("aria-hidden", "false");
    setOperatorSectionState(groupKey, group?.dataset.sectionKey ?? null);
    return true;
  }

  function buildSectionAccordion(
    sections: ParameterSectionDefinition[],
    renderedSections: RenderedSection[]
  ): { accordion: HTMLElement; list: HTMLUListElement } {
    const accordion = document.createElement("aside");
    accordion.className = "bf-accordion";

    const list = document.createElement("ul");
    list.className = "bf-accordion-list";

    for (const section of sections) {
      const element = section.factory();
      element.dataset.sectionKey = section.key;
      list.append(element);
      renderedSections.push({ section, element });
    }

    accordion.append(list);
    return { accordion, list };
  }

  function buildStaticSectionFromAccordionGroup(group: HTMLElement): HTMLElement {
    const section = document.createElement("section");
    section.className = "bf-stack is-compact-stack";
    if (group.dataset.sectionKey) {
      section.dataset.sectionKey = group.dataset.sectionKey;
    }

    const title = group.querySelector<HTMLElement>(".bf-accordion-tab")?.textContent?.trim() ?? "";
    const label = document.createElement("span");
    label.className = "bf-form-label is-inspector-rail-label";
    label.textContent = title;
    section.append(label);

    const panel = group.querySelector<HTMLElement>(".bf-accordion-panel");
    if (!panel) {
      return section;
    }

    panel.removeAttribute("aria-hidden");
    panel.removeAttribute("aria-labelledby");
    panel.removeAttribute("id");
    panel.hidden = false;
    panel.classList.remove("bf-accordion-panel");
    panel.classList.add("bf-stack", "is-compact-stack");
    section.append(panel);
    return section;
  }

  function appendSectionsToStaticStack(
    stack: HTMLElement,
    sections: ParameterSectionDefinition[],
    renderedSections: RenderedSection[],
    options?: {
      trackRenderedElements?: boolean;
    }
  ): void {
    for (const section of sections) {
      const group = section.factory();
      group.dataset.sectionKey = section.key;
      const element = buildStaticSectionFromAccordionGroup(group);
      stack.append(element);
      renderedSections.push({ section, element });

      if (options?.trackRenderedElements) {
        renderedSectionElementsByKey.set(section.key, element);
      }
    }
  }

  function appendSectionsToAccordionList(
    list: HTMLUListElement,
    sections: ParameterSectionDefinition[],
    renderedSections: RenderedSection[],
    options?: {
      trackRenderedElements?: boolean;
    }
  ): void {
    for (const section of sections) {
      const element = section.factory();
      element.dataset.sectionKey = section.key;
      list.append(element);
      renderedSections.push({ section, element });

      if (options?.trackRenderedElements) {
        renderedSectionElementsByKey.set(section.key, element);
      }
    }
  }

  function buildInspectorPanelContent(description: string | null, content: HTMLElement): HTMLElement {
    const panelContent = document.createElement("section");
    panelContent.className = "bf-stack is-compact-stack is-inspector-rail";

    if (description) {
      const help = document.createElement("p");
      help.className = "bf-form-help is-tight bf-u-no-margin--bottom";
      help.textContent = description;
      panelContent.append(help);
    }

    panelContent.append(content);
    return panelContent;
  }

  function buildConfigEditor(): void {
    const container = deps.getConfigEditor();
    const layersContainer = deps.getLayersEditor();
    renderedSectionElementsByKey.clear();
    container?.replaceChildren();
    layersContainer?.replaceChildren();
    if (!container && !layersContainer) {
      return;
    }

    const sections = getConfigSections();
    const activeGroup = deps.getSelectedOperatorGroup();
    const preferredOpenSectionKey = pendingOperatorSectionRestore?.preferredSectionKey ?? getOperatorSectionState(activeGroup);
    const fallbackToFirstSection = pendingOperatorSectionRestore?.fallbackToFirstSection ?? false;
    const selectedBackgroundNode = getSelectedBackgroundNode();

    const shellSections = sections.filter((section) => section.scope === "shell");
    const operatorSections = sections.filter((section) => section.scope !== "shell");
    const selectedBackgroundNodePanel = activeGroup === OVERLAY_LAYOUT_OPERATOR_SELECTION_ID
      ? null
      : (selectedBackgroundNode ? buildBackgroundNodeControlsPanel(selectedBackgroundNode) : null);
    const selectedOperatorSections = operatorSections.filter((section) => {
      if (section.group !== activeGroup) {
        return false;
      }

      if (activeGroup !== OVERLAY_LAYOUT_OPERATOR_SELECTION_ID) {
        return true;
      }

      if (!state.selected) {
        return true;
      }

      return section.key === "overlay-layer";
    });
    const renderedSections: RenderedSection[] = [];
    const shouldRenderLayersRail = shellSections.length > 0 || operatorSections.length > 0;

    if (shouldRenderLayersRail && layersContainer) {
      const layersRoot = document.createElement("div");
      layersRoot.className = "bf-stack is-compact-stack";
      layersRoot.append(buildLayerPaletteEl());
      for (const section of shellSections) {
        layersRoot.append(section.factory());
      }
      layersContainer.append(layersRoot);
    }

    const shouldFlattenOverlaySections = activeGroup === OVERLAY_LAYOUT_OPERATOR_SELECTION_ID;

    if (operatorSections.length > 0 && container) {
      let parametersContent: HTMLElement | null = null;
      if (shouldFlattenOverlaySections) {
        const stack = document.createElement("div");
        stack.className = "bf-stack is-compact-stack";
        appendSectionsToStaticStack(stack, selectedOperatorSections, renderedSections, {
          trackRenderedElements: true
        });
        parametersContent = stack;
      } else {
        const { accordion: operatorAccordion, list: operatorList } = buildSectionAccordion([], renderedSections);
        appendSectionsToAccordionList(operatorList, selectedOperatorSections, renderedSections, {
          trackRenderedElements: true
        });
        if (selectedBackgroundNodePanel) {
          operatorList.prepend(selectedBackgroundNodePanel.panel);
          renderedSections.push({
            section: {
              key: selectedBackgroundNodePanel.sectionKey,
              order: -1,
              scope: "operator",
              group: activeGroup,
              factory: () => selectedBackgroundNodePanel.panel
            },
            element: selectedBackgroundNodePanel.panel
          });
        }

        trackOperatorAccordionState(operatorAccordion, activeGroup);
        setupAccordion(operatorAccordion);
        parametersContent = operatorAccordion;
      }

      if (parametersContent) {
        container.append(buildInspectorPanelContent(
          activeGroup === OVERLAY_LAYOUT_OPERATOR_SELECTION_ID
            ? null
            : "Only the selected background operator controls are shown here.",
          parametersContent
        ));
      }
    }

    if (layersContainer) {
      initRangeControls({ root: layersContainer });
    }
    if (container) {
      initRangeControls({ root: container });
    }

    let restoredSection = false;
    const restorableSectionKeys = selectedBackgroundNodePanel
      ? [selectedBackgroundNodePanel.sectionKey, ...selectedOperatorSections.map((section) => section.key)]
      : selectedOperatorSections.map((section) => section.key);

    const hasTrackedStateForGroup = hasOperatorSectionState(activeGroup);
    const hasValidPreferredSection = Boolean(preferredOpenSectionKey && restorableSectionKeys.includes(preferredOpenSectionKey));

    if (!shouldFlattenOverlaySections && hasValidPreferredSection) {
      const targetGroup = findRenderedSection(renderedSections, preferredOpenSectionKey);
      restoredSection = openAccordionSection(targetGroup, activeGroup);
    }

    if (!shouldFlattenOverlaySections && !restoredSection && fallbackToFirstSection) {
      const shouldOpenFallbackSection = !hasTrackedStateForGroup
        || Boolean(preferredOpenSectionKey && !hasValidPreferredSection);
      if (shouldOpenFallbackSection) {
        const firstFallbackSectionKey = selectedBackgroundNodePanel?.sectionKey ?? selectedOperatorSections[0]?.key ?? null;
        const firstOperatorSection = findRenderedSection(renderedSections, firstFallbackSectionKey);
        restoredSection = openAccordionSection(firstOperatorSection, activeGroup);
      }
    }

    pendingOperatorSectionRestore = null;

    const activeSections = [...shellSections, ...selectedOperatorSections];
    for (const section of activeSections) {
      section.afterRender?.();
    }
  }

  return {
    buildConfigEditor,
    getRenderedSectionElement(sectionKey: string): HTMLElement | null {
      return renderedSectionElementsByKey.get(sectionKey) ?? null;
    }
  };
}