import type { PreviewState } from "./preview-app-context.js";

export type PreviewCompositionLayerId =
  | "halo-webgl"
  | "scene-preview-cpu"
  | "scene-preview-gpu"
  | "halo-labels"
  | "authored-overlay";

export interface PreviewCompositionLayer {
  id: PreviewCompositionLayerId;
  label: string;
  order: number;
  visible: boolean;
  sourceKind: "canvas" | "svg";
  domain: "scene" | "overlay";
}

export type PreviewOutputSinkId =
  | "frame-preview"
  | "png-still"
  | "png-sequence"
  | "automation-frame"
  | "svg-document"
  | "pdf-document";

export interface PreviewOutputSink {
  id: PreviewOutputSinkId;
  label: string;
  category: "preview" | "raster" | "vector" | "print";
  implemented: boolean;
  active: boolean;
}

interface BuildPreviewCompositionOptions {
  state: Pick<PreviewState, "overlayVisible" | "documentProject">;
  simulationBackend?: string | null;
}

export function getPreviewCompositionLayers(
  options: BuildPreviewCompositionOptions
): PreviewCompositionLayer[] {
  const { state, simulationBackend = null } = options;
  const isHaloScene = state.documentProject.sceneFamilyKey === "halo";
  const useGpuScenePreview = !isHaloScene
    && state.documentProject.sceneFamilyKey === "fuzzy-boids"
    && simulationBackend === "gpu-spike";

  return [
    {
      id: "halo-webgl",
      label: "Halo Field",
      order: 0,
      visible: isHaloScene,
      sourceKind: "canvas",
      domain: "scene"
    },
    {
      id: "scene-preview-cpu",
      label: "Scene Preview",
      order: 0,
      visible: !isHaloScene && !useGpuScenePreview,
      sourceKind: "canvas",
      domain: "scene"
    },
    {
      id: "scene-preview-gpu",
      label: "Scene Preview (GPU)",
      order: 0,
      visible: useGpuScenePreview,
      sourceKind: "canvas",
      domain: "scene"
    },
    {
      id: "halo-labels",
      label: "Halo Release Labels",
      order: 1,
      visible: isHaloScene,
      sourceKind: "canvas",
      domain: "scene"
    },
    {
      id: "authored-overlay",
      label: "Authored Overlay",
      order: 2,
      visible: state.overlayVisible,
      sourceKind: "svg",
      domain: "overlay"
    }
  ];
}

export function getActivePreviewCompositionLayers(
  options: BuildPreviewCompositionOptions
): PreviewCompositionLayer[] {
  return getPreviewCompositionLayers(options)
    .filter((layer) => layer.visible)
    .sort((left, right) => left.order - right.order);
}

export function getPreviewOutputSinks(): PreviewOutputSink[] {
  return [
    {
      id: "frame-preview",
      label: "Frame Preview",
      category: "preview",
      implemented: true,
      active: true
    },
    {
      id: "png-still",
      label: "PNG Still",
      category: "raster",
      implemented: true,
      active: false
    },
    {
      id: "png-sequence",
      label: "Image Sequence",
      category: "raster",
      implemented: true,
      active: false
    },
    {
      id: "automation-frame",
      label: "Automation Frame",
      category: "raster",
      implemented: true,
      active: false
    },
    {
      id: "svg-document",
      label: "SVG",
      category: "vector",
      implemented: true,
      active: false
    },
    {
      id: "pdf-document",
      label: "PDF",
      category: "print",
      implemented: false,
      active: false
    }
  ];
}

export function getActivePreviewOutputSink(): PreviewOutputSink {
  const sinks = getPreviewOutputSinks();
  return sinks.find((sink) => sink.active) ?? sinks[0];
}