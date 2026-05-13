import {
  initPanelDrawers,
  initResizableAsides,
  initTopNavigations
} from "./vendor/baseline-foundry/index.js";
import {
  createCheckboxFormGroup,
  createFormGroup,
  createNumberInput
} from "@brand-layout-ops/parameter-ui";
import {
  OVERLAY_FORMAT_PRESET_ORDER,
  getOverlayFormatPresetDefinition,
  getOverlayFormatSeedSummary,
  getOverlayFormatSafeAreaFrame
} from "@brand-layout-ops/operator-overlay-layout";

import {
  renderDocumentWorkspaceUi,
  type DocumentWorkspaceController
} from "./document-workspace.js";
import type {
  GuideMode,
  OverlayPreviewDocument,
  PreviewState
} from "./preview-app-context.js";
import type { SourceDefaultController } from "./source-default-controller.js";

const GUIDE_MODES: readonly GuideMode[] = ["off", "composition", "baseline"];
const DOCKED_VIEWPORT_MIN_WIDTH_PX = 960;

type ControlPanelView = "parameters" | "formats";

type MenuItemSpec =
  | { kind: "separator" }
  | {
      kind?: "action";
      label: string;
      shortcut?: string;
      disabled?: boolean;
      dataAttribute?: string;
      onClick: (button: HTMLButtonElement) => void | Promise<void>;
      onError?: (error: unknown) => void;
    };

interface ShellDialogRefs {
  documentDialog: HTMLDialogElement | null;
  formatsDialog: HTMLDialogElement | null;
  presetLibraryDialog: HTMLDialogElement | null;
  exportSettingsDialog: HTMLDialogElement | null;
  exportNameInput: HTMLInputElement | null;
  exportFrameRateInput: HTMLInputElement | null;
  exportTransparentInput: HTMLInputElement | null;
  exportProfileSummary: HTMLElement | null;
  sourceDefaultDialog: HTMLDialogElement | null;
}

export interface PreviewShellControllerDeps {
  readonly state: PreviewState;
  readonly untitledName: string;
  readonly guideModeStorageKey: string;
  readonly documentWorkspace: DocumentWorkspaceController<OverlayPreviewDocument>;
  readonly sourceDefaultController: SourceDefaultController;
  markDocumentDirty(): void;
  loadLogoIntrinsicDimensions(assetPath: string): Promise<void>;
  buildConfigEditor(): void;
  buildFormatOptions(): void;
  renderStage(): Promise<void>;
  resizeRenderer(): void;
  togglePlayback(): void;
  ensurePlaybackLoop(): void;
  updateExportSettings(
    updater: (settings: PreviewState["exportSettings"]) => PreviewState["exportSettings"]
  ): void;
  setOverlayVisible(visible: boolean): void;
  setNetworkOverlayVisible(visible: boolean): void;
  addDocumentFormat(): boolean;
  removeActiveDocumentFormat(): boolean;
  exportComposedFramePng(): Promise<void>;
  exportPngSequence(): Promise<void>;
  exportMp4(): Promise<void>;
  initHaloRenderer(): void;
  initAuthoring(): void;
  deleteSelectedOverlayItem(): boolean;
  undoHistory(): Promise<boolean>;
  redoHistory(): Promise<boolean>;
  handleAuthoringEditingKeyDown(event: KeyboardEvent): boolean;
  handleAuthoringInteractionKeyDown(event: KeyboardEvent): boolean;
}

export interface PreviewShellController {
  updateDocumentUi(): void;
  updateViewUi(): void;
  init(): Promise<void>;
}

export function createPreviewShellController(
  deps: PreviewShellControllerDeps
): PreviewShellController {
  let destroyResizableAsides: (() => void) | null = null;
  let stageShellResizeObserver: ResizeObserver | null = null;
  let pendingStageResizeFrame = 0;
  let hasBoundDocumentInputs = false;
  let hasBoundControlPanelToggle = false;
  let hasBoundControlPanelDismiss = false;
  let hasBoundResize = false;
  let isInitialized = false;
  let controlPanelView: ControlPanelView = "parameters";

  const shellDialogs: ShellDialogRefs = {
    documentDialog: null,
    formatsDialog: null,
    presetLibraryDialog: null,
    exportSettingsDialog: null,
    exportNameInput: null,
    exportFrameRateInput: null,
    exportTransparentInput: null,
    exportProfileSummary: null,
    sourceDefaultDialog: null
  };

  const $ = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);

  function getConfigEditor(): HTMLElement | null {
    return $("[data-config-editor]");
  }

  function getTopNavigationEl(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".bf-top-navigation");
  }

  function getAppShellEl(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".bf-application");
  }

  function getControlPanelEl(): HTMLElement | null {
    return $("[data-control-panel]");
  }

  function getControlPanelToggleEl(): HTMLElement | null {
    return $("[data-control-panel-toggle]");
  }

  function getControlPanelTitleEl(): HTMLElement | null {
    return $("[data-control-panel-title]");
  }

  function getControlPanelDismissEl(): HTMLButtonElement | null {
    return $("[data-control-panel-dismiss]");
  }

  function getParametersPanelViewEl(): HTMLElement | null {
    return $("[data-panel-parameters-view]");
  }

  function getFormatsPanelViewEl(): HTMLElement | null {
    return $("[data-panel-formats-view]");
  }

  function getControlPanelOverlayEl(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".bf-application-overlay");
  }

  function getStageShellEl(): HTMLElement | null {
    return $(`[data-stage-shell]`);
  }

  function getDocumentSummaryEl(): HTMLElement | null {
    return $("[data-document-summary]");
  }

  function getDocumentStatusEl(): HTMLElement | null {
    return $("[data-document-status]");
  }

  function getDocumentRecentListEl(): HTMLElement | null {
    return $("[data-document-recent-list]");
  }

  function getDocumentTitleEl(): HTMLElement | null {
    return $("[data-document-title]");
  }

  function getFileMenuEl(): HTMLElement | null {
    return $("[data-file-menu]");
  }

  function getViewMenuEl(): HTMLElement | null {
    return $("[data-view-menu]");
  }

  function collapseTopNavigation(): void {
    const topNavigation = getTopNavigationEl();
    if (!topNavigation) {
      return;
    }

    topNavigation.classList.remove("has-menu-open", "has-search-open");
    for (const dropdownItem of topNavigation.querySelectorAll<HTMLElement>(".bf-top-navigation-item.is-dropdown-toggle")) {
      dropdownItem.classList.remove("is-active");
    }
  }

  function applyControlPanelView(): void {
    const controlPanel = getControlPanelEl();
    const title = getControlPanelTitleEl();
    const dismissButton = getControlPanelDismissEl();
    const parametersView = getParametersPanelViewEl();
    const formatsView = getFormatsPanelViewEl();
    const isDocked = isDockedViewport();

    controlPanel?.setAttribute("data-panel-view", controlPanelView);
    if (title) {
      title.textContent = controlPanelView === "formats" ? "Formats" : "Parameters";
    }
    if (dismissButton) {
      dismissButton.textContent = controlPanelView === "formats" ? "Done" : "Close";
      dismissButton.hidden = isDocked && controlPanelView === "parameters";
    }
    if (parametersView) {
      parametersView.hidden = controlPanelView !== "parameters";
    }
    if (formatsView) {
      formatsView.hidden = controlPanelView !== "formats";
    }
  }

  function setControlPanelView(nextView: ControlPanelView): void {
    if (controlPanelView === nextView) {
      applyControlPanelView();
      return;
    }

    controlPanelView = nextView;
    applyControlPanelView();
  }

  function openFormatsPanel(): void {
    syncFormatsDialog();
    setControlPanelView("formats");
    setDrawerOpen(true);
  }

  function dismissControlPanel(): void {
    if (controlPanelView !== "parameters") {
      setControlPanelView("parameters");
      setDrawerOpen(true);
      return;
    }

    if (isDockedViewport()) {
      setDrawerOpen(true);
      return;
    }

    setDrawerOpen(false);
  }

  function queueStageResizeRefresh(): void {
    if (pendingStageResizeFrame !== 0) {
      cancelAnimationFrame(pendingStageResizeFrame);
    }

    pendingStageResizeFrame = window.requestAnimationFrame(() => {
      pendingStageResizeFrame = 0;
      deps.resizeRenderer();
    });
  }

  function createMenuActionButton(
    label: string,
    options: {
      shortcut?: string;
      disabled?: boolean;
      dataAttribute?: string;
      onClick: (button: HTMLButtonElement) => void | Promise<void>;
      onError?: (error: unknown) => void;
    }
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bf-top-navigation-dropdown-item";

    const labelEl = document.createElement("span");
    labelEl.className = "bf-top-navigation-dropdown-item-label";
    labelEl.textContent = label;
    button.append(labelEl);

    if (options.shortcut) {
      const shortcutEl = document.createElement("span");
      shortcutEl.className = "bf-top-navigation-dropdown-item-shortcut";
      shortcutEl.textContent = options.shortcut;
      shortcutEl.setAttribute("aria-hidden", "true");
      button.append(shortcutEl);
    }

    button.disabled = options.disabled ?? false;
    if (options.dataAttribute) {
      button.setAttribute(options.dataAttribute, "");
    }
    button.addEventListener("click", () => {
      if (button.disabled) {
        return;
      }

      collapseTopNavigation();
      Promise.resolve(options.onClick(button)).catch((error: unknown) => {
        options.onError?.(error);
      });
    });
    return button;
  }

  function buildMenu(menu: HTMLElement | null, items: MenuItemSpec[]): void {
    if (!menu) {
      return;
    }

    menu.innerHTML = "";

    for (const itemSpec of items) {
      const item = document.createElement("li");
      if (itemSpec.kind === "separator") {
        item.className = "is-divider";
        item.setAttribute("role", "separator");
        menu.append(item);
        continue;
      }

      const buttonOptions = {
        onClick: itemSpec.onClick,
        ...(itemSpec.shortcut ? { shortcut: itemSpec.shortcut } : {}),
        ...(itemSpec.disabled !== undefined ? { disabled: itemSpec.disabled } : {}),
        ...(itemSpec.dataAttribute ? { dataAttribute: itemSpec.dataAttribute } : {}),
        ...(itemSpec.onError ? { onError: itemSpec.onError } : {})
      };
      item.append(
        createMenuActionButton(itemSpec.label, buttonOptions)
      );
      menu.append(item);
    }
  }

  function createShellModal(
    id: string,
    title: string
  ): { dialog: HTMLDialogElement; body: HTMLElement; footer: HTMLElement } {
    const dialog = document.createElement("dialog");
    dialog.id = id;
    dialog.className = "bf-modal";
    dialog.setAttribute("data-shell-modal", "");
    dialog.innerHTML = `
      <div class="bf-modal-dialog" role="dialog" aria-labelledby="${id}-title">
        <header class="bf-modal-header">
          <h2 class="bf-modal-title" id="${id}-title">${title}</h2>
          <button class="bf-modal-close" data-modal-close type="button">Close</button>
        </header>
        <div class="bf-modal-body bf-grid-scope"></div>
        <footer class="bf-modal-footer"></footer>
      </div>
    `;

    const body = dialog.querySelector<HTMLElement>(".bf-modal-body");
    const footer = dialog.querySelector<HTMLElement>(".bf-modal-footer");
    if (!body || !footer) {
      throw new Error(`Failed to build shell modal: ${id}`);
    }

    dialog.querySelector<HTMLElement>("[data-modal-close]")?.addEventListener("click", () => {
      dialog.close();
    });

    return { dialog, body, footer };
  }

  function showDialog(dialog: HTMLDialogElement): void {
    if (!dialog.isConnected) {
      document.body.append(dialog);
    }

    if (!dialog.open) {
      dialog.showModal();
    }
  }

  function createFooterButton(label: string, variant: "base" | "primary" = "base"): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = variant === "primary" ? "bf-button" : "bf-button is-base";
    button.textContent = label;
    return button;
  }

  function ensureDocumentDialog(): void {
    if (shellDialogs.documentDialog) {
      return;
    }

    const { dialog, body, footer } = createShellModal("document-workspace-modal", "Open Recent");
    const stack = document.createElement("div");
    stack.className = "bf-stack is-compact-stack";

    const help = document.createElement("p");
    help.className = "bf-form-help bf-u-no-margin--bottom";
    help.textContent = "File naming comes from save and open. Use this dialog for the current file status and recent local documents.";
    stack.append(help);

    const summary = document.createElement("p");
    summary.className = "bf-form-help bf-u-no-margin--bottom";
    summary.setAttribute("data-document-summary", "");
    stack.append(summary);

    const status = document.createElement("p");
    status.className = "bf-form-help bf-u-no-margin--bottom";
    status.setAttribute("data-document-status", "");
    stack.append(status);

    const recentHeading = document.createElement("p");
    recentHeading.className = "bf-form-help bf-u-no-margin--bottom";
    recentHeading.textContent = "Recent local documents";
    stack.append(recentHeading);

    const recentList = document.createElement("div");
    recentList.setAttribute("data-document-recent-list", "");
    stack.append(recentList);

    body.append(stack);

    const closeButton = createFooterButton("Close");
    closeButton.addEventListener("click", () => dialog.close());
    footer.append(closeButton);

    document.body.append(dialog);
    shellDialogs.documentDialog = dialog;
  }

  function syncFormatsDialog(): void {
    deps.buildFormatOptions();
  }

  function ensureFormatsDialog(): void {
    if (shellDialogs.formatsDialog) {
      return;
    }

    const { dialog, body, footer } = createShellModal("formats-modal", "Formats");
    const stack = document.createElement("div");
    stack.className = "bf-stack is-compact-stack";

    const optionsContainer = document.createElement("div");
    optionsContainer.className = "bf-grid-scope";
    optionsContainer.setAttribute("data-format-options", "");
    stack.append(optionsContainer);

    body.append(stack);

    const closeButton = createFooterButton("Done", "primary");
    closeButton.addEventListener("click", () => dialog.close());

    footer.append(closeButton);

    document.body.append(dialog);
    shellDialogs.formatsDialog = dialog;
  }

  function syncPresetLibraryDialog(): void {
    const dialog = shellDialogs.presetLibraryDialog;
    if (!dialog) {
      return;
    }

    const summary = dialog.querySelector<HTMLElement>("[data-preset-library-summary]");
    const list = dialog.querySelector<HTMLElement>("[data-preset-library-list]");
    if (!summary || !list) {
      return;
    }

    summary.textContent = `${OVERLAY_FORMAT_PRESET_ORDER.length} global preset${OVERLAY_FORMAT_PRESET_ORDER.length === 1 ? "" : "s"}. Add one to the current document from Formats; after that, the document owns safe-area and grid overrides.`;

    list.innerHTML = "";

    const table = document.createElement("table");
    table.className = "bf-table";
    table.setAttribute("data-preset-library-table", "");
    table.setAttribute("aria-label", "Global format presets");

    const thead = document.createElement("thead");
    const headingRow = document.createElement("tr");
    for (const heading of ["Preset", "Frame", "Safe Area", "Grid Seed"]) {
      const cell = document.createElement("th");
      cell.textContent = heading;
      headingRow.append(cell);
    }
    thead.append(headingRow);
    table.append(thead);

    const tbody = document.createElement("tbody");
    for (const presetKey of OVERLAY_FORMAT_PRESET_ORDER) {
      const preset = getOverlayFormatPresetDefinition(presetKey);
      if (!preset) {
        continue;
      }

      const safeAreaFrame = getOverlayFormatSafeAreaFrame(preset);
      const row = document.createElement("tr");

      const presetCell = document.createElement("td");
      presetCell.textContent = preset.label;

      const frameCell = document.createElement("td");
      frameCell.textContent = `${preset.frame.widthPx}x${preset.frame.heightPx}`;

      const safeAreaCell = document.createElement("td");
      safeAreaCell.textContent = `${safeAreaFrame.widthPx}x${safeAreaFrame.heightPx}`;
      const safeAreaMeta = document.createElement("div");
      safeAreaMeta.className = "bf-form-help bf-u-no-margin--bottom";
      safeAreaMeta.textContent = `Insets t${preset.safeArea.top} r${preset.safeArea.right} b${preset.safeArea.bottom} l${preset.safeArea.left}`;
      safeAreaCell.append(safeAreaMeta);

      const gridCell = document.createElement("td");
      gridCell.textContent = getOverlayFormatSeedSummary(preset);
      const gridMeta = document.createElement("div");
      gridMeta.className = "bf-form-help bf-u-no-margin--bottom";
      gridMeta.textContent = preset.grid.fitWithinSafeArea === false
        ? "Grid uses the full frame by default."
        : "Grid fits within the safe area by default.";
      gridCell.append(gridMeta);

      row.append(presetCell, frameCell, safeAreaCell, gridCell);
      tbody.append(row);
    }

    table.append(tbody);
    list.append(table);
  }

  function ensurePresetLibraryDialog(): void {
    if (shellDialogs.presetLibraryDialog) {
      return;
    }

    const { dialog, body, footer } = createShellModal("preset-library-modal", "Preset Library");
    const stack = document.createElement("div");
    stack.className = "bf-stack is-compact-stack";

    const help = document.createElement("p");
    help.className = "bf-form-help bf-u-no-margin--bottom";
    help.textContent = "Global presets seed frame, safe area, and grid together. Add one in Formats, then treat the document format as the editable authority.";
    stack.append(help);

    const summary = document.createElement("p");
    summary.className = "bf-form-help bf-u-no-margin--bottom";
    summary.setAttribute("data-preset-library-summary", "");
    stack.append(summary);

    const list = document.createElement("div");
    list.className = "bf-grid-scope";
    list.setAttribute("data-preset-library-list", "");
    stack.append(list);

    body.append(stack);

    const openFormatsButton = createFooterButton("Open Formats", "primary");
    openFormatsButton.addEventListener("click", () => {
      dialog.close();
      openFormatsPanel();
    });
    footer.append(openFormatsButton);

    const closeButton = createFooterButton("Close");
    closeButton.addEventListener("click", () => dialog.close());
    footer.append(closeButton);

    document.body.append(dialog);
    shellDialogs.presetLibraryDialog = dialog;
  }

  function syncExportSettingsDialog(): void {
    const { exportNameInput, exportFrameRateInput, exportTransparentInput, exportProfileSummary } = shellDialogs;

    if (exportNameInput && document.activeElement !== exportNameInput) {
      exportNameInput.value = deps.state.exportSettings.exportName;
    }

    if (exportFrameRateInput && document.activeElement !== exportFrameRateInput) {
      exportFrameRateInput.value = String(Math.max(1, Math.round(deps.state.exportSettings.frameRate)));
    }

    if (exportTransparentInput) {
      exportTransparentInput.checked = deps.state.exportSettings.transparentBackground;
    }

    if (exportProfileSummary) {
      exportProfileSummary.textContent = `${deps.state.params.frame.widthPx}x${deps.state.params.frame.heightPx} active export surface`;
    }
  }

  function ensureExportSettingsDialog(): void {
    if (shellDialogs.exportSettingsDialog) {
      return;
    }

    const { dialog, body, footer } = createShellModal("export-settings-modal", "Export Settings");
    const stack = document.createElement("div");
    stack.className = "bf-stack is-compact-stack";

    const help = document.createElement("p");
    help.className = "bf-form-help bf-u-no-margin--bottom";
    help.textContent = "These settings persist with the current output profile and feed the export commands in the File menu.";
    stack.append(help);

    const summary = document.createElement("p");
    summary.className = "bf-form-help bf-u-no-margin--bottom";
    stack.append(summary);

    const exportNameInput = document.createElement("input");
    exportNameInput.type = "text";
    exportNameInput.className = "bf-input is-dense";
    exportNameInput.addEventListener("change", () => {
      deps.updateExportSettings((settings) => ({
        ...settings,
        exportName: exportNameInput.value.trim() || "Export"
      }));
      deps.markDocumentDirty();
      syncExportSettingsDialog();
    });
    stack.append(createFormGroup("Export Name", exportNameInput));

    const frameRateInput = createNumberInput(
      Math.max(1, Math.round(deps.state.exportSettings.frameRate)),
      { min: 1, max: 120, step: 1 },
      (value) => {
        deps.updateExportSettings((settings) => ({
          ...settings,
          frameRate: Math.max(1, Math.round(value))
        }));
        deps.markDocumentDirty();
        syncExportSettingsDialog();
      }
    );
    stack.append(createFormGroup("Frame Rate", frameRateInput));

    const transparentField = createCheckboxFormGroup(
      "Transparent PNG background",
      deps.state.exportSettings.transparentBackground,
      (checked) => {
        deps.updateExportSettings((settings) => ({
          ...settings,
          transparentBackground: checked
        }));
        deps.markDocumentDirty();
        syncExportSettingsDialog();
        void deps.renderStage();
      },
      (input) => {
        input.setAttribute("data-export-transparent-background", "");
      }
    );
    stack.append(transparentField);

    body.append(stack);

    const closeButton = createFooterButton("Close", "primary");
    closeButton.addEventListener("click", () => dialog.close());
    footer.append(closeButton);

    document.body.append(dialog);
    shellDialogs.exportSettingsDialog = dialog;
    shellDialogs.exportNameInput = exportNameInput;
    shellDialogs.exportFrameRateInput = frameRateInput;
    shellDialogs.exportTransparentInput = transparentField.querySelector<HTMLInputElement>("input");
    shellDialogs.exportProfileSummary = summary;
  }

  function ensureSourceDefaultDialog(): void {
    if (shellDialogs.sourceDefaultDialog) {
      return;
    }

    const { dialog, body, footer } = createShellModal("source-default-modal", "Source Defaults");
    const stack = document.createElement("div");
    stack.className = "bf-stack is-compact-stack";

    const help = document.createElement("p");
    help.className = "bf-form-help bf-u-no-margin--bottom";
    help.textContent = "Source defaults are the repo-backed authoring starting point. Reset and save live here so they stay discoverable without occupying the Parameters rail.";
    stack.append(help);

    const status = document.createElement("p");
    status.className = "bf-form-help bf-u-no-margin--bottom";
    status.setAttribute("data-source-default-status", "");
    status.textContent = "Source defaults are using the built-in preview snapshot.";
    stack.append(status);

    body.append(stack);

    const resetButton = createFooterButton("Reset");
    resetButton.addEventListener("click", () => {
      deps.sourceDefaultController.applySourceDefaultSnapshot(deps.state.sourceDefaults);
      deps.markDocumentDirty();
      deps.state.playbackTimeSec = 0;
      deps.resizeRenderer();
      syncFormatsDialog();
      syncExportSettingsDialog();
      deps.buildConfigEditor();
      deps.sourceDefaultController.setSourceDefaultStatus("Reset to source default.");
      void deps.renderStage();
    });

    const saveButton = createFooterButton("Save as Default", "primary");
    saveButton.addEventListener("click", () => {
      saveButton.disabled = true;
      deps.sourceDefaultController.setSourceDefaultStatus("Saving source default...");
      void (async () => {
        try {
          const result = await deps.sourceDefaultController.writeCurrentAsSourceDefault();
          deps.sourceDefaultController.setSourceDefaultStatus(result.message, "success");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Source default save failed.";
          deps.sourceDefaultController.setSourceDefaultStatus(`Source default save failed: ${message}`, "error");
        } finally {
          saveButton.disabled = false;
        }
      })();
    });

    const closeButton = createFooterButton("Close");
    closeButton.addEventListener("click", () => dialog.close());

    footer.append(resetButton, closeButton, saveButton);

    document.body.append(dialog);
    shellDialogs.sourceDefaultDialog = dialog;
  }

  function ensureShellDialogs(): void {
    ensureDocumentDialog();
    ensurePresetLibraryDialog();
    ensureExportSettingsDialog();
    ensureSourceDefaultDialog();
  }

  function openDocumentDialog(): void {
    ensureDocumentDialog();
    updateDocumentUi();
    showDialog(shellDialogs.documentDialog!);
  }

  function openFormatsDialog(): void {
    openFormatsPanel();
  }

  function openPresetLibraryDialog(): void {
    ensurePresetLibraryDialog();
    syncPresetLibraryDialog();
    showDialog(shellDialogs.presetLibraryDialog!);
  }

  function openExportSettingsDialog(): void {
    ensureExportSettingsDialog();
    syncExportSettingsDialog();
    showDialog(shellDialogs.exportSettingsDialog!);
  }

  function openSourceDefaultDialog(): void {
    ensureSourceDefaultDialog();
    showDialog(shellDialogs.sourceDefaultDialog!);
  }

  function refreshResizableAsidesRuntime(): void {
    destroyResizableAsides?.();
    destroyResizableAsides = initResizableAsides();
  }

  function isDockedViewport(): boolean {
    return window.innerWidth >= DOCKED_VIEWPORT_MIN_WIDTH_PX;
  }

  function updateDocumentUi(): void {
    const normalizedName = deps.documentWorkspace.getNormalizedName(deps.documentWorkspace.state.name);
    const documentTitleEl = getDocumentTitleEl();
    if (documentTitleEl) {
      documentTitleEl.textContent = deps.documentWorkspace.state.isDirty ? `${normalizedName} *` : normalizedName;
      documentTitleEl.setAttribute("title", deps.documentWorkspace.state.fileName ?? normalizedName);
    }

    renderDocumentWorkspaceUi({
      workspace: deps.documentWorkspace.state,
      untitledName: deps.untitledName,
      elements: {
        nameInput: null,
        summaryEl: getDocumentSummaryEl(),
        statusEl: getDocumentStatusEl(),
        recentListEl: getDocumentRecentListEl()
      },
      actions: {
        reopenRecentDocument: (recentDocumentId) => deps.documentWorkspace.openRecentDocument(recentDocumentId),
        forgetRecentDocument: (recentDocumentId) => deps.documentWorkspace.forgetRecentDocument(recentDocumentId)
      }
    });
  }

  function setGuideMode(nextGuideMode: GuideMode): void {
    if (deps.state.guideMode === nextGuideMode) {
      updateViewUi();
      return;
    }

    deps.state.guideMode = nextGuideMode;
    try {
      localStorage.setItem(deps.guideModeStorageKey, deps.state.guideMode);
    } catch {
      // Ignore storage quota errors.
    }
    updateViewUi();
    void deps.renderStage();
  }

  function buildFileMenu(): void {
    buildMenu(getFileMenuEl(), [
      {
        label: "New",
        shortcut: "^N",
        onClick: () => deps.documentWorkspace.createNewDocument(),
        onError: (error: unknown) => {
          console.error("[file-menu] New failed:", error);
          deps.documentWorkspace.setStatus(
            `New failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            "error"
          );
        }
      },
      {
        label: "Open...",
        shortcut: "^O",
        onClick: () => deps.documentWorkspace.openDocumentFromDisk(),
        onError: (error: unknown) => {
          console.error("[file-menu] Open failed:", error);
          deps.documentWorkspace.setStatus(
            `Open failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            "error"
          );
        }
      },
      {
        label: "Open Recent...",
        onClick: () => openDocumentDialog()
      },
      {
        label: "Save",
        shortcut: "^S",
        onClick: async () => {
          await deps.documentWorkspace.saveCurrentDocument(false);
        },
        onError: (error: unknown) => {
          console.error("[file-menu] Save failed:", error);
          deps.documentWorkspace.setStatus(
            `Save failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            "error"
          );
        }
      },
      {
        label: "Save As...",
        shortcut: "^Shift+S",
        onClick: async () => {
          await deps.documentWorkspace.saveCurrentDocument(true);
        },
        onError: (error: unknown) => {
          console.error("[file-menu] Save As failed:", error);
          deps.documentWorkspace.setStatus(
            `Save As failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            "error"
          );
        }
      },
      {
        label: "Duplicate",
        onClick: () => deps.documentWorkspace.duplicateCurrentDocument(),
        onError: (error: unknown) => {
          console.error("[file-menu] Duplicate failed:", error);
          deps.documentWorkspace.setStatus(
            `Duplicate failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            "error"
          );
        }
      },
      { kind: "separator" },
      { label: "Formats...", shortcut: "D", onClick: () => openFormatsDialog() },
      { label: "Preset Library...", onClick: () => openPresetLibraryDialog() },
      { label: "Source Defaults...", onClick: () => openSourceDefaultDialog() },
      { kind: "separator" },
      { label: "Export Settings...", shortcut: "E", onClick: () => openExportSettingsDialog() },
      {
        label: "Export PNG",
        onClick: () => deps.exportComposedFramePng(),
        onError: (error: unknown) => {
          console.error("[file-menu] Export PNG failed:", error);
        }
      },
      {
        label: "Export PNG Sequence...",
        onClick: () => deps.exportPngSequence(),
        onError: (error: unknown) => {
          console.error("[file-menu] Export PNG Sequence failed:", error);
        }
      },
      {
        label: "Export MP4...",
        onClick: () => deps.exportMp4(),
        onError: (error: unknown) => {
          console.error("[file-menu] Export MP4 failed:", error);
        }
      }
    ]);
  }

  function buildViewMenu(): void {
    buildMenu(getViewMenuEl(), [
      {
        label: deps.state.overlayVisible ? "Hide Overlay" : "Show Overlay",
        shortcut: "O",
        onClick: () => {
          deps.setOverlayVisible(!deps.state.overlayVisible);
          updateViewUi();
        }
      },
      {
        label: deps.state.networkOverlayVisible ? "Hide Network Overlay" : "Show Network Overlay",
        shortcut: "N",
        onClick: () => {
          deps.setNetworkOverlayVisible(!deps.state.networkOverlayVisible);
          updateViewUi();
        }
      },
      { kind: "separator" },
      {
        label: "Composition Guides",
        disabled: deps.state.guideMode === "composition",
        onClick: () => setGuideMode("composition")
      },
      {
        label: "Baseline Grid",
        disabled: deps.state.guideMode === "baseline",
        onClick: () => setGuideMode("baseline")
      },
      {
        label: "Hide Guides",
        disabled: deps.state.guideMode === "off",
        onClick: () => setGuideMode("off")
      },
      { kind: "separator" },
      {
        label: deps.state.isPlaying ? "Pause Motion" : "Play Motion",
        shortcut: "K",
        dataAttribute: "data-playback-toggle",
        onClick: () => {
          deps.togglePlayback();
        }
      }
    ]);
  }

  function updateViewUi(): void {
    buildViewMenu();
  }

  function buildShellChrome(): void {
    buildFileMenu();
    buildViewMenu();
  }

  function isControlPanelOpen(): boolean {
    const aside = getControlPanelEl();
    if (!aside) {
      return false;
    }

    if (isDockedViewport()) {
      return aside.classList.contains("is-pinned") && !aside.classList.contains("is-collapsed");
    }

    return aside.classList.contains("is-open") && aside.getAttribute("aria-hidden") !== "true";
  }

  function setDrawerOpen(isOpen: boolean): void {
    const appShell = getAppShellEl();
    const aside = getControlPanelEl();
    const overlay = getControlPanelOverlayEl();
    const toggle = getControlPanelToggleEl();
    if (!aside) {
      return;
    }

    const isDocked = isDockedViewport();
    toggle?.setAttribute("aria-expanded", String(isOpen));
    toggle?.closest(".bf-top-navigation-item")?.classList.toggle("is-selected", isOpen);

    if (isDocked) {
      appShell?.classList.remove("is-drawer-expanded");
      appShell?.classList.toggle("has-pinned-aside", isOpen);
      overlay?.setAttribute("aria-hidden", "true");
      aside.classList.remove("is-overlay", "is-drawer", "is-open");
      aside.classList.add("is-medium");
      aside.classList.toggle("is-pinned", isOpen);
      aside.classList.toggle("is-collapsed", !isOpen);
      aside.setAttribute("aria-hidden", String(!isOpen));
      applyControlPanelView();
      refreshResizableAsidesRuntime();
      queueStageResizeRefresh();
      return;
    }

    appShell?.classList.remove("has-pinned-aside");
    aside.classList.remove("is-collapsed", "is-pinned");
    aside.classList.add("is-overlay", "is-medium");
    aside.classList.toggle("is-open", isOpen);
    aside.setAttribute("aria-hidden", String(!isOpen));
    appShell?.classList.toggle("is-drawer-expanded", isOpen);
    overlay?.setAttribute("aria-hidden", String(!isOpen));
    applyControlPanelView();
    refreshResizableAsidesRuntime();
    queueStageResizeRefresh();
  }

  function cycleGuideMode(): void {
    const idx = GUIDE_MODES.indexOf(deps.state.guideMode);
    setGuideMode(GUIDE_MODES[(idx + 1) % GUIDE_MODES.length]);
  }

  function toggleBaselineAndLayoutGuides(): void {
    setGuideMode(deps.state.guideMode === "baseline" ? "off" : "baseline");
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (deps.handleAuthoringEditingKeyDown(event)) {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.altKey && (event.key === "s" || event.key === "S")) {
      event.preventDefault();
      void (async () => {
        try {
          const result = await deps.sourceDefaultController.writeCurrentAsSourceDefault();
          deps.sourceDefaultController.setSourceDefaultStatus(result.message, "success");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Source default save failed.";
          deps.sourceDefaultController.setSourceDefaultStatus(`Source default save failed: ${message}`, "error");
        }
      })();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && !event.altKey && (event.key === "n" || event.key === "N")) {
      event.preventDefault();
      deps.documentWorkspace.createNewDocument();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && !event.altKey && (event.key === "o" || event.key === "O")) {
      event.preventDefault();
      void deps.documentWorkspace.openDocumentFromDisk();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && (event.key === "s" || event.key === "S")) {
      event.preventDefault();
      if (event.shiftKey) {
        void deps.documentWorkspace.saveCurrentDocument(true);
        return;
      }

      void deps.documentWorkspace.saveCurrentDocument(false);
      return;
    }

    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      if (event.key === "Escape") {
        (event.target as HTMLElement).blur();
        event.preventDefault();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && !event.altKey && (event.key === "z" || event.key === "Z")) {
      event.preventDefault();
      if (event.shiftKey) {
        void deps.redoHistory();
      } else {
        void deps.undoHistory();
      }
      return;
    }

    if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === "Delete" || event.key === "Backspace")) {
      if (deps.deleteSelectedOverlayItem()) {
        event.preventDefault();
        return;
      }
    }

    if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === "p" || event.key === "P")) {
      if (controlPanelView !== "parameters") {
        setControlPanelView("parameters");
        setDrawerOpen(true);
        event.preventDefault();
        return;
      }

      if (isDockedViewport()) {
        setDrawerOpen(true);
      } else {
        setDrawerOpen(!isControlPanelOpen());
      }
      event.preventDefault();
      return;
    }

    if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === "d" || event.key === "D")) {
      if (controlPanelView === "formats" && isControlPanelOpen()) {
        setControlPanelView("parameters");
        setDrawerOpen(true);
        event.preventDefault();
        return;
      }

      openFormatsDialog();
      event.preventDefault();
      return;
    }

    if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === "e" || event.key === "E")) {
      openExportSettingsDialog();
      event.preventDefault();
      return;
    }

    if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === "o" || event.key === "O")) {
      deps.setOverlayVisible(!deps.state.overlayVisible);
      updateViewUi();
      event.preventDefault();
      return;
    }

    if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === "n" || event.key === "N")) {
      deps.setNetworkOverlayVisible(!deps.state.networkOverlayVisible);
      updateViewUi();
      event.preventDefault();
      return;
    }

    if (event.key === "w" || event.key === "W") {
      toggleBaselineAndLayoutGuides();
      return;
    }

    if (event.key === "g" || event.key === "G") {
      cycleGuideMode();
      return;
    }

    if (event.key === "k" || event.key === "K") {
      event.preventDefault();
      deps.togglePlayback();
      return;
    }

    if (event.key === "Escape") {
      if (controlPanelView === "formats" && isControlPanelOpen()) {
        setControlPanelView("parameters");
        event.preventDefault();
        return;
      }

      if (!isDockedViewport() && isControlPanelOpen()) {
        setDrawerOpen(false);
        event.preventDefault();
        return;
      }

      if (deps.handleAuthoringInteractionKeyDown(event)) {
        return;
      }
    }
  }

  function setupButtons(): void {
    const configEditor = getConfigEditor();
    if (!hasBoundDocumentInputs && configEditor) {
      const trackDocumentInput = (event: Event): void => {
        const target = event.target;
        if (
          !(target instanceof HTMLInputElement) &&
          !(target instanceof HTMLTextAreaElement) &&
          !(target instanceof HTMLSelectElement)
        ) {
          return;
        }

        if (target instanceof HTMLInputElement && target.type === "file") {
          return;
        }

        deps.markDocumentDirty();
      };

      configEditor.addEventListener("input", trackDocumentInput);
      configEditor.addEventListener("change", trackDocumentInput);
      hasBoundDocumentInputs = true;
    }

    if (!hasBoundControlPanelToggle) {
      const controlPanelToggle = getControlPanelToggleEl();
      controlPanelToggle?.addEventListener("click", (event) => {
        event.preventDefault();
        collapseTopNavigation();
        if (controlPanelView !== "parameters") {
          setControlPanelView("parameters");
          setDrawerOpen(true);
          return;
        }

        if (isDockedViewport()) {
          setDrawerOpen(true);
          return;
        }

        setDrawerOpen(!isControlPanelOpen());
      });
      hasBoundControlPanelToggle = true;
    }

    if (!hasBoundControlPanelDismiss) {
      const dismissButton = getControlPanelDismissEl();
      dismissButton?.addEventListener("click", (event) => {
        event.preventDefault();
        dismissControlPanel();
      });
      hasBoundControlPanelDismiss = true;
    }
  }

  function setupResize(): void {
    if (hasBoundResize) {
      return;
    }

    if (!stageShellResizeObserver && typeof ResizeObserver !== "undefined") {
      const stageShell = getStageShellEl();
      if (stageShell) {
        stageShellResizeObserver = new ResizeObserver(() => {
          queueStageResizeRefresh();
        });
        stageShellResizeObserver.observe(stageShell);
      }
    }

    let hasInitializedDockMode = false;
    let lastDockedState: boolean | null = null;

    function checkDock(): void {
      const isDocked = isDockedViewport();
      if (hasInitializedDockMode && lastDockedState === isDocked) {
        queueStageResizeRefresh();
        return;
      }

      const desiredOpen = hasInitializedDockMode
        ? (isDocked ? true : isControlPanelOpen())
        : isDocked;
      setDrawerOpen(desiredOpen);
      lastDockedState = isDocked;
      hasInitializedDockMode = true;
    }

    checkDock();
    window.addEventListener("resize", checkDock);
    hasBoundResize = true;
  }

  async function init(): Promise<void> {
    if (isInitialized) {
      return;
    }

    isInitialized = true;

    deps.sourceDefaultController.setSourceDefaultStatus("Loading source default...");
    {
      const sourceDefaultDocument = await deps.sourceDefaultController.readSourceDefaultSnapshot();
      deps.sourceDefaultController.applySourceDefaultSnapshot(
        sourceDefaultDocument.snapshot,
        sourceDefaultDocument.project
      );
    }

    deps.state.playbackTimeSec = 0;
    deps.initHaloRenderer();
    await deps.documentWorkspace.refreshRecentDocuments();
    await deps.documentWorkspace.restoreLastSessionDocument();

    const logoPath = deps.state.params.logo?.assetPath;
    if (logoPath) {
      await deps.loadLogoIntrinsicDimensions(logoPath);
    }

    ensureShellDialogs();
    applyControlPanelView();
    buildShellChrome();
    syncFormatsDialog();
    syncExportSettingsDialog();
    updateDocumentUi();
    deps.buildConfigEditor();

    initTopNavigations();
    initPanelDrawers();
    setupButtons();
    setupResize();
    deps.initAuthoring();

    window.addEventListener("keydown", handleKeyDown);

    void deps.renderStage();
    deps.ensurePlaybackLoop();
    deps.sourceDefaultController.setSourceDefaultStatus("Source default ready.");
  }

  return {
    updateDocumentUi,
    updateViewUi,
    init
  };
}
