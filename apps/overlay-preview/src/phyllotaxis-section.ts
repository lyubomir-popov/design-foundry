/**
 * phyllotaxis-section.ts — Schema-driven phyllotaxis accordion section.
 *
 * Demonstrates the manifest-driven panel path: the UI is generated from
 * OVERLAY_PHYLLOTAXIS_CONFIG_SCHEMA via renderSchemaPanel, not hardcoded DOM.
 */

import {
  buildAccordionSectionEl,
  renderSchemaPanel,
  setupAccordion
} from "@design-foundry/parameter-ui";
import { 
  OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY,
  OVERLAY_PHYLLOTAXIS_CONFIG_SCHEMA,
  createDefaultOverlayPhyllotaxisConfig
} from "@design-foundry/operator-overlay-layout";
import type { PreviewAppContext } from "./preview-app-context.js";
import type { PhyllotaxisPreviewConfig } from "./scene-family-preview.js";

export function buildPhyllotaxisSection(ctx: PreviewAppContext): HTMLElement {
  const { root, body } = buildAccordionSectionEl("Phyllotaxis");
  const selectedNode = ctx.getSelectedBackgroundNode();
  const graphNode = selectedNode?.operatorKey === OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY
    ? selectedNode
    : ctx.state.documentProject.backgroundGraph.nodes.find(
        (n) => n.operatorKey === OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY
      );
  const pc = (graphNode?.params ?? createDefaultOverlayPhyllotaxisConfig()) as PhyllotaxisPreviewConfig;

  function update(patch: Partial<PhyllotaxisPreviewConfig>) {
    const didUpdate = ctx.updateSelectedBackgroundNode((node) => {
      if (node.operatorKey !== OVERLAY_BACKGROUND_PHYLLOTAXIS_OPERATOR_KEY) {
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

  const result = renderSchemaPanel(
    OVERLAY_PHYLLOTAXIS_CONFIG_SCHEMA,
    pc as unknown as Record<string, unknown>,
    (path, value) => {
      update({ [path]: value } as Partial<PhyllotaxisPreviewConfig>);
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
  body.append(nestedAccordion);
  setupAccordion(nestedAccordion);

  return root;
}