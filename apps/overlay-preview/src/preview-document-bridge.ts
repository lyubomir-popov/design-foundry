import {
  cloneOverlayDocumentProject,
  cloneOverlaySourceDefaultSnapshot,
  normalizeOverlayDocumentProject,
  normalizeOverlayProfileBucketState,
  type OverlayDocumentFormat,
  type OverlayDocumentProject,
  type OverlayLayoutOperatorParams,
  type OverlaySourceDefaultSnapshot,
  type ProfileContentFormatMap,
  type ProfileFormatBuckets
} from "@brand-layout-ops/document-model";

import {
  createOverlayPreviewDocument,
  normalizeOverlayPreviewDocumentForPersistence,
  type OverlayPreviewDocument,
  type PersistedOverlayPreviewDocument
} from "./preview-document.js";
import {
  cloneOverlayParams,
  type ExportSettings
} from "./sample-document.js";
import { DEFAULT_CONTENT_FORMAT_KEY } from "./preview-app-context.js";

  function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  export function cloneExportSettingsByProfile(
    exportSettingsByProfile: Record<string, ExportSettings>
  ): Record<string, ExportSettings> {
    return cloneJson(exportSettingsByProfile);
  }

  export function cloneHaloConfigByProfile<THaloConfig extends object>(
    haloConfigByProfile: Record<string, THaloConfig>
  ): Record<string, THaloConfig> {
    return cloneJson(haloConfigByProfile);
  }

  export interface OverlayPreviewDocumentBridgeState<
    THaloConfig extends object,
    TGuideMode extends string = string,
    TSelection = unknown
  > {
    params: OverlayLayoutOperatorParams;
    selected: TSelection | null;
    guideMode: TGuideMode;
    overlayVisible: boolean;
    pendingCsvDraftsByBucket: Record<string, string>;
    outputProfileKey: string;
    documentFormatBuckets: Record<string, Record<string, OverlayLayoutOperatorParams>>;
    exportSettings: ExportSettings;
    exportSettingsByDocumentFormatId: Record<string, ExportSettings>;
    haloConfig: THaloConfig;
    haloConfigByDocumentFormatId: Record<string, THaloConfig>;
    sourceDefaults: OverlaySourceDefaultSnapshot<ExportSettings, THaloConfig, TGuideMode>;
    sourceDefaultProject: OverlayDocumentProject;
    documentProject: OverlayDocumentProject;
  }

  export interface OverlayPreviewDocumentBridgeAdapter<THaloConfig extends object> {
    persistActiveDocumentFormatRuntimeState(): void;
    getOrCreateDocumentFormatParams(formatId: string, formatKey: string): OverlayLayoutOperatorParams;
    normalizeParams(params: OverlayLayoutOperatorParams): OverlayLayoutOperatorParams;
    syncHaloConfigForActiveDocumentFormat(): void;
  }

  export interface BuildOverlayPreviewDocumentOptions {
    name: string;
    createdAt?: string;
    updatedAt?: string;
  }

  function getDocumentFormatById(
    project: OverlayDocumentProject,
    formatId: string | null | undefined
  ): OverlayDocumentFormat | null {
    if (!formatId) {
      return null;
    }

    return project.targets.find((target) => target.id === formatId) ?? null;
  }

  function getDocumentFormatByProfileKey(
    project: OverlayDocumentProject,
    profileKey: string
  ): OverlayDocumentFormat | null {
    return project.targets.find((target) => target.outputProfileKey === profileKey) ?? null;
  }

  function getActiveDocumentFormat(
    project: OverlayDocumentProject,
    outputProfileKey: string
  ): OverlayDocumentFormat | null {
    return getDocumentFormatById(project, project.activeTargetId)
      ?? getDocumentFormatByProfileKey(project, outputProfileKey)
      ?? project.targets[0]
      ?? null;
  }

  export function createCurrentSourceDefaultSnapshot<
    THaloConfig extends object,
    TGuideMode extends string = string,
    TSelection = unknown
  >(
    state: OverlayPreviewDocumentBridgeState<THaloConfig, TGuideMode, TSelection>,
    adapter: OverlayPreviewDocumentBridgeAdapter<THaloConfig>
  ): OverlaySourceDefaultSnapshot<ExportSettings, THaloConfig, TGuideMode> {
    adapter.persistActiveDocumentFormatRuntimeState();

    const activeDocumentFormat = getActiveDocumentFormat(state.documentProject, state.outputProfileKey);
    const activeProfileKey = activeDocumentFormat?.outputProfileKey ?? state.outputProfileKey;
    const activeFormatId = activeDocumentFormat?.id ?? state.documentProject.activeTargetId;
    const activeContentFormatKey = DEFAULT_CONTENT_FORMAT_KEY;

    const profileFormatBuckets: ProfileFormatBuckets = {};
    const contentFormatKeyByProfile: ProfileContentFormatMap = {};
    const exportSettingsByProfile: Record<string, ExportSettings> = {};
    const haloConfigByProfile: Record<string, THaloConfig> = {};

    for (const target of state.documentProject.targets) {
      const bucket = state.documentFormatBuckets[target.id];
      if (bucket) {
        profileFormatBuckets[target.outputProfileKey] = cloneJson(bucket);
      }

      const contentFormatKey = DEFAULT_CONTENT_FORMAT_KEY;
      contentFormatKeyByProfile[target.outputProfileKey] = contentFormatKey;

      const exportSettings = state.exportSettingsByDocumentFormatId[target.id];
      if (exportSettings) {
        exportSettingsByProfile[target.outputProfileKey] = cloneJson(exportSettings);
      }

      const haloConfig = state.haloConfigByDocumentFormatId[target.id];
      if (haloConfig) {
        haloConfigByProfile[target.outputProfileKey] = cloneJson(haloConfig);
      }
    }

    const normalizedProfileState = normalizeOverlayProfileBucketState({
      outputProfileKey: activeProfileKey,
      contentFormatKey: activeContentFormatKey,
      profileFormatBuckets,
      contentFormatKeyByProfile
    });

    const activeExportSettings = cloneJson(
      activeFormatId ? state.exportSettingsByDocumentFormatId[activeFormatId] ?? state.exportSettings : state.exportSettings
    );
    const activeHaloConfig = cloneJson(
      activeFormatId ? state.haloConfigByDocumentFormatId[activeFormatId] ?? state.haloConfig : state.haloConfig
    );
    exportSettingsByProfile[activeProfileKey] ??= cloneJson(activeExportSettings);
    haloConfigByProfile[activeProfileKey] ??= cloneJson(activeHaloConfig);

    return {
      outputProfileKey: normalizedProfileState.outputProfileKey,
      contentFormatKey: normalizedProfileState.contentFormatKey,
      profileFormatBuckets: normalizedProfileState.profileFormatBuckets,
      contentFormatKeyByProfile: normalizedProfileState.contentFormatKeyByProfile,
      exportSettings: activeExportSettings,
      exportSettingsByProfile: cloneExportSettingsByProfile(exportSettingsByProfile),
      haloConfig: activeHaloConfig,
      haloConfigByProfile: cloneHaloConfigByProfile(haloConfigByProfile),
      guideMode: state.guideMode
    };
  }

  export function applySourceDefaultSnapshotToState<
    THaloConfig extends object,
    TGuideMode extends string = string,
    TSelection = unknown
  >(
    state: OverlayPreviewDocumentBridgeState<THaloConfig, TGuideMode, TSelection>,
    snapshot: OverlaySourceDefaultSnapshot<ExportSettings, THaloConfig, TGuideMode>,
    adapter: OverlayPreviewDocumentBridgeAdapter<THaloConfig>,
    project: OverlayDocumentProject = state.documentProject
  ): void {
    const activeDocumentFormat = getActiveDocumentFormat(project, snapshot.outputProfileKey);
    const normalizedProfileState = normalizeOverlayProfileBucketState({
      outputProfileKey: activeDocumentFormat?.outputProfileKey ?? snapshot.outputProfileKey,
      contentFormatKey: snapshot.contentFormatKey,
      profileFormatBuckets: snapshot.profileFormatBuckets,
      contentFormatKeyByProfile: snapshot.contentFormatKeyByProfile
    });
    const activeFormatId = activeDocumentFormat?.id ?? project.activeTargetId;
    const documentFormatBuckets: Record<string, Record<string, OverlayLayoutOperatorParams>> = {};
    const exportSettingsByDocumentFormatId: Record<string, ExportSettings> = {};
    const haloConfigByDocumentFormatId: Record<string, THaloConfig> = {};

    for (const target of project.targets) {
      const profileKey = target.outputProfileKey;
      const bucket = normalizedProfileState.profileFormatBuckets[profileKey];
      if (bucket) {
        documentFormatBuckets[target.id] = cloneJson(bucket);
      }

      const exportSettings = snapshot.exportSettingsByProfile[profileKey];
      if (exportSettings) {
        exportSettingsByDocumentFormatId[target.id] = cloneJson(exportSettings);
      }

      const haloConfig = snapshot.haloConfigByProfile[profileKey];
      if (haloConfig) {
        haloConfigByDocumentFormatId[target.id] = cloneJson(haloConfig);
      }
    }

    state.sourceDefaults = cloneOverlaySourceDefaultSnapshot(snapshot);
    state.outputProfileKey = activeDocumentFormat?.outputProfileKey ?? normalizedProfileState.outputProfileKey;
    state.documentFormatBuckets = documentFormatBuckets;
    state.params = adapter.normalizeParams(cloneOverlayParams(
      adapter.getOrCreateDocumentFormatParams(activeFormatId, DEFAULT_CONTENT_FORMAT_KEY)
    ));
    state.exportSettingsByDocumentFormatId = cloneExportSettingsByProfile(exportSettingsByDocumentFormatId);
    state.exportSettings = cloneJson(
      activeFormatId ? state.exportSettingsByDocumentFormatId[activeFormatId] ?? snapshot.exportSettings : snapshot.exportSettings
    );
    state.haloConfigByDocumentFormatId = cloneHaloConfigByProfile(haloConfigByDocumentFormatId);
    state.haloConfig = cloneJson(
      activeFormatId ? state.haloConfigByDocumentFormatId[activeFormatId] ?? snapshot.haloConfig : snapshot.haloConfig
    );
    // Preserve guideMode across document loads — it's a UI display preference, not document state
    // Preserve overlayVisible across document loads — it's a UI display preference, not document state
    state.selected = null;
    state.pendingCsvDraftsByBucket = {};
    adapter.syncHaloConfigForActiveDocumentFormat();
  }

  export function buildOverlayPreviewDocument<
    THaloConfig extends object,
    TGuideMode extends string = string,
    TSelection = unknown
  >(
    state: OverlayPreviewDocumentBridgeState<THaloConfig, TGuideMode, TSelection>,
    adapter: OverlayPreviewDocumentBridgeAdapter<THaloConfig>,
    options: BuildOverlayPreviewDocumentOptions
  ): OverlayPreviewDocument<THaloConfig, TGuideMode> {
    const snapshot = createCurrentSourceDefaultSnapshot(state, adapter);

    return createOverlayPreviewDocument({
      name: options.name,
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
      ...(options.updatedAt ? { updatedAt: options.updatedAt } : {}),
      project: normalizeOverlayDocumentProject(state.documentProject, snapshot),
      state: snapshot,
      pendingCsvDraftsByBucket: state.pendingCsvDraftsByBucket
    });
  }

  export function buildOverlayPreviewDocumentPersistence<
    THaloConfig extends object,
    TGuideMode extends string = string,
    TSelection = unknown
  >(
    state: OverlayPreviewDocumentBridgeState<THaloConfig, TGuideMode, TSelection>,
    adapter: OverlayPreviewDocumentBridgeAdapter<THaloConfig>,
    options: BuildOverlayPreviewDocumentOptions
  ): PersistedOverlayPreviewDocument {
    return normalizeOverlayPreviewDocumentForPersistence(
      buildOverlayPreviewDocument(state, adapter, options)
    );
  }

  export function applyOverlayPreviewDocumentState<
    THaloConfig extends object,
    TGuideMode extends string = string,
    TSelection = unknown
  >(
    state: OverlayPreviewDocumentBridgeState<THaloConfig, TGuideMode, TSelection>,
    previewDocument: OverlayPreviewDocument<THaloConfig, TGuideMode>,
    adapter: OverlayPreviewDocumentBridgeAdapter<THaloConfig>
  ): void {
    state.documentProject = cloneOverlayDocumentProject(previewDocument.document.project);
    applySourceDefaultSnapshotToState(state, previewDocument.document.state, adapter, state.documentProject);
    state.pendingCsvDraftsByBucket = { ...previewDocument.pendingCsvDraftsByBucket };
  }

  export function resetOverlayPreviewDocumentState<
    THaloConfig extends object,
    TGuideMode extends string = string,
    TSelection = unknown
  >(
    state: OverlayPreviewDocumentBridgeState<THaloConfig, TGuideMode, TSelection>,
    adapter: OverlayPreviewDocumentBridgeAdapter<THaloConfig>
  ): void {
    state.documentProject = cloneOverlayDocumentProject(state.sourceDefaultProject);
    applySourceDefaultSnapshotToState(state, state.sourceDefaults, adapter, state.documentProject);
    state.pendingCsvDraftsByBucket = {};
  }