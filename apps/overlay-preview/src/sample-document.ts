import {
  DEFAULT_OUTPUT_PROFILE_KEY,
  getOutputProfile
} from "@brand-layout-ops/core-types";
import type { OverlayLayoutOperatorParams } from "@brand-layout-ops/document-model";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function cloneOverlayParams(params: OverlayLayoutOperatorParams): OverlayLayoutOperatorParams {
  return cloneJson(params);
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

