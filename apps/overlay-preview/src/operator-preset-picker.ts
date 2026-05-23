/**
 * operator-preset-picker.ts — Shared preset picker UI for any operator section.
 *
 * Builds the select + apply + save controls that appear at the top of an
 * operator's accordion body. Copy-on-apply semantics: applying a preset
 * replaces non-composition operator behavior from a known-good seed while
 * keeping the current document's local tweaks.
 */

import type { OperatorPresetDefinition } from "@brand-layout-ops/core-types";
import type { PreviewAppContext } from "./preview-app-context.js";

export interface OperatorPresetPickerOptions {
  /** The operator key used for persistence (e.g. "fuzzy_boids", "scatter"). */
  operatorKey: string;
  /** Human-readable operator name for labels (e.g. "Fuzzy Boids"). */
  operatorLabel: string;
  /** Built-in preset definitions shipped with the operator. */
  builtInPresets: readonly OperatorPresetDefinition[];
  /** Return the current operator config as a saveable record. */
  getCurrentConfig: () => Record<string, unknown>;
  /** Apply a preset config override to the current operator state. */
  applyPresetConfig: (config: Record<string, unknown>) => void;
  /** Reset the operator to its format/profile seed. */
  resetToSeed: () => void;
}

export function buildOperatorPresetPicker(
  ctx: PreviewAppContext,
  options: OperatorPresetPickerOptions
): HTMLElement {
  const {
    operatorKey,
    operatorLabel,
    builtInPresets,
    getCurrentConfig,
    applyPresetConfig,
    resetToSeed
  } = options;

  const container = document.createElement("div");
  container.className = "bf-stack is-compact-stack";

  // --- Select + Apply row ---

  const presetField = document.createElement("div");
  presetField.className = "bf-field";

  const presetLabel = document.createElement("label");
  presetLabel.className = "bf-form-label";
  presetLabel.textContent = `${operatorLabel} Preset`;

  const presetControl = document.createElement("div");
  presetControl.className = "bf-control";

  const presetSelect = document.createElement("select");
  presetSelect.className = "bf-input is-dense";

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = `Choose a ${operatorLabel} preset...`;

  const presetApplyButton = document.createElement("button");
  presetApplyButton.type = "button";
  presetApplyButton.className = "bf-button is-base is-dense";
  presetApplyButton.textContent = "Apply Preset";
  presetApplyButton.disabled = true;

  const presetHelp = document.createElement("p");
  presetHelp.className = "bf-form-help bf-u-no-margin--bottom";

  // --- Save row ---

  const presetSaveField = document.createElement("div");
  presetSaveField.className = "bf-field";

  const presetSaveLabel = document.createElement("label");
  presetSaveLabel.className = "bf-form-label";
  presetSaveLabel.textContent = "Save Current as Preset";

  const presetSaveControl = document.createElement("div");
  presetSaveControl.className = "bf-control";

  const presetSaveNameInput = document.createElement("input");
  presetSaveNameInput.type = "text";
  presetSaveNameInput.className = "bf-input is-dense";
  presetSaveNameInput.placeholder = "Preset name";

  const presetSaveButton = document.createElement("button");
  presetSaveButton.type = "button";
  presetSaveButton.className = "bf-button is-base is-dense";
  presetSaveButton.textContent = "Save Preset";
  presetSaveButton.disabled = true;

  const presetStatus = document.createElement("p");
  presetStatus.className = "bf-form-help bf-u-no-margin--bottom";

  // --- State ---

  let pendingPresetKey = "";

  function setPresetStatus(message: string, tone: "neutral" | "success" | "error" = "neutral"): void {
    presetStatus.textContent = message;
    presetStatus.style.color = tone === "success"
      ? "#0e8420"
      : tone === "error"
      ? "#c7162b"
      : "";
  }

  function findPresetDefinition(presetKey: string): OperatorPresetDefinition | null {
    const savedPresets = ctx.getUserPresetDefinitions(operatorKey);
    return [...builtInPresets, ...savedPresets].find((entry) => entry.key === presetKey) ?? null;
  }

  function populatePresetOptions(preferredKey = ""): void {
    presetSelect.replaceChildren();
    presetSelect.append(placeholderOption.cloneNode(true));

    const formatSeedOption = document.createElement("option");
    formatSeedOption.value = "__format-seed__";
    formatSeedOption.textContent = "Current Format Seed";
    presetSelect.append(formatSeedOption);

    if (builtInPresets.length > 0) {
      const builtInGroup = document.createElement("optgroup");
      builtInGroup.label = "Built-in";
      for (const preset of builtInPresets) {
        const option = document.createElement("option");
        option.value = preset.key;
        option.textContent = preset.label;
        builtInGroup.append(option);
      }
      presetSelect.append(builtInGroup);
    }

    const savedPresets = ctx.getUserPresetDefinitions(operatorKey);
    if (savedPresets.length > 0) {
      const savedGroup = document.createElement("optgroup");
      savedGroup.label = "Saved";
      for (const preset of savedPresets) {
        const option = document.createElement("option");
        option.value = preset.key;
        option.textContent = preset.label;
        savedGroup.append(option);
      }
      presetSelect.append(savedGroup);
    }

    const nextSelectedKey = Array.from(presetSelect.options).some((option) => option.value === preferredKey)
      ? preferredKey
      : "";
    presetSelect.value = nextSelectedKey;
    pendingPresetKey = nextSelectedKey;
    syncPresetUi();
  }

  function syncPresetSaveUi(): void {
    const isBusy = presetSaveNameInput.disabled;
    presetSaveButton.disabled = isBusy || presetSaveNameInput.value.trim().length === 0;
  }

  function syncPresetUi(): void {
    presetApplyButton.disabled = pendingPresetKey.length === 0;

    if (pendingPresetKey.length === 0) {
      presetHelp.textContent = `Presets are copy-on-apply seeds. Applying one replaces ${operatorLabel} behavior from a known-good preset while keeping this document's current adjustments local to the file.`;
      return;
    }

    if (pendingPresetKey === "__format-seed__") {
      presetHelp.textContent = `Reset ${operatorLabel} to the current format seed.`;
      return;
    }

    const preset = findPresetDefinition(pendingPresetKey);
    presetHelp.textContent = preset?.description
      ?? `Apply the selected ${operatorLabel} preset as a copy-on-apply seed for this document.`;
  }

  // --- Event handlers ---

  presetSelect.addEventListener("change", () => {
    pendingPresetKey = presetSelect.value;
    syncPresetUi();
  });

  presetApplyButton.addEventListener("click", () => {
    if (pendingPresetKey.length === 0) {
      return;
    }

    if (pendingPresetKey === "__format-seed__") {
      resetToSeed();
    } else {
      const preset = findPresetDefinition(pendingPresetKey);
      if (preset) {
        applyPresetConfig(preset.config);
      }
    }

    ctx.markDocumentDirty();
    ctx.buildConfigEditor();
    void ctx.renderStage();
  });

  presetSaveNameInput.addEventListener("input", () => {
    syncPresetSaveUi();
  });

  presetSaveButton.addEventListener("click", () => {
    void (async () => {
      const presetName = presetSaveNameInput.value.trim();
      if (presetName.length === 0) {
        return;
      }

      presetSaveNameInput.disabled = true;
      syncPresetSaveUi();
      setPresetStatus(`Saving ${operatorLabel} preset...`);

      try {
        const config = getCurrentConfig();
        const result = await ctx.saveCurrentPreset(operatorKey, presetName, config);
        presetSaveNameInput.value = "";
        presetSaveNameInput.disabled = false;
        populatePresetOptions(result.preset.key);
        syncPresetSaveUi();
        setPresetStatus(result.message, "success");
      } catch (error) {
        presetSaveNameInput.disabled = false;
        syncPresetSaveUi();
        setPresetStatus(error instanceof Error ? error.message : `Failed to save ${operatorLabel} preset.`, "error");
      }
    })();
  });

  // --- Initial state ---

  populatePresetOptions();
  syncPresetSaveUi();
  setPresetStatus(`Save a preset only when you want reuse across documents. Ordinary ${operatorLabel} tweaks still persist with the current file by default.`);

  // --- Assembly ---

  presetControl.append(presetSelect, presetApplyButton);
  presetField.append(presetLabel, presetControl, presetHelp);
  presetSaveControl.append(presetSaveNameInput, presetSaveButton);
  presetSaveField.append(presetSaveLabel, presetSaveControl, presetStatus);
  container.append(presetField, presetSaveField);

  return container;
}
