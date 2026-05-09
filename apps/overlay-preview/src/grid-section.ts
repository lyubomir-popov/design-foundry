/**
 * grid-section.ts — Layout Grid accordion section builder.
 *
 * Extracted from main.ts. Builds the grid parameter panel
 * (baseline, columns, margins, safe area).
 * Receives all dependencies via PreviewAppContext.
 */

import type { PreviewAppContext } from "./preview-app-context.js";
import {
  buildAccordionSectionEl,
  createCheckboxFormGroup,
  createFormGroup,
  createNumberInput,
  wrapCol
} from "@brand-layout-ops/parameter-ui";

export function buildGridSection(ctx: PreviewAppContext): HTMLElement {
  const { state } = ctx;
  const { root, body } = buildAccordionSectionEl("Layout Grid");
  const grid = state.params.grid;

  function createInspectorHeading(text: string): HTMLElement {
    const heading = document.createElement("span");
    heading.className = "bf-form-label is-inspector-rail-label is-layout-grid-heading";
    heading.textContent = text;
    return heading;
  }

  const safeFields = document.createElement("div");
  safeFields.className = "bf-grid";
  const safeAreaHeading = createInspectorHeading("Safe Area (px)");

  function syncSafeAreaFields(): void {
    safeFields.replaceChildren();

    if (state.params.grid.fitWithinSafeArea === false) {
      safeFields.hidden = true;
      safeAreaHeading.hidden = true;
      return;
    }

    safeFields.hidden = false;
    safeAreaHeading.hidden = false;
    const safeArea = state.params.safeArea;

    safeFields.append(wrapCol(2, createFormGroup("Top",
      createNumberInput(safeArea.top, { min: 0, step: 1 }, v => {
        state.params = { ...state.params, safeArea: { ...state.params.safeArea, top: v } }; void ctx.renderStage();
      })
    )));

    safeFields.append(wrapCol(2, createFormGroup("Right",
      createNumberInput(safeArea.right, { min: 0, step: 1 }, v => {
        state.params = { ...state.params, safeArea: { ...state.params.safeArea, right: v } }; void ctx.renderStage();
      })
    )));

    safeFields.append(wrapCol(2, createFormGroup("Bottom",
      createNumberInput(safeArea.bottom, { min: 0, step: 1 }, v => {
        state.params = { ...state.params, safeArea: { ...state.params.safeArea, bottom: v } }; void ctx.renderStage();
      })
    )));

    safeFields.append(wrapCol(2, createFormGroup("Left",
      createNumberInput(safeArea.left, { min: 0, step: 1 }, v => {
        state.params = { ...state.params, safeArea: { ...state.params.safeArea, left: v } }; void ctx.renderStage();
      })
    )));
  }

  const displayFields = document.createElement("div");
  displayFields.className = "bf-grid";

  displayFields.append(wrapCol(4, createCheckboxFormGroup(
    "Fit Safe Area",
    grid.fitWithinSafeArea ?? true,
    (fitWithinSafeArea) => {
      state.params = { ...state.params, grid: { ...state.params.grid, fitWithinSafeArea } };
      syncSafeAreaFields();
      void ctx.renderStage();
    }
  )));

  body.append(displayFields);

  const baselineRow = document.createElement("div");
  baselineRow.className = "bf-grid";

  baselineRow.append(wrapCol(4, createFormGroup("Baseline (px)",
    createNumberInput(grid.baselineStepPx, { min: 1, max: 48, step: 1 }, v => {
      state.params = ctx.normalizeParamsTextFieldOffsets({
        ...state.params,
        grid: { ...state.params.grid, baselineStepPx: v }
      });
      void ctx.renderStage();
    })
  )));
  body.append(baselineRow);

  const rowFields = document.createElement("div");
  rowFields.className = "bf-grid";

  rowFields.append(wrapCol(2, createFormGroup("Rows",
    createNumberInput(grid.rowCount, { min: 1, max: 24, step: 1 }, v => {
      state.params = { ...state.params, grid: { ...state.params.grid, rowCount: v } }; void ctx.renderStage();
    })
  )));

  rowFields.append(wrapCol(2, createFormGroup("Row Gutter (bU)",
    createNumberInput(grid.rowGutterBaselines, { min: 0, max: 48, step: 1 }, v => {
      state.params = { ...state.params, grid: { ...state.params.grid, rowGutterBaselines: v } }; void ctx.renderStage();
    })
  )));
  body.append(rowFields);

  const columnFields = document.createElement("div");
  columnFields.className = "bf-grid";

  columnFields.append(wrapCol(2, createFormGroup("Columns",
    createNumberInput(grid.columnCount, { min: 1, max: 24, step: 1 }, v => {
      state.params = { ...state.params, grid: { ...state.params.grid, columnCount: v } }; void ctx.renderStage();
    })
  )));

  columnFields.append(wrapCol(2, createFormGroup("Col Gutter (bU)",
    createNumberInput(grid.columnGutterBaselines, { min: 0, max: 24, step: 1 }, v => {
      state.params = { ...state.params, grid: { ...state.params.grid, columnGutterBaselines: v } }; void ctx.renderStage();
    })
  )));
  body.append(columnFields);

  body.append(createInspectorHeading("Margins (bU)"));
  const margins = document.createElement("div");
  margins.className = "bf-grid";

  margins.append(wrapCol(2, createFormGroup("Top",
    createNumberInput(grid.marginTopBaselines, { min: 0, max: 48, step: 1 }, v => {
      state.params = { ...state.params, grid: { ...state.params.grid, marginTopBaselines: v } }; void ctx.renderStage();
    })
  )));

  margins.append(wrapCol(2, createFormGroup("Bottom",
    createNumberInput(grid.marginBottomBaselines, { min: 0, max: 48, step: 1 }, v => {
      state.params = { ...state.params, grid: { ...state.params.grid, marginBottomBaselines: v } }; void ctx.renderStage();
    })
  )));

  margins.append(wrapCol(2, createFormGroup("Left",
    createNumberInput(grid.marginLeftBaselines, { min: 0, max: 48, step: 1 }, v => {
      state.params = { ...state.params, grid: { ...state.params.grid, marginLeftBaselines: v } }; void ctx.renderStage();
    })
  )));

  margins.append(wrapCol(2, createFormGroup("Right",
    createNumberInput(grid.marginRightBaselines, { min: 0, max: 48, step: 1 }, v => {
      state.params = { ...state.params, grid: { ...state.params.grid, marginRightBaselines: v } }; void ctx.renderStage();
    })
  )));

  body.append(margins);

  syncSafeAreaFields();
  body.append(safeAreaHeading);
  body.append(safeFields);

  return root;
}
