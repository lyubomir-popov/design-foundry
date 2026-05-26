// K4 validation: verify the operator-kernel contract works by defining
// a trivial operator and exercising evaluation + invalidation key.

import assert from "node:assert/strict";
import type {
  OperatorDefinition,
  EvaluateContext,
  InputsOf,
  OutputsOf,
  ParamsOf,
} from "@design-foundry/operator-kernel";
import { PORT_KIND } from "@design-foundry/operator-kernel";

// ---------------------------------------------------------------------------
// 1. Define a test operator: "add-offset"
//    Takes a list of numbers (simulating a point field) and adds an offset.
// ---------------------------------------------------------------------------

console.log("1. Define test operator...");

interface AddOffsetInputs {
  values: readonly number[] | undefined;
}

interface AddOffsetOutputs {
  result: readonly number[];
  count: number;
}

interface AddOffsetParams {
  offset: number;
}

const addOffsetOp: OperatorDefinition<AddOffsetInputs, AddOffsetOutputs, AddOffsetParams> = {
  key: "df.test.add-offset",
  version: "0.1.0",
  inputs: [
    { key: "values", kind: PORT_KIND.POINT_FIELD, required: false, label: "Values" },
  ],
  outputs: [
    { key: "result", kind: PORT_KIND.POINT_FIELD, label: "Result" },
    { key: "count", kind: PORT_KIND.SCALAR, label: "Count" },
  ],
  parameters: [
    { key: "offset", type: "number", label: "Offset", defaultValue: 0, min: -100, max: 100, step: 1 },
  ],

  evaluate(ctx: EvaluateContext<AddOffsetInputs, AddOffsetParams>): AddOffsetOutputs {
    const values = ctx.inputs.values ?? [];
    const offset = ctx.params.offset;
    return {
      result: values.map((v) => v + offset),
      count: values.length,
    };
  },

  invalidationKey(params: AddOffsetParams, inputs: Readonly<AddOffsetInputs>): string {
    const vals = inputs.values ?? [];
    return `${params.offset}:${vals.length}:${vals.join(",")}`;
  },
};
console.log("   PASS");

// ---------------------------------------------------------------------------
// 2. Evaluate with connected input
// ---------------------------------------------------------------------------

console.log("\n2. Evaluate with connected input...");
{
  const result = addOffsetOp.evaluate({
    nodeId: "node-1",
    params: { offset: 10 },
    inputs: { values: [1, 2, 3] },
  });

  assert.deepEqual(result.result, [11, 12, 13], "values shifted by offset");
  assert.equal(result.count, 3, "count matches input length");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 3. Evaluate with unconnected optional input
// ---------------------------------------------------------------------------

console.log("\n3. Evaluate with unconnected input...");
{
  const result = addOffsetOp.evaluate({
    nodeId: "node-2",
    params: { offset: 5 },
    inputs: { values: undefined },
  });

  assert.deepEqual(result.result, [], "empty result for unconnected input");
  assert.equal(result.count, 0, "count is 0");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 4. Invalidation key: same inputs → same key
// ---------------------------------------------------------------------------

console.log("\n4. Invalidation key stability...");
{
  const key1 = addOffsetOp.invalidationKey!(
    { offset: 10 },
    { values: [1, 2, 3] },
  );
  const key2 = addOffsetOp.invalidationKey!(
    { offset: 10 },
    { values: [1, 2, 3] },
  );
  assert.equal(key1, key2, "same inputs produce same key");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 5. Invalidation key: different params → different key
// ---------------------------------------------------------------------------

console.log("\n5. Invalidation key sensitivity...");
{
  const key1 = addOffsetOp.invalidationKey!(
    { offset: 10 },
    { values: [1, 2, 3] },
  );
  const key2 = addOffsetOp.invalidationKey!(
    { offset: 20 },
    { values: [1, 2, 3] },
  );
  assert.notEqual(key1, key2, "different params produce different keys");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 6. Utility types: InputsOf / OutputsOf / ParamsOf
// ---------------------------------------------------------------------------

console.log("\n6. Utility types...");
{
  // These are compile-time checks. If the types are wrong, TypeScript
  // would fail to compile this file. The runtime assertions confirm
  // the type algebra is consistent.
  type I = InputsOf<typeof addOffsetOp>;
  type O = OutputsOf<typeof addOffsetOp>;
  type P = ParamsOf<typeof addOffsetOp>;

  // Construct values matching the inferred types to verify they compile
  const _i: I = { values: [1, 2] };
  const _o: O = { result: [3, 4], count: 2 };
  const _p: P = { offset: 5 };

  assert.ok(true, "utility types compile correctly");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 7. PORT_KIND constants
// ---------------------------------------------------------------------------

console.log("\n7. PORT_KIND constants...");
{
  assert.equal(PORT_KIND.POINT_FIELD, "point-field");
  assert.equal(PORT_KIND.VECTOR3, "vector3");
  assert.equal(PORT_KIND.DISPLAY_LIST, "display-list");
  assert.equal(PORT_KIND.SCALAR, "scalar");
  assert.ok(Object.keys(PORT_KIND).length >= 10, "at least 10 standard kinds defined");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
// 8. Operator with no inputs (generator pattern)
// ---------------------------------------------------------------------------

console.log("\n8. Generator operator (no inputs)...");
{
  interface CounterOutputs { sequence: readonly number[] }
  interface CounterParams { count: number; start: number }

  const counterOp: OperatorDefinition<Record<string, never>, CounterOutputs, CounterParams> = {
    key: "df.test.counter",
    version: "0.1.0",
    inputs: [],
    outputs: [{ key: "sequence", kind: PORT_KIND.POINT_FIELD }],
    parameters: [
      { key: "count", type: "integer", defaultValue: 5 },
      { key: "start", type: "number", defaultValue: 0 },
    ],
    evaluate(ctx) {
      const seq: number[] = [];
      for (let i = 0; i < ctx.params.count; i++) seq.push(ctx.params.start + i);
      return { sequence: seq };
    },
  };

  const result = counterOp.evaluate({
    nodeId: "node-3",
    params: { count: 3, start: 10 },
    inputs: {},
  });

  assert.deepEqual(result.sequence, [10, 11, 12], "counter sequence correct");
}
console.log("   PASS");

// ---------------------------------------------------------------------------
console.log("\n✓ All 8 operator-kernel tests passed.");
