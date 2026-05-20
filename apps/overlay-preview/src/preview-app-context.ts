/**
 * preview-app-context.ts — Typed context bag for the preview application.
 *
 * Defines the PreviewAppContext interface that section-builder panel modules
 * receive instead of capturing module-level closures from main.ts.
 * main.ts creates the concrete implementation and passes it to builders
 * through the section-definition factory wrappers.
 *
 * This is the state-sharing protocol that unblocks extracting section builders,
 * authoring controllers, and export controllers out of main.ts.
 */

import type {
  LogoPlacementSpec,
  TextFieldPlacementSpec,
  TextStyleSpec
} from "@brand-layout-ops/core-types";
import type {
  OverlayBackgroundNode,
  OverlayContentSource,
  OverlayDocumentProject,
  OverlayLayoutOperatorParams,
  OverlaySceneFamilyKey,
  OverlaySourceDefaultSnapshot
} from "@brand-layout-ops/operator-overlay-layout";
import type { HaloFieldConfig, HaloFieldPresetDefinition } from "@brand-layout-ops/operator-halo-field";
import type { ExportSettings } from "./sample-document.js";
import type { OverlayPreviewDocument as OverlayPreviewDocumentModel } from "./preview-document.js";
import type { DocumentWorkspaceController } from "./document-workspace.js";
import type { SceneFamilyPreviewMode } from "./scene-family-preview.js";

// ——— Constants shared between main.ts and extracted panel modules ———

export const UNTITLED_DOCUMENT_NAME = "Untitled document";
export const OVERLAY_LAYOUT_OPERATOR_SELECTION_ID = "operator-overlay-layout";

// ——— Types shared between main.ts and extracted panel modules ———

export type SelectedOperatorId = typeof OVERLAY_LAYOUT_OPERATOR_SELECTION_ID | string;

export type Selection =
  | { kind: "text"; id: string }
  | { kind: "logo"; id: string };

export type GuideMode = "off" | "composition" | "baseline";

export interface SwitchOutputProfileOptions {
  persistCurrentState?: boolean;
}

export type DocumentFormatBuckets = Record<string, Record<string, OverlayLayoutOperatorParams>>;
export type ContentFormatKeyByDocumentFormatId = Record<string, string>;

export type SourceDefaultSnapshot = OverlaySourceDefaultSnapshot<ExportSettings, HaloFieldConfig, GuideMode>;

export type OverlayPreviewDocument = OverlayPreviewDocumentModel<HaloFieldConfig, GuideMode>;

export interface SourceDefaultWriteResult {
  sourceDefaultPath: string;
  csvPaths: string[];
  message: string;
}

export interface PreviewState {
  params: OverlayLayoutOperatorParams;
  selected: Selection | null;
  guideMode: GuideMode;
  overlayVisible: boolean;
  networkOverlayVisible: boolean;
  pendingCsvDraftsByBucket: Record<string, string>;
  outputProfileKey: string;
  contentFormatKey: string;
  documentFormatBuckets: DocumentFormatBuckets;
  contentFormatKeyByDocumentFormatId: ContentFormatKeyByDocumentFormatId;
  exportSettings: ExportSettings;
  exportSettingsByDocumentFormatId: Record<string, ExportSettings>;
  haloConfig: HaloFieldConfig;
  haloConfigByDocumentFormatId: Record<string, HaloFieldConfig>;
  sourceDefaults: SourceDefaultSnapshot;
  sourceDefaultProject: OverlayDocumentProject;
  documentProject: OverlayDocumentProject;
  selectedBackgroundNodeId: string | null;
  selectedOperatorId: SelectedOperatorId;
  isPlaying: boolean;
  playbackTimeSec: number;
}

/**
 * Scene-family preview state snapshot, returned by getSceneFamilyPreviewState().
 */
export interface SceneFamilyPreviewSnapshot {
  sceneFamilyKey: string;
  pointField?: { points: unknown[] };
  simulationBackend?: string;
}

// ——— Context interface ———

/**
 * Typed context bag that extracted panel modules receive.
 * main.ts creates the concrete implementation and passes it via
 * section-definition factory wrappers.
 */
export interface PreviewAppContext {
  /** Mutable application state. Panel code reads and writes this directly. */
  readonly state: PreviewState;

  // — Render / UI rebuild cycle —

  /** Trigger a full async render (operator graph evaluation + SVG + authoring UI). */
  renderStage(mode?: SceneFamilyPreviewMode): Promise<void>;
  /** Rebuild all accordion sections from the section registry. */
  buildConfigEditor(): void;
  /** Sync the currently rendered overlay section inputs from current selected state. */
  syncSelectedOverlaySectionInputs(): void;
  /** Rebuild the document formats sub-panel. */
  buildFormatOptions(): void;
  /** Resize the Three.js renderer to match current frame dimensions. */
  resizeRenderer(): void;
  /** Sync overlay visibility checkbox and layer display. */
  syncOverlayVisibilityUi(): void;
  /** Sync play/pause button text. */
  updatePlaybackToggleUi(): void;
  /** Sync document panel (name, status, recent list). */
  updateDocumentUi(): void;

  // — State mutation actions —

  /** Mark the current document as modified (dirty). */
  markDocumentDirty(): void;
  /** Set the current selection and rebuild the editor + authoring UI. */
  select(sel: Selection | null): void;
  /** Toggle playback on/off. */
  togglePlayback(): void;
  /** Set playback state explicitly. */
  setPlaybackPlaying(isPlaying: boolean): void;
  /** Toggle overlay visibility. */
  setOverlayVisible(visible: boolean): void;
  /** Normalize text field offsets after grid/baseline changes. */
  normalizeParamsTextFieldOffsets(params: OverlayLayoutOperatorParams): OverlayLayoutOperatorParams;
  /** Update export settings via an updater function. */
  updateExportSettings(updater: (settings: ExportSettings) => ExportSettings): void;

  // — Text / overlay mutations —

  /** Update a text field by ID via an updater. */
  updateTextField(id: string, updater: (f: TextFieldPlacementSpec) => TextFieldPlacementSpec): void;
  /** Update the logo via an updater. */
  updateLogo(updater: (l: LogoPlacementSpec) => LogoPlacementSpec): void;
  /** Update logo size preserving aspect ratio. */
  updateLogoSizeWithAspectRatio(heightPx: number): void;
  /** Get the current logo intrinsic aspect ratio. */
  getCurrentLogoAspectRatio(): number;
  /** Load intrinsic dimensions for a logo asset path. */
  loadLogoIntrinsicDimensions(path: string): Promise<void>;
  /** Apply a text style to the selected text field by style key. */
  applySelectedTextStyle(styleKey: string): void;
  /** Update a text style by key via an updater. */
  updateTextStyle(key: string, updater: (s: TextStyleSpec) => TextStyleSpec): void;
  /** Sync logo dimensions to a title font size (linked sizing). */
  syncLogoToTitleFontSize(titleFontSizePx: number): void;
  /** Sync title font size to a logo height (linked sizing). */
  syncTitleToLogoHeight(logoHeightPx: number): void;
  /** Get the displayed offset baselines for a text field. */
  getDisplayedTextFieldOffsetBaselines(field: TextFieldPlacementSpec): number;
  /** Get the resolved text value for a text field. */
  getResolvedTextFieldText(field: TextFieldPlacementSpec): string;
  /** Update the inline text value for a text field by ID. */
  updateSelectedTextValue(id: string, value: string): void;
  /** Get the selected text field, or null if no text is selected. */
  getSelectedTextField(): TextFieldPlacementSpec | null;
  /** Get the title string for the current overlay-layer accordion section. */
  getSelectedOverlaySectionTitle(): string;
  /** Create the selection-aware overlay action row for the overlay section. */
  createOverlayItemActionRow(options?: {
    showAdd?: boolean;
    showDelete?: boolean;
  }): HTMLElement | null;

  // — Content format —

  /** Switch to a different content format key. */
  switchContentFormat(key: string): void;
  /** Stage a CSV draft for the current profile/format bucket. */
  setStagedCsvDraft(draft: string | null): void;
  /** Get the staged CSV draft for the current format, or null. */
  getStagedCsvDraft(): string | null;
  /** Whether the staged CSV draft differs from the applied draft. */
  hasStagedCsvDraft(): boolean;
  /** Apply the staged CSV draft to params. */
  applyStagedCsvDraft(): void;
  /** Discard the staged CSV draft. */
  discardStagedCsvDraft(): void;
  /** Get the content source for the current params ("inline" or "csv"). */
  getContentSource(): OverlayContentSource;
  /** Get effective params with any staged CSV draft applied. */
  getEffectiveParams(): OverlayLayoutOperatorParams;

  // — Profile / document actions —

  /** Switch to a different output profile. */
  switchOutputProfile(key: string, options?: SwitchOutputProfileOptions): void;

  // — Source defaults —

  /** Apply a source-default snapshot to state. */
  applySourceDefaultSnapshot(snapshot: SourceDefaultSnapshot): void;
  /** Write current state as the source default (HTTP POST to dev server). */
  writeCurrentAsSourceDefault(): Promise<SourceDefaultWriteResult>;
  /** Show a status message in the source-default area. */
  setSourceDefaultStatus(message: string, severity?: string): void;
  /** Get the current user-saved Halo preset definitions. */
  getUserHaloPresetDefinitions(): readonly HaloFieldPresetDefinition[];
  /** Save the current Halo settings as a reusable user preset. */
  saveCurrentHaloPreset(label: string, description?: string): Promise<{
    preset: HaloFieldPresetDefinition;
    message: string;
  }>;

  // — Scene family —

  /** Set which saved background node the inspector is currently editing. */
  setSelectedBackgroundNode(nodeId: string | null): boolean;
  /** Get the saved background node currently selected in the inspector. */
  getSelectedBackgroundNode(): OverlayBackgroundNode | null;
  /** Update the saved background node currently selected in the inspector. */
  updateSelectedBackgroundNode(updater: (node: OverlayBackgroundNode) => OverlayBackgroundNode): boolean;
  /** Rebuild the saved background graph from the current scene-family state. */
  syncDocumentBackgroundGraph(): void;
  /** Get the preview state snapshot for the current scene family. */
  getSceneFamilyPreviewState(mode?: SceneFamilyPreviewMode): SceneFamilyPreviewSnapshot | null;
  /** Get a human-readable label for a scene family key. */
  getSceneFamilyLabel(key: OverlaySceneFamilyKey): string;

  // — Document formats —

  /** Add a new document format. Returns true if successful. */
  addDocumentFormat(): boolean;
  /** Remove the active document format. Returns true if successful. */
  removeActiveDocumentFormat(): boolean;
  /** Set the active document format by ID. */
  setActiveDocumentFormat(id: string): void;
  /** Update the label of the active document format. */
  updateActiveDocumentFormatLabel(label: string): void;
  /** Update the output profile of the active document format. */
  updateActiveDocumentFormatProfile(profileKey: string): void;
  /** Get profile keys not yet used by any document format, optionally excluding one. */
  getUnusedDocumentFormatProfileKeys(exclude?: string): string[];
  /** Get the default label for a document format profile key. */
  getDefaultDocumentFormatLabel(profileKey: string): string;

  // — Document workspace —

  /** The document workspace controller for file I/O operations. */
  readonly documentWorkspace: DocumentWorkspaceController<OverlayPreviewDocument>;
  /** Normalize a document name for display. */
  getNormalizedDocumentName(name: string): string;

  // — Export —

  /** Export the current frame as a composed PNG. */
  exportComposedFramePng(): Promise<void>;
  /** Export the current frame as a full SVG document. */
  exportSvgDocument(): Promise<void>;
  /** Export a PNG sequence with a frame-range modal. */
  exportPngSequence(): Promise<void>;
  /** Export an MP4 through the dev-server authoring pipeline. */
  exportMp4(): Promise<void>;
}
