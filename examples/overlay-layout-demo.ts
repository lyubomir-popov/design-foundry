import type { OperatorGraph } from "@design-foundry/core-types";
import { OperatorRegistry, evaluateGraph } from "@design-foundry/graph-runtime";
import { createOverlayLayoutOperator, OVERLAY_LAYOUT_OPERATOR_KEY } from "@design-foundry/operator-overlay-layout";

const registry = new OperatorRegistry();
registry.register(createOverlayLayoutOperator());

const graph: OperatorGraph = {
  nodes: [
    {
      id: "overlay-layout",
      operatorKey: OVERLAY_LAYOUT_OPERATOR_KEY,
      params: {
        frame: {
          widthPx: 1080,
          heightPx: 1350
        },
        safeArea: {
          top: 48,
          right: 48,
          bottom: 48,
          left: 48
        },
        grid: {
          baselineStepPx: 8,
          rowCount: 12,
          columnCount: 6,
          marginTopBaselines: 6,
          marginBottomBaselines: 6,
          marginLeftBaselines: 5,
          marginRightBaselines: 5,
          rowGutterBaselines: 2,
          columnGutterBaselines: 2,
          fitWithinSafeArea: true
        },
        textStyles: [
          {
            key: "eyebrow",
            fontSizePx: 28,
            lineHeightPx: 32,
            fontWeight: 600
          },
          {
            key: "headline",
            fontSizePx: 58,
            lineHeightPx: 64,
            fontWeight: 700
          },
          {
            key: "body",
            fontSizePx: 24,
            lineHeightPx: 32,
            fontWeight: 400
          }
        ],
        textFields: [
          {
            id: "eyebrow",
            styleKey: "eyebrow",
            text: "Brand Layout Ops",
            keylineIndex: 1,
            rowIndex: 2,
            offsetBaselines: 1,
            columnSpan: 2
          },
          {
            id: "headline",
            styleKey: "headline",
            text: "Deterministic branded layout, resolved from an operator graph.",
            keylineIndex: 1,
            rowIndex: 4,
            offsetBaselines: 1,
            columnSpan: 4
          },
          {
            id: "body",
            styleKey: "body",
            text: "This example exercises the rebuilt overlay layout path without depending on any renderer-specific measurement or drawing code.",
            keylineIndex: 1,
            rowIndex: 8,
            offsetBaselines: 0,
            columnSpan: 3
          }
        ],
        logo: {
          id: "brand-mark",
          xPx: 0,
          yPx: 0,
          widthPx: 132,
          heightPx: 40
        }
      }
    }
  ],
  edges: []
};

const outputs = await evaluateGraph(graph, registry);
const scene = outputs.get("overlay-layout")?.scene;

if (!scene) {
  throw new Error("Overlay layout example did not produce a scene output.");
}

console.log(JSON.stringify(scene, null, 2));