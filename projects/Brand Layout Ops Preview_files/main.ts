import "/src/vendor/baseline-foundry/tiers/os/styles.css";
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
import { getHaloConfigForProfile } from "/@fs/C:/Users/lyubo/work/repos/brand-layout-ops/packages/operator-halo-field/src/index.ts";
import {
  cloneOverlayParams,
  createDefaultExportSettings,
  loadOutputFormatKeys,
  saveOutputFormatKey
} from "/src/sample-document.ts";
import {} from "/src/preview-document.ts";
import {
  createDocumentWorkspaceController
} from "/src/document-workspace.ts";
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
  createOperatorPresetController
} from "/src/operator-preset-controller.ts";
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
import { createStageRenderController } from "/src/stage-render-controller.ts";
import {
  createPreviewShellController
} from "/src/preview-shell-controller.ts";
import {
  createStageNetworkOverlayController
} from "/src/stage-network-overlay-controller.ts";
import { buildFuzzyBoidsSection } from "/src/fuzzy-boids-section.ts";
import { buildGridSection } from "/src/grid-section.ts";
import { buildHaloConfigSection } from "/src/halo-config-section.ts";
import { buildOverlaySection, syncOverlaySectionInputs } from "/src/overlay-section.ts";
import { buildPhyllotaxisSection } from "/src/phyllotaxis-section.ts";
import { buildScatterSection } from "/src/scatter-section.ts";
const INITIAL_PROFILE_KEY = "instagram_1080x1350";
const INITIAL_FORMAT_KEY = "generic_social";
const OVERLAY_VISIBLE_STORAGE_KEY = "brand-layout-ops-overlay-visible-v1";
const NETWORK_OVERLAY_VISIBLE_STORAGE_KEY = "brand-layout-ops-network-overlay-visible-v1";
const GUIDE_MODE_STORAGE_KEY = "brand-layout-ops-guide-mode-v1";
const HISTORY_LIMIT = 100;
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
const historyState = {
  undoStack: [],
  redoStack: [],
  savedSnapshot: null,
  isApplying: false
};
const backgroundGraphController = createBackgroundGraphController({ state });
const previewDocumentBridge = {
  persistActiveDocumentFormatRuntimeState,
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
  applyDocument: applyPreviewDocumentFromWorkspace,
  applyNewDocumentState: applyNewDocumentStateFromWorkspace,
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
let operatorPresetController = null;
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
function getLayersEditor() {
  return $("[data-layers-editor]");
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
function serializeCurrentDocumentForHistory() {
  return JSON.stringify(buildCurrentDocumentPersistence());
}
function syncWorkspaceDirtyWithHistory(serializedSnapshot) {
  if (historyState.savedSnapshot !== null && serializedSnapshot === historyState.savedSnapshot) {
    documentWorkspaceController.resetDirty();
    return;
  }
  documentWorkspaceController.markDirty();
}
function resetHistoryFromCurrentDocument(markAsSaved = true) {
  if (!documentStateController) {
    return;
  }
  const serializedSnapshot = serializeCurrentDocumentForHistory();
  historyState.undoStack = [serializedSnapshot];
  historyState.redoStack = [];
  if (markAsSaved) {
    historyState.savedSnapshot = serializedSnapshot;
  }
  syncWorkspaceDirtyWithHistory(serializedSnapshot);
}
function syncHistorySavedSnapshot() {
  if (!documentStateController) {
    return;
  }
  const serializedSnapshot = serializeCurrentDocumentForHistory();
  if (historyState.undoStack.length === 0) {
    historyState.undoStack = [serializedSnapshot];
  } else {
    historyState.undoStack[historyState.undoStack.length - 1] = serializedSnapshot;
  }
  historyState.savedSnapshot = serializedSnapshot;
  syncWorkspaceDirtyWithHistory(serializedSnapshot);
}
function recordHistorySnapshot() {
  if (historyState.isApplying || !documentStateController) {
    documentWorkspaceController.markDirty();
    return;
  }
  const serializedSnapshot = serializeCurrentDocumentForHistory();
  const currentSnapshot = historyState.undoStack[historyState.undoStack.length - 1];
  if (currentSnapshot !== serializedSnapshot) {
    historyState.undoStack.push(serializedSnapshot);
    if (historyState.undoStack.length > HISTORY_LIMIT) {
      historyState.undoStack.shift();
    }
    historyState.redoStack = [];
  }
  syncWorkspaceDirtyWithHistory(serializedSnapshot);
}
async function applyHistorySnapshot(serializedSnapshot) {
  let rawDocument;
  try {
    rawDocument = JSON.parse(serializedSnapshot);
  } catch {
    return false;
  }
  const previewDocument = sanitizePreviewDocument(rawDocument);
  if (!previewDocument) {
    return false;
  }
  historyState.isApplying = true;
  try {
    await applyPreviewDocumentToState(previewDocument);
  } finally {
    historyState.isApplying = false;
  }
  syncWorkspaceDirtyWithHistory(serializedSnapshot);
  previewShellController?.updateDocumentUi();
  return true;
}
async function undoHistory() {
  if (historyState.undoStack.length <= 1) {
    return false;
  }
  const currentSnapshot = historyState.undoStack.pop();
  const previousSnapshot = historyState.undoStack[historyState.undoStack.length - 1];
  if (!currentSnapshot || !previousSnapshot) {
    if (currentSnapshot) {
      historyState.undoStack.push(currentSnapshot);
    }
    return false;
  }
  historyState.redoStack.push(currentSnapshot);
  const didApply = await applyHistorySnapshot(previousSnapshot);
  if (!didApply) {
    historyState.redoStack.pop();
    historyState.undoStack.push(currentSnapshot);
    return false;
  }
  return true;
}
async function redoHistory() {
  const nextSnapshot = historyState.redoStack.pop();
  if (!nextSnapshot) {
    return false;
  }
  historyState.undoStack.push(nextSnapshot);
  const didApply = await applyHistorySnapshot(nextSnapshot);
  if (!didApply) {
    historyState.undoStack.pop();
    historyState.redoStack.push(nextSnapshot);
    return false;
  }
  return true;
}
function markDocumentDirty() {
  recordHistorySnapshot();
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
function persistActiveDocumentFormatRuntimeState() {
  profileStateController.persistActiveDocumentFormatRuntimeState();
}
function updateExportSettings(updater) {
  profileStateController.updateExportSettings(updater);
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
function createOverlayItemActionRow(options) {
  return overlayEditingController.createOverlayItemActionRow(options);
}
function deleteSelectedOverlayItem() {
  const didDelete = overlayEditingController.deleteSelectedOverlayItem();
  if (!didDelete) {
    return false;
  }
  buildConfigEditor();
  void renderStage();
  return true;
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
async function applyPreviewDocumentFromWorkspace(previewDocument) {
  await applyPreviewDocumentToState(previewDocument);
  resetHistoryFromCurrentDocument(true);
}
async function applyNewDocumentState() {
  await documentStateController.applyNewDocumentState();
  networkOverlayController?.render();
}
async function applyNewDocumentStateFromWorkspace() {
  await applyNewDocumentState();
  resetHistoryFromCurrentDocument(true);
}
function setOverlayVisible(nextVisible) {
  if (state.overlayVisible === nextVisible) {
    syncOverlayVisibilityUi();
    authoringController?.render();
    networkOverlayController?.render();
    previewShellController?.updateViewUi();
    void renderStage();
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
  void renderStage();
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
  syncSelectedOverlaySectionInputs,
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
  getUserHaloPresetDefinitions() {
    return operatorPresetController?.getUserHaloPresetDefinitions() ?? [];
  },
  saveCurrentHaloPreset(label, description) {
    return operatorPresetController.saveCurrentHaloPreset(label, description);
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
resetHistoryFromCurrentDocument(true);
const originalSaveCurrentDocument = documentWorkspaceController.saveCurrentDocument.bind(documentWorkspaceController);
documentWorkspaceController.saveCurrentDocument = async (forceSaveAs, nameOverride) => {
  const didSave = await originalSaveCurrentDocument(forceSaveAs, nameOverride);
  if (didSave) {
    syncHistorySavedSnapshot();
  }
  return didSave;
};
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
operatorPresetController = createOperatorPresetController({
  state
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
  deleteSelectedOverlayItem,
  undoHistory,
  redoHistory,
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
  getLayersEditor,
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
  persistActiveDocumentFormatRuntimeState,
  markDocumentDirty,
  buildConfigEditor
});
function buildConfigEditor() {
  configEditorController.buildConfigEditor();
}
function syncSelectedOverlaySectionInputs() {
  const overlaySection = configEditorController?.getRenderedSectionElement("overlay-layer");
  if (!overlaySection) {
    return;
  }
  syncOverlaySectionInputs(overlaySection, ctx);
}
const initPromise = (async () => {
  await operatorPresetController?.readOperatorPresetLibrary();
  await previewShellController.init();
})();
exportAutomationController?.installAutomationApi(initPromise);
void initPromise.then(() => {
  networkOverlayController?.render();
}).catch(() => {
});
initPromise.catch((error) => {
  console.error(error);
});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFwiLi92ZW5kb3IvYmFzZWxpbmUtZm91bmRyeS90aWVycy9vcy9zdHlsZXMuY3NzXCI7XG5pbXBvcnQgXCIuL3N0eWxlcy5jc3NcIjtcblxuaW1wb3J0IHR5cGUge1xuICBMb2dvUGxhY2VtZW50U3BlYyxcbiAgVGV4dEZpZWxkUGxhY2VtZW50U3BlYyxcbiAgVGV4dFN0eWxlU3BlY1xufSBmcm9tIFwiQGJyYW5kLWxheW91dC1vcHMvY29yZS10eXBlc1wiO1xuaW1wb3J0IHtcbiAgY2xvbmVPdmVybGF5RG9jdW1lbnRQcm9qZWN0LFxuICBjbG9uZU92ZXJsYXlTb3VyY2VEZWZhdWx0U25hcHNob3QsXG4gIGNyZWF0ZUJ1aWx0SW5PdmVybGF5U291cmNlRGVmYXVsdFNuYXBzaG90LFxuICBjcmVhdGVEZWZhdWx0T3ZlcmxheVBhcmFtcyxcbiAgY3JlYXRlT3ZlcmxheURvY3VtZW50UHJvamVjdEZyb21TbmFwc2hvdCxcbiAgbm9ybWFsaXplT3ZlcmxheVBhcmFtc0ZvckVkaXRpbmcsXG4gIHJlc29sdmVPdmVybGF5VGV4dFZhbHVlXG59IGZyb20gXCJAYnJhbmQtbGF5b3V0LW9wcy9vcGVyYXRvci1vdmVybGF5LWxheW91dFwiO1xuaW1wb3J0IHR5cGUge1xuICBPdmVybGF5QmFja2dyb3VuZEVkZ2UsXG4gIE92ZXJsYXlCYWNrZ3JvdW5kTm9kZSxcbiAgT3ZlcmxheUJhY2tncm91bmRPcGVyYXRvcktleSxcbiAgT3ZlcmxheUNvbnRlbnRTb3VyY2UsXG4gIE92ZXJsYXlEb2N1bWVudFByb2plY3QsXG4gIE92ZXJsYXlMYXlvdXRPcGVyYXRvclBhcmFtcyxcbiAgT3ZlcmxheVNjZW5lRmFtaWx5S2V5XG59IGZyb20gXCJAYnJhbmQtbGF5b3V0LW9wcy9vcGVyYXRvci1vdmVybGF5LWxheW91dFwiO1xuaW1wb3J0IHsgZ2V0SGFsb0NvbmZpZ0ZvclByb2ZpbGUgfSBmcm9tIFwiQGJyYW5kLWxheW91dC1vcHMvb3BlcmF0b3ItaGFsby1maWVsZFwiO1xuaW1wb3J0IHR5cGUgeyBIYWxvRmllbGRDb25maWcgfSBmcm9tIFwiQGJyYW5kLWxheW91dC1vcHMvb3BlcmF0b3ItaGFsby1maWVsZFwiO1xuaW1wb3J0IHR5cGUgeyBQYXJhbWV0ZXJTZWN0aW9uRGVmaW5pdGlvbiB9IGZyb20gXCJAYnJhbmQtbGF5b3V0LW9wcy9wYXJhbWV0ZXItdWlcIjtcblxuaW1wb3J0IHR5cGUgeyBTY2VuZUZhbWlseVByZXZpZXdNb2RlIH0gZnJvbSBcIi4vc2NlbmUtZmFtaWx5LXByZXZpZXcuanNcIjtcbmltcG9ydCB7XG4gIGNsb25lT3ZlcmxheVBhcmFtcyxcbiAgY3JlYXRlRGVmYXVsdEV4cG9ydFNldHRpbmdzLFxuICBsb2FkT3V0cHV0Rm9ybWF0S2V5cyxcbiAgc2F2ZU91dHB1dEZvcm1hdEtleSxcbiAgdHlwZSBFeHBvcnRTZXR0aW5nc1xufSBmcm9tIFwiLi9zYW1wbGUtZG9jdW1lbnQuanNcIjtcbmltcG9ydCB7IHR5cGUgUGVyc2lzdGVkT3ZlcmxheVByZXZpZXdEb2N1bWVudCB9IGZyb20gXCIuL3ByZXZpZXctZG9jdW1lbnQuanNcIjtcbmltcG9ydCB7XG4gIGNyZWF0ZURvY3VtZW50V29ya3NwYWNlQ29udHJvbGxlclxufSBmcm9tIFwiLi9kb2N1bWVudC13b3Jrc3BhY2UuanNcIjtcbmltcG9ydCB0eXBlIHtcbiAgR3VpZGVNb2RlLFxuICBPdmVybGF5UHJldmlld0RvY3VtZW50LFxuICBQcmV2aWV3QXBwQ29udGV4dCxcbiAgUHJldmlld1N0YXRlLFxuICBTZWxlY3RlZE9wZXJhdG9ySWQsXG4gIFNlbGVjdGlvblxufSBmcm9tIFwiLi9wcmV2aWV3LWFwcC1jb250ZXh0LmpzXCI7XG5pbXBvcnQge1xuICBPVkVSTEFZX0xBWU9VVF9PUEVSQVRPUl9TRUxFQ1RJT05fSUQsXG4gIFVOVElUTEVEX0RPQ1VNRU5UX05BTUVcbn0gZnJvbSBcIi4vcHJldmlldy1hcHAtY29udGV4dC5qc1wiO1xuaW1wb3J0IHtcbiAgY3JlYXRlQmFja2dyb3VuZEdyYXBoQ29udHJvbGxlclxufSBmcm9tIFwiLi9iYWNrZ3JvdW5kLWdyYXBoLWNvbnRyb2xsZXIuanNcIjtcbmltcG9ydCB7XG4gIGNyZWF0ZUF1dGhvcmluZ0ludGVyYWN0aW9uQ29udHJvbGxlcixcbiAgdHlwZSBBdXRob3JpbmdJbnRlcmFjdGlvbkNvbnRyb2xsZXJcbn0gZnJvbSBcIi4vYXV0aG9yaW5nLWNvbnRyb2xsZXIuanNcIjtcbmltcG9ydCB7XG4gIGNyZWF0ZUNvbmZpZ0VkaXRvckNvbnRyb2xsZXIsXG4gIHR5cGUgQ29uZmlnRWRpdG9yQ29udHJvbGxlclxufSBmcm9tIFwiLi9jb25maWctZWRpdG9yLWNvbnRyb2xsZXIuanNcIjtcbmltcG9ydCB7XG4gIGNyZWF0ZUNzdkRyYWZ0Q29udHJvbGxlcixcbiAgdHlwZSBDc3ZEcmFmdENvbnRyb2xsZXJcbn0gZnJvbSBcIi4vY3N2LWRyYWZ0LWNvbnRyb2xsZXIuanNcIjtcbmltcG9ydCB7XG4gIGNyZWF0ZURvY3VtZW50Rm9ybWF0Q29udHJvbGxlcixcbiAgdHlwZSBEb2N1bWVudEZvcm1hdENvbnRyb2xsZXJcbn0gZnJvbSBcIi4vZG9jdW1lbnQtdGFyZ2V0LWNvbnRyb2xsZXIuanNcIjtcbmltcG9ydCB7XG4gIGNyZWF0ZUV4cG9ydEF1dG9tYXRpb25Db250cm9sbGVyLFxuICB0eXBlIEV4cG9ydEF1dG9tYXRpb25Db250cm9sbGVyXG59IGZyb20gXCIuL2V4cG9ydC1jb250cm9sbGVyLmpzXCI7XG5pbXBvcnQge1xuICBjcmVhdGVPdmVybGF5RWRpdGluZ0NvbnRyb2xsZXIsXG4gIHR5cGUgT3ZlcmxheUVkaXRpbmdDb250cm9sbGVyXG59IGZyb20gXCIuL292ZXJsYXktZWRpdGluZy1jb250cm9sbGVyLmpzXCI7XG5pbXBvcnQge1xuICBjcmVhdGVPcGVyYXRvclByZXNldENvbnRyb2xsZXIsXG4gIHR5cGUgT3BlcmF0b3JQcmVzZXRDb250cm9sbGVyXG59IGZyb20gXCIuL29wZXJhdG9yLXByZXNldC1jb250cm9sbGVyLmpzXCI7XG5pbXBvcnQge1xuICBjcmVhdGVQbGF5YmFja0NvbnRyb2xsZXIsXG4gIHR5cGUgUGxheWJhY2tDb250cm9sbGVyXG59IGZyb20gXCIuL3BsYXliYWNrLWNvbnRyb2xsZXIuanNcIjtcbmltcG9ydCB7XG4gIGNyZWF0ZVByZXZpZXdEb2N1bWVudFN0YXRlQ29udHJvbGxlcixcbiAgdHlwZSBQcmV2aWV3RG9jdW1lbnRTdGF0ZUNvbnRyb2xsZXJcbn0gZnJvbSBcIi4vcHJldmlldy1kb2N1bWVudC1zdGF0ZS1jb250cm9sbGVyLmpzXCI7XG5pbXBvcnQge1xuICBjcmVhdGVQcm9maWxlU3RhdGVDb250cm9sbGVyLFxuICB0eXBlIFByb2ZpbGVTdGF0ZUNvbnRyb2xsZXJcbn0gZnJvbSBcIi4vcHJvZmlsZS1zdGF0ZS1jb250cm9sbGVyLmpzXCI7XG5pbXBvcnQge1xuICBjcmVhdGVTb3VyY2VEZWZhdWx0Q29udHJvbGxlcixcbiAgdHlwZSBTb3VyY2VEZWZhdWx0Q29udHJvbGxlclxufSBmcm9tIFwiLi9zb3VyY2UtZGVmYXVsdC1jb250cm9sbGVyLmpzXCI7XG5pbXBvcnQgeyBjcmVhdGVTdGFnZVJlbmRlckNvbnRyb2xsZXIgfSBmcm9tIFwiLi9zdGFnZS1yZW5kZXItY29udHJvbGxlci5qc1wiO1xuaW1wb3J0IHtcbiAgY3JlYXRlUHJldmlld1NoZWxsQ29udHJvbGxlcixcbiAgdHlwZSBQcmV2aWV3U2hlbGxDb250cm9sbGVyXG59IGZyb20gXCIuL3ByZXZpZXctc2hlbGwtY29udHJvbGxlci5qc1wiO1xuaW1wb3J0IHtcbiAgY3JlYXRlU3RhZ2VOZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXIsXG4gIHR5cGUgU3RhZ2VOZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXJcbn0gZnJvbSBcIi4vc3RhZ2UtbmV0d29yay1vdmVybGF5LWNvbnRyb2xsZXIuanNcIjtcbmltcG9ydCB7IGJ1aWxkRnV6enlCb2lkc1NlY3Rpb24gfSBmcm9tIFwiLi9mdXp6eS1ib2lkcy1zZWN0aW9uLmpzXCI7XG5pbXBvcnQgeyBidWlsZEdyaWRTZWN0aW9uIH0gZnJvbSBcIi4vZ3JpZC1zZWN0aW9uLmpzXCI7XG5pbXBvcnQgeyBidWlsZEhhbG9Db25maWdTZWN0aW9uIH0gZnJvbSBcIi4vaGFsby1jb25maWctc2VjdGlvbi5qc1wiO1xuaW1wb3J0IHsgYnVpbGRPdmVybGF5U2VjdGlvbiwgc3luY092ZXJsYXlTZWN0aW9uSW5wdXRzIH0gZnJvbSBcIi4vb3ZlcmxheS1zZWN0aW9uLmpzXCI7XG5pbXBvcnQgeyBidWlsZFBoeWxsb3RheGlzU2VjdGlvbiB9IGZyb20gXCIuL3BoeWxsb3RheGlzLXNlY3Rpb24uanNcIjtcbmltcG9ydCB7IGJ1aWxkU2NhdHRlclNlY3Rpb24gfSBmcm9tIFwiLi9zY2F0dGVyLXNlY3Rpb24uanNcIjtcblxudHlwZSBDb25maWdTZWN0aW9uRGVmaW5pdGlvbiA9IFBhcmFtZXRlclNlY3Rpb25EZWZpbml0aW9uO1xuXG5jb25zdCBJTklUSUFMX1BST0ZJTEVfS0VZID0gXCJpbnN0YWdyYW1fMTA4MHgxMzUwXCI7XG5jb25zdCBJTklUSUFMX0ZPUk1BVF9LRVkgPSBcImdlbmVyaWNfc29jaWFsXCI7XG5jb25zdCBPVkVSTEFZX1ZJU0lCTEVfU1RPUkFHRV9LRVkgPSBcImJyYW5kLWxheW91dC1vcHMtb3ZlcmxheS12aXNpYmxlLXYxXCI7XG5jb25zdCBORVRXT1JLX09WRVJMQVlfVklTSUJMRV9TVE9SQUdFX0tFWSA9IFwiYnJhbmQtbGF5b3V0LW9wcy1uZXR3b3JrLW92ZXJsYXktdmlzaWJsZS12MVwiO1xuY29uc3QgR1VJREVfTU9ERV9TVE9SQUdFX0tFWSA9IFwiYnJhbmQtbGF5b3V0LW9wcy1ndWlkZS1tb2RlLXYxXCI7XG5jb25zdCBISVNUT1JZX0xJTUlUID0gMTAwO1xuXG5jb25zdCBwZXJzaXN0ZWRGb3JtYXQgPSBsb2FkT3V0cHV0Rm9ybWF0S2V5cygpO1xuY29uc3Qgc3RhcnRQcm9maWxlS2V5ID0gcGVyc2lzdGVkRm9ybWF0Py5wcm9maWxlS2V5ID8/IElOSVRJQUxfUFJPRklMRV9LRVk7XG5jb25zdCBzdGFydEZvcm1hdEtleSA9IHBlcnNpc3RlZEZvcm1hdD8uZm9ybWF0S2V5ID8/IElOSVRJQUxfRk9STUFUX0tFWTtcbmNvbnN0IElOSVRJQUxfUEFSQU1TID0gY3JlYXRlRGVmYXVsdE92ZXJsYXlQYXJhbXMoc3RhcnRQcm9maWxlS2V5LCBzdGFydEZvcm1hdEtleSk7XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUd1aWRlTW9kZShyYXdHdWlkZU1vZGU6IHVua25vd24pOiBHdWlkZU1vZGUge1xuICByZXR1cm4gcmF3R3VpZGVNb2RlID09PSBcIm9mZlwiIHx8IHJhd0d1aWRlTW9kZSA9PT0gXCJiYXNlbGluZVwiXG4gICAgPyByYXdHdWlkZU1vZGVcbiAgICA6IFwiY29tcG9zaXRpb25cIjtcbn1cblxuY29uc3QgSU5JVElBTF9TT1VSQ0VfREVGQVVMVFMgPSBjcmVhdGVCdWlsdEluT3ZlcmxheVNvdXJjZURlZmF1bHRTbmFwc2hvdDxFeHBvcnRTZXR0aW5ncywgSGFsb0ZpZWxkQ29uZmlnLCBHdWlkZU1vZGU+KHtcbiAgb3V0cHV0UHJvZmlsZUtleTogSU5JVElBTF9QUk9GSUxFX0tFWSxcbiAgY29udGVudEZvcm1hdEtleTogSU5JVElBTF9GT1JNQVRfS0VZLFxuICBndWlkZU1vZGU6IFwiY29tcG9zaXRpb25cIixcbiAgY3JlYXRlRXhwb3J0U2V0dGluZ3M6IGNyZWF0ZURlZmF1bHRFeHBvcnRTZXR0aW5ncyxcbiAgY3JlYXRlSGFsb0NvbmZpZzogZ2V0SGFsb0NvbmZpZ0ZvclByb2ZpbGVcbn0pO1xuXG5jb25zdCBJTklUSUFMX1NPVVJDRV9ERUZBVUxUX1BST0pFQ1QgPSBjcmVhdGVPdmVybGF5RG9jdW1lbnRQcm9qZWN0RnJvbVNuYXBzaG90KElOSVRJQUxfU09VUkNFX0RFRkFVTFRTKTtcbmNvbnN0IElOSVRJQUxfRE9DVU1FTlRfRk9STUFUX0lEID0gSU5JVElBTF9TT1VSQ0VfREVGQVVMVF9QUk9KRUNULmFjdGl2ZVRhcmdldElkO1xuXG5jb25zdCBzdGF0ZTogUHJldmlld1N0YXRlID0ge1xuICBwYXJhbXM6IGNsb25lT3ZlcmxheVBhcmFtcyhJTklUSUFMX1BBUkFNUyksXG4gIHNlbGVjdGVkOiBudWxsLFxuICBndWlkZU1vZGU6IG5vcm1hbGl6ZUd1aWRlTW9kZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShHVUlERV9NT0RFX1NUT1JBR0VfS0VZKSA/PyBcImNvbXBvc2l0aW9uXCIpLFxuICBvdmVybGF5VmlzaWJsZTogbG9jYWxTdG9yYWdlLmdldEl0ZW0oT1ZFUkxBWV9WSVNJQkxFX1NUT1JBR0VfS0VZKSAhPT0gXCIwXCIsXG4gIG5ldHdvcmtPdmVybGF5VmlzaWJsZTogbG9jYWxTdG9yYWdlLmdldEl0ZW0oTkVUV09SS19PVkVSTEFZX1ZJU0lCTEVfU1RPUkFHRV9LRVkpID09PSBcIjFcIixcbiAgcGVuZGluZ0NzdkRyYWZ0c0J5QnVja2V0OiB7fSxcbiAgb3V0cHV0UHJvZmlsZUtleTogc3RhcnRQcm9maWxlS2V5LFxuICBjb250ZW50Rm9ybWF0S2V5OiBzdGFydEZvcm1hdEtleSxcbiAgZG9jdW1lbnRGb3JtYXRCdWNrZXRzOiB7XG4gICAgW0lOSVRJQUxfRE9DVU1FTlRfRk9STUFUX0lEXToge1xuICAgICAgW3N0YXJ0Rm9ybWF0S2V5XTogY2xvbmVPdmVybGF5UGFyYW1zKElOSVRJQUxfUEFSQU1TKVxuICAgIH1cbiAgfSxcbiAgY29udGVudEZvcm1hdEtleUJ5RG9jdW1lbnRGb3JtYXRJZDoge1xuICAgIFtJTklUSUFMX0RPQ1VNRU5UX0ZPUk1BVF9JRF06IHN0YXJ0Rm9ybWF0S2V5XG4gIH0sXG4gIGV4cG9ydFNldHRpbmdzOiBjcmVhdGVEZWZhdWx0RXhwb3J0U2V0dGluZ3Moc3RhcnRQcm9maWxlS2V5KSxcbiAgZXhwb3J0U2V0dGluZ3NCeURvY3VtZW50Rm9ybWF0SWQ6IHtcbiAgICBbSU5JVElBTF9ET0NVTUVOVF9GT1JNQVRfSURdOiBjcmVhdGVEZWZhdWx0RXhwb3J0U2V0dGluZ3Moc3RhcnRQcm9maWxlS2V5KVxuICB9LFxuICBoYWxvQ29uZmlnOiBnZXRIYWxvQ29uZmlnRm9yUHJvZmlsZShzdGFydFByb2ZpbGVLZXkpLFxuICBoYWxvQ29uZmlnQnlEb2N1bWVudEZvcm1hdElkOiB7XG4gICAgW0lOSVRJQUxfRE9DVU1FTlRfRk9STUFUX0lEXTogZ2V0SGFsb0NvbmZpZ0ZvclByb2ZpbGUoc3RhcnRQcm9maWxlS2V5KVxuICB9LFxuICBzb3VyY2VEZWZhdWx0czogY2xvbmVPdmVybGF5U291cmNlRGVmYXVsdFNuYXBzaG90KElOSVRJQUxfU09VUkNFX0RFRkFVTFRTKSxcbiAgc291cmNlRGVmYXVsdFByb2plY3Q6IGNsb25lT3ZlcmxheURvY3VtZW50UHJvamVjdChJTklUSUFMX1NPVVJDRV9ERUZBVUxUX1BST0pFQ1QpLFxuICBkb2N1bWVudFByb2plY3Q6IGNsb25lT3ZlcmxheURvY3VtZW50UHJvamVjdChJTklUSUFMX1NPVVJDRV9ERUZBVUxUX1BST0pFQ1QpLFxuICBzZWxlY3RlZEJhY2tncm91bmROb2RlSWQ6IElOSVRJQUxfU09VUkNFX0RFRkFVTFRfUFJPSkVDVC5iYWNrZ3JvdW5kR3JhcGguYWN0aXZlTm9kZUlkLFxuICBzZWxlY3RlZE9wZXJhdG9ySWQ6IE9WRVJMQVlfTEFZT1VUX09QRVJBVE9SX1NFTEVDVElPTl9JRCxcbiAgaXNQbGF5aW5nOiB0cnVlLFxuICBwbGF5YmFja1RpbWVTZWM6IDBcbn07XG5cbmNvbnN0IGhpc3RvcnlTdGF0ZSA9IHtcbiAgdW5kb1N0YWNrOiBbXSBhcyBzdHJpbmdbXSxcbiAgcmVkb1N0YWNrOiBbXSBhcyBzdHJpbmdbXSxcbiAgc2F2ZWRTbmFwc2hvdDogbnVsbCBhcyBzdHJpbmcgfCBudWxsLFxuICBpc0FwcGx5aW5nOiBmYWxzZVxufTtcblxuY29uc3QgYmFja2dyb3VuZEdyYXBoQ29udHJvbGxlciA9IGNyZWF0ZUJhY2tncm91bmRHcmFwaENvbnRyb2xsZXIoeyBzdGF0ZSB9KTtcblxuY29uc3QgcHJldmlld0RvY3VtZW50QnJpZGdlID0ge1xuICBwZXJzaXN0QWN0aXZlRG9jdW1lbnRGb3JtYXRSdW50aW1lU3RhdGUsXG4gIGdldE9yQ3JlYXRlRG9jdW1lbnRGb3JtYXRQYXJhbXMsXG4gIG5vcm1hbGl6ZVBhcmFtczogbm9ybWFsaXplUGFyYW1zVGV4dEZpZWxkT2Zmc2V0cyxcbiAgc3luY0hhbG9Db25maWdGb3JBY3RpdmVEb2N1bWVudEZvcm1hdFxufTtcblxubGV0IHByZXZpZXdTaGVsbENvbnRyb2xsZXI6IFByZXZpZXdTaGVsbENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcbmxldCBuZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXI6IFN0YWdlTmV0d29ya092ZXJsYXlDb250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG5cbmNvbnN0IGRvY3VtZW50V29ya3NwYWNlQ29udHJvbGxlciA9IGNyZWF0ZURvY3VtZW50V29ya3NwYWNlQ29udHJvbGxlcjxPdmVybGF5UHJldmlld0RvY3VtZW50Pih7XG4gIHVudGl0bGVkTmFtZTogVU5USVRMRURfRE9DVU1FTlRfTkFNRSxcbiAgaW5pdGlhbFN0YXR1c01lc3NhZ2U6IFwiT3BlbiBvciBzYXZlIGEgbG9jYWwgZG9jdW1lbnQgZmlsZS5cIixcbiAgcGFyc2VEb2N1bWVudDogc2FuaXRpemVQcmV2aWV3RG9jdW1lbnQsXG4gIGdldERvY3VtZW50TWV0YWRhdGE6IChwcmV2aWV3RG9jdW1lbnQpID0+IHByZXZpZXdEb2N1bWVudC5kb2N1bWVudC5tZXRhZGF0YSxcbiAgYnVpbGRQZXJzaXN0ZWREb2N1bWVudDogYnVpbGRDdXJyZW50RG9jdW1lbnRQZXJzaXN0ZW5jZSxcbiAgYXBwbHlEb2N1bWVudDogYXBwbHlQcmV2aWV3RG9jdW1lbnRGcm9tV29ya3NwYWNlLFxuICBhcHBseU5ld0RvY3VtZW50U3RhdGU6IGFwcGx5TmV3RG9jdW1lbnRTdGF0ZUZyb21Xb3Jrc3BhY2UsXG4gIG9uV29ya3NwYWNlQ2hhbmdlOiAoKSA9PiB7XG4gICAgcHJldmlld1NoZWxsQ29udHJvbGxlcj8udXBkYXRlRG9jdW1lbnRVaSgpO1xuICB9XG59KTtcblxubGV0IGxvZ29JbnRyaW5zaWNXaWR0aCA9IDA7XG5sZXQgbG9nb0ludHJpbnNpY0hlaWdodCA9IDA7XG5sZXQgZXhwb3J0QXV0b21hdGlvbkNvbnRyb2xsZXI6IEV4cG9ydEF1dG9tYXRpb25Db250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG5sZXQgYXV0aG9yaW5nQ29udHJvbGxlcjogQXV0aG9yaW5nSW50ZXJhY3Rpb25Db250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG5sZXQgc291cmNlRGVmYXVsdENvbnRyb2xsZXI6IFNvdXJjZURlZmF1bHRDb250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG5sZXQgY3N2RHJhZnRDb250cm9sbGVyOiBDc3ZEcmFmdENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcbmxldCBwbGF5YmFja0NvbnRyb2xsZXI6IFBsYXliYWNrQ29udHJvbGxlciB8IG51bGwgPSBudWxsO1xubGV0IG92ZXJsYXlFZGl0aW5nQ29udHJvbGxlcjogT3ZlcmxheUVkaXRpbmdDb250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG5sZXQgb3BlcmF0b3JQcmVzZXRDb250cm9sbGVyOiBPcGVyYXRvclByZXNldENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcbmxldCBjb25maWdFZGl0b3JDb250cm9sbGVyOiBDb25maWdFZGl0b3JDb250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG5sZXQgZG9jdW1lbnRGb3JtYXRDb250cm9sbGVyOiBEb2N1bWVudEZvcm1hdENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcbmxldCBwcm9maWxlU3RhdGVDb250cm9sbGVyOiBQcm9maWxlU3RhdGVDb250cm9sbGVyIHwgbnVsbCA9IG51bGw7XG5sZXQgZG9jdW1lbnRTdGF0ZUNvbnRyb2xsZXI6IFByZXZpZXdEb2N1bWVudFN0YXRlQ29udHJvbGxlciB8IG51bGwgPSBudWxsO1xuXG5jb25zdCAkID0gPFQgZXh0ZW5kcyBFbGVtZW50PihzZWxlY3Rvcjogc3RyaW5nKTogVCB8IG51bGwgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxUPihzZWxlY3Rvcik7XG5cbmZ1bmN0aW9uIGdldFN0YWdlRWwoKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgcmV0dXJuICQoXCJbZGF0YS1zdGFnZV1cIik7XG59XG5cbmZ1bmN0aW9uIGdldFN0YWdlU2hlbGxFbCgpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICByZXR1cm4gJChcIltkYXRhLXN0YWdlLXNoZWxsXVwiKTtcbn1cblxuZnVuY3Rpb24gZ2V0Q2FudmFzRWwoKTogSFRNTENhbnZhc0VsZW1lbnQgfCBudWxsIHtcbiAgcmV0dXJuICQoXCJbZGF0YS1zdGFnZS1jYW52YXNdXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRTY2VuZVByZXZpZXdDYW52YXMoKTogSFRNTENhbnZhc0VsZW1lbnQgfCBudWxsIHtcbiAgcmV0dXJuICQoXCJbZGF0YS1zY2VuZS1wcmV2aWV3XVwiKTtcbn1cblxuZnVuY3Rpb24gZ2V0U2NlbmVQcmV2aWV3R3B1Q2FudmFzKCk6IEhUTUxDYW52YXNFbGVtZW50IHwgbnVsbCB7XG4gIHJldHVybiAkKFwiW2RhdGEtc2NlbmUtcHJldmlldy1ncHVdXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRUZXh0T3ZlcmxheUNhbnZhcygpOiBIVE1MQ2FudmFzRWxlbWVudCB8IG51bGwge1xuICByZXR1cm4gJChcIltkYXRhLXRleHQtb3ZlcmxheV1cIik7XG59XG5cbmZ1bmN0aW9uIGdldFN2Z092ZXJsYXkoKTogU1ZHU1ZHRWxlbWVudCB8IG51bGwge1xuICByZXR1cm4gJChcIltkYXRhLXN2Zy1vdmVybGF5XVwiKTtcbn1cblxuZnVuY3Rpb24gZ2V0QXV0aG9yaW5nTGF5ZXJFbCgpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICByZXR1cm4gJChcIltkYXRhLWF1dGhvcmluZy1sYXllcl1cIik7XG59XG5cbmZ1bmN0aW9uIGdldE5ldHdvcmtPdmVybGF5RWwoKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgcmV0dXJuICQoXCJbZGF0YS1uZXR3b3JrLW92ZXJsYXldXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRDb25maWdFZGl0b3IoKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgcmV0dXJuICQoXCJbZGF0YS1jb25maWctZWRpdG9yXVwiKTtcbn1cblxuZnVuY3Rpb24gZ2V0TGF5ZXJzRWRpdG9yKCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIHJldHVybiAkKFwiW2RhdGEtbGF5ZXJzLWVkaXRvcl1cIik7XG59XG5cbmZ1bmN0aW9uIGdldEZvcm1hdE9wdGlvbnMoKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgcmV0dXJuICQoXCJbZGF0YS1mb3JtYXQtb3B0aW9uc11cIik7XG59XG5cbmZ1bmN0aW9uIGdldE92ZXJsYXlWaXNpYmlsaXR5SW5wdXQoKTogSFRNTElucHV0RWxlbWVudCB8IG51bGwge1xuICByZXR1cm4gJChcIltkYXRhLW92ZXJsYXktdmlzaWJpbGl0eV1cIik7XG59XG5cbmNvbnN0IHN0YWdlUmVuZGVyQ29udHJvbGxlciA9IGNyZWF0ZVN0YWdlUmVuZGVyQ29udHJvbGxlcih7XG4gIHN0YXRlLFxuICBnZXRTdGFnZVNoZWxsRWwsXG4gIGdldFN0YWdlRWwsXG4gIGdldENhbnZhc0VsLFxuICBnZXRTY2VuZVByZXZpZXdDYW52YXMsXG4gIGdldFNjZW5lUHJldmlld0dwdUNhbnZhcyxcbiAgZ2V0VGV4dE92ZXJsYXlDYW52YXMsXG4gIGdldFN2Z092ZXJsYXksXG4gIGdldEVmZmVjdGl2ZVBhcmFtcyxcbiAgb25BdXRob3JpbmdSZW5kZXI6ICgpID0+IHtcbiAgICBhdXRob3JpbmdDb250cm9sbGVyPy5yZW5kZXIoKTtcbiAgfVxufSk7XG5cbnByb2ZpbGVTdGF0ZUNvbnRyb2xsZXIgPSBjcmVhdGVQcm9maWxlU3RhdGVDb250cm9sbGVyKHtcbiAgc3RhdGUsXG4gIGNyZWF0ZURlZmF1bHRFeHBvcnRTZXR0aW5ncyxcbiAgZ2V0SGFsb0NvbmZpZ0ZvclByb2ZpbGUsXG4gIG5vcm1hbGl6ZVBhcmFtc1RleHRGaWVsZE9mZnNldHMsXG4gIGdldEVmZmVjdGl2ZVBhcmFtcyxcbiAgbm9ybWFsaXplU2VsZWN0aW9uLFxuICByZXNpemVSZW5kZXJlcixcbiAgcmVuZGVyU3RhZ2UsXG4gIHN5bmNEb2N1bWVudFByb2plY3RUb0N1cnJlbnRPdXRwdXRQcm9maWxlLFxuICBzYXZlT3V0cHV0Rm9ybWF0S2V5XG59KTtcblxuc3luY0hhbG9Db25maWdGb3JBY3RpdmVEb2N1bWVudEZvcm1hdCgpO1xuXG5mdW5jdGlvbiBnZXROb3JtYWxpemVkRG9jdW1lbnROYW1lKHJhd05hbWU6IHN0cmluZyA9IGRvY3VtZW50V29ya3NwYWNlQ29udHJvbGxlci5zdGF0ZS5uYW1lKTogc3RyaW5nIHtcbiAgcmV0dXJuIGRvY3VtZW50V29ya3NwYWNlQ29udHJvbGxlci5nZXROb3JtYWxpemVkTmFtZShyYXdOYW1lKTtcbn1cblxuZnVuY3Rpb24gbG9hZExvZ29JbnRyaW5zaWNEaW1lbnNpb25zKGFzc2V0UGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgIGlmICghYXNzZXRQYXRoKSB7XG4gICAgICBsb2dvSW50cmluc2ljV2lkdGggPSAwO1xuICAgICAgbG9nb0ludHJpbnNpY0hlaWdodCA9IDA7XG4gICAgICByZXNvbHZlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgaW1hZ2UgPSBuZXcgSW1hZ2UoKTtcbiAgICBpbWFnZS5kZWNvZGluZyA9IFwiYXN5bmNcIjtcbiAgICBpbWFnZS5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCAoKSA9PiB7XG4gICAgICBsb2dvSW50cmluc2ljV2lkdGggPSBpbWFnZS5uYXR1cmFsV2lkdGg7XG4gICAgICBsb2dvSW50cmluc2ljSGVpZ2h0ID0gaW1hZ2UubmF0dXJhbEhlaWdodDtcbiAgICAgIHJlc29sdmUoKTtcbiAgICB9KTtcbiAgICBpbWFnZS5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgKCkgPT4ge1xuICAgICAgbG9nb0ludHJpbnNpY1dpZHRoID0gMDtcbiAgICAgIGxvZ29JbnRyaW5zaWNIZWlnaHQgPSAwO1xuICAgICAgcmVzb2x2ZSgpO1xuICAgIH0pO1xuICAgIGltYWdlLnNyYyA9IGFzc2V0UGF0aDtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZUN1cnJlbnREb2N1bWVudEZvckhpc3RvcnkoKTogc3RyaW5nIHtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGJ1aWxkQ3VycmVudERvY3VtZW50UGVyc2lzdGVuY2UoKSk7XG59XG5cbmZ1bmN0aW9uIHN5bmNXb3Jrc3BhY2VEaXJ0eVdpdGhIaXN0b3J5KHNlcmlhbGl6ZWRTbmFwc2hvdDogc3RyaW5nKTogdm9pZCB7XG4gIGlmIChoaXN0b3J5U3RhdGUuc2F2ZWRTbmFwc2hvdCAhPT0gbnVsbCAmJiBzZXJpYWxpemVkU25hcHNob3QgPT09IGhpc3RvcnlTdGF0ZS5zYXZlZFNuYXBzaG90KSB7XG4gICAgZG9jdW1lbnRXb3Jrc3BhY2VDb250cm9sbGVyLnJlc2V0RGlydHkoKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBkb2N1bWVudFdvcmtzcGFjZUNvbnRyb2xsZXIubWFya0RpcnR5KCk7XG59XG5cbmZ1bmN0aW9uIHJlc2V0SGlzdG9yeUZyb21DdXJyZW50RG9jdW1lbnQobWFya0FzU2F2ZWQ6IGJvb2xlYW4gPSB0cnVlKTogdm9pZCB7XG4gIGlmICghZG9jdW1lbnRTdGF0ZUNvbnRyb2xsZXIpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBzZXJpYWxpemVkU25hcHNob3QgPSBzZXJpYWxpemVDdXJyZW50RG9jdW1lbnRGb3JIaXN0b3J5KCk7XG4gIGhpc3RvcnlTdGF0ZS51bmRvU3RhY2sgPSBbc2VyaWFsaXplZFNuYXBzaG90XTtcbiAgaGlzdG9yeVN0YXRlLnJlZG9TdGFjayA9IFtdO1xuICBpZiAobWFya0FzU2F2ZWQpIHtcbiAgICBoaXN0b3J5U3RhdGUuc2F2ZWRTbmFwc2hvdCA9IHNlcmlhbGl6ZWRTbmFwc2hvdDtcbiAgfVxuICBzeW5jV29ya3NwYWNlRGlydHlXaXRoSGlzdG9yeShzZXJpYWxpemVkU25hcHNob3QpO1xufVxuXG5mdW5jdGlvbiBzeW5jSGlzdG9yeVNhdmVkU25hcHNob3QoKTogdm9pZCB7XG4gIGlmICghZG9jdW1lbnRTdGF0ZUNvbnRyb2xsZXIpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBzZXJpYWxpemVkU25hcHNob3QgPSBzZXJpYWxpemVDdXJyZW50RG9jdW1lbnRGb3JIaXN0b3J5KCk7XG4gIGlmIChoaXN0b3J5U3RhdGUudW5kb1N0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgIGhpc3RvcnlTdGF0ZS51bmRvU3RhY2sgPSBbc2VyaWFsaXplZFNuYXBzaG90XTtcbiAgfSBlbHNlIHtcbiAgICBoaXN0b3J5U3RhdGUudW5kb1N0YWNrW2hpc3RvcnlTdGF0ZS51bmRvU3RhY2subGVuZ3RoIC0gMV0gPSBzZXJpYWxpemVkU25hcHNob3Q7XG4gIH1cbiAgaGlzdG9yeVN0YXRlLnNhdmVkU25hcHNob3QgPSBzZXJpYWxpemVkU25hcHNob3Q7XG4gIHN5bmNXb3Jrc3BhY2VEaXJ0eVdpdGhIaXN0b3J5KHNlcmlhbGl6ZWRTbmFwc2hvdCk7XG59XG5cbmZ1bmN0aW9uIHJlY29yZEhpc3RvcnlTbmFwc2hvdCgpOiB2b2lkIHtcbiAgaWYgKGhpc3RvcnlTdGF0ZS5pc0FwcGx5aW5nIHx8ICFkb2N1bWVudFN0YXRlQ29udHJvbGxlcikge1xuICAgIGRvY3VtZW50V29ya3NwYWNlQ29udHJvbGxlci5tYXJrRGlydHkoKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBzZXJpYWxpemVkU25hcHNob3QgPSBzZXJpYWxpemVDdXJyZW50RG9jdW1lbnRGb3JIaXN0b3J5KCk7XG4gIGNvbnN0IGN1cnJlbnRTbmFwc2hvdCA9IGhpc3RvcnlTdGF0ZS51bmRvU3RhY2tbaGlzdG9yeVN0YXRlLnVuZG9TdGFjay5sZW5ndGggLSAxXTtcbiAgaWYgKGN1cnJlbnRTbmFwc2hvdCAhPT0gc2VyaWFsaXplZFNuYXBzaG90KSB7XG4gICAgaGlzdG9yeVN0YXRlLnVuZG9TdGFjay5wdXNoKHNlcmlhbGl6ZWRTbmFwc2hvdCk7XG4gICAgaWYgKGhpc3RvcnlTdGF0ZS51bmRvU3RhY2subGVuZ3RoID4gSElTVE9SWV9MSU1JVCkge1xuICAgICAgaGlzdG9yeVN0YXRlLnVuZG9TdGFjay5zaGlmdCgpO1xuICAgIH1cbiAgICBoaXN0b3J5U3RhdGUucmVkb1N0YWNrID0gW107XG4gIH1cbiAgc3luY1dvcmtzcGFjZURpcnR5V2l0aEhpc3Rvcnkoc2VyaWFsaXplZFNuYXBzaG90KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYXBwbHlIaXN0b3J5U25hcHNob3Qoc2VyaWFsaXplZFNuYXBzaG90OiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgbGV0IHJhd0RvY3VtZW50OiB1bmtub3duO1xuICB0cnkge1xuICAgIHJhd0RvY3VtZW50ID0gSlNPTi5wYXJzZShzZXJpYWxpemVkU25hcHNob3QpIGFzIHVua25vd247XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHByZXZpZXdEb2N1bWVudCA9IHNhbml0aXplUHJldmlld0RvY3VtZW50KHJhd0RvY3VtZW50KTtcbiAgaWYgKCFwcmV2aWV3RG9jdW1lbnQpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBoaXN0b3J5U3RhdGUuaXNBcHBseWluZyA9IHRydWU7XG4gIHRyeSB7XG4gICAgYXdhaXQgYXBwbHlQcmV2aWV3RG9jdW1lbnRUb1N0YXRlKHByZXZpZXdEb2N1bWVudCk7XG4gIH0gZmluYWxseSB7XG4gICAgaGlzdG9yeVN0YXRlLmlzQXBwbHlpbmcgPSBmYWxzZTtcbiAgfVxuXG4gIHN5bmNXb3Jrc3BhY2VEaXJ0eVdpdGhIaXN0b3J5KHNlcmlhbGl6ZWRTbmFwc2hvdCk7XG4gIHByZXZpZXdTaGVsbENvbnRyb2xsZXI/LnVwZGF0ZURvY3VtZW50VWkoKTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHVuZG9IaXN0b3J5KCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBpZiAoaGlzdG9yeVN0YXRlLnVuZG9TdGFjay5sZW5ndGggPD0gMSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IGN1cnJlbnRTbmFwc2hvdCA9IGhpc3RvcnlTdGF0ZS51bmRvU3RhY2sucG9wKCk7XG4gIGNvbnN0IHByZXZpb3VzU25hcHNob3QgPSBoaXN0b3J5U3RhdGUudW5kb1N0YWNrW2hpc3RvcnlTdGF0ZS51bmRvU3RhY2subGVuZ3RoIC0gMV07XG4gIGlmICghY3VycmVudFNuYXBzaG90IHx8ICFwcmV2aW91c1NuYXBzaG90KSB7XG4gICAgaWYgKGN1cnJlbnRTbmFwc2hvdCkge1xuICAgICAgaGlzdG9yeVN0YXRlLnVuZG9TdGFjay5wdXNoKGN1cnJlbnRTbmFwc2hvdCk7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGhpc3RvcnlTdGF0ZS5yZWRvU3RhY2sucHVzaChjdXJyZW50U25hcHNob3QpO1xuICBjb25zdCBkaWRBcHBseSA9IGF3YWl0IGFwcGx5SGlzdG9yeVNuYXBzaG90KHByZXZpb3VzU25hcHNob3QpO1xuICBpZiAoIWRpZEFwcGx5KSB7XG4gICAgaGlzdG9yeVN0YXRlLnJlZG9TdGFjay5wb3AoKTtcbiAgICBoaXN0b3J5U3RhdGUudW5kb1N0YWNrLnB1c2goY3VycmVudFNuYXBzaG90KTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVkb0hpc3RvcnkoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGNvbnN0IG5leHRTbmFwc2hvdCA9IGhpc3RvcnlTdGF0ZS5yZWRvU3RhY2sucG9wKCk7XG4gIGlmICghbmV4dFNuYXBzaG90KSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaGlzdG9yeVN0YXRlLnVuZG9TdGFjay5wdXNoKG5leHRTbmFwc2hvdCk7XG4gIGNvbnN0IGRpZEFwcGx5ID0gYXdhaXQgYXBwbHlIaXN0b3J5U25hcHNob3QobmV4dFNuYXBzaG90KTtcbiAgaWYgKCFkaWRBcHBseSkge1xuICAgIGhpc3RvcnlTdGF0ZS51bmRvU3RhY2sucG9wKCk7XG4gICAgaGlzdG9yeVN0YXRlLnJlZG9TdGFjay5wdXNoKG5leHRTbmFwc2hvdCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIG1hcmtEb2N1bWVudERpcnR5KCk6IHZvaWQge1xuICByZWNvcmRIaXN0b3J5U25hcHNob3QoKTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlRG9jdW1lbnRVaSgpOiB2b2lkIHtcbiAgcHJldmlld1NoZWxsQ29udHJvbGxlcj8udXBkYXRlRG9jdW1lbnRVaSgpO1xufVxuXG5mdW5jdGlvbiBnZXRDc3ZEcmFmdEJ1Y2tldEtleShmb3JtYXRJZD86IHN0cmluZywgZm9ybWF0S2V5Pzogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGNzdkRyYWZ0Q29udHJvbGxlciEuZ2V0Q3N2RHJhZnRCdWNrZXRLZXkoZm9ybWF0SWQsIGZvcm1hdEtleSk7XG59XG5cbmZ1bmN0aW9uIGdldFN0YWdlZENzdkRyYWZ0KGZvcm1hdElkPzogc3RyaW5nLCBmb3JtYXRLZXk/OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgcmV0dXJuIGNzdkRyYWZ0Q29udHJvbGxlciEuZ2V0U3RhZ2VkQ3N2RHJhZnQoZm9ybWF0SWQsIGZvcm1hdEtleSk7XG59XG5cbmZ1bmN0aW9uIHNldFN0YWdlZENzdkRyYWZ0KGRyYWZ0OiBzdHJpbmcgfCBudWxsLCBmb3JtYXRJZD86IHN0cmluZywgZm9ybWF0S2V5Pzogc3RyaW5nKTogdm9pZCB7XG4gIGNzdkRyYWZ0Q29udHJvbGxlciEuc2V0U3RhZ2VkQ3N2RHJhZnQoZHJhZnQsIGZvcm1hdElkLCBmb3JtYXRLZXkpO1xufVxuXG5mdW5jdGlvbiBnZXRPdmVybGF5Rm9ybWF0Q3N2UGF0aChmb3JtYXRLZXk6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICByZXR1cm4gY3N2RHJhZnRDb250cm9sbGVyIS5nZXRPdmVybGF5Rm9ybWF0Q3N2UGF0aChmb3JtYXRLZXkpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBmbHVzaFBlbmRpbmdDc3ZEcmFmdHMoKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICByZXR1cm4gY3N2RHJhZnRDb250cm9sbGVyIS5mbHVzaFBlbmRpbmdDc3ZEcmFmdHMoKTtcbn1cblxuZnVuY3Rpb24gZ2V0RWZmZWN0aXZlUGFyYW1zKCk6IE92ZXJsYXlMYXlvdXRPcGVyYXRvclBhcmFtcyB7XG4gIGNvbnN0IHN0YWdlZENzdkRyYWZ0ID0gZ2V0U3RhZ2VkQ3N2RHJhZnQoKTtcbiAgaWYgKGdldENvbnRlbnRTb3VyY2UoKSAhPT0gXCJjc3ZcIiB8fCBzdGFnZWRDc3ZEcmFmdCA9PT0gbnVsbCkge1xuICAgIHJldHVybiBub3JtYWxpemVQYXJhbXNUZXh0RmllbGRPZmZzZXRzKHN0YXRlLnBhcmFtcyk7XG4gIH1cblxuICByZXR1cm4gbm9ybWFsaXplUGFyYW1zVGV4dEZpZWxkT2Zmc2V0cyh7XG4gICAgLi4uc3RhdGUucGFyYW1zLFxuICAgIGNzdkNvbnRlbnQ6IHtcbiAgICAgIGRyYWZ0OiBzdGFnZWRDc3ZEcmFmdCxcbiAgICAgIHJvd0luZGV4OiBzdGF0ZS5wYXJhbXMuY3N2Q29udGVudD8ucm93SW5kZXggPz8gMVxuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGdldENvbnRlbnRTb3VyY2UoKTogT3ZlcmxheUNvbnRlbnRTb3VyY2Uge1xuICByZXR1cm4gc3RhdGUucGFyYW1zLmNvbnRlbnRTb3VyY2UgPT09IFwiY3N2XCIgPyBcImNzdlwiIDogXCJpbmxpbmVcIjtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplU2VsZWN0ZWRCYWNrZ3JvdW5kTm9kZUlkKFxuICBwcmVmZXJyZWROb2RlSWQ6IHN0cmluZyB8IG51bGwgPSBzdGF0ZS5zZWxlY3RlZEJhY2tncm91bmROb2RlSWRcbik6IHN0cmluZyB8IG51bGwge1xuICByZXR1cm4gYmFja2dyb3VuZEdyYXBoQ29udHJvbGxlci5ub3JtYWxpemVTZWxlY3RlZEJhY2tncm91bmROb2RlSWQocHJlZmVycmVkTm9kZUlkKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplU2VsZWN0ZWRPcGVyYXRvcklkKFxuICBwcmVmZXJyZWRPcGVyYXRvcklkOiBzdHJpbmcgfCBudWxsID0gc3RhdGUuc2VsZWN0ZWRPcGVyYXRvcklkXG4pOiBTZWxlY3RlZE9wZXJhdG9ySWQge1xuICByZXR1cm4gYmFja2dyb3VuZEdyYXBoQ29udHJvbGxlci5ub3JtYWxpemVTZWxlY3RlZE9wZXJhdG9ySWQocHJlZmVycmVkT3BlcmF0b3JJZCk7XG59XG5cbmZ1bmN0aW9uIGdldEF2YWlsYWJsZUJhY2tncm91bmRPcGVyYXRvcktleXMoKTogT3ZlcmxheUJhY2tncm91bmRPcGVyYXRvcktleVtdIHtcbiAgcmV0dXJuIGJhY2tncm91bmRHcmFwaENvbnRyb2xsZXIuZ2V0QXZhaWxhYmxlQmFja2dyb3VuZE9wZXJhdG9yS2V5cygpO1xufVxuXG5mdW5jdGlvbiBzZXRTZWxlY3RlZE9wZXJhdG9yKG9wZXJhdG9ySWQ6IHN0cmluZyB8IG51bGwpOiBib29sZWFuIHtcbiAgY29uc3QgZGlkQ2hhbmdlID0gYmFja2dyb3VuZEdyYXBoQ29udHJvbGxlci5zZXRTZWxlY3RlZE9wZXJhdG9yKG9wZXJhdG9ySWQpO1xuICBuZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXI/LnJlbmRlcigpO1xuICByZXR1cm4gZGlkQ2hhbmdlO1xufVxuXG5mdW5jdGlvbiBnZXRTZWxlY3RlZE9wZXJhdG9ySWQoKTogU2VsZWN0ZWRPcGVyYXRvcklkIHtcbiAgcmV0dXJuIGJhY2tncm91bmRHcmFwaENvbnRyb2xsZXIuZ2V0U2VsZWN0ZWRPcGVyYXRvcklkKCk7XG59XG5cbmZ1bmN0aW9uIHNldFNlbGVjdGVkQmFja2dyb3VuZE5vZGUobm9kZUlkOiBzdHJpbmcgfCBudWxsKTogYm9vbGVhbiB7XG4gIHJldHVybiBiYWNrZ3JvdW5kR3JhcGhDb250cm9sbGVyLnNldFNlbGVjdGVkQmFja2dyb3VuZE5vZGUobm9kZUlkKTtcbn1cblxuZnVuY3Rpb24gZ2V0U2VsZWN0ZWRCYWNrZ3JvdW5kTm9kZSgpOiBPdmVybGF5QmFja2dyb3VuZE5vZGUgfCBudWxsIHtcbiAgcmV0dXJuIGJhY2tncm91bmRHcmFwaENvbnRyb2xsZXIuZ2V0U2VsZWN0ZWRCYWNrZ3JvdW5kTm9kZSgpO1xufVxuXG5mdW5jdGlvbiBnZXRTZWxlY3RlZE9wZXJhdG9yR3JvdXAoKTogc3RyaW5nIHtcbiAgcmV0dXJuIGJhY2tncm91bmRHcmFwaENvbnRyb2xsZXIuZ2V0U2VsZWN0ZWRPcGVyYXRvckdyb3VwKCk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVNlbGVjdGVkQmFja2dyb3VuZE5vZGUoXG4gIHVwZGF0ZXI6IChub2RlOiBPdmVybGF5QmFja2dyb3VuZE5vZGUpID0+IE92ZXJsYXlCYWNrZ3JvdW5kTm9kZVxuKTogYm9vbGVhbiB7XG4gIHJldHVybiBiYWNrZ3JvdW5kR3JhcGhDb250cm9sbGVyLnVwZGF0ZVNlbGVjdGVkQmFja2dyb3VuZE5vZGUodXBkYXRlcik7XG59XG5cbmZ1bmN0aW9uIGNvbm5lY3RCYWNrZ3JvdW5kRWRnZShlZGdlOiBPdmVybGF5QmFja2dyb3VuZEVkZ2UpOiBib29sZWFuIHtcbiAgY29uc3QgZGlkQ29ubmVjdCA9IGJhY2tncm91bmRHcmFwaENvbnRyb2xsZXIuY29ubmVjdEJhY2tncm91bmRFZGdlKGVkZ2UpO1xuICBuZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXI/LnJlbmRlcigpO1xuICByZXR1cm4gZGlkQ29ubmVjdDtcbn1cblxuZnVuY3Rpb24gZGlzY29ubmVjdEJhY2tncm91bmRJbnB1dChub2RlSWQ6IHN0cmluZywgcG9ydEtleTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IGRpZERpc2Nvbm5lY3QgPSBiYWNrZ3JvdW5kR3JhcGhDb250cm9sbGVyLmRpc2Nvbm5lY3RCYWNrZ3JvdW5kSW5wdXQobm9kZUlkLCBwb3J0S2V5KTtcbiAgbmV0d29ya092ZXJsYXlDb250cm9sbGVyPy5yZW5kZXIoKTtcbiAgcmV0dXJuIGRpZERpc2Nvbm5lY3Q7XG59XG5cbmZ1bmN0aW9uIHN5bmNEb2N1bWVudEJhY2tncm91bmRHcmFwaCgpOiB2b2lkIHtcbiAgYmFja2dyb3VuZEdyYXBoQ29udHJvbGxlci5zeW5jRG9jdW1lbnRCYWNrZ3JvdW5kR3JhcGgoKTtcbiAgbmV0d29ya092ZXJsYXlDb250cm9sbGVyPy5yZW5kZXIoKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlQmFja2dyb3VuZE5vZGUobm9kZUlkOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgZGlkUmVtb3ZlID0gYmFja2dyb3VuZEdyYXBoQ29udHJvbGxlci5yZW1vdmVCYWNrZ3JvdW5kTm9kZShub2RlSWQpO1xuICBuZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXI/LnJlbmRlcigpO1xuICByZXR1cm4gZGlkUmVtb3ZlO1xufVxuXG5mdW5jdGlvbiBhZGRCYWNrZ3JvdW5kTm9kZShvcGVyYXRvcktleTogT3ZlcmxheUJhY2tncm91bmRPcGVyYXRvcktleSk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBuZXh0Tm9kZUlkID0gYmFja2dyb3VuZEdyYXBoQ29udHJvbGxlci5hZGRCYWNrZ3JvdW5kTm9kZShvcGVyYXRvcktleSk7XG4gIG5ldHdvcmtPdmVybGF5Q29udHJvbGxlcj8ucmVuZGVyKCk7XG4gIHJldHVybiBuZXh0Tm9kZUlkO1xufVxuXG5mdW5jdGlvbiBnZXRSZXNvbHZlZFRleHRGaWVsZFRleHQoZmllbGQ6IFRleHRGaWVsZFBsYWNlbWVudFNwZWMpOiBzdHJpbmcge1xuICByZXR1cm4gcmVzb2x2ZU92ZXJsYXlUZXh0VmFsdWUoZ2V0RWZmZWN0aXZlUGFyYW1zKCksIGZpZWxkKTtcbn1cblxuZnVuY3Rpb24gaGFzU3RhZ2VkQ3N2RHJhZnQoKTogYm9vbGVhbiB7XG4gIHJldHVybiBjc3ZEcmFmdENvbnRyb2xsZXIhLmhhc1N0YWdlZENzdkRyYWZ0KCk7XG59XG5cbmZ1bmN0aW9uIGdldERvY3VtZW50Rm9ybWF0QnVja2V0KGZvcm1hdElkOiBzdHJpbmcpOiBSZWNvcmQ8c3RyaW5nLCBPdmVybGF5TGF5b3V0T3BlcmF0b3JQYXJhbXM+IHtcbiAgcmV0dXJuIHByb2ZpbGVTdGF0ZUNvbnRyb2xsZXIhLmdldERvY3VtZW50Rm9ybWF0QnVja2V0KGZvcm1hdElkKTtcbn1cblxuZnVuY3Rpb24gcGVyc2lzdEFjdGl2ZURvY3VtZW50Rm9ybWF0UnVudGltZVN0YXRlKCk6IHZvaWQge1xuICBwcm9maWxlU3RhdGVDb250cm9sbGVyIS5wZXJzaXN0QWN0aXZlRG9jdW1lbnRGb3JtYXRSdW50aW1lU3RhdGUoKTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlRXhwb3J0U2V0dGluZ3ModXBkYXRlcjogKHNldHRpbmdzOiBFeHBvcnRTZXR0aW5ncykgPT4gRXhwb3J0U2V0dGluZ3MpOiB2b2lkIHtcbiAgcHJvZmlsZVN0YXRlQ29udHJvbGxlciEudXBkYXRlRXhwb3J0U2V0dGluZ3ModXBkYXRlcik7XG59XG5cbmZ1bmN0aW9uIGdldE9yQ3JlYXRlRG9jdW1lbnRGb3JtYXRQYXJhbXMoXG4gIGZvcm1hdElkOiBzdHJpbmcsXG4gIGZvcm1hdEtleTogc3RyaW5nXG4pOiBPdmVybGF5TGF5b3V0T3BlcmF0b3JQYXJhbXMge1xuICByZXR1cm4gcHJvZmlsZVN0YXRlQ29udHJvbGxlciEuZ2V0T3JDcmVhdGVEb2N1bWVudEZvcm1hdFBhcmFtcyhmb3JtYXRJZCwgZm9ybWF0S2V5KTtcbn1cblxuZnVuY3Rpb24gc3luY0hhbG9Db25maWdGb3JBY3RpdmVEb2N1bWVudEZvcm1hdCgpIHtcbiAgcHJvZmlsZVN0YXRlQ29udHJvbGxlciEuc3luY0hhbG9Db25maWdGb3JBY3RpdmVEb2N1bWVudEZvcm1hdCgpO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVTZWxlY3Rpb24oKSB7XG4gIGlmICghc3RhdGUuc2VsZWN0ZWQpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoc3RhdGUuc2VsZWN0ZWQua2luZCA9PT0gXCJsb2dvXCIpIHtcbiAgICBpZiAoIXN0YXRlLnBhcmFtcy5sb2dvKSB7XG4gICAgICBzdGF0ZS5zZWxlY3RlZCA9IG51bGw7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChzdGF0ZS5wYXJhbXMudGV4dEZpZWxkcy5zb21lKChmaWVsZCkgPT4gZmllbGQuaWQgPT09IHN0YXRlLnNlbGVjdGVkPy5pZCkpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBzdGF0ZS5zZWxlY3RlZCA9IG51bGw7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVNlbGVjdGVkVGV4dFZhbHVlKGlkOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpIHtcbiAgb3ZlcmxheUVkaXRpbmdDb250cm9sbGVyIS51cGRhdGVTZWxlY3RlZFRleHRWYWx1ZShpZCwgdmFsdWUpO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVQYXJhbXNUZXh0RmllbGRPZmZzZXRzKHBhcmFtczogT3ZlcmxheUxheW91dE9wZXJhdG9yUGFyYW1zKTogT3ZlcmxheUxheW91dE9wZXJhdG9yUGFyYW1zIHtcbiAgcmV0dXJuIG5vcm1hbGl6ZU92ZXJsYXlQYXJhbXNGb3JFZGl0aW5nKHBhcmFtcyk7XG59XG5cbmZ1bmN0aW9uIGdldERpc3BsYXllZFRleHRGaWVsZE9mZnNldEJhc2VsaW5lcyhmaWVsZDogVGV4dEZpZWxkUGxhY2VtZW50U3BlYyk6IG51bWJlciB7XG4gIHJldHVybiBvdmVybGF5RWRpdGluZ0NvbnRyb2xsZXIhLmdldERpc3BsYXllZFRleHRGaWVsZE9mZnNldEJhc2VsaW5lcyhmaWVsZCk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVRleHRGaWVsZChcbiAgaWQ6IHN0cmluZyxcbiAgdXBkYXRlcjogKGZpZWxkOiBUZXh0RmllbGRQbGFjZW1lbnRTcGVjKSA9PiBUZXh0RmllbGRQbGFjZW1lbnRTcGVjXG4pIHtcbiAgb3ZlcmxheUVkaXRpbmdDb250cm9sbGVyIS51cGRhdGVUZXh0RmllbGQoaWQsIHVwZGF0ZXIpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVUZXh0U3R5bGUoa2V5OiBzdHJpbmcsIHVwZGF0ZXI6IChzdHlsZTogVGV4dFN0eWxlU3BlYykgPT4gVGV4dFN0eWxlU3BlYykge1xuICBvdmVybGF5RWRpdGluZ0NvbnRyb2xsZXIhLnVwZGF0ZVRleHRTdHlsZShrZXksIHVwZGF0ZXIpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVMb2dvKHVwZGF0ZXI6IChsb2dvOiBMb2dvUGxhY2VtZW50U3BlYykgPT4gTG9nb1BsYWNlbWVudFNwZWMpIHtcbiAgb3ZlcmxheUVkaXRpbmdDb250cm9sbGVyIS51cGRhdGVMb2dvKHVwZGF0ZXIpO1xufVxuXG5mdW5jdGlvbiBnZXRDdXJyZW50TG9nb0FzcGVjdFJhdGlvKCk6IG51bWJlciB7XG4gIHJldHVybiBvdmVybGF5RWRpdGluZ0NvbnRyb2xsZXIhLmdldEN1cnJlbnRMb2dvQXNwZWN0UmF0aW8oKTtcbn1cblxuZnVuY3Rpb24gc3luY0xvZ29Ub1RpdGxlRm9udFNpemUodGl0bGVGb250U2l6ZVB4OiBudW1iZXIpIHtcbiAgb3ZlcmxheUVkaXRpbmdDb250cm9sbGVyIS5zeW5jTG9nb1RvVGl0bGVGb250U2l6ZSh0aXRsZUZvbnRTaXplUHgpO1xufVxuXG5mdW5jdGlvbiBzeW5jVGl0bGVUb0xvZ29IZWlnaHQobG9nb0hlaWdodFB4OiBudW1iZXIpIHtcbiAgb3ZlcmxheUVkaXRpbmdDb250cm9sbGVyIS5zeW5jVGl0bGVUb0xvZ29IZWlnaHQobG9nb0hlaWdodFB4KTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlTG9nb1NpemVXaXRoQXNwZWN0UmF0aW8obmV4dEhlaWdodFB4OiBudW1iZXIpIHtcbiAgb3ZlcmxheUVkaXRpbmdDb250cm9sbGVyIS51cGRhdGVMb2dvU2l6ZVdpdGhBc3BlY3RSYXRpbyhuZXh0SGVpZ2h0UHgpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVPdmVybGF5SXRlbUFjdGlvblJvdyhvcHRpb25zPzoge1xuICBzaG93QWRkPzogYm9vbGVhbjtcbiAgc2hvd0RlbGV0ZT86IGJvb2xlYW47XG59KTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgcmV0dXJuIG92ZXJsYXlFZGl0aW5nQ29udHJvbGxlciEuY3JlYXRlT3ZlcmxheUl0ZW1BY3Rpb25Sb3cob3B0aW9ucyk7XG59XG5cbmZ1bmN0aW9uIGRlbGV0ZVNlbGVjdGVkT3ZlcmxheUl0ZW0oKTogYm9vbGVhbiB7XG4gIGNvbnN0IGRpZERlbGV0ZSA9IG92ZXJsYXlFZGl0aW5nQ29udHJvbGxlciEuZGVsZXRlU2VsZWN0ZWRPdmVybGF5SXRlbSgpO1xuICBpZiAoIWRpZERlbGV0ZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGJ1aWxkQ29uZmlnRWRpdG9yKCk7XG4gIHZvaWQgcmVuZGVyU3RhZ2UoKTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIHNlbGVjdChzZWw6IFNlbGVjdGlvbiB8IG51bGwpIHtcbiAgc3RhdGUuc2VsZWN0ZWQgPSBzZWw7XG4gIGlmIChhdXRob3JpbmdDb250cm9sbGVyKSB7XG4gICAgYXV0aG9yaW5nQ29udHJvbGxlci5oYW5kbGVTZWxlY3Rpb25DaGFuZ2UoKTtcbiAgICBuZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXI/LnJlbmRlcigpO1xuICAgIHJldHVybjtcbiAgfVxuICBidWlsZENvbmZpZ0VkaXRvcigpO1xuICBuZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXI/LnJlbmRlcigpO1xufVxuXG5mdW5jdGlvbiBhcHBseVN0YWdlZENzdkRyYWZ0KCkge1xuICBjc3ZEcmFmdENvbnRyb2xsZXIhLmFwcGx5U3RhZ2VkQ3N2RHJhZnQoKTtcbn1cblxuZnVuY3Rpb24gZGlzY2FyZFN0YWdlZENzdkRyYWZ0KCkge1xuICBjc3ZEcmFmdENvbnRyb2xsZXIhLmRpc2NhcmRTdGFnZWRDc3ZEcmFmdCgpO1xufVxuXG5mdW5jdGlvbiBnZXREZWZhdWx0RG9jdW1lbnRGb3JtYXRMYWJlbChwcm9maWxlS2V5OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gZG9jdW1lbnRGb3JtYXRDb250cm9sbGVyIS5nZXREZWZhdWx0RG9jdW1lbnRGb3JtYXRMYWJlbChwcm9maWxlS2V5KTtcbn1cblxuZnVuY3Rpb24gc3luY0RvY3VtZW50UHJvamVjdFRvQ3VycmVudE91dHB1dFByb2ZpbGUoKSB7XG4gIHJldHVybiBkb2N1bWVudEZvcm1hdENvbnRyb2xsZXIhLnN5bmNEb2N1bWVudFByb2plY3RUb0N1cnJlbnRPdXRwdXRQcm9maWxlKCk7XG59XG5cbmZ1bmN0aW9uIGdldFVudXNlZERvY3VtZW50Rm9ybWF0UHJvZmlsZUtleXMoY3VycmVudFByb2ZpbGVLZXk/OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIHJldHVybiBkb2N1bWVudEZvcm1hdENvbnRyb2xsZXIhLmdldFVudXNlZERvY3VtZW50Rm9ybWF0UHJvZmlsZUtleXMoY3VycmVudFByb2ZpbGVLZXkpO1xufVxuXG5mdW5jdGlvbiBnZXRTY2VuZUZhbWlseUxhYmVsKHNjZW5lRmFtaWx5S2V5OiBPdmVybGF5U2NlbmVGYW1pbHlLZXkpOiBzdHJpbmcge1xuICByZXR1cm4gYmFja2dyb3VuZEdyYXBoQ29udHJvbGxlci5nZXRTY2VuZUZhbWlseUxhYmVsKHNjZW5lRmFtaWx5S2V5KTtcbn1cblxuZnVuY3Rpb24gc2V0QWN0aXZlRG9jdW1lbnRGb3JtYXQodGFyZ2V0SWQ6IHN0cmluZyk6IHZvaWQge1xuICBkb2N1bWVudEZvcm1hdENvbnRyb2xsZXIhLnNldEFjdGl2ZURvY3VtZW50Rm9ybWF0KHRhcmdldElkKTtcbn1cblxuZnVuY3Rpb24gYWRkRG9jdW1lbnRGb3JtYXQocHJvZmlsZUtleT86IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gZG9jdW1lbnRGb3JtYXRDb250cm9sbGVyIS5hZGREb2N1bWVudEZvcm1hdChwcm9maWxlS2V5KTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlQWN0aXZlRG9jdW1lbnRGb3JtYXRMYWJlbChyYXdMYWJlbDogc3RyaW5nKTogdm9pZCB7XG4gIGRvY3VtZW50Rm9ybWF0Q29udHJvbGxlciEudXBkYXRlQWN0aXZlRG9jdW1lbnRGb3JtYXRMYWJlbChyYXdMYWJlbCk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUFjdGl2ZURvY3VtZW50Rm9ybWF0UHJvZmlsZShuZXh0UHJvZmlsZUtleTogc3RyaW5nKTogdm9pZCB7XG4gIGRvY3VtZW50Rm9ybWF0Q29udHJvbGxlciEudXBkYXRlQWN0aXZlRG9jdW1lbnRGb3JtYXRQcm9maWxlKG5leHRQcm9maWxlS2V5KTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlQWN0aXZlRG9jdW1lbnRGb3JtYXQoKTogYm9vbGVhbiB7XG4gIHJldHVybiBkb2N1bWVudEZvcm1hdENvbnRyb2xsZXIhLnJlbW92ZUFjdGl2ZURvY3VtZW50Rm9ybWF0KCk7XG59XG5cbmZ1bmN0aW9uIHN3aXRjaE91dHB1dFByb2ZpbGUocHJvZmlsZUtleTogc3RyaW5nLCBvcHRpb25zPzogaW1wb3J0KFwiLi9wcmV2aWV3LWFwcC1jb250ZXh0LmpzXCIpLlN3aXRjaE91dHB1dFByb2ZpbGVPcHRpb25zKSB7XG4gIHByb2ZpbGVTdGF0ZUNvbnRyb2xsZXIhLnN3aXRjaE91dHB1dFByb2ZpbGUocHJvZmlsZUtleSwgb3B0aW9ucyk7XG4gIG5ldHdvcmtPdmVybGF5Q29udHJvbGxlcj8ucmVuZGVyKCk7XG59XG5cbmZ1bmN0aW9uIHN3aXRjaENvbnRlbnRGb3JtYXQoZm9ybWF0S2V5OiBzdHJpbmcpIHtcbiAgcHJvZmlsZVN0YXRlQ29udHJvbGxlciEuc3dpdGNoQ29udGVudEZvcm1hdChmb3JtYXRLZXkpO1xufVxuXG5mdW5jdGlvbiBidWlsZEN1cnJlbnREb2N1bWVudFBheWxvYWQob3ZlcnJpZGVzPzogeyBuYW1lPzogc3RyaW5nOyBjcmVhdGVkQXQ/OiBzdHJpbmc7IHVwZGF0ZWRBdD86IHN0cmluZyB9KTogT3ZlcmxheVByZXZpZXdEb2N1bWVudCB7XG4gIHJldHVybiBkb2N1bWVudFN0YXRlQ29udHJvbGxlciEuYnVpbGRDdXJyZW50RG9jdW1lbnRQYXlsb2FkKG92ZXJyaWRlcyk7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkQ3VycmVudERvY3VtZW50UGVyc2lzdGVuY2Uob3ZlcnJpZGVzPzogeyBuYW1lPzogc3RyaW5nOyBjcmVhdGVkQXQ/OiBzdHJpbmc7IHVwZGF0ZWRBdD86IHN0cmluZyB9KTogUGVyc2lzdGVkT3ZlcmxheVByZXZpZXdEb2N1bWVudCB7XG4gIHJldHVybiBkb2N1bWVudFN0YXRlQ29udHJvbGxlciEuYnVpbGRDdXJyZW50RG9jdW1lbnRQZXJzaXN0ZW5jZShvdmVycmlkZXMpO1xufVxuXG5mdW5jdGlvbiBzYW5pdGl6ZVByZXZpZXdEb2N1bWVudChyYXdEb2N1bWVudDogdW5rbm93bik6IE92ZXJsYXlQcmV2aWV3RG9jdW1lbnQgfCBudWxsIHtcbiAgcmV0dXJuIGRvY3VtZW50U3RhdGVDb250cm9sbGVyIS5zYW5pdGl6ZVByZXZpZXdEb2N1bWVudChyYXdEb2N1bWVudCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGFwcGx5UHJldmlld0RvY3VtZW50VG9TdGF0ZShwcmV2aWV3RG9jdW1lbnQ6IE92ZXJsYXlQcmV2aWV3RG9jdW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgZG9jdW1lbnRTdGF0ZUNvbnRyb2xsZXIhLmFwcGx5UHJldmlld0RvY3VtZW50VG9TdGF0ZShwcmV2aWV3RG9jdW1lbnQpO1xuICBuZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXI/LnJlbmRlcigpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBhcHBseVByZXZpZXdEb2N1bWVudEZyb21Xb3Jrc3BhY2UocHJldmlld0RvY3VtZW50OiBPdmVybGF5UHJldmlld0RvY3VtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGFwcGx5UHJldmlld0RvY3VtZW50VG9TdGF0ZShwcmV2aWV3RG9jdW1lbnQpO1xuICByZXNldEhpc3RvcnlGcm9tQ3VycmVudERvY3VtZW50KHRydWUpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBhcHBseU5ld0RvY3VtZW50U3RhdGUoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGRvY3VtZW50U3RhdGVDb250cm9sbGVyIS5hcHBseU5ld0RvY3VtZW50U3RhdGUoKTtcbiAgbmV0d29ya092ZXJsYXlDb250cm9sbGVyPy5yZW5kZXIoKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYXBwbHlOZXdEb2N1bWVudFN0YXRlRnJvbVdvcmtzcGFjZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgYXBwbHlOZXdEb2N1bWVudFN0YXRlKCk7XG4gIHJlc2V0SGlzdG9yeUZyb21DdXJyZW50RG9jdW1lbnQodHJ1ZSk7XG59XG5cbmZ1bmN0aW9uIHNldE92ZXJsYXlWaXNpYmxlKG5leHRWaXNpYmxlOiBib29sZWFuKSB7XG4gIGlmIChzdGF0ZS5vdmVybGF5VmlzaWJsZSA9PT0gbmV4dFZpc2libGUpIHtcbiAgICBzeW5jT3ZlcmxheVZpc2liaWxpdHlVaSgpO1xuICAgIGF1dGhvcmluZ0NvbnRyb2xsZXI/LnJlbmRlcigpO1xuICAgIG5ldHdvcmtPdmVybGF5Q29udHJvbGxlcj8ucmVuZGVyKCk7XG4gICAgcHJldmlld1NoZWxsQ29udHJvbGxlcj8udXBkYXRlVmlld1VpKCk7XG4gICAgdm9pZCByZW5kZXJTdGFnZSgpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHN0YXRlLm92ZXJsYXlWaXNpYmxlID0gbmV4dFZpc2libGU7XG5cbiAgdHJ5IHsgbG9jYWxTdG9yYWdlLnNldEl0ZW0oT1ZFUkxBWV9WSVNJQkxFX1NUT1JBR0VfS0VZLCBuZXh0VmlzaWJsZSA/IFwiMVwiIDogXCIwXCIpOyB9IGNhdGNoIHsgfVxuXG4gIGlmICghbmV4dFZpc2libGUpIHtcbiAgICBhdXRob3JpbmdDb250cm9sbGVyPy5yZXNldEludGVyYWN0aW9uU3RhdGUoKTtcbiAgfVxuXG4gIHN5bmNPdmVybGF5VmlzaWJpbGl0eVVpKCk7XG4gIGF1dGhvcmluZ0NvbnRyb2xsZXI/LnJlbmRlcigpO1xuICBuZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXI/LnJlbmRlcigpO1xuICBwcmV2aWV3U2hlbGxDb250cm9sbGVyPy51cGRhdGVWaWV3VWkoKTtcbiAgdm9pZCByZW5kZXJTdGFnZSgpO1xufVxuXG5mdW5jdGlvbiBzZXROZXR3b3JrT3ZlcmxheVZpc2libGUobmV4dFZpc2libGU6IGJvb2xlYW4pIHtcbiAgaWYgKHN0YXRlLm5ldHdvcmtPdmVybGF5VmlzaWJsZSA9PT0gbmV4dFZpc2libGUpIHtcbiAgICBuZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXI/LnJlbmRlcigpO1xuICAgIHByZXZpZXdTaGVsbENvbnRyb2xsZXI/LnVwZGF0ZVZpZXdVaSgpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHN0YXRlLm5ldHdvcmtPdmVybGF5VmlzaWJsZSA9IG5leHRWaXNpYmxlO1xuXG4gIHRyeSB7IGxvY2FsU3RvcmFnZS5zZXRJdGVtKE5FVFdPUktfT1ZFUkxBWV9WSVNJQkxFX1NUT1JBR0VfS0VZLCBuZXh0VmlzaWJsZSA/IFwiMVwiIDogXCIwXCIpOyB9IGNhdGNoIHsgfVxuXG4gIG5ldHdvcmtPdmVybGF5Q29udHJvbGxlcj8ucmVuZGVyKCk7XG4gIHByZXZpZXdTaGVsbENvbnRyb2xsZXI/LnVwZGF0ZVZpZXdVaSgpO1xufVxuXG5mdW5jdGlvbiBzeW5jT3ZlcmxheVZpc2liaWxpdHlVaSgpIHtcbiAgY29uc3Qgc3ZnID0gZ2V0U3ZnT3ZlcmxheSgpO1xuICBjb25zdCBhdXRob3JpbmdMYXllciA9IGdldEF1dGhvcmluZ0xheWVyRWwoKTtcbiAgY29uc3Qgb3ZlcmxheVZpc2liaWxpdHlJbnB1dCA9IGdldE92ZXJsYXlWaXNpYmlsaXR5SW5wdXQoKTtcblxuICBpZiAob3ZlcmxheVZpc2liaWxpdHlJbnB1dCkge1xuICAgIG92ZXJsYXlWaXNpYmlsaXR5SW5wdXQuY2hlY2tlZCA9IHN0YXRlLm92ZXJsYXlWaXNpYmxlO1xuICB9XG5cbiAgaWYgKHN2Zykge1xuICAgIHN2Zy5zdHlsZS5kaXNwbGF5ID0gc3RhdGUub3ZlcmxheVZpc2libGUgPyBcImJsb2NrXCIgOiBcIm5vbmVcIjtcbiAgfVxuXG4gIGlmIChhdXRob3JpbmdMYXllcikge1xuICAgIGF1dGhvcmluZ0xheWVyLnN0eWxlLmRpc3BsYXkgPSBzdGF0ZS5vdmVybGF5VmlzaWJsZSA/IFwiYmxvY2tcIiA6IFwibm9uZVwiO1xuICAgIGF1dGhvcmluZ0xheWVyLnN0eWxlLnBvaW50ZXJFdmVudHMgPSBzdGF0ZS5vdmVybGF5VmlzaWJsZSA/IFwiYXV0b1wiIDogXCJub25lXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVzaXplUmVuZGVyZXIoKSB7XG4gIHN0YWdlUmVuZGVyQ29udHJvbGxlci5yZXNpemVSZW5kZXJlcigpO1xuICBhdXRob3JpbmdDb250cm9sbGVyPy5yZW5kZXIoKTtcbiAgbmV0d29ya092ZXJsYXlDb250cm9sbGVyPy5yZW5kZXIoKTtcbn1cblxuZnVuY3Rpb24gc3luY0JhY2tncm91bmRSZW5kZXJlclZpc2liaWxpdHkoKSB7XG4gIHN0YWdlUmVuZGVyQ29udHJvbGxlci5zeW5jQmFja2dyb3VuZFJlbmRlcmVyVmlzaWJpbGl0eSgpO1xufVxuXG5mdW5jdGlvbiBnZXRTY2VuZUZhbWlseVByZXZpZXdTdGF0ZShtb2RlOiBTY2VuZUZhbWlseVByZXZpZXdNb2RlID0gXCJpbnRlcmFjdGl2ZVwiKSB7XG4gIHJldHVybiBzdGFnZVJlbmRlckNvbnRyb2xsZXIuZ2V0U2NlbmVGYW1pbHlQcmV2aWV3U3RhdGUobW9kZSk7XG59XG5cbmZ1bmN0aW9uIHJlbmRlckJhY2tncm91bmRGcmFtZShtb2RlOiBTY2VuZUZhbWlseVByZXZpZXdNb2RlID0gXCJpbnRlcmFjdGl2ZVwiKSB7XG4gIHN0YWdlUmVuZGVyQ29udHJvbGxlci5yZW5kZXJCYWNrZ3JvdW5kRnJhbWUobW9kZSk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVBsYXliYWNrVG9nZ2xlVWkoKSB7IHBsYXliYWNrQ29udHJvbGxlciEudXBkYXRlUGxheWJhY2tUb2dnbGVVaSgpOyB9XG5mdW5jdGlvbiBzdG9wUGxheWJhY2tMb29wKCkgeyBwbGF5YmFja0NvbnRyb2xsZXIhLnN0b3BQbGF5YmFja0xvb3AoKTsgfVxuZnVuY3Rpb24gZW5zdXJlUGxheWJhY2tMb29wKCkgeyBwbGF5YmFja0NvbnRyb2xsZXIhLmVuc3VyZVBsYXliYWNrTG9vcCgpOyB9XG5mdW5jdGlvbiBzZXRQbGF5YmFja1BsYXlpbmcobmV4dElzUGxheWluZzogYm9vbGVhbikgeyBwbGF5YmFja0NvbnRyb2xsZXIhLnNldFBsYXliYWNrUGxheWluZyhuZXh0SXNQbGF5aW5nKTsgfVxuZnVuY3Rpb24gdG9nZ2xlUGxheWJhY2soKSB7IHBsYXliYWNrQ29udHJvbGxlciEudG9nZ2xlUGxheWJhY2soKTsgfVxuXG5hc3luYyBmdW5jdGlvbiByZW5kZXJTdGFnZShtb2RlOiBTY2VuZUZhbWlseVByZXZpZXdNb2RlID0gXCJpbnRlcmFjdGl2ZVwiKSB7XG4gIGF3YWl0IHN0YWdlUmVuZGVyQ29udHJvbGxlci5yZW5kZXJTdGFnZShtb2RlKTtcbn1cblxuZnVuY3Rpb24gYnVpbGRGb3JtYXRPcHRpb25zKCkge1xuICBkb2N1bWVudEZvcm1hdENvbnRyb2xsZXIhLmJ1aWxkRm9ybWF0T3B0aW9ucygpO1xufVxuXG5mdW5jdGlvbiBnZXRTZWxlY3RlZE92ZXJsYXlTZWN0aW9uVGl0bGUoKTogc3RyaW5nIHtcbiAgcmV0dXJuIG92ZXJsYXlFZGl0aW5nQ29udHJvbGxlciEuZ2V0U2VsZWN0ZWRPdmVybGF5U2VjdGlvblRpdGxlKCk7XG59XG5cbmZ1bmN0aW9uIGdldFNlbGVjdGVkVGV4dEZpZWxkKCk6IFRleHRGaWVsZFBsYWNlbWVudFNwZWMgfCBudWxsIHtcbiAgcmV0dXJuIG92ZXJsYXlFZGl0aW5nQ29udHJvbGxlciEuZ2V0U2VsZWN0ZWRUZXh0RmllbGQoKTtcbn1cblxuZnVuY3Rpb24gYXBwbHlTZWxlY3RlZFRleHRTdHlsZShzdHlsZUtleTogc3RyaW5nKSB7XG4gIG92ZXJsYXlFZGl0aW5nQ29udHJvbGxlciEuYXBwbHlTZWxlY3RlZFRleHRTdHlsZShzdHlsZUtleSk7XG59XG5cbmNvbnN0IGN0eDogUHJldmlld0FwcENvbnRleHQgPSB7XG4gIHN0YXRlLFxuICByZW5kZXJTdGFnZSxcbiAgYnVpbGRDb25maWdFZGl0b3IsXG4gIHN5bmNTZWxlY3RlZE92ZXJsYXlTZWN0aW9uSW5wdXRzLFxuICBidWlsZEZvcm1hdE9wdGlvbnMsXG4gIHJlc2l6ZVJlbmRlcmVyLFxuICBzeW5jT3ZlcmxheVZpc2liaWxpdHlVaSxcbiAgdXBkYXRlUGxheWJhY2tUb2dnbGVVaSxcbiAgdXBkYXRlRG9jdW1lbnRVaSxcbiAgbWFya0RvY3VtZW50RGlydHksXG4gIHNlbGVjdCxcbiAgdG9nZ2xlUGxheWJhY2ssXG4gIHNldFBsYXliYWNrUGxheWluZyxcbiAgc2V0T3ZlcmxheVZpc2libGUsXG4gIG5vcm1hbGl6ZVBhcmFtc1RleHRGaWVsZE9mZnNldHMsXG4gIHVwZGF0ZUV4cG9ydFNldHRpbmdzLFxuICB1cGRhdGVUZXh0RmllbGQsXG4gIHVwZGF0ZUxvZ28sXG4gIHVwZGF0ZUxvZ29TaXplV2l0aEFzcGVjdFJhdGlvLFxuICBnZXRDdXJyZW50TG9nb0FzcGVjdFJhdGlvLFxuICBsb2FkTG9nb0ludHJpbnNpY0RpbWVuc2lvbnMsXG4gIGFwcGx5U2VsZWN0ZWRUZXh0U3R5bGUsXG4gIHVwZGF0ZVRleHRTdHlsZSxcbiAgc3luY0xvZ29Ub1RpdGxlRm9udFNpemUsXG4gIHN5bmNUaXRsZVRvTG9nb0hlaWdodCxcbiAgZ2V0RGlzcGxheWVkVGV4dEZpZWxkT2Zmc2V0QmFzZWxpbmVzLFxuICBnZXRSZXNvbHZlZFRleHRGaWVsZFRleHQsXG4gIHVwZGF0ZVNlbGVjdGVkVGV4dFZhbHVlLFxuICBnZXRTZWxlY3RlZFRleHRGaWVsZCxcbiAgZ2V0U2VsZWN0ZWRPdmVybGF5U2VjdGlvblRpdGxlLFxuICBjcmVhdGVPdmVybGF5SXRlbUFjdGlvblJvdyxcbiAgc3dpdGNoQ29udGVudEZvcm1hdCxcbiAgc2V0U3RhZ2VkQ3N2RHJhZnQsXG4gIGdldFN0YWdlZENzdkRyYWZ0LFxuICBoYXNTdGFnZWRDc3ZEcmFmdCxcbiAgYXBwbHlTdGFnZWRDc3ZEcmFmdCxcbiAgZGlzY2FyZFN0YWdlZENzdkRyYWZ0LFxuICBnZXRDb250ZW50U291cmNlLFxuICBnZXRFZmZlY3RpdmVQYXJhbXMsXG4gIHN3aXRjaE91dHB1dFByb2ZpbGUsXG4gIGFwcGx5U291cmNlRGVmYXVsdFNuYXBzaG90KHNuYXBzaG90KSB7XG4gICAgc291cmNlRGVmYXVsdENvbnRyb2xsZXI/LmFwcGx5U291cmNlRGVmYXVsdFNuYXBzaG90KHNuYXBzaG90KTtcbiAgfSxcbiAgd3JpdGVDdXJyZW50QXNTb3VyY2VEZWZhdWx0KCkge1xuICAgIHJldHVybiBzb3VyY2VEZWZhdWx0Q29udHJvbGxlciEud3JpdGVDdXJyZW50QXNTb3VyY2VEZWZhdWx0KCk7XG4gIH0sXG4gIHNldFNvdXJjZURlZmF1bHRTdGF0dXMobWVzc2FnZSwgc2V2ZXJpdHkpIHtcbiAgICBzb3VyY2VEZWZhdWx0Q29udHJvbGxlcj8uc2V0U291cmNlRGVmYXVsdFN0YXR1cyhtZXNzYWdlLCBzZXZlcml0eSBhcyBcIm5ldXRyYWxcIiB8IFwic3VjY2Vzc1wiIHwgXCJlcnJvclwiKTtcbiAgfSxcbiAgZ2V0VXNlckhhbG9QcmVzZXREZWZpbml0aW9ucygpIHtcbiAgICByZXR1cm4gb3BlcmF0b3JQcmVzZXRDb250cm9sbGVyPy5nZXRVc2VySGFsb1ByZXNldERlZmluaXRpb25zKCkgPz8gW107XG4gIH0sXG4gIHNhdmVDdXJyZW50SGFsb1ByZXNldChsYWJlbCwgZGVzY3JpcHRpb24pIHtcbiAgICByZXR1cm4gb3BlcmF0b3JQcmVzZXRDb250cm9sbGVyIS5zYXZlQ3VycmVudEhhbG9QcmVzZXQobGFiZWwsIGRlc2NyaXB0aW9uKTtcbiAgfSxcbiAgc2V0U2VsZWN0ZWRCYWNrZ3JvdW5kTm9kZSxcbiAgZ2V0U2VsZWN0ZWRCYWNrZ3JvdW5kTm9kZSxcbiAgdXBkYXRlU2VsZWN0ZWRCYWNrZ3JvdW5kTm9kZSxcbiAgc3luY0RvY3VtZW50QmFja2dyb3VuZEdyYXBoLFxuICBnZXRTY2VuZUZhbWlseVByZXZpZXdTdGF0ZSxcbiAgZ2V0U2NlbmVGYW1pbHlMYWJlbCxcbiAgYWRkRG9jdW1lbnRGb3JtYXQsXG4gIHJlbW92ZUFjdGl2ZURvY3VtZW50Rm9ybWF0LFxuICBzZXRBY3RpdmVEb2N1bWVudEZvcm1hdCxcbiAgdXBkYXRlQWN0aXZlRG9jdW1lbnRGb3JtYXRMYWJlbCxcbiAgdXBkYXRlQWN0aXZlRG9jdW1lbnRGb3JtYXRQcm9maWxlLFxuICBnZXRVbnVzZWREb2N1bWVudEZvcm1hdFByb2ZpbGVLZXlzLFxuICBnZXREZWZhdWx0RG9jdW1lbnRGb3JtYXRMYWJlbCxcbiAgZG9jdW1lbnRXb3Jrc3BhY2U6IGRvY3VtZW50V29ya3NwYWNlQ29udHJvbGxlcixcbiAgZ2V0Tm9ybWFsaXplZERvY3VtZW50TmFtZSxcbiAgZXhwb3J0Q29tcG9zZWRGcmFtZVBuZzogYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IGV4cG9ydEF1dG9tYXRpb25Db250cm9sbGVyPy5leHBvcnRDb21wb3NlZEZyYW1lUG5nKCk7XG4gIH0sXG4gIGV4cG9ydFBuZ1NlcXVlbmNlOiBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgZXhwb3J0QXV0b21hdGlvbkNvbnRyb2xsZXI/LmV4cG9ydFBuZ1NlcXVlbmNlKCk7XG4gIH0sXG4gIGV4cG9ydE1wNDogYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IGV4cG9ydEF1dG9tYXRpb25Db250cm9sbGVyPy5leHBvcnRNcDQoKTtcbiAgfVxufTtcblxuXG5uZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXIgPSBjcmVhdGVTdGFnZU5ldHdvcmtPdmVybGF5Q29udHJvbGxlcih7XG4gIHN0YXRlLFxuICBnZXRTdGFnZUVsLFxuICBnZXRPdmVybGF5RWw6IGdldE5ldHdvcmtPdmVybGF5RWwsXG4gIGdldFNlbGVjdGVkT3BlcmF0b3JJZCxcbiAgZ2V0U2NlbmVGYW1pbHlMYWJlbCxcbiAgZ2V0U2NlbmVGYW1pbHlQcmV2aWV3U3RhdGUsXG4gIHNlbGVjdEJhY2tncm91bmROb2RlKG5vZGVJZDogc3RyaW5nKSB7XG4gICAgY29uc3QgZGlkQ2hhbmdlID0gc2V0U2VsZWN0ZWRPcGVyYXRvcihub2RlSWQpO1xuICAgIGlmIChkaWRDaGFuZ2UpIHtcbiAgICAgIGJ1aWxkQ29uZmlnRWRpdG9yKCk7XG4gICAgfVxuICB9LFxuICBzZWxlY3RPdmVybGF5TGF5b3V0KCkge1xuICAgIHNldFNlbGVjdGVkT3BlcmF0b3IoT1ZFUkxBWV9MQVlPVVRfT1BFUkFUT1JfU0VMRUNUSU9OX0lEKTtcbiAgICBzZWxlY3QobnVsbCk7XG4gIH1cbn0pO1xuYXV0aG9yaW5nQ29udHJvbGxlciA9IGNyZWF0ZUF1dGhvcmluZ0ludGVyYWN0aW9uQ29udHJvbGxlcih7XG4gIGN0eCxcbiAgZ2V0Q3VycmVudFNjZW5lOiAoKSA9PiBzdGFnZVJlbmRlckNvbnRyb2xsZXIuZ2V0Q3VycmVudFNjZW5lKCksXG4gIGdldFN0YWdlRWwsXG4gIGdldEF1dGhvcmluZ0xheWVyRWxcbn0pO1xuXG5kb2N1bWVudFN0YXRlQ29udHJvbGxlciA9IGNyZWF0ZVByZXZpZXdEb2N1bWVudFN0YXRlQ29udHJvbGxlcih7XG4gIHN0YXRlLFxuICBwcmV2aWV3RG9jdW1lbnRCcmlkZ2UsXG4gIGluaXRpYWxTb3VyY2VEZWZhdWx0czogSU5JVElBTF9TT1VSQ0VfREVGQVVMVFMsXG4gIGNyZWF0ZURlZmF1bHRFeHBvcnRTZXR0aW5ncyxcbiAgZ2V0SGFsb0NvbmZpZ0ZvclByb2ZpbGUsXG4gIG5vcm1hbGl6ZUd1aWRlTW9kZSxcbiAgZ2V0Q3VycmVudERvY3VtZW50TmFtZTogKCkgPT4gZ2V0Tm9ybWFsaXplZERvY3VtZW50TmFtZSgpLFxuICBnZXRDdXJyZW50RG9jdW1lbnRDcmVhdGVkQXQ6ICgpID0+IGRvY3VtZW50V29ya3NwYWNlQ29udHJvbGxlci5zdGF0ZS5jcmVhdGVkQXQsXG4gIGdldEN1cnJlbnREb2N1bWVudFVwZGF0ZWRBdDogKCkgPT4gZG9jdW1lbnRXb3Jrc3BhY2VDb250cm9sbGVyLnN0YXRlLnVwZGF0ZWRBdCxcbiAgYnVpbGRDb25maWdFZGl0b3IsXG4gIHJlc2l6ZVJlbmRlcmVyLFxuICByZW5kZXJTdGFnZSxcbiAgbG9hZExvZ29JbnRyaW5zaWNEaW1lbnNpb25zLFxuICByZXNldEF1dGhvcmluZ0ludGVyYWN0aW9uU3RhdGU6ICgpID0+IHtcbiAgICBhdXRob3JpbmdDb250cm9sbGVyPy5yZXNldEludGVyYWN0aW9uU3RhdGUoKTtcbiAgfSxcbiAgbm9ybWFsaXplU2VsZWN0aW9uLFxuICBub3JtYWxpemVTZWxlY3RlZEJhY2tncm91bmROb2RlSWQsXG4gIG5vcm1hbGl6ZVNlbGVjdGVkT3BlcmF0b3JJZFxufSk7XG5cbnJlc2V0SGlzdG9yeUZyb21DdXJyZW50RG9jdW1lbnQodHJ1ZSk7XG5cbmNvbnN0IG9yaWdpbmFsU2F2ZUN1cnJlbnREb2N1bWVudCA9IGRvY3VtZW50V29ya3NwYWNlQ29udHJvbGxlci5zYXZlQ3VycmVudERvY3VtZW50LmJpbmQoZG9jdW1lbnRXb3Jrc3BhY2VDb250cm9sbGVyKTtcbmRvY3VtZW50V29ya3NwYWNlQ29udHJvbGxlci5zYXZlQ3VycmVudERvY3VtZW50ID0gYXN5bmMgKGZvcmNlU2F2ZUFzPzogYm9vbGVhbiwgbmFtZU92ZXJyaWRlPzogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiA9PiB7XG4gIGNvbnN0IGRpZFNhdmUgPSBhd2FpdCBvcmlnaW5hbFNhdmVDdXJyZW50RG9jdW1lbnQoZm9yY2VTYXZlQXMsIG5hbWVPdmVycmlkZSk7XG4gIGlmIChkaWRTYXZlKSB7XG4gICAgc3luY0hpc3RvcnlTYXZlZFNuYXBzaG90KCk7XG4gIH1cbiAgcmV0dXJuIGRpZFNhdmU7XG59O1xuXG5leHBvcnRBdXRvbWF0aW9uQ29udHJvbGxlciA9IGNyZWF0ZUV4cG9ydEF1dG9tYXRpb25Db250cm9sbGVyKHtcbiAgY3R4LFxuICBnZXRDYW52YXNFbCxcbiAgZ2V0U2NlbmVQcmV2aWV3Q2FudmFzLFxuICBnZXRTY2VuZVByZXZpZXdHcHVDYW52YXMsXG4gIGdldFRleHRPdmVybGF5Q2FudmFzLFxuICBnZXRTdmdPdmVybGF5LFxuICBnZXRTY2VuZURlc2NyaXB0b3I6ICgpID0+IHN0YWdlUmVuZGVyQ29udHJvbGxlci5nZXRTY2VuZURlc2NyaXB0b3IoKSxcbiAgbm9ybWFsaXplU2VsZWN0ZWRCYWNrZ3JvdW5kTm9kZUlkLFxuICBidWlsZEN1cnJlbnREb2N1bWVudFBlcnNpc3RlbmNlLFxuICBwYXJzZVByZXZpZXdEb2N1bWVudDogc2FuaXRpemVQcmV2aWV3RG9jdW1lbnQsXG4gICAgYXBwbHlQcmV2aWV3RG9jdW1lbnQ6IGFwcGx5UHJldmlld0RvY3VtZW50VG9TdGF0ZVxufSk7XG5cbmNzdkRyYWZ0Q29udHJvbGxlciA9IGNyZWF0ZUNzdkRyYWZ0Q29udHJvbGxlcih7XG4gIHN0YXRlLFxuICBnZXREb2N1bWVudEZvcm1hdEJ1Y2tldCxcbiAgZ2V0T3JDcmVhdGVEb2N1bWVudEZvcm1hdFBhcmFtcyxcbiAgbWFya0RvY3VtZW50RGlydHlcbn0pO1xuXG5wbGF5YmFja0NvbnRyb2xsZXIgPSBjcmVhdGVQbGF5YmFja0NvbnRyb2xsZXIoe1xuICBzdGF0ZSxcbiAgcmVuZGVyQmFja2dyb3VuZEZyYW1lXG59KTtcblxub3ZlcmxheUVkaXRpbmdDb250cm9sbGVyID0gY3JlYXRlT3ZlcmxheUVkaXRpbmdDb250cm9sbGVyKHtcbiAgc3RhdGUsXG4gIG5vcm1hbGl6ZVBhcmFtc1RleHRGaWVsZE9mZnNldHMsXG4gIG1hcmtEb2N1bWVudERpcnR5LFxuICBidWlsZENvbmZpZ0VkaXRvcixcbiAgcmVuZGVyU3RhZ2UsXG4gIHNlbGVjdCxcbiAgZ2V0TG9nb0ludHJpbnNpY0RpbWVuc2lvbnM6ICgpID0+ICh7XG4gICAgd2lkdGg6IGxvZ29JbnRyaW5zaWNXaWR0aCxcbiAgICBoZWlnaHQ6IGxvZ29JbnRyaW5zaWNIZWlnaHRcbiAgfSlcbn0pO1xuXG5zb3VyY2VEZWZhdWx0Q29udHJvbGxlciA9IGNyZWF0ZVNvdXJjZURlZmF1bHRDb250cm9sbGVyKHtcbiAgc3RhdGUsXG4gIGluaXRpYWxTb3VyY2VEZWZhdWx0czogSU5JVElBTF9TT1VSQ0VfREVGQVVMVFMsXG4gIGluaXRpYWxTb3VyY2VEZWZhdWx0UHJvamVjdDogSU5JVElBTF9TT1VSQ0VfREVGQVVMVF9QUk9KRUNULFxuICBwcmV2aWV3RG9jdW1lbnRCcmlkZ2UsXG4gIGNyZWF0ZURlZmF1bHRFeHBvcnRTZXR0aW5ncyxcbiAgZ2V0SGFsb0NvbmZpZ0ZvclByb2ZpbGUsXG4gIG5vcm1hbGl6ZUd1aWRlTW9kZSxcbiAgZmx1c2hQZW5kaW5nQ3N2RHJhZnRzLFxuICBidWlsZEN1cnJlbnREb2N1bWVudFBheWxvYWQsXG4gIGJ1aWxkQ29uZmlnRWRpdG9yLFxuICBzeW5jRG9jdW1lbnRQcm9qZWN0VG9DdXJyZW50T3V0cHV0UHJvZmlsZSxcbiAgbm9ybWFsaXplU2VsZWN0ZWRCYWNrZ3JvdW5kTm9kZUlkLFxuICBub3JtYWxpemVTZWxlY3RlZE9wZXJhdG9ySWQsXG4gIG5vcm1hbGl6ZVNlbGVjdGlvblxufSk7XG5cbm9wZXJhdG9yUHJlc2V0Q29udHJvbGxlciA9IGNyZWF0ZU9wZXJhdG9yUHJlc2V0Q29udHJvbGxlcih7XG4gIHN0YXRlXG59KTtcblxucHJldmlld1NoZWxsQ29udHJvbGxlciA9IGNyZWF0ZVByZXZpZXdTaGVsbENvbnRyb2xsZXIoe1xuICBzdGF0ZSxcbiAgdW50aXRsZWROYW1lOiBVTlRJVExFRF9ET0NVTUVOVF9OQU1FLFxuICBndWlkZU1vZGVTdG9yYWdlS2V5OiBHVUlERV9NT0RFX1NUT1JBR0VfS0VZLFxuICBkb2N1bWVudFdvcmtzcGFjZTogZG9jdW1lbnRXb3Jrc3BhY2VDb250cm9sbGVyLFxuICBzb3VyY2VEZWZhdWx0Q29udHJvbGxlcixcbiAgbWFya0RvY3VtZW50RGlydHksXG4gIGxvYWRMb2dvSW50cmluc2ljRGltZW5zaW9ucyxcbiAgYnVpbGRDb25maWdFZGl0b3IsXG4gIGJ1aWxkRm9ybWF0T3B0aW9ucyxcbiAgcmVuZGVyU3RhZ2UsXG4gIHJlc2l6ZVJlbmRlcmVyLFxuICB0b2dnbGVQbGF5YmFjayxcbiAgZW5zdXJlUGxheWJhY2tMb29wLFxuICB1cGRhdGVFeHBvcnRTZXR0aW5ncyxcbiAgc2V0T3ZlcmxheVZpc2libGUsXG4gIHNldE5ldHdvcmtPdmVybGF5VmlzaWJsZSxcbiAgYWRkRG9jdW1lbnRGb3JtYXQsXG4gIHJlbW92ZUFjdGl2ZURvY3VtZW50Rm9ybWF0LFxuICBleHBvcnRDb21wb3NlZEZyYW1lUG5nOiBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgZXhwb3J0QXV0b21hdGlvbkNvbnRyb2xsZXI/LmV4cG9ydENvbXBvc2VkRnJhbWVQbmcoKTtcbiAgfSxcbiAgZXhwb3J0UG5nU2VxdWVuY2U6IGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBleHBvcnRBdXRvbWF0aW9uQ29udHJvbGxlcj8uZXhwb3J0UG5nU2VxdWVuY2UoKTtcbiAgfSxcbiAgZXhwb3J0TXA0OiBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgZXhwb3J0QXV0b21hdGlvbkNvbnRyb2xsZXI/LmV4cG9ydE1wNCgpO1xuICB9LFxuICBpbml0SGFsb1JlbmRlcmVyOiAoKSA9PiB7XG4gICAgc3RhZ2VSZW5kZXJDb250cm9sbGVyLmluaXRIYWxvUmVuZGVyZXIoKTtcbiAgfSxcbiAgaW5pdEF1dGhvcmluZzogKCkgPT4ge1xuICAgIGF1dGhvcmluZ0NvbnRyb2xsZXI/LmluaXQoKTtcbiAgfSxcbiAgZGVsZXRlU2VsZWN0ZWRPdmVybGF5SXRlbSxcbiAgdW5kb0hpc3RvcnksXG4gIHJlZG9IaXN0b3J5LFxuICBoYW5kbGVBdXRob3JpbmdFZGl0aW5nS2V5RG93bjogKGV2ZW50KSA9PiB7XG4gICAgcmV0dXJuIGF1dGhvcmluZ0NvbnRyb2xsZXI/LmhhbmRsZUVkaXRpbmdLZXlEb3duKGV2ZW50KSA/PyBmYWxzZTtcbiAgfSxcbiAgaGFuZGxlQXV0aG9yaW5nSW50ZXJhY3Rpb25LZXlEb3duOiAoZXZlbnQpID0+IHtcbiAgICByZXR1cm4gYXV0aG9yaW5nQ29udHJvbGxlcj8uaGFuZGxlSW50ZXJhY3Rpb25LZXlEb3duKGV2ZW50KSA/PyBmYWxzZTtcbiAgfVxufSk7XG5cbmNvbnN0IENPUkVfQ09ORklHX1NFQ1RJT05fREVGSU5JVElPTlM6IENvbmZpZ1NlY3Rpb25EZWZpbml0aW9uW10gPSBbXG4gIHsga2V5OiBcIm92ZXJsYXktbGF5ZXJcIiwgc2NvcGU6IFwib3BlcmF0b3JcIiwgZ3JvdXA6IE9WRVJMQVlfTEFZT1VUX09QRVJBVE9SX1NFTEVDVElPTl9JRCwgb3JkZXI6IDUwMCwgZmFjdG9yeTogKCkgPT4gYnVpbGRPdmVybGF5U2VjdGlvbihjdHgpIH0sXG4gIHsga2V5OiBcImxheW91dC1ncmlkXCIsIHNjb3BlOiBcIm9wZXJhdG9yXCIsIGdyb3VwOiBPVkVSTEFZX0xBWU9VVF9PUEVSQVRPUl9TRUxFQ1RJT05fSUQsIG9yZGVyOiA3MDAsIGZhY3Rvcnk6ICgpID0+IGJ1aWxkR3JpZFNlY3Rpb24oY3R4KSB9LFxuICB7IGtleTogXCJoYWxvLWNvbmZpZ1wiLCBzY29wZTogXCJvcGVyYXRvclwiLCBvcmRlcjogODAwLCBncm91cDogXCJoYWxvXCIsIGZhY3Rvcnk6ICgpID0+IGJ1aWxkSGFsb0NvbmZpZ1NlY3Rpb24oY3R4KSB9LFxuICB7IGtleTogXCJmdXp6eS1ib2lkc1wiLCBzY29wZTogXCJvcGVyYXRvclwiLCBvcmRlcjogODEwLCBncm91cDogXCJmdXp6eS1ib2lkc1wiLCBmYWN0b3J5OiAoKSA9PiBidWlsZEZ1enp5Qm9pZHNTZWN0aW9uKGN0eCkgfSxcbiAgeyBrZXk6IFwicGh5bGxvdGF4aXNcIiwgc2NvcGU6IFwib3BlcmF0b3JcIiwgb3JkZXI6IDgyMCwgZ3JvdXA6IFwicGh5bGxvdGF4aXNcIiwgZmFjdG9yeTogKCkgPT4gYnVpbGRQaHlsbG90YXhpc1NlY3Rpb24oY3R4KSB9LFxuICB7IGtleTogXCJzY2F0dGVyXCIsIHNjb3BlOiBcIm9wZXJhdG9yXCIsIG9yZGVyOiA4MzAsIGdyb3VwOiBcInNjYXR0ZXJcIiwgZmFjdG9yeTogKCkgPT4gYnVpbGRTY2F0dGVyU2VjdGlvbihjdHgpIH1cbl07XG5cbmNvbmZpZ0VkaXRvckNvbnRyb2xsZXIgPSBjcmVhdGVDb25maWdFZGl0b3JDb250cm9sbGVyKHtcbiAgc3RhdGUsXG4gIHNlY3Rpb25EZWZpbml0aW9uczogQ09SRV9DT05GSUdfU0VDVElPTl9ERUZJTklUSU9OUyxcbiAgZ2V0Q29uZmlnRWRpdG9yLFxuICBnZXRMYXllcnNFZGl0b3IsXG4gIGdldFNlbGVjdGVkT3BlcmF0b3JJZCxcbiAgZ2V0U2VsZWN0ZWRPcGVyYXRvckdyb3VwLFxuICBnZXRTY2VuZUZhbWlseUxhYmVsLFxuICBnZXRBdmFpbGFibGVCYWNrZ3JvdW5kT3BlcmF0b3JLZXlzLFxuICBhZGRCYWNrZ3JvdW5kTm9kZSxcbiAgY29ubmVjdEJhY2tncm91bmRFZGdlLFxuICBkaXNjb25uZWN0QmFja2dyb3VuZElucHV0LFxuICBzZXRTZWxlY3RlZE9wZXJhdG9yLFxuICBzZWxlY3RPdmVybGF5SXRlbTogc2VsZWN0LFxuICBzeW5jRG9jdW1lbnRCYWNrZ3JvdW5kR3JhcGgsXG4gIHJlbW92ZUJhY2tncm91bmROb2RlLFxuICBtYXJrRG9jdW1lbnREaXJ0eSxcbiAgc3luY0JhY2tncm91bmRSZW5kZXJlclZpc2liaWxpdHksXG4gIHJlbmRlclN0YWdlXG59KTtcblxuZG9jdW1lbnRGb3JtYXRDb250cm9sbGVyID0gY3JlYXRlRG9jdW1lbnRGb3JtYXRDb250cm9sbGVyKHtcbiAgc3RhdGUsXG4gIGdldEZvcm1hdE9wdGlvbnMsXG4gIHN3aXRjaE91dHB1dFByb2ZpbGUsXG4gIHBlcnNpc3RBY3RpdmVEb2N1bWVudEZvcm1hdFJ1bnRpbWVTdGF0ZSxcbiAgbWFya0RvY3VtZW50RGlydHksXG4gIGJ1aWxkQ29uZmlnRWRpdG9yXG59KTtcblxuZnVuY3Rpb24gYnVpbGRDb25maWdFZGl0b3IoKSB7XG4gIGNvbmZpZ0VkaXRvckNvbnRyb2xsZXIhLmJ1aWxkQ29uZmlnRWRpdG9yKCk7XG59XG5cbmZ1bmN0aW9uIHN5bmNTZWxlY3RlZE92ZXJsYXlTZWN0aW9uSW5wdXRzKCkge1xuICBjb25zdCBvdmVybGF5U2VjdGlvbiA9IGNvbmZpZ0VkaXRvckNvbnRyb2xsZXI/LmdldFJlbmRlcmVkU2VjdGlvbkVsZW1lbnQoXCJvdmVybGF5LWxheWVyXCIpO1xuICBpZiAoIW92ZXJsYXlTZWN0aW9uKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgc3luY092ZXJsYXlTZWN0aW9uSW5wdXRzKG92ZXJsYXlTZWN0aW9uLCBjdHgpO1xufVxuY29uc3QgaW5pdFByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuICBhd2FpdCBvcGVyYXRvclByZXNldENvbnRyb2xsZXI/LnJlYWRPcGVyYXRvclByZXNldExpYnJhcnkoKTtcbiAgYXdhaXQgcHJldmlld1NoZWxsQ29udHJvbGxlciEuaW5pdCgpO1xufSkoKTtcbmV4cG9ydEF1dG9tYXRpb25Db250cm9sbGVyPy5pbnN0YWxsQXV0b21hdGlvbkFwaShpbml0UHJvbWlzZSk7XG52b2lkIGluaXRQcm9taXNlLnRoZW4oKCkgPT4ge1xuICBuZXR3b3JrT3ZlcmxheUNvbnRyb2xsZXI/LnJlbmRlcigpO1xufSkuY2F0Y2goKCkgPT4ge1xuICAvLyBpbml0UHJvbWlzZSBlcnJvciBpcyBoYW5kbGVkIGJlbG93LlxufSk7XG5cbmluaXRQcm9taXNlLmNhdGNoKChlcnJvcjogdW5rbm93bikgPT4ge1xuICBjb25zb2xlLmVycm9yKGVycm9yKTtcbn0pO1xuIl0sIm1hcHBpbmdzIjoiQUFBQSxPQUFPO0FBQ1AsT0FBTztBQU9QO0FBQUEsRUFDRTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLE9BQ0s7QUFVUCxTQUFTLCtCQUErQjtBQUt4QztBQUFBLEVBQ0U7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxPQUVLO0FBQ1AsZUFBcUQ7QUFDckQ7QUFBQSxFQUNFO0FBQUEsT0FDSztBQVNQO0FBQUEsRUFDRTtBQUFBLEVBQ0E7QUFBQSxPQUNLO0FBQ1A7QUFBQSxFQUNFO0FBQUEsT0FDSztBQUNQO0FBQUEsRUFDRTtBQUFBLE9BRUs7QUFD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