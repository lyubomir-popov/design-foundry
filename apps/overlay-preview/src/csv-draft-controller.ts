/**
 * csv-draft-controller.ts — CSV draft staging, committing, and flushing.
 *
 * Manages the per-bucket CSV draft staging workflow: edits are staged per
 * (documentFormatId, formatKey) bucket, committed across document-format buckets
 * on flush, and written to the dev-server authoring endpoint.
 */

import {
  DEFAULT_OVERLAY_FORMAT_OVERRIDES,
  normalizeOverlayParamsForEditing,
  type OverlayLayoutOperatorParams
} from "@brand-layout-ops/document-model";
import { cloneOverlayParams } from "./sample-document.js";
import { DEFAULT_CONTENT_FORMAT_KEY, type PreviewState } from "./preview-app-context.js";

// ——— Constants ———

const CSV_AUTHORING_ENDPOINT = "/__authoring/overlay-csv";

// ——— Dependency interface ———

export interface CsvDraftControllerDeps {
  readonly state: PreviewState;
  getDocumentFormatBucket(formatId: string): Record<string, OverlayLayoutOperatorParams>;
  getOrCreateDocumentFormatParams(formatId: string, formatKey: string): OverlayLayoutOperatorParams;
  markDocumentDirty(): void;
}

// ——— Controller ———

export interface CsvDraftController {
  getCsvDraftBucketKey(formatId?: string, formatKey?: string): string;
  getStagedCsvDraft(formatId?: string, formatKey?: string): string | null;
  setStagedCsvDraft(draft: string | null, formatId?: string, formatKey?: string): void;
  hasStagedCsvDraft(): boolean;
  commitCsvDraftToDocumentFormat(formatId: string, formatKey: string, draft: string): void;
  syncCsvDraftAcrossDocumentFormatBuckets(formatKey: string, draft: string): void;
  flushPendingCsvDrafts(): Promise<string[]>;
  applyStagedCsvDraft(): void;
  discardStagedCsvDraft(): void;
  getOverlayFormatCsvPath(formatKey: string): string | null;
}

export function createCsvDraftController(deps: CsvDraftControllerDeps): CsvDraftController {
  const { state } = deps;

  function normalizeParamsTextFieldOffsets(params: OverlayLayoutOperatorParams): OverlayLayoutOperatorParams {
    return normalizeOverlayParamsForEditing(params);
  }

  function getActiveDocumentFormatId(): string {
    return state.documentProject.activeTargetId;
  }

  function getCsvDraftBucketKey(
    formatId: string = getActiveDocumentFormatId(),
    formatKey: string = DEFAULT_CONTENT_FORMAT_KEY
  ): string {
    return `${formatId}::${formatKey}`;
  }

  function getStagedCsvDraft(
    formatId: string = getActiveDocumentFormatId(),
    formatKey: string = DEFAULT_CONTENT_FORMAT_KEY
  ): string | null {
    const bucketKey = getCsvDraftBucketKey(formatId, formatKey);
    return Object.prototype.hasOwnProperty.call(state.pendingCsvDraftsByBucket, bucketKey)
      ? state.pendingCsvDraftsByBucket[bucketKey]
      : null;
  }

  function setStagedCsvDraft(
    draft: string | null,
    formatId: string = getActiveDocumentFormatId(),
    formatKey: string = DEFAULT_CONTENT_FORMAT_KEY
  ): void {
    const bucketKey = getCsvDraftBucketKey(formatId, formatKey);
    if (draft === null) {
      delete state.pendingCsvDraftsByBucket[bucketKey];
      return;
    }
    state.pendingCsvDraftsByBucket[bucketKey] = draft;
  }

  function resolveDocumentFormatId(rawFormatIdOrProfileKey: string): string {
    if (state.documentProject.targets.some((target) => target.id === rawFormatIdOrProfileKey)) {
      return rawFormatIdOrProfileKey;
    }

    return state.documentProject.targets.find((target) => target.outputProfileKey === rawFormatIdOrProfileKey)?.id
      ?? rawFormatIdOrProfileKey;
  }

  function parseCsvDraftBucketKey(bucketKey: string): { formatId: string; formatKey: string } | null {
    const separatorIndex = bucketKey.indexOf("::");
    if (separatorIndex <= 0 || separatorIndex >= bucketKey.length - 2) {
      return null;
    }
    return {
      formatId: resolveDocumentFormatId(bucketKey.slice(0, separatorIndex)),
      formatKey: bucketKey.slice(separatorIndex + 2)
    };
  }

  function normalizeCsvDraftForWrite(draft: string): string {
    return String(draft || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }

  function getOverlayFormatCsvPath(formatKey: string): string | null {
    const csvPath = DEFAULT_OVERLAY_FORMAT_OVERRIDES[formatKey]?.csvPath?.trim();
    return csvPath && csvPath.length > 0 ? csvPath : null;
  }

  function getDocumentFormatIdsForCsvFormat(formatKey: string): string[] {
    const formatIds = new Set<string>([
      getActiveDocumentFormatId(),
      ...state.documentProject.targets.map((target) => target.id),
      ...Object.keys(state.documentFormatBuckets)
    ]);
    return Array.from(formatIds).filter((formatId) => {
      const documentFormatBucket = state.documentFormatBuckets[formatId];
      return Boolean(documentFormatBucket?.[formatKey])
        || (formatId === getActiveDocumentFormatId() && DEFAULT_CONTENT_FORMAT_KEY === formatKey);
    });
  }

  function commitCsvDraftToDocumentFormat(formatId: string, formatKey: string, draft: string): void {
    const isActiveBucket = formatId === getActiveDocumentFormatId() && formatKey === DEFAULT_CONTENT_FORMAT_KEY;
    const baseParams = isActiveBucket
      ? state.params
      : deps.getOrCreateDocumentFormatParams(formatId, formatKey);
    const nextParams = normalizeParamsTextFieldOffsets({
      ...cloneOverlayParams(baseParams),
      csvContent: {
        draft,
        rowIndex: baseParams.csvContent?.rowIndex ?? 1
      }
    });
    deps.getDocumentFormatBucket(formatId)[formatKey] = cloneOverlayParams(nextParams);
    if (isActiveBucket) {
      state.params = nextParams;
    }
  }

  function syncCsvDraftAcrossDocumentFormatBuckets(formatKey: string, draft: string): void {
    for (const formatId of getDocumentFormatIdsForCsvFormat(formatKey)) {
      commitCsvDraftToDocumentFormat(formatId, formatKey, draft);
    }
  }

  function hasStagedCsvDraft(): boolean {
    const stagedCsvDraft = getStagedCsvDraft();
    return stagedCsvDraft !== null &&
      stagedCsvDraft !== (state.params.csvContent?.draft ?? "");
  }

  async function flushPendingCsvDrafts(): Promise<string[]> {
    const pendingEntries = Object.entries(state.pendingCsvDraftsByBucket);
    if (pendingEntries.length === 0) {
      return [];
    }

    const batchesByPath = new Map<string, {
      csvPath: string;
      draft: string;
      bucketInfos: Array<{ bucketKey: string; formatId: string; formatKey: string }>;
    }>();

    for (const [bucketKey, rawDraft] of pendingEntries) {
      const bucketInfo = parseCsvDraftBucketKey(bucketKey);
      if (!bucketInfo) {
        throw new Error(`Invalid staged CSV bucket key: ${bucketKey}.`);
      }

      const csvPath = getOverlayFormatCsvPath(bucketInfo.formatKey);
      if (!csvPath) {
        throw new Error(`No CSV path is configured for ${bucketInfo.formatKey}.`);
      }

      const draft = normalizeCsvDraftForWrite(rawDraft);
      const existingBatch = batchesByPath.get(csvPath);
      if (existingBatch && existingBatch.draft !== draft) {
        const conflictingBuckets = Array.from(new Set([
          ...existingBatch.bucketInfos.map((info) => `${state.documentProject.targets.find((target) => target.id === info.formatId)?.label ?? info.formatId} / ${info.formatKey}`),
          `${state.documentProject.targets.find((target) => target.id === bucketInfo.formatId)?.label ?? bucketInfo.formatId} / ${bucketInfo.formatKey}`
        ]));
        throw new Error(
          `Conflicting staged CSV drafts target ${csvPath}. Resolve ${conflictingBuckets.join(", ")} before writing source defaults.`
        );
      }

      const batch = existingBatch ?? {
        csvPath,
        draft,
        bucketInfos: []
      };
      batch.bucketInfos.push({ bucketKey, ...bucketInfo });
      batchesByPath.set(csvPath, batch);
    }

    const savedPaths: string[] = [];

    for (const batch of batchesByPath.values()) {
      const response = await fetch(CSV_AUTHORING_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetPath: batch.csvPath,
          draft: batch.draft
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || `CSV writeback failed with HTTP ${response.status}.`);
      }

      const formatKeys = new Set(batch.bucketInfos.map((info) => info.formatKey));
      for (const formatKey of formatKeys) {
        syncCsvDraftAcrossDocumentFormatBuckets(formatKey, batch.draft);
      }
      for (const info of batch.bucketInfos) {
        setStagedCsvDraft(null, info.formatId, info.formatKey);
      }

      savedPaths.push(String(payload?.path || batch.csvPath));
    }

    return Array.from(new Set(savedPaths));
  }

  function applyStagedCsvDraft(): void {
    const stagedCsvDraft = getStagedCsvDraft();
    if (stagedCsvDraft === null) return;
    state.params = {
      ...state.params,
      csvContent: {
        draft: stagedCsvDraft,
        rowIndex: state.params.csvContent?.rowIndex ?? 1
      }
    };
    setStagedCsvDraft(null);
    deps.markDocumentDirty();
  }

  function discardStagedCsvDraft(): void {
    setStagedCsvDraft(null);
    deps.markDocumentDirty();
  }

  return {
    getCsvDraftBucketKey,
    getStagedCsvDraft,
    setStagedCsvDraft,
    hasStagedCsvDraft,
    commitCsvDraftToDocumentFormat,
    syncCsvDraftAcrossDocumentFormatBuckets,
    flushPendingCsvDrafts,
    applyStagedCsvDraft,
    discardStagedCsvDraft,
    getOverlayFormatCsvPath
  };
}
