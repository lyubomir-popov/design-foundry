/**
 * overlay-editing-controller.ts — Selected-element text and logo editing.
 *
 * Owns text-field CRUD, style updates, linked logo-title sizing, and the
 * overlay-layer action row so main.ts stays focused on composition.
 */

import type {
  LogoPlacementSpec,
  TextFieldPlacementSpec,
  TextStyleSpec
} from "@brand-layout-ops/core-types";
import { getLinkedLogoDimensionsPx, getLinkedTitleFontSizePx } from "@brand-layout-ops/layout-engine";
import {
  getOverlayMainHeadingField,
  normalizeOverlayTextFieldOffsetBaselines,
  setOverlayTextValue,
  type OverlayLayoutOperatorParams
} from "@brand-layout-ops/document-model";

import type {
  PreviewState,
  Selection
} from "./preview-app-context.js";

export interface OverlayEditingControllerDeps {
  readonly state: PreviewState;
  normalizeParamsTextFieldOffsets(params: OverlayLayoutOperatorParams): OverlayLayoutOperatorParams;
  markDocumentDirty(): void;
  buildConfigEditor(): void;
  renderStage(): Promise<void>;
  select(sel: Selection | null): void;
  getLogoIntrinsicDimensions(): { width: number; height: number };
}

export interface OverlayEditingController {
  updateSelectedTextValue(id: string, value: string): void;
  getDisplayedTextFieldOffsetBaselines(field: TextFieldPlacementSpec): number;
  updateTextField(id: string, updater: (field: TextFieldPlacementSpec) => TextFieldPlacementSpec): void;
  updateTextStyle(key: string, updater: (style: TextStyleSpec) => TextStyleSpec): void;
  updateLogo(updater: (logo: LogoPlacementSpec) => LogoPlacementSpec): void;
  getCurrentLogoAspectRatio(): number;
  syncLogoToTitleFontSize(titleFontSizePx: number): void;
  syncTitleToLogoHeight(logoHeightPx: number): void;
  updateLogoSizeWithAspectRatio(nextHeightPx: number): void;
  getSelectedOverlaySectionTitle(): string;
  getSelectedTextField(): TextFieldPlacementSpec | null;
  applySelectedTextStyle(styleKey: string): void;
  deleteSelectedOverlayItem(): boolean;
  createOverlayItemActionRow(options?: {
    showAdd?: boolean;
    showDelete?: boolean;
  }): HTMLElement | null;
}

export function createOverlayEditingController(deps: OverlayEditingControllerDeps): OverlayEditingController {
  const { state } = deps;

  function refreshOverlayEditingUi(): void {
    deps.buildConfigEditor();
    void deps.renderStage();
  }

  function updateSelectedTextValue(id: string, value: string): void {
    state.params = setOverlayTextValue(state.params, id, value);
    deps.markDocumentDirty();
  }

  function getDisplayedTextFieldOffsetBaselines(field: TextFieldPlacementSpec): number {
    return normalizeOverlayTextFieldOffsetBaselines(field).offsetBaselines;
  }

  function updateTextField(
    id: string,
    updater: (field: TextFieldPlacementSpec) => TextFieldPlacementSpec
  ): void {
    state.params = deps.normalizeParamsTextFieldOffsets({
      ...state.params,
      textFields: state.params.textFields.map((field) => (field.id === id ? updater(field) : field))
    });
  }

  function updateTextStyle(key: string, updater: (style: TextStyleSpec) => TextStyleSpec): void {
    state.params = deps.normalizeParamsTextFieldOffsets({
      ...state.params,
      textStyles: state.params.textStyles.map((style) => (style.key === key ? updater(style) : style))
    });
  }

  function updateLogo(updater: (logo: LogoPlacementSpec) => LogoPlacementSpec): void {
    if (!state.params.logo) {
      return;
    }

    state.params = { ...state.params, logo: updater(state.params.logo) };
  }

  function getCurrentLogoAspectRatio(): number {
    const intrinsic = deps.getLogoIntrinsicDimensions();
    if (intrinsic.width > 0 && intrinsic.height > 0) {
      return intrinsic.width / intrinsic.height;
    }

    const logo = state.params.logo;
    if (!logo || logo.heightPx <= 0 || logo.widthPx <= 0) {
      return 63 / 108;
    }

    return logo.widthPx / logo.heightPx;
  }

  function syncLogoToTitleFontSize(titleFontSizePx: number): void {
    const aspectRatio = getCurrentLogoAspectRatio();
    const linkedDimensions = getLinkedLogoDimensionsPx(titleFontSizePx, aspectRatio);
    updateLogo((logo) => ({
      ...logo,
      widthPx: linkedDimensions.widthPx,
      heightPx: linkedDimensions.heightPx
    }));
  }

  function syncTitleToLogoHeight(logoHeightPx: number): void {
    const linkedFontSize = getLinkedTitleFontSizePx(logoHeightPx);
    updateTextStyle("title", (style) => ({ ...style, fontSizePx: linkedFontSize }));
    syncLogoToTitleFontSize(linkedFontSize);
  }

  function updateLogoSizeWithAspectRatio(nextHeightPx: number): void {
    const aspectRatio = getCurrentLogoAspectRatio();
    updateLogo((logo) => ({
      ...logo,
      widthPx: Math.max(1, Math.round(nextHeightPx * Math.max(0.0001, aspectRatio))),
      heightPx: Math.max(1, Math.round(nextHeightPx))
    }));
  }

  function getSelectedOverlaySectionTitle(): string {
    if (!state.selected) {
      return "Overlay Layout";
    }

    return state.selected.kind === "logo"
      ? "Logo"
      : "Text";
  }

  function getSelectedTextField(): TextFieldPlacementSpec | null {
    if (state.selected?.kind !== "text") {
      return null;
    }

    return state.params.textFields.find((field) => field.id === state.selected?.id) ?? null;
  }

  function applySelectedTextStyle(styleKey: string): void {
    const selectedField = getSelectedTextField();
    if (!selectedField || selectedField.styleKey === styleKey) {
      return;
    }

    updateTextField(selectedField.id, (field) => ({ ...field, styleKey }));
    deps.markDocumentDirty();
    void deps.renderStage();
  }

  function createTextFieldId(): string {
    let index = state.params.textFields.length + 1;
    let candidate = `text_field_${index}`;

    while (state.params.textFields.some((field) => field.id === candidate)) {
      index += 1;
      candidate = `text_field_${index}`;
    }

    return candidate;
  }

  function addTextField(): void {
    const selectedField = state.selected?.kind === "text"
      ? state.params.textFields.find((field) => field.id === state.selected?.id)
      : undefined;
    const anchorField = selectedField ?? getOverlayMainHeadingField(state.params) ?? state.params.textFields[0];
    const nextId = createTextFieldId();
    const nextField: TextFieldPlacementSpec = {
      id: nextId,
      contentFieldId: nextId,
      styleKey: "paragraph",
      text: "New text",
      keylineIndex: anchorField?.keylineIndex ?? 3,
      rowIndex: Math.max(1, Math.min(24, (anchorField?.rowIndex ?? 1) + 1)),
      offsetBaselines: anchorField?.offsetBaselines ?? 0,
      columnSpan: anchorField?.columnSpan ?? 1
    };

    state.params = deps.normalizeParamsTextFieldOffsets({
      ...state.params,
      textFields: [...state.params.textFields, nextField],
      inlineTextByFieldId: {
        ...state.params.inlineTextByFieldId,
        [nextField.id]: nextField.text,
        [nextId]: nextField.text
      }
    });

    state.selected = { kind: "text", id: nextField.id };
    deps.markDocumentDirty();
  }

  function canDeleteSelectedText(): boolean {
    return state.selected?.kind === "text" && state.selected.id !== "main_heading";
  }

  function deleteSelectedTextField(): void {
    if (!canDeleteSelectedText()) {
      return;
    }

    const selectedId = state.selected?.id;
    if (!selectedId) {
      return;
    }

    const deletedField = state.params.textFields.find((field) => field.id === selectedId);
    const remainingFields = state.params.textFields.filter((field) => field.id !== selectedId);
    const nextInlineText = { ...(state.params.inlineTextByFieldId ?? {}) };
    delete nextInlineText[selectedId];
    if (deletedField?.contentFieldId) {
      delete nextInlineText[deletedField.contentFieldId];
    }

    state.params = {
      ...state.params,
      textFields: remainingFields,
      inlineTextByFieldId: nextInlineText
    };
    state.selected = null;
    deps.markDocumentDirty();
  }

  function deleteSelectedOverlayItem(): boolean {
    if (!canDeleteSelectedText()) {
      return false;
    }

    deleteSelectedTextField();
    return true;
  }

  function createOverlayItemActionRow(options?: {
    showAdd?: boolean;
    showDelete?: boolean;
  }): HTMLElement | null {
    const showAdd = options?.showAdd ?? true;
    const showDelete = options?.showDelete ?? false;
    const canDelete = canDeleteSelectedText();

    if (!showAdd && !(showDelete && canDelete)) {
      return null;
    }

    const actions = document.createElement("div");
    actions.className = "bf-cluster is-tight-cluster";

    if (showAdd) {
      const addButton = document.createElement("button");
      addButton.className = "bf-button is-dense";
      addButton.type = "button";
      addButton.textContent = "Add Text";
      addButton.addEventListener("click", () => {
        addTextField();
        refreshOverlayEditingUi();
      });
      actions.append(addButton);
    }

    if (showDelete && canDelete) {
      const deleteButton = document.createElement("button");
      deleteButton.className = "bf-button is-dense";
      deleteButton.type = "button";
      deleteButton.textContent = "Delete Text";
      deleteButton.addEventListener("click", () => {
        if (!deleteSelectedOverlayItem()) {
          return;
        }

        refreshOverlayEditingUi();
      });
      actions.append(deleteButton);
    }

    return actions;
  }

  return {
    updateSelectedTextValue,
    getDisplayedTextFieldOffsetBaselines,
    updateTextField,
    updateTextStyle,
    updateLogo,
    getCurrentLogoAspectRatio,
    syncLogoToTitleFontSize,
    syncTitleToLogoHeight,
    updateLogoSizeWithAspectRatio,
    getSelectedOverlaySectionTitle,
    getSelectedTextField,
    applySelectedTextStyle,
    deleteSelectedOverlayItem,
    createOverlayItemActionRow
  };
}