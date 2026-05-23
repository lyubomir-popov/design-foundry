/**
 * fuzzy-boids-section.ts — Schema-driven fuzzy-boids accordion section.
 *
 * UI generated from OVERLAY_FUZZY_BOIDS_CONFIG_SCHEMA via renderSchemaPanel.
 */

import type { PreviewAppContext } from "./preview-app-context.js";
import type { FuzzyBoidsPreviewConfig } from "./scene-family-preview.js";
import {
  FUZZY_BOIDS_PRESET_DEFINITIONS,
  OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY,
  OVERLAY_FUZZY_BOIDS_CONFIG_SCHEMA,
  createDefaultOverlayFuzzyBoidsConfig
} from "@brand-layout-ops/document-model";
import {
  buildAccordionSectionEl,
  renderSchemaPanel,
  setupAccordion
} from "@brand-layout-ops/parameter-ui";
import { buildOperatorPresetPicker } from "./operator-preset-picker.js";

export function buildFuzzyBoidsSection(ctx: PreviewAppContext): HTMLElement {
  const { state } = ctx;
  const { root, body } = buildAccordionSectionEl("Fuzzy Boids");
  const selectedNode = ctx.getSelectedBackgroundNode();
  const graphNode = selectedNode?.operatorKey === OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY
    ? selectedNode
    : state.documentProject.backgroundGraph.nodes.find(
        (n) => n.operatorKey === OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY
      );
  const bc = (graphNode?.params ?? createDefaultOverlayFuzzyBoidsConfig()) as FuzzyBoidsPreviewConfig;

  function update(patch: Partial<FuzzyBoidsPreviewConfig>) {
    const didUpdate = ctx.updateSelectedBackgroundNode((node) => {
      if (node.operatorKey !== OVERLAY_BACKGROUND_FUZZY_BOIDS_OPERATOR_KEY) {
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
    operatorKey: "fuzzy_boids",
    operatorLabel: "Fuzzy Boids",
    builtInPresets: FUZZY_BOIDS_PRESET_DEFINITIONS,
    getCurrentConfig: () => JSON.parse(JSON.stringify(bc)) as Record<string, unknown>,
    applyPresetConfig(config) {
      update(config as Partial<FuzzyBoidsPreviewConfig>);
    },
    resetToSeed() {
      const seed = createDefaultOverlayFuzzyBoidsConfig(state.outputProfileKey);
      update(seed as Partial<FuzzyBoidsPreviewConfig>);
    }
  });

  const result = renderSchemaPanel(
    OVERLAY_FUZZY_BOIDS_CONFIG_SCHEMA,
    bc as unknown as Record<string, unknown>,
    (path, value) => {
      update({ [path]: value } as Partial<FuzzyBoidsPreviewConfig>);
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
