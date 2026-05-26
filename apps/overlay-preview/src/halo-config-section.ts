/**
 * halo-config-section.ts — Halo Field accordion section builder.
 *
 * Schema-driven: the panel is generated from HALO_FIELD_CONFIG_SCHEMA
 * rather than hardcoded DOM builders.
 */

import type { PreviewAppContext } from "./preview-app-context.js";
import { getOutputProfileMetrics } from "@design-foundry/core-types";
import {
  HALO_FIELD_CONFIG_SCHEMA,
  HALO_FIELD_PRESET_DEFINITIONS,
  getHaloConfigForProfile,
  type HaloFieldConfig
} from "@design-foundry/operator-halo-field";
import { buildAccordionSectionEl, renderSchemaPanel, setupAccordion } from "@design-foundry/parameter-ui";

/**
 * Set a value at a dotted path on the halo config, returning a new config.
 * Intermediate objects are shallow-cloned.
 */
function setNestedValue(config: HaloFieldConfig, path: string, value: unknown): HaloFieldConfig {
  const keys = path.split(".");
  const rec = config as unknown as Record<string, unknown>;
  if (keys.length === 1) {
    return { ...rec, [keys[0]]: value } as unknown as HaloFieldConfig;
  }
  const [head, ...rest] = keys;
  const child = rec[head];
  const childObj = (child != null && typeof child === "object") ? child as Record<string, unknown> : {};
  const updated = setNestedValue(childObj as unknown as HaloFieldConfig, rest.join("."), value);
  return { ...rec, [head]: updated } as unknown as HaloFieldConfig;
}

export function buildHaloConfigSection(ctx: PreviewAppContext): HTMLElement {
  const { state } = ctx;

  if (state.documentProject.sceneFamilyKey !== "halo") {
    const { root, body } = buildAccordionSectionEl(`${ctx.getSceneFamilyLabel(state.documentProject.sceneFamilyKey)} Preview`);
    const helpText = document.createElement("p");
    helpText.className = "bf-form-help bf-u-no-margin--bottom";
    helpText.textContent = `You are editing the Halo node while Rendered Output is set to ${ctx.getSceneFamilyLabel(state.documentProject.sceneFamilyKey)}. These settings are still saved; switch Rendered Output to Halo to preview them live.`;
    body.append(helpText);
    return root;
  }

  const container = document.createElement("div");
  const presetField = document.createElement("div");
  presetField.className = "bf-field";

  const presetLabel = document.createElement("label");
  presetLabel.className = "bf-form-label";
  presetLabel.htmlFor = "halo-preset-select";
  presetLabel.textContent = "Halo Preset";

  const presetControl = document.createElement("div");
  presetControl.className = "bf-control";

  const presetSelect = document.createElement("select");
  presetSelect.id = "halo-preset-select";
  presetSelect.className = "bf-input is-dense";
  presetSelect.setAttribute("data-halo-preset-select", "");

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = "Choose a Halo preset...";

  const presetApplyButton = document.createElement("button");
  presetApplyButton.type = "button";
  presetApplyButton.className = "bf-button is-base is-dense";
  presetApplyButton.textContent = "Apply Preset";
  presetApplyButton.disabled = true;
  presetApplyButton.setAttribute("data-halo-preset-apply", "");

  const presetHelp = document.createElement("p");
  presetHelp.className = "bf-form-help bf-u-no-margin--bottom";

  const presetSaveField = document.createElement("div");
  presetSaveField.className = "bf-field";

  const presetSaveLabel = document.createElement("label");
  presetSaveLabel.className = "bf-form-label";
  presetSaveLabel.htmlFor = "halo-preset-save-name";
  presetSaveLabel.textContent = "Save Current as Preset";

  const presetSaveControl = document.createElement("div");
  presetSaveControl.className = "bf-control";

  const presetSaveNameInput = document.createElement("input");
  presetSaveNameInput.id = "halo-preset-save-name";
  presetSaveNameInput.type = "text";
  presetSaveNameInput.className = "bf-input is-dense";
  presetSaveNameInput.placeholder = "Preset name";
  presetSaveNameInput.setAttribute("data-halo-preset-save-name", "");

  const presetSaveButton = document.createElement("button");
  presetSaveButton.type = "button";
  presetSaveButton.className = "bf-button is-base is-dense";
  presetSaveButton.textContent = "Save Preset";
  presetSaveButton.disabled = true;
  presetSaveButton.setAttribute("data-halo-preset-save", "");

  const presetStatus = document.createElement("p");
  presetStatus.className = "bf-form-help bf-u-no-margin--bottom";

  let pendingPresetKey = "";

  function setPresetStatus(message: string, tone: "neutral" | "success" | "error" = "neutral"): void {
    presetStatus.textContent = message;
    presetStatus.style.color = tone === "success"
      ? "#0e8420"
      : tone === "error"
      ? "#c7162b"
      : "";
  }

  function getSavedPresetDefinitions() {
    return ctx.getUserHaloPresetDefinitions();
  }

  function findPresetDefinition(presetKey: string) {
    return [...HALO_FIELD_PRESET_DEFINITIONS, ...getSavedPresetDefinitions()].find((entry) => entry.key === presetKey) ?? null;
  }

  function populatePresetOptions(preferredKey = ""): void {
    presetSelect.replaceChildren();
    presetSelect.append(placeholderOption.cloneNode(true));

    const formatSeedOption = document.createElement("option");
    formatSeedOption.value = "__format-seed__";
    formatSeedOption.textContent = "Current Format Seed";
    presetSelect.append(formatSeedOption);

    if (HALO_FIELD_PRESET_DEFINITIONS.length > 0) {
      const builtInGroup = document.createElement("optgroup");
      builtInGroup.label = "Built-in";
      for (const preset of HALO_FIELD_PRESET_DEFINITIONS) {
        const option = document.createElement("option");
        option.value = preset.key;
        option.textContent = preset.label;
        builtInGroup.append(option);
      }
      presetSelect.append(builtInGroup);
    }

    const savedPresets = getSavedPresetDefinitions();
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
      presetHelp.textContent = "Presets are copy-on-apply seeds. Applying one replaces Halo behavior from a known-good preset while keeping this document's current composition adjustments local to the file.";
      return;
    }

    if (pendingPresetKey === "__format-seed__") {
      presetHelp.textContent = "Reset non-composition Halo behavior to the current format seed while keeping this document's current composition tweaks.";
      return;
    }

    const preset = findPresetDefinition(pendingPresetKey);
    presetHelp.textContent = preset?.description
      ?? "Apply the selected Halo preset as a copy-on-apply seed for this document.";
  }

  presetSelect.addEventListener("change", () => {
    pendingPresetKey = presetSelect.value;
    syncPresetUi();
  });

  presetApplyButton.addEventListener("click", () => {
    if (pendingPresetKey.length === 0) {
      return;
    }

    const preservedComposition = { ...state.haloConfig.composition };
    const preset = pendingPresetKey === "__format-seed__"
      ? null
      : findPresetDefinition(pendingPresetKey);
    const nextConfig = getHaloConfigForProfile(state.outputProfileKey, {
      ...(preset?.config ?? {}),
      composition: preservedComposition
    });

    state.haloConfig = nextConfig;
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
      setPresetStatus("Saving Halo preset...");

      try {
        const result = await ctx.saveCurrentHaloPreset(presetName);
        presetSaveNameInput.value = "";
        presetSaveNameInput.disabled = false;
        populatePresetOptions(result.preset.key);
        syncPresetSaveUi();
        setPresetStatus(result.message, "success");
      } catch (error) {
        presetSaveNameInput.disabled = false;
        syncPresetSaveUi();
        setPresetStatus(error instanceof Error ? error.message : "Failed to save Halo preset.", "error");
      }
    })();
  });

  populatePresetOptions();
  syncPresetSaveUi();
  setPresetStatus("Save a preset only when you want reuse across documents. Ordinary Halo tweaks still persist with the current file by default.");
  presetControl.append(presetSelect, presetApplyButton);
  presetField.append(presetLabel, presetControl, presetHelp);
  presetSaveControl.append(presetSaveNameInput, presetSaveButton);
  presetSaveField.append(presetSaveLabel, presetSaveControl, presetStatus);

  const nestedAccordion = document.createElement("aside");
  nestedAccordion.className = "bf-accordion";

  const nestedList = document.createElement("ul");
  nestedList.className = "bf-accordion-list";

  const result = renderSchemaPanel(
    HALO_FIELD_CONFIG_SCHEMA,
    state.haloConfig,
    (path, value) => {
      let nextConfig = setNestedValue(state.haloConfig, path, value);

      // Special: center_offset_y_px drives center_y_px via profile metrics
      if (path === "composition.center_offset_y_px") {
        const metrics = getOutputProfileMetrics(state.outputProfileKey);
        nextConfig = {
          ...nextConfig,
          composition: {
            ...nextConfig.composition,
            center_y_px: metrics.centerYPx + Number(value)
          }
        };
      }

      state.haloConfig = nextConfig;
      ctx.markDocumentDirty();
      void ctx.renderStage();
    }
  );

  for (const section of result.sections) {
    nestedList.append(section.root);
  }

  nestedAccordion.append(nestedList);
  container.append(presetField, presetSaveField, nestedAccordion);
  setupAccordion(nestedAccordion);

  return container;
}
