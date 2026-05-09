/**
 * document-target-controller.ts - Document-format state and UI rebuilds.
 *
 * Owns saved document-target CRUD plus the formats modal table so main.ts can
 * delegate format-specific mutations and DOM assembly while the persisted shape
 * remains compatible with the existing `project.targets` model.
 */

import {
  OUTPUT_PROFILE_ORDER,
  createCustomOutputProfileKey,
  findBuiltInOutputProfileKeyByDimensions,
  getOutputProfile,
  type FrameSize
} from "@brand-layout-ops/core-types";
import {
  getOverlayFormatPresetDefinition,
  getOverlayFormatPresetKeyForProfile,
  getOverlayFormatSeedSummary,
  type OverlayDocumentFormat
} from "@brand-layout-ops/operator-overlay-layout";

import type { PreviewState } from "./preview-app-context.js";

type DocumentSetupStatusTone = "neutral" | "success" | "error";

interface PendingDocumentTargetDraft {
  label: string;
  width: string;
  height: string;
}

interface CreateDocumentFormatOptions {
  formatPresetKey?: string | null;
  derivedFromFormatId?: string | null;
}

interface RemoveDocumentTargetResult {
  removed: boolean;
  activeChanged: boolean;
}

export interface DocumentFormatControllerDeps {
  readonly state: PreviewState;
  getFormatOptions(): HTMLElement | null;
  switchOutputProfile(profileKey: string, options?: { persistCurrentState?: boolean }): void;
  persistActiveDocumentFormatRuntimeState(): void;
  markDocumentDirty(): void;
  buildConfigEditor(): void;
}

export interface DocumentFormatController {
  getDefaultDocumentFormatLabel(profileKey: string): string;
  syncDocumentProjectToCurrentOutputProfile(): OverlayDocumentFormat;
  getUnusedDocumentFormatProfileKeys(currentProfileKey?: string): string[];
  setActiveDocumentFormat(targetId: string): void;
  addDocumentFormat(profileKey?: string): boolean;
  updateActiveDocumentFormatLabel(rawLabel: string): void;
  updateActiveDocumentFormatProfile(nextProfileKey: string): void;
  removeActiveDocumentFormat(): boolean;
  buildFormatOptions(): void;
}

export function createDocumentFormatController(
  deps: DocumentFormatControllerDeps
): DocumentFormatController {
  const { state } = deps;

  let pendingDraft: PendingDocumentTargetDraft = {
    label: "",
    width: "",
    height: ""
  };
  let pendingPresetProfileKey = "";

  let statusMessage = "";
  let statusTone: DocumentSetupStatusTone = "neutral";

  function setStatus(message: string, tone: DocumentSetupStatusTone = "neutral"): void {
    statusMessage = message;
    statusTone = tone;
  }

  function clearStatus(): void {
    statusMessage = "";
    statusTone = "neutral";
  }

  function getDefaultDocumentTargetLabel(profileKey: string): string {
    return getOutputProfile(profileKey).label;
  }

  function getDefaultDocumentFormatPresetKey(profileKey: string): string | null {
    return getOverlayFormatPresetKeyForProfile(profileKey);
  }

  function createDocumentFormatId(): string {
    let nextIndex = Math.max(1, state.documentProject.targets.length + 1);
    let nextId = `format-${nextIndex}`;
    while (state.documentProject.targets.some((target) => target.id === nextId)) {
      nextIndex += 1;
      nextId = `format-${nextIndex}`;
    }

    return nextId;
  }

  function getDocumentTargetFrame(target: OverlayDocumentFormat): FrameSize {
    const profile = getOutputProfile(target.outputProfileKey);
    return {
      widthPx: profile.widthPx,
      heightPx: profile.heightPx
    };
  }

  function createDocumentTarget(
    profileKey: string,
    labelOverride?: string,
    options?: CreateDocumentFormatOptions
  ): OverlayDocumentFormat {
    return {
      id: createDocumentFormatId(),
      label: labelOverride?.trim() || getDefaultDocumentTargetLabel(profileKey),
      outputProfileKey: profileKey,
      formatPresetKey: options?.formatPresetKey ?? getDefaultDocumentFormatPresetKey(profileKey),
      derivedFromFormatId: options?.derivedFromFormatId ?? null
    };
  }

  function createCell(tagName: "th" | "td", textContent?: string): HTMLTableCellElement {
    const cell = document.createElement(tagName);
    if (typeof textContent === "string") {
      cell.textContent = textContent;
    }
    return cell;
  }

  function getDocumentTargetById(
    targetId: string | null | undefined = state.documentProject.activeTargetId
  ): OverlayDocumentFormat | null {
    if (!targetId) {
      return null;
    }

    return state.documentProject.targets.find((target) => target.id === targetId) ?? null;
  }

  function getDocumentTargetByProfileKey(profileKey: string): OverlayDocumentFormat | null {
    return state.documentProject.targets.find((target) => target.outputProfileKey === profileKey) ?? null;
  }

  function normalizeDerivedFromFormatId(target: OverlayDocumentFormat): OverlayDocumentFormat {
    if (!target.derivedFromFormatId || target.derivedFromFormatId === target.id) {
      return {
        ...target,
        derivedFromFormatId: null
      };
    }

    const sourceExists = state.documentProject.targets.some((candidate) => candidate.id === target.derivedFromFormatId);
    if (sourceExists) {
      return target;
    }

    return {
      ...target,
      derivedFromFormatId: null
    };
  }

  function getDocumentFormatSourceSummary(target: OverlayDocumentFormat): string {
    const parts: string[] = [];
    const preset = target.formatPresetKey
      ? getOverlayFormatPresetDefinition(target.formatPresetKey)
      : null;
    if (preset) {
      parts.push(`Preset: ${preset.label}`);
      parts.push(`Seed ${getOverlayFormatSeedSummary(preset)}`);
    } else {
      parts.push("Custom size");
    }

    if (target.derivedFromFormatId && target.derivedFromFormatId !== target.id) {
      const sourceFormat = getDocumentTargetById(target.derivedFromFormatId);
      if (sourceFormat) {
        parts.push(`Derived from ${sourceFormat.label}`);
      }
    }

    return parts.join(" · ");
  }

  function getDocumentTargetByDimensions(widthPx: number, heightPx: number): OverlayDocumentFormat | null {
    const safeWidthPx = Math.max(1, Math.round(widthPx));
    const safeHeightPx = Math.max(1, Math.round(heightPx));

    return state.documentProject.targets.find((target) => {
      const frame = getDocumentTargetFrame(target);
      return frame.widthPx === safeWidthPx && frame.heightPx === safeHeightPx;
    }) ?? null;
  }

  function syncDocumentProjectToCurrentOutputProfile(): OverlayDocumentFormat {
    const existingTarget = getDocumentTargetByProfileKey(state.outputProfileKey);
    if (existingTarget) {
      if (state.documentProject.activeTargetId !== existingTarget.id) {
        state.documentProject = {
          ...state.documentProject,
          activeTargetId: existingTarget.id
        };
      }

      return existingTarget;
    }

    const nextTarget = createDocumentTarget(state.outputProfileKey);
    state.documentProject = {
      ...state.documentProject,
      activeTargetId: nextTarget.id,
      targets: [...state.documentProject.targets, nextTarget]
    };
    return nextTarget;
  }

  function getUnusedDocumentTargetProfileKeys(currentProfileKey?: string): string[] {
    return OUTPUT_PROFILE_ORDER.filter((profileKey) => (
      profileKey === currentProfileKey || !state.documentProject.targets.some((target) => target.outputProfileKey === profileKey)
    ));
  }

  function persistActiveDocumentTargetRuntimeState(): void {
    deps.persistActiveDocumentFormatRuntimeState();
  }

  function pruneDocumentTargetRuntimeState(targetId: string): void {
    delete state.documentFormatBuckets[targetId];
    delete state.contentFormatKeyByDocumentFormatId[targetId];
    delete state.exportSettingsByDocumentFormatId[targetId];
    delete state.haloConfigByDocumentFormatId[targetId];
  }

  function setActiveDocumentTarget(targetId: string): void {
    const rawTarget = getDocumentTargetById(targetId);
    const nextTarget = rawTarget ? normalizeDerivedFromFormatId(rawTarget) : null;
    if (!nextTarget) {
      return;
    }

    if (nextTarget.derivedFromFormatId !== rawTarget?.derivedFromFormatId) {
      state.documentProject = {
        ...state.documentProject,
        targets: state.documentProject.targets.map((target) => (
          target.id === nextTarget.id
            ? nextTarget
            : target
        ))
      };
    }

      if (nextTarget.id === state.documentProject.activeTargetId && nextTarget.outputProfileKey === state.outputProfileKey) {
        return;
      }

      persistActiveDocumentTargetRuntimeState();

    state.documentProject = {
      ...state.documentProject,
      activeTargetId: nextTarget.id
    };

      deps.switchOutputProfile(nextTarget.outputProfileKey, { persistCurrentState: false });
  }

  function resolveDocumentTargetProfileKey(widthPx: number, heightPx: number): string {
    return findBuiltInOutputProfileKeyByDimensions(widthPx, heightPx)
      ?? createCustomOutputProfileKey(widthPx, heightPx);
  }

  function addDocumentTarget(profileKey?: string): boolean {
    const nextProfileKey = profileKey ?? getUnusedDocumentTargetProfileKeys()[0];
    if (!nextProfileKey) {
      return false;
    }

    const existingTarget = getDocumentTargetByProfileKey(nextProfileKey);
    if (!existingTarget) {
      const nextTarget = createDocumentTarget(nextProfileKey, undefined, {
        derivedFromFormatId: state.documentProject.activeTargetId || null
      });
      state.documentProject = {
        ...state.documentProject,
        targets: [...state.documentProject.targets, nextTarget]
      };
      setActiveDocumentTarget(nextTarget.id);
      setStatus(`Added ${nextTarget.label} from the preset library and made it active.`, "success");
      return true;
    }

    setActiveDocumentTarget(existingTarget.id);
    setStatus(`Switched to ${existingTarget.label}.`, "neutral");
    return true;
  }

  function addDocumentTargetFromDraft(): boolean {
    const widthPx = Number.parseInt(pendingDraft.width.trim(), 10);
    const heightPx = Number.parseInt(pendingDraft.height.trim(), 10);

    if (!Number.isFinite(widthPx) || widthPx <= 0) {
      setStatus("Enter a width greater than 0.", "error");
      return false;
    }

    if (!Number.isFinite(heightPx) || heightPx <= 0) {
      setStatus("Enter a height greater than 0.", "error");
      return false;
    }

    const safeWidthPx = Math.max(1, Math.round(widthPx));
    const safeHeightPx = Math.max(1, Math.round(heightPx));
    const nextProfileKey = resolveDocumentTargetProfileKey(safeWidthPx, safeHeightPx);
    const existingTarget = getDocumentTargetByProfileKey(nextProfileKey)
      ?? getDocumentTargetByDimensions(safeWidthPx, safeHeightPx);

    if (existingTarget) {
      const existingFrame = getDocumentTargetFrame(existingTarget);
      setStatus(
        `${existingTarget.label} already covers ${existingFrame.widthPx}×${existingFrame.heightPx}.`,
        "error"
      );
      return false;
    }

    const nextTarget = createDocumentTarget(nextProfileKey, pendingDraft.label, {
      derivedFromFormatId: state.documentProject.activeTargetId || null
    });
    state.documentProject = {
      ...state.documentProject,
      targets: [...state.documentProject.targets, nextTarget]
    };
    setActiveDocumentTarget(nextTarget.id);

    pendingDraft = {
      label: "",
      width: "",
      height: ""
    };
    setStatus(`Added ${nextTarget.label} from the current format and made it active.`, "success");
    return true;
  }

  function updateActiveDocumentTargetLabel(rawLabel: string): void {
    const activeTarget = getDocumentTargetById();
    if (!activeTarget) {
      return;
    }

    const nextLabel = rawLabel.trim() || getDefaultDocumentTargetLabel(activeTarget.outputProfileKey);
    if (nextLabel === activeTarget.label) {
      return;
    }

    state.documentProject = {
      ...state.documentProject,
      targets: state.documentProject.targets.map((target) => (
        target.id === activeTarget.id
          ? { ...target, label: nextLabel }
          : target
      ))
    };
  }

  function updateActiveDocumentTargetProfile(nextProfileKey: string): void {
    const activeTarget = getDocumentTargetById();
    if (!activeTarget || activeTarget.outputProfileKey === nextProfileKey) {
      return;
    }

    const existingTarget = getDocumentTargetByProfileKey(nextProfileKey);
    if (existingTarget && existingTarget.id !== activeTarget.id) {
      setActiveDocumentTarget(existingTarget.id);
      return;
    }

    const oldProfileKey = activeTarget.outputProfileKey;
    const shouldResetLabel = activeTarget.label.trim() === getDefaultDocumentTargetLabel(oldProfileKey);

    const nextLabel = shouldResetLabel ? getDefaultDocumentTargetLabel(nextProfileKey) : activeTarget.label;

    state.documentProject = {
      ...state.documentProject,
      targets: state.documentProject.targets.map((target) => (
        target.id === activeTarget.id
          ? {
            ...target,
            outputProfileKey: nextProfileKey,
            formatPresetKey: getDefaultDocumentFormatPresetKey(nextProfileKey),
            label: nextLabel
          }
          : target
      ))
    };

    deps.switchOutputProfile(nextProfileKey);
    setStatus(`Updated ${nextLabel} to ${getOutputProfile(nextProfileKey).widthPx}×${getOutputProfile(nextProfileKey).heightPx}.`, "success");
  }

  function removeDocumentTarget(targetId: string): RemoveDocumentTargetResult {
    const target = getDocumentTargetById(targetId);
    if (!target || state.documentProject.targets.length <= 1) {
      setStatus("A document needs at least one format.", "error");
      return { removed: false, activeChanged: false };
    }

    const activeIndex = state.documentProject.targets.findIndex((candidate) => candidate.id === target.id);
    const remainingTargets = state.documentProject.targets
      .filter((candidate) => candidate.id !== target.id)
      .map((candidate) => (
        candidate.derivedFromFormatId === target.id
          ? { ...candidate, derivedFromFormatId: null }
          : candidate
      ));
    const removedActiveTarget = target.id === state.documentProject.activeTargetId;

    if (!removedActiveTarget) {
      state.documentProject = {
        ...state.documentProject,
        targets: remainingTargets
      };
      pruneDocumentTargetRuntimeState(target.id);
      setStatus(`Removed ${target.label}.`, "success");
      return { removed: true, activeChanged: false };
    }

    const fallbackTarget = remainingTargets[Math.min(activeIndex, remainingTargets.length - 1)] ?? remainingTargets[0];
    if (!fallbackTarget) {
      setStatus("Could not choose a fallback format.", "error");
      return { removed: false, activeChanged: false };
    }

    persistActiveDocumentTargetRuntimeState();

    state.documentProject = {
      ...state.documentProject,
      activeTargetId: fallbackTarget.id,
      targets: remainingTargets
    };

    deps.switchOutputProfile(fallbackTarget.outputProfileKey, { persistCurrentState: false });
    pruneDocumentTargetRuntimeState(target.id);
    setStatus(`Removed ${target.label}.`, "success");
    return { removed: true, activeChanged: true };
  }

  function removeActiveDocumentTarget(): boolean {
    return removeDocumentTarget(state.documentProject.activeTargetId).removed;
  }

  function createDraftInput(
    type: "text" | "number",
    value: string,
    placeholder: string,
    onInput: (nextValue: string) => void,
    onSubmit: () => void
  ): HTMLInputElement {
    const input = document.createElement("input");
    input.type = type;
    input.className = "bf-input is-dense";
    input.value = value;
    input.placeholder = placeholder;

    if (type === "number") {
      input.min = "1";
      input.step = "1";
      input.inputMode = "numeric";
    }

    input.addEventListener("input", () => {
      onInput(input.value);
      if (statusTone === "error") {
        clearStatus();
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      onSubmit();
    });

    return input;
  }

  function buildFormatOptions(): void {
    const container = deps.getFormatOptions();
    if (!container) {
      return;
    }

    const activeTarget = syncDocumentProjectToCurrentOutputProfile();
    const activeFrame = getDocumentTargetFrame(activeTarget);
    container.innerHTML = "";

    const help = document.createElement("p");
    help.className = "bf-form-help bf-u-no-margin--bottom";
    help.textContent = "Choose the active format, add preset or custom dimensions, or remove formats you no longer need. Preset adds keep the preset safe-area and grid seed while carrying the current format as a first guess; custom sizes derive directly from the current format. Use Preset Library for the global seed definitions, then save the file to persist document-owned overrides.";
    container.append(help);

    const status = document.createElement("p");
    status.className = "bf-form-help bf-u-no-margin--bottom";
    status.textContent = statusMessage || `${state.documentProject.targets.length} saved format${state.documentProject.targets.length === 1 ? "" : "s"}.`;
    status.style.color = statusTone === "success"
      ? "#9ad47d"
      : statusTone === "error"
        ? "#ff8f8f"
        : "";
    container.append(status);

    const table = document.createElement("table");
    table.className = "bf-table";
    table.setAttribute("data-formats-table", "");
    table.setAttribute("aria-label", "Document formats");

    const thead = document.createElement("thead");
    const headingRow = document.createElement("tr");
    headingRow.append(
      createCell("th", "Active"),
      createCell("th", "Format"),
      createCell("th", "Width"),
      createCell("th", "Height"),
      createCell("th", "")
    );
    thead.append(headingRow);
    table.append(thead);

    const tbody = document.createElement("tbody");
    for (const target of state.documentProject.targets) {
      const frame = getDocumentTargetFrame(target);
      const row = document.createElement("tr");
      if (target.id === activeTarget.id) {
        row.setAttribute("data-active-document-format", "true");
      }

      const activeCell = createCell("td");
      activeCell.className = "is-radio-cell";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "document-setup-format";
      radio.value = target.id;
      radio.checked = target.id === activeTarget.id;
      radio.setAttribute("aria-label", `Activate format ${target.label}`);
      radio.addEventListener("change", () => {
        clearStatus();
        setActiveDocumentTarget(target.id);
        deps.markDocumentDirty();
        deps.buildConfigEditor();
        buildFormatOptions();
      });
      activeCell.append(radio);

      const titleCell = createCell("td");
      const titleLabel = document.createElement("div");
      titleLabel.textContent = target.label;
      titleCell.append(titleLabel);

      const formatSummary = getDocumentFormatSourceSummary(target);
      if (formatSummary) {
        const titleMeta = document.createElement("div");
        titleMeta.className = "bf-form-help bf-u-no-margin--bottom";
        titleMeta.textContent = formatSummary;
        titleCell.title = formatSummary;
        titleCell.append(titleMeta);
      }
      const widthCell = createCell("td", String(frame.widthPx));
      const heightCell = createCell("td", String(frame.heightPx));

      const actionCell = createCell("td");
      actionCell.className = "is-action-cell";
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "bf-button is-base is-dense";
      removeButton.textContent = "×";
      removeButton.disabled = state.documentProject.targets.length <= 1;
      removeButton.setAttribute("data-remove-format-button", "");
      removeButton.setAttribute("aria-label", `Remove format ${target.label}`);
      removeButton.addEventListener("click", () => {
        const result = removeDocumentTarget(target.id);
        if (!result.removed) {
          buildFormatOptions();
          return;
        }

        deps.markDocumentDirty();
        if (result.activeChanged) {
          deps.buildConfigEditor();
        }
        buildFormatOptions();
      });
      actionCell.append(removeButton);

      row.append(activeCell, titleCell, widthCell, heightCell, actionCell);
      tbody.append(row);
    }
    table.append(tbody);

    const tfoot = document.createElement("tfoot");

    const availablePresetProfileKeys = getUnusedDocumentTargetProfileKeys();
    if (!availablePresetProfileKeys.includes(pendingPresetProfileKey)) {
      pendingPresetProfileKey = availablePresetProfileKeys[0] ?? "";
    }

    const presetRow = document.createElement("tr");
    presetRow.setAttribute("data-formats-preset-row", "");

    const presetLeadCell = createCell("td", "+");
    presetLeadCell.className = "is-radio-cell";

    const presetSelectCell = createCell("td");
    const presetSelect = document.createElement("select");
    presetSelect.className = "bf-input is-dense";

    const presetWidthCell = createCell("td");
    const presetHeightCell = createCell("td");
    const syncPresetSummary = (): void => {
      if (!pendingPresetProfileKey) {
        presetWidthCell.textContent = "-";
        presetHeightCell.textContent = "-";
        return;
      }

      const profile = getOutputProfile(pendingPresetProfileKey);
      presetWidthCell.textContent = String(profile.widthPx);
      presetHeightCell.textContent = String(profile.heightPx);
    };

    if (availablePresetProfileKeys.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "All built-in presets already added";
      presetSelect.append(option);
      presetSelect.disabled = true;
    } else {
      for (const profileKey of availablePresetProfileKeys) {
        const profile = getOutputProfile(profileKey);
        const option = document.createElement("option");
        option.value = profileKey;
        option.textContent = `${profile.label} (${profile.widthPx}x${profile.heightPx})`;
        option.selected = profileKey === pendingPresetProfileKey;
        presetSelect.append(option);
      }

      presetSelect.addEventListener("change", () => {
        pendingPresetProfileKey = presetSelect.value;
        clearStatus();
        syncPresetSummary();
      });
    }

    syncPresetSummary();
    presetSelectCell.append(presetSelect);

    const presetActionCell = createCell("td");
    presetActionCell.className = "is-action-cell";
    const addPresetButton = document.createElement("button");
    addPresetButton.type = "button";
    addPresetButton.className = "bf-button is-base is-dense";
    addPresetButton.textContent = "Add Preset";
    addPresetButton.disabled = availablePresetProfileKeys.length === 0;
    addPresetButton.addEventListener("click", () => {
      if (!pendingPresetProfileKey || !addDocumentTarget(pendingPresetProfileKey)) {
        buildFormatOptions();
        return;
      }

      deps.markDocumentDirty();
      deps.buildConfigEditor();
      buildFormatOptions();
    });
    presetActionCell.append(addPresetButton);

    presetRow.append(presetLeadCell, presetSelectCell, presetWidthCell, presetHeightCell, presetActionCell);
    tfoot.append(presetRow);

    const addRow = document.createElement("tr");
    addRow.setAttribute("data-formats-add-row", "");

    const addLeadCell = createCell("td", "+");
    addLeadCell.className = "is-radio-cell";

    const submitDraft = (): void => {
      if (!addDocumentTargetFromDraft()) {
        buildFormatOptions();
        return;
      }

      deps.markDocumentDirty();
      deps.buildConfigEditor();
      buildFormatOptions();
    };

    const titleInput = createDraftInput(
      "text",
      pendingDraft.label,
      "Format name",
      (nextValue) => {
        pendingDraft = { ...pendingDraft, label: nextValue };
      },
      submitDraft
    );

    const widthInput = createDraftInput(
      "number",
      pendingDraft.width,
      String(activeFrame.widthPx),
      (nextValue) => {
        pendingDraft = { ...pendingDraft, width: nextValue };
      },
      submitDraft
    );

    const heightInput = createDraftInput(
      "number",
      pendingDraft.height,
      String(activeFrame.heightPx),
      (nextValue) => {
        pendingDraft = { ...pendingDraft, height: nextValue };
      },
      submitDraft
    );

    const titleInputCell = createCell("td");
    titleInputCell.append(titleInput);
    const widthInputCell = createCell("td");
    widthInputCell.append(widthInput);
    const heightInputCell = createCell("td");
    heightInputCell.append(heightInput);

    const addActionCell = createCell("td");
    addActionCell.className = "is-action-cell";
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "bf-button is-dense";
    addButton.textContent = "Add Format";
    addButton.setAttribute("data-add-format-button", "");
    addButton.addEventListener("click", submitDraft);
    addActionCell.append(addButton);

    addRow.append(addLeadCell, titleInputCell, widthInputCell, heightInputCell, addActionCell);
    tfoot.append(addRow);
    table.append(tfoot);

    container.append(table);
  }

  return {
    getDefaultDocumentFormatLabel: getDefaultDocumentTargetLabel,
    syncDocumentProjectToCurrentOutputProfile,
    getUnusedDocumentFormatProfileKeys: getUnusedDocumentTargetProfileKeys,
    setActiveDocumentFormat: setActiveDocumentTarget,
    addDocumentFormat: addDocumentTarget,
    updateActiveDocumentFormatLabel: updateActiveDocumentTargetLabel,
    updateActiveDocumentFormatProfile: updateActiveDocumentTargetProfile,
    removeActiveDocumentFormat: removeActiveDocumentTarget,
    buildFormatOptions
  };
}