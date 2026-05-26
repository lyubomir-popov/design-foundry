// K6 validation: verify the halo-field kernel adapter.
//
// Instantiates the kernel-compliant operator, evaluates it with a
// real HaloFieldConfig, and validates the outputs match what the
// direct function calls produce.

import assert from "node:assert/strict";
import { haloFieldOperator } from "@design-foundry/operator-halo-field/kernel";
import {
  getHaloConfigForProfile,
  buildIntroHaloFieldState,
  buildRuntimeTiming,
  buildRuntimePoints,
} from "@design-foundry/operator-halo-field";
import { PORT_KIND } from "@design-foundry/operator-kernel";

// ---------------------------------------------------------------------------
// 1. Operator metadata
// ---------------------------------------------------------------------------

console.log("1. Operator metadata...");
{
  assert.equal(haloFieldOperator.key, "df.operator.halo-field");
  assert.equal(haloFieldOperator.version, "0.1.0");
  assert.equal(haloFieldOperator.inputs.length, 1, "one input port (mascotBox)");
  assert.equal(haloFieldOperator.outputs.length, 3, "three output ports");
  assert.equal(haloFieldOperator.inputs[0]!.key, "mascotBox");
  assert.equal(haloFieldOperator.inputs[0]!.required, false, "mascotBox is optional");
  assert.ok(haloFieldOperator.parameters === undefined, "params come from HaloFieldConfig, no schema needed");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 2. Evaluate with default config (no mascot box)
// ---------------------------------------------------------------------------

console.log("\n2. Evaluate with default config...");

const config = getHaloConfigForProfile("landscape_1280x720");

{
  const result = haloFieldOperator.evaluate({
    nodeId: "test-node-1",
    params: config,
    inputs: { mascotBox: undefined },
  });

  assert.ok(result.introField, "introField output exists");
  assert.ok(result.timing, "timing output exists");
  assert.ok(Array.isArray(result.points), "points is an array");
  assert.ok(result.points.length > 0, "points is non-empty");
  assert.ok(result.introField.spokes.length > 0, "spokes is non-empty");
  assert.ok(result.introField.point_specs.length > 0, "point_specs is non-empty");
  assert.ok(result.timing.playback_end_sec > 0, "playback end is positive");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 3. Output matches direct function calls
// ---------------------------------------------------------------------------

console.log("\n3. Cross-validate against direct function calls...");
{
  const introField = buildIntroHaloFieldState(config, null);
  const timing = buildRuntimeTiming(config);
  const points = buildRuntimePoints(config, introField, timing);

  const kernelResult = haloFieldOperator.evaluate({
    nodeId: "test-node-2",
    params: config,
    inputs: { mascotBox: null },
  });

  // IntroFieldState
  assert.equal(
    kernelResult.introField.point_specs.length,
    introField.point_specs.length,
    "point_specs count matches",
  );
  assert.equal(
    kernelResult.introField.spokes.length,
    introField.spokes.length,
    "spokes count matches",
  );
  assert.equal(
    kernelResult.introField.visible_spoke_count,
    introField.visible_spoke_count,
    "visible_spoke_count matches",
  );
  assert.equal(
    kernelResult.introField.geometry_scale,
    introField.geometry_scale,
    "geometry_scale matches",
  );

  // RuntimeTiming
  assert.equal(kernelResult.timing.dot_end_sec, timing.dot_end_sec, "dot_end_sec matches");
  assert.equal(kernelResult.timing.playback_end_sec, timing.playback_end_sec, "playback_end_sec matches");
  assert.equal(kernelResult.timing.spawn_angle_rad, timing.spawn_angle_rad, "spawn_angle_rad matches");

  // RuntimePoint[]
  assert.equal(kernelResult.points.length, points.length, "points count matches");
  if (points.length > 0) {
    assert.equal(
      kernelResult.points[0]!.center_x_px,
      points[0]!.center_x_px,
      "first point center_x_px matches",
    );
    assert.equal(
      kernelResult.points[0]!.birth_sec,
      points[0]!.birth_sec,
      "first point birth_sec matches",
    );
  }
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 4. Evaluate with mascot box
// ---------------------------------------------------------------------------

console.log("\n4. Evaluate with mascot box...");
{
  const mascotBox = { center_x_px: 300, center_y_px: 300, draw_size_px: 200 };
  const result = haloFieldOperator.evaluate({
    nodeId: "test-node-3",
    params: config,
    inputs: { mascotBox },
  });

  assert.ok(result.introField, "introField exists with mascot box");
  assert.deepEqual(result.introField.box, mascotBox, "mascot box passed through");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 5. Invalidation key stability
// ---------------------------------------------------------------------------

console.log("\n5. Invalidation key stability...");
{
  const inputs1 = { mascotBox: null as null | undefined };
  const key1 = haloFieldOperator.invalidationKey!(config, inputs1);
  const key2 = haloFieldOperator.invalidationKey!(config, inputs1);
  assert.equal(key1, key2, "same inputs produce same key");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 6. Invalidation key sensitivity
// ---------------------------------------------------------------------------

console.log("\n6. Invalidation key sensitivity...");
{
  const noBox = { mascotBox: null as null | undefined };
  const withBox = { mascotBox: { center_x_px: 100, center_y_px: 100, draw_size_px: 50 } as const };
  const key1 = haloFieldOperator.invalidationKey!(config, noBox);
  const key2 = haloFieldOperator.invalidationKey!(config, withBox);
  assert.notEqual(key1, key2, "different mascot box produces different key");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 7. Output port kinds use domain-specific strings
// ---------------------------------------------------------------------------

console.log("\n7. Output port kinds...");
{
  const outKinds = haloFieldOperator.outputs.map((o) => o.kind);
  assert.ok(outKinds.includes("intro-field-state"), "introField uses domain-specific kind");
  assert.ok(outKinds.includes("runtime-timing"), "timing uses domain-specific kind");
  assert.ok(outKinds.includes("runtime-point-array"), "points uses domain-specific kind");
  // Verify no standard kinds are misused for domain types
  assert.ok(!outKinds.includes(PORT_KIND.POINT_FIELD), "domain types don't claim to be standard point-field");
  assert.ok(!outKinds.includes(PORT_KIND.SCALAR), "complex objects don't claim to be scalar");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
console.log("\n✓ All 7 halo-field kernel adapter tests passed.");
