// @design-foundry/operator-kernel
//
// The typed operator contract for the design-foundry kernel.
//
// An operator is a pure function with:
//   - declared input ports (typed data from upstream operators)
//   - declared output ports (typed data for downstream consumers)
//   - a parameter schema (for UI generation and documentation)
//   - a synchronous evaluate function (inputs + params → outputs)
//   - an optional invalidation key (for incremental memoization)
//
// This package has no dependencies. It defines the contract only —
// no runtime, no data types, no UI. Port "kind" strings are open
// for extensibility; standard kinds are exported as constants.
//
// Existing operators in packages/operator-* continue to use the
// ad-hoc OperatorDefinition from core-types. This contract is the
// target interface: K6 ports the first operator (halo-field) onto it.

// ---------------------------------------------------------------------------
// Port declarations
// ---------------------------------------------------------------------------

/** An input port that an operator can receive data through. */
export interface InputPort {
  /** Stable key used in graph edges and evaluation context. */
  readonly key: string;
  /** Data-kind identifier. See PORT_KIND for the standard set. */
  readonly kind: string;
  /** Whether the operator requires this input to be connected. Default: false. */
  readonly required?: boolean;
  readonly label?: string;
  readonly description?: string;
}

/** An output port that an operator produces data through. */
export interface OutputPort {
  /** Stable key used in graph edges and evaluation context. */
  readonly key: string;
  /** Data-kind identifier. See PORT_KIND for the standard set. */
  readonly kind: string;
  readonly label?: string;
  readonly description?: string;
}

/**
 * Standard port-kind constants. Operators may use these or define custom
 * kind strings — the kind field is an open `string`, not a closed union.
 */
export const PORT_KIND = {
  /** A set of points with per-point attributes (position, color, pscale, etc.). */
  POINT_FIELD: "point-field",
  /** A 3-component vector. */
  VECTOR3: "vector3",
  /** A single numeric value. */
  SCALAR: "scalar",
  /** A boolean flag. */
  BOOLEAN: "boolean",
  /** An RGBA color. */
  COLOR: "color",
  /** A UTF-8 string. */
  STRING: "string",
  /** Resolved instances for rendering (position, scale, prototype ref). */
  INSTANCE_SET: "instance-set",
  /** A library of reusable geometry prototypes. */
  PROTOTYPE_LIBRARY: "prototype-library",
  /** A flat display list from @design-foundry/render-ir. */
  DISPLAY_LIST: "display-list",
  /** Boid simulation state. */
  BOID_FIELD: "boid-field",
} as const;

// ---------------------------------------------------------------------------
// Parameter schema
// ---------------------------------------------------------------------------

/**
 * Supported parameter types for UI generation and documentation.
 * This list can grow; the schema is metadata, not a runtime validator.
 */
export type ParameterType =
  | "number"
  | "integer"
  | "string"
  | "boolean"
  | "color"
  | "vector3"
  | "select";

/** A selectable option in a "select"-type parameter. */
export interface ParameterOption {
  readonly value: string;
  readonly label: string;
}

/** A single parameter field declaration. */
export interface ParameterField {
  readonly key: string;
  readonly type: ParameterType;
  readonly label?: string;
  readonly description?: string;
  readonly defaultValue?: unknown;
  /** Minimum value (number / integer parameters). */
  readonly min?: number;
  /** Maximum value (number / integer parameters). */
  readonly max?: number;
  /** Step size for slider / spinner UI (number / integer parameters). */
  readonly step?: number;
  /** Available options (select parameters). */
  readonly options?: readonly ParameterOption[];
}

/** A complete parameter schema is an ordered list of fields. */
export type ParameterSchema = readonly ParameterField[];

// ---------------------------------------------------------------------------
// Evaluation context
// ---------------------------------------------------------------------------

/**
 * The context passed to an operator's `evaluate` function.
 *
 * - `nodeId` is the unique identifier of this operator instance in the graph.
 * - `params` are the user-authored parameter values.
 * - `inputs` are the values received through connected input ports.
 *   Unconnected optional ports are `undefined`.
 */
export interface EvaluateContext<
  TInputs extends object = Record<string, unknown>,
  TParams = unknown,
> {
  readonly nodeId: string;
  readonly params: TParams;
  readonly inputs: Readonly<TInputs>;
}

// ---------------------------------------------------------------------------
// Operator definition
// ---------------------------------------------------------------------------

/**
 * The formal operator contract.
 *
 * Type parameters:
 * - `TInputs` — the shape of the `inputs` record (keys match input port keys).
 * - `TOutputs` — the shape of the returned output record (keys match output port keys).
 * - `TParams` — the operator's parameter type.
 *
 * The `evaluate` function is **synchronous and pure**: same inputs + params
 * always produce the same outputs, with no side effects. The graph runtime
 * handles caching, scheduling, and lifecycle; operators must not manage
 * their own state between evaluations.
 *
 * For simulation operators that need frame-to-frame state, model the state
 * as an explicit input + output port pair. The runtime stores the previous
 * output and feeds it back as input on the next evaluation, keeping the
 * evaluate function itself pure.
 */
export interface OperatorDefinition<
  TInputs extends object = Record<string, unknown>,
  TOutputs extends object = Record<string, unknown>,
  TParams = unknown,
> {
  /** Unique operator key (e.g. "df.operator.orbits"). */
  readonly key: string;
  /** Semver version string. */
  readonly version: string;
  /** Declared input ports. */
  readonly inputs: readonly InputPort[];
  /** Declared output ports. */
  readonly outputs: readonly OutputPort[];
  /** Optional parameter schema for UI generation. */
  readonly parameters?: ParameterSchema;

  /**
   * Pure, synchronous evaluation function.
   * Returns one value per declared output port key.
   */
  evaluate(ctx: EvaluateContext<TInputs, TParams>): TOutputs;

  /**
   * Optional invalidation key for incremental memoization.
   *
   * The runtime calls this before `evaluate`. If the returned key matches
   * the key from the previous evaluation, the cached output is reused and
   * `evaluate` is skipped.
   *
   * If not provided, the runtime always re-evaluates.
   */
  invalidationKey?(params: TParams, inputs: Readonly<TInputs>): string | number;
}

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

/** Extract the TInputs type from an OperatorDefinition. */
export type InputsOf<T> = T extends OperatorDefinition<infer I, infer _O, infer _P> ? I : never;

/** Extract the TOutputs type from an OperatorDefinition. */
export type OutputsOf<T> = T extends OperatorDefinition<infer _I, infer O, infer _P> ? O : never;

/** Extract the TParams type from an OperatorDefinition. */
export type ParamsOf<T> = T extends OperatorDefinition<infer _I, infer _O, infer P> ? P : never;
