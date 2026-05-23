import {
  OUTPUT_PROFILES,
  getOutputProfile
} from "@brand-layout-ops/core-types";
import {
  cloneOverlayBackgroundGraph,
  cloneOverlayDocumentProject,
  createDefaultOverlaySceneFamilyConfigs,
  extractOverlaySceneFamilyConfigsFromGraph,
  getOverlayFormatPresetDefinition,
  getOverlayFormatSafeAreaFrame,
  normalizeOverlayBackgroundGraph,
  normalizeOverlaySceneFamilyGraphs,
  normalizeOverlaySceneFamilyConfigs,
  OVERLAY_SCENE_FAMILY_ORDER,
  type OverlaySceneFamilyKey
} from "@brand-layout-ops/document-model";
import type { UbuntuSummitAnimationSceneDescriptor } from "@brand-layout-ops/operator-ubuntu-summit-animation";
import type {
  OverlayPreviewDocument,
  PreviewAppContext
} from "./preview-app-context.js";
import type { PersistedOverlayPreviewDocument } from "./preview-document.js";
import {
  getActivePreviewCompositionLayers,
  getActivePreviewOutputSink,
  getPreviewCompositionLayers,
  getPreviewOutputSinks,
  type PreviewCompositionLayerId
} from "./preview-composition.js";
import {
  serializeHaloSvgDocument,
  serializeSceneFamilySvgDocument,
  loadSvgMarkup,
  type SvgDocumentOptions,
} from "./svg-document-serializer.js";
import { buildSceneFamilyPreviewState } from "./scene-family-preview.js";

interface ExportOptions {
  startFrame: number;
  endFrame: number;
  frameRate: number;
  fadeInEnabled: boolean;
  fadeOutEnabled: boolean;
}

type ExportKind = "png-sequence" | "mp4";

interface SavedExportOptions {
  startFrame: number;
  endFrame: number;
  fadeInEnabled: boolean;
  fadeOutEnabled: boolean;
}

const EXPORT_KIND_COPY: Record<ExportKind, {
  title: string;
  description: string;
  submitLabel: string;
  showFades: boolean;
}> = {
  "png-sequence": {
    title: "Export PNG Sequence",
    description: "Choose an inclusive frame range for the PNG sequence. Frame 30 will be exported as frame 30.",
    submitLabel: "Export PNG Sequence",
    showFades: false
  },
  mp4: {
    title: "Export MP4",
    description: "Choose an inclusive frame range. Frame 30 means the exported video includes frame 30.",
    submitLabel: "Export MP4",
    showFades: true
  }
};

interface CreateExportAutomationControllerOptions {
  ctx: PreviewAppContext;
  getCanvasEl: () => HTMLCanvasElement | null;
  getScenePreviewCanvas: () => HTMLCanvasElement | null;
  getScenePreviewGpuCanvas: () => HTMLCanvasElement | null;
  getTextOverlayCanvas: () => HTMLCanvasElement | null;
  getSvgOverlay: () => SVGSVGElement | null;
  getSceneDescriptor: () => UbuntuSummitAnimationSceneDescriptor;
  normalizeSelectedBackgroundNodeId: (preferredNodeId?: string | null) => string | null;
  buildCurrentDocumentPersistence: () => PersistedOverlayPreviewDocument;
  parsePreviewDocument: (rawDocument: unknown) => OverlayPreviewDocument | null;
  applyPreviewDocument: (previewDocument: OverlayPreviewDocument) => Promise<void>;
}

export interface ExportAutomationController {
  exportComposedFramePng(): Promise<void>;
  exportSvgDocument(): Promise<void>;
  exportPngSequence(): Promise<void>;
  exportMp4(): Promise<void>;
  getAutomationState(): Record<string, unknown>;
  applyAutomationSnapshot(payload?: Record<string, unknown>): Promise<Record<string, unknown>>;
  exportAutomationFrame(payload?: Record<string, unknown>): Promise<Record<string, unknown>>;
  installAutomationApi(initPromise: Promise<void>): void;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Failed to create PNG blob from composed canvas."));
    }, "image/png");
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const commaIndex = dataUrl.indexOf(",");
      resolve(commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl);
    };
    reader.onerror = () => reject(new Error("Failed to read blob as base64."));
    reader.readAsDataURL(blob);
  });
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getNextVersionedPngFileName(
  dirHandle: FileSystemDirectoryHandle,
  baseName: string
): Promise<string> {
  const pattern = new RegExp(`^${escapeRegExp(baseName)}(?:-v(\\d+))?\\.png$`, "i");
  let highestVersion = 0;
  let foundBaseFile = false;

  for await (const [entryName, entryHandle] of (dirHandle as any).entries()) {
    if (entryHandle.kind !== "file") continue;
    const match = entryName.match(pattern);
    if (!match) continue;
    if (typeof match[1] === "undefined") {
      foundBaseFile = true;
      highestVersion = Math.max(highestVersion, 1);
    } else {
      highestVersion = Math.max(highestVersion, Number(match[1]));
    }
  }

  if (!foundBaseFile && highestVersion === 0) {
    return `${baseName}.png`;
  }

  return `${baseName}-v${highestVersion + 1}.png`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    image.src = url;
  });
}

async function inlineExternalImages(svgEl: SVGSVGElement): Promise<void> {
  const images = Array.from(svgEl.querySelectorAll("image"));
  for (const image of images) {
    const href = image.getAttribute("href") || image.getAttributeNS("http://www.w3.org/1999/xlink", "href");
    if (!href || href.startsWith("data:")) {
      continue;
    }

    try {
      const response = await fetch(href);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      image.setAttribute("href", dataUrl);
    } catch {
      // Keep the original href when fetch or conversion fails.
    }
  }
}

export function createExportAutomationController(
  options: CreateExportAutomationControllerOptions
): ExportAutomationController {
  const { ctx } = options;
  let exportModalResolve: ((opts: ExportOptions | null) => void) | null = null;
  let activeExportKind: ExportKind = "png-sequence";
  const savedExportOptionsByKind: Record<ExportKind, SavedExportOptions> = {
    "png-sequence": {
      startFrame: 1,
      endFrame: getDefaultExportEndFrame(),
      fadeInEnabled: false,
      fadeOutEnabled: false
    },
    mp4: {
      startFrame: 1,
      endFrame: getDefaultExportEndFrame(),
      fadeInEnabled: false,
      fadeOutEnabled: false
    }
  };

  function getDefaultExportEndFrame(): number {
    return Math.max(1, Math.floor(10 * ctx.state.exportSettings.frameRate));
  }

  function updateExportSummary(
    summaryEl: HTMLElement | null | undefined,
    startInput: HTMLInputElement | null | undefined,
    endInput: HTMLInputElement | null | undefined
  ): void {
    if (!summaryEl || !startInput || !endInput) {
      return;
    }

    const start = parseInt(startInput.value, 10) || 1;
    const end = parseInt(endInput.value, 10) || 1;
    const count = Math.max(0, end - start + 1);
    const fps = Math.max(1, Math.round(ctx.state.exportSettings.frameRate));
    const durationSec = count > 0 ? (count / fps).toFixed(2) : "0";
    summaryEl.textContent = `${count} frames at ${fps} fps (${durationSec}s)`;
  }

  function buildExportModal(): HTMLDialogElement {
    const dialog = document.createElement("dialog");
    dialog.id = "export-options-modal";
    dialog.className = "bf-modal";
    dialog.setAttribute("data-shell-modal", "");

    dialog.innerHTML = `
      <div class="bf-modal-dialog" role="dialog" aria-labelledby="export-modal-title">
        <header class="bf-modal-header">
          <h2 class="bf-modal-title" id="export-modal-title">Export PNG Sequence</h2>
          <button class="bf-modal-close" data-export-cancel type="button">Close</button>
        </header>
        <div class="bf-modal-body">
          <p class="bf-form-help" data-export-description></p>
          <div class="bf-field">
            <label class="bf-form-label">Start Frame</label>
            <div class="bf-control">
              <input type="number" class="bf-input" data-export-start-frame min="1" step="1" value="1">
            </div>
          </div>
          <div class="bf-field">
            <label class="bf-form-label">End Frame</label>
            <div class="bf-control">
              <input type="number" class="bf-input" data-export-end-frame min="1" step="1" value="240">
            </div>
          </div>
          <div class="bf-stack is-compact-stack" data-export-fades hidden>
            <div class="bf-field is-checkbox">
              <div class="bf-control">
                <div class="bf-checkbox">
                  <input id="export-fade-in" class="bf-checkbox-input" data-export-fade-in type="checkbox">
                  <label class="bf-checkbox-label" for="export-fade-in">Fade in first 2 seconds</label>
                </div>
              </div>
            </div>
            <div class="bf-field is-checkbox">
              <div class="bf-control">
                <div class="bf-checkbox">
                  <input id="export-fade-out" class="bf-checkbox-input" data-export-fade-out type="checkbox">
                  <label class="bf-checkbox-label" for="export-fade-out">Fade out last 2 seconds</label>
                </div>
              </div>
            </div>
          </div>
          <p class="bf-form-help" data-export-summary></p>
        </div>
        <footer class="bf-modal-footer">
          <button class="bf-button is-base" type="button" data-export-cancel>Cancel</button>
          <button class="bf-button" type="button" data-export-submit>Export</button>
        </footer>
      </div>
    `;

    const startInput = dialog.querySelector<HTMLInputElement>("[data-export-start-frame]");
    const endInput = dialog.querySelector<HTMLInputElement>("[data-export-end-frame]");
    const fadeInInput = dialog.querySelector<HTMLInputElement>("[data-export-fade-in]");
    const fadeOutInput = dialog.querySelector<HTMLInputElement>("[data-export-fade-out]");
    const summaryEl = dialog.querySelector<HTMLElement>("[data-export-summary]");

    const updateSummary = () => updateExportSummary(summaryEl, startInput, endInput);
    startInput?.addEventListener("input", updateSummary);
    endInput?.addEventListener("input", updateSummary);

    dialog.querySelectorAll("[data-export-cancel]").forEach((button) => {
      button.addEventListener("click", () => {
        dialog.close();
        exportModalResolve?.(null);
        exportModalResolve = null;
      });
    });

    dialog.querySelector("[data-export-submit]")?.addEventListener("click", () => {
      const start = Math.max(1, parseInt(startInput?.value ?? "1", 10) || 1);
      const end = Math.max(start, parseInt(endInput?.value ?? "1", 10) || 1);
      const nextOptions: ExportOptions = {
        startFrame: start,
        endFrame: end,
        frameRate: Math.max(1, Math.round(ctx.state.exportSettings.frameRate)),
        fadeInEnabled: activeExportKind === "mp4" && Boolean(fadeInInput?.checked),
        fadeOutEnabled: activeExportKind === "mp4" && Boolean(fadeOutInput?.checked)
      };
      savedExportOptionsByKind[activeExportKind] = {
        startFrame: nextOptions.startFrame,
        endFrame: nextOptions.endFrame,
        fadeInEnabled: nextOptions.fadeInEnabled,
        fadeOutEnabled: nextOptions.fadeOutEnabled
      };
      dialog.close();
      exportModalResolve?.(nextOptions);
      exportModalResolve = null;
    });

    dialog.addEventListener("close", () => {
      if (exportModalResolve) {
        exportModalResolve(null);
        exportModalResolve = null;
      }
    });

    return dialog;
  }

  function promptForExportOptions(kind: ExportKind): Promise<ExportOptions | null> {
    return new Promise((resolve) => {
      activeExportKind = kind;
      exportModalResolve = resolve;

      let modal = document.getElementById("export-options-modal") as HTMLDialogElement | null;
      if (!modal) {
        modal = buildExportModal();
        document.body.append(modal);
      }

      const modalCopy = EXPORT_KIND_COPY[kind];
      const savedOptions = savedExportOptionsByKind[kind];
      modal.querySelector<HTMLElement>("#export-modal-title")!.textContent = modalCopy.title;
      modal.querySelector<HTMLElement>("[data-export-description]")!.textContent = modalCopy.description;
      modal.querySelector<HTMLElement>("[data-export-fades]")!.hidden = !modalCopy.showFades;
      modal.querySelector<HTMLButtonElement>("[data-export-submit]")!.textContent = modalCopy.submitLabel;

      const startInput = modal.querySelector<HTMLInputElement>("[data-export-start-frame]");
      const endInput = modal.querySelector<HTMLInputElement>("[data-export-end-frame]");
      const fadeInInput = modal.querySelector<HTMLInputElement>("[data-export-fade-in]");
      const fadeOutInput = modal.querySelector<HTMLInputElement>("[data-export-fade-out]");
      const summaryEl = modal.querySelector<HTMLElement>("[data-export-summary]");
      if (startInput) {
        startInput.value = String(Math.max(1, savedOptions.startFrame));
      }
      if (endInput) {
        endInput.value = String(Math.max(savedOptions.startFrame, savedOptions.endFrame));
      }
      if (fadeInInput) {
        fadeInInput.checked = savedOptions.fadeInEnabled;
      }
      if (fadeOutInput) {
        fadeOutInput.checked = savedOptions.fadeOutEnabled;
      }
      updateExportSummary(summaryEl, startInput, endInput);

      modal.showModal();
    });
  }

  async function serializeExportSvgMarkup(transparentBackground: boolean): Promise<string | null> {
    const svg = options.getSvgOverlay();
    if (!svg) {
      return null;
    }

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(ctx.state.params.frame.widthPx));
    clone.setAttribute("height", String(ctx.state.params.frame.heightPx));
    clone.setAttribute("viewBox", `0 0 ${ctx.state.params.frame.widthPx} ${ctx.state.params.frame.heightPx}`);

    if (transparentBackground) {
      clone.querySelectorAll(".safe-area-fill").forEach((node) => node.remove());
    }

    clone.querySelectorAll(".guides").forEach((node) => node.remove());
    await inlineExternalImages(clone);
    return new XMLSerializer().serializeToString(clone);
  }

  async function composeFrameToCanvas(
    timeSec: number,
    transparentBackground: boolean = ctx.state.exportSettings.transparentBackground
  ): Promise<HTMLCanvasElement | null> {
    const stageCanvas = options.getCanvasEl();
    const scenePreviewCanvas = options.getScenePreviewCanvas();
    const scenePreviewGpuCanvas = options.getScenePreviewGpuCanvas();
    const textCanvas = options.getTextOverlayCanvas();
    if (!stageCanvas || !scenePreviewCanvas || !scenePreviewGpuCanvas || !textCanvas) {
      return null;
    }

    ctx.state.playbackTimeSec = timeSec;
    await ctx.renderStage("export");

    const { widthPx, heightPx } = ctx.state.params.frame;
    const composedCanvas = document.createElement("canvas");
    composedCanvas.width = widthPx;
    composedCanvas.height = heightPx;

    const canvasContext = composedCanvas.getContext("2d");
    if (!canvasContext) {
      return null;
    }

    if (!transparentBackground) {
      canvasContext.fillStyle = ctx.state.haloConfig.composition.background_color || "#202020";
      canvasContext.fillRect(0, 0, widthPx, heightPx);
    } else {
      canvasContext.clearRect(0, 0, widthPx, heightPx);
    }

    const activeLayers = getActivePreviewCompositionLayers({
      state: ctx.state,
      simulationBackend: ctx.getSceneFamilyPreviewState("export")?.simulationBackend ?? null
    });
    let svgMarkup: string | null | undefined;

    for (const layer of activeLayers) {
      switch (layer.id as PreviewCompositionLayerId) {
        case "halo-webgl":
          canvasContext.drawImage(stageCanvas, 0, 0, widthPx, heightPx);
          break;
        case "scene-preview-cpu":
          canvasContext.drawImage(scenePreviewCanvas, 0, 0, widthPx, heightPx);
          break;
        case "scene-preview-gpu":
          canvasContext.drawImage(scenePreviewGpuCanvas, 0, 0, widthPx, heightPx);
          break;
        case "halo-labels":
          canvasContext.drawImage(textCanvas, 0, 0, widthPx, heightPx);
          break;
        case "authored-overlay":
          if (typeof svgMarkup === "undefined") {
            svgMarkup = await serializeExportSvgMarkup(transparentBackground);
          }

          if (!svgMarkup) {
            break;
          }

          {
            const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
            const svgUrl = URL.createObjectURL(svgBlob);
            try {
              const svgImage = await loadImage(svgUrl);
              canvasContext.drawImage(svgImage, 0, 0, widthPx, heightPx);
            } finally {
              URL.revokeObjectURL(svgUrl);
            }
          }
          break;
      }
    }

    return composedCanvas;
  }

  function getDimensionsFolderName(): string {
    const profile = getOutputProfile(ctx.state.outputProfileKey);
    return `${profile.widthPx}x${profile.heightPx}`;
  }

  async function exportComposedFramePng(): Promise<void> {
    const composedCanvas = await composeFrameToCanvas(ctx.state.playbackTimeSec);
    if (!composedCanvas) {
      return;
    }

    const blob = await canvasToBlob(composedCanvas);
    const baseName = `${ctx.state.exportSettings.exportName ?? "export"}_${getDimensionsFolderName()}`;

    if ("showDirectoryPicker" in window) {
      try {
        const dirHandle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
        const dimDir = await dirHandle.getDirectoryHandle(getDimensionsFolderName(), { create: true });
        const fileName = await getNextVersionedPngFileName(dimDir, baseName);
        const fileHandle = await dimDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        ctx.setSourceDefaultStatus(`Exported ${dirHandle.name}/${getDimensionsFolderName()}/${fileName}`, "success");
        return;
      } catch {
        // User cancelled directory picker — fall through to blob download
      }
    }

    triggerBlobDownload(blob, `${baseName}.png`);
  }

  async function exportSvgDocument(): Promise<void> {
    const { widthPx, heightPx } = ctx.state.params.frame;
    const transparentBackground = ctx.state.exportSettings.transparentBackground;
    const isHaloScene = ctx.state.documentProject.sceneFamilyKey === "halo";

    ctx.setSourceDefaultStatus("Generating SVG document...");

    try {
      // Render current frame to ensure state is up to date
      await ctx.renderStage("export");

      // Serialize the overlay layer (text, logo, safe-area)
      const overlayMarkup = await serializeExportSvgMarkup(transparentBackground);

      const svgOptions: SvgDocumentOptions = {
        widthPx,
        heightPx,
        transparentBackground,
        overlayMarkup
      };

      let svgDocument: string;

      if (isHaloScene) {
        // Load mascot SVG assets as raw markup for inline embedding
        const [mascotFaceSvgMarkup, mascotHaloSvgMarkup] = await Promise.all([
          loadSvgMarkup("/assets/racoon-mascot-face.svg"),
          loadSvgMarkup("/assets/racoon-mascot-halo.svg")
        ]);

        svgOptions.mascotFaceSvgMarkup = mascotFaceSvgMarkup;
        svgOptions.mascotHaloSvgMarkup = mascotHaloSvgMarkup;

        const sceneDescriptor = options.getSceneDescriptor();
        svgDocument = serializeHaloSvgDocument({ sceneDescriptor }, svgOptions);
      } else {
        const previewState = buildSceneFamilyPreviewState({
          backgroundGraph: ctx.state.documentProject.backgroundGraph,
          widthPx,
          heightPx,
          playbackTimeSec: ctx.state.playbackTimeSec,
          haloConfig: ctx.state.haloConfig,
          mode: "export"
        });
        if (!previewState) {
          ctx.setSourceDefaultStatus("SVG export: no scene preview state available.", "error");
          return;
        }

        const bgColor = ctx.state.haloConfig.composition.background_color || "#202020";
        svgDocument = serializeSceneFamilySvgDocument(
          {
            previewState,
            backgroundColor: bgColor
          },
          svgOptions
        );
      }

      const blob = new Blob([svgDocument], { type: "image/svg+xml;charset=utf-8" });
      const baseName = `${ctx.state.exportSettings.exportName ?? "export"}_${getDimensionsFolderName()}`;

      if ("showDirectoryPicker" in window) {
        try {
          const dirHandle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
          const dimDir = await dirHandle.getDirectoryHandle(getDimensionsFolderName(), { create: true });
          const fileName = `${baseName}.svg`;
          const fileHandle = await dimDir.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          ctx.setSourceDefaultStatus(`Exported ${dirHandle.name}/${getDimensionsFolderName()}/${fileName}`, "success");
          return;
        } catch {
          // User cancelled directory picker — fall through to blob download
        }
      }

      triggerBlobDownload(blob, `${baseName}.svg`);
      ctx.setSourceDefaultStatus("SVG document exported.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "SVG export failed.";
      ctx.setSourceDefaultStatus(`SVG export failed: ${message}`, "error");
    }
  }

  async function exportPngSequence(): Promise<void> {
    const exportOptions = await promptForExportOptions("png-sequence");
    if (!exportOptions) {
      return;
    }

    let dirHandle: FileSystemDirectoryHandle | undefined;
    if ("showDirectoryPicker" in window) {
      try {
        dirHandle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      } catch {
        return;
      }
    }

    const wasPlaying = ctx.state.isPlaying;
    ctx.setPlaybackPlaying(false);

    const { startFrame, endFrame, frameRate } = exportOptions;
    const frameCount = endFrame - startFrame + 1;
    const baseName = ctx.state.exportSettings.exportName ?? "frame";
    const profileKey = ctx.state.outputProfileKey;
    const padLength = String(endFrame).length;

    ctx.setSourceDefaultStatus(`Exporting PNG sequence: 0/${frameCount}...`);

    try {
      for (let frameNumber = startFrame; frameNumber <= endFrame; frameNumber += 1) {
        const timeSec = (frameNumber - 1) / frameRate;
        const composedCanvas = await composeFrameToCanvas(timeSec);
        if (!composedCanvas) {
          throw new Error("Failed to compose frame to canvas.");
        }

        const blob = await canvasToBlob(composedCanvas);
        const fileName = `${baseName}_${profileKey}_${String(frameNumber).padStart(padLength, "0")}.png`;

        if (dirHandle) {
          const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        } else {
          triggerBlobDownload(blob, fileName);
        }

        const exported = frameNumber - startFrame + 1;
        if (exported === 1 || exported === frameCount || exported % 12 === 0) {
          ctx.setSourceDefaultStatus(`Exporting PNG sequence: ${exported}/${frameCount}...`);
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
      }

      ctx.setSourceDefaultStatus(`PNG sequence exported (${frameCount} frames).`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "PNG sequence export failed.";
      ctx.setSourceDefaultStatus(`PNG sequence export failed: ${message}`, "error");
    } finally {
      if (wasPlaying) {
        ctx.setPlaybackPlaying(true);
      }
    }
  }

  async function exportMp4(): Promise<void> {
    const exportOptions = await promptForExportOptions("mp4");
    if (!exportOptions) {
      return;
    }

    const wasPlaying = ctx.state.isPlaying;
    ctx.setPlaybackPlaying(false);

    const profile = getOutputProfile(ctx.state.outputProfileKey);
    const frameCount = exportOptions.endFrame - exportOptions.startFrame + 1;

    ctx.setSourceDefaultStatus(
      `Rendering ${frameCount} frames (${exportOptions.startFrame}-${exportOptions.endFrame}, inclusive) and encoding MP4 at ${exportOptions.frameRate} fps...`
    );

    try {
      let response: Response;
      try {
        response = await fetch("/__authoring/export-mp4", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            preview_document: options.buildCurrentDocumentPersistence(),
            output_profile_key: ctx.state.outputProfileKey,
            output_width_px: profile.widthPx,
            output_height_px: profile.heightPx,
            export_name: ctx.state.exportSettings.exportName,
            frame_rate: exportOptions.frameRate,
            start_frame: exportOptions.startFrame,
            end_frame: exportOptions.endFrame,
            fade_in_enabled: exportOptions.fadeInEnabled,
            fade_out_enabled: exportOptions.fadeOutEnabled
          })
        });
      } catch {
        throw new Error("MP4 export needs the preview authoring dev server. Run `npm run preview:dev`.");
      }

      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (response.status === 404) {
        throw new Error("MP4 export is only available from the preview authoring dev server. Run `npm run preview:dev`.");
      }
      if (!response.ok || payload.ok !== true) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : `MP4 export failed with ${response.status}.`
        );
      }

      ctx.setSourceDefaultStatus(
        `Exported MP4 to ${typeof payload.mp4_path === "string" ? payload.mp4_path : "the output directory"}.`,
        "success"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "MP4 export failed.";
      ctx.setSourceDefaultStatus(`MP4 export failed: ${message}`, "error");
    } finally {
      if (wasPlaying) {
        ctx.setPlaybackPlaying(true);
      }
    }
  }

  function getAutomationState(): Record<string, unknown> {
    const profile = getOutputProfile(ctx.state.outputProfileKey);
    const sceneDescriptor = options.getSceneDescriptor();
    const previewCompositionLayers = getPreviewCompositionLayers({
      state: ctx.state,
      simulationBackend: ctx.getSceneFamilyPreviewState()?.simulationBackend ?? null
    });
    const outputSinks = getPreviewOutputSinks();
    const activeOutputSink = getActivePreviewOutputSink();
    const documentFormats = ctx.state.documentProject.targets.map((target) => {
      const preset = target.formatPresetKey
        ? getOverlayFormatPresetDefinition(target.formatPresetKey)
        : null;
      const safeAreaFrame = preset ? getOverlayFormatSafeAreaFrame(preset) : null;

      return {
        id: target.id,
        label: target.label,
        output_profile_key: target.outputProfileKey,
        format_preset_key: target.formatPresetKey,
        format_preset: preset ? {
          key: preset.key,
          label: preset.label,
          frame: {
            width_px: preset.frame.widthPx,
            height_px: preset.frame.heightPx
          },
          safe_area: {
            top: preset.safeArea.top,
            right: preset.safeArea.right,
            bottom: preset.safeArea.bottom,
            left: preset.safeArea.left,
            width_px: safeAreaFrame?.widthPx ?? 0,
            height_px: safeAreaFrame?.heightPx ?? 0
          },
          grid: {
            baseline_step_px: preset.grid.baselineStepPx,
            row_count: preset.grid.rowCount,
            column_count: preset.grid.columnCount,
            row_gutter_baselines: preset.grid.rowGutterBaselines,
            column_gutter_baselines: preset.grid.columnGutterBaselines,
            fit_within_safe_area: preset.grid.fitWithinSafeArea !== false
          }
        } : null,
        derived_from_format_id: target.derivedFromFormatId
      };
    });

    return {
      preview_document: options.buildCurrentDocumentPersistence(),
      output_profile_key: ctx.state.outputProfileKey,
      output_profile: {
        key: ctx.state.outputProfileKey,
        width_px: profile.widthPx,
        height_px: profile.heightPx,
        label: profile.label
      },
      document_scene_family_key: ctx.state.documentProject.sceneFamilyKey,
      document_active_format_id: ctx.state.documentProject.activeTargetId,
      document_formats: documentFormats,
      document_active_target_id: ctx.state.documentProject.activeTargetId,
      document_targets: documentFormats,
      document_scene_family_graphs: cloneOverlayDocumentProject(ctx.state.documentProject).sceneFamilyGraphs,
      document_background_graph: cloneOverlayDocumentProject(ctx.state.documentProject).backgroundGraph,
      preview_composition_layers: previewCompositionLayers.map((layer) => ({
        id: layer.id,
        label: layer.label,
        order: layer.order,
        visible: layer.visible,
        source_kind: layer.sourceKind,
        domain: layer.domain
      })),
      output_sinks: outputSinks.map((sink) => ({
        id: sink.id,
        label: sink.label,
        category: sink.category,
        implemented: sink.implemented,
        active: sink.active
      })),
      active_output_sink: activeOutputSink.id,
      frame_rate: Math.max(1, Math.round(ctx.state.exportSettings.frameRate)),
      current_playback_time_sec: ctx.state.playbackTimeSec,
      overlay_visible: ctx.state.overlayVisible,
      transparent_background: ctx.state.exportSettings.transparentBackground,
      scene_phase: sceneDescriptor.phase,
      scene_timing: sceneDescriptor.runtimeTiming,
      scene_loop_time_sec: sceneDescriptor.loopTimeSec,
      scene_effective_orbit_count: sceneDescriptor.frameState.effectiveOrbitCount,
      scene_effective_spoke_count: sceneDescriptor.frameState.effectiveSpokeCount,
      scene_halo_reveal_u: sceneDescriptor.frameState.haloU,
      scene_screensaver_active: sceneDescriptor.frameState.useScreensaverField,
      scene_blink_start_sec: sceneDescriptor.frameState.motionTiming.blinkStartSec,
      scene_blink_end_sec: sceneDescriptor.frameState.motionTiming.blinkEndSec,
      scene_head_turn_duration_sec: sceneDescriptor.frameState.motionTiming.headTurnDurationSec,
      scene_mascot_fade_u: sceneDescriptor.frameState.mascotMotion.mascotFadeU,
      scene_head_turn_deg: sceneDescriptor.frameState.mascotMotion.headTurnDeg,
      scene_head_turn_eye_squint_u: sceneDescriptor.frameState.mascotMotion.headTurnEyeSquintU,
      scene_eye_closure_u: sceneDescriptor.frameState.mascotMotion.eyeClosureU,
      scene_eye_scale_y: sceneDescriptor.frameState.mascotMotion.eyeScaleY,
      scene_closing_blink_u: sceneDescriptor.frameState.mascotMotion.closingBlinkU,
      scene_loop_blink_u: sceneDescriptor.frameState.mascotMotion.loopBlinkU,
      scene_sneeze_u: sceneDescriptor.frameState.mascotMotion.sneezeU,
      scene_nose_bob_px: sceneDescriptor.frameState.mascotMotion.noseBobPx
    };
  }

  async function applyAutomationSnapshot(payload: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    let shouldRebuildConfigEditor = false;
    let shouldRebuildFormatOptions = false;
    let shouldSyncDocumentBackgroundGraph = false;
    let backgroundGraphProvided = false;

    if (typeof payload.preview_document !== "undefined") {
      const previewDocument = options.parsePreviewDocument(payload.preview_document);
      if (!previewDocument) {
        throw new Error("Automation snapshot preview_document must be a valid persisted preview document.");
      }

      await options.applyPreviewDocument(previewDocument);
    }

    if (typeof payload.output_profile_key === "string" && OUTPUT_PROFILES[payload.output_profile_key]) {
      ctx.switchOutputProfile(payload.output_profile_key);
      shouldRebuildConfigEditor = true;
      shouldRebuildFormatOptions = true;
    }

    if (
      typeof payload.document_scene_family_key === "string" &&
      OVERLAY_SCENE_FAMILY_ORDER.includes(payload.document_scene_family_key as OverlaySceneFamilyKey)
    ) {
      ctx.state.documentProject = {
        ...ctx.state.documentProject,
        sceneFamilyKey: payload.document_scene_family_key as OverlaySceneFamilyKey
      };
      shouldRebuildConfigEditor = true;
      shouldRebuildFormatOptions = true;
      shouldSyncDocumentBackgroundGraph = true;
    }

    if (typeof payload.document_scene_family_graphs === "object" && payload.document_scene_family_graphs !== null) {
      ctx.state.documentProject = {
        ...ctx.state.documentProject,
        sceneFamilyGraphs: normalizeOverlaySceneFamilyGraphs(
          payload.document_scene_family_graphs,
          ctx.state.outputProfileKey,
          payload.document_scene_family_configs,
          ctx.state.documentProject.sceneFamilyKey
        )
      };
      shouldRebuildConfigEditor = true;
      shouldSyncDocumentBackgroundGraph = true;
    }

    if (typeof payload.document_scene_family_configs === "object" && payload.document_scene_family_configs !== null) {
      ctx.state.documentProject = {
        ...ctx.state.documentProject,
        sceneFamilyGraphs: normalizeOverlaySceneFamilyGraphs(
          ctx.state.documentProject.sceneFamilyGraphs,
          ctx.state.outputProfileKey,
          payload.document_scene_family_configs,
          ctx.state.documentProject.sceneFamilyKey
        )
      };
      shouldRebuildConfigEditor = true;
      shouldSyncDocumentBackgroundGraph = true;
    }

    if (typeof payload.document_background_graph === "object" && payload.document_background_graph !== null) {
      const fallbackSceneFamilyConfigs = extractOverlaySceneFamilyConfigsFromGraph(
        ctx.state.documentProject.sceneFamilyGraphs[ctx.state.documentProject.sceneFamilyKey]
        ?? ctx.state.documentProject.backgroundGraph,
        createDefaultOverlaySceneFamilyConfigs(ctx.state.outputProfileKey)
      );
      const normalizedGraph = normalizeOverlayBackgroundGraph(
        payload.document_background_graph,
        ctx.state.documentProject.sceneFamilyKey,
        fallbackSceneFamilyConfigs
      );
      ctx.state.documentProject = {
        ...ctx.state.documentProject,
        backgroundGraph: normalizedGraph,
        sceneFamilyGraphs: {
          ...ctx.state.documentProject.sceneFamilyGraphs,
          [ctx.state.documentProject.sceneFamilyKey]: cloneOverlayBackgroundGraph(normalizedGraph)
        }
      };
      options.normalizeSelectedBackgroundNodeId(ctx.state.selectedBackgroundNodeId);
      backgroundGraphProvided = true;
    }

    if (shouldSyncDocumentBackgroundGraph && !backgroundGraphProvided) {
      ctx.syncDocumentBackgroundGraph();
    }

    if (shouldRebuildConfigEditor) {
      ctx.buildConfigEditor();
    }

    if (shouldRebuildFormatOptions) {
      ctx.buildFormatOptions();
    }

    if (typeof payload.transparent_background === "boolean") {
      ctx.updateExportSettings((settings) => ({
        ...settings,
        transparentBackground: payload.transparent_background as boolean
      }));
    }

    if (typeof payload.overlay_visible === "boolean") {
      ctx.setOverlayVisible(payload.overlay_visible);
    }

    if (typeof payload.frame_rate === "number" && Number.isFinite(payload.frame_rate)) {
      ctx.updateExportSettings((settings) => ({
        ...settings,
        frameRate: Math.max(1, Math.round(payload.frame_rate as number))
      }));
    }

    const playbackTimeSec = typeof payload.playback_time_sec === "number" && Number.isFinite(payload.playback_time_sec)
      ? Math.max(0, payload.playback_time_sec)
      : 0;

    ctx.setPlaybackPlaying(false);
    ctx.state.playbackTimeSec = playbackTimeSec;
    await ctx.renderStage("export");

    return getAutomationState();
  }

  async function exportAutomationFrame(payload: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const playbackTimeSec = typeof payload.playback_time_sec === "number" && Number.isFinite(payload.playback_time_sec)
      ? Math.max(0, payload.playback_time_sec)
      : ctx.state.playbackTimeSec;
    const transparentBackground = typeof payload.transparent_background === "boolean"
      ? payload.transparent_background
      : ctx.state.exportSettings.transparentBackground;

    ctx.setPlaybackPlaying(false);

    const composedCanvas = await composeFrameToCanvas(playbackTimeSec, transparentBackground);
    if (!composedCanvas) {
      throw new Error("Failed to compose frame to canvas.");
    }

    const blob = await canvasToBlob(composedCanvas);
    const pngBase64 = await blobToBase64(blob);
    const profile = getOutputProfile(ctx.state.outputProfileKey);
    return {
      png_base64: pngBase64,
      width_px: profile.widthPx,
      height_px: profile.heightPx,
      playback_time_sec: playbackTimeSec,
      output_profile_key: ctx.state.outputProfileKey,
      frame_rate: Math.max(1, Math.round(ctx.state.exportSettings.frameRate)),
      transparent_background: transparentBackground
    };
  }

  function installAutomationApi(initPromise: Promise<void>): void {
    (window as unknown as Record<string, unknown>).__layoutOpsAutomation = {
      version: 1,
      ready: async () => {
        await initPromise;
        ctx.setPlaybackPlaying(false);
        return getAutomationState();
      },
      getState: () => getAutomationState(),
      applySnapshot: async (payload: Record<string, unknown> = {}) => {
        await initPromise;
        return applyAutomationSnapshot(payload);
      },
      exportFrame: async (payload: Record<string, unknown> = {}) => {
        await initPromise;
        return exportAutomationFrame(payload);
      }
    };
  }

  return {
    exportComposedFramePng,
    exportSvgDocument,
    exportPngSequence,
    exportMp4,
    getAutomationState,
    applyAutomationSnapshot,
    exportAutomationFrame,
    installAutomationApi
  };
}