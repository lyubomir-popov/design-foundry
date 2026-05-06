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

  const safeFields = document.createElement("div");
  safeFields.className = "bf-grid";

  function syncSafeAreaFields(): void {
    safeFields.replaceChildren();

    if (state.params.grid.fitWithinSafeArea === false) {
      safeFields.hidden = true;
      return;
    }

    safeFields.hidden = false;
    const safeArea = state.params.safeArea;

    safeFields.append(wrapCol(1, createFormGroup("Safe Top",
      createNumberInput(safeArea.top, { min: 0, step: 1 }, v => {
        state.params = { ...state.params, safeArea: { ...state.params.safeArea, top: v } }; void ctx.renderStage();
      })
    )));

    safeFields.append(wrapCol(1, createFormGroup("Safe Right",
      createNumberInput(safeArea.right, { min: 0, step: 1 }, v => {
        state.params = { ...state.params, safeArea: { ...state.params.safeArea, right: v } }; void ctx.renderStage();
      })
    )));

    safeFields.append(wrapCol(1, createFormGroup("Safe Bottom",
      createNumberInput(safeArea.bottom, { min: 0, step: 1 }, v => {
        state.params = { ...state.params, safeArea: { ...state.params.safeArea, bottom: v } }; void ctx.renderStage();
      })
    )));

    safeFields.append(wrapCol(1, createFormGroup("Safe Left",
      createNumberInput(safeArea.left, { min: 0, step: 1 }, v => {
        state.params = { ...state.params, safeArea: { ...state.params.safeArea, left: v } }; void ctx.renderStage();
      })
    )));
  }

  const displayFields = document.createElement("div");
  displayFields.className = "bf-grid";

  displayFields.append(wrapCol(2, createCheckboxFormGroup(
    "Fit Safe Area",
    grid.fitWithinSafeArea ?? true,
    (fitWithinSafeArea) => {
      state.params = { ...state.params, grid: { ...state.params.grid, fitWithinSafeArea } };
      syncSafeAreaFields();
      void ctx.renderStage();
    }
  )));

  body.append(displayFields);

  const fields = document.createElement("div");
  fields.className = "bf-grid";

  fields.append(wrapCol(1, createFormGroup("Baseline (px)",
    createNumberInput(grid.baselineStepPx, { min: 1, max: 48, step: 1 }, v => {
      state.params = ctx.normalizeParamsTextFieldOffsets({
        ...state.params,
        grid: { ...state.params.grid, baselineStepPx: v }
      });
      void ctx.renderStage();
    })
  )));

  fields.append(wrapCol(1, createFormGroup("Rows",
    createNumberInput(grid.rowCount, { min: 1, max: 24, step: 1 }, v => {
      state.params = { ...state.params, grid: { ...state.params.grid, rowCount: v } }; void ctx.renderStage();
    })
  )));

  fields.append(wrapCol(1, createFormGroup("Columns",
    createNumberInput(grid.columnCount, { min: 1, max: 24, step: 1 }, v => {
      state.params = { ...state.params, grid: { ...state.params.grid, columnCount: v } }; void ctx.renderStage();
    })
  )));

  fields.append(wrapCol(1, createFormGroup("Row Gutter",
    createNumberInput(grid.rowGutterBaselines, { min: 0, max: 48, step: 1 }, v => {
      state.params = { ...state.params, grid: { ...state.params.grid, rowGutterBaselines: v } }; void ctx.renderStage();
    })
  )));

  fields.append(wrapCol(1, createFormGroup("Col Gutter",
    createNumberInput(grid.columnGutterBaselines, { min: 0, max: 24, step: 1 }, v => {
      state.params = { ...state.params, grid: { ...state.params.grid, columnGutterBaselines: v } }; void ctx.renderStage();
    })
  )));

  body.append(fields);

  const margins = document.createElement("div");
  margins.className = "bf-grid";

  margins.append(wrapCol(1, createFormGroup("Top Margin",
    createNumberInput(grid.marginTopBaselines, { min: 0, max: 48, step: 1 }, v => {
      state.params = { ...state.params, grid: { ...state.params.grid, marginTopBaselines: v } }; void ctx.renderStage();
    })
  )));

  margins.append(wrapCol(1, createFormGroup("Bottom Margin",
    createNumberInput(grid.marginBottomBaselines, { min: 0, max: 48, step: 1 }, v => {
      state.params = { ...state.params, grid: { ...state.params.grid, marginBottomBaselines: v } }; void ctx.renderStage();
    })
  )));

  margins.append(wrapCol(1, createFormGroup("Left Margin",
    createNumberInput(grid.marginLeftBaselines, { min: 0, max: 48, step: 1 }, v => {
      state.params = { ...state.params, grid: { ...state.params.grid, marginLeftBaselines: v } }; void ctx.renderStage();
    })
  )));

  margins.append(wrapCol(1, createFormGroup("Right Margin",
    createNumberInput(grid.marginRightBaselines, { min: 0, max: 48, step: 1 }, v => {
      state.params = { ...state.params, grid: { ...state.params.grid, marginRightBaselines: v } }; void ctx.renderStage();
    })
  )));

  body.append(margins);

  syncSafeAreaFields();
  body.append(safeFields);

  return root;
}
