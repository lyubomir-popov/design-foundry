import {
  OVERLAY_CONTENT_FORMATS,
  OVERLAY_CONTENT_FORMAT_ORDER,
  type GridSettings,
  type LogoPlacementSpec,
  type OperatorParameterSchema,
  type TextStyleSpec
} from "@design-foundry/core-types";
import {
  OVERLAY_FORMAT_PRESET_ORDER,
  getOverlayFormatSeedForProfile
} from "./format-presets.js";

export interface OverlayProfileTextStyleOverrides {
  title: { fontSizePx: number; lineHeightPx: number };
  b_head: { fontSizePx: number; lineHeightPx: number };
  paragraph: { fontSizePx: number; lineHeightPx: number };
}

export interface ContentFormatFieldOverride {
  style: string;
  keylineIndex: number;
  columnSpan: number;
  rowIndex: number;
  offsetBaselines: number;
  label: string;
}

export interface ContentFormatOverrides {
  csvPath: string;
  fields: Record<string, ContentFormatFieldOverride>;
}

export const DEFAULT_OVERLAY_TEXT_STYLES: TextStyleSpec[] = [
  {
    key: "title",
    fontSizePx: 42,
    lineHeightPx: 48,
    fontWeight: 200
  },
  {
    key: "b_head",
    fontSizePx: 24,
    lineHeightPx: 32,
    fontWeight: 400
  },
  {
    key: "paragraph",
    fontSizePx: 24,
    lineHeightPx: 32,
    fontWeight: 400
  }
];

export const OVERLAY_PROFILE_GRID_DEFAULTS: Record<string, GridSettings> = Object.fromEntries(
  OVERLAY_FORMAT_PRESET_ORDER.map((presetKey) => [presetKey, getOverlayFormatSeedForProfile(presetKey).grid])
) as Record<string, GridSettings>;

export const OVERLAY_PROFILE_TEXT_STYLE_OVERRIDES: Record<string, OverlayProfileTextStyleOverrides> = {
  landscape_1280x720: {
    title: { fontSizePx: 42, lineHeightPx: 48 },
    b_head: { fontSizePx: 24, lineHeightPx: 32 },
    paragraph: { fontSizePx: 24, lineHeightPx: 32 }
  },
  fullhd_1920x1080: {
    title: { fontSizePx: 64, lineHeightPx: 72 },
    b_head: { fontSizePx: 32, lineHeightPx: 40 },
    paragraph: { fontSizePx: 28, lineHeightPx: 36 }
  },
  instagram_1080x1350: {
    title: { fontSizePx: 63, lineHeightPx: 64 },
    b_head: { fontSizePx: 32, lineHeightPx: 36 },
    paragraph: { fontSizePx: 32, lineHeightPx: 36 }
  },
  story_1080x1920: {
    title: { fontSizePx: 63, lineHeightPx: 64 },
    b_head: { fontSizePx: 32, lineHeightPx: 36 },
    paragraph: { fontSizePx: 32, lineHeightPx: 36 }
  },
  screen_3840x2160: {
    title: { fontSizePx: 110, lineHeightPx: 112 },
    b_head: { fontSizePx: 55, lineHeightPx: 72 },
    paragraph: { fontSizePx: 32, lineHeightPx: 36 }
  },
  tablet_2560x1600: {
    title: { fontSizePx: 63, lineHeightPx: 64 },
    b_head: { fontSizePx: 32, lineHeightPx: 36 },
    paragraph: { fontSizePx: 32, lineHeightPx: 36 }
  }
};

export const OVERLAY_TEXT_STYLE_DISPLAY_LABELS: Record<string, string> = {
  title: "A Head",
  b_head: "B Head",
  paragraph: "P"
};

export const DEFAULT_OVERLAY_LOGO: LogoPlacementSpec = {
  id: "brand-mark",
  xPx: 41,
  yPx: 0,
  widthPx: 42,
  heightPx: 72,
  assetPath: "/assets/UbuntuTagLogo.svg",
  linkTitleSizeToHeight: true
};

export const DEFAULT_OVERLAY_FORMAT_OVERRIDES: Record<string, ContentFormatOverrides> = {
  generic_social: {
    csvPath: "./assets/content.csv",
    fields: {
      body_intro: {
        style: "b_head",
        keylineIndex: 3,
        columnSpan: 2,
        rowIndex: 1,
        offsetBaselines: 0,
        label: "B Head"
      },
      detail_primary: {
        style: "paragraph",
        keylineIndex: 2,
        columnSpan: 1,
        rowIndex: 4,
        offsetBaselines: 15,
        label: "Paragraph 1"
      },
      detail_secondary: {
        style: "paragraph",
        keylineIndex: 3,
        columnSpan: 1,
        rowIndex: 4,
        offsetBaselines: 15,
        label: "Paragraph 2"
      }
    }
  },
  speaker_highlight: {
    csvPath: "./assets/content-speaker-highlight.csv",
    fields: {
      session_title: {
        style: "b_head",
        keylineIndex: 3,
        columnSpan: 2,
        rowIndex: 6,
        offsetBaselines: 9,
        label: "Session Title"
      },
      speaker_name: {
        style: "paragraph",
        keylineIndex: 3,
        columnSpan: 2,
        rowIndex: 7,
        offsetBaselines: 4,
        label: "Speaker Name"
      },
      speaker_role: {
        style: "paragraph",
        keylineIndex: 3,
        columnSpan: 2,
        rowIndex: 7,
        offsetBaselines: 14,
        label: "Speaker Role"
      }
    }
  }
};

export const DEFAULT_OVERLAY_CSV_DRAFT = [
  "main_heading,text_1,text_2,text_3",
  '"Ubuntu\\nSummit\\n26.04","A showcase\\nfor the innovative\\nand the ambitious","May 27-28, 2026","Online"',
  '"Ubuntu\\nSummit\\n26.04","Kernel rebuild, now with actual reference defaults.","Parity audit","In progress"'
].join("\n");

export const SPEAKER_OVERLAY_CSV_DRAFT = [
  "session_title,speaker_name,speaker_role,speaker_photo",
  '"Developer ready Ubuntu on Qualcomm IoT","Ameya Pandit","Software Engineering Lead, Qualcomm","./assets/speaker_photos/ameya_pandit.jpg"'
].join("\n");

export const OVERLAY_LAYOUT_PARAMETER_SCHEMA: OperatorParameterSchema = {
  sections: [
    {
      key: "frame",
      title: "Frame",
      description: "Document-sized frame controls for overlay parity preview."
    },
    {
      key: "safeArea",
      title: "Safe Area"
    },
    {
      key: "grid",
      title: "Grid"
    },
    {
      key: "content",
      title: "Content",
      description: "Operator-side content source controls. The CSV staging surface remains preview-specific for now."
    }
  ],
  fields: [
    { kind: "number", sectionKey: "frame", path: "frame.widthPx", label: "Width", min: 320, step: 1 },
    { kind: "number", sectionKey: "frame", path: "frame.heightPx", label: "Height", min: 320, step: 1 },
    { kind: "number", sectionKey: "safeArea", path: "safeArea.top", label: "Top", min: 0, step: 1 },
    { kind: "number", sectionKey: "safeArea", path: "safeArea.right", label: "Right", min: 0, step: 1 },
    { kind: "number", sectionKey: "safeArea", path: "safeArea.bottom", label: "Bottom", min: 0, step: 1 },
    { kind: "number", sectionKey: "safeArea", path: "safeArea.left", label: "Left", min: 0, step: 1 },
    { kind: "number", sectionKey: "grid", path: "grid.baselineStepPx", label: "Baseline step", min: 1, step: 1 },
    { kind: "number", sectionKey: "grid", path: "grid.rowCount", label: "Rows", min: 1, step: 1 },
    { kind: "number", sectionKey: "grid", path: "grid.columnCount", label: "Columns", min: 1, step: 1 },
    { kind: "number", sectionKey: "grid", path: "grid.marginTopBaselines", label: "Top margin", min: 0, step: 1 },
    { kind: "number", sectionKey: "grid", path: "grid.marginBottomBaselines", label: "Bottom margin", min: 0, step: 1 },
    { kind: "number", sectionKey: "grid", path: "grid.marginLeftBaselines", label: "Left margin", min: 0, step: 1 },
    { kind: "number", sectionKey: "grid", path: "grid.marginRightBaselines", label: "Right margin", min: 0, step: 1 },
    { kind: "number", sectionKey: "grid", path: "grid.rowGutterBaselines", label: "Row gutter", min: 0, step: 1 },
    { kind: "number", sectionKey: "grid", path: "grid.columnGutterBaselines", label: "Column gutter", min: 0, step: 1 },
    { kind: "boolean", sectionKey: "grid", path: "grid.fitWithinSafeArea", label: "Fit within safe area" },
    {
      kind: "select",
      sectionKey: "content",
      path: "contentSource",
      label: "Source",
      options: [
        { label: "Inline", value: "inline" },
        { label: "CSV draft", value: "csv" }
      ]
    },
    { kind: "number", sectionKey: "content", path: "csvContent.rowIndex", label: "CSV row", min: 1, step: 1, hint: "Used only when CSV content source is active." }
  ]
};

export function getDefaultOverlayGridForProfile(profileKey: string): GridSettings {
  return getOverlayFormatSeedForProfile(profileKey).grid;
}

export function applyOverlayProfileTextStyleDefaults(
  baseTextStyles: TextStyleSpec[],
  profileKey: string
): TextStyleSpec[] {
  const overrides = OVERLAY_PROFILE_TEXT_STYLE_OVERRIDES[profileKey] ?? OVERLAY_PROFILE_TEXT_STYLE_OVERRIDES.landscape_1280x720;
  return baseTextStyles.map((style) => {
    const override = overrides[style.key as keyof OverlayProfileTextStyleOverrides];
    return override
      ? { ...style, fontSizePx: override.fontSizePx, lineHeightPx: override.lineHeightPx }
      : { ...style };
  });
}

export function getOverlayStyleDisplayLabel(styleKey: string): string {
  return OVERLAY_TEXT_STYLE_DISPLAY_LABELS[styleKey] ?? styleKey;
}

export function resolveOverlayContentFormatKeyForProfile(
  profileKey: string,
  contentFormatKeyByProfile: Record<string, string>,
  profileFormatBuckets: Record<string, Record<string, unknown>>,
  fallbackFormatKey: string = OVERLAY_CONTENT_FORMAT_ORDER[0]
): string {
  const profileBucket = profileFormatBuckets[profileKey] ?? {};
  const profileBucketKeys = Object.keys(profileBucket);
  const candidates = [
    contentFormatKeyByProfile[profileKey],
    fallbackFormatKey,
    ...profileBucketKeys,
    OVERLAY_CONTENT_FORMAT_ORDER[0]
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0 && OVERLAY_CONTENT_FORMATS[candidate]) {
      return candidate;
    }
  }

  return OVERLAY_CONTENT_FORMAT_ORDER[0];
}

export function buildOverlayVariableItemLabel(styleKey: string, ordinal: number, total: number): string {
  const styleLabel = getOverlayStyleDisplayLabel(styleKey);
  return total > 1 ? `${styleLabel} ${ordinal}` : styleLabel;
}
