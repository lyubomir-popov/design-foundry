import {
  cloneOverlayDocumentProject,
  cloneOverlaySourceDefaultSnapshot,
  createOverlayDocumentProjectFromSnapshot,
  normalizeOverlayDocumentFileForPersistence,
  sanitizeOverlayDocumentFile,
  type OverlayDocumentProject,
  type OverlaySourceDefaultSnapshot
} from "@brand-layout-ops/document-model";
import type { HaloFieldConfig } from "@brand-layout-ops/operator-halo-field";
import {
  applySourceDefaultSnapshotToState,
  type OverlayPreviewDocumentBridgeAdapter
} from "./preview-document-bridge.js";
import type {
  GuideMode,
  OverlayPreviewDocument,
  PreviewState,
  SourceDefaultSnapshot,
  SourceDefaultWriteResult
} from "./preview-app-context.js";
import { UNTITLED_DOCUMENT_NAME } from "./preview-app-context.js";
import type { ExportSettings } from "./sample-document.js";

const SOURCE_DEFAULT_AUTHORING_ENDPOINT = "/__authoring/source-default-config";
const SOURCE_DEFAULT_ASSET_PATH = "/assets/source-default-config.json";

export interface SourceDefaultControllerOptions {
  state: PreviewState;
  initialSourceDefaults: SourceDefaultSnapshot;
  initialSourceDefaultProject: OverlayDocumentProject;
  previewDocumentBridge: OverlayPreviewDocumentBridgeAdapter<HaloFieldConfig>;
  createDefaultExportSettings: (profileKey: string) => ExportSettings;
  getHaloConfigForProfile: (profileKey: string) => HaloFieldConfig;
  normalizeGuideMode: (raw: unknown) => GuideMode;
  /** Flush pending CSV drafts to the dev server. Returns paths of saved CSVs. */
  flushPendingCsvDrafts: () => Promise<string[]>;
  /** Build the current document for serialization. */
  buildCurrentDocumentPayload: () => OverlayPreviewDocument;
  /** Rebuild all inspector accordion sections. */
  buildConfigEditor: () => void;
  /** Sync document project to the active output profile. */
  syncDocumentProjectToCurrentOutputProfile: () => void;
  /** Normalize the selected background node to a valid ID. */
  normalizeSelectedBackgroundNodeId: (preferredNodeId?: string | null) => string | null;
  /** Normalize the selected operator to a valid ID. */
  normalizeSelectedOperatorId: (preferredOperatorId?: string | null) => string;
  /** Normalize the current element selection. */
  normalizeSelection: () => void;
}

export interface SourceDefaultController {
  readSourceDefaultSnapshot(): Promise<{ snapshot: SourceDefaultSnapshot; project: OverlayDocumentProject }>;
  writeCurrentAsSourceDefault(): Promise<SourceDefaultWriteResult>;
  applySourceDefaultSnapshot(snapshot: SourceDefaultSnapshot, project?: OverlayDocumentProject): void;
  setSourceDefaultStatus(message: string, tone?: "neutral" | "success" | "error"): void;
}

export function createSourceDefaultController(opts: SourceDefaultControllerOptions): SourceDefaultController {
  const {
    state,
    initialSourceDefaults,
    initialSourceDefaultProject,
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
  } = opts;

  function getSourceDefaultStatusEl(): HTMLElement | null {
    return document.querySelector("[data-source-default-status]");
  }

  function setSourceDefaultStatus(message: string, tone: "neutral" | "success" | "error" = "neutral") {
    const statusEl = getSourceDefaultStatusEl();
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.style.color = tone === "success"
      ? "#0e8420"
      : tone === "error"
      ? "#c7162b"
      : "";
  }

  function sanitizeSourceDefaultSnapshot(
    rawSnapshot: unknown
  ): { snapshot: SourceDefaultSnapshot; project: OverlayDocumentProject } | null {
    const doc = sanitizeOverlayDocumentFile(rawSnapshot, {
      fallbackName: UNTITLED_DOCUMENT_NAME,
      fallbackSnapshot: initialSourceDefaults,
      createExportSettings: createDefaultExportSettings,
      createHaloConfig: getHaloConfigForProfile,
      normalizeGuideMode
    });

    if (!doc) {
      return null;
    }

    return {
      snapshot: cloneOverlaySourceDefaultSnapshot(doc.state),
      project: cloneOverlayDocumentProject(doc.project)
    };
  }

  function buildSourceDefaultWriteMessage(sourceDefaultPath: string, csvPaths: string[]): string {
    const csvSummary = csvPaths.length > 0
      ? ` Updated ${csvPaths.length} CSV file${csvPaths.length === 1 ? "" : "s"} first.`
      : "";
    return `Source default saved to ${sourceDefaultPath}.${csvSummary}`;
  }

  function applySourceDefaultSnapshot(
    snapshot: SourceDefaultSnapshot,
    project: OverlayDocumentProject = state.sourceDefaultProject
  ) {
    const normalizedProject = createOverlayDocumentProjectFromSnapshot(snapshot, project);
    state.sourceDefaultProject = cloneOverlayDocumentProject(normalizedProject);
    state.documentProject = cloneOverlayDocumentProject(normalizedProject);
    applySourceDefaultSnapshotToState(state, snapshot, previewDocumentBridge, state.documentProject);
    syncDocumentProjectToCurrentOutputProfile();
    normalizeSelectedBackgroundNodeId(state.documentProject.backgroundGraph.activeNodeId);
    normalizeSelectedOperatorId(state.selectedOperatorId);
    normalizeSelection();
  }

  async function readSourceDefaultSnapshot(): Promise<{ snapshot: SourceDefaultSnapshot; project: OverlayDocumentProject }> {
    try {
      const response = await fetch(`${SOURCE_DEFAULT_ASSET_PATH}?t=${Date.now()}`, {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const sourceDefaultDocument = sanitizeSourceDefaultSnapshot(await response.json());
      if (sourceDefaultDocument) {
        return sourceDefaultDocument;
      }
    } catch {
      // Fall back to the built-in snapshot when the authored file is absent or invalid.
    }

    return {
      snapshot: cloneOverlaySourceDefaultSnapshot(initialSourceDefaults),
      project: cloneOverlayDocumentProject(initialSourceDefaultProject)
    };
  }

  async function writeCurrentAsSourceDefault(): Promise<SourceDefaultWriteResult> {
    const csvPaths = await flushPendingCsvDrafts();
    if (csvPaths.length > 0) {
      buildConfigEditor();
    }

    const sourceDefaultDocument = buildCurrentDocumentPayload().document;
    const persistedSourceDefaultDocument = normalizeOverlayDocumentFileForPersistence(sourceDefaultDocument);
    const response = await fetch(SOURCE_DEFAULT_AUTHORING_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(persistedSourceDefaultDocument, null, 2)
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }

    state.sourceDefaults = cloneOverlaySourceDefaultSnapshot(sourceDefaultDocument.state);
    state.sourceDefaultProject = cloneOverlayDocumentProject(sourceDefaultDocument.project);

    const sourceDefaultPath = typeof payload?.path === "string" && payload.path.trim().length > 0
      ? payload.path.trim()
      : "public/assets/source-default-config.json";

    return {
      sourceDefaultPath,
      csvPaths,
      message: buildSourceDefaultWriteMessage(sourceDefaultPath, csvPaths)
    };
  }

  return {
    readSourceDefaultSnapshot,
    writeCurrentAsSourceDefault,
    applySourceDefaultSnapshot,
    setSourceDefaultStatus
  };
}
