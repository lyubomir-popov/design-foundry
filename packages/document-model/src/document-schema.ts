import {
  DEFAULT_OUTPUT_PROFILE_KEY,
  getOutputProfile,
  OUTPUT_PROFILE_ORDER,
  OVERLAY_CONTENT_FORMATS,
  OVERLAY_CONTENT_FORMAT_ORDER,
  type OverlayContentFormatSpec,
  type FrameSize,
  type TextFieldPlacementSpec,
  type TextStyleSpec
} from "@design-foundry/core-types";
import {
  cloneOverlayBackgroundGraph,
  createDefaultOverlayBackgroundGraph,
  createDefaultOverlaySceneFamilyConfigs,
  createDefaultOverlaySceneFamilyGraphs,
  DEFAULT_OVERLAY_SCENE_FAMILY_KEY,
  extractOverlaySceneFamilyConfigsFromGraph,
  normalizeOverlayBackgroundGraph,
  normalizeOverlaySceneFamilyGraphs,
  normalizeOverlaySceneFamilyConfigs,
  normalizeOverlaySceneFamilyKey,
  type OverlayBackgroundGraph,
  type OverlaySceneFamilyGraphs,
  type OverlaySceneFamilyKey
} from "./background-graph.js";
import {
  applyOverlayProfileTextStyleDefaults,
  DEFAULT_OVERLAY_CSV_DRAFT,
  DEFAULT_OVERLAY_FORMAT_OVERRIDES,
  DEFAULT_OVERLAY_LOGO,
  DEFAULT_OVERLAY_TEXT_STYLES,
  resolveOverlayContentFormatKeyForProfile,
  SPEAKER_OVERLAY_CSV_DRAFT,
  type ContentFormatOverrides
} from "./field-defaults.js";
import {
  getOverlayFormatPresetKeyForProfile,
  getOverlayFormatSeedForProfile
} from "./format-presets.js";
import {
  cloneOverlayJson,
  isRecord,
  normalizeOverlayDocumentName,
  normalizeOverlayDocumentString,
  normalizeOverlayDocumentTimestamp
} from "./overlay-internals.js";
import type {
  OverlayContentSource,
  OverlayCsvContent,
  OverlayLayoutOperatorParams,
  ProfileContentFormatMap,
  ProfileFormatBuckets
} from "./index.js";

// ---------- Document types ----------

export interface OverlayProfileBucketState {
  outputProfileKey: string;
  contentFormatKey: string;
  profileFormatBuckets: ProfileFormatBuckets;
  contentFormatKeyByProfile: ProfileContentFormatMap;
}

export interface OverlaySourceDefaultSnapshot<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
> {
  outputProfileKey: string;
  contentFormatKey: string;
  profileFormatBuckets: ProfileFormatBuckets;
  contentFormatKeyByProfile: ProfileContentFormatMap;
  exportSettings: TExportSettings;
  exportSettingsByProfile: Record<string, TExportSettings>;
  haloConfig: THaloConfig;
  haloConfigByProfile: Record<string, THaloConfig>;
  guideMode: TGuideMode;
}

export const OVERLAY_DOCUMENT_FILE_KIND = "df.document";
export const OVERLAY_DOCUMENT_FILE_VERSION = 1;

export interface OverlayDocumentMetadata {
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface OverlayDocumentFormat {
  id: string;
  label: string;
  outputProfileKey: string;
  formatPresetKey: string | null;
  derivedFromFormatId: string | null;
}

export type OverlayDocumentTarget = OverlayDocumentFormat;

export interface OverlayDocumentProject {
  sceneFamilyKey: OverlaySceneFamilyKey;
  // Compatibility: the persisted key stays `activeTargetId` until the saved-file schema evolves.
  activeTargetId: string;
  // Compatibility: authored format rows still persist under `project.targets` for now.
  targets: OverlayDocumentFormat[];
  sceneFamilyGraphs: OverlaySceneFamilyGraphs;
  backgroundGraph: OverlayBackgroundGraph;
}

export interface PersistedOverlayDocumentProject {
  sceneFamilyKey: OverlaySceneFamilyKey;
  activeTargetId: string;
  targets: OverlayDocumentFormat[];
  sceneFamilyGraphs: OverlaySceneFamilyGraphs;
}

export interface OverlayDocumentFile<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
> {
  kind: typeof OVERLAY_DOCUMENT_FILE_KIND;
  version: typeof OVERLAY_DOCUMENT_FILE_VERSION;
  metadata: OverlayDocumentMetadata;
  project: OverlayDocumentProject;
  state: OverlaySourceDefaultSnapshot<TExportSettings, THaloConfig, TGuideMode>;
}

export interface PersistedOverlayDocumentFile<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
> {
  kind: typeof OVERLAY_DOCUMENT_FILE_KIND;
  version: typeof OVERLAY_DOCUMENT_FILE_VERSION;
  metadata: OverlayDocumentMetadata;
  project: PersistedOverlayDocumentProject;
  state: OverlaySourceDefaultSnapshot<TExportSettings, THaloConfig, TGuideMode>;
}

export interface CreateOverlaySourceDefaultSnapshotOptions<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
> {
  outputProfileKey: string;
  contentFormatKey: string;
  guideMode: TGuideMode;
  createExportSettings: (profileKey: string) => TExportSettings;
  createHaloConfig: (profileKey: string) => THaloConfig;
}

export interface CreateOverlayDocumentFileOptions<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
> {
  name: string;
  project?: OverlayDocumentProject;
  state: OverlaySourceDefaultSnapshot<TExportSettings, THaloConfig, TGuideMode>;
  createdAt?: string;
  updatedAt?: string;
}

export interface SanitizeOverlaySourceDefaultSnapshotOptions<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
> {
  fallbackSnapshot: OverlaySourceDefaultSnapshot<TExportSettings, THaloConfig, TGuideMode>;
  createExportSettings: (profileKey: string) => TExportSettings;
  createHaloConfig: (profileKey: string, rawHaloConfig?: unknown) => THaloConfig;
  normalizeGuideMode: (rawGuideMode: unknown) => TGuideMode;
}

export interface SanitizeOverlayDocumentFileOptions<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
> extends SanitizeOverlaySourceDefaultSnapshotOptions<TExportSettings, THaloConfig, TGuideMode> {
  fallbackName?: string;
  now?: string;
}

// ---------- Private helpers ----------

function getOverlayDocumentTargetLabel(outputProfileKey: string): string {
  return getOutputProfile(outputProfileKey).label;
}

function getOverlayDocumentTargetId(outputProfileKey: string): string {
  return outputProfileKey;
}

function getOrderedOverlayDocumentProfileKeys(profileKeys: Iterable<string>): string[] {
  const uniqueProfileKeys = new Set<string>();
  for (const profileKey of profileKeys) {
    const normalizedProfileKey = normalizeOverlayDocumentString(profileKey, "");
    if (normalizedProfileKey.length > 0) {
      uniqueProfileKeys.add(normalizedProfileKey);
    }
  }

  if (uniqueProfileKeys.size === 0) {
    return [DEFAULT_OUTPUT_PROFILE_KEY];
  }

  const knownProfileKeys = OUTPUT_PROFILE_ORDER.filter((profileKey) => uniqueProfileKeys.has(profileKey));
  const extraProfileKeys = [...uniqueProfileKeys]
    .filter((profileKey) => !OUTPUT_PROFILE_ORDER.includes(profileKey))
    .sort((left, right) => left.localeCompare(right));

  return [...knownProfileKeys, ...extraProfileKeys];
}

function getOverlayDocumentProfileKeysFromSnapshot<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
>(
  snapshot: OverlaySourceDefaultSnapshot<TExportSettings, THaloConfig, TGuideMode>
): string[] {
  return getOrderedOverlayDocumentProfileKeys([
    snapshot.outputProfileKey,
    ...Object.keys(snapshot.profileFormatBuckets),
    ...Object.keys(snapshot.contentFormatKeyByProfile),
    ...Object.keys(snapshot.exportSettingsByProfile),
    ...Object.keys(snapshot.haloConfigByProfile)
  ]);
}

function createOverlayDocumentTarget(outputProfileKey: string, rawTarget?: unknown): OverlayDocumentFormat {
  return {
    id: normalizeOverlayDocumentString(
      isRecord(rawTarget) ? rawTarget.id : undefined,
      getOverlayDocumentTargetId(outputProfileKey)
    ),
    label: normalizeOverlayDocumentString(
      isRecord(rawTarget) ? rawTarget.label : undefined,
      getOverlayDocumentTargetLabel(outputProfileKey)
    ),
    outputProfileKey,
    formatPresetKey: normalizeOverlayDocumentString(
      isRecord(rawTarget) ? rawTarget.formatPresetKey : undefined,
      getOverlayFormatPresetKeyForProfile(outputProfileKey) ?? ""
    ) || null,
    derivedFromFormatId: normalizeOverlayDocumentString(
      isRecord(rawTarget) ? rawTarget.derivedFromFormatId : undefined,
      ""
    ) || null
  };
}

// ---------- Document project ----------

export function cloneOverlayDocumentProject(project: OverlayDocumentProject): OverlayDocumentProject {
  return cloneOverlayJson(project);
}

export function normalizeOverlayDocumentProjectForPersistence(
  project: OverlayDocumentProject
): PersistedOverlayDocumentProject {
  const { backgroundGraph: _backgroundGraph, ...persistedProject } = cloneOverlayDocumentProject(project);
  return persistedProject;
}

export function normalizeOverlayDocumentProject<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
>(
  rawProject: unknown,
  snapshot: OverlaySourceDefaultSnapshot<TExportSettings, THaloConfig, TGuideMode>
): OverlayDocumentProject {
  const fallbackTargets = getOverlayDocumentProfileKeysFromSnapshot(snapshot).map((profileKey) => (
    createOverlayDocumentTarget(profileKey)
  ));

  if (!isRecord(rawProject)) {
    const activeTargetId = fallbackTargets.find((target) => target.outputProfileKey === snapshot.outputProfileKey)?.id
      ?? fallbackTargets[0]?.id
      ?? getOverlayDocumentTargetId(snapshot.outputProfileKey);
    const sceneFamilyGraphs = createDefaultOverlaySceneFamilyGraphs(
      createDefaultOverlaySceneFamilyConfigs(snapshot.outputProfileKey),
      snapshot.outputProfileKey
    );

    return {
      sceneFamilyKey: DEFAULT_OVERLAY_SCENE_FAMILY_KEY,
      activeTargetId,
      targets: fallbackTargets,
      sceneFamilyGraphs,
      backgroundGraph: cloneOverlayBackgroundGraph(sceneFamilyGraphs[DEFAULT_OVERLAY_SCENE_FAMILY_KEY]!)
    };
  }

  const targets: OverlayDocumentFormat[] = [];
  const seenProfileKeys = new Set<string>();
  const seenTargetIds = new Set<string>();

  if (Array.isArray(rawProject.targets)) {
    for (const rawTarget of rawProject.targets) {
      if (!isRecord(rawTarget)) {
        continue;
      }

      const outputProfileKey = normalizeOverlayDocumentString(rawTarget.outputProfileKey, snapshot.outputProfileKey);
      if (seenProfileKeys.has(outputProfileKey)) {
        continue;
      }

      let target = createOverlayDocumentTarget(outputProfileKey, rawTarget);
      if (seenTargetIds.has(target.id)) {
        target = {
          ...target,
          id: `${target.id}-${targets.length + 1}`
        };
      }

      targets.push(target);
      seenProfileKeys.add(outputProfileKey);
      seenTargetIds.add(target.id);
    }
  }

  for (const fallbackTarget of fallbackTargets) {
    if (seenProfileKeys.has(fallbackTarget.outputProfileKey)) {
      continue;
    }

    let nextId = fallbackTarget.id;
    let suffix = 2;
    while (seenTargetIds.has(nextId)) {
      nextId = `${fallbackTarget.id}-${suffix}`;
      suffix += 1;
    }

    targets.push({
      ...fallbackTarget,
      id: nextId
    });
    seenProfileKeys.add(fallbackTarget.outputProfileKey);
    seenTargetIds.add(nextId);
  }

  const snapshotTargetId = targets.find((target) => target.outputProfileKey === snapshot.outputProfileKey)?.id
    ?? targets[0]?.id
    ?? getOverlayDocumentTargetId(snapshot.outputProfileKey);
  const activeTargetId = typeof rawProject.activeTargetId === "string" && targets.some((target) => (
    target.id === rawProject.activeTargetId
  ))
    ? rawProject.activeTargetId
    : snapshotTargetId;
  const sceneFamilyKey = normalizeOverlaySceneFamilyKey(rawProject.sceneFamilyKey);
  const legacySceneFamilyConfigs = normalizeOverlaySceneFamilyConfigs(rawProject.sceneFamilyConfigs, snapshot.outputProfileKey);
  let sceneFamilyGraphs = normalizeOverlaySceneFamilyGraphs(
    rawProject.sceneFamilyGraphs,
    snapshot.outputProfileKey,
    rawProject.sceneFamilyConfigs,
    sceneFamilyKey
  );
  const activeFamilyGraph = sceneFamilyGraphs[sceneFamilyKey]!;
  const hasRawBackgroundGraph = Object.prototype.hasOwnProperty.call(rawProject, "backgroundGraph")
    && typeof rawProject.backgroundGraph !== "undefined";
  const backgroundGraph = hasRawBackgroundGraph
    ? normalizeOverlayBackgroundGraph(
      rawProject.backgroundGraph,
      sceneFamilyKey,
      extractOverlaySceneFamilyConfigsFromGraph(activeFamilyGraph, legacySceneFamilyConfigs)
    )
    : cloneOverlayBackgroundGraph(activeFamilyGraph);
  sceneFamilyGraphs = {
    ...sceneFamilyGraphs,
    [sceneFamilyKey]: cloneOverlayBackgroundGraph(backgroundGraph)
  };

  return {
    sceneFamilyKey,
    activeTargetId,
    targets,
    sceneFamilyGraphs,
    backgroundGraph
  };
}

export function createOverlayDocumentProjectFromSnapshot<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
>(
  snapshot: OverlaySourceDefaultSnapshot<TExportSettings, THaloConfig, TGuideMode>,
  projectOverrides?: Partial<OverlayDocumentProject>
): OverlayDocumentProject {
  return normalizeOverlayDocumentProject(projectOverrides, snapshot);
}

// ---------- Clone helpers ----------

export function cloneProfileFormatBuckets(buckets: ProfileFormatBuckets): ProfileFormatBuckets {
  return cloneOverlayJson(buckets);
}

export function cloneProfileContentFormatMap(contentFormatKeyByProfile: ProfileContentFormatMap): ProfileContentFormatMap {
  return cloneOverlayJson(contentFormatKeyByProfile);
}

export function cloneOverlaySourceDefaultSnapshot<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
>(
  snapshot: OverlaySourceDefaultSnapshot<TExportSettings, THaloConfig, TGuideMode>
): OverlaySourceDefaultSnapshot<TExportSettings, THaloConfig, TGuideMode> {
  return cloneOverlayJson(snapshot);
}

export function cloneOverlayDocumentFile<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
>(
  documentFile: OverlayDocumentFile<TExportSettings, THaloConfig, TGuideMode>
): OverlayDocumentFile<TExportSettings, THaloConfig, TGuideMode> {
  return cloneOverlayJson(documentFile);
}

export function normalizeOverlayDocumentFileForPersistence<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
>(
  documentFile: OverlayDocumentFile<TExportSettings, THaloConfig, TGuideMode>
): PersistedOverlayDocumentFile<TExportSettings, THaloConfig, TGuideMode> {
  return {
    kind: documentFile.kind,
    version: documentFile.version,
    metadata: cloneOverlayJson(documentFile.metadata),
    project: normalizeOverlayDocumentProjectForPersistence(documentFile.project),
    state: cloneOverlaySourceDefaultSnapshot(documentFile.state)
  };
}

// ---------- Create ----------

export function createBuiltInOverlaySourceDefaultSnapshot<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
>(
  options: CreateOverlaySourceDefaultSnapshotOptions<TExportSettings, THaloConfig, TGuideMode>
): OverlaySourceDefaultSnapshot<TExportSettings, THaloConfig, TGuideMode> {
  const exportSettings = options.createExportSettings(options.outputProfileKey);
  const haloConfig = options.createHaloConfig(options.outputProfileKey);

  return {
    outputProfileKey: options.outputProfileKey,
    contentFormatKey: options.contentFormatKey,
    profileFormatBuckets: {
      [options.outputProfileKey]: {
        [options.contentFormatKey]: createDefaultOverlayParams(options.outputProfileKey, options.contentFormatKey)
      }
    },
    contentFormatKeyByProfile: {
      [options.outputProfileKey]: options.contentFormatKey
    },
    exportSettings,
    exportSettingsByProfile: {
      [options.outputProfileKey]: cloneOverlayJson(exportSettings)
    },
    haloConfig,
    haloConfigByProfile: {
      [options.outputProfileKey]: cloneOverlayJson(haloConfig)
    },
    guideMode: options.guideMode
  };
}

export function createOverlayDocumentFile<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
>(
  options: CreateOverlayDocumentFileOptions<TExportSettings, THaloConfig, TGuideMode>
): OverlayDocumentFile<TExportSettings, THaloConfig, TGuideMode> {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const updatedAt = options.updatedAt ?? createdAt;

  return {
    kind: OVERLAY_DOCUMENT_FILE_KIND,
    version: OVERLAY_DOCUMENT_FILE_VERSION,
    metadata: {
      name: options.name,
      createdAt,
      updatedAt
    },
    project: normalizeOverlayDocumentProject(options.project, options.state),
    state: cloneOverlaySourceDefaultSnapshot(options.state)
  };
}

// ---------- Sanitize ----------

export function sanitizeOverlaySourceDefaultSnapshot<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
>(
  rawSnapshot: unknown,
  options: SanitizeOverlaySourceDefaultSnapshotOptions<TExportSettings, THaloConfig, TGuideMode>
): OverlaySourceDefaultSnapshot<TExportSettings, THaloConfig, TGuideMode> | null {
  if (!isRecord(rawSnapshot)) {
    return null;
  }

  const outputProfileKey = typeof rawSnapshot.outputProfileKey === "string"
    ? rawSnapshot.outputProfileKey
    : options.fallbackSnapshot.outputProfileKey;
  const normalizedProfileState = normalizeOverlayProfileBucketState({
    outputProfileKey,
    contentFormatKey: typeof rawSnapshot.contentFormatKey === "string"
      ? rawSnapshot.contentFormatKey
      : options.fallbackSnapshot.contentFormatKey,
    profileFormatBuckets: isRecord(rawSnapshot.profileFormatBuckets)
      ? cloneProfileFormatBuckets(rawSnapshot.profileFormatBuckets as ProfileFormatBuckets)
      : cloneProfileFormatBuckets(options.fallbackSnapshot.profileFormatBuckets),
    contentFormatKeyByProfile: isRecord(rawSnapshot.contentFormatKeyByProfile)
      ? Object.fromEntries(
        Object.entries(rawSnapshot.contentFormatKeyByProfile)
          .filter(([, rawFormatKey]) => typeof rawFormatKey === "string")
      ) as ProfileContentFormatMap
      : cloneProfileContentFormatMap(options.fallbackSnapshot.contentFormatKeyByProfile)
  });

  const exportSettingsByProfile: Record<string, TExportSettings> = {};
  if (isRecord(rawSnapshot.exportSettingsByProfile)) {
    for (const [profileKey, rawExportSettings] of Object.entries(rawSnapshot.exportSettingsByProfile)) {
      exportSettingsByProfile[profileKey] = isRecord(rawExportSettings)
        ? {
          ...options.createExportSettings(profileKey),
          ...rawExportSettings
        } as TExportSettings
        : options.createExportSettings(profileKey);
    }
  }

  const exportSettings = isRecord(rawSnapshot.exportSettings)
    ? {
      ...options.createExportSettings(normalizedProfileState.outputProfileKey),
      ...rawSnapshot.exportSettings
    } as TExportSettings
    : exportSettingsByProfile[normalizedProfileState.outputProfileKey]
      ?? options.createExportSettings(normalizedProfileState.outputProfileKey);

  exportSettingsByProfile[normalizedProfileState.outputProfileKey] ??= cloneOverlayJson(exportSettings);

  const haloConfigByProfile: Record<string, THaloConfig> = {};
  if (isRecord(rawSnapshot.haloConfigByProfile)) {
    for (const [profileKey, rawHaloConfig] of Object.entries(rawSnapshot.haloConfigByProfile)) {
      haloConfigByProfile[profileKey] = options.createHaloConfig(profileKey, rawHaloConfig);
    }
  }

  const haloConfig = haloConfigByProfile[normalizedProfileState.outputProfileKey]
    ?? options.createHaloConfig(normalizedProfileState.outputProfileKey, rawSnapshot.haloConfig);

  haloConfigByProfile[normalizedProfileState.outputProfileKey] ??= cloneOverlayJson(haloConfig);

  return {
    outputProfileKey: normalizedProfileState.outputProfileKey,
    contentFormatKey: normalizedProfileState.contentFormatKey,
    profileFormatBuckets: normalizedProfileState.profileFormatBuckets,
    contentFormatKeyByProfile: normalizedProfileState.contentFormatKeyByProfile,
    exportSettings,
    exportSettingsByProfile,
    haloConfig,
    haloConfigByProfile,
    guideMode: options.normalizeGuideMode(rawSnapshot.guideMode)
  };
}

export function sanitizeOverlayDocumentFile<
  TExportSettings extends object,
  THaloConfig extends object,
  TGuideMode extends string = string
>(
  rawDocumentFile: unknown,
  options: SanitizeOverlayDocumentFileOptions<TExportSettings, THaloConfig, TGuideMode>
): OverlayDocumentFile<TExportSettings, THaloConfig, TGuideMode> | null {
  if (!isRecord(rawDocumentFile)) {
    return null;
  }

  const now = options.now ?? new Date().toISOString();
  const fallbackName = options.fallbackName ?? "Untitled";

  let rawState: unknown = rawDocumentFile;
  let rawMetadata: unknown = undefined;
  let rawProject: unknown = undefined;

  if ("state" in rawDocumentFile || "kind" in rawDocumentFile || "version" in rawDocumentFile) {
    if (rawDocumentFile.kind !== OVERLAY_DOCUMENT_FILE_KIND) {
      return null;
    }

    if (rawDocumentFile.version !== OVERLAY_DOCUMENT_FILE_VERSION) {
      return null;
    }

    rawState = rawDocumentFile.state;
    rawMetadata = rawDocumentFile.metadata;
    rawProject = rawDocumentFile.project;
  }

  const state = sanitizeOverlaySourceDefaultSnapshot(rawState, options);
  if (!state) {
    return null;
  }

  const metadataRecord = isRecord(rawMetadata) ? rawMetadata : {};
  const createdAt = normalizeOverlayDocumentTimestamp(metadataRecord.createdAt, now);
  const updatedAt = normalizeOverlayDocumentTimestamp(metadataRecord.updatedAt, createdAt);

  return {
    kind: OVERLAY_DOCUMENT_FILE_KIND,
    version: OVERLAY_DOCUMENT_FILE_VERSION,
    metadata: {
      name: normalizeOverlayDocumentName(metadataRecord.name, fallbackName),
      createdAt,
      updatedAt
    },
    project: normalizeOverlayDocumentProject(rawProject, state),
    state
  };
}

// ---------- Param creation ----------

function createLandscapeOverlayTextFields(): TextFieldPlacementSpec[] {
  return [
    {
      id: "main_heading",
      contentFieldId: "main_heading",
      styleKey: "title",
      text: "Ubuntu\nSummit\n26.04",
      keylineIndex: 2,
      rowIndex: 1,
      offsetBaselines: 0,
      columnSpan: 1
    },
    {
      id: "body_intro",
      contentFieldId: "text_1",
      styleKey: "b_head",
      text: "A showcase\nfor the innovative\nand the ambitious",
      keylineIndex: 3,
      rowIndex: 1,
      offsetBaselines: 0,
      columnSpan: 2
    },
    {
      id: "detail_primary",
      contentFieldId: "text_2",
      styleKey: "paragraph",
      text: "May 27-28, 2026",
      keylineIndex: 3,
      rowIndex: 1,
      offsetBaselines: 15,
      columnSpan: 1
    },
    {
      id: "detail_secondary",
      contentFieldId: "text_3",
      styleKey: "paragraph",
      text: "Online",
      keylineIndex: 3,
      rowIndex: 1,
      offsetBaselines: 15,
      columnSpan: 1
    }
  ];
}

export function buildTextFieldsForFormat(
  formatKey: string,
  overrides: Record<string, ContentFormatOverrides> = DEFAULT_OVERLAY_FORMAT_OVERRIDES,
  mainHeadingField?: TextFieldPlacementSpec
): TextFieldPlacementSpec[] {
  const formatSpec: OverlayContentFormatSpec =
    OVERLAY_CONTENT_FORMATS[formatKey] ?? OVERLAY_CONTENT_FORMATS[OVERLAY_CONTENT_FORMAT_ORDER[0]];
  const formatOverride = overrides[formatSpec.key];

  const fields: TextFieldPlacementSpec[] = [];

  if (mainHeadingField) {
    fields.push({ ...mainHeadingField });
  } else {
    fields.push({
      id: "main_heading",
      contentFieldId: "main_heading",
      styleKey: "title",
      text: "Ubuntu\nSummit\n26.04",
      keylineIndex: 2,
      rowIndex: 1,
      offsetBaselines: 0,
      columnSpan: 1
    });
  }

  for (const fieldSpec of formatSpec.fields) {
    const override = formatOverride?.fields[fieldSpec.id];
    fields.push({
      id: fieldSpec.id,
      contentFieldId: fieldSpec.id,
      styleKey: override?.style ?? fieldSpec.style,
      text: "",
      keylineIndex: override?.keylineIndex ?? 3,
      rowIndex: override?.rowIndex ?? 1,
      offsetBaselines: override?.offsetBaselines ?? 0,
      columnSpan: override?.columnSpan ?? 1
    });
  }

  return fields;
}

export function createDefaultOverlayParams(
  profileKey: string = DEFAULT_OUTPUT_PROFILE_KEY,
  formatKey: string = "generic_social"
): OverlayLayoutOperatorParams {
  const formatSeed = getOverlayFormatSeedForProfile(profileKey);
  const textFields = buildTextFieldsForFormat(formatKey);
  const landscapeTextByContentField = new Map(
    createLandscapeOverlayTextFields().map((field) => [field.contentFieldId ?? field.id, field.text])
  );
  const formatSpec = OVERLAY_CONTENT_FORMATS[formatKey] ?? OVERLAY_CONTENT_FORMATS[OVERLAY_CONTENT_FORMAT_ORDER[0]];
  const inlineTextByFieldId: Record<string, string> = {};

  inlineTextByFieldId.main_heading = landscapeTextByContentField.get("main_heading") ?? "";
  for (const fieldSpec of formatSpec.fields) {
    const legacyText = fieldSpec.legacySlot ? landscapeTextByContentField.get(fieldSpec.legacySlot) : undefined;
    inlineTextByFieldId[fieldSpec.id] = legacyText ?? "";
  }

  return {
    frame: { ...formatSeed.frame },
    safeArea: { ...formatSeed.safeArea },
    grid: { ...formatSeed.grid },
    textStyles: applyOverlayProfileTextStyleDefaults(DEFAULT_OVERLAY_TEXT_STYLES, profileKey),
    textFields: textFields.map((field) => ({ ...field })),
    logo: { ...DEFAULT_OVERLAY_LOGO },
    contentSource: "inline" as OverlayContentSource,
    inlineTextByFieldId,
    csvContent: {
      draft: formatKey === "speaker_highlight" ? SPEAKER_OVERLAY_CSV_DRAFT : DEFAULT_OVERLAY_CSV_DRAFT,
      rowIndex: 1
    } as OverlayCsvContent
  };
}

export function normalizeOverlayProfileBucketState(
  state: OverlayProfileBucketState
): OverlayProfileBucketState {
  const profileFormatBuckets = cloneProfileFormatBuckets(state.profileFormatBuckets);
  const contentFormatKeyByProfile = cloneProfileContentFormatMap(state.contentFormatKeyByProfile);

  for (const profileKey of Object.keys(profileFormatBuckets)) {
    contentFormatKeyByProfile[profileKey] = resolveOverlayContentFormatKeyForProfile(
      profileKey,
      contentFormatKeyByProfile,
      profileFormatBuckets,
      state.contentFormatKey
    );
  }

  const activeContentFormatKey = resolveOverlayContentFormatKeyForProfile(
    state.outputProfileKey,
    contentFormatKeyByProfile,
    profileFormatBuckets,
    state.contentFormatKey
  );
  contentFormatKeyByProfile[state.outputProfileKey] = activeContentFormatKey;

  const activeProfileBucket = profileFormatBuckets[state.outputProfileKey] ??= {};
  activeProfileBucket[activeContentFormatKey] ??= createDefaultOverlayParams(
    state.outputProfileKey,
    activeContentFormatKey
  );

  return {
    outputProfileKey: state.outputProfileKey,
    contentFormatKey: activeContentFormatKey,
    profileFormatBuckets,
    contentFormatKeyByProfile
  };
}
