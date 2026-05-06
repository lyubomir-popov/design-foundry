/**
 * overlay-section.ts — Overlay layer accordion section builder.
 */
import {
  getOverlayFieldDisplayLabel,
  getOverlayStyleDisplayLabel
} from "@brand-layout-ops/operator-overlay-layout";
import {
  buildAccordionSectionEl,
  createCheckboxFormGroup,
  createFormGroup,
  createNumberInput,
  createReadonlySpan,
  wrapCol
} from "@brand-layout-ops/parameter-ui";
import type { PreviewAppContext } from "./preview-app-context.js";

export function buildOverlaySection(ctx: PreviewAppContext): HTMLElement {
  const { root, body } = buildAccordionSectionEl(ctx.getSelectedOverlaySectionTitle());
  const { state } = ctx;

  body.append(ctx.createOverlayItemActionRow());

  if (!state.selected) {
    const p = document.createElement("p");
    p.className = "bf-form-help";
    p.textContent = "Overlay Layout is selected. Add text here, or pick a text or logo layer from the Layers palette to edit its parameters.";
    body.append(p);
    return root;
  }

  if (state.selected.kind === "text") {
    const field = ctx.getSelectedTextField();
    if (!field) return root;
    const selectedStyle = state.params.textStyles.find((style) => style.key === field.styleKey);
    const styleMetaByKey = new Map<string, HTMLElement>();

    function syncStylePaletteMeta(): void {
      for (const style of state.params.textStyles) {
        const meta = styleMetaByKey.get(style.key);
        if (!meta) {
          continue;
        }

        meta.textContent = `${style.fontSizePx}px / ${style.lineHeightPx}px / ${style.fontWeight ?? 400}`;
      }
    }

    const metadataFields = document.createElement("div");
    metadataFields.className = "bf-grid";

    metadataFields.append(wrapCol(2, createFormGroup("Label", createReadonlySpan(getOverlayFieldDisplayLabel(state.params, field.id)))));
    metadataFields.append(wrapCol(2, createFormGroup("ID", createReadonlySpan(field.id))));

    body.append(metadataFields);

    if (ctx.getContentSource() === "inline") {
      const textarea = document.createElement("textarea");
      textarea.className = "bf-input is-dense is-inline-text-control";
      textarea.rows = 3;
      textarea.value = ctx.getResolvedTextFieldText(field);
      textarea.addEventListener("input", () => {
        ctx.updateSelectedTextValue(field.id, textarea.value);
        void ctx.renderStage();
      });
      body.append(createFormGroup(`${getOverlayFieldDisplayLabel(state.params, field.id)} Text`, textarea));
    } else {
      const csvNote = document.createElement("p");
      csvNote.className = "bf-form-help is-tight bf-u-no-margin--bottom";
      csvNote.textContent = ctx.hasStagedCsvDraft()
        ? "CSV-backed field. Staged CSV edits are pending for the active row."
        : "CSV-backed field. Text comes from the active CSV row.";
      body.append(csvNote);
    }

    const styleHelper = document.createElement("p");
    styleHelper.className = "bf-form-help is-tight bf-u-no-margin--bottom";
    styleHelper.textContent = `Apply a paragraph style to ${getOverlayFieldDisplayLabel(state.params, field.id)}.`;
    body.append(styleHelper);

    const stylePalette = document.createElement("div");
    stylePalette.className = "bf-option-grid";

    for (const style of state.params.textStyles) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bf-option-card";
      button.disabled = field.styleKey === style.key;
      if (field.styleKey === style.key) {
        button.classList.add("is-active");
      }
      button.addEventListener("click", () => {
        ctx.applySelectedTextStyle(style.key);
      });

      const label = document.createElement("span");
      label.className = "bf-option-card-label";
      label.textContent = getOverlayStyleDisplayLabel(style.key);

      const meta = document.createElement("span");
      meta.className = "bf-option-card-meta";
      meta.textContent = `${style.fontSizePx}px / ${style.lineHeightPx}px / ${style.fontWeight ?? 400}`;
      styleMetaByKey.set(style.key, meta);

      button.append(label, meta);
      stylePalette.append(button);
    }

    body.append(stylePalette);

    if (selectedStyle) {
      const styleGrid = document.createElement("div");
      styleGrid.className = "bf-grid";

      styleGrid.append(wrapCol(1, createFormGroup("Font Size",
        createNumberInput(selectedStyle.fontSizePx, { min: 1, max: 512, step: 1 }, (value) => {
          ctx.updateTextStyle(selectedStyle.key, (style) => ({ ...style, fontSizePx: value }));
          if (selectedStyle.key === "title" && state.params.logo?.linkTitleSizeToHeight !== false) {
            ctx.syncLogoToTitleFontSize(value);
          }
          ctx.markDocumentDirty();
          syncStylePaletteMeta();
          void ctx.renderStage();
        })
      )));

      styleGrid.append(wrapCol(1, createFormGroup("Line Height",
        createNumberInput(selectedStyle.lineHeightPx, { min: 1, max: 512, step: 1 }, (value) => {
          ctx.updateTextStyle(selectedStyle.key, (style) => ({ ...style, lineHeightPx: value }));
          ctx.markDocumentDirty();
          syncStylePaletteMeta();
          void ctx.renderStage();
        })
      )));

      styleGrid.append(wrapCol(1, createFormGroup("Weight",
        createNumberInput(selectedStyle.fontWeight ?? 400, { min: 100, max: 900, step: 100 }, (value) => {
          ctx.updateTextStyle(selectedStyle.key, (style) => ({ ...style, fontWeight: value }));
          ctx.markDocumentDirty();
          syncStylePaletteMeta();
          void ctx.renderStage();
        })
      )));

      body.append(styleGrid);
    }

    const grid = document.createElement("div");
    grid.className = "bf-grid";

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
      ctx.buildConfigEditor();
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
        ctx.buildConfigEditor();
        void ctx.renderStage();
      }
    )));

    body.append(logoMetaFields);

    const grid = document.createElement("div");
    grid.className = "bf-grid";

    grid.append(wrapCol(1, createFormGroup("X",
      createNumberInput(logo.xPx, { step: 1 }, v => { ctx.updateLogo(l => ({ ...l, xPx: v })); ctx.markDocumentDirty(); void ctx.renderStage(); })
    )));

    grid.append(wrapCol(1, createFormGroup("Y",
      createNumberInput(logo.yPx, { step: 1 }, v => { ctx.updateLogo(l => ({ ...l, yPx: v })); ctx.markDocumentDirty(); void ctx.renderStage(); })
    )));

    const widthInput = createNumberInput(logo.widthPx, { min: 1, step: 1 }, v => {
      const aspectRatio = logo.widthPx > 0 && logo.heightPx > 0 ? logo.widthPx / logo.heightPx : ctx.getCurrentLogoAspectRatio();
      const nextHeightPx = Math.max(1, Math.round(v / Math.max(0.0001, aspectRatio)));
      if (logo.linkTitleSizeToHeight === false) {
        ctx.updateLogoSizeWithAspectRatio(nextHeightPx);
      } else {
        ctx.syncTitleToLogoHeight(nextHeightPx);
      }
      ctx.markDocumentDirty();
      void ctx.renderStage();
    });
    widthInput.title = logo.linkTitleSizeToHeight === false
      ? "Width preserves the logo aspect ratio."
      : "Derived from the locked A Head to logo scale.";

    grid.append(wrapCol(1, createFormGroup("Width",
      widthInput
    )));

    grid.append(wrapCol(1, createFormGroup("Height",
      createNumberInput(logo.heightPx, { min: 1, step: 1 }, v => {
        if (logo.linkTitleSizeToHeight === false) {
          ctx.updateLogoSizeWithAspectRatio(v);
        } else {
          ctx.syncTitleToLogoHeight(v);
        }
        ctx.markDocumentDirty();
        void ctx.renderStage();
      })
    )));

    body.append(grid);
  }

  return root;
}
