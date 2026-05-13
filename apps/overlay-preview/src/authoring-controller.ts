import type {
  LayerScene,
  LayoutGridMetrics,
  LogoPlacementSpec,
  TextFieldPlacementSpec
} from "@brand-layout-ops/core-types";
import { snapBaselineToGrid } from "@brand-layout-ops/layout-grid";
import type { DragAxisLock } from "@brand-layout-ops/overlay-interaction";
import { moveLogo, moveTextField } from "@brand-layout-ops/overlay-interaction";
import { getOverlayFieldDisplayLabel } from "@brand-layout-ops/operator-overlay-layout";
import type { PreviewAppContext, Selection } from "./preview-app-context.js";

type DragMode = "move" | "resize";
type ResizeEdge = "e" | "w" | "nw" | "ne" | "sw" | "se";

function isSameSelection(left: Selection | null, right: Selection | null): boolean {
  return left?.kind === right?.kind && left?.id === right?.id;
}

interface DragState {
  selection: Selection;
  metrics: LayoutGridMetrics;
  startClientX: number;
  startClientY: number;
  hasMoved: boolean;
  mode: DragMode;
  resizeEdge?: ResizeEdge | undefined;
  initialField?: TextFieldPlacementSpec | undefined;
  initialLogo?: LogoPlacementSpec | undefined;
}

interface OverlayItemBounds {
  id: string;
  kind: "text" | "logo";
  label: string;
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
  rightPx: number;
  bottomPx: number;
  left: number;
  top: number;
  width: number;
  height: number;
  baselineYPx?: number | undefined;
  lineCount?: number | undefined;
  lineHeightPx?: number | undefined;
}

export interface AuthoringInteractionController {
  init(): void;
  render(): void;
  handleSelectionChange(): void;
  handleEditingKeyDown(event: KeyboardEvent): boolean;
  handleInteractionKeyDown(event: KeyboardEvent): boolean;
  resetInteractionState(): void;
}

export interface CreateAuthoringInteractionControllerOptions {
  ctx: PreviewAppContext;
  getCurrentScene: () => LayerScene | null;
  getStageEl: () => HTMLElement | null;
  getAuthoringLayerEl: () => HTMLElement | null;
}

const HIT_SLOP_PX = 10;
const RESIZE_HANDLE_HIT_RADIUS_PX = 12;
const DRAG_ACTIVATION_DISTANCE_PX = 4;

export function createAuthoringInteractionController(
  options: CreateAuthoringInteractionControllerOptions
): AuthoringInteractionController {
  const { ctx, getCurrentScene, getStageEl, getAuthoringLayerEl } = options;

  let isInitialized = false;
  let currentDrag: DragState | null = null;
  let hoverId: string | null = null;
  let hoverHandle: ResizeEdge | null = null;
  let editSession: { id: string; element: HTMLTextAreaElement } | null = null;

  let authoringHoverBox: HTMLElement | null = null;
  let authoringHoverLabel: HTMLElement | null = null;
  let authoringSelectedBox: HTMLElement | null = null;
  let authoringSelectedLabel: HTMLElement | null = null;
  let authoringBaselineGuide: HTMLElement | null = null;

  function createAuthoringBox(className: string): { box: HTMLElement; label: HTMLElement } {
    const box = document.createElement("div");
    box.className = className;
    box.hidden = true;

    const label = document.createElement("div");
    label.className = "is-authoring-box-label";
    box.appendChild(label);

    return { box, label };
  }

  function setDocumentSelectionSuppressed(suppressed: boolean) {
    const value = suppressed ? "none" : "";
    document.body.style.userSelect = value;
    document.body.style.webkitUserSelect = value;
  }

  function getOverlayItemBounds(): OverlayItemBounds[] {
    const currentScene = getCurrentScene();
    if (!currentScene) {
      return [];
    }

    const items: OverlayItemBounds[] = [];
    const { widthPx, heightPx } = ctx.state.params.frame;

    for (const text of currentScene.texts) {
      const bounds = text.bounds;
      const authoringWidthPx = Math.max(text.maxWidthPx, bounds.width);
      const authoringTopPx = bounds.top;
      const authoringHeightPx = Math.max(text.lineHeightPx, bounds.height);
      items.push({
        id: text.id,
        kind: "text",
        label: getOverlayFieldDisplayLabel(ctx.state.params, text.id),
        leftPx: bounds.left,
        topPx: authoringTopPx,
        widthPx: authoringWidthPx,
        heightPx: authoringHeightPx,
        rightPx: bounds.left + authoringWidthPx,
        bottomPx: authoringTopPx + authoringHeightPx,
        left: (bounds.left / widthPx) * 100,
        top: (authoringTopPx / heightPx) * 100,
        width: (authoringWidthPx / widthPx) * 100,
        height: (authoringHeightPx / heightPx) * 100,
        baselineYPx: text.anchorBaselineYPx,
        lineCount: text.wrappedLines.length,
        lineHeightPx: text.lineHeightPx
      });
    }

    const logo = currentScene.logo;
    if (logo) {
      items.push({
        id: logo.id,
        kind: "logo",
        label: "Selected Logo",
        leftPx: logo.bounds.left,
        topPx: logo.bounds.top,
        widthPx: logo.bounds.width,
        heightPx: logo.bounds.height,
        rightPx: logo.bounds.right,
        bottomPx: logo.bounds.bottom,
        left: (logo.bounds.left / widthPx) * 100,
        top: (logo.bounds.top / heightPx) * 100,
        width: (logo.bounds.width / widthPx) * 100,
        height: (logo.bounds.height / heightPx) * 100
      });
    }

    return items;
  }

  function positionBox(box: HTMLElement, label: HTMLElement, item: OverlayItemBounds) {
    box.hidden = false;
    box.style.left = `${item.left}%`;
    box.style.top = `${item.top}%`;
    box.style.width = `${item.width}%`;
    box.style.height = `${item.height}%`;
    label.textContent = item.label;
  }

  function getSelectedOverlayItemBounds(items: OverlayItemBounds[]): OverlayItemBounds | null {
    if (!ctx.state.selected) {
      return null;
    }

    return items.find((item) => item.id === ctx.state.selected?.id) ?? null;
  }

  function getResizeCursor(edge: ResizeEdge): string {
    switch (edge) {
      case "e":
      case "w":
        return "ew-resize";
      case "ne":
      case "sw":
        return "nesw-resize";
      case "nw":
      case "se":
        return "nwse-resize";
    }
  }

  function closeInlineEditor() {
    if (!editSession) {
      return;
    }

    editSession.element.remove();
    editSession = null;
  }

  function openInlineEditor(fieldId: string) {
    if (!ctx.state.overlayVisible) {
      return;
    }

    closeInlineEditor();

    const layer = getAuthoringLayerEl();
    const stage = getStageEl();
    const currentScene = getCurrentScene();
    if (!layer || !stage || !currentScene) {
      return;
    }

    const field = ctx.state.params.textFields.find((textField) => textField.id === fieldId);
    if (!field || !currentScene.texts.some((text) => text.id === fieldId)) {
      return;
    }

    const textStyle = ctx.state.params.textStyles.find((style) => style.key === field.styleKey);
    const editorBounds = getOverlayItemBounds().find((item) => item.kind === "text" && item.id === fieldId);
    if (!editorBounds) {
      return;
    }

    const { widthPx, heightPx } = ctx.state.params.frame;
    const stageRect = stage.getBoundingClientRect();
    const scaleX = stageRect.width > 0 ? stageRect.width / widthPx : 1;
    const scaleY = stageRect.height > 0 ? stageRect.height / heightPx : 1;
    const typeScale = Math.max(0.1, Math.min(scaleX, scaleY));

    const textarea = document.createElement("textarea");
    textarea.className = "is-inline-editor";
    textarea.value = ctx.getResolvedTextFieldText(field);
    textarea.style.left = `${(editorBounds.leftPx / widthPx) * 100}%`;
    textarea.style.top = `${(editorBounds.topPx / heightPx) * 100}%`;
    textarea.style.width = `${Math.max((editorBounds.widthPx / widthPx) * 100, 15)}%`;
    textarea.style.height = `${Math.max((editorBounds.heightPx / heightPx) * 100, 5)}%`;
    if (textStyle) {
      textarea.style.fontFamily = '"Ubuntu Sans", "Ubuntu", sans-serif';
      textarea.style.fontSize = `${textStyle.fontSizePx * typeScale}px`;
      textarea.style.lineHeight = `${textStyle.lineHeightPx * typeScale}px`;
      textarea.style.fontWeight = String(textStyle.fontWeight ?? 400);
    }
    textarea.style.padding = `${Math.max(4, 8 * typeScale)}px ${Math.max(6, 10 * typeScale)}px`;

    textarea.addEventListener("input", () => {
      ctx.updateSelectedTextValue(fieldId, textarea.value);
      void ctx.renderStage();
    });

    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeInlineEditor();
        event.preventDefault();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        closeInlineEditor();
        event.preventDefault();
      }
      event.stopPropagation();
    });

    textarea.addEventListener("blur", () => {
      closeInlineEditor();
    });

    layer.appendChild(textarea);
    editSession = { id: fieldId, element: textarea };

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.select();
    });
  }

  function clientToFrame(clientX: number, clientY: number): { frameX: number; frameY: number } | null {
    const stage = getStageEl();
    if (!stage) {
      return null;
    }

    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    return {
      frameX: ((clientX - rect.left) / rect.width) * ctx.state.params.frame.widthPx,
      frameY: ((clientY - rect.top) / rect.height) * ctx.state.params.frame.heightPx
    };
  }

  function hasDragActivationDistance(current: DragState, clientX: number, clientY: number): boolean {
    return Math.hypot(clientX - current.startClientX, clientY - current.startClientY) >= DRAG_ACTIVATION_DISTANCE_PX;
  }

  function getResizeHandleAtPoint(clientX: number, clientY: number): ResizeEdge | null {
    if (!ctx.state.selected || !getCurrentScene()) {
      return null;
    }

    const stage = getStageEl();
    if (!stage) {
      return null;
    }

    const selectedItem = getSelectedOverlayItemBounds(getOverlayItemBounds());
    if (!selectedItem) {
      return null;
    }

    const rect = stage.getBoundingClientRect();
    const itemLeft = rect.left + (selectedItem.left / 100) * rect.width;
    const itemTop = rect.top + (selectedItem.top / 100) * rect.height;
    const itemWidth = (selectedItem.width / 100) * rect.width;
    const itemHeight = (selectedItem.height / 100) * rect.height;
    const itemRight = itemLeft + itemWidth;
    const itemBottom = itemTop + itemHeight;
    const itemMidY = itemTop + itemHeight / 2;

    const handlePoints: Array<{ edge: ResizeEdge; x: number; y: number }> = [
      { edge: "nw", x: itemLeft, y: itemTop },
      { edge: "ne", x: itemRight, y: itemTop },
      { edge: "sw", x: itemLeft, y: itemBottom },
      { edge: "se", x: itemRight, y: itemBottom },
      { edge: "w", x: itemLeft, y: itemMidY },
      { edge: "e", x: itemRight, y: itemMidY }
    ];

    for (const handle of handlePoints) {
      const dx = clientX - handle.x;
      const dy = clientY - handle.y;
      if (Math.hypot(dx, dy) <= RESIZE_HANDLE_HIT_RADIUS_PX) {
        return handle.edge;
      }
    }

    return null;
  }

  function findHitTarget(clientX: number, clientY: number): Selection | null {
    if (!ctx.state.overlayVisible) {
      return null;
    }

    const point = clientToFrame(clientX, clientY);
    if (!point) {
      return null;
    }

    const { frameX, frameY } = point;
    const overlayItems = getOverlayItemBounds();
    const resolvedLogo = getCurrentScene()?.logo;
    if (resolvedLogo) {
      const bounds = resolvedLogo.bounds;
      if (
        frameX >= bounds.left - HIT_SLOP_PX &&
        frameX <= bounds.right + HIT_SLOP_PX &&
        frameY >= bounds.top - HIT_SLOP_PX &&
        frameY <= bounds.bottom + HIT_SLOP_PX
      ) {
        return { kind: "logo", id: resolvedLogo.id };
      }
    }

    const texts = overlayItems.filter((item) => item.kind === "text").reverse();
    for (const text of texts) {
      if (
        frameX >= text.leftPx - HIT_SLOP_PX &&
        frameX <= text.rightPx + HIT_SLOP_PX &&
        frameY >= text.topPx - HIT_SLOP_PX &&
        frameY <= text.bottomPx + HIT_SLOP_PX
      ) {
        return { kind: "text", id: text.id };
      }
    }

    return null;
  }

  function getFrameDelta(clientX: number, clientY: number): { deltaXPx: number; deltaYPx: number } {
    if (!currentDrag) {
      return { deltaXPx: 0, deltaYPx: 0 };
    }

    const stage = getStageEl();
    if (!stage) {
      return { deltaXPx: 0, deltaYPx: 0 };
    }

    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return { deltaXPx: 0, deltaYPx: 0 };
    }

    return {
      deltaXPx: ((clientX - currentDrag.startClientX) / rect.width) * ctx.state.params.frame.widthPx,
      deltaYPx: ((clientY - currentDrag.startClientY) / rect.height) * ctx.state.params.frame.heightPx
    };
  }

  function render() {
    ctx.syncOverlayVisibilityUi();

    if (!ctx.state.overlayVisible) {
      if (authoringHoverBox) {
        authoringHoverBox.hidden = true;
      }
      if (authoringSelectedBox) {
        authoringSelectedBox.hidden = true;
      }
      if (authoringBaselineGuide) {
        authoringBaselineGuide.hidden = true;
      }

      const stage = getStageEl();
      if (stage) {
        stage.style.cursor = "";
      }
      return;
    }

    const items = getOverlayItemBounds();
    const { heightPx } = ctx.state.params.frame;

    if (authoringHoverBox && authoringHoverLabel) {
      const hoverItem = hoverId ? items.find((item) => item.id === hoverId) : undefined;
      const selectedId = ctx.state.selected?.id ?? null;
      if (hoverItem && hoverItem.id !== selectedId) {
        positionBox(authoringHoverBox, authoringHoverLabel, hoverItem);
      } else {
        authoringHoverBox.hidden = true;
      }
    }

    if (authoringSelectedBox && authoringSelectedLabel) {
      const selectedId = ctx.state.selected?.id ?? null;
      const selectedItem = selectedId ? items.find((item) => item.id === selectedId) : undefined;
      if (selectedItem) {
        positionBox(authoringSelectedBox, authoringSelectedLabel, selectedItem);
      } else {
        authoringSelectedBox.hidden = true;
      }
    }

    if (authoringBaselineGuide) {
      if (currentDrag?.hasMoved && currentDrag.selection.kind === "text") {
        const draggedSelectionId = currentDrag.selection.id;
        const draggedItem = items.find((item) => item.id === draggedSelectionId);
        if (draggedItem?.baselineYPx !== undefined) {
          authoringBaselineGuide.hidden = false;
          const lineCount = Math.max(1, draggedItem.lineCount ?? 1);
          const lineHeightPx = Math.max(1, draggedItem.lineHeightPx ?? 1);
          authoringBaselineGuide.replaceChildren();

          for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
            const line = document.createElement("div");
            line.className = "is-authoring-baseline-guide";
            line.style.top = `${((draggedItem.baselineYPx + lineIndex * lineHeightPx) / heightPx) * 100}%`;
            authoringBaselineGuide.appendChild(line);
          }
        } else {
          authoringBaselineGuide.hidden = true;
          authoringBaselineGuide.replaceChildren();
        }
      } else {
        authoringBaselineGuide.hidden = true;
        authoringBaselineGuide.replaceChildren();
      }
    }

    const stage = getStageEl();
    if (!stage) {
      return;
    }

    if (currentDrag?.mode === "resize" && currentDrag.resizeEdge) {
      stage.style.cursor = getResizeCursor(currentDrag.resizeEdge);
    } else if (currentDrag) {
      stage.style.cursor = "grabbing";
    } else if (hoverHandle) {
      stage.style.cursor = getResizeCursor(hoverHandle);
    } else if (hoverId) {
      stage.style.cursor = "grab";
    } else {
      stage.style.cursor = "";
    }
  }

  function resetInteractionState() {
    currentDrag = null;
    hoverId = null;
    hoverHandle = null;
    setDocumentSelectionSuppressed(false);
    closeInlineEditor();
  }

  function handleSelectionChange() {
    closeInlineEditor();
    ctx.buildConfigEditor();
    render();
  }

  function handlePointerDown(event: PointerEvent) {
    if (!ctx.state.overlayVisible || editSession || event.button !== 0) {
      return;
    }

    const currentScene = getCurrentScene();
    const resizeEdge = getResizeHandleAtPoint(event.clientX, event.clientY);
    if (resizeEdge && ctx.state.selected && currentScene) {
      const dragState: DragState = {
        selection: ctx.state.selected,
        metrics: currentScene.grid,
        startClientX: event.clientX,
        startClientY: event.clientY,
        hasMoved: false,
        mode: "resize",
        resizeEdge
      };

      if (ctx.state.selected.kind === "text") {
        dragState.initialField = ctx.state.params.textFields.find((field) => field.id === ctx.state.selected!.id);
      } else if (ctx.state.selected.kind === "logo") {
        dragState.initialLogo = ctx.state.params.logo ? { ...ctx.state.params.logo } : undefined;
      }

      currentDrag = dragState;
      setDocumentSelectionSuppressed(true);
      getStageEl()?.setPointerCapture(event.pointerId);
      render();
      event.preventDefault();
      return;
    }

    const hit = findHitTarget(event.clientX, event.clientY);
    if (!hit) {
      if (ctx.state.selected) {
        ctx.select(null);
      }
      return;
    }

    if (!isSameSelection(ctx.state.selected, hit)) {
      ctx.select(hit);
    }

    if (!currentScene) {
      return;
    }

    const dragState: DragState = {
      selection: hit,
      metrics: currentScene.grid,
      startClientX: event.clientX,
      startClientY: event.clientY,
      hasMoved: false,
      mode: "move"
    };

    if (hit.kind === "text") {
      dragState.initialField = ctx.state.params.textFields.find((field) => field.id === hit.id);
    } else if (hit.kind === "logo") {
      dragState.initialLogo = ctx.state.params.logo ? { ...ctx.state.params.logo } : undefined;
    }

    currentDrag = dragState;
    setDocumentSelectionSuppressed(true);
    getStageEl()?.setPointerCapture(event.pointerId);
    render();
    event.preventDefault();
  }

  function handlePointerMove(event: PointerEvent) {
    if (!ctx.state.overlayVisible) {
      if (hoverId !== null || hoverHandle !== null) {
        hoverId = null;
        hoverHandle = null;
        render();
      }
      return;
    }

    const currentScene = getCurrentScene();
    if (currentDrag && currentScene) {
      if (!currentDrag.hasMoved) {
        if (!hasDragActivationDistance(currentDrag, event.clientX, event.clientY)) {
          return;
        }
        currentDrag.hasMoved = true;
      }

      const delta = getFrameDelta(event.clientX, event.clientY);
      if (currentDrag.mode === "resize") {
        if (currentDrag.selection.kind === "text" && currentDrag.initialField) {
          const metrics = currentDrag.metrics;
          const columnStepPx = metrics.columnWidthPx + metrics.columnGutterPx;
          const edge = currentDrag.resizeEdge;
          let horizontalUpdate: Partial<TextFieldPlacementSpec> = {};
          let verticalUpdate: Partial<TextFieldPlacementSpec> = {};

          if (edge === "e" || edge === "ne" || edge === "se") {
            const spanDelta = columnStepPx > 0 ? Math.round(delta.deltaXPx / columnStepPx) : 0;
            const maxSpan = metrics.columnCount - currentDrag.initialField.keylineIndex + 1;
            const nextSpan = Math.max(1, Math.min(maxSpan, currentDrag.initialField.columnSpan + spanDelta));
            horizontalUpdate = { columnSpan: nextSpan };
          } else if (edge === "w" || edge === "nw" || edge === "sw") {
            const columnDelta = columnStepPx > 0 ? Math.round(delta.deltaXPx / columnStepPx) : 0;
            const nextKeyline = Math.max(
              1,
              Math.min(
                currentDrag.initialField.keylineIndex + currentDrag.initialField.columnSpan - 1,
                currentDrag.initialField.keylineIndex + columnDelta
              )
            );
            const keylineDiff = nextKeyline - currentDrag.initialField.keylineIndex;
            const nextSpan = Math.max(1, currentDrag.initialField.columnSpan - keylineDiff);
            horizontalUpdate = { keylineIndex: nextKeyline, columnSpan: nextSpan };
          }

          if (edge === "ne" || edge === "nw") {
            const rowStepPx = metrics.rowHeightPx + metrics.rowGutterPx;
            const initialRowTopPx = metrics.contentTopPx + (currentDrag.initialField.rowIndex - 1) * rowStepPx;
            const initialBaselineYPx = initialRowTopPx + currentDrag.initialField.offsetBaselines * metrics.baselineStepPx;
            const snapped = snapBaselineToGrid(metrics, initialBaselineYPx + delta.deltaYPx);
            verticalUpdate = { rowIndex: snapped.rowIndex, offsetBaselines: snapped.offsetBaselines };
          }

          ctx.updateTextField(currentDrag.selection.id, (field) => ({ ...field, ...horizontalUpdate, ...verticalUpdate }));
          void ctx.renderStage();
        }

        if (currentDrag.selection.kind === "logo" && currentDrag.initialLogo) {
          const initialLogo = currentDrag.initialLogo;
          const edge = currentDrag.resizeEdge;
          let nextWidth = initialLogo.widthPx;
          let nextHeight = initialLogo.heightPx;
          let nextX = initialLogo.xPx;
          let nextY = initialLogo.yPx;
          const aspect = initialLogo.widthPx / (initialLogo.heightPx || 1);

          if (edge === "se" || edge === "e" || edge === "ne") {
            nextWidth = Math.max(16, initialLogo.widthPx + delta.deltaXPx);
            if (edge !== "e") {
              nextHeight = nextWidth / aspect;
            }
            if (edge === "ne") {
              nextY = initialLogo.yPx + initialLogo.heightPx - nextHeight;
            }
          } else if (edge === "sw" || edge === "w" || edge === "nw") {
            nextWidth = Math.max(16, initialLogo.widthPx - delta.deltaXPx);
            nextX = initialLogo.xPx + initialLogo.widthPx - nextWidth;
            if (edge !== "w") {
              nextHeight = nextWidth / aspect;
            }
            if (edge === "nw") {
              nextY = initialLogo.yPx + initialLogo.heightPx - nextHeight;
            }
          }

          ctx.updateLogo(() => ({
            ...initialLogo,
            xPx: nextX,
            yPx: nextY,
            widthPx: nextWidth,
            heightPx: nextHeight
          }));
          ctx.syncTitleToLogoHeight(nextHeight);
          void ctx.renderStage();
        }

        event.preventDefault();
        return;
      }

      const axisLock: DragAxisLock = event.shiftKey
        ? Math.abs(delta.deltaXPx) >= Math.abs(delta.deltaYPx)
          ? "x"
          : "y"
        : "free";

      if (currentDrag.selection.kind === "text" && currentDrag.initialField) {
        const result = moveTextField(currentDrag.initialField, currentDrag.metrics, { ...delta, axisLock });
        ctx.updateTextField(currentDrag.selection.id, () => result);
        void ctx.renderStage();
      }

      if (currentDrag.selection.kind === "logo" && currentDrag.initialLogo) {
        const result = moveLogo(currentDrag.initialLogo, { ...delta, axisLock });
        ctx.updateLogo(() => result);
        void ctx.renderStage();
      }

      event.preventDefault();
      return;
    }

    const nextHoverHandle = getResizeHandleAtPoint(event.clientX, event.clientY);
    const hit = findHitTarget(event.clientX, event.clientY);
    const nextHoverId = hit ? hit.id : null;
    if (nextHoverId !== hoverId || nextHoverHandle !== hoverHandle) {
      hoverId = nextHoverId;
      hoverHandle = nextHoverHandle;
      render();
    }
  }

  function handlePointerUp() {
    if (!currentDrag) {
      return;
    }

    const didMutateDocument = currentDrag.hasMoved;
    currentDrag = null;
    setDocumentSelectionSuppressed(false);
    if (didMutateDocument) {
      ctx.markDocumentDirty();
      ctx.syncSelectedOverlaySectionInputs();
    }
    render();
  }

  function handlePointerCancel() {
    if (!currentDrag) {
      return;
    }

    currentDrag = null;
    setDocumentSelectionSuppressed(false);
    render();
  }

  function handleDoubleClick(event: MouseEvent) {
    if (!ctx.state.overlayVisible) {
      return;
    }

    const hit = findHitTarget(event.clientX, event.clientY);
    if (hit && hit.kind === "text" && ctx.getContentSource() === "inline") {
      openInlineEditor(hit.id);
    }
  }

  function handleEditingKeyDown(event: KeyboardEvent): boolean {
    if (!editSession || event.key !== "Escape") {
      return false;
    }

    closeInlineEditor();
    event.preventDefault();
    return true;
  }

  function handleInteractionKeyDown(event: KeyboardEvent): boolean {
    if (event.key !== "Escape" || !currentDrag) {
      return false;
    }

    currentDrag = null;
    setDocumentSelectionSuppressed(false);
    render();
    event.preventDefault();
    return true;
  }

  function init() {
    if (isInitialized) {
      return;
    }

    const layer = getAuthoringLayerEl();
    if (layer) {
      const hover = createAuthoringBox("is-authoring-box is-hover");
      authoringHoverBox = hover.box;
      authoringHoverLabel = hover.label;

      const selected = createAuthoringBox("is-authoring-box is-selected");
      authoringSelectedBox = selected.box;
      authoringSelectedLabel = selected.label;

      for (const edge of ["nw", "ne", "sw", "se", "e", "w"] as ResizeEdge[]) {
        const handle = document.createElement("div");
        handle.className = `is-authoring-handle is-${edge}`;
        handle.dataset.resizeEdge = edge;
        authoringSelectedBox.appendChild(handle);
      }

      authoringBaselineGuide = document.createElement("div");
      authoringBaselineGuide.className = "is-authoring-baseline-guides";
      authoringBaselineGuide.hidden = true;

      layer.append(authoringHoverBox, authoringSelectedBox, authoringBaselineGuide);
    }

    const stage = getStageEl();
    if (stage) {
      stage.addEventListener("pointerdown", handlePointerDown);
      stage.addEventListener("pointermove", handlePointerMove);
      stage.addEventListener("pointerup", handlePointerUp);
      stage.addEventListener("pointercancel", handlePointerCancel);
      stage.addEventListener("dblclick", handleDoubleClick);
    }

    isInitialized = true;
  }

  return {
    init,
    render,
    handleSelectionChange,
    handleEditingKeyDown,
    handleInteractionKeyDown,
    resetInteractionState
  };
}