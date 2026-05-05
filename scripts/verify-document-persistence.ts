import assert from "node:assert/strict";

import {
  DEFAULT_OUTPUT_PROFILE_KEY,
  OVERLAY_CONTENT_FORMAT_ORDER,
  createCustomOutputProfileKey
} from "@brand-layout-ops/core-types";
import {
  createDefaultOverlayParams,
  createOverlayDocumentFile,
  normalizeOverlayDocumentFileForPersistence,
  normalizeOverlayDocumentProject,
  sanitizeOverlayDocumentFile,
  type OverlayDocumentFormat,
  type OverlayDocumentProject,
  type OverlaySourceDefaultSnapshot
} from "@brand-layout-ops/operator-overlay-layout";

import {
  applySourceDefaultSnapshotToState,
  type OverlayPreviewDocumentBridgeAdapter,
  type OverlayPreviewDocumentBridgeState
} from "../apps/overlay-preview/src/preview-document-bridge.js";
import {
  createDefaultExportSettings,
  type ExportSettings
} from "../apps/overlay-preview/src/sample-document.js";

type TestGuideMode = "bounds";

interface TestHaloConfig {
  profileKey: string;
}

const contentFormatKey = OVERLAY_CONTENT_FORMAT_ORDER[0];
const customProfileKey = createCustomOutputProfileKey(1920, 1080);
const defaultFormatId = "format-default";
const customFormatId = "format-custom-1920x1080";

function createHaloConfig(profileKey: string): TestHaloConfig {
  return { profileKey };
}

function createSnapshot(
  profileKey: string
): OverlaySourceDefaultSnapshot<ExportSettings, TestHaloConfig, TestGuideMode> {
  const exportSettings = createDefaultExportSettings(profileKey);
  const haloConfig = createHaloConfig(profileKey);

  return {
    outputProfileKey: profileKey,
    contentFormatKey,
    profileFormatBuckets: {
      [profileKey]: {
        [contentFormatKey]: createDefaultOverlayParams(profileKey, contentFormatKey)
      }
    },
    contentFormatKeyByProfile: {
      [profileKey]: contentFormatKey
    },
    exportSettings,
    exportSettingsByProfile: {
      [profileKey]: { ...exportSettings }
    },
    haloConfig,
    haloConfigByProfile: {
      [profileKey]: { ...haloConfig }
    },
    guideMode: "bounds"
  };
}

function createFormat(
  id: string,
  label: string,
  outputProfileKey: string,
  derivedFromFormatId: string | null = null
): OverlayDocumentFormat {
  return {
    id,
    label,
    outputProfileKey,
    formatPresetKey: null,
    derivedFromFormatId
  };
}

function createStaleSnapshotProject(): OverlayDocumentProject {
  const staleDefaultSnapshot = createSnapshot(DEFAULT_OUTPUT_PROFILE_KEY);
  return normalizeOverlayDocumentProject({
    activeTargetId: customFormatId,
    targets: [
      createFormat(defaultFormatId, "Story 1080x1920", DEFAULT_OUTPUT_PROFILE_KEY),
      createFormat(customFormatId, "Landscape 1920x1080", customProfileKey, defaultFormatId)
    ]
  }, staleDefaultSnapshot);
}

function assertActiveCustomProjectSurvivesNormalization(): OverlayDocumentProject {
  const project = createStaleSnapshotProject();
  assert.equal(project.activeTargetId, customFormatId);
  assert.equal(
    project.targets.find((target) => target.id === customFormatId)?.outputProfileKey,
    customProfileKey
  );
  return project;
}

function assertDocumentRoundTripKeepsNameAndActiveFormat(project: OverlayDocumentProject): OverlayDocumentProject {
  const staleDefaultSnapshot = createSnapshot(DEFAULT_OUTPUT_PROFILE_KEY);
  const documentFile = createOverlayDocumentFile({
    name: "round-trip-fixture",
    project,
    state: staleDefaultSnapshot,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:01:00.000Z"
  });
  const persistedDocumentFile = normalizeOverlayDocumentFileForPersistence(documentFile);
  const sanitizedDocumentFile = sanitizeOverlayDocumentFile(persistedDocumentFile, {
    fallbackName: "Untitled document",
    fallbackSnapshot: staleDefaultSnapshot,
    createExportSettings: createDefaultExportSettings,
    createHaloConfig: (profileKey) => createHaloConfig(profileKey),
    normalizeGuideMode: () => "bounds"
  });

  assert.ok(sanitizedDocumentFile);
  assert.equal(sanitizedDocumentFile.metadata.name, "round-trip-fixture");
  assert.equal(sanitizedDocumentFile.project.activeTargetId, customFormatId);
  assert.equal(
    sanitizedDocumentFile.project.targets.find((target) => target.id === customFormatId)?.outputProfileKey,
    customProfileKey
  );

  return sanitizedDocumentFile.project;
}

function assertBridgeActivatesProjectFormat(project: OverlayDocumentProject): void {
  const staleDefaultSnapshot = createSnapshot(DEFAULT_OUTPUT_PROFILE_KEY);
  const state: OverlayPreviewDocumentBridgeState<TestHaloConfig, TestGuideMode> = {
    params: createDefaultOverlayParams(DEFAULT_OUTPUT_PROFILE_KEY, contentFormatKey),
    selected: null,
    guideMode: "bounds",
    overlayVisible: true,
    pendingCsvDraftsByBucket: {},
    outputProfileKey: DEFAULT_OUTPUT_PROFILE_KEY,
    contentFormatKey,
    documentFormatBuckets: {
      [defaultFormatId]: {
        [contentFormatKey]: createDefaultOverlayParams(DEFAULT_OUTPUT_PROFILE_KEY, contentFormatKey)
      }
    },
    contentFormatKeyByDocumentFormatId: {
      [defaultFormatId]: contentFormatKey
    },
    exportSettings: createDefaultExportSettings(DEFAULT_OUTPUT_PROFILE_KEY),
    exportSettingsByDocumentFormatId: {
      [defaultFormatId]: createDefaultExportSettings(DEFAULT_OUTPUT_PROFILE_KEY)
    },
    haloConfig: createHaloConfig(DEFAULT_OUTPUT_PROFILE_KEY),
    haloConfigByDocumentFormatId: {
      [defaultFormatId]: createHaloConfig(DEFAULT_OUTPUT_PROFILE_KEY)
    },
    sourceDefaults: staleDefaultSnapshot,
    sourceDefaultProject: project,
    documentProject: project
  };
  const adapter: OverlayPreviewDocumentBridgeAdapter<TestHaloConfig> = {
    persistActiveDocumentFormatBuckets() {},
    persistActiveExportSettings() {},
    persistActiveHaloConfig() {},
    getOrCreateDocumentFormatParams(formatId, formatKey) {
      const target = state.documentProject.targets.find((candidate) => candidate.id === formatId);
      const profileKey = target?.outputProfileKey ?? state.outputProfileKey;
      state.documentFormatBuckets[formatId] ??= {};
      state.documentFormatBuckets[formatId][formatKey] ??= createDefaultOverlayParams(profileKey, formatKey);
      return state.documentFormatBuckets[formatId][formatKey];
    },
    normalizeParams(params) {
      return params;
    },
    syncHaloConfigForActiveDocumentFormat() {}
  };

  applySourceDefaultSnapshotToState(state, staleDefaultSnapshot, adapter, project);

  assert.equal(state.outputProfileKey, customProfileKey);
  assert.equal(state.params.frame.widthPx, 1920);
  assert.equal(state.params.frame.heightPx, 1080);
}

const normalizedProject = assertActiveCustomProjectSurvivesNormalization();
const roundTrippedProject = assertDocumentRoundTripKeepsNameAndActiveFormat(normalizedProject);
assertBridgeActivatesProjectFormat(roundTrippedProject);

console.log("document persistence verification passed");