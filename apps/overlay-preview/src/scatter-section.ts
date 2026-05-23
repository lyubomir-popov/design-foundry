/**
 * scatter-section.ts — Schema-driven scatter accordion section.
 *
 * UI generated from OVERLAY_SCATTER_CONFIG_SCHEMA via renderSchemaPanel.
 */

import {
  buildAccordionSectionEl,
  renderSchemaPanel,
  setupAccordion
} from "@brand-layout-ops/parameter-ui";
import {
  OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY,
  OVERLAY_SCATTER_CONFIG_SCHEMA,
  SCATTER_PRESET_DEFINITIONS,
  createDefaultOverlayScatterConfig
} from "@brand-layout-ops/document-model";
import type { PreviewAppContext } from "./preview-app-context.js";
import type { ScatterPreviewConfig } from "./scene-family-preview.js";
import { buildOperatorPresetPicker } from "./operator-preset-picker.js";

export function buildScatterSection(ctx: PreviewAppContext): HTMLElement {
  const { root, body } = buildAccordionSectionEl("Scatter");
  const selectedNode = ctx.getSelectedBackgroundNode();
  const graphNode = selectedNode?.operatorKey === OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY
    ? selectedNode
    : ctx.state.documentProject.backgroundGraph.nodes.find(
        (n) => n.operatorKey === OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY
      );
  const sc = (graphNode?.params ?? createDefaultOverlayScatterConfig()) as ScatterPreviewConfig;

  function update(patch: Partial<ScatterPreviewConfig>) {
    const didUpdate = ctx.updateSelectedBackgroundNode((node) => {
      if (node.operatorKey !== OVERLAY_BACKGROUND_SCATTER_OPERATOR_KEY) {
        return node;
      }

      return {
        ...node,
        params: {
          ...node.params,
          ...patch
        }
      };
    });
    if (!didUpdate) {
      return;
    }

    ctx.markDocumentDirty();
    void ctx.renderStage();
  }

  const presetPicker = buildOperatorPresetPicker(ctx, {
    operatorKey: "scatter",
    operatorLabel: "Scatter",
    builtInPresets: SCATTER_PRESET_DEFINITIONS,
    getCurrentConfig: () => JSON.parse(JSON.stringify(sc)) as Record<string, unknown>,
    applyPresetConfig(config) {
      update(config as Partial<ScatterPreviewConfig>);
    },
    resetToSeed() {
      const seed = createDefaultOverlayScatterConfig(ctx.state.outputProfileKey);
      update(seed as Partial<ScatterPreviewConfig>);
    }
  });

  const result = renderSchemaPanel(
    OVERLAY_SCATTER_CONFIG_SCHEMA,
    sc as unknown as Record<string, unknown>,
    (path, value) => {
      update({ [path]: value } as Partial<ScatterPreviewConfig>);
    }
  );

  const nestedAccordion = document.createElement("aside");
  nestedAccordion.className = "bf-accordion";

  const nestedList = document.createElement("ul");
  nestedList.className = "bf-accordion-list";

  for (const section of result.sections) {
    nestedList.append(section.root);
  }

  nestedAccordion.append(nestedList);
  body.append(presetPicker, nestedAccordion);
  setupAccordion(nestedAccordion);

  return root;
}