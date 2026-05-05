import {
  DEFAULT_OUTPUT_PROFILE_KEY,
  OUTPUT_PROFILE_ORDER,
  OUTPUT_PROFILES,
  getOutputProfile,
  type FrameSize,
  type GridSettings,
  type SafeAreaInsets
} from "@brand-layout-ops/core-types";

export interface OverlayFormatSeed {
  frame: FrameSize;
  safeArea: SafeAreaInsets;
  grid: GridSettings;
}

export interface OverlayFormatPresetDefinition extends OverlayFormatSeed {
  key: string;
  label: string;
}

const OVERLAY_FORMAT_PRESET_GRID_SEEDS: Record<string, GridSettings> = {
  landscape_1280x720: {
    baselineStepPx: 8,
    rowCount: 4,
    columnCount: 4,
    marginTopBaselines: 4,
    marginBottomBaselines: 4,
    marginLeftBaselines: 5,
    marginRightBaselines: 5,
    rowGutterBaselines: 4,
    columnGutterBaselines: 0,
    fitWithinSafeArea: true
  },
  fullhd_1920x1080: {
    baselineStepPx: 12,
    rowCount: 4,
    columnCount: 6,
    marginTopBaselines: 6,
    marginBottomBaselines: 6,
    marginLeftBaselines: 6,
    marginRightBaselines: 6,
    rowGutterBaselines: 4,
    columnGutterBaselines: 4,
    fitWithinSafeArea: true
  },
  instagram_1080x1350: {
    baselineStepPx: 8,
    rowCount: 8,
    columnCount: 4,
    marginTopBaselines: 5,
    marginBottomBaselines: 6,
    marginLeftBaselines: 6,
    marginRightBaselines: 6,
    rowGutterBaselines: 0,
    columnGutterBaselines: 0,
    fitWithinSafeArea: true
  },
  story_1080x1920: {
    baselineStepPx: 8,
    rowCount: 4,
    columnCount: 4,
    marginTopBaselines: 6,
    marginBottomBaselines: 9,
    marginLeftBaselines: 0,
    marginRightBaselines: 0,
    rowGutterBaselines: 0,
    columnGutterBaselines: 0,
    fitWithinSafeArea: true
  },
  screen_3840x2160: {
    baselineStepPx: 24,
    rowCount: 4,
    columnCount: 8,
    marginTopBaselines: 4,
    marginBottomBaselines: 4,
    marginLeftBaselines: 4,
    marginRightBaselines: 4,
    rowGutterBaselines: 0,
    columnGutterBaselines: 0,
    fitWithinSafeArea: false
  },
  tablet_2560x1600: {
    baselineStepPx: 8,
    rowCount: 4,
    columnCount: 4,
    marginTopBaselines: 0,
    marginBottomBaselines: 9,
    marginLeftBaselines: 0,
    marginRightBaselines: 0,
    rowGutterBaselines: 4,
    columnGutterBaselines: 4,
    fitWithinSafeArea: true
  }
};

export const OVERLAY_FORMAT_PRESET_ORDER: readonly string[] = [...OUTPUT_PROFILE_ORDER];

export const OVERLAY_FORMAT_PRESETS: Readonly<Record<string, OverlayFormatPresetDefinition>> = Object.freeze(
  Object.fromEntries(OVERLAY_FORMAT_PRESET_ORDER.map((presetKey) => {
    const profile = OUTPUT_PROFILES[presetKey]!;
    return [presetKey, {
      key: presetKey,
      label: profile.label,
      frame: {
        widthPx: profile.widthPx,
        heightPx: profile.heightPx
      },
      safeArea: { ...profile.safeArea },
      grid: { ...(OVERLAY_FORMAT_PRESET_GRID_SEEDS[presetKey] ?? OVERLAY_FORMAT_PRESET_GRID_SEEDS[DEFAULT_OUTPUT_PROFILE_KEY]) }
    }];
  })) as Record<string, OverlayFormatPresetDefinition>
);

function cloneOverlayFormatSeed(seed: OverlayFormatSeed): OverlayFormatSeed {
  return {
    frame: { ...seed.frame },
    safeArea: { ...seed.safeArea },
    grid: { ...seed.grid }
  };
}

export function getOverlayFormatPresetKeyForProfile(profileKey: string): string | null {
  return Object.prototype.hasOwnProperty.call(OVERLAY_FORMAT_PRESETS, profileKey)
    ? profileKey
    : null;
}

export function getOverlayFormatPresetDefinition(presetKey: string): OverlayFormatPresetDefinition | null {
  const preset = OVERLAY_FORMAT_PRESETS[presetKey];
  if (!preset) {
    return null;
  }

  const seed = cloneOverlayFormatSeed(preset);
  return {
    key: preset.key,
    label: preset.label,
    frame: seed.frame,
    safeArea: seed.safeArea,
    grid: seed.grid
  };
}

export function getOverlayFormatSeedForProfile(profileKey: string): OverlayFormatSeed {
  const preset = getOverlayFormatPresetDefinition(profileKey);
  if (preset) {
    return cloneOverlayFormatSeed(preset);
  }

  const profile = getOutputProfile(profileKey);
  return {
    frame: {
      widthPx: profile.widthPx,
      heightPx: profile.heightPx
    },
    safeArea: { ...profile.safeArea },
    grid: { ...(OVERLAY_FORMAT_PRESET_GRID_SEEDS[DEFAULT_OUTPUT_PROFILE_KEY] ?? OVERLAY_FORMAT_PRESET_GRID_SEEDS.landscape_1280x720) }
  };
}

export function getOverlayFormatSafeAreaFrame(
  source: Pick<OverlayFormatSeed, "frame" | "safeArea">
): FrameSize {
  return {
    widthPx: Math.max(0, source.frame.widthPx - source.safeArea.left - source.safeArea.right),
    heightPx: Math.max(0, source.frame.heightPx - source.safeArea.top - source.safeArea.bottom)
  };
}

export function getOverlayFormatSeedSummary(seed: OverlayFormatSeed): string {
  const safeAreaFrame = getOverlayFormatSafeAreaFrame(seed);
  return [
    `${safeAreaFrame.widthPx}x${safeAreaFrame.heightPx} safe`,
    `${seed.grid.columnCount}c x ${seed.grid.rowCount}r`,
    `${seed.grid.baselineStepPx}px baseline`,
    `gutters c${seed.grid.columnGutterBaselines}/r${seed.grid.rowGutterBaselines}`
  ].join(" · ");
}