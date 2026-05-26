/**
 * Schema-driven parameter panel renderer.
 *
 * Takes an OperatorParameterSchema, current params, and an update callback,
 * and produces accordion sections populated with form elements from the
 * existing accordion-form-helpers primitives.
 */

import type {
  OperatorParameterFieldSchema,
  OperatorParameterSchema,
  OperatorParameterSectionSchema,
  OperatorParameterVisibilityCondition
} from "@design-foundry/core-types";
import {
  buildAccordionSectionEl,
  createCheckboxFormGroup,
  createFormGroup,
  createNumberInput,
  createReadonlySpan,
  createSelectInput,
  createSliderInput,
  wrapCol
} from "./accordion-form-helpers.js";

export interface SchemaFieldHandle {
  /** Dotted param path (`grid.baselineStepPx`). */
  path: string;
  /** The schema field definition (for visibility evaluation). */
  schema: OperatorParameterFieldSchema;
  /** The wrapping container element (can be hidden for conditional fields). */
  container: HTMLElement;
  /** Updates the rendered input to reflect a new external value. */
  setValue(value: unknown): void;
}

export interface SchemaSectionHandle {
  sectionKey: string;
  root: HTMLElement;
  body: HTMLElement;
  fields: SchemaFieldHandle[];
}

export interface SchemaRenderResult {
  sections: SchemaSectionHandle[];
  /** Update all rendered inputs from a fresh params object. */
  syncFromParams(params: object): void;
}

/**
 * Resolve a dotted path in a params object (`"grid.baselineStepPx"` → value).
 */
function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Return a shallow-cloned copy of `obj` with the value at `path` replaced.
 * Intermediate objects are shallow-cloned so the original is never mutated.
 */
function setByPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split(".");
  if (keys.length === 1) {
    return { ...obj, [keys[0]]: value };
  }
  const [head, ...rest] = keys;
  const child = (obj[head] != null && typeof obj[head] === "object")
    ? obj[head] as Record<string, unknown>
    : {};
  return { ...obj, [head]: setByPath(child, rest.join("."), value) };
}

/**
 * Render a full operator parameter panel from its schema.
 *
 * @param schema  The operator's parameter schema.
 * @param params  Current params snapshot (read-only — values are read via dotted paths).
 * @param onUpdate Called when the user edits a field. `path` is the dotted param key.
 */
export function renderSchemaPanel(
  schema: OperatorParameterSchema,
  params: object,
  onUpdate: (path: string, value: unknown) => void
): SchemaRenderResult {
  const sectionMap = new Map<string, OperatorParameterSectionSchema>();
  for (const s of schema.sections) {
    sectionMap.set(s.key, s);
  }

  // Group fields by section
  const fieldsBySection = new Map<string, OperatorParameterFieldSchema[]>();
  for (const field of schema.fields) {
    const existing = fieldsBySection.get(field.sectionKey) ?? [];
    existing.push(field);
    fieldsBySection.set(field.sectionKey, existing);
  }

  const sectionHandles: SchemaSectionHandle[] = [];
  /** All field handles across sections, for visibility evaluation. */
  const allFieldHandles: SchemaFieldHandle[] = [];

  /** Latest params snapshot for visibility evaluation. */
  let currentParams = params as Record<string, unknown>;

  for (const sectionSchema of schema.sections) {
    const fields = fieldsBySection.get(sectionSchema.key);
    if (!fields || fields.length === 0) continue;

    const { root, body } = buildAccordionSectionEl(sectionSchema.title);
    const fieldHandles: SchemaFieldHandle[] = [];

    for (const field of fields) {
      const handle = renderField(field, currentParams, (path, value) => {
        onUpdate(path, value);
        // Re-evaluate visibility after any field update (nested path aware)
        currentParams = setByPath(currentParams, path, value);
        updateFieldVisibility(allFieldHandles, currentParams);
      });
      const col = wrapCol(4, handle.element);
      body.append(col);
      const fieldHandle: SchemaFieldHandle = { path: field.path, schema: field, container: col, setValue: handle.setValue };
      fieldHandles.push(fieldHandle);
      allFieldHandles.push(fieldHandle);
    }

    sectionHandles.push({ sectionKey: sectionSchema.key, root, body, fields: fieldHandles });
  }

  // Initial visibility pass
  updateFieldVisibility(allFieldHandles, currentParams);

  return {
    sections: sectionHandles,
    syncFromParams(nextParams: object) {
      currentParams = nextParams as Record<string, unknown>;
      for (const section of sectionHandles) {
        for (const field of section.fields) {
          field.setValue(getByPath(currentParams, field.path));
        }
      }
      updateFieldVisibility(allFieldHandles, currentParams);
    }
  };
}

// ── Conditional visibility ────────────────────────────────────────────

function evaluateCondition(
  condition: OperatorParameterVisibilityCondition,
  params: Record<string, unknown>
): boolean {
  const actual = getByPath(params, condition.path);
  switch (condition.operator) {
    case "eq":
      return actual === condition.value;
    case "neq":
      return actual !== condition.value;
    case "in":
      return Array.isArray(condition.value) && (condition.value as unknown[]).includes(actual);
    case "notIn":
      return Array.isArray(condition.value) && !(condition.value as unknown[]).includes(actual);
  }
}

function updateFieldVisibility(
  handles: SchemaFieldHandle[],
  params: Record<string, unknown>
): void {
  for (const handle of handles) {
    const cond = handle.schema.visibleWhen;
    if (!cond) continue;
    handle.container.style.display = evaluateCondition(cond, params) ? "" : "none";
  }
}

// ── Field renderers ───────────────────────────────────────────────────

interface FieldRenderResult {
  element: HTMLElement;
  setValue(value: unknown): void;
}

function renderField(
  field: OperatorParameterFieldSchema,
  params: Record<string, unknown>,
  onUpdate: (path: string, value: unknown) => void
): FieldRenderResult {
  switch (field.kind) {
    case "number":
      return renderNumberField(field, params, onUpdate);
    case "slider":
      return renderSliderField(field, params, onUpdate);
    case "boolean":
      return renderBooleanField(field, params, onUpdate);
    case "select":
      return renderSelectField(field, params, onUpdate);
    case "textarea":
      return renderTextAreaField(field, params, onUpdate);
    case "color":
      return renderColorField(field, params, onUpdate);
    case "readout":
      return renderReadoutField(field, params);
  }
}

function renderNumberField(
  field: OperatorParameterFieldSchema & { kind: "number" },
  params: Record<string, unknown>,
  onUpdate: (path: string, value: unknown) => void
): FieldRenderResult {
  const value = Number(getByPath(params, field.path) ?? 0);
  const opts: { min?: number; max?: number; step?: number } = {};
  if (field.min != null) opts.min = field.min;
  if (field.max != null) opts.max = field.max;
  if (field.step != null) opts.step = field.step;
  const input = createNumberInput(value, opts, (v) => {
    onUpdate(field.path, v);
  });
  const group = createFormGroup(field.label, input);
  return {
    element: group,
    setValue(v) {
      input.value = String(Number(v ?? 0));
    }
  };
}

function renderSliderField(
  field: OperatorParameterFieldSchema & { kind: "slider" },
  params: Record<string, unknown>,
  onUpdate: (path: string, value: unknown) => void
): FieldRenderResult {
  const value = Number(getByPath(params, field.path) ?? 0);
  const slider = createSliderInput(value, { min: field.min, max: field.max, step: field.step ?? 1 }, (v) => {
    onUpdate(field.path, v);
  });
  const group = createFormGroup(field.label, slider);
  return {
    element: group,
    setValue(v) {
      const numVal = String(Number(v ?? 0));
      const range = slider.querySelector<HTMLInputElement>("input[type=range]");
      const num = slider.querySelector<HTMLInputElement>("input[type=number]");
      if (range) range.value = numVal;
      if (num) num.value = numVal;
    }
  };
}

function renderBooleanField(
  field: OperatorParameterFieldSchema & { kind: "boolean" },
  params: Record<string, unknown>,
  onUpdate: (path: string, value: unknown) => void
): FieldRenderResult {
  const value = Boolean(getByPath(params, field.path));
  const group = createCheckboxFormGroup(field.label, value, (v) => {
    onUpdate(field.path, v);
  });
  return {
    element: group,
    setValue(v) {
      const input = group.querySelector<HTMLInputElement>("input[type=checkbox]");
      if (input) input.checked = Boolean(v);
    }
  };
}

function renderSelectField(
  field: OperatorParameterFieldSchema & { kind: "select" },
  params: Record<string, unknown>,
  onUpdate: (path: string, value: unknown) => void
): FieldRenderResult {
  const value = String(getByPath(params, field.path) ?? "");
  const select = createSelectInput(value, field.options, (v) => {
    onUpdate(field.path, v);
  });
  const group = createFormGroup(field.label, select);
  return {
    element: group,
    setValue(v) {
      select.value = String(v ?? "");
    }
  };
}

function renderTextAreaField(
  field: OperatorParameterFieldSchema & { kind: "textarea" },
  params: Record<string, unknown>,
  onUpdate: (path: string, value: unknown) => void
): FieldRenderResult {
  const value = String(getByPath(params, field.path) ?? "");
  const textarea = document.createElement("textarea");
  textarea.className = "bf-input is-dense";
  textarea.rows = field.rows ?? 4;
  textarea.value = value;
  if (field.placeholder) textarea.placeholder = field.placeholder;
  textarea.addEventListener("input", () => {
    onUpdate(field.path, textarea.value);
  });
  const group = createFormGroup(field.label, textarea);
  return {
    element: group,
    setValue(v) {
      textarea.value = String(v ?? "");
    }
  };
}

function renderColorField(
  field: OperatorParameterFieldSchema & { kind: "color" },
  params: Record<string, unknown>,
  onUpdate: (path: string, value: unknown) => void
): FieldRenderResult {
  const value = String(getByPath(params, field.path) ?? "#000000");
  const input = document.createElement("input");
  input.type = "color";
  input.className = "bf-input bf-input--color is-dense";
  input.value = value;
  input.addEventListener("input", () => {
    onUpdate(field.path, input.value);
  });
  const group = createFormGroup(field.label, input);
  return {
    element: group,
    setValue(v) {
      input.value = String(v ?? "#000000");
    }
  };
}

function renderReadoutField(
  field: OperatorParameterFieldSchema & { kind: "readout" },
  params: Record<string, unknown>
): FieldRenderResult {
  const value = String(getByPath(params, field.path) ?? "");
  const readout = createReadonlySpan(value);
  const group = createFormGroup(field.label, readout);
  return {
    element: group,
    setValue(v) {
      readout.textContent = String(v ?? "");
    }
  };
}
