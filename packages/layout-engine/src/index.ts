import {
  LINKED_LOGO_BASE_HEIGHT_PX,
  LINKED_LOGO_BASE_WIDTH_PX,
  LINKED_TITLE_BASE_FONT_SIZE_PX,
  type FrameSize,
  type GridSettings,
  type LayerScene,
  type LogoPlacement,
  type LogoPlacementSpec,
  type SafeAreaInsets,
  type TextFieldPlacementSpec,
  type TextMeasurer,
  type TextStyleSpec
} from "@design-foundry/core-types";
import { computeLayoutGridMetrics } from "@design-foundry/layout-grid";
import { resolveTextPlacement } from "@design-foundry/layout-text";

export function getLinkedTitleFontSizePx(
  logoHeightPx: number,
  baseFontSizePx: number = LINKED_TITLE_BASE_FONT_SIZE_PX,
  baseLogoHeightPx: number = LINKED_LOGO_BASE_HEIGHT_PX
): number {
  if (logoHeightPx <= 0 || baseFontSizePx <= 0 || baseLogoHeightPx <= 0) {
    return Math.round(baseFontSizePx);
  }

  return Math.round(baseFontSizePx * (logoHeightPx / baseLogoHeightPx));
}

export function getLinkedLogoHeightPx(
  titleFontSizePx: number,
  baseFontSizePx: number = LINKED_TITLE_BASE_FONT_SIZE_PX,
  baseLogoHeightPx: number = LINKED_LOGO_BASE_HEIGHT_PX
): number {
  if (titleFontSizePx <= 0 || baseFontSizePx <= 0 || baseLogoHeightPx <= 0) {
    return Math.round(baseLogoHeightPx);
  }

  return Math.round(baseLogoHeightPx * (titleFontSizePx / baseFontSizePx));
}

export function getLinkedLogoDimensionsPx(
  titleFontSizePx: number,
  aspectRatio: number = LINKED_LOGO_BASE_WIDTH_PX / LINKED_LOGO_BASE_HEIGHT_PX,
  baseFontSizePx: number = LINKED_TITLE_BASE_FONT_SIZE_PX,
  baseLogoHeightPx: number = LINKED_LOGO_BASE_HEIGHT_PX
): { widthPx: number; heightPx: number } {
  const safeAspectRatio = aspectRatio > 0 ? aspectRatio : LINKED_LOGO_BASE_WIDTH_PX / LINKED_LOGO_BASE_HEIGHT_PX;
  const heightPx = getLinkedLogoHeightPx(titleFontSizePx, baseFontSizePx, baseLogoHeightPx);
  return {
    widthPx: Math.max(1, Math.round(heightPx * safeAspectRatio)),
    heightPx: Math.max(1, heightPx)
  };
}

export interface LayoutEngineInput {
  frame: FrameSize;
  safeArea: SafeAreaInsets;
  grid: GridSettings;
  textFields: TextFieldPlacementSpec[];
  textStyles: TextStyleSpec[];
  logo?: LogoPlacementSpec;
}

function resolveLogoPlacement(frame: FrameSize, safeArea: SafeAreaInsets, fitWithinSafeArea: boolean, logo?: LayoutEngineInput["logo"]): LogoPlacement | undefined {
  if (!logo) {
    return undefined;
  }

  const originLeftPx = fitWithinSafeArea ? safeArea.left : 0;
  const originTopPx = fitWithinSafeArea ? safeArea.top : 0;
  const left = Math.round(originLeftPx + logo.xPx);
  const top = Math.round(originTopPx + logo.yPx);
  const width = Math.round(logo.widthPx);
  const height = Math.round(logo.heightPx);

  return {
    id: logo.id || "logo",
    xPx: logo.xPx,
    yPx: logo.yPx,
    widthPx: logo.widthPx,
    heightPx: logo.heightPx,
    ...(logo.assetPath ? { assetPath: logo.assetPath } : {}),
    bounds: {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height
    }
  };
}

export function resolveLayerScene(input: LayoutEngineInput, measurer: TextMeasurer): LayerScene {
  const grid = computeLayoutGridMetrics(input.frame, input.safeArea, input.grid);
  const styleByKey = new Map(input.textStyles.map((style) => [style.key, style]));
  const texts = input.textFields
    .map((field) => {
      const style = styleByKey.get(field.styleKey);
      if (!style) {
        throw new Error(`Unknown text style: ${field.styleKey}`);
      }
      return resolveTextPlacement(grid, field, style, measurer);
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
  const logo = resolveLogoPlacement(input.frame, input.safeArea, input.grid.fitWithinSafeArea, input.logo);

  return {
    grid,
    texts,
    ...(logo ? { logo } : {})
  };
}