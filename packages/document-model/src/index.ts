import {
  getOutputProfile,
  type FrameSize,
  type GridSettings,
  type LayerScene,
  type LayoutGridMetrics,
  type LogoPlacement,
  type LogoPlacementSpec,
  type OperatorDefinition,
  type SafeAreaInsets,
  type TextFieldPlacementSpec,
  type TextStyleSpec
} from "@brand-layout-ops/core-types";
import { getLinkedLogoDimensionsPx, resolveLayerScene } from "@brand-layout-ops/layout-engine";
import {
  createApproximateTextMeasurer,
  type ApproximateTextMeasureOptions
} from "@brand-layout-ops/layout-text";
import { resolveOverlayTextFields } from "./csv-resolution.js";
import {
  buildOverlayVariableItemLabel,
  OVERLAY_LAYOUT_PARAMETER_SCHEMA
} from "./field-defaults.js";

export const OVERLAY_LAYOUT_OPERATOR_KEY = "overlay.layout";

export type OverlayContentSource = "inline" | "csv";

export interface OverlayCsvContent {
  draft: string;
  rowIndex: number;
}

export interface OverlayCsvDraftTable {
  headers: string[];
  rows: string[][];
  hasUnterminatedQuote: boolean;
}

export interface OverlayCsvDraftSummary {
  headers: string[];
  rowCount: number;
  selectedRowIndex: number;
  selectedRowExists: boolean;
  selectedRowValues: Record<string, string>;
  missingFieldKeys: string[];
  hasUnterminatedQuote: boolean;
}

export interface OverlayLayoutOperatorParams {
  frame: FrameSize;
  safeArea: SafeAreaInsets;
  grid: GridSettings;
  textFields: TextFieldPlacementSpec[];
  textStyles: TextStyleSpec[];
  logo?: LogoPlacementSpec;
  contentSource?: OverlayContentSource;
  inlineTextByFieldId?: Record<string, string>;
  csvContent?: OverlayCsvContent;
}

export type ProfileFormatBuckets = Record<string, Record<string, OverlayLayoutOperatorParams>>;
export type ProfileContentFormatMap = Record<string, string>;

export * from "./background-graph.js";
export * from "./document-schema.js";
export * from "./format-presets.js";

export interface OverlayLayoutOperatorOutputs {
  scene: LayerScene;
  grid: LayoutGridMetrics;
  texts: LayerScene["texts"];
  logo?: LogoPlacement;
}

export interface CreateOverlayLayoutOperatorOptions {
  operatorKey?: string;
  textMeasureOptions?: ApproximateTextMeasureOptions;
}

export * from "./field-defaults.js";

export function getOverlayFieldDisplayLabel(
  params: Pick<OverlayLayoutOperatorParams, "textFields">,
  fieldId: string
): string {
  const field = params.textFields.find((candidate) => candidate.id === fieldId);
  if (!field) {
    return fieldId;
  }

  const sameStyleFields = params.textFields.filter((candidate) => candidate.styleKey === field.styleKey);
  const ordinal = sameStyleFields.findIndex((candidate) => candidate.id === field.id) + 1;
  return buildOverlayVariableItemLabel(field.styleKey, Math.max(1, ordinal), sameStyleFields.length);
}

export function getOverlayMainHeadingField(
  params: Pick<OverlayLayoutOperatorParams, "textFields">
): TextFieldPlacementSpec | undefined {
  return params.textFields.find((field) => field.id === "main_heading");
}

export function replaceOverlayTextField(
  textFields: TextFieldPlacementSpec[],
  nextField: TextFieldPlacementSpec
): TextFieldPlacementSpec[] {
  const index = textFields.findIndex((field) => field.id === nextField.id);
  if (index === -1) {
    return [{ ...nextField }, ...textFields];
  }

  return textFields.map((field, fieldIndex) => (
    fieldIndex === index ? { ...nextField } : field
  ));
}

export function syncOverlayParamsFrameToProfile(
  params: OverlayLayoutOperatorParams,
  profileKey: string
): OverlayLayoutOperatorParams {
  const profile = getOutputProfile(profileKey);
  const cloned = JSON.parse(JSON.stringify(params)) as OverlayLayoutOperatorParams;
  cloned.frame = { widthPx: profile.widthPx, heightPx: profile.heightPx };
  return cloned;
}

export function syncOverlaySharedProfileParams(
  source: OverlayLayoutOperatorParams,
  target: OverlayLayoutOperatorParams,
  profileKey: string
): OverlayLayoutOperatorParams {
  const profile = getOutputProfile(profileKey);
  const synced = JSON.parse(JSON.stringify(target)) as OverlayLayoutOperatorParams;
  const sourceHeading = getOverlayMainHeadingField(source);

  synced.frame = {
    widthPx: profile.widthPx,
    heightPx: profile.heightPx
  };
  synced.safeArea = { ...source.safeArea };
  synced.grid = { ...source.grid };
  synced.textStyles = source.textStyles.map((style) => ({ ...style }));
  if (source.logo) {
    synced.logo = { ...source.logo };
  } else {
    delete synced.logo;
  }

  if (sourceHeading) {
    synced.textFields = replaceOverlayTextField(synced.textFields, sourceHeading);
  }

  const nextInlineTextByFieldId = { ...(synced.inlineTextByFieldId ?? {}) };
  if (sourceHeading) {
    const headingKeys = new Set<string>([sourceHeading.id]);
    if (sourceHeading.contentFieldId) {
      headingKeys.add(sourceHeading.contentFieldId);
    }

    for (const key of headingKeys) {
      const mappedValue = source.inlineTextByFieldId?.[key];
      if (typeof mappedValue === "string") {
        nextInlineTextByFieldId[key] = mappedValue;
      }
    }

    if (sourceHeading.text.trim().length > 0) {
      nextInlineTextByFieldId[sourceHeading.id] = sourceHeading.text;
      if (sourceHeading.contentFieldId) {
        nextInlineTextByFieldId[sourceHeading.contentFieldId] = sourceHeading.text;
      }
    }
  }

  synced.inlineTextByFieldId = nextInlineTextByFieldId;
  return synced;
}

export interface SeedOverlayFormatVariantOptions {
  preserveTargetSafeArea?: boolean;
  preserveTargetGrid?: boolean;
}

export function seedOverlayFormatVariantParams(
  source: OverlayLayoutOperatorParams,
  target: OverlayLayoutOperatorParams,
  profileKey: string,
  options: SeedOverlayFormatVariantOptions = {}
): OverlayLayoutOperatorParams {
  const profile = getOutputProfile(profileKey);
  const seeded = JSON.parse(JSON.stringify(source)) as OverlayLayoutOperatorParams;

  seeded.frame = {
    widthPx: profile.widthPx,
    heightPx: profile.heightPx
  };

  if (options.preserveTargetSafeArea) {
    seeded.safeArea = { ...target.safeArea };
  }

  if (options.preserveTargetGrid) {
    seeded.grid = { ...target.grid };
  }

  return seeded;
}

export {
  findCsvHeaderForField,
  getOverlayFieldContentKey,
  inspectOverlayCsvDraft,
  parseCsvDraft,
  resolveOverlayTextFields,
  resolveOverlayTextValue,
  setOverlayTextValue
} from "./csv-resolution.js";

export function normalizeOverlayLinkedTitleLogoParams(
  params: OverlayLayoutOperatorParams
): OverlayLayoutOperatorParams {
  const titleStyle = params.textStyles.find((style) => style.key === "title");
  const logo = params.logo;
  if (!titleStyle || !logo || logo.linkTitleSizeToHeight === false || logo.widthPx <= 0 || logo.heightPx <= 0) {
    return params;
  }

  const aspectRatio = logo.widthPx / Math.max(1, logo.heightPx);
  const linkedDimensions = getLinkedLogoDimensionsPx(titleStyle.fontSizePx, aspectRatio);

  if (linkedDimensions.widthPx === logo.widthPx && linkedDimensions.heightPx === logo.heightPx) {
    return params;
  }

  return {
    ...params,
    logo: {
      ...logo,
      widthPx: linkedDimensions.widthPx,
      heightPx: linkedDimensions.heightPx
    }
  };
}

export function normalizeOverlayTextFieldOffsetBaselines(
  field: TextFieldPlacementSpec
): TextFieldPlacementSpec {
  const nextOffsetBaselines = Math.round(field.offsetBaselines);
  return nextOffsetBaselines === field.offsetBaselines
    ? field
    : { ...field, offsetBaselines: nextOffsetBaselines };
}

export function normalizeOverlayParamsForEditing(
  params: OverlayLayoutOperatorParams
): OverlayLayoutOperatorParams {
  const linkedParams = normalizeOverlayLinkedTitleLogoParams(params);
  let didChange = false;
  const textFields = linkedParams.textFields.map((field) => {
    const normalizedField = normalizeOverlayTextFieldOffsetBaselines(field);
    if (normalizedField !== field) {
      didChange = true;
    }
    return normalizedField;
  });

  if (didChange) {
    return { ...linkedParams, textFields };
  }

  return linkedParams;
}

export function resolveOverlayLayoutScene(
  params: OverlayLayoutOperatorParams,
  textMeasureOptions?: ApproximateTextMeasureOptions
): LayerScene {
  return resolveLayerScene({
    frame: params.frame,
    safeArea: params.safeArea,
    grid: params.grid,
    textFields: resolveOverlayTextFields(params),
    textStyles: params.textStyles,
    ...(params.logo ? { logo: params.logo } : {})
  }, createApproximateTextMeasurer(textMeasureOptions));
}

export function createOverlayLayoutOperator(
  options: CreateOverlayLayoutOperatorOptions = {}
): OperatorDefinition<OverlayLayoutOperatorParams> {
  return {
    key: options.operatorKey ?? OVERLAY_LAYOUT_OPERATOR_KEY,
    version: "0.1.0",
    inputs: [],
    parameterSchema: OVERLAY_LAYOUT_PARAMETER_SCHEMA,
    outputs: [
      {
        key: "scene",
        kind: "layer-scene",
        description: "Resolved overlay scene with guides, text placements, and optional logo placement."
      },
      {
        key: "grid",
        kind: "layout-grid-metrics",
        description: "Resolved baseline and column grid metrics for overlay composition."
      },
      {
        key: "texts",
        kind: "resolved-text-placement-list",
        description: "Resolved text placements derived from grid and style settings."
      },
      {
        key: "logo",
        kind: "logo-placement",
        description: "Optional resolved logo placement anchored to the layout origin."
      }
    ],
    run(context) {
      const scene = resolveOverlayLayoutScene(context.params, options.textMeasureOptions);

      return {
        scene,
        grid: scene.grid,
        texts: scene.texts,
        ...(scene.logo ? { logo: scene.logo } : {})
      } satisfies Record<string, unknown>;
    }
  };
}