/**
 * stage-render-controller.ts — Stage rendering and scene composition.
 *
 * Owns operator-graph evaluation, halo and scene-family canvas routing, and
 * SVG overlay assembly so main.ts can stay focused on state and controller
 * wiring.
 */

import type {
  LayerScene,
  OperatorGraph,
  TextStyleSpec
} from "@brand-layout-ops/core-types";
import { OperatorRegistry, evaluateGraph } from "@brand-layout-ops/graph-runtime";
import {
  createOverlayLayoutOperator,
  OVERLAY_LAYOUT_OPERATOR_KEY,
  type OverlayLayoutOperatorParams
} from "@brand-layout-ops/operator-overlay-layout";
import {
  buildUbuntuSummitAnimationSceneDescriptor,
  type UbuntuSummitAnimationSceneDescriptor,
  type UbuntuSummitAnimationTransitionState
} from "@brand-layout-ops/operator-ubuntu-summit-animation";

import { createHaloRenderer, type HaloRenderer } from "./halo-renderer.js";
import type {
  PreviewState,
  SceneFamilyPreviewSnapshot
} from "./preview-app-context.js";
import {
  buildSceneFamilyPreviewState,
  clearGpuFuzzyBoidsPreviewCanvas,
  clearSceneFamilyPreviewCanvas,
  renderSceneFamilyPreviewFrame,
  setSceneFamilyPreviewRefreshCallback,
  type SceneFamilyPreviewMode,
  type SceneFamilyPreviewState
} from "./scene-family-preview.js";
import {
  createGuideMarkup,
  createLogoMarkup,
  createSafeAreaMarkup,
  createTextMarkup
} from "./svg-overlay-adapter.js";
import {
  getActivePreviewCompositionLayers
} from "./preview-composition.js";

const PREVIEW_NODE_ID = "overlay-preview";

export interface StageRenderControllerDeps {
  readonly state: PreviewState;
  getStageShellEl(): HTMLElement | null;
  getStageEl(): HTMLElement | null;
  getCanvasEl(): HTMLCanvasElement | null;
  getScenePreviewCanvas(): HTMLCanvasElement | null;
  getScenePreviewGpuCanvas(): HTMLCanvasElement | null;
  getTextOverlayCanvas(): HTMLCanvasElement | null;
  getSvgOverlay(): SVGSVGElement | null;
  getEffectiveParams(): OverlayLayoutOperatorParams;
  onAuthoringRender(): void;
}

export interface StageRenderController {
  getCurrentScene(): LayerScene | null;
  getSceneDescriptor(): UbuntuSummitAnimationSceneDescriptor;
  initHaloRenderer(): void;
  resizeRenderer(): void;
  syncBackgroundRendererVisibility(): void;
  getSceneFamilyPreviewState(mode?: SceneFamilyPreviewMode): SceneFamilyPreviewSnapshot | null;
  renderBackgroundFrame(mode?: SceneFamilyPreviewMode): void;
  renderStage(mode?: SceneFamilyPreviewMode): Promise<void>;
}

export function createStageRenderController(
  deps: StageRenderControllerDeps
): StageRenderController {
  const registry = new OperatorRegistry();
  registry.register(createOverlayLayoutOperator());

  let currentScene: LayerScene | null = null;
  let renderToken = 0;
  let haloRendererInstance: HaloRenderer | null = null;
  let ubuntuSummitTransitionState: UbuntuSummitAnimationTransitionState | null = null;
  let lastPreviewState: SceneFamilyPreviewState | null = null;

  function buildGraph(params: OverlayLayoutOperatorParams): OperatorGraph {
    return {
      nodes: [{ id: PREVIEW_NODE_ID, operatorKey: OVERLAY_LAYOUT_OPERATOR_KEY, params }],
      edges: []
    };
  }

  function syncStageShellMetrics(): void {
    const stageShell = deps.getStageShellEl();
    if (!stageShell) {
      return;
    }

    const rect = stageShell.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(stageShell);
    const paddingBlock =
      Number.parseFloat(computedStyle.paddingTop || "0") +
      Number.parseFloat(computedStyle.paddingBottom || "0");
    const availableBlock = Math.max(0, rect.height - paddingBlock);

    stageShell.style.setProperty("--stage-shell-available-block", `${availableBlock}px`);
  }

  function updateStageAspectRatio(): void {
    const stage = deps.getStageEl();
    if (!stage) {
      return;
    }

    const { widthPx, heightPx } = deps.state.params.frame;
    stage.style.aspectRatio = `${widthPx} / ${heightPx}`;
    stage.style.setProperty("--stage-aspect-ratio", String(widthPx / heightPx));
  }

  function getSceneDescriptor(): UbuntuSummitAnimationSceneDescriptor {
    const sceneDescriptor = buildUbuntuSummitAnimationSceneDescriptor(
      ubuntuSummitTransitionState
        ? {
            haloConfig: deps.state.haloConfig,
            playbackTimeSec: deps.state.playbackTimeSec,
            frameWidthPx: deps.state.params.frame.widthPx,
            frameHeightPx: deps.state.params.frame.heightPx,
            previousTransitionState: ubuntuSummitTransitionState
          }
        : {
            haloConfig: deps.state.haloConfig,
            playbackTimeSec: deps.state.playbackTimeSec,
            frameWidthPx: deps.state.params.frame.widthPx,
            frameHeightPx: deps.state.params.frame.heightPx
          }
    );
    ubuntuSummitTransitionState = sceneDescriptor.frameState.nextTransitionState;
    return sceneDescriptor;
  }

  function initHaloRenderer(): void {
    const canvas = deps.getCanvasEl();
    const textCanvas = deps.getTextOverlayCanvas();
    if (!canvas || !textCanvas) {
      return;
    }

    const { widthPx, heightPx } = deps.state.params.frame;
    haloRendererInstance = createHaloRenderer({
      canvas,
      textOverlayCanvas: textCanvas,
      widthPx,
      heightPx,
      onMascotAssetsReady: () => {
        if (deps.state.documentProject.sceneFamilyKey !== "halo") {
          return;
        }

        renderBackgroundFrame("interactive");
      }
    });

    syncStageShellMetrics();
    updateStageAspectRatio();
    syncBackgroundRendererVisibilityWithState(lastPreviewState);
  }

  function getPreviewSimulationBackend(previewState: SceneFamilyPreviewState | null): string | null {
    if (!previewState || !("simulationBackend" in previewState)) {
      return null;
    }

    return previewState.simulationBackend ?? null;
  }

  function syncBackgroundRendererVisibilityWithState(previewState: SceneFamilyPreviewState | null): void {
    const stageCanvas = deps.getCanvasEl();
    const scenePreviewCanvas = deps.getScenePreviewCanvas();
    const scenePreviewGpuCanvas = deps.getScenePreviewGpuCanvas();
    const textCanvas = deps.getTextOverlayCanvas();
    if (!stageCanvas || !scenePreviewCanvas || !scenePreviewGpuCanvas || !textCanvas) {
      return;
    }

    const activeLayerIds = new Set(
      getActivePreviewCompositionLayers({
        state: deps.state,
        simulationBackend: getPreviewSimulationBackend(previewState)
      }).map((layer) => layer.id)
    );

    stageCanvas.style.opacity = activeLayerIds.has("halo-webgl") ? "1" : "0";
    scenePreviewCanvas.style.opacity = activeLayerIds.has("scene-preview-cpu") ? "1" : "0";
    scenePreviewGpuCanvas.style.opacity = activeLayerIds.has("scene-preview-gpu") ? "1" : "0";
    textCanvas.style.opacity = activeLayerIds.has("halo-labels") ? "1" : "0";
  }

  function resizeRenderer(): void {
    const { widthPx, heightPx } = deps.state.params.frame;
    syncStageShellMetrics();
    updateStageAspectRatio();

    if (!haloRendererInstance) {
      return;
    }

    haloRendererInstance.resize(widthPx, heightPx);
    syncBackgroundRendererVisibilityWithState(lastPreviewState);
  }

  function syncBackgroundRendererVisibility(): void {
    syncBackgroundRendererVisibilityWithState(lastPreviewState);
  }

  function getSceneFamilyPreviewState(
    mode: SceneFamilyPreviewMode = "interactive"
  ): SceneFamilyPreviewState | null {
    return buildSceneFamilyPreviewState({
      backgroundGraph: deps.state.documentProject.backgroundGraph,
      widthPx: deps.state.params.frame.widthPx,
      heightPx: deps.state.params.frame.heightPx,
      playbackTimeSec: deps.state.playbackTimeSec,
      haloConfig: deps.state.haloConfig,
      mode
    });
  }

  function renderHaloFrame(): void {
    if (!haloRendererInstance) {
      return;
    }

    const sceneDescriptor = getSceneDescriptor();
    haloRendererInstance.renderFrame(sceneDescriptor, deps.state.exportSettings.transparentBackground);
  }

  function renderSvgOverlay(scene: LayerScene): void {
    const svg = deps.getSvgOverlay();
    if (!svg) {
      return;
    }

    const activeLayerIds = new Set(
      getActivePreviewCompositionLayers({
        state: deps.state,
        simulationBackend: getPreviewSimulationBackend(lastPreviewState)
      }).map((layer) => layer.id)
    );

    if (!activeLayerIds.has("authored-overlay")) {
      svg.innerHTML = "";
      svg.style.display = "none";
      return;
    }

    svg.style.display = "block";

    const frame = deps.state.params.frame;
    svg.setAttribute("viewBox", `0 0 ${frame.widthPx} ${frame.heightPx}`);

    const styleByKey = new Map<string, TextStyleSpec>(
      deps.state.params.textStyles.map((style) => [style.key, style])
    );
    const parts: string[] = [];

    if (deps.state.guideMode !== "off") {
      parts.push(createGuideMarkup(scene.grid, frame, deps.state.guideMode));
    }

    if (deps.state.guideMode !== "off") {
      parts.push(
        createSafeAreaMarkup(
          frame,
          deps.state.params.safeArea,
          deps.state.haloConfig.composition.background_color
        )
      );
    }

    for (const text of scene.texts) {
      const style = styleByKey.get(text.styleKey);
      if (style) {
        parts.push(createTextMarkup(text, style));
      }
    }

    parts.push(createLogoMarkup(scene.logo));
    svg.innerHTML = parts.join("");
  }

  function renderBackgroundFrame(mode: SceneFamilyPreviewMode = "interactive"): void {
    const scenePreviewCanvas = deps.getScenePreviewCanvas();
    const scenePreviewGpuCanvas = deps.getScenePreviewGpuCanvas();
    const textCanvas = deps.getTextOverlayCanvas();
    if (!scenePreviewCanvas || !scenePreviewGpuCanvas || !textCanvas) {
      return;
    }

    if (deps.state.documentProject.sceneFamilyKey === "halo") {
      lastPreviewState = null;
      syncBackgroundRendererVisibilityWithState(null);
      clearSceneFamilyPreviewCanvas(
        scenePreviewCanvas,
        deps.state.params.frame.widthPx,
        deps.state.params.frame.heightPx
      );
      clearGpuFuzzyBoidsPreviewCanvas(
        scenePreviewGpuCanvas,
        deps.state.params.frame.widthPx,
        deps.state.params.frame.heightPx
      );
      renderHaloFrame();
      return;
    }

    const previewState = getSceneFamilyPreviewState(mode);
    lastPreviewState = previewState;
    syncBackgroundRendererVisibilityWithState(previewState);
    haloRendererInstance?.clearFrame();
    if (!previewState) {
      clearSceneFamilyPreviewCanvas(
        scenePreviewCanvas,
        deps.state.params.frame.widthPx,
        deps.state.params.frame.heightPx
      );
      clearGpuFuzzyBoidsPreviewCanvas(
        scenePreviewGpuCanvas,
        deps.state.params.frame.widthPx,
        deps.state.params.frame.heightPx
      );
      return;
    }

    if (previewState.sceneFamilyKey === "fuzzy-boids" && previewState.simulationBackend === "gpu-spike") {
      clearSceneFamilyPreviewCanvas(
        scenePreviewCanvas,
        deps.state.params.frame.widthPx,
        deps.state.params.frame.heightPx
      );
      renderSceneFamilyPreviewFrame({
        canvas: scenePreviewGpuCanvas,
        widthPx: deps.state.params.frame.widthPx,
        heightPx: deps.state.params.frame.heightPx,
        transparentBackground: deps.state.exportSettings.transparentBackground,
        haloConfig: deps.state.haloConfig,
        previewState
      });
      return;
    }

    clearGpuFuzzyBoidsPreviewCanvas(
      scenePreviewGpuCanvas,
      deps.state.params.frame.widthPx,
      deps.state.params.frame.heightPx
    );
    renderSceneFamilyPreviewFrame({
      canvas: scenePreviewCanvas,
      widthPx: deps.state.params.frame.widthPx,
      heightPx: deps.state.params.frame.heightPx,
      transparentBackground: deps.state.exportSettings.transparentBackground,
      haloConfig: deps.state.haloConfig,
      previewState
    });
  }

  async function renderStage(mode: SceneFamilyPreviewMode = "interactive"): Promise<void> {
    const myToken = ++renderToken;
    const graph = buildGraph(deps.getEffectiveParams());
    const resultMap = await evaluateGraph(graph, registry);
    if (renderToken !== myToken) {
      return;
    }

    const nodeResult = resultMap.get(PREVIEW_NODE_ID) as { scene?: LayerScene } | undefined;
    const scene = nodeResult?.scene;
    if (!scene) {
      return;
    }

    currentScene = scene;
    renderBackgroundFrame(mode);
    renderSvgOverlay(scene);
    deps.onAuthoringRender();
  }

  setSceneFamilyPreviewRefreshCallback(() => {
    if (deps.state.documentProject.sceneFamilyKey === "halo") {
      return;
    }

    renderBackgroundFrame("interactive");
  });

  return {
    getCurrentScene: () => currentScene,
    getSceneDescriptor,
    initHaloRenderer,
    resizeRenderer,
    syncBackgroundRendererVisibility,
    getSceneFamilyPreviewState,
    renderBackgroundFrame,
    renderStage
  };
}