/**
 * config-editor-controller.ts — Inspector pane registration and rebuild.
 *
 * Owns the accordion section registry, the operator selector UI, and the
 * policy for rebuilding the split workspace/parameter rails.
 */

import { initRangeControls } from "baseline-foundry";

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

const OVERLAY_LOGO_LAYER_TOKEN = "overlay:logo";

function getOverlayTextLayerToken(fieldId: string): string {
  return `overlay:text:${fieldId}`;
}

export function createConfigEditorController(deps: ConfigEditorControllerDeps): ConfigEditorController {
  const { state } = deps;
  const configSectionRegistry = createParameterSectionRegistry(deps.sectionDefinitions);
  let shouldAutoOpenNextOperatorSection = false;
  let renderedSectionElementsByKey = new Map<string, HTMLElement>();

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
            shouldAutoOpenNextOperatorSection = true;
            deps.markDocumentDirty();
            buildConfigEditor();
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
        shouldAutoOpenNextOperatorSection = true;
        deps.markDocumentDirty();
        buildConfigEditor();
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
          shouldAutoOpenNextOperatorSection = true;
          deps.markDocumentDirty();
          buildConfigEditor();
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

  function findRenderedSection(renderedSections: RenderedSection[], key: string | null): HTMLElement | null {
    if (!key) {
      return null;
    }

    return renderedSections.find((entry) => entry.section.key === key)?.element ?? null;
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

    shouldAutoOpenNextOperatorSection = true;
    deps.selectOverlayItem(selection);
  }

  function buildLayerPaletteEl(): HTMLElement {
    const section = document.createElement("li");
    section.className = "bf-accordion-group is-layer-palette";

    const heading = document.createElement("div");
    heading.className = "is-layer-palette-heading";

    const label = document.createElement("span");
    label.className = "bf-form-label";
    label.textContent = "Layers";
    heading.append(label);

    const help = document.createElement("p");
    help.className = "bf-form-help is-tight bf-u-no-margin--bottom is-layer-palette-help";
    help.textContent = "Select the rendered background and the authored layer you want to tune. The parameter pane follows this selection.";

    const outputSection = document.createElement("div");
    outputSection.className = "is-layer-palette-section";

    const outputLabel = document.createElement("div");
    outputLabel.className = "is-layer-palette-subheading";
    outputLabel.textContent = "Rendered Background";
    outputSection.append(outputLabel);

    const radioGroup = document.createElement("div");
    radioGroup.className = "is-layer-palette-options";

    for (const sceneFamilyKey of OVERLAY_SCENE_FAMILY_ORDER) {
      const radioLabel = document.createElement("label");
      radioLabel.className = "is-layer-palette-option";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "background-family-selector";
      radio.value = sceneFamilyKey;
      radio.checked = sceneFamilyKey === state.documentProject.sceneFamilyKey;
      radio.addEventListener("change", () => {
        if (!radio.checked) {
          return;
        }

        state.documentProject = {
          ...state.documentProject,
          sceneFamilyKey: sceneFamilyKey as OverlaySceneFamilyKey
        };
        shouldAutoOpenNextOperatorSection = true;
        deps.syncDocumentBackgroundGraph();
        deps.setSelectedOperator(state.documentProject.backgroundGraph.activeNodeId);
        deps.markDocumentDirty();
        buildConfigEditor();
        deps.syncBackgroundRendererVisibility();
        void deps.renderStage();
      });

      const text = document.createElement("span");
      text.textContent = deps.getSceneFamilyLabel(sceneFamilyKey);

      radioLabel.append(radio, text);
      radioGroup.append(radioLabel);
    }

    outputSection.append(radioGroup);

    const selectedLayerToken = getSelectedLayerToken();

    const backgroundSection = document.createElement("div");
    backgroundSection.className = "is-layer-palette-section";

    const backgroundLabel = document.createElement("div");
    backgroundLabel.className = "is-layer-palette-subheading";
    backgroundLabel.textContent = "Background Graph";
    backgroundSection.append(backgroundLabel);

    const backgroundList = document.createElement("div");
    backgroundList.className = "bf-choice-list bf-stack is-compact-stack";

    const canRemoveNodes = state.documentProject.backgroundGraph.nodes.length > 1;

    for (const node of state.documentProject.backgroundGraph.nodes) {
      const nodeEntry = document.createElement("div");
      nodeEntry.className = "is-layer-palette-node";

      const row = document.createElement("label");
      row.className = "bf-choice-row is-layer-palette-row";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "layer-selection";
      radio.value = node.id;
      radio.checked = node.id === selectedLayerToken;
      radio.addEventListener("change", () => {
        if (!radio.checked || !deps.setSelectedOperator(node.id)) {
          return;
        }

        shouldAutoOpenNextOperatorSection = true;
        buildConfigEditor();
      });

      const copy = document.createElement("span");
      copy.className = "is-layer-palette-copy";

      const nameSpan = document.createElement("span");
      nameSpan.className = "bf-choice-row-name";
      nameSpan.textContent = getBackgroundNodeLabel(node);

      const metaSpan = document.createElement("span");
      metaSpan.className = "bf-choice-row-meta";
      metaSpan.textContent = getBackgroundNodeStatus(node);

      copy.append(nameSpan, metaSpan);
      row.append(radio, copy);

      if (canRemoveNodes) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "bf-choice-row-action is-remove-node";
        removeBtn.textContent = "×";
        removeBtn.title = `Remove ${getBackgroundNodeLabel(node)}`;
        removeBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!deps.removeBackgroundNode(node.id)) {
            return;
          }

          deps.setSelectedOperator(state.documentProject.backgroundGraph.activeNodeId);
          shouldAutoOpenNextOperatorSection = true;
          deps.markDocumentDirty();
          buildConfigEditor();
          void deps.renderStage();
        });
        row.append(removeBtn);
      }

      nodeEntry.append(row);

      const connectionControls = buildBackgroundConnectionControls(node);
      if (connectionControls) {
        nodeEntry.append(connectionControls);
      }

      backgroundList.append(nodeEntry);
    }

    backgroundSection.append(backgroundList);

    const addActions = document.createElement("div");
    addActions.className = "is-layer-palette-actions";

    for (const operatorKey of deps.getAvailableBackgroundOperatorKeys()) {
      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "bf-button is-base is-dense";
      addButton.textContent = `Add ${getBackgroundOperatorLabel(operatorKey)}`;
      addButton.addEventListener("click", () => {
        const nextNodeId = deps.addBackgroundNode(operatorKey);
        if (!nextNodeId) {
          return;
        }

        deps.setSelectedOperator(nextNodeId);
        shouldAutoOpenNextOperatorSection = true;
        deps.markDocumentDirty();
        buildConfigEditor();
        void deps.renderStage();
      });
      addActions.append(addButton);
    }

    backgroundSection.append(addActions);

    const overlaySection = document.createElement("div");
    overlaySection.className = "is-layer-palette-section";

    const overlayLabel = document.createElement("div");
    overlayLabel.className = "is-layer-palette-subheading";
    overlayLabel.textContent = "Overlay Layers";
    overlaySection.append(overlayLabel);

    const overlayList = document.createElement("div");
    overlayList.className = "bf-choice-list bf-stack is-compact-stack";

    const overlayRow = document.createElement("label");
    overlayRow.className = "bf-choice-row is-layer-palette-row";

    const overlayRadio = document.createElement("input");
    overlayRadio.type = "radio";
    overlayRadio.name = "layer-selection";
    overlayRadio.value = OVERLAY_LAYOUT_OPERATOR_SELECTION_ID;
    overlayRadio.checked = selectedLayerToken === OVERLAY_LAYOUT_OPERATOR_SELECTION_ID;
    overlayRadio.addEventListener("change", () => {
      if (!overlayRadio.checked) {
        return;
      }

      activateOverlayLayer(null);
    });

    const overlayCopy = document.createElement("span");
    overlayCopy.className = "is-layer-palette-copy";

    const overlayName = document.createElement("span");
    overlayName.className = "bf-choice-row-name";
    overlayName.textContent = "Overlay Layout";

    const overlayMeta = document.createElement("span");
    overlayMeta.className = "bf-choice-row-meta";
    overlayMeta.textContent = "Root layer | text, logo, guides, and overlay document controls.";

    overlayCopy.append(overlayName, overlayMeta);
    overlayRow.append(overlayRadio, overlayCopy);
    overlayList.append(overlayRow);

    for (const field of state.params.textFields) {
      const row = document.createElement("label");
      row.className = "bf-choice-row is-layer-palette-row is-child";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "layer-selection";
      radio.value = getOverlayTextLayerToken(field.id);
      radio.checked = selectedLayerToken === getOverlayTextLayerToken(field.id);
      radio.addEventListener("change", () => {
        if (!radio.checked) {
          return;
        }

        activateOverlayLayer({ kind: "text", id: field.id });
      });

      const copy = document.createElement("span");
      copy.className = "is-layer-palette-copy";

      const nameSpan = document.createElement("span");
      nameSpan.className = "bf-choice-row-name";
      nameSpan.textContent = `Text: ${getOverlayFieldDisplayLabel(state.params, field.id)}`;

      const metaSpan = document.createElement("span");
      metaSpan.className = "bf-choice-row-meta";
      metaSpan.textContent = `Overlay text layer | ${field.id}`;

      copy.append(nameSpan, metaSpan);
      row.append(radio, copy);
      overlayList.append(row);
    }

    if (state.params.logo) {
      const row = document.createElement("label");
      row.className = "bf-choice-row is-layer-palette-row is-child";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "layer-selection";
      radio.value = OVERLAY_LOGO_LAYER_TOKEN;
      radio.checked = selectedLayerToken === OVERLAY_LOGO_LAYER_TOKEN;
      radio.addEventListener("change", () => {
        if (!radio.checked) {
          return;
        }

        activateOverlayLayer({ kind: "logo", id: state.params.logo?.id ?? "brand-mark" });
      });

      const copy = document.createElement("span");
      copy.className = "is-layer-palette-copy";

      const nameSpan = document.createElement("span");
      nameSpan.className = "bf-choice-row-name";
      nameSpan.textContent = "Logo";

      const metaSpan = document.createElement("span");
      metaSpan.className = "bf-choice-row-meta";
      metaSpan.textContent = "Overlay brand mark layer.";

      copy.append(nameSpan, metaSpan);
      row.append(radio, copy);
      overlayList.append(row);
    }

    overlaySection.append(overlayList);

    section.append(heading, help, outputSection, backgroundSection, overlaySection);
    return section;
  }

  function openAccordionSection(group: HTMLElement | null): boolean {
    const tab = group?.querySelector<HTMLElement>(".bf-accordion-tab");
    const panelId = tab?.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;
    if (!tab || !panel) {
      return false;
    }

    tab.setAttribute("aria-expanded", "true");
    panel.setAttribute("aria-hidden", "false");
    return true;
  }

  function buildSectionAccordion(
    sections: ParameterSectionDefinition[],
    renderedSections: RenderedSection[]
  ): HTMLElement {
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
    return accordion;
  }

  function buildInspectorRail(title: string, description: string, accordion: HTMLElement): HTMLElement {
    const rail = document.createElement("section");
    rail.className = "bf-stack is-compact-stack is-inspector-rail";

    const heading = document.createElement("div");
    heading.className = "is-inspector-rail-heading";

    const label = document.createElement("span");
    label.className = "bf-form-label is-inspector-rail-label";
    label.textContent = title;

    const help = document.createElement("p");
    help.className = "bf-form-help is-tight bf-u-no-margin--bottom";
    help.textContent = description;

    heading.append(label, help);
    rail.append(heading, accordion);
    return rail;
  }

  function buildConfigEditor(): void {
    const container = deps.getConfigEditor();
    renderedSectionElementsByKey.clear();
    if (!container) {
      return;
    }

    const expandedTab = container.querySelector<HTMLElement>('.bf-accordion-tab[aria-expanded="true"]');
    const expandedGroup = expandedTab?.closest<HTMLElement>("[data-section-key]");
    const previouslyOpenKey = expandedGroup?.dataset.sectionKey ?? null;

    container.innerHTML = "";

    const sections = getConfigSections();
    const activeGroup = deps.getSelectedOperatorGroup();

    const shellSections = sections.filter((section) => section.scope === "shell");
    const operatorSections = sections.filter((section) => section.scope !== "shell");
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

    if (shellSections.length > 0) {
      const shellAccordion = buildSectionAccordion(shellSections, renderedSections);
      container.append(
        buildInspectorRail(
          "Workspace",
          "Document, export, playback, and source-default actions stay shell-level.",
          shellAccordion
        )
      );
      setupAccordion(shellAccordion);
    }

    if (operatorSections.length > 0) {
      const operatorAccordion = buildSectionAccordion([], renderedSections);
      const operatorList = operatorAccordion.querySelector(".bf-accordion-list");
      operatorList?.append(buildLayerPaletteEl());

      for (const section of selectedOperatorSections) {
        const element = section.factory();
        element.dataset.sectionKey = section.key;
        operatorList?.append(element);
        renderedSections.push({ section, element });
        renderedSectionElementsByKey.set(section.key, element);
      }

      container.append(
        buildInspectorRail(
          "Parameters",
          activeGroup === OVERLAY_LAYOUT_OPERATOR_SELECTION_ID
            ? state.selected
              ? "The parameter pane is following the selected overlay layer. Root overlay controls stay hidden until the overlay root is selected again."
              : "Overlay Layout is selected. Root overlay controls are shown here."
            : "Only the selected saved background operator surface is shown here.",
          operatorAccordion
        )
      );
      setupAccordion(operatorAccordion);
    }

    initRangeControls({ root: container });

    let restoredSection = false;
    if (shouldAutoOpenNextOperatorSection) {
      if (previouslyOpenKey && selectedOperatorSections.some((section) => section.key === previouslyOpenKey)) {
        const targetGroup = findRenderedSection(renderedSections, previouslyOpenKey);
        restoredSection = openAccordionSection(targetGroup);
      }

      if (!restoredSection) {
        const firstOperatorSection = findRenderedSection(renderedSections, selectedOperatorSections[0]?.key ?? null);
        restoredSection = openAccordionSection(firstOperatorSection);
      }
    } else if (previouslyOpenKey) {
      const targetGroup = findRenderedSection(renderedSections, previouslyOpenKey);
      restoredSection = openAccordionSection(targetGroup);
    }

    shouldAutoOpenNextOperatorSection = false;

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