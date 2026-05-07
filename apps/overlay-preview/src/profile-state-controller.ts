import { OVERLAY_CONTENT_FORMAT_ORDER } from "@brand-layout-ops/core-types";
import type { HaloFieldConfig } from "@brand-layout-ops/operator-halo-field";
import {
  createDefaultOverlayParams,
  seedOverlayFormatVariantParams,
  syncOverlayParamsFrameToProfile,
  syncOverlaySharedProfileParams,
  type OverlayDocumentFormat,
  type OverlayLayoutOperatorParams
} from "@brand-layout-ops/operator-overlay-layout";

import type { PreviewState, SwitchOutputProfileOptions } from "./preview-app-context.js";
import { cloneOverlayParams, type ExportSettings } from "./sample-document.js";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface ProfileStateControllerOptions {
  readonly state: PreviewState;
  createDefaultExportSettings(profileKey: string): ExportSettings;
  getHaloConfigForProfile(profileKey: string): HaloFieldConfig;
  normalizeParamsTextFieldOffsets(params: OverlayLayoutOperatorParams): OverlayLayoutOperatorParams;
  getEffectiveParams(): OverlayLayoutOperatorParams;
  normalizeSelection(): void;
  resizeRenderer(): void;
  renderStage(): void | Promise<void>;
  syncDocumentProjectToCurrentOutputProfile(): void;
  saveOutputFormatKey(profileKey: string, formatKey: string): void;
}

export interface ProfileStateController {
  getDocumentFormatBucket(formatId: string): Record<string, OverlayLayoutOperatorParams>;
  persistActiveDocumentFormatRuntimeState(): void;
  persistActiveExportSettings(): void;
  persistActiveHaloConfig(): void;
  updateExportSettings(updater: (settings: ExportSettings) => ExportSettings): void;
  persistActiveDocumentFormatBuckets(): void;
  getOrCreateDocumentFormatParams(formatId: string, formatKey: string): OverlayLayoutOperatorParams;
  syncHaloConfigForActiveDocumentFormat(): void;
  switchOutputProfile(profileKey: string, options?: SwitchOutputProfileOptions): void;
  switchContentFormat(formatKey: string): void;
}

export function createProfileStateController(
  options: ProfileStateControllerOptions
): ProfileStateController {
  const { state } = options;

  function getDocumentFormatById(formatId: string | null | undefined): OverlayDocumentFormat | null {
    if (!formatId) {
      return null;
    }

    return state.documentProject.targets.find((target) => target.id === formatId) ?? null;
  }

  function getDocumentFormatByProfileKey(profileKey: string): OverlayDocumentFormat | null {
    return state.documentProject.targets.find((target) => target.outputProfileKey === profileKey) ?? null;
  }

  function getActiveDocumentFormat(): OverlayDocumentFormat | null {
    const activeFormat = getDocumentFormatById(state.documentProject.activeTargetId)
      ?? getDocumentFormatByProfileKey(state.outputProfileKey)
      ?? state.documentProject.targets[0]
      ?? null;

    if (activeFormat && state.documentProject.activeTargetId !== activeFormat.id) {
      state.documentProject = {
        ...state.documentProject,
        activeTargetId: activeFormat.id
      };
    }

    return activeFormat;
  }

  function getDocumentFormatBucket(formatId: string): Record<string, OverlayLayoutOperatorParams> {
    if (!state.documentFormatBuckets[formatId]) {
      state.documentFormatBuckets[formatId] = {};
    }

    return state.documentFormatBuckets[formatId];
  }

  function getActiveContentFormatKeyForDocumentFormat(formatId: string): string {
    const bucket = getDocumentFormatBucket(formatId);
    const mappedFormatKey = state.contentFormatKeyByDocumentFormatId[formatId];
    if (mappedFormatKey) {
      return mappedFormatKey;
    }

    const firstBucketKey = Object.keys(bucket)[0];
    const fallbackFormatKey = firstBucketKey || state.contentFormatKey || OVERLAY_CONTENT_FORMAT_ORDER[0];
    state.contentFormatKeyByDocumentFormatId[formatId] = fallbackFormatKey;
    return fallbackFormatKey;
  }

  function getOrCreateExportSettingsForDocumentFormat(formatId: string): ExportSettings {
    const documentFormat = getDocumentFormatById(formatId) ?? getActiveDocumentFormat();
    const profileKey = documentFormat?.outputProfileKey ?? state.outputProfileKey;
    if (!state.exportSettingsByDocumentFormatId[formatId]) {
      state.exportSettingsByDocumentFormatId[formatId] = options.createDefaultExportSettings(profileKey);
    }

    return cloneJson(state.exportSettingsByDocumentFormatId[formatId]);
  }

  function getOrCreateHaloConfigForDocumentFormat(formatId: string): HaloFieldConfig {
    const documentFormat = getDocumentFormatById(formatId) ?? getActiveDocumentFormat();
    const profileKey = documentFormat?.outputProfileKey ?? state.outputProfileKey;
    if (!state.haloConfigByDocumentFormatId[formatId]) {
      state.haloConfigByDocumentFormatId[formatId] = options.getHaloConfigForProfile(profileKey);
    }

    return cloneJson(state.haloConfigByDocumentFormatId[formatId]);
  }

  function persistActiveExportSettings(): void {
    const activeFormat = getActiveDocumentFormat();
    if (!activeFormat) {
      return;
    }

    state.exportSettingsByDocumentFormatId[activeFormat.id] = cloneJson(state.exportSettings);
  }

  function persistActiveHaloConfig(): void {
    const activeFormat = getActiveDocumentFormat();
    if (!activeFormat) {
      return;
    }

    state.haloConfigByDocumentFormatId[activeFormat.id] = cloneJson(state.haloConfig);
  }

  function persistActiveDocumentFormatRuntimeState(): void {
    persistActiveDocumentFormatBuckets();
    persistActiveExportSettings();
    persistActiveHaloConfig();
  }

  function updateExportSettings(updater: (settings: ExportSettings) => ExportSettings): void {
    state.exportSettings = updater(state.exportSettings);
    persistActiveExportSettings();
  }

  function persistActiveDocumentFormatBuckets(): void {
    const activeFormat = getActiveDocumentFormat();
    if (!activeFormat) {
      return;
    }

    const activeParams = cloneOverlayParams(state.params);
    const documentFormatBucket = getDocumentFormatBucket(activeFormat.id);
    const formatKeys = new Set<string>([
      ...OVERLAY_CONTENT_FORMAT_ORDER,
      ...Object.keys(documentFormatBucket),
      state.contentFormatKey
    ]);

    for (const formatKey of formatKeys) {
      const existing = documentFormatBucket[formatKey] ?? cloneOverlayParams(syncOverlayParamsFrameToProfile(
        state.params,
        activeFormat.outputProfileKey
      ));
      documentFormatBucket[formatKey] = formatKey === state.contentFormatKey
        ? cloneOverlayParams(activeParams)
        : syncOverlaySharedProfileParams(activeParams, existing, activeFormat.outputProfileKey);
    }

    state.contentFormatKeyByDocumentFormatId[activeFormat.id] = state.contentFormatKey;
  }

  function getOrCreateDocumentFormatParams(
    formatId: string,
    formatKey: string
  ): OverlayLayoutOperatorParams {
    const documentFormat = getDocumentFormatById(formatId) ?? getActiveDocumentFormat();
    const profileKey = documentFormat?.outputProfileKey ?? state.outputProfileKey;
    const documentFormatBucket = getDocumentFormatBucket(formatId);
    const existing = documentFormatBucket[formatKey];
    if (existing) {
      return syncOverlayParamsFrameToProfile(existing, profileKey);
    }

    const targetFormat = documentFormat;
    const targetSeed = createDefaultOverlayParams(profileKey, formatKey);
    const sourceFormat = getDocumentFormatById(targetFormat?.derivedFromFormatId);

    if (!sourceFormat) {
      documentFormatBucket[formatKey] = cloneOverlayParams(targetSeed);
      return targetSeed;
    }

    const sourceParams = state.documentFormatBuckets[sourceFormat.id]?.[formatKey]
      ? cloneOverlayParams(state.documentFormatBuckets[sourceFormat.id][formatKey])
      : createDefaultOverlayParams(sourceFormat.outputProfileKey, formatKey);

    const nextParams = seedOverlayFormatVariantParams(sourceParams, targetSeed, profileKey, {
      preserveTargetSafeArea: Boolean(targetFormat?.formatPresetKey),
      preserveTargetGrid: Boolean(targetFormat?.formatPresetKey)
    });

    documentFormatBucket[formatKey] = cloneOverlayParams(nextParams);
    return nextParams;
  }

  function syncHaloConfigForActiveDocumentFormat(): void {
    const activeFormat = getActiveDocumentFormat();
    if (!activeFormat) {
      return;
    }

    state.haloConfig = getOrCreateHaloConfigForDocumentFormat(activeFormat.id);
  }

  function switchOutputProfile(
    profileKey: string,
    switchOptions: SwitchOutputProfileOptions = {}
  ): void {
    if (switchOptions.persistCurrentState !== false) {
      persistActiveDocumentFormatRuntimeState();
    }

    const nextFormat = getDocumentFormatByProfileKey(profileKey)
      ?? getDocumentFormatById(state.documentProject.activeTargetId)
      ?? getActiveDocumentFormat();
    if (!nextFormat) {
      return;
    }

    if (state.documentProject.activeTargetId !== nextFormat.id) {
      state.documentProject = {
        ...state.documentProject,
        activeTargetId: nextFormat.id
      };
    }

    state.outputProfileKey = nextFormat.outputProfileKey;
    const nextContentFormatKey = getActiveContentFormatKeyForDocumentFormat(nextFormat.id);
    state.contentFormatKeyByDocumentFormatId[nextFormat.id] = nextContentFormatKey;
    state.contentFormatKey = nextContentFormatKey;
    state.params = options.normalizeParamsTextFieldOffsets(
      cloneOverlayParams(getOrCreateDocumentFormatParams(nextFormat.id, nextContentFormatKey))
    );
    state.exportSettings = getOrCreateExportSettingsForDocumentFormat(nextFormat.id);
    options.normalizeSelection();
    syncHaloConfigForActiveDocumentFormat();
    options.resizeRenderer();
    options.syncDocumentProjectToCurrentOutputProfile();
    options.saveOutputFormatKey(state.outputProfileKey, state.contentFormatKey);
    void options.renderStage();
  }

  function switchContentFormat(formatKey: string): void {
    const activeFormat = getActiveDocumentFormat();
    if (!activeFormat) {
      return;
    }

    if (formatKey === state.contentFormatKey) {
      return;
    }

    persistActiveDocumentFormatBuckets();
    const nextParams = syncOverlaySharedProfileParams(
      options.getEffectiveParams(),
      getOrCreateDocumentFormatParams(activeFormat.id, formatKey),
      activeFormat.outputProfileKey
    );

    getDocumentFormatBucket(activeFormat.id)[formatKey] = cloneOverlayParams(nextParams);
    state.contentFormatKey = formatKey;
    state.contentFormatKeyByDocumentFormatId[activeFormat.id] = formatKey;
    state.params = options.normalizeParamsTextFieldOffsets(cloneOverlayParams(nextParams));
    options.normalizeSelection();
    options.saveOutputFormatKey(state.outputProfileKey, state.contentFormatKey);
  }

  return {
    getDocumentFormatBucket,
    persistActiveDocumentFormatRuntimeState,
    persistActiveExportSettings,
    persistActiveHaloConfig,
    updateExportSettings,
    persistActiveDocumentFormatBuckets,
    getOrCreateDocumentFormatParams,
    syncHaloConfigForActiveDocumentFormat,
    switchOutputProfile,
    switchContentFormat
  };
}