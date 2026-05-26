import {
  DEFAULT_OUTPUT_PROFILE_KEY,
  getOutputProfile
} from "@design-foundry/core-types";
import type { OverlayLayoutOperatorParams } from "@design-foundry/operator-overlay-layout";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function cloneOverlayParams(params: OverlayLayoutOperatorParams): OverlayLayoutOperatorParams {
  return cloneJson(params);
}

export function saveOutputFormatKey(_profileKey: string, _formatKey: string): void {
  // No-op: output format localStorage persistence removed.
}

export function loadOutputFormatKeys(): { profileKey: string; formatKey: string } | null {
  return null;
}

// ---------------------------------------------------------------------------
// Export settings
// ---------------------------------------------------------------------------

export interface ExportSettings {
  exportName: string;
  frameRate: number;
  transparentBackground: boolean;
}

export function createDefaultExportSettings(profileKey: string = DEFAULT_OUTPUT_PROFILE_KEY): ExportSettings {
  const profile = getOutputProfile(profileKey);
  return {
    exportName: "UbuntuSummit2026",
    frameRate: profile.defaultFrameRate,
    transparentBackground: false
  };
}

