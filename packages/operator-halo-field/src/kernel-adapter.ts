// Kernel-compliant adapter for operator-halo-field.
//
// Wraps the existing pure functions as an OperatorDefinition from
// @design-foundry/operator-kernel. The overlay-preview app continues
// to import from the main entry point — this adapter is additive.

import type { OperatorDefinition, InputPort, OutputPort, ParameterSchema } from "@design-foundry/operator-kernel";
import type {
  HaloFieldConfig,
  MascotBox,
  IntroFieldState,
  RuntimeTiming,
  RuntimePoint,
} from "./index.js";
import {
  buildIntroHaloFieldState,
  buildRuntimeTiming,
  buildRuntimePoints,
} from "./index.js";

// ---------------------------------------------------------------------------
// I/O types for the kernel operator
// ---------------------------------------------------------------------------

export interface HaloFieldInputs {
  mascotBox: MascotBox | null | undefined;
}

export interface HaloFieldOutputs {
  introField: IntroFieldState;
  timing: RuntimeTiming;
  points: RuntimePoint[];
}

// ---------------------------------------------------------------------------
// Port declarations
// ---------------------------------------------------------------------------

const inputs: readonly InputPort[] = [
  {
    key: "mascotBox",
    kind: "mascot-box",
    required: false,
    label: "Mascot box",
    description: "Bounding box of the mascot element, used for clearance calculations.",
  },
];

const outputs: readonly OutputPort[] = [
  {
    key: "introField",
    kind: "intro-field-state",
    label: "Intro field state",
    description: "Static spoke × orbit geometry: point positions, spoke angles, orbit counts.",
  },
  {
    key: "timing",
    kind: "runtime-timing",
    label: "Runtime timing",
    description: "Timeline milestones for the 3-phase animation sequence.",
  },
  {
    key: "points",
    kind: "runtime-point-array",
    label: "Runtime points",
    description: "Per-point animation data for the spiral intro.",
  },
];

// ---------------------------------------------------------------------------
// Operator definition
// ---------------------------------------------------------------------------

/**
 * Kernel-compliant halo-field operator.
 *
 * Params: full `HaloFieldConfig`.
 * Input: optional `mascotBox` (from an upstream layout operator or null).
 * Outputs: `introField`, `timing`, `points` — the three data structures
 * the renderer needs for the dot-grid animation.
 */
export const haloFieldOperator: OperatorDefinition<
  HaloFieldInputs,
  HaloFieldOutputs,
  HaloFieldConfig
> = {
  key: "df.operator.halo-field",
  version: "0.1.0",
  inputs,
  outputs,

  evaluate(ctx) {
    const config = ctx.params;
    const mascotBox = ctx.inputs.mascotBox ?? null;
    const introField = buildIntroHaloFieldState(config, mascotBox);
    const timing = buildRuntimeTiming(config);
    const points = buildRuntimePoints(config, introField, timing);
    return { introField, timing, points };
  },

  invalidationKey(params, inputs) {
    // Config-driven: invalidate when the full config or mascot box changes.
    // JSON.stringify is deterministic for the config's plain-object shape.
    const boxKey = inputs.mascotBox
      ? `${inputs.mascotBox.center_x_px},${inputs.mascotBox.center_y_px},${inputs.mascotBox.draw_size_px}`
      : "null";
    return `${boxKey}:${JSON.stringify(params)}`;
  },
};
