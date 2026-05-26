const DOCUMENT_STORAGE_DB_NAME = "df-document-storage-v1";
const DOCUMENT_STORAGE_STORE_NAME = "recent-documents";
const DOCUMENT_FILE_AUTHORING_PATH = "/__authoring/document-file";
const MAX_RECENT_DOCUMENTS = 12;
const DOCUMENT_PICKER_ACCEPT_TYPES: Array<{
  description: string;
  accept: Record<string, string[]>;
}> = [{
  description: "Brand Layout Ops document",
  accept: {
    "application/json": [".json"]
  }
}];

export const DOCUMENT_FILE_EXTENSION = ".df.json";

interface DocumentPickerWindow extends Window {
  showOpenFilePicker?: (options?: {
    id?: string;
    multiple?: boolean;
    startIn?: string;
    excludeAcceptAllOption?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: {
    id?: string;
    suggestedName?: string;
    startIn?: string;
    excludeAcceptAllOption?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle>;
}

type DocumentPermissionMode = "read" | "readwrite";
type DocumentPermissionState = "granted" | "denied" | "prompt";

interface PermissionAwareFileSystemFileHandle extends FileSystemFileHandle {
  queryPermission?: (options?: { mode: DocumentPermissionMode }) => Promise<DocumentPermissionState>;
  requestPermission?: (options?: { mode: DocumentPermissionMode }) => Promise<DocumentPermissionState>;
}

export interface RecentDocumentSummary {
  id: string;
  name: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}

export interface RecentDocumentRecord extends RecentDocumentSummary {
  handle: FileSystemFileHandle;
}

function getDocumentPickerWindow(): DocumentPickerWindow {
  return window as DocumentPickerWindow;
}

function createRecentDocumentId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `document-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function sanitizeDocumentFileStem(value: string): string {
  const cleanedValue = value
    .trim()
    .replace(new RegExp(`${DOCUMENT_FILE_EXTENSION.replace(/\./g, "\\.")}$`, "i"), "")
    .replace(/\.json$/i, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleanedValue.length > 0 ? cleanedValue : "untitled";
}

function toRecentDocumentSummary(record: RecentDocumentRecord): RecentDocumentSummary {
  return {
    id: record.id,
    name: record.name,
    fileName: record.fileName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastOpenedAt: record.lastOpenedAt
  };
}

function sortRecentDocuments<T extends RecentDocumentSummary>(records: T[]): T[] {
  return [...records].sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt));
}

function supportsIndexedDbStorage(): boolean {
  return "indexedDB" in window;
}

export function supportsLocalDocumentFiles(): boolean {
  const documentWindow = getDocumentPickerWindow();
  return typeof documentWindow.showOpenFilePicker === "function"
    && typeof documentWindow.showSaveFilePicker === "function";
}

export function deriveDocumentNameFromFileName(fileName: string): string {
  const trimmedFileName = fileName.trim();
  if (!trimmedFileName) {
    return "Untitled";
  }

  return trimmedFileName
    .replace(new RegExp(`${DOCUMENT_FILE_EXTENSION.replace(/\./g, "\\.")}$`, "i"), "")
    .replace(/\.json$/i, "")
    || "Untitled";
}

export function createSuggestedDocumentFileName(name: string): string {
  return `${sanitizeDocumentFileStem(name)}${DOCUMENT_FILE_EXTENSION}`;
}

function openDocumentStorageDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    if (!supportsIndexedDbStorage()) {
      resolve(null);
      return;
    }

    const request = window.indexedDB.open(DOCUMENT_STORAGE_DB_NAME, 1);
    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains(DOCUMENT_STORAGE_STORE_NAME)) {
        request.result.createObjectStore(DOCUMENT_STORAGE_STORE_NAME, { keyPath: "id" });
      }
    });
    request.addEventListener("success", () => {
      resolve(request.result);
    });
    request.addEventListener("error", () => {
      reject(request.error);
    });
  });
}

function loadStoredRecentDocumentRecords(): Promise<RecentDocumentRecord[]> {
  return new Promise(async (resolve, reject) => {
    const database = await openDocumentStorageDb();
    if (!database) {
      resolve([]);
      return;
    }

    const transaction = database.transaction(DOCUMENT_STORAGE_STORE_NAME, "readonly");
    const request = transaction.objectStore(DOCUMENT_STORAGE_STORE_NAME).getAll();

    request.addEventListener("success", () => {
      const result = Array.isArray(request.result) ? request.result as RecentDocumentRecord[] : [];
      resolve(sortRecentDocuments(result));
    });
    request.addEventListener("error", () => {
      reject(request.error);
    });
    transaction.addEventListener("complete", () => {
      database.close();
    });
  });
}

function loadStoredRecentDocumentRecord(id: string): Promise<RecentDocumentRecord | null> {
  return new Promise(async (resolve, reject) => {
    const database = await openDocumentStorageDb();
    if (!database) {
      resolve(null);
      return;
    }

    const transaction = database.transaction(DOCUMENT_STORAGE_STORE_NAME, "readonly");
    const request = transaction.objectStore(DOCUMENT_STORAGE_STORE_NAME).get(id);

    request.addEventListener("success", () => {
      resolve((request.result as RecentDocumentRecord | undefined) ?? null);
    });
    request.addEventListener("error", () => {
      reject(request.error);
    });
    transaction.addEventListener("complete", () => {
      database.close();
    });
  });
}

function saveStoredRecentDocumentRecord(record: RecentDocumentRecord): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const database = await openDocumentStorageDb();
    if (!database) {
      resolve();
      return;
    }

    const transaction = database.transaction(DOCUMENT_STORAGE_STORE_NAME, "readwrite");
    let request: IDBRequest<IDBValidKey>;
    try {
      request = transaction.objectStore(DOCUMENT_STORAGE_STORE_NAME).put(record);
    } catch (error) {
      database.close();
      reject(error);
      return;
    }

    request.addEventListener("success", () => {
      resolve();
    });
    request.addEventListener("error", () => {
      reject(request.error);
    });
    transaction.addEventListener("complete", () => {
      database.close();
    });
  });
}

function deleteStoredRecentDocumentRecord(id: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const database = await openDocumentStorageDb();
    if (!database) {
      resolve();
      return;
    }

    const transaction = database.transaction(DOCUMENT_STORAGE_STORE_NAME, "readwrite");
    const request = transaction.objectStore(DOCUMENT_STORAGE_STORE_NAME).delete(id);

    request.addEventListener("success", () => {
      resolve();
    });
    request.addEventListener("error", () => {
      reject(request.error);
    });
    transaction.addEventListener("complete", () => {
      database.close();
    });
  });
}

async function findMatchingRecentDocumentId(
  records: RecentDocumentRecord[],
  handle: FileSystemFileHandle
): Promise<string | null> {
  for (const record of records) {
    try {
      if (typeof record.handle.isSameEntry === "function" && await record.handle.isSameEntry(handle)) {
        return record.id;
      }
    } catch {
      // Ignore stale handles and keep checking other entries.
    }
  }

  return null;
}

async function trimRecentDocuments(): Promise<void> {
  const records = await loadStoredRecentDocumentRecords();
  const overflowRecords = records.slice(MAX_RECENT_DOCUMENTS);
  for (const record of overflowRecords) {
    await deleteStoredRecentDocumentRecord(record.id);
  }
}

export async function loadRecentDocumentSummaries(): Promise<RecentDocumentSummary[]> {
  const records = await loadStoredRecentDocumentRecords();
  return records.map((record) => toRecentDocumentSummary(record));
}

export async function loadRecentDocumentRecord(id: string): Promise<RecentDocumentRecord | null> {
  return loadStoredRecentDocumentRecord(id);
}

export async function forgetRecentDocument(id: string): Promise<void> {
  await deleteStoredRecentDocumentRecord(id);
}

export async function rememberRecentDocument(input: {
  preferredId?: string | null;
  handle: FileSystemFileHandle;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}): Promise<RecentDocumentSummary> {
  const existingRecords = await loadStoredRecentDocumentRecords();
  let recordId = input.preferredId ?? null;

  if (!recordId) {
    recordId = await findMatchingRecentDocumentId(existingRecords, input.handle);
  }

  const existingRecord = recordId
    ? existingRecords.find((record) => record.id === recordId) ?? null
    : null;

  const record: RecentDocumentRecord = {
    id: recordId ?? createRecentDocumentId(),
    handle: input.handle,
    fileName: input.handle.name,
    name: input.name,
    createdAt: existingRecord?.createdAt ?? input.createdAt,
    updatedAt: input.updatedAt,
    lastOpenedAt: input.lastOpenedAt
  };

  await saveStoredRecentDocumentRecord(record);
  await trimRecentDocuments();

  return toRecentDocumentSummary(record);
}

export async function ensureDocumentFileHandlePermission(
  handle: FileSystemFileHandle,
  mode: DocumentPermissionMode,
  requestIfNeeded: boolean = true
): Promise<boolean> {
  const permissionAwareHandle = handle as PermissionAwareFileSystemFileHandle;

  if (typeof permissionAwareHandle.queryPermission !== "function") {
    return true;
  }

  const permissionOptions = mode === "readwrite"
    ? { mode: "readwrite" as const }
    : { mode: "read" as const };
  let permissionState = await permissionAwareHandle.queryPermission(permissionOptions);
  if (
    permissionState !== "granted"
    && requestIfNeeded
    && typeof permissionAwareHandle.requestPermission === "function"
  ) {
    permissionState = await permissionAwareHandle.requestPermission(permissionOptions);
  }

  return permissionState === "granted";
}

export async function pickDocumentFileToOpen(): Promise<FileSystemFileHandle | null> {
  if (!supportsLocalDocumentFiles()) {
    return null;
  }

  const documentWindow = getDocumentPickerWindow();
  const handles = await documentWindow.showOpenFilePicker?.({
    id: "df-open-document",
    multiple: false,
    startIn: "documents",
    types: [...DOCUMENT_PICKER_ACCEPT_TYPES]
  });

  return Array.isArray(handles) && handles.length > 0 ? handles[0] : null;
}

export async function pickDocumentFileToSave(suggestedName: string): Promise<FileSystemFileHandle | null> {
  if (!supportsLocalDocumentFiles()) {
    return null;
  }

  const documentWindow = getDocumentPickerWindow();
  return documentWindow.showSaveFilePicker?.({
    id: "df-save-document",
    suggestedName,
    startIn: "documents",
    types: [...DOCUMENT_PICKER_ACCEPT_TYPES]
  }) ?? null;
}

export async function readDocumentFileText(handle: FileSystemFileHandle): Promise<string> {
  const hasPermission = await ensureDocumentFileHandlePermission(handle, "read", true);
  if (!hasPermission) {
    throw new Error("Document read permission was denied.");
  }

  const file = await handle.getFile();
  const text = await file.text();
  if (text.trim().length > 0) {
    return text;
  }

  return await readDocumentFileTextFromAuthoringServer(handle.name) ?? text;
}

export async function writeDocumentFileText(
  handle: FileSystemFileHandle,
  text: string
): Promise<void> {
  if (!text || text.trim().length === 0) {
    throw new Error("Refusing to write empty document content to file.");
  }

  const hasPermission = await ensureDocumentFileHandlePermission(handle, "readwrite", true);
  if (!hasPermission) {
    throw new Error("Document write permission was denied.");
  }

  let writable: FileSystemWritableFileStream | null = null;

  try {
    writable = await handle.createWritable();
    await writable.write(new Blob([text], { type: "application/json" }));
    await writable.close();
    writable = null;

    const writtenFile = await handle.getFile();
    const writtenText = await writtenFile.text();
    if (writtenText === text) {
      return;
    }
    console.warn("[document-storage] FSAPI write verification mismatch, written length:", writtenText.length, "expected:", text.length);
  } catch (error) {
    console.error("[document-storage] FSAPI write failed:", error);
    if (writable) {
      try { await writable.abort(); } catch { /* best-effort cleanup */ }
    }

    if (await writeDocumentFileTextToAuthoringServer(handle.name, text)) {
      return;
    }

    throw error;
  }

  if (await writeDocumentFileTextToAuthoringServer(handle.name, text)) {
    return;
  }

  throw new Error("Document write verification failed.");
}

export async function writeDocumentFileTextByName(fileName: string, text: string): Promise<boolean> {
  return writeDocumentFileTextToAuthoringServer(fileName, text);
}

export async function readDocumentFileTextByName(fileName: string): Promise<string | null> {
  return readDocumentFileTextFromAuthoringServer(fileName);
}

async function readDocumentFileTextFromAuthoringServer(fileName: string): Promise<string | null> {
  try {
    const response = await fetch(`${DOCUMENT_FILE_AUTHORING_PATH}?file_name=${encodeURIComponent(fileName)}`);
    if (!response.ok) {
      return null;
    }

    const text = await response.text();
    return text.trim().length > 0 ? text : null;
  } catch {
    return null;
  }
}

async function writeDocumentFileTextToAuthoringServer(fileName: string, text: string): Promise<boolean> {
  try {
    console.log("[document-storage] Authoring server POST:", fileName, "content length:", text.length);
    const response = await fetch(DOCUMENT_FILE_AUTHORING_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        file_name: fileName,
        serialized_document: text
      })
    });

    const payload = await response.json().catch(() => ({})) as { ok?: unknown };
    const success = response.ok && payload.ok === true;
    console.log("[document-storage] Authoring server response:", response.status, "ok:", success, payload);
    return success;
  } catch (error) {
    console.error("[document-storage] Authoring server POST failed:", error);
    return false;
  }
}