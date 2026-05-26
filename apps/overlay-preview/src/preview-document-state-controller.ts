import type { HaloFieldConfig } from "@design-foundry/operator-halo-field";

import {
  applyOverlayPreviewDocumentState,
  buildOverlayPreviewDocument,
  buildOverlayPreviewDocumentPersistence,
  resetOverlayPreviewDocumentState,
  type OverlayPreviewDocumentBridgeAdapter
} from "./preview-document-bridge.js";
import {
  denormalizeOverlayPreviewDocumentFromPersistence,
  type PersistedOverlayPreviewDocument
} from "./preview-document.js";
import {
  UNTITLED_DOCUMENT_NAME,
  type GuideMode,
  type OverlayPreviewDocument,
  type PreviewState,
  type SourceDefaultSnapshot
} from "./preview-app-context.js";
import type { ExportSettings } from "./sample-document.js";

export interface DocumentBuildOverrides {
  name?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PreviewDocumentStateControllerOptions {
  readonly state: PreviewState;
  readonly previewDocumentBridge: OverlayPreviewDocumentBridgeAdapter<HaloFieldConfig>;
  readonly initialSourceDefaults: SourceDefaultSnapshot;
  createDefaultExportSettings(profileKey: string): ExportSettings;
  getHaloConfigForProfile(profileKey: string): HaloFieldConfig;
  normalizeGuideMode(rawGuideMode: unknown): GuideMode;
  getCurrentDocumentName(): string;
  getCurrentDocumentCreatedAt(): string;
  getCurrentDocumentUpdatedAt(): string | null;
  buildConfigEditor(): void;
  resizeRenderer(): void;
  renderStage(): Promise<void>;
  loadLogoIntrinsicDimensions(assetPath: string): Promise<void>;
  resetAuthoringInteractionState(): void;
  normalizeSelection(): void;
  normalizeSelectedBackgroundNodeId(preferredNodeId?: string | null): string | null;
  normalizeSelectedOperatorId(preferredOperatorId?: string | null): string;
}

export interface PreviewDocumentStateController {
  buildCurrentDocumentPayload(overrides?: DocumentBuildOverrides): OverlayPreviewDocument;
  buildCurrentDocumentPersistence(overrides?: DocumentBuildOverrides): PersistedOverlayPreviewDocument;
  sanitizePreviewDocument(rawDocument: unknown): OverlayPreviewDocument | null;
  applyPreviewDocumentToState(previewDocument: OverlayPreviewDocument): Promise<void>;
  applyNewDocumentState(): Promise<void>;
}

export function createPreviewDocumentStateController(
  options: PreviewDocumentStateControllerOptions
): PreviewDocumentStateController {
  const { state, previewDocumentBridge } = options;

  function buildCurrentDocumentPayload(
    overrides?: DocumentBuildOverrides
  ): OverlayPreviewDocument {
    const createdAt = overrides?.createdAt ?? options.getCurrentDocumentCreatedAt() ?? overrides?.updatedAt;
    const updatedAt = overrides?.updatedAt ?? options.getCurrentDocumentUpdatedAt() ?? createdAt;

    return buildOverlayPreviewDocument(state, previewDocumentBridge, {
      name: overrides?.name ?? options.getCurrentDocumentName(),
      createdAt,
      updatedAt
    });
  }

  function buildCurrentDocumentPersistence(
    overrides?: DocumentBuildOverrides
  ): PersistedOverlayPreviewDocument {
    const createdAt = overrides?.createdAt ?? options.getCurrentDocumentCreatedAt() ?? overrides?.updatedAt;
    const updatedAt = overrides?.updatedAt ?? options.getCurrentDocumentUpdatedAt() ?? createdAt;

    return buildOverlayPreviewDocumentPersistence(state, previewDocumentBridge, {
      name: overrides?.name ?? options.getCurrentDocumentName(),
      createdAt,
      updatedAt
    });
  }

  function sanitizePreviewDocument(rawDocument: unknown): OverlayPreviewDocument | null {
    return denormalizeOverlayPreviewDocumentFromPersistence(rawDocument, {
      fallbackName: UNTITLED_DOCUMENT_NAME,
      fallbackSnapshot: options.initialSourceDefaults,
      createExportSettings: options.createDefaultExportSettings,
      createHaloConfig: options.getHaloConfigForProfile,
      normalizeGuideMode: options.normalizeGuideMode
    });
  }

  async function refreshPreviewAfterDocumentStateChange(): Promise<void> {
    state.playbackTimeSec = 0;
    state.selected = null;
    options.resetAuthoringInteractionState();
    options.normalizeSelection();
    options.normalizeSelectedBackgroundNodeId();
    options.normalizeSelectedOperatorId();
    options.resizeRenderer();
    options.buildConfigEditor();
    await options.loadLogoIntrinsicDimensions(state.params.logo?.assetPath ?? "");
    await options.renderStage();
  }

  async function applyPreviewDocumentToState(
    previewDocument: OverlayPreviewDocument
  ): Promise<void> {
    applyOverlayPreviewDocumentState(state, previewDocument, previewDocumentBridge);
    await refreshPreviewAfterDocumentStateChange();
  }

  async function applyNewDocumentState(): Promise<void> {
    resetOverlayPreviewDocumentState(state, previewDocumentBridge);
    await refreshPreviewAfterDocumentStateChange();
  }

  return {
    buildCurrentDocumentPayload,
    buildCurrentDocumentPersistence,
    sanitizePreviewDocument,
    applyPreviewDocumentToState,
    applyNewDocumentState
  };
}