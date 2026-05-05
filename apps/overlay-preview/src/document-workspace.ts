import {
  createSuggestedDocumentFileName,
  DOCUMENT_FILE_EXTENSION,
  deriveDocumentNameFromFileName,
  forgetRecentDocument as forgetStoredRecentDocument,
  loadRecentDocumentRecord,
  loadRecentDocumentSummaries,
  pickDocumentFileToOpen,
  pickDocumentFileToSave,
  readDocumentFileText,
  readDocumentFileTextByName,
  rememberRecentDocument,
  supportsLocalDocumentFiles,
  writeDocumentFileTextByName,
  writeDocumentFileText,
  type RecentDocumentSummary
} from "./document-storage.js";

const LAST_SESSION_DOCUMENT_STORAGE_KEY = "brand-layout-ops:last-session-document";
const DOCUMENT_LOCATION_HASH_PREFIX = "#document=";

export type DocumentStatusTone = "neutral" | "success" | "error";

export interface DocumentWorkspaceState {
  name: string;
  fileHandle: FileSystemFileHandle | null;
  fileName: string | null;
  recentDocumentId: string | null;
  recentDocuments: RecentDocumentSummary[];
  createdAt: string;
  updatedAt: string | null;
  isDirty: boolean;
  statusMessage: string;
  statusTone: DocumentStatusTone;
}

export interface DocumentWorkspaceMetadata {
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentWorkspaceUiElements {
  nameInput: HTMLInputElement | null;
  summaryEl: HTMLElement | null;
  statusEl: HTMLElement | null;
  recentListEl: HTMLElement | null;
}

export interface DocumentWorkspaceUiActions {
  reopenRecentDocument: (recentDocumentId: string) => void | Promise<void>;
  forgetRecentDocument: (recentDocumentId: string) => void | Promise<void>;
}

export interface CreateDocumentWorkspaceControllerOptions<TDocument> {
  untitledName: string;
  initialStatusMessage: string;
  parseDocument: (rawDocument: unknown) => TDocument | null;
  getDocumentMetadata: (document: TDocument) => DocumentWorkspaceMetadata;
  buildPersistedDocument: (metadata: DocumentWorkspaceMetadata) => unknown;
  applyDocument: (document: TDocument) => Promise<void>;
  applyNewDocumentState: () => Promise<void>;
  onWorkspaceChange?: () => void;
  confirmDiscardChanges?: (workspace: DocumentWorkspaceState) => boolean;
}

export interface DocumentWorkspaceController<TDocument> {
  state: DocumentWorkspaceState;
  getNormalizedName: (rawName?: string) => string;
  setStatus: (message: string, tone?: DocumentStatusTone) => void;
  markDirty: () => void;
  resetDirty: () => void;
  setName: (rawName: string) => void;
  refreshRecentDocuments: () => Promise<void>;
  forgetRecentDocument: (recentDocumentId: string) => Promise<void>;
  openRecentDocument: (recentDocumentId: string) => Promise<void>;
  restoreLastSessionDocument: () => Promise<boolean>;
  createNewDocument: () => Promise<void>;
  openDocumentFromDisk: () => Promise<void>;
  saveCurrentDocument: (forceSaveAs?: boolean, nameOverride?: string) => Promise<boolean>;
  duplicateCurrentDocument: () => Promise<void>;
}

interface StoredSessionDocumentSnapshot {
  serializedDocument: string;
  fileName: string | null;
}

type SelectedDocumentResult<TDocument> =
  | { kind: "success"; document: TDocument; fileHandle: FileSystemFileHandle | null; fileName: string }
  | { kind: "cancelled" }
  | { kind: "invalid" };

function createInitialDocumentWorkspaceState(
  untitledName: string,
  initialStatusMessage: string
): DocumentWorkspaceState {
  return {
    name: untitledName,
    fileHandle: null,
    fileName: null,
    recentDocumentId: null,
    recentDocuments: [],
    createdAt: new Date().toISOString(),
    updatedAt: null,
    isDirty: false,
    statusMessage: initialStatusMessage,
    statusTone: "neutral"
  };
}

function normalizeDocumentName(rawName: string, untitledName: string): string {
  const trimmedName = rawName.trim();
  return trimmedName.length > 0 ? trimmedName : untitledName;
}

function isUntitledDocumentName(rawName: string, untitledName: string): boolean {
  const normalizedName = normalizeDocumentName(rawName, untitledName);
  return normalizedName === untitledName
    || normalizedName === deriveDocumentNameFromFileName(createSuggestedDocumentFileName(untitledName));
}

function resolveDocumentNameFromWorkspace(
  rawName: string,
  untitledName: string,
  fileName: string | null
): string {
  const normalizedName = normalizeDocumentName(rawName, untitledName);
  if (!isUntitledDocumentName(normalizedName, untitledName) || !fileName) {
    return normalizedName;
  }

  return deriveDocumentNameFromFileName(fileName);
}

function promptForDocumentName(untitledName: string): string | null {
  const promptedName = window.prompt("Enter a name for the document before saving it.", "");
  if (promptedName === null) {
    return null;
  }

  const normalizedName = normalizeDocumentName(promptedName, untitledName);
  return normalizedName === untitledName ? null : normalizedName;
}

function confirmDiscardChanges(workspace: DocumentWorkspaceState): boolean {
  return !workspace.isDirty || window.confirm("Discard unsaved changes in the current document?");
}

function formatDocumentTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return "Unknown time";
  }

  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return timestamp;
  }

  return new Date(parsed).toLocaleString();
}

function downloadJsonFile(fileName: string, contents: string): void {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function promptForSingleDocumentFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = `application/json,.json,${DOCUMENT_FILE_EXTENSION}`;
    input.hidden = true;
    input.addEventListener("change", () => {
      const nextFile = input.files?.[0] ?? null;
      input.remove();
      resolve(nextFile);
    }, { once: true });
    document.body.append(input);
    input.click();
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function loadStoredSessionDocumentSnapshot(): StoredSessionDocumentSnapshot | null {
  try {
    const rawSnapshot = window.localStorage.getItem(LAST_SESSION_DOCUMENT_STORAGE_KEY);
    if (!rawSnapshot) {
      return null;
    }

    const parsedSnapshot = JSON.parse(rawSnapshot) as {
      serializedDocument?: unknown;
      fileName?: unknown;
    };

    if (typeof parsedSnapshot.serializedDocument !== "string" || parsedSnapshot.serializedDocument.length === 0) {
      return null;
    }

    return {
      serializedDocument: parsedSnapshot.serializedDocument,
      fileName: typeof parsedSnapshot.fileName === "string" && parsedSnapshot.fileName.trim().length > 0
        ? parsedSnapshot.fileName
        : null
    };
  } catch {
    return null;
  }
}

function persistSessionDocumentSnapshot(serializedDocument: string, fileName: string | null): void {
  try {
    window.localStorage.setItem(LAST_SESSION_DOCUMENT_STORAGE_KEY, JSON.stringify({
      serializedDocument,
      fileName
    } satisfies StoredSessionDocumentSnapshot));
  } catch {
    // Ignore storage failures; file-backed save/open remains the source of truth.
  }
}

function clearStoredSessionDocumentSnapshot(): void {
  try {
    window.localStorage.removeItem(LAST_SESSION_DOCUMENT_STORAGE_KEY);
  } catch {
    // Ignore storage failures; they should not block authoring.
  }
}

function getLocationDocumentFileName(): string | null {
  try {
    const hash = window.location.hash;
    if (!hash.startsWith(DOCUMENT_LOCATION_HASH_PREFIX)) {
      return null;
    }

    const fileName = decodeURIComponent(hash.slice(DOCUMENT_LOCATION_HASH_PREFIX.length)).trim();
    return fileName.length > 0 ? fileName : null;
  } catch {
    return null;
  }
}

function setLocationDocumentFileName(fileName: string | null): void {
  try {
    const nextHash = typeof fileName === "string" && fileName.trim().length > 0
      ? `document=${encodeURIComponent(fileName.trim())}`
      : "";
    const url = new URL(window.location.href);
    url.hash = nextHash;
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    // Ignore history-update failures; they should not block authoring.
  }
}

export function renderDocumentWorkspaceUi(args: {
  workspace: DocumentWorkspaceState;
  untitledName: string;
  elements: DocumentWorkspaceUiElements;
  actions: DocumentWorkspaceUiActions;
}): void {
  const { workspace, untitledName, elements, actions } = args;

  if (elements.summaryEl) {
    const locationLabel = workspace.fileName ? `Saved to ${workspace.fileName}` : "Not yet saved to a local file";
    const stateLabel = workspace.isDirty ? "Modified" : workspace.fileName ? "Saved" : "Unsaved";
    elements.summaryEl.textContent = `${normalizeDocumentName(workspace.name, untitledName)} • ${stateLabel} • ${locationLabel}`;
  }

  if (elements.statusEl) {
    elements.statusEl.textContent = workspace.statusMessage;
    elements.statusEl.style.color = workspace.statusTone === "success"
      ? "#9ad47d"
      : workspace.statusTone === "error"
        ? "#ff8f8f"
        : "";
  }

  if (elements.nameInput && document.activeElement !== elements.nameInput) {
    const normalizedName = normalizeDocumentName(workspace.name, untitledName);
    if (elements.nameInput.value !== normalizedName) {
      elements.nameInput.value = normalizedName;
    }
  }

  if (!elements.recentListEl) {
    return;
  }

  elements.recentListEl.replaceChildren();

  if (workspace.recentDocuments.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "bf-form-help bf-u-no-margin--bottom";
    emptyState.textContent = supportsLocalDocumentFiles()
      ? "Recent local documents appear here after you save or reopen a file-backed project."
      : "Recent documents require the browser File System Access APIs.";
    elements.recentListEl.append(emptyState);
    return;
  }

  for (const summary of workspace.recentDocuments) {
    const item = document.createElement("div");
    item.className = "bf-field";

    const meta = document.createElement("p");
    meta.className = "bf-form-help bf-u-no-margin--bottom";
    meta.textContent = `${summary.fileName} • Last opened ${formatDocumentTimestamp(summary.lastOpenedAt)}`;

    const actionsEl = document.createElement("div");
    actionsEl.className = "bf-cluster is-tight-cluster";

    const reopenButton = document.createElement("button");
    reopenButton.type = "button";
    reopenButton.className = summary.id === workspace.recentDocumentId
      ? "bf-button is-dense"
      : "bf-button is-base is-dense";
    reopenButton.textContent = summary.name;
    reopenButton.addEventListener("click", () => {
      void actions.reopenRecentDocument(summary.id);
    });

    const forgetButton = document.createElement("button");
    forgetButton.type = "button";
    forgetButton.className = "bf-button is-base is-dense";
    forgetButton.textContent = "Forget";
    forgetButton.addEventListener("click", () => {
      void actions.forgetRecentDocument(summary.id);
    });

    actionsEl.append(reopenButton, forgetButton);
    item.append(meta, actionsEl);
    elements.recentListEl.append(item);
  }
}

export function createDocumentWorkspaceController<TDocument>(
  options: CreateDocumentWorkspaceControllerOptions<TDocument>
): DocumentWorkspaceController<TDocument> {
  const workspace = createInitialDocumentWorkspaceState(options.untitledName, options.initialStatusMessage);

  const notifyWorkspaceChanged = (): void => {
    options.onWorkspaceChange?.();
  };

  const getNormalizedName = (rawName: string = workspace.name): string => {
    return normalizeDocumentName(rawName, options.untitledName);
  };

  const setStatus = (message: string, tone: DocumentStatusTone = "neutral"): void => {
    workspace.statusMessage = message;
    workspace.statusTone = tone;
    notifyWorkspaceChanged();
  };

  const markDirty = (): void => {
    workspace.isDirty = true;
    notifyWorkspaceChanged();
  };

  const resetDirty = (): void => {
    workspace.isDirty = false;
    notifyWorkspaceChanged();
  };

  const setName = (rawName: string): void => {
    workspace.name = rawName;
    markDirty();
  };

  const getResolvedWorkspaceMetadata = (updatedAtFallback: string = workspace.createdAt): DocumentWorkspaceMetadata => ({
    name: getNormalizedName(workspace.name),
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt ?? updatedAtFallback
  });

  const persistWorkspaceDocumentSnapshot = (metadata: DocumentWorkspaceMetadata, fileName: string | null): void => {
    const persistedDocument = options.buildPersistedDocument(metadata);
    const serializedDocument = `${JSON.stringify(persistedDocument, null, 2)}\n`;
    persistSessionDocumentSnapshot(serializedDocument, fileName);
  };

  const refreshRecentDocuments = async (): Promise<void> => {
    try {
      workspace.recentDocuments = await loadRecentDocumentSummaries();
    } catch {
      workspace.recentDocuments = [];
    }

    notifyWorkspaceChanged();
  };

  const syncRecentDocumentSummary = (summary: RecentDocumentSummary | null): void => {
    workspace.recentDocumentId = summary?.id ?? null;
    if (!summary) {
      return;
    }

    workspace.fileName = summary.fileName;
    workspace.createdAt = summary.createdAt;
    workspace.updatedAt = summary.updatedAt;
  };

  const rememberCurrentDocumentHandle = async (
    fileHandle: FileSystemFileHandle,
    updatedAt: string,
    lastOpenedAt: string = updatedAt,
    preferredId: string | null = workspace.recentDocumentId
  ): Promise<void> => {
    try {
      const summary = await rememberRecentDocument({
        preferredId,
        handle: fileHandle,
        name: getNormalizedName(),
        createdAt: workspace.createdAt,
        updatedAt,
        lastOpenedAt
      });

      syncRecentDocumentSummary(summary);
    } catch {
      workspace.recentDocumentId = null;
    }

    await refreshRecentDocuments();
  };

  const forgetRecentDocument = async (recentDocumentId: string): Promise<void> => {
    await forgetStoredRecentDocument(recentDocumentId);
    if (workspace.recentDocumentId === recentDocumentId) {
      workspace.recentDocumentId = null;
    }
    await refreshRecentDocuments();
  };

  const readDocumentFromFileHandle = async (
    fileHandle: FileSystemFileHandle
  ): Promise<TDocument | null> => {
    try {
      return options.parseDocument(JSON.parse(await readDocumentFileText(fileHandle)) as unknown);
    } catch {
      return null;
    }
  };

  const readSelectedDocumentFromDisk = async (): Promise<SelectedDocumentResult<TDocument>> => {
    if (supportsLocalDocumentFiles()) {
      let fileHandle: FileSystemFileHandle | null = null;
      try {
        fileHandle = await pickDocumentFileToOpen();
      } catch (error) {
        if (isAbortError(error)) {
          return { kind: "cancelled" };
        }

        const file = await promptForSingleDocumentFile();
        if (!file) {
          setStatus(`Open picker failed: ${getErrorMessage(error)}`, "error");
          return { kind: "cancelled" };
        }

        try {
          const document = options.parseDocument(JSON.parse(await file.text()) as unknown);
          return document
            ? { kind: "success", document, fileHandle: null, fileName: file.name }
            : { kind: "invalid" };
        } catch {
          return { kind: "invalid" };
        }
      }

      if (!fileHandle) {
        return { kind: "cancelled" };
      }

      const document = await readDocumentFromFileHandle(fileHandle);
      return document
        ? { kind: "success", document, fileHandle, fileName: fileHandle.name }
        : { kind: "invalid" };
    }

    const file = await promptForSingleDocumentFile();
    if (!file) {
      return { kind: "cancelled" };
    }

    try {
      const document = options.parseDocument(JSON.parse(await file.text()) as unknown);
      return document
        ? { kind: "success", document, fileHandle: null, fileName: file.name }
        : { kind: "invalid" };
    } catch {
      return { kind: "invalid" };
    }
  };

  const applyWorkspaceDocumentMetadata = (
    document: TDocument,
    fileHandle: FileSystemFileHandle | null,
    fileName: string | null
  ): void => {
    const metadata = options.getDocumentMetadata(document);
    const resolvedFileName = fileName ?? fileHandle?.name ?? null;
    workspace.name = resolveDocumentNameFromWorkspace(metadata.name, options.untitledName, resolvedFileName);
    workspace.fileHandle = fileHandle;
    workspace.fileName = resolvedFileName;
    workspace.createdAt = metadata.createdAt;
    workspace.updatedAt = metadata.updatedAt;
    workspace.isDirty = false;
    setLocationDocumentFileName(resolvedFileName);
    notifyWorkspaceChanged();
  };

  const shouldDiscardChanges = (): boolean => {
    return options.confirmDiscardChanges?.(workspace) ?? confirmDiscardChanges(workspace);
  };

  const openRecentDocument = async (recentDocumentId: string): Promise<void> => {
    if (!shouldDiscardChanges()) {
      return;
    }

    const record = await loadRecentDocumentRecord(recentDocumentId);
    if (!record) {
      await forgetRecentDocument(recentDocumentId);
      setStatus("That recent document entry no longer exists.", "error");
      return;
    }

    const document = await readDocumentFromFileHandle(record.handle);
    if (!document) {
      await forgetRecentDocument(recentDocumentId);
      setStatus("Could not reopen that recent document. The stale entry was removed.", "error");
      return;
    }

    await options.applyDocument(document);
    applyWorkspaceDocumentMetadata(document, record.handle, record.fileName);
    persistWorkspaceDocumentSnapshot(getResolvedWorkspaceMetadata(), record.fileName);
    await rememberCurrentDocumentHandle(
      record.handle,
      workspace.updatedAt ?? workspace.createdAt,
      new Date().toISOString(),
      record.id
    );
    setStatus(`Reopened ${record.fileName}.`, "success");
  };

  const restoreLastSessionDocument = async (): Promise<boolean> => {
    const locationFileName = getLocationDocumentFileName();
    if (locationFileName) {
      try {
        const serializedDocument = await readDocumentFileTextByName(locationFileName);
        if (serializedDocument) {
          const document = options.parseDocument(JSON.parse(serializedDocument) as unknown);
          if (document) {
            workspace.recentDocumentId = null;
            await options.applyDocument(document);
            applyWorkspaceDocumentMetadata(document, null, locationFileName);
            persistSessionDocumentSnapshot(serializedDocument, locationFileName);
            setStatus(`Restored ${locationFileName}.`, "success");
            return true;
          }
        }
      } catch {
        // Fall back to the last-session snapshot when the explicit hash target cannot be restored.
      }
    }

    const storedSnapshot = loadStoredSessionDocumentSnapshot();
    if (!storedSnapshot) {
      return false;
    }

    let rawDocument: unknown;
    try {
      rawDocument = JSON.parse(storedSnapshot.serializedDocument) as unknown;
    } catch {
      clearStoredSessionDocumentSnapshot();
      return false;
    }

    const document = options.parseDocument(rawDocument);
    if (!document) {
      clearStoredSessionDocumentSnapshot();
      return false;
    }

    workspace.recentDocumentId = null;
    await options.applyDocument(document);
    applyWorkspaceDocumentMetadata(document, null, storedSnapshot.fileName);
    setStatus(`Restored ${storedSnapshot.fileName ?? options.getDocumentMetadata(document).name}.`, "success");
    return true;
  };

  const createNewDocument = async (): Promise<void> => {
    if (!shouldDiscardChanges()) {
      return;
    }

    await options.applyNewDocumentState();

    workspace.name = options.untitledName;
    workspace.fileHandle = null;
    workspace.fileName = null;
    workspace.recentDocumentId = null;
    workspace.createdAt = new Date().toISOString();
    workspace.updatedAt = null;
    workspace.isDirty = false;
    clearStoredSessionDocumentSnapshot();
    setLocationDocumentFileName(null);
    setStatus("Started a new local document.", "success");
  };

  const openDocumentFromDisk = async (): Promise<void> => {
    if (!shouldDiscardChanges()) {
      return;
    }

    const selectedDocument = await readSelectedDocumentFromDisk();
    if (selectedDocument.kind === "cancelled") {
      return;
    }

    if (selectedDocument.kind === "invalid") {
      setStatus("Selected file is not a valid Brand Layout Ops document.", "error");
      return;
    }

    await options.applyDocument(selectedDocument.document);
    applyWorkspaceDocumentMetadata(selectedDocument.document, selectedDocument.fileHandle, selectedDocument.fileName);
    persistWorkspaceDocumentSnapshot(getResolvedWorkspaceMetadata(), selectedDocument.fileName);

    if (selectedDocument.fileHandle) {
      await rememberCurrentDocumentHandle(
        selectedDocument.fileHandle,
        workspace.updatedAt ?? workspace.createdAt,
        new Date().toISOString(),
        null
      );
    } else {
      workspace.recentDocumentId = null;
      notifyWorkspaceChanged();
    }

    setStatus(`Opened ${selectedDocument.fileName}.`, "success");
  };

  const saveCurrentDocument = async (forceSaveAs: boolean = false, nameOverride?: string): Promise<boolean> => {
    const savedAt = new Date().toISOString();
    let fileHandle = forceSaveAs ? null : workspace.fileHandle;
    let fileName = forceSaveAs ? null : workspace.fileName;
    let usedAuthoringRouteFallback = false;
    let usedDownloadFallback = false;
    let pickerFallbackReason: string | null = null;

    if (fileHandle) {
      fileName = fileHandle.name;
    }

    let nextDocumentName = getNormalizedName(nameOverride ?? workspace.name);
    const canReuseNamedDocumentWithoutHandle = !forceSaveAs && !fileHandle && typeof fileName === "string" && fileName.trim().length > 0;

    if (!fileHandle && !canReuseNamedDocumentWithoutHandle && supportsLocalDocumentFiles()) {
      try {
        fileHandle = await pickDocumentFileToSave(createSuggestedDocumentFileName(nextDocumentName));
        fileName = fileHandle?.name ?? fileName;
      } catch (error) {
        if (isAbortError(error)) {
          return false;
        }

        pickerFallbackReason = getErrorMessage(error);
      }
    }

    if (typeof nameOverride === "undefined") {
      nextDocumentName = resolveDocumentNameFromWorkspace(workspace.name, options.untitledName, fileName);
    }

    if (!fileHandle && typeof nameOverride === "undefined" && isUntitledDocumentName(nextDocumentName, options.untitledName)) {
      const promptedName = promptForDocumentName(options.untitledName);
      if (!promptedName) {
        setStatus("Document save cancelled: enter a document name.", "error");
        return false;
      }

      nextDocumentName = promptedName;
    }

    const persistedDocument = options.buildPersistedDocument({
      name: nextDocumentName,
      createdAt: workspace.createdAt || savedAt,
      updatedAt: savedAt
    });
    const serializedDocument = `${JSON.stringify(persistedDocument, null, 2)}\n`;

    try {
      if (fileHandle) {
        await writeDocumentFileText(fileHandle, serializedDocument);
        fileName = fileHandle.name;
        void writeDocumentFileTextByName(fileName, serializedDocument);
      } else {
        fileName = createSuggestedDocumentFileName(nextDocumentName);
        usedAuthoringRouteFallback = await writeDocumentFileTextByName(fileName, serializedDocument);
        if (!usedAuthoringRouteFallback) {
          downloadJsonFile(fileName, serializedDocument);
          usedDownloadFallback = true;
        }
      }
    } catch (error) {
      setStatus(`Document save failed: ${getErrorMessage(error)}`, "error");
      return false;
    }

    workspace.name = nextDocumentName;
    workspace.fileHandle = fileHandle;
    workspace.fileName = fileName;
    workspace.createdAt = workspace.createdAt || savedAt;
    workspace.updatedAt = savedAt;
    workspace.isDirty = false;
    persistSessionDocumentSnapshot(serializedDocument, fileName ?? null);
    setLocationDocumentFileName(fileName ?? null);
    notifyWorkspaceChanged();

    if (fileHandle) {
      await rememberCurrentDocumentHandle(
        fileHandle,
        savedAt,
        savedAt,
        forceSaveAs ? null : workspace.recentDocumentId
      );
    } else {
      workspace.recentDocumentId = null;
      notifyWorkspaceChanged();
    }

    if (usedAuthoringRouteFallback && pickerFallbackReason) {
      setStatus(
        `Saved ${fileName ?? nextDocumentName} to projects/ because the local file picker failed: ${pickerFallbackReason}`,
        "success"
      );
    } else if (usedAuthoringRouteFallback) {
      setStatus(`Saved ${fileName ?? nextDocumentName} to projects/.`, "success");
    } else if (usedDownloadFallback && pickerFallbackReason) {
      setStatus(
        `Saved ${fileName ?? nextDocumentName} via browser download because the local file picker failed: ${pickerFallbackReason}`,
        "success"
      );
    } else {
      setStatus(`Saved ${fileName ?? nextDocumentName}.`, "success");
    }
    return true;
  };

  const duplicateCurrentDocument = async (): Promise<void> => {
    const normalizedBaseName = getNormalizedName(workspace.name);
    const duplicateName = normalizedBaseName.endsWith(" Copy")
      ? `${normalizedBaseName} 2`
      : `${normalizedBaseName} Copy`;
    const saved = await saveCurrentDocument(true, duplicateName);
    if (saved) {
      setStatus(`Duplicated as ${workspace.fileName ?? duplicateName}.`, "success");
    }
  };

  return {
    state: workspace,
    getNormalizedName,
    setStatus,
    markDirty,
    resetDirty,
    setName,
    refreshRecentDocuments,
    forgetRecentDocument,
    openRecentDocument,
    restoreLastSessionDocument,
    createNewDocument,
    openDocumentFromDisk,
    saveCurrentDocument,
    duplicateCurrentDocument
  };
}