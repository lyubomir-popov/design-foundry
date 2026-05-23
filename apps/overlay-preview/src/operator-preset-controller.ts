import type {
  HaloFieldConfig,
  HaloFieldConfigOverride,
  HaloFieldPresetDefinition
} from "@brand-layout-ops/operator-halo-field";
import type { OperatorPresetDefinition } from "@brand-layout-ops/core-types";

import type { PreviewState } from "./preview-app-context.js";

const OPERATOR_PRESET_ASSET_PATH = "/assets/operator-presets.json";
const OPERATOR_PRESET_AUTHORING_ENDPOINT = "/__authoring/operator-presets";
const OPERATOR_PRESET_DOCUMENT_KIND = "brand-layout-ops.operator-presets";
const OPERATOR_PRESET_DOCUMENT_VERSION = 1;

interface PersistedOperatorPresetDocument {
  kind: string;
  version: number;
  operators?: Record<string, unknown>;
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

function sanitizePresetDefinition(rawPreset: unknown): OperatorPresetDefinition | null {
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
    ? JSON.parse(JSON.stringify(rawPreset.config)) as Record<string, unknown>
    : {};

  return { key, label, description, config };
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
  getUserPresetDefinitions(operatorKey: string): readonly OperatorPresetDefinition[];
  saveCurrentPreset(operatorKey: string, label: string, config: Record<string, unknown>, description?: string): Promise<{ preset: OperatorPresetDefinition; message: string }>;
  getUserHaloPresetDefinitions(): readonly HaloFieldPresetDefinition[];
  saveCurrentHaloPreset(label: string, description?: string): Promise<{ preset: HaloFieldPresetDefinition; message: string }>;
}

export function createOperatorPresetController(
  options: OperatorPresetControllerOptions
): OperatorPresetController {
  const { state } = options;

  /** Per-operator user preset arrays keyed by operator slug (e.g. "halo", "fuzzy_boids"). */
  const userPresetsByOperator = new Map<string, OperatorPresetDefinition[]>();

  function getOrCreatePresetList(operatorKey: string): OperatorPresetDefinition[] {
    let list = userPresetsByOperator.get(operatorKey);
    if (!list) {
      list = [];
      userPresetsByOperator.set(operatorKey, list);
    }
    return list;
  }

  function buildOperatorsPayload(): Record<string, unknown> {
    const operators: Record<string, unknown> = {};
    for (const [operatorKey, presets] of userPresetsByOperator) {
      operators[operatorKey] = presets.map((preset) => ({
        key: preset.key,
        label: preset.label,
        description: preset.description,
        config: JSON.parse(JSON.stringify(preset.config))
      }));
    }
    return operators;
  }

  async function writeOperatorPresetLibrary(): Promise<void> {
    const payload = {
      kind: OPERATOR_PRESET_DOCUMENT_KIND,
      version: OPERATOR_PRESET_DOCUMENT_VERSION,
      operators: buildOperatorsPayload()
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
        userPresetsByOperator.clear();
        return;
      }

      const rawDocument = sanitizeOperatorPresetDocument(await response.json());
      userPresetsByOperator.clear();

      if (rawDocument.operators) {
        for (const [operatorKey, rawPresets] of Object.entries(rawDocument.operators)) {
          if (!Array.isArray(rawPresets)) {
            continue;
          }
          const sanitized = rawPresets
            .map((rawPreset) => sanitizePresetDefinition(rawPreset))
            .filter((preset): preset is OperatorPresetDefinition => preset !== null);
          if (sanitized.length > 0) {
            userPresetsByOperator.set(operatorKey, sanitized);
          }
        }
      }
    } catch {
      userPresetsByOperator.clear();
    }
  }

  // --- Generic methods ---

  function getUserPresetDefinitions(operatorKey: string): readonly OperatorPresetDefinition[] {
    return userPresetsByOperator.get(operatorKey) ?? [];
  }

  async function saveCurrentPreset(
    operatorKey: string,
    label: string,
    config: Record<string, unknown>,
    description = ""
  ): Promise<{ preset: OperatorPresetDefinition; message: string }> {
    const trimmedLabel = label.trim();
    if (trimmedLabel.length === 0) {
      throw new Error("Preset name is required.");
    }

    const trimmedDescription = description.trim();
    const presetKey = `user-${slugifyPresetLabel(trimmedLabel)}`;
    const preset: OperatorPresetDefinition = {
      key: presetKey,
      label: trimmedLabel,
      description: trimmedDescription.length > 0
        ? trimmedDescription
        : `Saved from the current ${operatorKey} settings in ${state.documentProject.targets.find((target) => target.id === state.documentProject.activeTargetId)?.label ?? "this document"}.`,
      config: JSON.parse(JSON.stringify(config))
    };

    const list = getOrCreatePresetList(operatorKey);
    const existingIndex = list.findIndex((entry) => entry.key === presetKey);
    if (existingIndex >= 0) {
      list[existingIndex] = preset;
    } else {
      list.push(preset);
    }

    await writeOperatorPresetLibrary();

    return {
      preset,
      message: existingIndex >= 0
        ? `Updated ${operatorKey} preset "${trimmedLabel}".`
        : `Saved ${operatorKey} preset "${trimmedLabel}".`
    };
  }

  // --- Halo convenience wrappers ---

  function getUserHaloPresetDefinitions(): readonly HaloFieldPresetDefinition[] {
    return getUserPresetDefinitions("halo") as readonly HaloFieldPresetDefinition[];
  }

  async function saveCurrentHaloPreset(
    label: string,
    description = ""
  ): Promise<{ preset: HaloFieldPresetDefinition; message: string }> {
    const config = buildCurrentHaloPresetConfig(state.haloConfig);
    const result = await saveCurrentPreset("halo", label, config as Record<string, unknown>, description);
    return {
      preset: result.preset as HaloFieldPresetDefinition,
      message: result.message
    };
  }

  return {
    readOperatorPresetLibrary,
    getUserPresetDefinitions,
    saveCurrentPreset,
    getUserHaloPresetDefinitions,
    saveCurrentHaloPreset
  };
}