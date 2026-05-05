import "/@fs/C:/Users/lyubo/work/repos/baseline-foundry/dist/presets/app-tier/styles.css";
import "/src/styles.css";
import {
  cloneOverlayDocumentProject,
  cloneOverlaySourceDefaultSnapshot,
  createBuiltInOverlaySourceDefaultSnapshot,
  createDefaultOverlayParams,
  createOverlayDocumentProjectFromSnapshot,
  normalizeOverlayParamsForEditing,
  resolveOverlayTextValue
} from "/@fs/C:/Users/lyubo/work/repos/brand-layout-ops/packages/operator-overlay-layout/src/index.ts";
import { getHaloConfigForProfile } from "/@fs/C:/Users/lyubo/work/repos/brand-layout-ops/packages/operator-halo-field/src/index.ts?t=1778003432262";
import {
  cloneOverlayParams,
  createDefaultExportSettings,
  loadOutputFormatKeys,
  saveOutputFormatKey
} from "/src/sample-document.ts";
import {} from "/src/preview-document.ts";
import {
  createDocumentWorkspaceController
} from "/src/document-workspace.ts?t=1777994759794";
import {
  OVERLAY_LAYOUT_OPERATOR_SELECTION_ID,
  UNTITLED_DOCUMENT_NAME
} from "/src/preview-app-context.ts";
import {
  createBackgroundGraphController
} from "/src/background-graph-controller.ts";
import {
  createAuthoringInteractionController
} from "/src/authoring-controller.ts";
import {
  createConfigEditorController
} from "/src/config-editor-controller.ts";
import {
  createCsvDraftController
} from "/src/csv-draft-controller.ts";
import {
  createDocumentFormatController
} from "/src/document-target-controller.ts";
import {
  createExportAutomationController
} from "/src/export-controller.ts";
import {
  createOverlayEditingController
} from "/src/overlay-editing-controller.ts";
import {
  createPlaybackController
} from "/src/playback-controller.ts";
import {
  createPreviewDocumentStateController
} from "/src/preview-document-state-controller.ts";
import {
  createProfileStateController
} from "/src/profile-state-controller.ts";
import {
  createSourceDefaultController
} from "/src/source-default-controller.ts";
import { createStageRenderController } from "/src/stage-render-controller.ts?t=1778003432262";
import {
  createPreviewShellController
} from "/src/preview-shell-controller.ts?t=1777994759794";
import {
  createStageNetworkOverlayController
} from "/src/stage-network-overlay-controller.ts";
import { buildFuzzyBoidsSection } from "/src/fuzzy-boids-section.ts";
import { buildGridSection } from "/src/grid-section.ts";
import { buildHaloConfigSection } from "/src/halo-config-section.ts?t=1778003432262";
import { buildOverlaySection } from "/src/overlay-section.ts";
import { buildPhyllotaxisSection } from "/src/phyllotaxis-section.ts";
import { buildScatterSection } from "/src/scatter-section.ts";
const INITIAL_PROFILE_KEY = "instagram_1080x1350";
const INITIAL_FORMAT_KEY = "generic_social";
const OVERLAY_VISIBLE_STORAGE_KEY = "brand-layout-ops-overlay-visible-v1";
const NETWORK_OVERLAY_VISIBLE_STORAGE_KEY = "brand-layout-ops-network-overlay-visible-v1";
const GUIDE_MODE_STORAGE_KEY = "brand-layout-ops-guide-mode-v1";
const persistedFormat = loadOutputFormatKeys();
const startProfileKey = persistedFormat?.profileKey ?? INITIAL_PROFILE_KEY;
const startFormatKey = persistedFormat?.formatKey ?? INITIAL_FORMAT_KEY;
const INITIAL_PARAMS = createDefaultOverlayParams(startProfileKey, startFormatKey);
function normalizeGuideMode(rawGuideMode) {
  return rawGuideMode === "off" || rawGuideMode === "baseline" ? rawGuideMode : "composition";
}
const INITIAL_SOURCE_DEFAULTS = createBuiltInOverlaySourceDefaultSnapshot({
  outputProfileKey: INITIAL_PROFILE_KEY,
  contentFormatKey: INITIAL_FORMAT_KEY,
  guideMode: "composition",
  createExportSettings: createDefaultExportSettings,
  createHaloConfig: getHaloConfigForProfile
});
const INITIAL_SOURCE_DEFAULT_PROJECT = createOverlayDocumentProjectFromSnapshot(INITIAL_SOURCE_DEFAULTS);
const INITIAL_DOCUMENT_FORMAT_ID = INITIAL_SOURCE_DEFAULT_PROJECT.activeTargetId;
const state = {
  params: cloneOverlayParams(INITIAL_PARAMS),
  selected: null,
  guideMode: normalizeGuideMode(localStorage.getItem(GUIDE_MODE_STORAGE_KEY) ?? "composition"),
  overlayVisible: localStorage.getItem(OVERLAY_VISIBLE_STORAGE_KEY) !== "0",
  networkOverlayVisible: localStorage.getItem(NETWORK_OVERLAY_VISIBLE_STORAGE_KEY) === "1",
  pendingCsvDraftsByBucket: {},
  outputProfileKey: startProfileKey,
  contentFormatKey: startFormatKey,
  documentFormatBuckets: {
    [INITIAL_DOCUMENT_FORMAT_ID]: {
      [startFormatKey]: cloneOverlayParams(INITIAL_PARAMS)
    }
  },
  contentFormatKeyByDocumentFormatId: {
    [INITIAL_DOCUMENT_FORMAT_ID]: startFormatKey
  },
  exportSettings: createDefaultExportSettings(startProfileKey),
  exportSettingsByDocumentFormatId: {
    [INITIAL_DOCUMENT_FORMAT_ID]: createDefaultExportSettings(startProfileKey)
  },
  haloConfig: getHaloConfigForProfile(startProfileKey),
  haloConfigByDocumentFormatId: {
    [INITIAL_DOCUMENT_FORMAT_ID]: getHaloConfigForProfile(startProfileKey)
  },
  sourceDefaults: cloneOverlaySourceDefaultSnapshot(INITIAL_SOURCE_DEFAULTS),
  sourceDefaultProject: cloneOverlayDocumentProject(INITIAL_SOURCE_DEFAULT_PROJECT),
  documentProject: cloneOverlayDocumentProject(INITIAL_SOURCE_DEFAULT_PROJECT),
  selectedBackgroundNodeId: INITIAL_SOURCE_DEFAULT_PROJECT.backgroundGraph.activeNodeId,
  selectedOperatorId: OVERLAY_LAYOUT_OPERATOR_SELECTION_ID,
  isPlaying: true,
  playbackTimeSec: 0
};
const backgroundGraphController = createBackgroundGraphController({ state });
const previewDocumentBridge = {
  persistActiveDocumentFormatBuckets,
  persistActiveExportSettings,
  persistActiveHaloConfig,
  getOrCreateDocumentFormatParams,
  normalizeParams: normalizeParamsTextFieldOffsets,
  syncHaloConfigForActiveDocumentFormat
};
let previewShellController = null;
let networkOverlayController = null;
const documentWorkspaceController = createDocumentWorkspaceController({
  untitledName: UNTITLED_DOCUMENT_NAME,
  initialStatusMessage: "Open or save a local document file.",
  parseDocument: sanitizePreviewDocument,
  getDocumentMetadata: (previewDocument) => previewDocument.document.metadata,
  buildPersistedDocument: buildCurrentDocumentPersistence,
  applyDocument: applyPreviewDocumentToState,
  applyNewDocumentState,
  onWorkspaceChange: () => {
    previewShellController?.updateDocumentUi();
  }
});
let logoIntrinsicWidth = 0;
let logoIntrinsicHeight = 0;
let exportAutomationController = null;
let authoringController = null;
let sourceDefaultController = null;
let csvDraftController = null;
let playbackController = null;
let overlayEditingController = null;
let configEditorController = null;
let documentFormatController = null;
let profileStateController = null;
let documentStateController = null;
const $ = (selector) => document.querySelector(selector);
function getStageEl() {
  return $("[data-stage]");
}
function getStageShellEl() {
  return $("[data-stage-shell]");
}
function getCanvasEl() {
  return $("[data-stage-canvas]");
}
function getScenePreviewCanvas() {
  return $("[data-scene-preview]");
}
function getScenePreviewGpuCanvas() {
  return $("[data-scene-preview-gpu]");
}
function getTextOverlayCanvas() {
  return $("[data-text-overlay]");
}
function getSvgOverlay() {
  return $("[data-svg-overlay]");
}
function getAuthoringLayerEl() {
  return $("[data-authoring-layer]");
}
function getNetworkOverlayEl() {
  return $("[data-network-overlay]");
}
function getConfigEditor() {
  return $("[data-config-editor]");
}
function getFormatOptions() {
  return $("[data-format-options]");
}
function getOverlayVisibilityInput() {
  return $("[data-overlay-visibility]");
}
const stageRenderController = createStageRenderController({
  state,
  getStageShellEl,
  getStageEl,
  getCanvasEl,
  getScenePreviewCanvas,
  getScenePreviewGpuCanvas,
  getTextOverlayCanvas,
  getSvgOverlay,
  getEffectiveParams,
  onAuthoringRender: () => {
    authoringController?.render();
  }
});
profileStateController = createProfileStateController({
  state,
  createDefaultExportSettings,
  getHaloConfigForProfile,
  normalizeParamsTextFieldOffsets,
  getEffectiveParams,
  normalizeSelection,
  resizeRenderer,
  renderStage,
  syncDocumentProjectToCurrentOutputProfile,
  saveOutputFormatKey
});
syncHaloConfigForActiveDocumentFormat();
function getNormalizedDocumentName(rawName = documentWorkspaceController.state.name) {
  return documentWorkspaceController.getNormalizedName(rawName);
}
function loadLogoIntrinsicDimensions(assetPath) {
  return new Promise((resolve) => {
    if (!assetPath) {
      logoIntrinsicWidth = 0;
      logoIntrinsicHeight = 0;
      resolve();
      return;
    }
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => {
      logoIntrinsicWidth = image.naturalWidth;
      logoIntrinsicHeight = image.naturalHeight;
      resolve();
    });
    image.addEventListener("error", () => {
      logoIntrinsicWidth = 0;
      logoIntrinsicHeight = 0;
      resolve();
    });
    image.src = assetPath;
  });
}
function markDocumentDirty() {
  documentWorkspaceController.markDirty();
}
function updateDocumentUi() {
  previewShellController?.updateDocumentUi();
}
function getCsvDraftBucketKey(formatId, formatKey) {
  return csvDraftController.getCsvDraftBucketKey(formatId, formatKey);
}
function getStagedCsvDraft(formatId, formatKey) {
  return csvDraftController.getStagedCsvDraft(formatId, formatKey);
}
function setStagedCsvDraft(draft, formatId, formatKey) {
  csvDraftController.setStagedCsvDraft(draft, formatId, formatKey);
}
function getOverlayFormatCsvPath(formatKey) {
  return csvDraftController.getOverlayFormatCsvPath(formatKey);
}
async function flushPendingCsvDrafts() {
  return csvDraftController.flushPendingCsvDrafts();
}
function getEffectiveParams() {
  const stagedCsvDraft = getStagedCsvDraft();
  if (getContentSource() !== "csv" || stagedCsvDraft === null) {
    return normalizeParamsTextFieldOffsets(state.params);
  }
  return normalizeParamsTextFieldOffsets({
    ...state.params,
    csvContent: {
      draft: stagedCsvDraft,
      rowIndex: state.params.csvContent?.rowIndex ?? 1
    }
  });
}
function getContentSource() {
  return state.params.contentSource === "csv" ? "csv" : "inline";
}
function normalizeSelectedBackgroundNodeId(preferredNodeId = state.selectedBackgroundNodeId) {
  return backgroundGraphController.normalizeSelectedBackgroundNodeId(preferredNodeId);
}
function normalizeSelectedOperatorId(preferredOperatorId = state.selectedOperatorId) {
  return backgroundGraphController.normalizeSelectedOperatorId(preferredOperatorId);
}
function getAvailableBackgroundOperatorKeys() {
  return backgroundGraphController.getAvailableBackgroundOperatorKeys();
}
function setSelectedOperator(operatorId) {
  const didChange = backgroundGraphController.setSelectedOperator(operatorId);
  networkOverlayController?.render();
  return didChange;
}
function getSelectedOperatorId() {
  return backgroundGraphController.getSelectedOperatorId();
}
function setSelectedBackgroundNode(nodeId) {
  return backgroundGraphController.setSelectedBackgroundNode(nodeId);
}
function getSelectedBackgroundNode() {
  return backgroundGraphController.getSelectedBackgroundNode();
}
function getSelectedOperatorGroup() {
  return backgroundGraphController.getSelectedOperatorGroup();
}
function updateSelectedBackgroundNode(updater) {
  return backgroundGraphController.updateSelectedBackgroundNode(updater);
}
function connectBackgroundEdge(edge) {
  const didConnect = backgroundGraphController.connectBackgroundEdge(edge);
  networkOverlayController?.render();
  return didConnect;
}
function disconnectBackgroundInput(nodeId, portKey) {
  const didDisconnect = backgroundGraphController.disconnectBackgroundInput(nodeId, portKey);
  networkOverlayController?.render();
  return didDisconnect;
}
function syncDocumentBackgroundGraph() {
  backgroundGraphController.syncDocumentBackgroundGraph();
  networkOverlayController?.render();
}
function removeBackgroundNode(nodeId) {
  const didRemove = backgroundGraphController.removeBackgroundNode(nodeId);
  networkOverlayController?.render();
  return didRemove;
}
function addBackgroundNode(operatorKey) {
  const nextNodeId = backgroundGraphController.addBackgroundNode(operatorKey);
  networkOverlayController?.render();
  return nextNodeId;
}
function getResolvedTextFieldText(field) {
  return resolveOverlayTextValue(getEffectiveParams(), field);
}
function hasStagedCsvDraft() {
  return csvDraftController.hasStagedCsvDraft();
}
function getDocumentFormatBucket(formatId) {
  return profileStateController.getDocumentFormatBucket(formatId);
}
function persistActiveExportSettings() {
  profileStateController.persistActiveExportSettings();
}
function persistActiveHaloConfig() {
  profileStateController.persistActiveHaloConfig();
}
function updateExportSettings(updater) {
  profileStateController.updateExportSettings(updater);
}
function persistActiveDocumentFormatBuckets() {
  profileStateController.persistActiveDocumentFormatBuckets();
}
function getOrCreateDocumentFormatParams(formatId, formatKey) {
  return profileStateController.getOrCreateDocumentFormatParams(formatId, formatKey);
}
function syncHaloConfigForActiveDocumentFormat() {
  profileStateController.syncHaloConfigForActiveDocumentFormat();
}
function normalizeSelection() {
  if (!state.selected) {
    return;
  }
  if (state.selected.kind === "logo") {
    if (!state.params.logo) {
      state.selected = null;
    }
    return;
  }
  if (state.params.textFields.some((field) => field.id === state.selected?.id)) {
    return;
  }
  state.selected = null;
}
function updateSelectedTextValue(id, value) {
  overlayEditingController.updateSelectedTextValue(id, value);
}
function normalizeParamsTextFieldOffsets(params) {
  return normalizeOverlayParamsForEditing(params);
}
function getDisplayedTextFieldOffsetBaselines(field) {
  return overlayEditingController.getDisplayedTextFieldOffsetBaselines(field);
}
function updateTextField(id, updater) {
  overlayEditingController.updateTextField(id, updater);
}
function updateTextStyle(key, updater) {
  overlayEditingController.updateTextStyle(key, updater);
}
function updateLogo(updater) {
  overlayEditingController.updateLogo(updater);
}
function getCurrentLogoAspectRatio() {
  return overlayEditingController.getCurrentLogoAspectRatio();
}
function syncLogoToTitleFontSize(titleFontSizePx) {
  overlayEditingController.syncLogoToTitleFontSize(titleFontSizePx);
}
function syncTitleToLogoHeight(logoHeightPx) {
  overlayEditingController.syncTitleToLogoHeight(logoHeightPx);
}
function updateLogoSizeWithAspectRatio(nextHeightPx) {
  overlayEditingController.updateLogoSizeWithAspectRatio(nextHeightPx);
}
function createOverlayItemActionRow() {
  return overlayEditingController.createOverlayItemActionRow();
}
function select(sel) {
  state.selected = sel;
  if (authoringController) {
    authoringController.handleSelectionChange();
    networkOverlayController?.render();
    return;
  }
  buildConfigEditor();
  networkOverlayController?.render();
}
function applyStagedCsvDraft() {
  csvDraftController.applyStagedCsvDraft();
}
function discardStagedCsvDraft() {
  csvDraftController.discardStagedCsvDraft();
}
function getDefaultDocumentFormatLabel(profileKey) {
  return documentFormatController.getDefaultDocumentFormatLabel(profileKey);
}
function syncDocumentProjectToCurrentOutputProfile() {
  return documentFormatController.syncDocumentProjectToCurrentOutputProfile();
}
function getUnusedDocumentFormatProfileKeys(currentProfileKey) {
  return documentFormatController.getUnusedDocumentFormatProfileKeys(currentProfileKey);
}
function getSceneFamilyLabel(sceneFamilyKey) {
  return backgroundGraphController.getSceneFamilyLabel(sceneFamilyKey);
}
function setActiveDocumentFormat(targetId) {
  documentFormatController.setActiveDocumentFormat(targetId);
}
function addDocumentFormat(profileKey) {
  return documentFormatController.addDocumentFormat(profileKey);
}
function updateActiveDocumentFormatLabel(rawLabel) {
  documentFormatController.updateActiveDocumentFormatLabel(rawLabel);
}
function updateActiveDocumentFormatProfile(nextProfileKey) {
  documentFormatController.updateActiveDocumentFormatProfile(nextProfileKey);
}
function removeActiveDocumentFormat() {
  return documentFormatController.removeActiveDocumentFormat();
}
function switchOutputProfile(profileKey, options) {
  profileStateController.switchOutputProfile(profileKey, options);
  networkOverlayController?.render();
}
function switchContentFormat(formatKey) {
  profileStateController.switchContentFormat(formatKey);
}
function buildCurrentDocumentPayload(overrides) {
  return documentStateController.buildCurrentDocumentPayload(overrides);
}
function buildCurrentDocumentPersistence(overrides) {
  return documentStateController.buildCurrentDocumentPersistence(overrides);
}
function sanitizePreviewDocument(rawDocument) {
  return documentStateController.sanitizePreviewDocument(rawDocument);
}
async function applyPreviewDocumentToState(previewDocument) {
  await documentStateController.applyPreviewDocumentToState(previewDocument);
  networkOverlayController?.render();
}
async function applyNewDocumentState() {
  await documentStateController.applyNewDocumentState();
  networkOverlayController?.render();
}
function setOverlayVisible(nextVisible) {
  if (state.overlayVisible === nextVisible) {
    syncOverlayVisibilityUi();
    authoringController?.render();
    networkOverlayController?.render();
    previewShellController?.updateViewUi();
    return;
  }
  state.overlayVisible = nextVisible;
  try {
    localStorage.setItem(OVERLAY_VISIBLE_STORAGE_KEY, nextVisible ? "1" : "0");
  } catch {
  }
  if (!nextVisible) {
    authoringController?.resetInteractionState();
  }
  syncOverlayVisibilityUi();
  authoringController?.render();
  networkOverlayController?.render();
  previewShellController?.updateViewUi();
}
function setNetworkOverlayVisible(nextVisible) {
  if (state.networkOverlayVisible === nextVisible) {
    networkOverlayController?.render();
    previewShellController?.updateViewUi();
    return;
  }
  state.networkOverlayVisible = nextVisible;
  try {
    localStorage.setItem(NETWORK_OVERLAY_VISIBLE_STORAGE_KEY, nextVisible ? "1" : "0");
  } catch {
  }
  networkOverlayController?.render();
  previewShellController?.updateViewUi();
}
function syncOverlayVisibilityUi() {
  const svg = getSvgOverlay();
  const authoringLayer = getAuthoringLayerEl();
  const overlayVisibilityInput = getOverlayVisibilityInput();
  if (overlayVisibilityInput) {
    overlayVisibilityInput.checked = state.overlayVisible;
  }
  if (svg) {
    svg.style.display = state.overlayVisible ? "block" : "none";
  }
  if (authoringLayer) {
    authoringLayer.style.display = state.overlayVisible ? "block" : "none";
    authoringLayer.style.pointerEvents = state.overlayVisible ? "auto" : "none";
  }
}
function resizeRenderer() {
  stageRenderController.resizeRenderer();
  authoringController?.render();
  networkOverlayController?.render();
}
function syncBackgroundRendererVisibility() {
  stageRenderController.syncBackgroundRendererVisibility();
}
function getSceneFamilyPreviewState(mode = "interactive") {
  return stageRenderController.getSceneFamilyPreviewState(mode);
}
function renderBackgroundFrame(mode = "interactive") {
  stageRenderController.renderBackgroundFrame(mode);
}
function updatePlaybackToggleUi() {
  playbackController.updatePlaybackToggleUi();
}
function stopPlaybackLoop() {
  playbackController.stopPlaybackLoop();
}
function ensurePlaybackLoop() {
  playbackController.ensurePlaybackLoop();
}
function setPlaybackPlaying(nextIsPlaying) {
  playbackController.setPlaybackPlaying(nextIsPlaying);
}
function togglePlayback() {
  playbackController.togglePlayback();
}
async function renderStage(mode = "interactive") {
  await stageRenderController.renderStage(mode);
}
function buildFormatOptions() {
  documentFormatController.buildFormatOptions();
}
function getSelectedOverlaySectionTitle() {
  return overlayEditingController.getSelectedOverlaySectionTitle();
}
function getSelectedTextField() {
  return overlayEditingController.getSelectedTextField();
}
function applySelectedTextStyle(styleKey) {
  overlayEditingController.applySelectedTextStyle(styleKey);
}
const ctx = {
  state,
  renderStage,
  buildConfigEditor,
  buildFormatOptions,
  resizeRenderer,
  syncOverlayVisibilityUi,
  updatePlaybackToggleUi,
  updateDocumentUi,
  markDocumentDirty,
  select,
  togglePlayback,
  setPlaybackPlaying,
  setOverlayVisible,
  normalizeParamsTextFieldOffsets,
  updateExportSettings,
  updateTextField,
  updateLogo,
  updateLogoSizeWithAspectRatio,
  getCurrentLogoAspectRatio,
  loadLogoIntrinsicDimensions,
  applySelectedTextStyle,
  updateTextStyle,
  syncLogoToTitleFontSize,
  syncTitleToLogoHeight,
  getDisplayedTextFieldOffsetBaselines,
  getResolvedTextFieldText,
  updateSelectedTextValue,
  getSelectedTextField,
  getSelectedOverlaySectionTitle,
  createOverlayItemActionRow,
  switchContentFormat,
  setStagedCsvDraft,
  getStagedCsvDraft,
  hasStagedCsvDraft,
  applyStagedCsvDraft,
  discardStagedCsvDraft,
  getContentSource,
  getEffectiveParams,
  switchOutputProfile,
  applySourceDefaultSnapshot(snapshot) {
    sourceDefaultController?.applySourceDefaultSnapshot(snapshot);
  },
  writeCurrentAsSourceDefault() {
    return sourceDefaultController.writeCurrentAsSourceDefault();
  },
  setSourceDefaultStatus(message, severity) {
    sourceDefaultController?.setSourceDefaultStatus(message, severity);
  },
  setSelectedBackgroundNode,
  getSelectedBackgroundNode,
  updateSelectedBackgroundNode,
  syncDocumentBackgroundGraph,
  getSceneFamilyPreviewState,
  getSceneFamilyLabel,
  addDocumentFormat,
  removeActiveDocumentFormat,
  setActiveDocumentFormat,
  updateActiveDocumentFormatLabel,
  updateActiveDocumentFormatProfile,
  getUnusedDocumentFormatProfileKeys,
  getDefaultDocumentFormatLabel,
  documentWorkspace: documentWorkspaceController,
  getNormalizedDocumentName,
  exportComposedFramePng: async () => {
    await exportAutomationController?.exportComposedFramePng();
  },
  exportPngSequence: async () => {
    await exportAutomationController?.exportPngSequence();
  },
  exportMp4: async () => {
    await exportAutomationController?.exportMp4();
  }
};
networkOverlayController = createStageNetworkOverlayController({
  state,
  getStageEl,
  getOverlayEl: getNetworkOverlayEl,
  getSelectedOperatorId,
  getSceneFamilyLabel,
  getSceneFamilyPreviewState,
  selectBackgroundNode(nodeId) {
    const didChange = setSelectedOperator(nodeId);
    if (didChange) {
      buildConfigEditor();
    }
  },
  selectOverlayLayout() {
    setSelectedOperator(OVERLAY_LAYOUT_OPERATOR_SELECTION_ID);
    select(null);
  }
});
authoringController = createAuthoringInteractionController({
  ctx,
  getCurrentScene: () => stageRenderController.getCurrentScene(),
  getStageEl,
  getAuthoringLayerEl
});
documentStateController = createPreviewDocumentStateController({
  state,
  previewDocumentBridge,
  initialSourceDefaults: INITIAL_SOURCE_DEFAULTS,
  createDefaultExportSettings,
  getHaloConfigForProfile,
  normalizeGuideMode,
  getCurrentDocumentName: () => getNormalizedDocumentName(),
  getCurrentDocumentCreatedAt: () => documentWorkspaceController.state.createdAt,
  getCurrentDocumentUpdatedAt: () => documentWorkspaceController.state.updatedAt,
  buildConfigEditor,
  resizeRenderer,
  renderStage,
  loadLogoIntrinsicDimensions,
  resetAuthoringInteractionState: () => {
    authoringController?.resetInteractionState();
  },
  normalizeSelection,
  normalizeSelectedBackgroundNodeId,
  normalizeSelectedOperatorId
});
exportAutomationController = createExportAutomationController({
  ctx,
  getCanvasEl,
  getScenePreviewCanvas,
  getScenePreviewGpuCanvas,
  getTextOverlayCanvas,
  getSvgOverlay,
  getSceneDescriptor: () => stageRenderController.getSceneDescriptor(),
  normalizeSelectedBackgroundNodeId,
  buildCurrentDocumentPersistence,
  parsePreviewDocument: sanitizePreviewDocument,
  applyPreviewDocument: applyPreviewDocumentToState
});
csvDraftController = createCsvDraftController({
  state,
  getDocumentFormatBucket,
  getOrCreateDocumentFormatParams,
  markDocumentDirty
});
playbackController = createPlaybackController({
  state,
  renderBackgroundFrame
});
overlayEditingController = createOverlayEditingController({
  state,
  normalizeParamsTextFieldOffsets,
  markDocumentDirty,
  buildConfigEditor,
  renderStage,
  select,
  getLogoIntrinsicDimensions: () => ({
    width: logoIntrinsicWidth,
    height: logoIntrinsicHeight
  })
});
sourceDefaultController = createSourceDefaultController({
  state,
  initialSourceDefaults: INITIAL_SOURCE_DEFAULTS,
  initialSourceDefaultProject: INITIAL_SOURCE_DEFAULT_PROJECT,
  previewDocumentBridge,
  createDefaultExportSettings,
  getHaloConfigForProfile,
  normalizeGuideMode,
  flushPendingCsvDrafts,
  buildCurrentDocumentPayload,
  buildConfigEditor,
  syncDocumentProjectToCurrentOutputProfile,
  normalizeSelectedBackgroundNodeId,
  normalizeSelectedOperatorId,
  normalizeSelection
});
previewShellController = createPreviewShellController({
  state,
  untitledName: UNTITLED_DOCUMENT_NAME,
  guideModeStorageKey: GUIDE_MODE_STORAGE_KEY,
  documentWorkspace: documentWorkspaceController,
  sourceDefaultController,
  markDocumentDirty,
  loadLogoIntrinsicDimensions,
  buildConfigEditor,
  buildFormatOptions,
  renderStage,
  resizeRenderer,
  togglePlayback,
  ensurePlaybackLoop,
  updateExportSettings,
  setOverlayVisible,
  setNetworkOverlayVisible,
  addDocumentFormat,
  removeActiveDocumentFormat,
  exportComposedFramePng: async () => {
    await exportAutomationController?.exportComposedFramePng();
  },
  exportPngSequence: async () => {
    await exportAutomationController?.exportPngSequence();
  },
  exportMp4: async () => {
    await exportAutomationController?.exportMp4();
  },
  initHaloRenderer: () => {
    stageRenderController.initHaloRenderer();
  },
  initAuthoring: () => {
    authoringController?.init();
  },
  handleAuthoringEditingKeyDown: (event) => {
    return authoringController?.handleEditingKeyDown(event) ?? false;
  },
  handleAuthoringInteractionKeyDown: (event) => {
    return authoringController?.handleInteractionKeyDown(event) ?? false;
  }
});
const CORE_CONFIG_SECTION_DEFINITIONS = [
  { key: "overlay-layer", scope: "operator", group: OVERLAY_LAYOUT_OPERATOR_SELECTION_ID, order: 500, factory: () => buildOverlaySection(ctx) },
  { key: "layout-grid", scope: "operator", group: OVERLAY_LAYOUT_OPERATOR_SELECTION_ID, order: 700, factory: () => buildGridSection(ctx) },
  { key: "halo-config", scope: "operator", order: 800, group: "halo", factory: () => buildHaloConfigSection(ctx) },
  { key: "fuzzy-boids", scope: "operator", order: 810, group: "fuzzy-boids", factory: () => buildFuzzyBoidsSection(ctx) },
  { key: "phyllotaxis", scope: "operator", order: 820, group: "phyllotaxis", factory: () => buildPhyllotaxisSection(ctx) },
  { key: "scatter", scope: "operator", order: 830, group: "scatter", factory: () => buildScatterSection(ctx) }
];
configEditorController = createConfigEditorController({
  state,
  sectionDefinitions: CORE_CONFIG_SECTION_DEFINITIONS,
  getConfigEditor,
  getSelectedOperatorId,
  getSelectedOperatorGroup,
  getSceneFamilyLabel,
  getAvailableBackgroundOperatorKeys,
  addBackgroundNode,
  connectBackgroundEdge,
  disconnectBackgroundInput,
  setSelectedOperator,
  selectOverlayItem: select,
  syncDocumentBackgroundGraph,
  removeBackgroundNode,
  markDocumentDirty,
  syncBackgroundRendererVisibility,
  renderStage
});
documentFormatController = createDocumentFormatController({
  state,
  getFormatOptions,
  switchOutputProfile,
  persistActiveDocumentFormatBuckets,
  persistActiveExportSettings,
  persistActiveHaloConfig,
  markDocumentDirty,
  buildConfigEditor,
  renderStage
});
function buildConfigEditor() {
  configEditorController.buildConfigEditor();
}
const initPromise = previewShellController.init();
exportAutomationController?.installAutomationApi(initPromise);
void initPromise.then(() => {
  networkOverlayController?.render();
}).catch(() => {
});
initPromise.catch((error) => {
  console.error(error);
});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFwiYmFzZWxpbmUtZm91bmRyeS9wcmVzZXRzL2FwcC10aWVyLmNzc1wiO1xuaW1wb3J0IFwiLi9zdHlsZXMuY3NzXCI7XG5cbmltcG9ydCB0eXBlIHtcbiAgTG9nb1BsYWNlbWVudFNwZWMsXG4gIFRleHRGaWVsZFBsYWNlbWVudFNwZWMsXG4gIFRleHRTdHlsZVNwZWNcbn0gZnJvbSBcIkBicmFuZC1sYXlvdXQtb3BzL2NvcmUtdHlwZXNcIjtcbmltcG9ydCB7XG4gIGNsb25lT3ZlcmxheURvY3VtZW50UHJvamVjdCxcbiAgY2xvbmVPdmVybGF5U291cmNlRGVmYXVsdFNuYXBzaG90LFxuICBjcmVhdGVCdWlsdEluT3ZlcmxheVNvdXJjZURlZmF1bHRTbmFwc2hvdCxcbiAgY3JlYXRlRGVmYXVsdE92ZXJsYXlQYXJhbXMsXG4gIGNyZWF0ZU92ZXJsYXlEb2N1bWVudFByb2plY3RGcm9tU25hcHNob3QsXG4gIG5vcm1hbGl6ZU92ZXJsYXlQYXJhbXNGb3JFZGl0aW5nLFxuICByZXNvbHZlT3ZlcmxheVRleHRWYWx1ZVxufSBmcm9tIFwiQGJyYW5kLWxheW91dC1vcHMvb3BlcmF0b3Itb3ZlcmxheS1sYXlvdXRcIjtcbmltcG9ydCB0eXBlIHtcbiAgT3ZlcmxheUJhY2tncm91bmRFZGdlLFxuICBPdmVybGF5QmFja2dyb3VuZE5vZGUsXG4gIE92ZXJsYXlCYWNrZ3JvdW5kT3BlcmF0b3JLZXksXG4gIE92ZXJsYXlDb250ZW50U291cmNlLFxuICBPdmVybGF5RG9jdW1lbnRQcm9qZWN0LFxuICBPdmVybGF5TGF5b3V0T3BlcmF0b3JQYXJhbXMsXG4gIE92ZXJsYXlTY2VuZUZhbWlseUtleVxufSBmcm9tIFwiQGJyYW5kLWxheW91dC1vcHMvb3BlcmF0b3Itb3ZlcmxheS1sYXlvdXRcIjtcbmltcG9ydCB7IGdldEhhbG9Db25maWdGb3JQcm9maWxlIH0gZnJvbSBcIkBicmFuZC1sYXlvdXQtb3BzL29wZXJhdG9yLWhhbG8tZmllbGRcIjtcbmltcG9ydCB0eXBlIHsgSGFsb0ZpZWxkQ29uZmlnIH0gZnJvbSBcIkBicmFuZC1sYXlvdXQtb3BzL29wZXJhdG9yLWhhbG8tZmllbGRcIjtcbmltcG9ydCB0eXBlIHsgUGFyYW1ldGVyU2VjdGlvbkRlZmluaXRpb24gfSBmcm9tIFwiQGJyYW5kLWxheW91dC1vcHMvcGFyYW1ldGVyLXVpXCI7XG5cbmltcG9ydCB0eXBlIHsgU2NlbmVGYW1pbHlQcmV2aWV3TW9kZSB9IGZyb20gXCIuL3NjZW5lLWZhbWlseS1wcmV2aWV3LmpzXCI7XG5pbXBvcnQge1xuICBjbG9uZU92ZXJsYXlQYXJhbXMsXG4gIGNyZWF0ZURlZmF1bHRFeHBvcnRTZXR0aW5ncyxcbiAgbG9hZE91dHB1dEZvcm1hdEtleXMsXG4gIHNhdmVPdXRwdXRGb3JtYXRLZXksXG4gIHR5cGUgRXhwb3J0U2V0dGluZ3Ncbn0gZnJvbSBcIi4vc2FtcGxlLWRvY3VtZW50LmpzXCI7XG5pbXBvcnQgeyB0eXBlIFBlcnNpc3RlZE92ZXJsYXlQcmV2aWV3RG9jdW1lbnQgfSBmcm9tIFwiLi9wcmV2aWV3LWRvY3VtZW50LmpzXCI7XG5pbXBvcnQge1xuICBjcmVhdGVEb2N1bWVudFdvcmtzcGFjZUNvbnRyb2xsZXJcbn0gZnJvbSBcIi4vZG9jdW1lbnQtd29ya3NwYWNlLmpzXCI7XG5pbXBvcnQgdHlwZSB7XG4gIEd1aWRlTW9kZSxcbiAgT3ZlcmxheVByZXZpZXdEb2N1bWVudCxcbiAgUHJldmlld0FwcENvbnRleHQsXG4gIFByZXZpZXdTdGF0ZSxcbiAgU2VsZWN0ZWRPcGVyYXRvcklkLFxuICBTZWxlY3Rpb25cbn0gZnJvbSBcIi4vcHJldmlldy1hcHAtY29udGV4dC5qc1wiO1xuaW1wb3J0IHtcbiAgT1ZFUkxBWV9MQVlPVVRfT1BFUkFUT1JfU0VMRUNUSU9OX0lELFxuICBVTlRJVExFRF9ET0NVTUVOVF9OQU1FXG59IGZyb20gXCIuL3ByZXZpZXctYXBwLWNvbnRleHQuanNcIjtcbmltcG9ydCB7XG4gIGNyZWF0ZUJhY2tncm91bmRHcmFwaENvbnRyb2xsZXJcbn0gZnJvbSBcIi4vYmFja2dyb3VuZC1ncmFwaC1jb250cm9sbGVyLmpzXCI7XG5pbXBvcnQge1xuICBjcmVhdGVBdXRob3JpbmdJbnRlcmFjdGlvbkNvbnRyb2xsZXIsXG4gIHR5cGUgQXV0aG9yaW5nSW50ZXJhY3Rpb25Db250cm9sbGVyXG59IGZyb20gXCIuL2F1dGhvcmluZy1jb250cm9sbGVyLmpzXCI7XG5pbXBvcnQge1xuICBjcmVhdGVDb25maWdFZGl0b3JDb250cm9sbGVyLFxuICB0eXBlIENvbmZpZ0VkaXRvckNvbnRyb2xsZXJcbn0gZnJvbSBcIi4vY29uZmlnLWVkaXRvci1jb250cm9sbGVyLmpzXCI7XG5pbXBvcnQge1xuICBjcmVhdGVDc3ZEcmFmdENvbnRyb2xsZXIsXG4gIHR5cGUgQ3N2RHJhZnRDb250cm9sbGVyXG59IGZyb20gXCIuL2Nzdi1kcmFmdC1jb250cm9sbGVyLmpzXCI7XG5pbXBvcnQge1xuICBjcmVhdGVEb2N1bWVudEZvcm1hdENvbnRyb2xsZXIsXG4gIHR5cGUgRG9jdW1lbnRGb3JtYXRDb250cm9sbGVyXG59IGZyb20gXCIuL2RvY3VtZW50LXRhcmdldC1jb250cm9sbGVyLmpzXCI7XG5pbXBvcnQge1xuICBjcmVhdGVFeHBvcnRBdXRvbWF0aW9uQ29udHJvbGxlcixcbiAgdHlwZSBFeHBvcnRBdXRvbWF0aW9uQ29udHJvbGxlclxufSBmcm9tIFwiLi9leHBvcnQtY29udHJvbGxlci5qc1wiO1xuaW1wb3J0IHtcbiAgY3JlYXRlT3ZlcmxheUVkaXRpbmdDb250cm9sbGVyLFxuICB0eXBlIE92ZXJsYXlFZGl0aW5nQ29udHJvbGxlclxufSBmcm9tIFwiLi9vdmVybGF5LWVkaXRpbmctY29udHJvbGxlci5qc1wiO1xuaW1wb3J0IHtcbiAgY3JlYXRlUGxheWJhY2tDb250cm9sbGVyLFxuICB0eXBlIFBsYXliYWNrQ29udHJvbGxlclxufSBmcm9tIFwiLi9wbGF5YmFjay1jb250cm9sbGVyLmpzXCI7XG5pbXBvcnQge1xuICBjcmVhdGVQcmV2aWV3RG9jdW1lbnRTdGF0ZUNvbnRyb2xsZXIsXG4gIHR5cGUgUHJldmlld0RvY3VtZW50U3RhdGVDb250cm9sbGVyXG59IGZyb20gXCIuL3ByZXZpZXctZG9jdW1lbnQtc3RhdGUtY29udHJvbGxlci5qc1wiO1xuaW1wb3J0IHtcbiAgY3JlYXRlUHJvZmlsZVN0YXRlQ29udHJvbGxlcixcbiAgdHlwZSBQcm9maWxlU3RhdGVDb250cm9sbGVyXG59IGZyb20gXCIuL3Byb2ZpbGUtc3RhdGUtY29udHJvbGxlci5qc1wiO1xuaW1wb3J0IHtcbiAgY3JlYXRlU291cmNlRGVmYXVsdENvbnRyb2xsZXIsXG4gIHR5cGUgU291cmNlRGVmYXVsdENvbnRyb2xsZXJcbn0gZnJvbSBcIi4vc291cmNlLWRlZmF1bHQtY29udHJvbGxlci5qc1wiO1xuaW1wb3J0IHsgY3JlYXRlU3RhZ2VSZW5kZXJDb250cm9sbGVyIH0gZnJvbSBcIi4vc3RhZ2UtcmVuZGVyLWNvbnRyb2xsZXIuanNcIjtcbmltcG9ydCB7XG4gIGNyZWF0ZVByZXZpZXdTaGVsbENvbnRyb2xsZXIsXG4gIHR5cGUgUHJldmlld1NoZWxsQ29udHJvbGxlclxufSBmcm9tIFwiLi9wcmV2aWV3LXNoZWxsLWNvbnRyb2xsZXIuanNcIjtcbmltcG9ydCB7XG4gIGNyZWF0ZVN0YWdlTmV0d29ya092ZXJsYXlDb250cm9sbGVyLFxuICB0eXBlIFN0YWdlTmV0d29ya092ZXJsYXlDb250cm9sbGVyXG59IGZyb20gXCIuL3N0YWdlLW5ldHdvcmstb3ZlcmxheS1jb250cm9sbGVyLmpzXCI7XG5pbXBvcnQgeyBidWlsZEZ1enp5Qm9pZHNTZWN0aW9uIH0gZnJvbSBcIi4vZnV6enktYm9pZHMtc2VjdGlvbi5qc1wiO1xuaW1wb3J0IHsgYnVpbGRHcmlkU2VjdGlvbiB9IGZyb20gXCIuL2dyaWQtc2VjdGlvbi5qc1wiO1xuaW1wb3J0IHsgYnVpbGRIYWxvQ29uZmlnU2VjdGlvbiB9IGZyb20gXCIuL2hhbG8tY29uZmlnLXNlY3Rpb24uanNcIjtcbmltcG9ydCB7IGJ1aWxkT3ZlcmxheVNlY3Rpb24gfSBmcm9tIFwiLi9vdmVybGF5LXNlY3Rpb24uanNcIjtcbmltcG9ydCB7IGJ1aWxkUGh5bGxvdGF4aXNTZWN0aW9uIH0gZnJvbSBcIi4vcGh5bGxvdGF4aXMtc2VjdGlvbi5qc1wiO1xuaW1wb3J0IHsgYnVpbGRTY2F0dGVyU2VjdGlvbiB9IGZyb20gXCIuL3NjYXR0ZXItc2VjdGlvbi5qc1wiO1xuXG50eXBlIENvbmZpZ1NlY3Rpb25EZWZpbml0aW9uID0gUGFyYW1ldGVyU2VjdGlvbkRlZmluaXRpb247XG5cbmNvbnN0IElOSVRJQUxfUFJPRklMRV9LRVkgPSBcImluc3RhZ3JhbV8xMDgweDEzNTBcIjtcbmNvbnN0IElOSVRJQUxfRk9STUFUX0tFWSA9IFwiZ2VuZXJpY19zb2NpYWxcIjtcbmNvbnN0IE9WRVJMQVlfVklTSUJMRV9TVE9SQUdFX0tFWSA9IFwiYnJhbmQtbGF5b3V0LW9wcy1vdmVybGF5LXZpc2libGUtdjFcIjtcbmNvbnN0IE5FVFdPUktfT1ZFUkxBWV9WSVNJQkxFX1NUT1JBR0VfS0VZID0gXCJicmFuZC1sYXlvdXQtb3BzLW5ldHdvcmstb3ZlcmxheS12aXNpYmxlLXYxXCI7XG5jb25zdCBHVUlERV9NT0RFX1NUT1JBR0VfS0VZID0gXCJicmFuZC1sYXlvdXQtb3BzLWd1aWRlLW1vZGUtdjFcIjtcblxuY29uc3QgcGVyc2lzdGVkRm9ybWF0ID0gbG9hZE91dHB1dEZvcm1hdEtleXMoKTtcbmNvbnN0IHN0YXJ0UHJvZmlsZUtleSA9IHBlcnNpc3RlZEZvcm1hdD8ucHJvZmlsZUtleSA/PyBJTklUSUFMX1BST0ZJTEVfS0VZO1xuY29uc3Qgc3RhcnRGb3JtYXRLZXkgPSBwZXJzaXN0ZWRGb3JtYXQ/LmZvcm1hdEtleSA/PyBJTklUSUFMX0ZPUk1BVF9LRVk7XG5jb25zdCBJTklUSUFMX1BBUkFNUyA9IGNyZWF0ZURlZmF1bHRPdmVybGF5UGFyYW1zKHN0YXJ0UHJvZmlsZUtleSwgc3RhcnRGb3JtYXRLZXkpO1xuXG5mdW5jdGlvbiBub3JtYWxpemVHdWlkZU1vZGUocmF3R3VpZGVNb2RlOiB1bmtub3duKTogR3VpZGVNb2RlIHtcbiAgcmV0dXJuIHJhd0d1aWRlTW9kZSA9PT0gXCJvZmZcIiB8fCByYXdHdWlkZU1vZGUgPT09IFwiYmFzZWxpbmVcIlxuICAgID8gcmF3R3VpZGVNb2RlXG4gICAgOiBcImNvbXBvc2l0aW9uXCI7XG59XG5cbmNvbnN0IElOSVRJQUxfU09VUkNFX0RFRkFVTFRTID0gY3JlYXRlQnVpbHRJbk92ZXJsYXlTb3VyY2VEZWZhdWx0U25hcHNob3Q8RXhwb3J0U2V0dGluZ3MsIEhhbG9GaWVsZENvbmZpZywgR3VpZGVNb2RlPih7XG4gIG91dHB1dFByb2ZpbGVLZXk6IElOSVRJQUxfUFJPRklMRV9LRVksXG4gIGNvbnRlbnRGb3JtYXRLZXk6IElOSVRJQUxfRk9STUFUX0tFWSxcbiAgZ3VpZGVNb2RlOiBcImNvbXBvc2l0aW9uXCIsXG4gIGNyZWF0ZUV4cG9ydFNldHRpbmdzOiBjcmVhdGVEZWZhdWx0RXhwb3J0U2V0dGluZ3MsXG4gIGNyZWF0ZUhhbG9Db25maWc6IGdldEhhbG9Db25maWdGb3JQcm9maWxlXG59KTtcblxuY29uc3QgSU5JVElBTF9TT1VSQ0VfREVGQVVMVF9QUk9KRUNUID0gY3JlYXRlT3ZlcmxheURvY3VtZW50UHJvamVjdEZyb21TbmFwc2hvdChJTklUSUFMX1NPVVJDRV9ERUZBVUxUUyk7XG5jb25zdCBJTklUSUFMX0RPQ1VNRU5UX0ZPUk1BVF9JRCA9IElOSVRJQUxfU09VUkNFX0RFRkFVTFRfUFJPSkVDVC5hY3RpdmVUYXJnZXRJZDtcblxuY29uc3Qgc3RhdGU6IFByZXZpZXdTdGF0ZSA9IHtcbiAgcGFyYW1zOiBjbG9uZU92ZXJsYXlQYXJhbXMoSU5JVElBTF9QQVJBTVMpLFxuICBzZWxlY3RlZDogbnVsbCxcbiAgZ3VpZGVNb2RlOiBub3JtYWxpemVHdWlkZU1vZGUobG9jYWxTdG9yYWdlLmdldEl0ZW0oR1VJREVfTU9ERV9TVE9SQUdFX0tFWSkgPz8gXCJjb21wb3NpdGlvblwiKSxcbiAgb3ZlcmxheVZpc2libGU6IGxvY2FsU3RvcmFnZS5nZXRJdGVtKE9WRVJMQVlfVklTSUJMRV9TVE9SQUdFX0tFWSkgIT09IFwiMFwiLFxuICBuZXR3b3JrT3ZlcmxheVZpc2libGU6IGxvY2FsU3RvcmFnZS5nZXRJdGVtKE5FVFdPUktfT1ZFUkxBWV9WSVNJQkxFX1NUT1JBR0VfS0VZKSA9PT0gXCIxXCIsXG4gIHBlbmRpbmdDc3ZEcmFmdHNCeUJ1Y2tldDoge30sXG4gIG91dHB1dFByb2ZpbGVLZXk6IHN0YXJ0UHJvZmlsZUtleSxcbiAgY29udGVudEZvcm1hdEtleTogc3RhcnRGb3JtYXRLZXksXG4gIGRvY3VtZW50Rm9ybWF0QnVja2V0czoge1xuICAgIFtJTklUSUFMX0RPQ1VNRU5UX0ZPUk1BVF9JRF06IHtcbiAgICAgIFtzdGFydEZvcm1hdEtleV06IGNsb25lT3ZlcmxheVBhcmFtcyhJTklUSUFMX1BBUkFNUylcbiAgICB9XG4gIH0sXG4gIGNvbnRlbnRGb3JtYXRLZXlCeURvY3VtZW50Rm9ybWF0SWQ6IHtcbiAgICBbSU5JVElBTF9ET0NVTUVOVF9GT1JNQVRfSURdOiBzdGFydEZvcm1hdEtleVxuICB9LFxuICBleHBvcnRTZXR0aW5nczogY3JlYXRlRGVmYXVsdEV4cG9ydFNldHRpbmdzKHN0YXJ0UHJvZmlsZUtleSksXG4gIGV4cG9ydFNldHRpbmdzQnlEb2N1bWVudEZvcm1hdElkOiB7XG4gICAgW0lOSVRJQUxfRE9DVU1FTlRfRk9STUFUX0lEXTogY3JlYXRlRGVmYXVsdEV4cG9ydFNldHRpbmdzKHN0YXJ0UHJvZmlsZUtleSlcbiAgfSxcbiAgaGFsb0NvbmZpZzogZ2V0SGFsb0NvbmZpZ0ZvclByb2ZpbGUoc3RhcnRQcm9maWxlS2V5KSxcbiAgaGFsb0NvbmZpZ0J5RG9jdW1lbnRGb3JtYXRJZDoge1xuICAgIFtJTklUSUFMX0RPQ1VNRU5UX0ZPUk1BVF9JRF06IGdldEhhbG9Db25maWdGb3JQcm9maWxlKHN0YXJ0UHJvZmlsZUtleSlcbiAgfSxcbiAgc291cmNlRGVmYXVsdHM6IGNsb25lT3ZlcmxheVNvdXJjZURlZmF1bHRTbmFwc2hvdChJTklUSUFMX1NPVVJDRV9ERUZBVUxUUyksXG4gIHNvdXJjZURlZmF1bHRQcm9qZWN0OiBjbG9uZU92ZXJsYXlEb2N1bWVudFByb2plY3QoSU5JVElBTF9TT1VSQ0VfREVGQVVMVF9QUk9KRUNUKSxcbiAgZG9jdW1lbnRQcm9qZWN0OiBjbG9uZU92ZXJsYXlEb2N1bWVudFByb2plY3QoSU5JVElBTF9TT1VSQ0VfREVGQVVMVF9QUk9KRUNUKSxcbiAgc2VsZWN0ZWRCYWNrZ3JvdW5kTm9kZUlkOiBJTklUSUFMX1NPVVJDRV9ERUZBVUxUX1BST0pFQ1QuYmFja2dyb3VuZEdyYXBoLmFjdGl2ZU5vZGVJZCxcbiAgc2VsZWN0ZWRPcGVyYXRvcklkOiBPVkVSTEFZX0xBWU9VVF9PUEVSQVRPUl9TRUxFQ1RJT05fSUQsXG4gIGlzUGxheWluZzogdHJ1ZSxcbiAgcGxheWJhY2tUaW1lU2VjOiAwXG59O1xuXG5jb25zdCBiYWNrZ3JvdW5kR3JhcGhDb250cm9sbGVyID0gY3JlYXRlQmFja2dyb3VuZEdyYXBoQ29udHJvbGxlcih7IHN0YXRlIH0pO1xuXG5jb25zdCBwcmV2aWV3RG9jdW1lbnRCcmlkZ2UgPSB7XG4gIHBlcnNpc3RBY3RpdmVEb2N1bWVudEZvcm1hdEJ1Y2tldHMsXG4gIHBlcnNpc3RBY3RpdmVFeHBvcnRTZXR0aW5ncyxcbiAgcGVyc2lzdEFjdGl2ZUhhbG9Db25maWcsXG4gIGdldE9yQ3JlYXRlRG9jdW1lbnRGb3JtYXRQYXJhbXMsXG4gIG5vcm1hbGl6ZVBhcmFtczogbm9ybWFsaXplUGFyYW1zVGV4dEZpZWxkT2Zmc2V0cyxcbiAgc3luY0hhbG9Db25maWdGb3JBY3RpdmVEb2N1bWVudEZvcm1hdFxufTtcblxubGV0IHByZXZpZXdTaGVsbENvbnRyb2xsZXI6IFByZXZpZXdTaGVsbENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcbmxldCBuZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXI6IFN0YWdlTmV0d29ya092ZXJsYXlDb250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG5cbmNvbnN0IGRvY3VtZW50V29ya3NwYWNlQ29udHJvbGxlciA9IGNyZWF0ZURvY3VtZW50V29ya3NwYWNlQ29udHJvbGxlcjxPdmVybGF5UHJldmlld0RvY3VtZW50Pih7XG4gIHVudGl0bGVkTmFtZTogVU5USVRMRURfRE9DVU1FTlRfTkFNRSxcbiAgaW5pdGlhbFN0YXR1c01lc3NhZ2U6IFwiT3BlbiBvciBzYXZlIGEgbG9jYWwgZG9jdW1lbnQgZmlsZS5cIixcbiAgcGFyc2VEb2N1bWVudDogc2FuaXRpemVQcmV2aWV3RG9jdW1lbnQsXG4gIGdldERvY3VtZW50TWV0YWRhdGE6IChwcmV2aWV3RG9jdW1lbnQpID0+IHByZXZpZXdEb2N1bWVudC5kb2N1bWVudC5tZXRhZGF0YSxcbiAgYnVpbGRQZXJzaXN0ZWREb2N1bWVudDogYnVpbGRDdXJyZW50RG9jdW1lbnRQZXJzaXN0ZW5jZSxcbiAgYXBwbHlEb2N1bWVudDogYXBwbHlQcmV2aWV3RG9jdW1lbnRUb1N0YXRlLFxuICBhcHBseU5ld0RvY3VtZW50U3RhdGUsXG4gIG9uV29ya3NwYWNlQ2hhbmdlOiAoKSA9PiB7XG4gICAgcHJldmlld1NoZWxsQ29udHJvbGxlcj8udXBkYXRlRG9jdW1lbnRVaSgpO1xuICB9XG59KTtcblxubGV0IGxvZ29JbnRyaW5zaWNXaWR0aCA9IDA7XG5sZXQgbG9nb0ludHJpbnNpY0hlaWdodCA9IDA7XG5sZXQgZXhwb3J0QXV0b21hdGlvbkNvbnRyb2xsZXI6IEV4cG9ydEF1dG9tYXRpb25Db250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG5sZXQgYXV0aG9yaW5nQ29udHJvbGxlcjogQXV0aG9yaW5nSW50ZXJhY3Rpb25Db250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG5sZXQgc291cmNlRGVmYXVsdENvbnRyb2xsZXI6IFNvdXJjZURlZmF1bHRDb250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG5sZXQgY3N2RHJhZnRDb250cm9sbGVyOiBDc3ZEcmFmdENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcbmxldCBwbGF5YmFja0NvbnRyb2xsZXI6IFBsYXliYWNrQ29udHJvbGxlciB8IG51bGwgPSBudWxsO1xubGV0IG92ZXJsYXlFZGl0aW5nQ29udHJvbGxlcjogT3ZlcmxheUVkaXRpbmdDb250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG5sZXQgY29uZmlnRWRpdG9yQ29udHJvbGxlcjogQ29uZmlnRWRpdG9yQ29udHJvbGxlciB8IG51bGwgPSBudWxsO1xubGV0IGRvY3VtZW50Rm9ybWF0Q29udHJvbGxlcjogRG9jdW1lbnRGb3JtYXRDb250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG5sZXQgcHJvZmlsZVN0YXRlQ29udHJvbGxlcjogUHJvZmlsZVN0YXRlQ29udHJvbGxlciB8IG51bGwgPSBudWxsO1xubGV0IGRvY3VtZW50U3RhdGVDb250cm9sbGVyOiBQcmV2aWV3RG9jdW1lbnRTdGF0ZUNvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcblxuY29uc3QgJCA9IDxUIGV4dGVuZHMgRWxlbWVudD4oc2VsZWN0b3I6IHN0cmluZyk6IFQgfCBudWxsID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8VD4oc2VsZWN0b3IpO1xuXG5mdW5jdGlvbiBnZXRTdGFnZUVsKCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIHJldHVybiAkKFwiW2RhdGEtc3RhZ2VdXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRTdGFnZVNoZWxsRWwoKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgcmV0dXJuICQoXCJbZGF0YS1zdGFnZS1zaGVsbF1cIik7XG59XG5cbmZ1bmN0aW9uIGdldENhbnZhc0VsKCk6IEhUTUxDYW52YXNFbGVtZW50IHwgbnVsbCB7XG4gIHJldHVybiAkKFwiW2RhdGEtc3RhZ2UtY2FudmFzXVwiKTtcbn1cblxuZnVuY3Rpb24gZ2V0U2NlbmVQcmV2aWV3Q2FudmFzKCk6IEhUTUxDYW52YXNFbGVtZW50IHwgbnVsbCB7XG4gIHJldHVybiAkKFwiW2RhdGEtc2NlbmUtcHJldmlld11cIik7XG59XG5cbmZ1bmN0aW9uIGdldFNjZW5lUHJldmlld0dwdUNhbnZhcygpOiBIVE1MQ2FudmFzRWxlbWVudCB8IG51bGwge1xuICByZXR1cm4gJChcIltkYXRhLXNjZW5lLXByZXZpZXctZ3B1XVwiKTtcbn1cblxuZnVuY3Rpb24gZ2V0VGV4dE92ZXJsYXlDYW52YXMoKTogSFRNTENhbnZhc0VsZW1lbnQgfCBudWxsIHtcbiAgcmV0dXJuICQoXCJbZGF0YS10ZXh0LW92ZXJsYXldXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRTdmdPdmVybGF5KCk6IFNWR1NWR0VsZW1lbnQgfCBudWxsIHtcbiAgcmV0dXJuICQoXCJbZGF0YS1zdmctb3ZlcmxheV1cIik7XG59XG5cbmZ1bmN0aW9uIGdldEF1dGhvcmluZ0xheWVyRWwoKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgcmV0dXJuICQoXCJbZGF0YS1hdXRob3JpbmctbGF5ZXJdXCIpO1xufVxuXG5mdW5jdGlvbiBnZXROZXR3b3JrT3ZlcmxheUVsKCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIHJldHVybiAkKFwiW2RhdGEtbmV0d29yay1vdmVybGF5XVwiKTtcbn1cblxuZnVuY3Rpb24gZ2V0Q29uZmlnRWRpdG9yKCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIHJldHVybiAkKFwiW2RhdGEtY29uZmlnLWVkaXRvcl1cIik7XG59XG5cbmZ1bmN0aW9uIGdldEZvcm1hdE9wdGlvbnMoKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgcmV0dXJuICQoXCJbZGF0YS1mb3JtYXQtb3B0aW9uc11cIik7XG59XG5cbmZ1bmN0aW9uIGdldE92ZXJsYXlWaXNpYmlsaXR5SW5wdXQoKTogSFRNTElucHV0RWxlbWVudCB8IG51bGwge1xuICByZXR1cm4gJChcIltkYXRhLW92ZXJsYXktdmlzaWJpbGl0eV1cIik7XG59XG5cbmNvbnN0IHN0YWdlUmVuZGVyQ29udHJvbGxlciA9IGNyZWF0ZVN0YWdlUmVuZGVyQ29udHJvbGxlcih7XG4gIHN0YXRlLFxuICBnZXRTdGFnZVNoZWxsRWwsXG4gIGdldFN0YWdlRWwsXG4gIGdldENhbnZhc0VsLFxuICBnZXRTY2VuZVByZXZpZXdDYW52YXMsXG4gIGdldFNjZW5lUHJldmlld0dwdUNhbnZhcyxcbiAgZ2V0VGV4dE92ZXJsYXlDYW52YXMsXG4gIGdldFN2Z092ZXJsYXksXG4gIGdldEVmZmVjdGl2ZVBhcmFtcyxcbiAgb25BdXRob3JpbmdSZW5kZXI6ICgpID0+IHtcbiAgICBhdXRob3JpbmdDb250cm9sbGVyPy5yZW5kZXIoKTtcbiAgfVxufSk7XG5cbnByb2ZpbGVTdGF0ZUNvbnRyb2xsZXIgPSBjcmVhdGVQcm9maWxlU3RhdGVDb250cm9sbGVyKHtcbiAgc3RhdGUsXG4gIGNyZWF0ZURlZmF1bHRFeHBvcnRTZXR0aW5ncyxcbiAgZ2V0SGFsb0NvbmZpZ0ZvclByb2ZpbGUsXG4gIG5vcm1hbGl6ZVBhcmFtc1RleHRGaWVsZE9mZnNldHMsXG4gIGdldEVmZmVjdGl2ZVBhcmFtcyxcbiAgbm9ybWFsaXplU2VsZWN0aW9uLFxuICByZXNpemVSZW5kZXJlcixcbiAgcmVuZGVyU3RhZ2UsXG4gIHN5bmNEb2N1bWVudFByb2plY3RUb0N1cnJlbnRPdXRwdXRQcm9maWxlLFxuICBzYXZlT3V0cHV0Rm9ybWF0S2V5XG59KTtcblxuc3luY0hhbG9Db25maWdGb3JBY3RpdmVEb2N1bWVudEZvcm1hdCgpO1xuXG5mdW5jdGlvbiBnZXROb3JtYWxpemVkRG9jdW1lbnROYW1lKHJhd05hbWU6IHN0cmluZyA9IGRvY3VtZW50V29ya3NwYWNlQ29udHJvbGxlci5zdGF0ZS5uYW1lKTogc3RyaW5nIHtcbiAgcmV0dXJuIGRvY3VtZW50V29ya3NwYWNlQ29udHJvbGxlci5nZXROb3JtYWxpemVkTmFtZShyYXdOYW1lKTtcbn1cblxuZnVuY3Rpb24gbG9hZExvZ29JbnRyaW5zaWNEaW1lbnNpb25zKGFzc2V0UGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgIGlmICghYXNzZXRQYXRoKSB7XG4gICAgICBsb2dvSW50cmluc2ljV2lkdGggPSAwO1xuICAgICAgbG9nb0ludHJpbnNpY0hlaWdodCA9IDA7XG4gICAgICByZXNvbHZlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgaW1hZ2UgPSBuZXcgSW1hZ2UoKTtcbiAgICBpbWFnZS5kZWNvZGluZyA9IFwiYXN5bmNcIjtcbiAgICBpbWFnZS5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCAoKSA9PiB7XG4gICAgICBsb2dvSW50cmluc2ljV2lkdGggPSBpbWFnZS5uYXR1cmFsV2lkdGg7XG4gICAgICBsb2dvSW50cmluc2ljSGVpZ2h0ID0gaW1hZ2UubmF0dXJhbEhlaWdodDtcbiAgICAgIHJlc29sdmUoKTtcbiAgICB9KTtcbiAgICBpbWFnZS5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgKCkgPT4ge1xuICAgICAgbG9nb0ludHJpbnNpY1dpZHRoID0gMDtcbiAgICAgIGxvZ29JbnRyaW5zaWNIZWlnaHQgPSAwO1xuICAgICAgcmVzb2x2ZSgpO1xuICAgIH0pO1xuICAgIGltYWdlLnNyYyA9IGFzc2V0UGF0aDtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIG1hcmtEb2N1bWVudERpcnR5KCk6IHZvaWQge1xuICBkb2N1bWVudFdvcmtzcGFjZUNvbnRyb2xsZXIubWFya0RpcnR5KCk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZURvY3VtZW50VWkoKTogdm9pZCB7XG4gIHByZXZpZXdTaGVsbENvbnRyb2xsZXI/LnVwZGF0ZURvY3VtZW50VWkoKTtcbn1cblxuZnVuY3Rpb24gZ2V0Q3N2RHJhZnRCdWNrZXRLZXkoZm9ybWF0SWQ/OiBzdHJpbmcsIGZvcm1hdEtleT86IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBjc3ZEcmFmdENvbnRyb2xsZXIhLmdldENzdkRyYWZ0QnVja2V0S2V5KGZvcm1hdElkLCBmb3JtYXRLZXkpO1xufVxuXG5mdW5jdGlvbiBnZXRTdGFnZWRDc3ZEcmFmdChmb3JtYXRJZD86IHN0cmluZywgZm9ybWF0S2V5Pzogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gIHJldHVybiBjc3ZEcmFmdENvbnRyb2xsZXIhLmdldFN0YWdlZENzdkRyYWZ0KGZvcm1hdElkLCBmb3JtYXRLZXkpO1xufVxuXG5mdW5jdGlvbiBzZXRTdGFnZWRDc3ZEcmFmdChkcmFmdDogc3RyaW5nIHwgbnVsbCwgZm9ybWF0SWQ/OiBzdHJpbmcsIGZvcm1hdEtleT86IHN0cmluZyk6IHZvaWQge1xuICBjc3ZEcmFmdENvbnRyb2xsZXIhLnNldFN0YWdlZENzdkRyYWZ0KGRyYWZ0LCBmb3JtYXRJZCwgZm9ybWF0S2V5KTtcbn1cblxuZnVuY3Rpb24gZ2V0T3ZlcmxheUZvcm1hdENzdlBhdGgoZm9ybWF0S2V5OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgcmV0dXJuIGNzdkRyYWZ0Q29udHJvbGxlciEuZ2V0T3ZlcmxheUZvcm1hdENzdlBhdGgoZm9ybWF0S2V5KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZmx1c2hQZW5kaW5nQ3N2RHJhZnRzKCk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgcmV0dXJuIGNzdkRyYWZ0Q29udHJvbGxlciEuZmx1c2hQZW5kaW5nQ3N2RHJhZnRzKCk7XG59XG5cbmZ1bmN0aW9uIGdldEVmZmVjdGl2ZVBhcmFtcygpOiBPdmVybGF5TGF5b3V0T3BlcmF0b3JQYXJhbXMge1xuICBjb25zdCBzdGFnZWRDc3ZEcmFmdCA9IGdldFN0YWdlZENzdkRyYWZ0KCk7XG4gIGlmIChnZXRDb250ZW50U291cmNlKCkgIT09IFwiY3N2XCIgfHwgc3RhZ2VkQ3N2RHJhZnQgPT09IG51bGwpIHtcbiAgICByZXR1cm4gbm9ybWFsaXplUGFyYW1zVGV4dEZpZWxkT2Zmc2V0cyhzdGF0ZS5wYXJhbXMpO1xuICB9XG5cbiAgcmV0dXJuIG5vcm1hbGl6ZVBhcmFtc1RleHRGaWVsZE9mZnNldHMoe1xuICAgIC4uLnN0YXRlLnBhcmFtcyxcbiAgICBjc3ZDb250ZW50OiB7XG4gICAgICBkcmFmdDogc3RhZ2VkQ3N2RHJhZnQsXG4gICAgICByb3dJbmRleDogc3RhdGUucGFyYW1zLmNzdkNvbnRlbnQ/LnJvd0luZGV4ID8/IDFcbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBnZXRDb250ZW50U291cmNlKCk6IE92ZXJsYXlDb250ZW50U291cmNlIHtcbiAgcmV0dXJuIHN0YXRlLnBhcmFtcy5jb250ZW50U291cmNlID09PSBcImNzdlwiID8gXCJjc3ZcIiA6IFwiaW5saW5lXCI7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVNlbGVjdGVkQmFja2dyb3VuZE5vZGVJZChcbiAgcHJlZmVycmVkTm9kZUlkOiBzdHJpbmcgfCBudWxsID0gc3RhdGUuc2VsZWN0ZWRCYWNrZ3JvdW5kTm9kZUlkXG4pOiBzdHJpbmcgfCBudWxsIHtcbiAgcmV0dXJuIGJhY2tncm91bmRHcmFwaENvbnRyb2xsZXIubm9ybWFsaXplU2VsZWN0ZWRCYWNrZ3JvdW5kTm9kZUlkKHByZWZlcnJlZE5vZGVJZCk7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVNlbGVjdGVkT3BlcmF0b3JJZChcbiAgcHJlZmVycmVkT3BlcmF0b3JJZDogc3RyaW5nIHwgbnVsbCA9IHN0YXRlLnNlbGVjdGVkT3BlcmF0b3JJZFxuKTogU2VsZWN0ZWRPcGVyYXRvcklkIHtcbiAgcmV0dXJuIGJhY2tncm91bmRHcmFwaENvbnRyb2xsZXIubm9ybWFsaXplU2VsZWN0ZWRPcGVyYXRvcklkKHByZWZlcnJlZE9wZXJhdG9ySWQpO1xufVxuXG5mdW5jdGlvbiBnZXRBdmFpbGFibGVCYWNrZ3JvdW5kT3BlcmF0b3JLZXlzKCk6IE92ZXJsYXlCYWNrZ3JvdW5kT3BlcmF0b3JLZXlbXSB7XG4gIHJldHVybiBiYWNrZ3JvdW5kR3JhcGhDb250cm9sbGVyLmdldEF2YWlsYWJsZUJhY2tncm91bmRPcGVyYXRvcktleXMoKTtcbn1cblxuZnVuY3Rpb24gc2V0U2VsZWN0ZWRPcGVyYXRvcihvcGVyYXRvcklkOiBzdHJpbmcgfCBudWxsKTogYm9vbGVhbiB7XG4gIGNvbnN0IGRpZENoYW5nZSA9IGJhY2tncm91bmRHcmFwaENvbnRyb2xsZXIuc2V0U2VsZWN0ZWRPcGVyYXRvcihvcGVyYXRvcklkKTtcbiAgbmV0d29ya092ZXJsYXlDb250cm9sbGVyPy5yZW5kZXIoKTtcbiAgcmV0dXJuIGRpZENoYW5nZTtcbn1cblxuZnVuY3Rpb24gZ2V0U2VsZWN0ZWRPcGVyYXRvcklkKCk6IFNlbGVjdGVkT3BlcmF0b3JJZCB7XG4gIHJldHVybiBiYWNrZ3JvdW5kR3JhcGhDb250cm9sbGVyLmdldFNlbGVjdGVkT3BlcmF0b3JJZCgpO1xufVxuXG5mdW5jdGlvbiBzZXRTZWxlY3RlZEJhY2tncm91bmROb2RlKG5vZGVJZDogc3RyaW5nIHwgbnVsbCk6IGJvb2xlYW4ge1xuICByZXR1cm4gYmFja2dyb3VuZEdyYXBoQ29udHJvbGxlci5zZXRTZWxlY3RlZEJhY2tncm91bmROb2RlKG5vZGVJZCk7XG59XG5cbmZ1bmN0aW9uIGdldFNlbGVjdGVkQmFja2dyb3VuZE5vZGUoKTogT3ZlcmxheUJhY2tncm91bmROb2RlIHwgbnVsbCB7XG4gIHJldHVybiBiYWNrZ3JvdW5kR3JhcGhDb250cm9sbGVyLmdldFNlbGVjdGVkQmFja2dyb3VuZE5vZGUoKTtcbn1cblxuZnVuY3Rpb24gZ2V0U2VsZWN0ZWRPcGVyYXRvckdyb3VwKCk6IHN0cmluZyB7XG4gIHJldHVybiBiYWNrZ3JvdW5kR3JhcGhDb250cm9sbGVyLmdldFNlbGVjdGVkT3BlcmF0b3JHcm91cCgpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVTZWxlY3RlZEJhY2tncm91bmROb2RlKFxuICB1cGRhdGVyOiAobm9kZTogT3ZlcmxheUJhY2tncm91bmROb2RlKSA9PiBPdmVybGF5QmFja2dyb3VuZE5vZGVcbik6IGJvb2xlYW4ge1xuICByZXR1cm4gYmFja2dyb3VuZEdyYXBoQ29udHJvbGxlci51cGRhdGVTZWxlY3RlZEJhY2tncm91bmROb2RlKHVwZGF0ZXIpO1xufVxuXG5mdW5jdGlvbiBjb25uZWN0QmFja2dyb3VuZEVkZ2UoZWRnZTogT3ZlcmxheUJhY2tncm91bmRFZGdlKTogYm9vbGVhbiB7XG4gIGNvbnN0IGRpZENvbm5lY3QgPSBiYWNrZ3JvdW5kR3JhcGhDb250cm9sbGVyLmNvbm5lY3RCYWNrZ3JvdW5kRWRnZShlZGdlKTtcbiAgbmV0d29ya092ZXJsYXlDb250cm9sbGVyPy5yZW5kZXIoKTtcbiAgcmV0dXJuIGRpZENvbm5lY3Q7XG59XG5cbmZ1bmN0aW9uIGRpc2Nvbm5lY3RCYWNrZ3JvdW5kSW5wdXQobm9kZUlkOiBzdHJpbmcsIHBvcnRLZXk6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCBkaWREaXNjb25uZWN0ID0gYmFja2dyb3VuZEdyYXBoQ29udHJvbGxlci5kaXNjb25uZWN0QmFja2dyb3VuZElucHV0KG5vZGVJZCwgcG9ydEtleSk7XG4gIG5ldHdvcmtPdmVybGF5Q29udHJvbGxlcj8ucmVuZGVyKCk7XG4gIHJldHVybiBkaWREaXNjb25uZWN0O1xufVxuXG5mdW5jdGlvbiBzeW5jRG9jdW1lbnRCYWNrZ3JvdW5kR3JhcGgoKTogdm9pZCB7XG4gIGJhY2tncm91bmRHcmFwaENvbnRyb2xsZXIuc3luY0RvY3VtZW50QmFja2dyb3VuZEdyYXBoKCk7XG4gIG5ldHdvcmtPdmVybGF5Q29udHJvbGxlcj8ucmVuZGVyKCk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUJhY2tncm91bmROb2RlKG5vZGVJZDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IGRpZFJlbW92ZSA9IGJhY2tncm91bmRHcmFwaENvbnRyb2xsZXIucmVtb3ZlQmFja2dyb3VuZE5vZGUobm9kZUlkKTtcbiAgbmV0d29ya092ZXJsYXlDb250cm9sbGVyPy5yZW5kZXIoKTtcbiAgcmV0dXJuIGRpZFJlbW92ZTtcbn1cblxuZnVuY3Rpb24gYWRkQmFja2dyb3VuZE5vZGUob3BlcmF0b3JLZXk6IE92ZXJsYXlCYWNrZ3JvdW5kT3BlcmF0b3JLZXkpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgbmV4dE5vZGVJZCA9IGJhY2tncm91bmRHcmFwaENvbnRyb2xsZXIuYWRkQmFja2dyb3VuZE5vZGUob3BlcmF0b3JLZXkpO1xuICBuZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXI/LnJlbmRlcigpO1xuICByZXR1cm4gbmV4dE5vZGVJZDtcbn1cblxuZnVuY3Rpb24gZ2V0UmVzb2x2ZWRUZXh0RmllbGRUZXh0KGZpZWxkOiBUZXh0RmllbGRQbGFjZW1lbnRTcGVjKTogc3RyaW5nIHtcbiAgcmV0dXJuIHJlc29sdmVPdmVybGF5VGV4dFZhbHVlKGdldEVmZmVjdGl2ZVBhcmFtcygpLCBmaWVsZCk7XG59XG5cbmZ1bmN0aW9uIGhhc1N0YWdlZENzdkRyYWZ0KCk6IGJvb2xlYW4ge1xuICByZXR1cm4gY3N2RHJhZnRDb250cm9sbGVyIS5oYXNTdGFnZWRDc3ZEcmFmdCgpO1xufVxuXG5mdW5jdGlvbiBnZXREb2N1bWVudEZvcm1hdEJ1Y2tldChmb3JtYXRJZDogc3RyaW5nKTogUmVjb3JkPHN0cmluZywgT3ZlcmxheUxheW91dE9wZXJhdG9yUGFyYW1zPiB7XG4gIHJldHVybiBwcm9maWxlU3RhdGVDb250cm9sbGVyIS5nZXREb2N1bWVudEZvcm1hdEJ1Y2tldChmb3JtYXRJZCk7XG59XG5cbmZ1bmN0aW9uIHBlcnNpc3RBY3RpdmVFeHBvcnRTZXR0aW5ncygpOiB2b2lkIHtcbiAgcHJvZmlsZVN0YXRlQ29udHJvbGxlciEucGVyc2lzdEFjdGl2ZUV4cG9ydFNldHRpbmdzKCk7XG59XG5cbmZ1bmN0aW9uIHBlcnNpc3RBY3RpdmVIYWxvQ29uZmlnKCk6IHZvaWQge1xuICBwcm9maWxlU3RhdGVDb250cm9sbGVyIS5wZXJzaXN0QWN0aXZlSGFsb0NvbmZpZygpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVFeHBvcnRTZXR0aW5ncyh1cGRhdGVyOiAoc2V0dGluZ3M6IEV4cG9ydFNldHRpbmdzKSA9PiBFeHBvcnRTZXR0aW5ncyk6IHZvaWQge1xuICBwcm9maWxlU3RhdGVDb250cm9sbGVyIS51cGRhdGVFeHBvcnRTZXR0aW5ncyh1cGRhdGVyKTtcbn1cblxuZnVuY3Rpb24gcGVyc2lzdEFjdGl2ZURvY3VtZW50Rm9ybWF0QnVja2V0cygpOiB2b2lkIHtcbiAgcHJvZmlsZVN0YXRlQ29udHJvbGxlciEucGVyc2lzdEFjdGl2ZURvY3VtZW50Rm9ybWF0QnVja2V0cygpO1xufVxuXG5mdW5jdGlvbiBnZXRPckNyZWF0ZURvY3VtZW50Rm9ybWF0UGFyYW1zKFxuICBmb3JtYXRJZDogc3RyaW5nLFxuICBmb3JtYXRLZXk6IHN0cmluZ1xuKTogT3ZlcmxheUxheW91dE9wZXJhdG9yUGFyYW1zIHtcbiAgcmV0dXJuIHByb2ZpbGVTdGF0ZUNvbnRyb2xsZXIhLmdldE9yQ3JlYXRlRG9jdW1lbnRGb3JtYXRQYXJhbXMoZm9ybWF0SWQsIGZvcm1hdEtleSk7XG59XG5cbmZ1bmN0aW9uIHN5bmNIYWxvQ29uZmlnRm9yQWN0aXZlRG9jdW1lbnRGb3JtYXQoKSB7XG4gIHByb2ZpbGVTdGF0ZUNvbnRyb2xsZXIhLnN5bmNIYWxvQ29uZmlnRm9yQWN0aXZlRG9jdW1lbnRGb3JtYXQoKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplU2VsZWN0aW9uKCkge1xuICBpZiAoIXN0YXRlLnNlbGVjdGVkKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKHN0YXRlLnNlbGVjdGVkLmtpbmQgPT09IFwibG9nb1wiKSB7XG4gICAgaWYgKCFzdGF0ZS5wYXJhbXMubG9nbykge1xuICAgICAgc3RhdGUuc2VsZWN0ZWQgPSBudWxsO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoc3RhdGUucGFyYW1zLnRleHRGaWVsZHMuc29tZSgoZmllbGQpID0+IGZpZWxkLmlkID09PSBzdGF0ZS5zZWxlY3RlZD8uaWQpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgc3RhdGUuc2VsZWN0ZWQgPSBudWxsO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVTZWxlY3RlZFRleHRWYWx1ZShpZDogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKSB7XG4gIG92ZXJsYXlFZGl0aW5nQ29udHJvbGxlciEudXBkYXRlU2VsZWN0ZWRUZXh0VmFsdWUoaWQsIHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplUGFyYW1zVGV4dEZpZWxkT2Zmc2V0cyhwYXJhbXM6IE92ZXJsYXlMYXlvdXRPcGVyYXRvclBhcmFtcyk6IE92ZXJsYXlMYXlvdXRPcGVyYXRvclBhcmFtcyB7XG4gIHJldHVybiBub3JtYWxpemVPdmVybGF5UGFyYW1zRm9yRWRpdGluZyhwYXJhbXMpO1xufVxuXG5mdW5jdGlvbiBnZXREaXNwbGF5ZWRUZXh0RmllbGRPZmZzZXRCYXNlbGluZXMoZmllbGQ6IFRleHRGaWVsZFBsYWNlbWVudFNwZWMpOiBudW1iZXIge1xuICByZXR1cm4gb3ZlcmxheUVkaXRpbmdDb250cm9sbGVyIS5nZXREaXNwbGF5ZWRUZXh0RmllbGRPZmZzZXRCYXNlbGluZXMoZmllbGQpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVUZXh0RmllbGQoXG4gIGlkOiBzdHJpbmcsXG4gIHVwZGF0ZXI6IChmaWVsZDogVGV4dEZpZWxkUGxhY2VtZW50U3BlYykgPT4gVGV4dEZpZWxkUGxhY2VtZW50U3BlY1xuKSB7XG4gIG92ZXJsYXlFZGl0aW5nQ29udHJvbGxlciEudXBkYXRlVGV4dEZpZWxkKGlkLCB1cGRhdGVyKTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlVGV4dFN0eWxlKGtleTogc3RyaW5nLCB1cGRhdGVyOiAoc3R5bGU6IFRleHRTdHlsZVNwZWMpID0+IFRleHRTdHlsZVNwZWMpIHtcbiAgb3ZlcmxheUVkaXRpbmdDb250cm9sbGVyIS51cGRhdGVUZXh0U3R5bGUoa2V5LCB1cGRhdGVyKTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlTG9nbyh1cGRhdGVyOiAobG9nbzogTG9nb1BsYWNlbWVudFNwZWMpID0+IExvZ29QbGFjZW1lbnRTcGVjKSB7XG4gIG92ZXJsYXlFZGl0aW5nQ29udHJvbGxlciEudXBkYXRlTG9nbyh1cGRhdGVyKTtcbn1cblxuZnVuY3Rpb24gZ2V0Q3VycmVudExvZ29Bc3BlY3RSYXRpbygpOiBudW1iZXIge1xuICByZXR1cm4gb3ZlcmxheUVkaXRpbmdDb250cm9sbGVyIS5nZXRDdXJyZW50TG9nb0FzcGVjdFJhdGlvKCk7XG59XG5cbmZ1bmN0aW9uIHN5bmNMb2dvVG9UaXRsZUZvbnRTaXplKHRpdGxlRm9udFNpemVQeDogbnVtYmVyKSB7XG4gIG92ZXJsYXlFZGl0aW5nQ29udHJvbGxlciEuc3luY0xvZ29Ub1RpdGxlRm9udFNpemUodGl0bGVGb250U2l6ZVB4KTtcbn1cblxuZnVuY3Rpb24gc3luY1RpdGxlVG9Mb2dvSGVpZ2h0KGxvZ29IZWlnaHRQeDogbnVtYmVyKSB7XG4gIG92ZXJsYXlFZGl0aW5nQ29udHJvbGxlciEuc3luY1RpdGxlVG9Mb2dvSGVpZ2h0KGxvZ29IZWlnaHRQeCk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUxvZ29TaXplV2l0aEFzcGVjdFJhdGlvKG5leHRIZWlnaHRQeDogbnVtYmVyKSB7XG4gIG92ZXJsYXlFZGl0aW5nQ29udHJvbGxlciEudXBkYXRlTG9nb1NpemVXaXRoQXNwZWN0UmF0aW8obmV4dEhlaWdodFB4KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlT3ZlcmxheUl0ZW1BY3Rpb25Sb3coKTogSFRNTEVsZW1lbnQge1xuICByZXR1cm4gb3ZlcmxheUVkaXRpbmdDb250cm9sbGVyIS5jcmVhdGVPdmVybGF5SXRlbUFjdGlvblJvdygpO1xufVxuXG5mdW5jdGlvbiBzZWxlY3Qoc2VsOiBTZWxlY3Rpb24gfCBudWxsKSB7XG4gIHN0YXRlLnNlbGVjdGVkID0gc2VsO1xuICBpZiAoYXV0aG9yaW5nQ29udHJvbGxlcikge1xuICAgIGF1dGhvcmluZ0NvbnRyb2xsZXIuaGFuZGxlU2VsZWN0aW9uQ2hhbmdlKCk7XG4gICAgbmV0d29ya092ZXJsYXlDb250cm9sbGVyPy5yZW5kZXIoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgYnVpbGRDb25maWdFZGl0b3IoKTtcbiAgbmV0d29ya092ZXJsYXlDb250cm9sbGVyPy5yZW5kZXIoKTtcbn1cblxuZnVuY3Rpb24gYXBwbHlTdGFnZWRDc3ZEcmFmdCgpIHtcbiAgY3N2RHJhZnRDb250cm9sbGVyIS5hcHBseVN0YWdlZENzdkRyYWZ0KCk7XG59XG5cbmZ1bmN0aW9uIGRpc2NhcmRTdGFnZWRDc3ZEcmFmdCgpIHtcbiAgY3N2RHJhZnRDb250cm9sbGVyIS5kaXNjYXJkU3RhZ2VkQ3N2RHJhZnQoKTtcbn1cblxuZnVuY3Rpb24gZ2V0RGVmYXVsdERvY3VtZW50Rm9ybWF0TGFiZWwocHJvZmlsZUtleTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGRvY3VtZW50Rm9ybWF0Q29udHJvbGxlciEuZ2V0RGVmYXVsdERvY3VtZW50Rm9ybWF0TGFiZWwocHJvZmlsZUtleSk7XG59XG5cbmZ1bmN0aW9uIHN5bmNEb2N1bWVudFByb2plY3RUb0N1cnJlbnRPdXRwdXRQcm9maWxlKCkge1xuICByZXR1cm4gZG9jdW1lbnRGb3JtYXRDb250cm9sbGVyIS5zeW5jRG9jdW1lbnRQcm9qZWN0VG9DdXJyZW50T3V0cHV0UHJvZmlsZSgpO1xufVxuXG5mdW5jdGlvbiBnZXRVbnVzZWREb2N1bWVudEZvcm1hdFByb2ZpbGVLZXlzKGN1cnJlbnRQcm9maWxlS2V5Pzogc3RyaW5nKTogc3RyaW5nW10ge1xuICByZXR1cm4gZG9jdW1lbnRGb3JtYXRDb250cm9sbGVyIS5nZXRVbnVzZWREb2N1bWVudEZvcm1hdFByb2ZpbGVLZXlzKGN1cnJlbnRQcm9maWxlS2V5KTtcbn1cblxuZnVuY3Rpb24gZ2V0U2NlbmVGYW1pbHlMYWJlbChzY2VuZUZhbWlseUtleTogT3ZlcmxheVNjZW5lRmFtaWx5S2V5KTogc3RyaW5nIHtcbiAgcmV0dXJuIGJhY2tncm91bmRHcmFwaENvbnRyb2xsZXIuZ2V0U2NlbmVGYW1pbHlMYWJlbChzY2VuZUZhbWlseUtleSk7XG59XG5cbmZ1bmN0aW9uIHNldEFjdGl2ZURvY3VtZW50Rm9ybWF0KHRhcmdldElkOiBzdHJpbmcpOiB2b2lkIHtcbiAgZG9jdW1lbnRGb3JtYXRDb250cm9sbGVyIS5zZXRBY3RpdmVEb2N1bWVudEZvcm1hdCh0YXJnZXRJZCk7XG59XG5cbmZ1bmN0aW9uIGFkZERvY3VtZW50Rm9ybWF0KHByb2ZpbGVLZXk/OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIGRvY3VtZW50Rm9ybWF0Q29udHJvbGxlciEuYWRkRG9jdW1lbnRGb3JtYXQocHJvZmlsZUtleSk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUFjdGl2ZURvY3VtZW50Rm9ybWF0TGFiZWwocmF3TGFiZWw6IHN0cmluZyk6IHZvaWQge1xuICBkb2N1bWVudEZvcm1hdENvbnRyb2xsZXIhLnVwZGF0ZUFjdGl2ZURvY3VtZW50Rm9ybWF0TGFiZWwocmF3TGFiZWwpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVBY3RpdmVEb2N1bWVudEZvcm1hdFByb2ZpbGUobmV4dFByb2ZpbGVLZXk6IHN0cmluZyk6IHZvaWQge1xuICBkb2N1bWVudEZvcm1hdENvbnRyb2xsZXIhLnVwZGF0ZUFjdGl2ZURvY3VtZW50Rm9ybWF0UHJvZmlsZShuZXh0UHJvZmlsZUtleSk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUFjdGl2ZURvY3VtZW50Rm9ybWF0KCk6IGJvb2xlYW4ge1xuICByZXR1cm4gZG9jdW1lbnRGb3JtYXRDb250cm9sbGVyIS5yZW1vdmVBY3RpdmVEb2N1bWVudEZvcm1hdCgpO1xufVxuXG5mdW5jdGlvbiBzd2l0Y2hPdXRwdXRQcm9maWxlKHByb2ZpbGVLZXk6IHN0cmluZywgb3B0aW9ucz86IGltcG9ydChcIi4vcHJldmlldy1hcHAtY29udGV4dC5qc1wiKS5Td2l0Y2hPdXRwdXRQcm9maWxlT3B0aW9ucykge1xuICBwcm9maWxlU3RhdGVDb250cm9sbGVyIS5zd2l0Y2hPdXRwdXRQcm9maWxlKHByb2ZpbGVLZXksIG9wdGlvbnMpO1xuICBuZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXI/LnJlbmRlcigpO1xufVxuXG5mdW5jdGlvbiBzd2l0Y2hDb250ZW50Rm9ybWF0KGZvcm1hdEtleTogc3RyaW5nKSB7XG4gIHByb2ZpbGVTdGF0ZUNvbnRyb2xsZXIhLnN3aXRjaENvbnRlbnRGb3JtYXQoZm9ybWF0S2V5KTtcbn1cblxuZnVuY3Rpb24gYnVpbGRDdXJyZW50RG9jdW1lbnRQYXlsb2FkKG92ZXJyaWRlcz86IHsgbmFtZT86IHN0cmluZzsgY3JlYXRlZEF0Pzogc3RyaW5nOyB1cGRhdGVkQXQ/OiBzdHJpbmcgfSk6IE92ZXJsYXlQcmV2aWV3RG9jdW1lbnQge1xuICByZXR1cm4gZG9jdW1lbnRTdGF0ZUNvbnRyb2xsZXIhLmJ1aWxkQ3VycmVudERvY3VtZW50UGF5bG9hZChvdmVycmlkZXMpO1xufVxuXG5mdW5jdGlvbiBidWlsZEN1cnJlbnREb2N1bWVudFBlcnNpc3RlbmNlKG92ZXJyaWRlcz86IHsgbmFtZT86IHN0cmluZzsgY3JlYXRlZEF0Pzogc3RyaW5nOyB1cGRhdGVkQXQ/OiBzdHJpbmcgfSk6IFBlcnNpc3RlZE92ZXJsYXlQcmV2aWV3RG9jdW1lbnQge1xuICByZXR1cm4gZG9jdW1lbnRTdGF0ZUNvbnRyb2xsZXIhLmJ1aWxkQ3VycmVudERvY3VtZW50UGVyc2lzdGVuY2Uob3ZlcnJpZGVzKTtcbn1cblxuZnVuY3Rpb24gc2FuaXRpemVQcmV2aWV3RG9jdW1lbnQocmF3RG9jdW1lbnQ6IHVua25vd24pOiBPdmVybGF5UHJldmlld0RvY3VtZW50IHwgbnVsbCB7XG4gIHJldHVybiBkb2N1bWVudFN0YXRlQ29udHJvbGxlciEuc2FuaXRpemVQcmV2aWV3RG9jdW1lbnQocmF3RG9jdW1lbnQpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBhcHBseVByZXZpZXdEb2N1bWVudFRvU3RhdGUocHJldmlld0RvY3VtZW50OiBPdmVybGF5UHJldmlld0RvY3VtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGRvY3VtZW50U3RhdGVDb250cm9sbGVyIS5hcHBseVByZXZpZXdEb2N1bWVudFRvU3RhdGUocHJldmlld0RvY3VtZW50KTtcbiAgbmV0d29ya092ZXJsYXlDb250cm9sbGVyPy5yZW5kZXIoKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYXBwbHlOZXdEb2N1bWVudFN0YXRlKCk6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBkb2N1bWVudFN0YXRlQ29udHJvbGxlciEuYXBwbHlOZXdEb2N1bWVudFN0YXRlKCk7XG4gIG5ldHdvcmtPdmVybGF5Q29udHJvbGxlcj8ucmVuZGVyKCk7XG59XG5cbmZ1bmN0aW9uIHNldE92ZXJsYXlWaXNpYmxlKG5leHRWaXNpYmxlOiBib29sZWFuKSB7XG4gIGlmIChzdGF0ZS5vdmVybGF5VmlzaWJsZSA9PT0gbmV4dFZpc2libGUpIHtcbiAgICBzeW5jT3ZlcmxheVZpc2liaWxpdHlVaSgpO1xuICAgIGF1dGhvcmluZ0NvbnRyb2xsZXI/LnJlbmRlcigpO1xuICAgIG5ldHdvcmtPdmVybGF5Q29udHJvbGxlcj8ucmVuZGVyKCk7XG4gICAgcHJldmlld1NoZWxsQ29udHJvbGxlcj8udXBkYXRlVmlld1VpKCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgc3RhdGUub3ZlcmxheVZpc2libGUgPSBuZXh0VmlzaWJsZTtcblxuICB0cnkgeyBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShPVkVSTEFZX1ZJU0lCTEVfU1RPUkFHRV9LRVksIG5leHRWaXNpYmxlID8gXCIxXCIgOiBcIjBcIik7IH0gY2F0Y2ggeyB9XG5cbiAgaWYgKCFuZXh0VmlzaWJsZSkge1xuICAgIGF1dGhvcmluZ0NvbnRyb2xsZXI/LnJlc2V0SW50ZXJhY3Rpb25TdGF0ZSgpO1xuICB9XG5cbiAgc3luY092ZXJsYXlWaXNpYmlsaXR5VWkoKTtcbiAgYXV0aG9yaW5nQ29udHJvbGxlcj8ucmVuZGVyKCk7XG4gIG5ldHdvcmtPdmVybGF5Q29udHJvbGxlcj8ucmVuZGVyKCk7XG4gIHByZXZpZXdTaGVsbENvbnRyb2xsZXI/LnVwZGF0ZVZpZXdVaSgpO1xufVxuXG5mdW5jdGlvbiBzZXROZXR3b3JrT3ZlcmxheVZpc2libGUobmV4dFZpc2libGU6IGJvb2xlYW4pIHtcbiAgaWYgKHN0YXRlLm5ldHdvcmtPdmVybGF5VmlzaWJsZSA9PT0gbmV4dFZpc2libGUpIHtcbiAgICBuZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXI/LnJlbmRlcigpO1xuICAgIHByZXZpZXdTaGVsbENvbnRyb2xsZXI/LnVwZGF0ZVZpZXdVaSgpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHN0YXRlLm5ldHdvcmtPdmVybGF5VmlzaWJsZSA9IG5leHRWaXNpYmxlO1xuXG4gIHRyeSB7IGxvY2FsU3RvcmFnZS5zZXRJdGVtKE5FVFdPUktfT1ZFUkxBWV9WSVNJQkxFX1NUT1JBR0VfS0VZLCBuZXh0VmlzaWJsZSA/IFwiMVwiIDogXCIwXCIpOyB9IGNhdGNoIHsgfVxuXG4gIG5ldHdvcmtPdmVybGF5Q29udHJvbGxlcj8ucmVuZGVyKCk7XG4gIHByZXZpZXdTaGVsbENvbnRyb2xsZXI/LnVwZGF0ZVZpZXdVaSgpO1xufVxuXG5mdW5jdGlvbiBzeW5jT3ZlcmxheVZpc2liaWxpdHlVaSgpIHtcbiAgY29uc3Qgc3ZnID0gZ2V0U3ZnT3ZlcmxheSgpO1xuICBjb25zdCBhdXRob3JpbmdMYXllciA9IGdldEF1dGhvcmluZ0xheWVyRWwoKTtcbiAgY29uc3Qgb3ZlcmxheVZpc2liaWxpdHlJbnB1dCA9IGdldE92ZXJsYXlWaXNpYmlsaXR5SW5wdXQoKTtcblxuICBpZiAob3ZlcmxheVZpc2liaWxpdHlJbnB1dCkge1xuICAgIG92ZXJsYXlWaXNpYmlsaXR5SW5wdXQuY2hlY2tlZCA9IHN0YXRlLm92ZXJsYXlWaXNpYmxlO1xuICB9XG5cbiAgaWYgKHN2Zykge1xuICAgIHN2Zy5zdHlsZS5kaXNwbGF5ID0gc3RhdGUub3ZlcmxheVZpc2libGUgPyBcImJsb2NrXCIgOiBcIm5vbmVcIjtcbiAgfVxuXG4gIGlmIChhdXRob3JpbmdMYXllcikge1xuICAgIGF1dGhvcmluZ0xheWVyLnN0eWxlLmRpc3BsYXkgPSBzdGF0ZS5vdmVybGF5VmlzaWJsZSA/IFwiYmxvY2tcIiA6IFwibm9uZVwiO1xuICAgIGF1dGhvcmluZ0xheWVyLnN0eWxlLnBvaW50ZXJFdmVudHMgPSBzdGF0ZS5vdmVybGF5VmlzaWJsZSA/IFwiYXV0b1wiIDogXCJub25lXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVzaXplUmVuZGVyZXIoKSB7XG4gIHN0YWdlUmVuZGVyQ29udHJvbGxlci5yZXNpemVSZW5kZXJlcigpO1xuICBhdXRob3JpbmdDb250cm9sbGVyPy5yZW5kZXIoKTtcbiAgbmV0d29ya092ZXJsYXlDb250cm9sbGVyPy5yZW5kZXIoKTtcbn1cblxuZnVuY3Rpb24gc3luY0JhY2tncm91bmRSZW5kZXJlclZpc2liaWxpdHkoKSB7XG4gIHN0YWdlUmVuZGVyQ29udHJvbGxlci5zeW5jQmFja2dyb3VuZFJlbmRlcmVyVmlzaWJpbGl0eSgpO1xufVxuXG5mdW5jdGlvbiBnZXRTY2VuZUZhbWlseVByZXZpZXdTdGF0ZShtb2RlOiBTY2VuZUZhbWlseVByZXZpZXdNb2RlID0gXCJpbnRlcmFjdGl2ZVwiKSB7XG4gIHJldHVybiBzdGFnZVJlbmRlckNvbnRyb2xsZXIuZ2V0U2NlbmVGYW1pbHlQcmV2aWV3U3RhdGUobW9kZSk7XG59XG5cbmZ1bmN0aW9uIHJlbmRlckJhY2tncm91bmRGcmFtZShtb2RlOiBTY2VuZUZhbWlseVByZXZpZXdNb2RlID0gXCJpbnRlcmFjdGl2ZVwiKSB7XG4gIHN0YWdlUmVuZGVyQ29udHJvbGxlci5yZW5kZXJCYWNrZ3JvdW5kRnJhbWUobW9kZSk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVBsYXliYWNrVG9nZ2xlVWkoKSB7IHBsYXliYWNrQ29udHJvbGxlciEudXBkYXRlUGxheWJhY2tUb2dnbGVVaSgpOyB9XG5mdW5jdGlvbiBzdG9wUGxheWJhY2tMb29wKCkgeyBwbGF5YmFja0NvbnRyb2xsZXIhLnN0b3BQbGF5YmFja0xvb3AoKTsgfVxuZnVuY3Rpb24gZW5zdXJlUGxheWJhY2tMb29wKCkgeyBwbGF5YmFja0NvbnRyb2xsZXIhLmVuc3VyZVBsYXliYWNrTG9vcCgpOyB9XG5mdW5jdGlvbiBzZXRQbGF5YmFja1BsYXlpbmcobmV4dElzUGxheWluZzogYm9vbGVhbikgeyBwbGF5YmFja0NvbnRyb2xsZXIhLnNldFBsYXliYWNrUGxheWluZyhuZXh0SXNQbGF5aW5nKTsgfVxuZnVuY3Rpb24gdG9nZ2xlUGxheWJhY2soKSB7IHBsYXliYWNrQ29udHJvbGxlciEudG9nZ2xlUGxheWJhY2soKTsgfVxuXG5hc3luYyBmdW5jdGlvbiByZW5kZXJTdGFnZShtb2RlOiBTY2VuZUZhbWlseVByZXZpZXdNb2RlID0gXCJpbnRlcmFjdGl2ZVwiKSB7XG4gIGF3YWl0IHN0YWdlUmVuZGVyQ29udHJvbGxlci5yZW5kZXJTdGFnZShtb2RlKTtcbn1cblxuZnVuY3Rpb24gYnVpbGRGb3JtYXRPcHRpb25zKCkge1xuICBkb2N1bWVudEZvcm1hdENvbnRyb2xsZXIhLmJ1aWxkRm9ybWF0T3B0aW9ucygpO1xufVxuXG5mdW5jdGlvbiBnZXRTZWxlY3RlZE92ZXJsYXlTZWN0aW9uVGl0bGUoKTogc3RyaW5nIHtcbiAgcmV0dXJuIG92ZXJsYXlFZGl0aW5nQ29udHJvbGxlciEuZ2V0U2VsZWN0ZWRPdmVybGF5U2VjdGlvblRpdGxlKCk7XG59XG5cbmZ1bmN0aW9uIGdldFNlbGVjdGVkVGV4dEZpZWxkKCk6IFRleHRGaWVsZFBsYWNlbWVudFNwZWMgfCBudWxsIHtcbiAgcmV0dXJuIG92ZXJsYXlFZGl0aW5nQ29udHJvbGxlciEuZ2V0U2VsZWN0ZWRUZXh0RmllbGQoKTtcbn1cblxuZnVuY3Rpb24gYXBwbHlTZWxlY3RlZFRleHRTdHlsZShzdHlsZUtleTogc3RyaW5nKSB7XG4gIG92ZXJsYXlFZGl0aW5nQ29udHJvbGxlciEuYXBwbHlTZWxlY3RlZFRleHRTdHlsZShzdHlsZUtleSk7XG59XG5cbmNvbnN0IGN0eDogUHJldmlld0FwcENvbnRleHQgPSB7XG4gIHN0YXRlLFxuICByZW5kZXJTdGFnZSxcbiAgYnVpbGRDb25maWdFZGl0b3IsXG4gIGJ1aWxkRm9ybWF0T3B0aW9ucyxcbiAgcmVzaXplUmVuZGVyZXIsXG4gIHN5bmNPdmVybGF5VmlzaWJpbGl0eVVpLFxuICB1cGRhdGVQbGF5YmFja1RvZ2dsZVVpLFxuICB1cGRhdGVEb2N1bWVudFVpLFxuICBtYXJrRG9jdW1lbnREaXJ0eSxcbiAgc2VsZWN0LFxuICB0b2dnbGVQbGF5YmFjayxcbiAgc2V0UGxheWJhY2tQbGF5aW5nLFxuICBzZXRPdmVybGF5VmlzaWJsZSxcbiAgbm9ybWFsaXplUGFyYW1zVGV4dEZpZWxkT2Zmc2V0cyxcbiAgdXBkYXRlRXhwb3J0U2V0dGluZ3MsXG4gIHVwZGF0ZVRleHRGaWVsZCxcbiAgdXBkYXRlTG9nbyxcbiAgdXBkYXRlTG9nb1NpemVXaXRoQXNwZWN0UmF0aW8sXG4gIGdldEN1cnJlbnRMb2dvQXNwZWN0UmF0aW8sXG4gIGxvYWRMb2dvSW50cmluc2ljRGltZW5zaW9ucyxcbiAgYXBwbHlTZWxlY3RlZFRleHRTdHlsZSxcbiAgdXBkYXRlVGV4dFN0eWxlLFxuICBzeW5jTG9nb1RvVGl0bGVGb250U2l6ZSxcbiAgc3luY1RpdGxlVG9Mb2dvSGVpZ2h0LFxuICBnZXREaXNwbGF5ZWRUZXh0RmllbGRPZmZzZXRCYXNlbGluZXMsXG4gIGdldFJlc29sdmVkVGV4dEZpZWxkVGV4dCxcbiAgdXBkYXRlU2VsZWN0ZWRUZXh0VmFsdWUsXG4gIGdldFNlbGVjdGVkVGV4dEZpZWxkLFxuICBnZXRTZWxlY3RlZE92ZXJsYXlTZWN0aW9uVGl0bGUsXG4gIGNyZWF0ZU92ZXJsYXlJdGVtQWN0aW9uUm93LFxuICBzd2l0Y2hDb250ZW50Rm9ybWF0LFxuICBzZXRTdGFnZWRDc3ZEcmFmdCxcbiAgZ2V0U3RhZ2VkQ3N2RHJhZnQsXG4gIGhhc1N0YWdlZENzdkRyYWZ0LFxuICBhcHBseVN0YWdlZENzdkRyYWZ0LFxuICBkaXNjYXJkU3RhZ2VkQ3N2RHJhZnQsXG4gIGdldENvbnRlbnRTb3VyY2UsXG4gIGdldEVmZmVjdGl2ZVBhcmFtcyxcbiAgc3dpdGNoT3V0cHV0UHJvZmlsZSxcbiAgYXBwbHlTb3VyY2VEZWZhdWx0U25hcHNob3Qoc25hcHNob3QpIHtcbiAgICBzb3VyY2VEZWZhdWx0Q29udHJvbGxlcj8uYXBwbHlTb3VyY2VEZWZhdWx0U25hcHNob3Qoc25hcHNob3QpO1xuICB9LFxuICB3cml0ZUN1cnJlbnRBc1NvdXJjZURlZmF1bHQoKSB7XG4gICAgcmV0dXJuIHNvdXJjZURlZmF1bHRDb250cm9sbGVyIS53cml0ZUN1cnJlbnRBc1NvdXJjZURlZmF1bHQoKTtcbiAgfSxcbiAgc2V0U291cmNlRGVmYXVsdFN0YXR1cyhtZXNzYWdlLCBzZXZlcml0eSkge1xuICAgIHNvdXJjZURlZmF1bHRDb250cm9sbGVyPy5zZXRTb3VyY2VEZWZhdWx0U3RhdHVzKG1lc3NhZ2UsIHNldmVyaXR5IGFzIFwibmV1dHJhbFwiIHwgXCJzdWNjZXNzXCIgfCBcImVycm9yXCIpO1xuICB9LFxuICBzZXRTZWxlY3RlZEJhY2tncm91bmROb2RlLFxuICBnZXRTZWxlY3RlZEJhY2tncm91bmROb2RlLFxuICB1cGRhdGVTZWxlY3RlZEJhY2tncm91bmROb2RlLFxuICBzeW5jRG9jdW1lbnRCYWNrZ3JvdW5kR3JhcGgsXG4gIGdldFNjZW5lRmFtaWx5UHJldmlld1N0YXRlLFxuICBnZXRTY2VuZUZhbWlseUxhYmVsLFxuICBhZGREb2N1bWVudEZvcm1hdCxcbiAgcmVtb3ZlQWN0aXZlRG9jdW1lbnRGb3JtYXQsXG4gIHNldEFjdGl2ZURvY3VtZW50Rm9ybWF0LFxuICB1cGRhdGVBY3RpdmVEb2N1bWVudEZvcm1hdExhYmVsLFxuICB1cGRhdGVBY3RpdmVEb2N1bWVudEZvcm1hdFByb2ZpbGUsXG4gIGdldFVudXNlZERvY3VtZW50Rm9ybWF0UHJvZmlsZUtleXMsXG4gIGdldERlZmF1bHREb2N1bWVudEZvcm1hdExhYmVsLFxuICBkb2N1bWVudFdvcmtzcGFjZTogZG9jdW1lbnRXb3Jrc3BhY2VDb250cm9sbGVyLFxuICBnZXROb3JtYWxpemVkRG9jdW1lbnROYW1lLFxuICBleHBvcnRDb21wb3NlZEZyYW1lUG5nOiBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgZXhwb3J0QXV0b21hdGlvbkNvbnRyb2xsZXI/LmV4cG9ydENvbXBvc2VkRnJhbWVQbmcoKTtcbiAgfSxcbiAgZXhwb3J0UG5nU2VxdWVuY2U6IGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBleHBvcnRBdXRvbWF0aW9uQ29udHJvbGxlcj8uZXhwb3J0UG5nU2VxdWVuY2UoKTtcbiAgfSxcbiAgZXhwb3J0TXA0OiBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgZXhwb3J0QXV0b21hdGlvbkNvbnRyb2xsZXI/LmV4cG9ydE1wNCgpO1xuICB9XG59O1xuXG5cbm5ldHdvcmtPdmVybGF5Q29udHJvbGxlciA9IGNyZWF0ZVN0YWdlTmV0d29ya092ZXJsYXlDb250cm9sbGVyKHtcbiAgc3RhdGUsXG4gIGdldFN0YWdlRWwsXG4gIGdldE92ZXJsYXlFbDogZ2V0TmV0d29ya092ZXJsYXlFbCxcbiAgZ2V0U2VsZWN0ZWRPcGVyYXRvcklkLFxuICBnZXRTY2VuZUZhbWlseUxhYmVsLFxuICBnZXRTY2VuZUZhbWlseVByZXZpZXdTdGF0ZSxcbiAgc2VsZWN0QmFja2dyb3VuZE5vZGUobm9kZUlkOiBzdHJpbmcpIHtcbiAgICBjb25zdCBkaWRDaGFuZ2UgPSBzZXRTZWxlY3RlZE9wZXJhdG9yKG5vZGVJZCk7XG4gICAgaWYgKGRpZENoYW5nZSkge1xuICAgICAgYnVpbGRDb25maWdFZGl0b3IoKTtcbiAgICB9XG4gIH0sXG4gIHNlbGVjdE92ZXJsYXlMYXlvdXQoKSB7XG4gICAgc2V0U2VsZWN0ZWRPcGVyYXRvcihPVkVSTEFZX0xBWU9VVF9PUEVSQVRPUl9TRUxFQ1RJT05fSUQpO1xuICAgIHNlbGVjdChudWxsKTtcbiAgfVxufSk7XG5hdXRob3JpbmdDb250cm9sbGVyID0gY3JlYXRlQXV0aG9yaW5nSW50ZXJhY3Rpb25Db250cm9sbGVyKHtcbiAgY3R4LFxuICBnZXRDdXJyZW50U2NlbmU6ICgpID0+IHN0YWdlUmVuZGVyQ29udHJvbGxlci5nZXRDdXJyZW50U2NlbmUoKSxcbiAgZ2V0U3RhZ2VFbCxcbiAgZ2V0QXV0aG9yaW5nTGF5ZXJFbFxufSk7XG5cbmRvY3VtZW50U3RhdGVDb250cm9sbGVyID0gY3JlYXRlUHJldmlld0RvY3VtZW50U3RhdGVDb250cm9sbGVyKHtcbiAgc3RhdGUsXG4gIHByZXZpZXdEb2N1bWVudEJyaWRnZSxcbiAgaW5pdGlhbFNvdXJjZURlZmF1bHRzOiBJTklUSUFMX1NPVVJDRV9ERUZBVUxUUyxcbiAgY3JlYXRlRGVmYXVsdEV4cG9ydFNldHRpbmdzLFxuICBnZXRIYWxvQ29uZmlnRm9yUHJvZmlsZSxcbiAgbm9ybWFsaXplR3VpZGVNb2RlLFxuICBnZXRDdXJyZW50RG9jdW1lbnROYW1lOiAoKSA9PiBnZXROb3JtYWxpemVkRG9jdW1lbnROYW1lKCksXG4gIGdldEN1cnJlbnREb2N1bWVudENyZWF0ZWRBdDogKCkgPT4gZG9jdW1lbnRXb3Jrc3BhY2VDb250cm9sbGVyLnN0YXRlLmNyZWF0ZWRBdCxcbiAgZ2V0Q3VycmVudERvY3VtZW50VXBkYXRlZEF0OiAoKSA9PiBkb2N1bWVudFdvcmtzcGFjZUNvbnRyb2xsZXIuc3RhdGUudXBkYXRlZEF0LFxuICBidWlsZENvbmZpZ0VkaXRvcixcbiAgcmVzaXplUmVuZGVyZXIsXG4gIHJlbmRlclN0YWdlLFxuICBsb2FkTG9nb0ludHJpbnNpY0RpbWVuc2lvbnMsXG4gIHJlc2V0QXV0aG9yaW5nSW50ZXJhY3Rpb25TdGF0ZTogKCkgPT4ge1xuICAgIGF1dGhvcmluZ0NvbnRyb2xsZXI/LnJlc2V0SW50ZXJhY3Rpb25TdGF0ZSgpO1xuICB9LFxuICBub3JtYWxpemVTZWxlY3Rpb24sXG4gIG5vcm1hbGl6ZVNlbGVjdGVkQmFja2dyb3VuZE5vZGVJZCxcbiAgbm9ybWFsaXplU2VsZWN0ZWRPcGVyYXRvcklkXG59KTtcblxuZXhwb3J0QXV0b21hdGlvbkNvbnRyb2xsZXIgPSBjcmVhdGVFeHBvcnRBdXRvbWF0aW9uQ29udHJvbGxlcih7XG4gIGN0eCxcbiAgZ2V0Q2FudmFzRWwsXG4gIGdldFNjZW5lUHJldmlld0NhbnZhcyxcbiAgZ2V0U2NlbmVQcmV2aWV3R3B1Q2FudmFzLFxuICBnZXRUZXh0T3ZlcmxheUNhbnZhcyxcbiAgZ2V0U3ZnT3ZlcmxheSxcbiAgZ2V0U2NlbmVEZXNjcmlwdG9yOiAoKSA9PiBzdGFnZVJlbmRlckNvbnRyb2xsZXIuZ2V0U2NlbmVEZXNjcmlwdG9yKCksXG4gIG5vcm1hbGl6ZVNlbGVjdGVkQmFja2dyb3VuZE5vZGVJZCxcbiAgYnVpbGRDdXJyZW50RG9jdW1lbnRQZXJzaXN0ZW5jZSxcbiAgcGFyc2VQcmV2aWV3RG9jdW1lbnQ6IHNhbml0aXplUHJldmlld0RvY3VtZW50LFxuICAgIGFwcGx5UHJldmlld0RvY3VtZW50OiBhcHBseVByZXZpZXdEb2N1bWVudFRvU3RhdGVcbn0pO1xuXG5jc3ZEcmFmdENvbnRyb2xsZXIgPSBjcmVhdGVDc3ZEcmFmdENvbnRyb2xsZXIoe1xuICBzdGF0ZSxcbiAgZ2V0RG9jdW1lbnRGb3JtYXRCdWNrZXQsXG4gIGdldE9yQ3JlYXRlRG9jdW1lbnRGb3JtYXRQYXJhbXMsXG4gIG1hcmtEb2N1bWVudERpcnR5XG59KTtcblxucGxheWJhY2tDb250cm9sbGVyID0gY3JlYXRlUGxheWJhY2tDb250cm9sbGVyKHtcbiAgc3RhdGUsXG4gIHJlbmRlckJhY2tncm91bmRGcmFtZVxufSk7XG5cbm92ZXJsYXlFZGl0aW5nQ29udHJvbGxlciA9IGNyZWF0ZU92ZXJsYXlFZGl0aW5nQ29udHJvbGxlcih7XG4gIHN0YXRlLFxuICBub3JtYWxpemVQYXJhbXNUZXh0RmllbGRPZmZzZXRzLFxuICBtYXJrRG9jdW1lbnREaXJ0eSxcbiAgYnVpbGRDb25maWdFZGl0b3IsXG4gIHJlbmRlclN0YWdlLFxuICBzZWxlY3QsXG4gIGdldExvZ29JbnRyaW5zaWNEaW1lbnNpb25zOiAoKSA9PiAoe1xuICAgIHdpZHRoOiBsb2dvSW50cmluc2ljV2lkdGgsXG4gICAgaGVpZ2h0OiBsb2dvSW50cmluc2ljSGVpZ2h0XG4gIH0pXG59KTtcblxuc291cmNlRGVmYXVsdENvbnRyb2xsZXIgPSBjcmVhdGVTb3VyY2VEZWZhdWx0Q29udHJvbGxlcih7XG4gIHN0YXRlLFxuICBpbml0aWFsU291cmNlRGVmYXVsdHM6IElOSVRJQUxfU09VUkNFX0RFRkFVTFRTLFxuICBpbml0aWFsU291cmNlRGVmYXVsdFByb2plY3Q6IElOSVRJQUxfU09VUkNFX0RFRkFVTFRfUFJPSkVDVCxcbiAgcHJldmlld0RvY3VtZW50QnJpZGdlLFxuICBjcmVhdGVEZWZhdWx0RXhwb3J0U2V0dGluZ3MsXG4gIGdldEhhbG9Db25maWdGb3JQcm9maWxlLFxuICBub3JtYWxpemVHdWlkZU1vZGUsXG4gIGZsdXNoUGVuZGluZ0NzdkRyYWZ0cyxcbiAgYnVpbGRDdXJyZW50RG9jdW1lbnRQYXlsb2FkLFxuICBidWlsZENvbmZpZ0VkaXRvcixcbiAgc3luY0RvY3VtZW50UHJvamVjdFRvQ3VycmVudE91dHB1dFByb2ZpbGUsXG4gIG5vcm1hbGl6ZVNlbGVjdGVkQmFja2dyb3VuZE5vZGVJZCxcbiAgbm9ybWFsaXplU2VsZWN0ZWRPcGVyYXRvcklkLFxuICBub3JtYWxpemVTZWxlY3Rpb25cbn0pO1xuXG5wcmV2aWV3U2hlbGxDb250cm9sbGVyID0gY3JlYXRlUHJldmlld1NoZWxsQ29udHJvbGxlcih7XG4gIHN0YXRlLFxuICB1bnRpdGxlZE5hbWU6IFVOVElUTEVEX0RPQ1VNRU5UX05BTUUsXG4gIGd1aWRlTW9kZVN0b3JhZ2VLZXk6IEdVSURFX01PREVfU1RPUkFHRV9LRVksXG4gIGRvY3VtZW50V29ya3NwYWNlOiBkb2N1bWVudFdvcmtzcGFjZUNvbnRyb2xsZXIsXG4gIHNvdXJjZURlZmF1bHRDb250cm9sbGVyLFxuICBtYXJrRG9jdW1lbnREaXJ0eSxcbiAgbG9hZExvZ29JbnRyaW5zaWNEaW1lbnNpb25zLFxuICBidWlsZENvbmZpZ0VkaXRvcixcbiAgYnVpbGRGb3JtYXRPcHRpb25zLFxuICByZW5kZXJTdGFnZSxcbiAgcmVzaXplUmVuZGVyZXIsXG4gIHRvZ2dsZVBsYXliYWNrLFxuICBlbnN1cmVQbGF5YmFja0xvb3AsXG4gIHVwZGF0ZUV4cG9ydFNldHRpbmdzLFxuICBzZXRPdmVybGF5VmlzaWJsZSxcbiAgc2V0TmV0d29ya092ZXJsYXlWaXNpYmxlLFxuICBhZGREb2N1bWVudEZvcm1hdCxcbiAgcmVtb3ZlQWN0aXZlRG9jdW1lbnRGb3JtYXQsXG4gIGV4cG9ydENvbXBvc2VkRnJhbWVQbmc6IGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBleHBvcnRBdXRvbWF0aW9uQ29udHJvbGxlcj8uZXhwb3J0Q29tcG9zZWRGcmFtZVBuZygpO1xuICB9LFxuICBleHBvcnRQbmdTZXF1ZW5jZTogYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IGV4cG9ydEF1dG9tYXRpb25Db250cm9sbGVyPy5leHBvcnRQbmdTZXF1ZW5jZSgpO1xuICB9LFxuICBleHBvcnRNcDQ6IGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBleHBvcnRBdXRvbWF0aW9uQ29udHJvbGxlcj8uZXhwb3J0TXA0KCk7XG4gIH0sXG4gIGluaXRIYWxvUmVuZGVyZXI6ICgpID0+IHtcbiAgICBzdGFnZVJlbmRlckNvbnRyb2xsZXIuaW5pdEhhbG9SZW5kZXJlcigpO1xuICB9LFxuICBpbml0QXV0aG9yaW5nOiAoKSA9PiB7XG4gICAgYXV0aG9yaW5nQ29udHJvbGxlcj8uaW5pdCgpO1xuICB9LFxuICBoYW5kbGVBdXRob3JpbmdFZGl0aW5nS2V5RG93bjogKGV2ZW50KSA9PiB7XG4gICAgcmV0dXJuIGF1dGhvcmluZ0NvbnRyb2xsZXI/LmhhbmRsZUVkaXRpbmdLZXlEb3duKGV2ZW50KSA/PyBmYWxzZTtcbiAgfSxcbiAgaGFuZGxlQXV0aG9yaW5nSW50ZXJhY3Rpb25LZXlEb3duOiAoZXZlbnQpID0+IHtcbiAgICByZXR1cm4gYXV0aG9yaW5nQ29udHJvbGxlcj8uaGFuZGxlSW50ZXJhY3Rpb25LZXlEb3duKGV2ZW50KSA/PyBmYWxzZTtcbiAgfVxufSk7XG5cbmNvbnN0IENPUkVfQ09ORklHX1NFQ1RJT05fREVGSU5JVElPTlM6IENvbmZpZ1NlY3Rpb25EZWZpbml0aW9uW10gPSBbXG4gIHsga2V5OiBcIm92ZXJsYXktbGF5ZXJcIiwgc2NvcGU6IFwib3BlcmF0b3JcIiwgZ3JvdXA6IE9WRVJMQVlfTEFZT1VUX09QRVJBVE9SX1NFTEVDVElPTl9JRCwgb3JkZXI6IDUwMCwgZmFjdG9yeTogKCkgPT4gYnVpbGRPdmVybGF5U2VjdGlvbihjdHgpIH0sXG4gIHsga2V5OiBcImxheW91dC1ncmlkXCIsIHNjb3BlOiBcIm9wZXJhdG9yXCIsIGdyb3VwOiBPVkVSTEFZX0xBWU9VVF9PUEVSQVRPUl9TRUxFQ1RJT05fSUQsIG9yZGVyOiA3MDAsIGZhY3Rvcnk6ICgpID0+IGJ1aWxkR3JpZFNlY3Rpb24oY3R4KSB9LFxuICB7IGtleTogXCJoYWxvLWNvbmZpZ1wiLCBzY29wZTogXCJvcGVyYXRvclwiLCBvcmRlcjogODAwLCBncm91cDogXCJoYWxvXCIsIGZhY3Rvcnk6ICgpID0+IGJ1aWxkSGFsb0NvbmZpZ1NlY3Rpb24oY3R4KSB9LFxuICB7IGtleTogXCJmdXp6eS1ib2lkc1wiLCBzY29wZTogXCJvcGVyYXRvclwiLCBvcmRlcjogODEwLCBncm91cDogXCJmdXp6eS1ib2lkc1wiLCBmYWN0b3J5OiAoKSA9PiBidWlsZEZ1enp5Qm9pZHNTZWN0aW9uKGN0eCkgfSxcbiAgeyBrZXk6IFwicGh5bGxvdGF4aXNcIiwgc2NvcGU6IFwib3BlcmF0b3JcIiwgb3JkZXI6IDgyMCwgZ3JvdXA6IFwicGh5bGxvdGF4aXNcIiwgZmFjdG9yeTogKCkgPT4gYnVpbGRQaHlsbG90YXhpc1NlY3Rpb24oY3R4KSB9LFxuICB7IGtleTogXCJzY2F0dGVyXCIsIHNjb3BlOiBcIm9wZXJhdG9yXCIsIG9yZGVyOiA4MzAsIGdyb3VwOiBcInNjYXR0ZXJcIiwgZmFjdG9yeTogKCkgPT4gYnVpbGRTY2F0dGVyU2VjdGlvbihjdHgpIH1cbl07XG5cbmNvbmZpZ0VkaXRvckNvbnRyb2xsZXIgPSBjcmVhdGVDb25maWdFZGl0b3JDb250cm9sbGVyKHtcbiAgc3RhdGUsXG4gIHNlY3Rpb25EZWZpbml0aW9uczogQ09SRV9DT05GSUdfU0VDVElPTl9ERUZJTklUSU9OUyxcbiAgZ2V0Q29uZmlnRWRpdG9yLFxuICBnZXRTZWxlY3RlZE9wZXJhdG9ySWQsXG4gIGdldFNlbGVjdGVkT3BlcmF0b3JHcm91cCxcbiAgZ2V0U2NlbmVGYW1pbHlMYWJlbCxcbiAgZ2V0QXZhaWxhYmxlQmFja2dyb3VuZE9wZXJhdG9yS2V5cyxcbiAgYWRkQmFja2dyb3VuZE5vZGUsXG4gIGNvbm5lY3RCYWNrZ3JvdW5kRWRnZSxcbiAgZGlzY29ubmVjdEJhY2tncm91bmRJbnB1dCxcbiAgc2V0U2VsZWN0ZWRPcGVyYXRvcixcbiAgc2VsZWN0T3ZlcmxheUl0ZW06IHNlbGVjdCxcbiAgc3luY0RvY3VtZW50QmFja2dyb3VuZEdyYXBoLFxuICByZW1vdmVCYWNrZ3JvdW5kTm9kZSxcbiAgbWFya0RvY3VtZW50RGlydHksXG4gIHN5bmNCYWNrZ3JvdW5kUmVuZGVyZXJWaXNpYmlsaXR5LFxuICByZW5kZXJTdGFnZVxufSk7XG5cbmRvY3VtZW50Rm9ybWF0Q29udHJvbGxlciA9IGNyZWF0ZURvY3VtZW50Rm9ybWF0Q29udHJvbGxlcih7XG4gIHN0YXRlLFxuICBnZXRGb3JtYXRPcHRpb25zLFxuICBzd2l0Y2hPdXRwdXRQcm9maWxlLFxuICBwZXJzaXN0QWN0aXZlRG9jdW1lbnRGb3JtYXRCdWNrZXRzLFxuICBwZXJzaXN0QWN0aXZlRXhwb3J0U2V0dGluZ3MsXG4gIHBlcnNpc3RBY3RpdmVIYWxvQ29uZmlnLFxuICBtYXJrRG9jdW1lbnREaXJ0eSxcbiAgYnVpbGRDb25maWdFZGl0b3IsXG4gIHJlbmRlclN0YWdlXG59KTtcblxuZnVuY3Rpb24gYnVpbGRDb25maWdFZGl0b3IoKSB7XG4gIGNvbmZpZ0VkaXRvckNvbnRyb2xsZXIhLmJ1aWxkQ29uZmlnRWRpdG9yKCk7XG59XG5jb25zdCBpbml0UHJvbWlzZSA9IHByZXZpZXdTaGVsbENvbnRyb2xsZXIuaW5pdCgpO1xuZXhwb3J0QXV0b21hdGlvbkNvbnRyb2xsZXI/Lmluc3RhbGxBdXRvbWF0aW9uQXBpKGluaXRQcm9taXNlKTtcbnZvaWQgaW5pdFByb21pc2UudGhlbigoKSA9PiB7XG4gIG5ldHdvcmtPdmVybGF5Q29udHJvbGxlcj8ucmVuZGVyKCk7XG59KS5jYXRjaCgoKSA9PiB7XG4gIC8vIGluaXRQcm9taXNlIGVycm9yIGlzIGhhbmRsZWQgYmVsb3cuXG59KTtcblxuaW5pdFByb21pc2UuY2F0Y2goKGVycm9yOiB1bmtub3duKSA9PiB7XG4gIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xufSk7XG4iXSwibWFwcGluZ3MiOiJBQUFBLE9BQU87QUFDUCxPQUFPO0FBT1A7QUFBQSxFQUNFO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsT0FDSztBQVVQLFNBQVMsK0JBQStCO0FBS3hDO0FBQUEsRUFDRTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLE9BRUs7QUFDUCxlQUFxRDtBQUNyRDtBQUFBLEVBQ0U7QUFBQSxPQUNLO0FBU1A7QUFBQSxFQUNFO0FBQUEsRUFDQTtBQUFBLE9BQ0s7QUFDUDtBQUFBLEVBQ0U7QUFBQSxPQUNLO0FBQ1A7QUFBQSxFQUNFO0FBQUEsT0FFSztBQUNQO0FBQUEsRUFDRTtBQUFBLE9BRUs7QUFDUDtBQUFBLEVBQ0U7QUFBQSxPQUVLO0FBQ1A7QUFBQSxFQUNFO0FBQUEsT0FFSztBQUNQO0FBQUEsRUFDRTtBQUFBLE9BRUs7QUFDUDtBQUFBLEVBQ0U7QUFBQSxPQUVLO0FBQ1A7QUFBQSxFQUNFO0FBQUEsT0FFSztBQUNQO0FBQUEsRUFDRTtBQUFBLE9BRUs7QUFDUDtBQUFBLEVBQ0U7QUFBQSxPQUVLO0FBQ1A7QUFBQSxFQUNFO0FBQUEsT0FFSztBQUNQLFNBQVMsbUNBQW1DO0FBQzVDO0FBQUEsRUFDRTtBQUFBLE9BRUs7QUFDUDtBQUFBLEVBQ0U7QUFBQSxPQUVLO0FBQ1AsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUywrQkFBK0I7QUFDeEMsU0FBUywyQkFBMkI7QUFJcEMsTUFBTSxzQkFBc0I7QUFDNUIsTUFBTSxxQkFBcUI7QUFDM0Is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