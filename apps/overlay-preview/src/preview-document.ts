import {
  DEFAULT_OUTPUT_PROFILE_KEY,
  OVERLAY_CONTENT_FORMAT_ORDER
} from "@design-foundry/core-types";
import {
  createDefaultOverlayParams,
  createOverlayDocumentFile,
  normalizeOverlayDocumentFileForPersistence,
  sanitizeOverlayDocumentFile,
  type OverlayDocumentFile,
  type OverlayDocumentProject,
  type OverlayLayoutOperatorParams,
  type OverlaySourceDefaultSnapshot,
  type ProfileContentFormatMap,
  type ProfileFormatBuckets,
  type SanitizeOverlayDocumentFileOptions
} from "@design-foundry/operator-overlay-layout";

import {
  createDefaultExportSettings,
  type ExportSettings
} from "./sample-document.js";

export interface OverlayPreviewDocument<THaloConfig extends object, TGuideMode extends string = string> {
  document: OverlayDocumentFile<ExportSettings, THaloConfig, TGuideMode>;
  pendingCsvDraftsByBucket: Record<string, string>;
}

export interface PersistedOverlayPreviewDocument {
  kind: string;
  version: number;
  metadata?: unknown;
  project?: unknown;
  state?: unknown;
  pendingCsvDraftsByBucket?: unknown;
}

export interface CreateOverlayPreviewDocumentOptions<THaloConfig extends object, TGuideMode extends string = string> {
  name: string;
  createdAt?: string;
  updatedAt?: string;
  project?: OverlayDocumentProject;
  state: OverlaySourceDefaultSnapshot<ExportSettings, THaloConfig, TGuideMode>;
  pendingCsvDraftsByBucket: Record<string, string>;
}

const LEGACY_OVERLAY_PREVIEW_DOCUMENT_KIND = "design-foundry-document";
const LEGACY_OVERLAY_PREVIEW_DOCUMENT_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function mergeWithDefaults<T>(defaults: T, partial: unknown): T {
  if (typeof partial === "undefined") {
    return cloneJson(defaults);
  }

  if (Array.isArray(partial)) {
    return cloneJson(partial) as T;
  }

  if (isRecord(partial)) {
    const base = isRecord(defaults) ? cloneJson(defaults) as Record<string, unknown> : {};
    for (const [key, childValue] of Object.entries(partial)) {
      const childDefault = isRecord(defaults) ? (defaults as Record<string, unknown>)[key] : undefined;
      base[key] = mergeWithDefaults(childDefault, childValue);
    }
    return base as T;
  }

  return cloneJson(partial) as T;
}

function denormalizeOverlayParams(
  partialParams: unknown,
  profileKey: string,
  formatKey: string
): OverlayLayoutOperatorParams {
  const defaults = createDefaultOverlayParams(profileKey, formatKey);
  return mergeWithDefaults(defaults, partialParams);
}

function denormalizeProfileFormatBucketsFromPersistence(rawProfileFormatBuckets: unknown): ProfileFormatBuckets {
  const buckets: ProfileFormatBuckets = {};
  if (!isRecord(rawProfileFormatBuckets)) {
    return buckets;
  }

  for (const [profileKey, rawFormatBuckets] of Object.entries(rawProfileFormatBuckets)) {
    if (!isRecord(rawFormatBuckets)) {
      continue;
    }

    const nextFormatBuckets: Record<string, OverlayLayoutOperatorParams> = {};
    for (const [formatKey, rawParams] of Object.entries(rawFormatBuckets)) {
      nextFormatBuckets[formatKey] = denormalizeOverlayParams(rawParams, profileKey, formatKey);
    }

    buckets[profileKey] = nextFormatBuckets;
  }

  return buckets;
}

export function createOverlayPreviewDocument<THaloConfig extends object, TGuideMode extends string = string>(
  options: CreateOverlayPreviewDocumentOptions<THaloConfig, TGuideMode>
): OverlayPreviewDocument<THaloConfig, TGuideMode> {
  const documentOptions = {
    name: options.name,
    ...(options.project ? { project: options.project } : {}),
    state: options.state,
    ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    ...(options.updatedAt ? { updatedAt: options.updatedAt } : {})
  };

  return {
    document: createOverlayDocumentFile(documentOptions),
    pendingCsvDraftsByBucket: cloneJson(options.pendingCsvDraftsByBucket)
  };
}

export function normalizeOverlayPreviewDocumentForPersistence<THaloConfig extends object, TGuideMode extends string = string>(
  document: OverlayPreviewDocument<THaloConfig, TGuideMode>
): PersistedOverlayPreviewDocument {
  return {
    ...normalizeOverlayDocumentFileForPersistence(document.document),
    pendingCsvDraftsByBucket: cloneJson(document.pendingCsvDraftsByBucket)
  };
}

function sanitizePendingCsvDraftsByBucket(rawValue: unknown): Record<string, string> {
  const pendingCsvDraftsByBucket: Record<string, string> = {};
  if (!isRecord(rawValue)) {
    return pendingCsvDraftsByBucket;
  }

  for (const [bucketKey, rawDraft] of Object.entries(rawValue)) {
    if (typeof rawDraft === "string") {
      pendingCsvDraftsByBucket[bucketKey] = rawDraft;
    }
  }

  return pendingCsvDraftsByBucket;
}

function sanitizeLegacyOverlayPreviewDocument<THaloConfig extends object, TGuideMode extends string = string>(
  rawDocument: Record<string, unknown>,
  options: SanitizeOverlayDocumentFileOptions<ExportSettings, THaloConfig, TGuideMode>
): OverlayPreviewDocument<THaloConfig, TGuideMode> | null {
  if (
    rawDocument.kind !== LEGACY_OVERLAY_PREVIEW_DOCUMENT_KIND ||
    rawDocument.version !== LEGACY_OVERLAY_PREVIEW_DOCUMENT_VERSION ||
    !isRecord(rawDocument.snapshot)
  ) {
    return null;
  }

  const rawSnapshot = rawDocument.snapshot;
  const outputProfileKey = typeof rawSnapshot.outputProfileKey === "string"
    ? rawSnapshot.outputProfileKey
    : DEFAULT_OUTPUT_PROFILE_KEY;
  const contentFormatKey = typeof rawSnapshot.contentFormatKey === "string"
    ? rawSnapshot.contentFormatKey
    : OVERLAY_CONTENT_FORMAT_ORDER[0];
  const profileFormatBuckets = denormalizeProfileFormatBucketsFromPersistence(rawSnapshot.profileFormatBuckets);

  if (!profileFormatBuckets[outputProfileKey]) {
    profileFormatBuckets[outputProfileKey] = {};
  }
  if (!profileFormatBuckets[outputProfileKey][contentFormatKey]) {
    profileFormatBuckets[outputProfileKey][contentFormatKey] = createDefaultOverlayParams(outputProfileKey, contentFormatKey);
  }

  const contentFormatKeyByProfile: ProfileContentFormatMap = {};
  if (isRecord(rawSnapshot.contentFormatKeyByProfile)) {
    for (const [profileKey, rawFormatKey] of Object.entries(rawSnapshot.contentFormatKeyByProfile)) {
      if (typeof rawFormatKey === "string") {
        contentFormatKeyByProfile[profileKey] = rawFormatKey;
      }
    }
  }
  contentFormatKeyByProfile[outputProfileKey] ??= contentFormatKey;

  const document = sanitizeOverlayDocumentFile({
    kind: "df.document",
    version: 1,
    metadata: {
      name: typeof rawDocument.name === "string" && rawDocument.name.trim().length > 0
        ? rawDocument.name
        : options.fallbackName ?? "Untitled document"
    },
    state: {
      outputProfileKey,
      contentFormatKey,
      profileFormatBuckets,
      contentFormatKeyByProfile,
      exportSettingsByProfile: isRecord(rawSnapshot.exportSettingsByProfile)
        ? cloneJson(rawSnapshot.exportSettingsByProfile)
        : {
          [outputProfileKey]: createDefaultExportSettings(outputProfileKey)
        },
      haloConfigByProfile: isRecord(rawSnapshot.haloConfigByProfile)
        ? cloneJson(rawSnapshot.haloConfigByProfile)
        : {}
    }
  }, options);

  if (!document) {
    return null;
  }

  return {
    document,
    pendingCsvDraftsByBucket: sanitizePendingCsvDraftsByBucket(rawSnapshot.pendingCsvDraftsByBucket)
  };
}

export function denormalizeOverlayPreviewDocumentFromPersistence<THaloConfig extends object, TGuideMode extends string = string>(
  rawDocument: unknown,
  options: SanitizeOverlayDocumentFileOptions<ExportSettings, THaloConfig, TGuideMode>
): OverlayPreviewDocument<THaloConfig, TGuideMode> | null {
  if (!isRecord(rawDocument)) {
    return null;
  }

  const document = sanitizeOverlayDocumentFile(rawDocument, options);
  if (document) {
    return {
      document,
      pendingCsvDraftsByBucket: sanitizePendingCsvDraftsByBucket(rawDocument.pendingCsvDraftsByBucket)
    };
  }

  return sanitizeLegacyOverlayPreviewDocument(rawDocument, options);
}