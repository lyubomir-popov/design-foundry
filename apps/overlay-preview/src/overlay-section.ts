/**
 * overlay-section.ts — Overlay layer accordion section builder.
 */
import {
  getOverlayStyleDisplayLabel
} from "@design-foundry/operator-overlay-layout";
import {
  buildAccordionSectionEl,
  createCheckboxFormGroup,
  createFormGroup,
  createNumberInput,
  wrapCol
} from "@design-foundry/parameter-ui";
import type { PreviewAppContext } from "./preview-app-context.js";

function findOverlayFieldInput(sectionRoot: ParentNode, label: string): HTMLInputElement | HTMLTextAreaElement | null {
  const fields = Array.from(sectionRoot.querySelectorAll<HTMLElement>(".bf-field"));
  for (const field of fields) {
    const fieldLabel = field.querySelector<HTMLElement>(".bf-form-label");
    if (fieldLabel?.textContent?.trim() !== label) {
      continue;
    }

    return field.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
  }

  return null;
}

function setOverlayFieldInputValue(sectionRoot: ParentNode, label: string, value: string | number): void {
  const input = findOverlayFieldInput(sectionRoot, label);
  if (!input) {
    return;
  }

  input.value = String(value);
}

export function syncOverlaySectionInputs(sectionRoot: ParentNode, ctx: PreviewAppContext): void {
  const { state } = ctx;

  if (!state.selected) {
    return;
  }

  if (state.selected.kind === "text") {
    const field = ctx.getSelectedTextField();
    if (!field) {
      return;
    }

    const style = state.params.textStyles.find((entry) => entry.key === field.styleKey);
    if (style) {
      setOverlayFieldInputValue(sectionRoot, "Font Size", style.fontSizePx);
      setOverlayFieldInputValue(sectionRoot, "Line Height", style.lineHeightPx);
      setOverlayFieldInputValue(sectionRoot, "Weight", style.fontWeight ?? 400);
    }

    setOverlayFieldInputValue(sectionRoot, "Keyline", field.keylineIndex);
    setOverlayFieldInputValue(sectionRoot, "Row", field.rowIndex);
    setOverlayFieldInputValue(sectionRoot, "Y Offset", ctx.getDisplayedTextFieldOffsetBaselines(field));
    setOverlayFieldInputValue(sectionRoot, "Span", field.columnSpan);
    return;
  }

  const logo = state.params.logo;
  if (!logo) {
    return;
  }

  setOverlayFieldInputValue(sectionRoot, "X", logo.xPx);
  setOverlayFieldInputValue(sectionRoot, "Y", logo.yPx);
  setOverlayFieldInputValue(sectionRoot, "Width", logo.widthPx);
  setOverlayFieldInputValue(sectionRoot, "Height", logo.heightPx);

  const widthInput = findOverlayFieldInput(sectionRoot, "Width");
  if (widthInput instanceof HTMLInputElement) {
    widthInput.title = logo.linkTitleSizeToHeight === false
      ? "Width preserves the logo aspect ratio."
      : "Derived from the locked A Head to logo scale.";
  }
}

export function buildOverlaySection(ctx: PreviewAppContext): HTMLElement {
  const { root, body } = buildAccordionSectionEl(ctx.getSelectedOverlaySectionTitle());
  const { state } = ctx;

  if (!state.selected) {
    const overlayActions = ctx.createOverlayItemActionRow({ showAdd: true, showDelete: false });
    if (overlayActions) {
      body.append(overlayActions);
    }
    return root;
  }

  if (state.selected.kind === "text") {
    const field = ctx.getSelectedTextField();
    if (!field) return root;
    const fieldId = field.id;
    let styleSelect: HTMLSelectElement | null = null;
    let fontSizeInput: HTMLInputElement | null = null;
    let lineHeightInput: HTMLInputElement | null = null;
    let fontWeightInput: HTMLInputElement | null = null;

    function getCurrentSelectedStyle() {
      const currentField = state.params.textFields.find((candidate) => candidate.id === fieldId);
      if (!currentField) {
        return null;
      }

      return state.params.textStyles.find((style) => style.key === currentField.styleKey) ?? null;
    }

    function syncStyleSelection(): void {
      const activeStyleKey = getCurrentSelectedStyle()?.key;
      if (styleSelect && activeStyleKey) {
        styleSelect.value = activeStyleKey;
      }
    }

    function syncSelectedStyleInputs(): void {
      const currentStyle = getCurrentSelectedStyle();
      if (!currentStyle) {
        return;
      }

      if (fontSizeInput) {
        fontSizeInput.value = String(currentStyle.fontSizePx);
      }
      if (lineHeightInput) {
        lineHeightInput.value = String(currentStyle.lineHeightPx);
      }
      if (fontWeightInput) {
        fontWeightInput.value = String(currentStyle.fontWeight ?? 400);
      }
    }

    function syncTextStyleUi(): void {
      syncStyleSelection();
      syncSelectedStyleInputs();
    }

    if (ctx.getContentSource() === "inline") {
      const textarea = document.createElement("textarea");
      textarea.className = "bf-input is-dense is-inline-text-control";
      textarea.rows = 3;
      textarea.value = ctx.getResolvedTextFieldText(field);
      textarea.addEventListener("input", () => {
        ctx.updateSelectedTextValue(field.id, textarea.value);
        void ctx.renderStage();
      });
      body.append(createFormGroup("Text", textarea));
    } else {
      const csvNote = document.createElement("p");
      csvNote.className = "bf-form-help is-tight bf-u-no-margin--bottom";
      csvNote.textContent = ctx.hasStagedCsvDraft()
        ? "CSV-backed field. Staged CSV edits are pending for the active row."
        : "CSV-backed field. Text comes from the active CSV row.";
      body.append(csvNote);
    }

    styleSelect = document.createElement("select");
    styleSelect.className = "bf-input is-dense";
    for (const style of state.params.textStyles) {
      const option = document.createElement("option");
      option.value = style.key;
      option.textContent = getOverlayStyleDisplayLabel(style.key);
      option.selected = field.styleKey === style.key;
      styleSelect.append(option);
    }
    styleSelect.addEventListener("change", () => {
      ctx.applySelectedTextStyle(styleSelect?.value ?? "");
      syncTextStyleUi();
    });
    body.append(createFormGroup("Paragraph Style", styleSelect));

    const selectedStyle = getCurrentSelectedStyle();
    if (selectedStyle) {
      const styleGrid = document.createElement("div");
      styleGrid.className = "bf-grid is-overlay-style-grid";

      fontSizeInput = createNumberInput(selectedStyle.fontSizePx, { min: 1, max: 512, step: 1 }, (value) => {
        const currentStyle = getCurrentSelectedStyle();
        if (!currentStyle) {
          return;
        }

        ctx.updateTextStyle(currentStyle.key, (style) => ({ ...style, fontSizePx: value }));
        if (currentStyle.key === "title" && state.params.logo?.linkTitleSizeToHeight !== false) {
          ctx.syncLogoToTitleFontSize(value);
        }
        ctx.markDocumentDirty();
        syncTextStyleUi();
        void ctx.renderStage();
      });

      styleGrid.append(wrapCol(1, createFormGroup("Font Size",
        fontSizeInput
      )));

      lineHeightInput = createNumberInput(selectedStyle.lineHeightPx, { min: 1, max: 512, step: 1 }, (value) => {
        const currentStyle = getCurrentSelectedStyle();
        if (!currentStyle) {
          return;
        }

        ctx.updateTextStyle(currentStyle.key, (style) => ({ ...style, lineHeightPx: value }));
        ctx.markDocumentDirty();
        syncTextStyleUi();
        void ctx.renderStage();
      });

      styleGrid.append(wrapCol(1, createFormGroup("Line Height",
        lineHeightInput
      )));

      fontWeightInput = createNumberInput(selectedStyle.fontWeight ?? 400, { min: 100, max: 900, step: 100 }, (value) => {
        const currentStyle = getCurrentSelectedStyle();
        if (!currentStyle) {
          return;
        }

        ctx.updateTextStyle(currentStyle.key, (style) => ({ ...style, fontWeight: value }));
        ctx.markDocumentDirty();
        syncTextStyleUi();
        void ctx.renderStage();
      });

      styleGrid.append(wrapCol(1, createFormGroup("Weight",
        fontWeightInput
      )));

      body.append(styleGrid);
      syncTextStyleUi();
    }

    const grid = document.createElement("div");
    grid.className = "bf-grid is-overlay-placement-grid";

    grid.append(wrapCol(1, createFormGroup("Keyline",
      createNumberInput(field.keylineIndex, { min: 1, max: 24, step: 1 }, v => {
        ctx.updateTextField(field.id, f => ({ ...f, keylineIndex: v })); ctx.markDocumentDirty(); void ctx.renderStage();
      })
    )));

    grid.append(wrapCol(1, createFormGroup("Row",
      createNumberInput(field.rowIndex, { min: 1, max: 24, step: 1 }, v => {
        ctx.updateTextField(field.id, f => ({ ...f, rowIndex: v })); ctx.markDocumentDirty(); void ctx.renderStage();
      })
    )));

    grid.append(wrapCol(1, createFormGroup("Y Offset",
      createNumberInput(ctx.getDisplayedTextFieldOffsetBaselines(field), { min: -200, max: 500, step: 1 }, v => {
        ctx.updateTextField(field.id, f => ({ ...f, offsetBaselines: v })); ctx.markDocumentDirty(); void ctx.renderStage();
      })
    )));

    grid.append(wrapCol(1, createFormGroup("Span",
      createNumberInput(field.columnSpan, { min: 1, max: 24, step: 1 }, v => {
        ctx.updateTextField(field.id, f => ({ ...f, columnSpan: v })); ctx.markDocumentDirty(); void ctx.renderStage();
      })
    )));

    body.append(grid);
  }

  if (state.selected.kind === "logo") {
    const logo = state.params.logo;
    if (!logo) return root;

    let widthInput: HTMLInputElement | null = null;
    let heightInput: HTMLInputElement | null = null;

    function syncLogoControls(): void {
      const currentLogo = state.params.logo;
      if (!currentLogo) {
        return;
      }

      assetInput.value = currentLogo.assetPath ?? "";

      if (widthInput) {
        widthInput.value = String(currentLogo.widthPx);
        widthInput.title = currentLogo.linkTitleSizeToHeight === false
          ? "Width preserves the logo aspect ratio."
          : "Derived from the locked A Head to logo scale.";
      }

      if (heightInput) {
        heightInput.value = String(currentLogo.heightPx);
      }
    }

    const assetInput = document.createElement("input");
    assetInput.className = "bf-input is-dense";
    assetInput.type = "text";
    assetInput.value = logo.assetPath ?? "";
    assetInput.placeholder = "/assets/UbuntuTagLogo.svg";
    assetInput.addEventListener("change", () => {
      const nextAssetPath = assetInput.value.trim();
      ctx.updateLogo((currentLogo) => {
        const nextLogo = { ...currentLogo };
        if (nextAssetPath) {
          nextLogo.assetPath = nextAssetPath;
        } else {
          delete nextLogo.assetPath;
        }
        return nextLogo;
      });
      ctx.markDocumentDirty();
      void ctx.loadLogoIntrinsicDimensions(nextAssetPath);
      syncLogoControls();
      void ctx.renderStage();
    });
    const logoMetaFields = document.createElement("div");
    logoMetaFields.className = "bf-grid";

    logoMetaFields.append(wrapCol(2, createFormGroup("Asset Path", assetInput)));
    logoMetaFields.append(wrapCol(2, createCheckboxFormGroup(
      "Lock A Head to Logo",
      logo.linkTitleSizeToHeight !== false,
      (checked) => {
        ctx.updateLogo((currentLogo) => ({
          ...currentLogo,
          linkTitleSizeToHeight: checked
        }));
        if (checked) {
          const titleStyle = state.params.textStyles.find((style) => style.key === "title");
          if (titleStyle) {
            ctx.syncLogoToTitleFontSize(titleStyle.fontSizePx);
          }
        }
        ctx.markDocumentDirty();
        syncLogoControls();
        void ctx.renderStage();
      }
    )));

    body.append(logoMetaFields);

    const grid = document.createElement("div");
    grid.className = "bf-grid is-overlay-logo-grid";

    grid.append(wrapCol(1, createFormGroup("X",
      createNumberInput(logo.xPx, { step: 1 }, v => { ctx.updateLogo(l => ({ ...l, xPx: v })); ctx.markDocumentDirty(); void ctx.renderStage(); })
    )));

    grid.append(wrapCol(1, createFormGroup("Y",
      createNumberInput(logo.yPx, { step: 1 }, v => { ctx.updateLogo(l => ({ ...l, yPx: v })); ctx.markDocumentDirty(); void ctx.renderStage(); })
    )));

    widthInput = createNumberInput(logo.widthPx, { min: 1, step: 1 }, v => {
      const currentLogo = state.params.logo;
      if (!currentLogo) {
        return;
      }

      const aspectRatio = currentLogo.widthPx > 0 && currentLogo.heightPx > 0
        ? currentLogo.widthPx / currentLogo.heightPx
        : ctx.getCurrentLogoAspectRatio();
      const nextHeightPx = Math.max(1, Math.round(v / Math.max(0.0001, aspectRatio)));
      if (currentLogo.linkTitleSizeToHeight === false) {
        ctx.updateLogoSizeWithAspectRatio(nextHeightPx);
      } else {
        ctx.syncTitleToLogoHeight(nextHeightPx);
      }
      ctx.markDocumentDirty();
      syncLogoControls();
      void ctx.renderStage();
    });

    grid.append(wrapCol(1, createFormGroup("Width",
      widthInput
    )));

    heightInput = createNumberInput(logo.heightPx, { min: 1, step: 1 }, v => {
      const currentLogo = state.params.logo;
      if (!currentLogo) {
        return;
      }

      if (currentLogo.linkTitleSizeToHeight === false) {
        ctx.updateLogoSizeWithAspectRatio(v);
      } else {
        ctx.syncTitleToLogoHeight(v);
      }
      ctx.markDocumentDirty();
      syncLogoControls();
      void ctx.renderStage();
    });

    grid.append(wrapCol(1, createFormGroup("Height",
      heightInput
    )));

    syncLogoControls();

    body.append(grid);
  }

  return root;
}
