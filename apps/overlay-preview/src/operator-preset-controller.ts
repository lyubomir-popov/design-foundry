import type {
  HaloFieldConfig,
  HaloFieldConfigOverride,
  HaloFieldPresetDefinition
} from "@design-foundry/operator-halo-field";

import type { PreviewState } from "./preview-app-context.js";

const OPERATOR_PRESET_ASSET_PATH = "/assets/operator-presets.json";
const OPERATOR_PRESET_AUTHORING_ENDPOINT = "/__authoring/operator-presets";
const OPERATOR_PRESET_DOCUMENT_KIND = "df.operator-presets";
const OPERATOR_PRESET_DOCUMENT_VERSION = 1;

interface PersistedOperatorPresetDocument {
  kind: string;
  version: number;
  operators?: {
    halo?: unknown;
  };
}

type PersistedOperatorPresetOperators = NonNullable<PersistedOperatorPresetDocument["operators"]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function cloneHaloConfigOverride(config: HaloFieldConfigOverride): HaloFieldConfigOverride {
  return JSON.parse(JSON.stringify(config)) as HaloFieldConfigOverride;
}

function sanitizeHaloPresetDefinition(rawPreset: unknown): HaloFieldPresetDefinition | null {
  if (!isRecord(rawPreset)) {
    return null;
  }

  const key = String(rawPreset.key ?? "").trim();
  const label = String(rawPreset.label ?? "").trim();
  if (key.length === 0 || label.length === 0) {
    return null;
  }

  const description = String(rawPreset.description ?? "").trim();
  const config = isRecord(rawPreset.config)
    ? cloneHaloConfigOverride(rawPreset.config as HaloFieldConfigOverride)
    : {};

  return {
    key,
    label,
    description,
    config
  };
}

function sanitizeOperatorPresetDocument(rawDocument: unknown): PersistedOperatorPresetDocument {
  const document = isRecord(rawDocument) ? rawDocument : {};
  return {
    kind: String(document.kind ?? OPERATOR_PRESET_DOCUMENT_KIND),
    version: Number(document.version ?? OPERATOR_PRESET_DOCUMENT_VERSION),
    operators: isRecord(document.operators)
      ? document.operators as PersistedOperatorPresetOperators
      : {}
  };
}

function slugifyPresetLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "preset";
}

function buildCurrentHaloPresetConfig(config: HaloFieldConfig): HaloFieldConfigOverride {
  return {
    mascot_fade: { ...config.mascot_fade },
    head_turn: { ...config.head_turn },
    blink: { ...config.blink },
    sneeze: { ...config.sneeze },
    generator_wrangle: { ...config.generator_wrangle },
    transition_wrangle: { ...config.transition_wrangle },
    point_style: { ...config.point_style },
    spoke_lines: { ...config.spoke_lines },
    spoke_text: { ...config.spoke_text },
    screensaver: { ...config.screensaver },
    finale: { ...config.finale },
    vignette: { ...config.vignette }
  };
}

export interface OperatorPresetControllerOptions {
  state: PreviewState;
}

export interface OperatorPresetController {
  readOperatorPresetLibrary(): Promise<void>;
  getUserHaloPresetDefinitions(): readonly HaloFieldPresetDefinition[];
  saveCurrentHaloPreset(label: string, description?: string): Promise<{ preset: HaloFieldPresetDefinition; message: string }>;
}

export function createOperatorPresetController(
  options: OperatorPresetControllerOptions
): OperatorPresetController {
  const { state } = options;

  let userHaloPresetDefinitions: HaloFieldPresetDefinition[] = [];

  async function writeOperatorPresetLibrary(): Promise<void> {
    const payload = {
      kind: OPERATOR_PRESET_DOCUMENT_KIND,
      version: OPERATOR_PRESET_DOCUMENT_VERSION,
      operators: {
        halo: userHaloPresetDefinitions.map((preset) => ({
          key: preset.key,
          label: preset.label,
          description: preset.description,
          config: cloneHaloConfigOverride(preset.config)
        }))
      }
    };

    const response = await fetch(OPERATOR_PRESET_AUTHORING_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const responsePayload = await response.json().catch(() => ({}));
    if (!response.ok || responsePayload?.ok !== true) {
      throw new Error(responsePayload?.error || `Operator preset writeback failed with HTTP ${response.status}.`);
    }
  }

  async function readOperatorPresetLibrary(): Promise<void> {
    try {
      const response = await fetch(`${OPERATOR_PRESET_ASSET_PATH}?t=${Date.now()}`, {
        cache: "no-store"
      });
      if (!response.ok) {
        userHaloPresetDefinitions = [];
        return;
      }

      const rawDocument = sanitizeOperatorPresetDocument(await response.json());
      const rawHaloPresets = Array.isArray(rawDocument.operators?.halo)
        ? rawDocument.operators?.halo
        : [];
      userHaloPresetDefinitions = rawHaloPresets
        .map((rawPreset) => sanitizeHaloPresetDefinition(rawPreset))
        .filter((preset): preset is HaloFieldPresetDefinition => preset !== null);
    } catch {
      userHaloPresetDefinitions = [];
    }
  }

  function getUserHaloPresetDefinitions(): readonly HaloFieldPresetDefinition[] {
    return userHaloPresetDefinitions;
  }

  async function saveCurrentHaloPreset(
    label: string,
    description = ""
  ): Promise<{ preset: HaloFieldPresetDefinition; message: string }> {
    const trimmedLabel = label.trim();
    if (trimmedLabel.length === 0) {
      throw new Error("Preset name is required.");
    }

    const trimmedDescription = description.trim();
    const presetKey = `user-${slugifyPresetLabel(trimmedLabel)}`;
    const preset: HaloFieldPresetDefinition = {
      key: presetKey,
      label: trimmedLabel,
      description: trimmedDescription.length > 0
        ? trimmedDescription
        : `Saved from the current Halo settings in ${state.documentProject.targets.find((target) => target.id === state.documentProject.activeTargetId)?.label ?? "this document"}.`,
      config: buildCurrentHaloPresetConfig(state.haloConfig)
    };

    const existingIndex = userHaloPresetDefinitions.findIndex((entry) => entry.key === presetKey);
    if (existingIndex >= 0) {
      userHaloPresetDefinitions = userHaloPresetDefinitions.map((entry, index) => index === existingIndex ? preset : entry);
    } else {
      userHaloPresetDefinitions = [...userHaloPresetDefinitions, preset];
    }

    await writeOperatorPresetLibrary();

    return {
      preset,
      message: existingIndex >= 0
        ? `Updated Halo preset ${trimmedLabel}.`
        : `Saved Halo preset ${trimmedLabel}.`
    };
  }

  return {
    readOperatorPresetLibrary,
    getUserHaloPresetDefinitions,
    saveCurrentHaloPreset
  };
}