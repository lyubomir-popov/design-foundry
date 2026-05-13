/**
 * preview-history-controller.ts — Snapshot-based undo/redo for preview documents.
 *
 * Keeps history stack policy out of main.ts while continuing to replay the
 * persisted document shape through the existing sanitize/apply path.
 */

import type { OverlayPreviewDocument } from "./preview-app-context.js";

export interface PreviewHistoryControllerOptions {
  serializeCurrentDocument(): string;
  sanitizePreviewDocument(rawDocument: unknown): OverlayPreviewDocument | null;
  applyPreviewDocumentToState(previewDocument: OverlayPreviewDocument): Promise<void>;
  markWorkspaceDirty(): void;
  resetWorkspaceDirty(): void;
  updateDocumentUi(): void;
  historyLimit?: number;
}

export interface PreviewHistoryController {
  resetFromCurrentDocument(markAsSaved?: boolean): void;
  syncSavedSnapshot(): void;
  recordSnapshot(): void;
  undo(): Promise<boolean>;
  redo(): Promise<boolean>;
}

interface HistoryState {
  undoStack: string[];
  redoStack: string[];
  savedSnapshot: string | null;
  isApplying: boolean;
  inFlightTransition: Promise<boolean> | null;
}

export function createPreviewHistoryController(
  options: PreviewHistoryControllerOptions
): PreviewHistoryController {
  const historyLimit = Math.max(1, options.historyLimit ?? 100);
  const historyState: HistoryState = {
    undoStack: [],
    redoStack: [],
    savedSnapshot: null,
    isApplying: false,
    inFlightTransition: null
  };

  function syncWorkspaceDirtyWithHistory(serializedSnapshot: string): void {
    if (historyState.savedSnapshot !== null && serializedSnapshot === historyState.savedSnapshot) {
      options.resetWorkspaceDirty();
      return;
    }

    options.markWorkspaceDirty();
  }

  function resetFromCurrentDocument(markAsSaved: boolean = true): void {
    const serializedSnapshot = options.serializeCurrentDocument();
    historyState.undoStack = [serializedSnapshot];
    historyState.redoStack = [];
    if (markAsSaved) {
      historyState.savedSnapshot = serializedSnapshot;
    }
    syncWorkspaceDirtyWithHistory(serializedSnapshot);
  }

  function syncSavedSnapshot(): void {
    const serializedSnapshot = options.serializeCurrentDocument();
    if (historyState.undoStack.length === 0) {
      historyState.undoStack = [serializedSnapshot];
    } else {
      historyState.undoStack[historyState.undoStack.length - 1] = serializedSnapshot;
    }
    historyState.savedSnapshot = serializedSnapshot;
    syncWorkspaceDirtyWithHistory(serializedSnapshot);
  }

  function recordSnapshot(): void {
    if (historyState.isApplying) {
      options.markWorkspaceDirty();
      return;
    }

    const serializedSnapshot = options.serializeCurrentDocument();
    const currentSnapshot = historyState.undoStack[historyState.undoStack.length - 1];
    if (currentSnapshot !== serializedSnapshot) {
      historyState.undoStack.push(serializedSnapshot);
      if (historyState.undoStack.length > historyLimit) {
        historyState.undoStack.shift();
      }
      historyState.redoStack = [];
    }
    syncWorkspaceDirtyWithHistory(serializedSnapshot);
  }

  async function applyHistorySnapshot(serializedSnapshot: string): Promise<boolean> {
    let rawDocument: unknown;
    try {
      rawDocument = JSON.parse(serializedSnapshot) as unknown;
    } catch {
      return false;
    }

    const previewDocument = options.sanitizePreviewDocument(rawDocument);
    if (!previewDocument) {
      return false;
    }

    historyState.isApplying = true;
    try {
      await options.applyPreviewDocumentToState(previewDocument);
    } finally {
      historyState.isApplying = false;
    }

    syncWorkspaceDirtyWithHistory(serializedSnapshot);
    options.updateDocumentUi();
    return true;
  }

  function runHistoryTransition(transition: () => Promise<boolean>): Promise<boolean> {
    if (historyState.inFlightTransition) {
      return historyState.inFlightTransition;
    }

    const transitionPromise = (async () => {
      try {
        return await transition();
      } finally {
        historyState.inFlightTransition = null;
      }
    })();

    historyState.inFlightTransition = transitionPromise;
    return transitionPromise;
  }

  async function undo(): Promise<boolean> {
    return runHistoryTransition(async () => {
      if (historyState.undoStack.length <= 1) {
        return false;
      }

      const currentSnapshot = historyState.undoStack.pop();
      const previousSnapshot = historyState.undoStack[historyState.undoStack.length - 1];
      if (!currentSnapshot || !previousSnapshot) {
        if (currentSnapshot) {
          historyState.undoStack.push(currentSnapshot);
        }
        return false;
      }

      historyState.redoStack.push(currentSnapshot);
      const didApply = await applyHistorySnapshot(previousSnapshot);
      if (!didApply) {
        historyState.redoStack.pop();
        historyState.undoStack.push(currentSnapshot);
        return false;
      }

      return true;
    });
  }

  async function redo(): Promise<boolean> {
    return runHistoryTransition(async () => {
      const nextSnapshot = historyState.redoStack.pop();
      if (!nextSnapshot) {
        return false;
      }

      historyState.undoStack.push(nextSnapshot);
      const didApply = await applyHistorySnapshot(nextSnapshot);
      if (!didApply) {
        historyState.undoStack.pop();
        historyState.redoStack.push(nextSnapshot);
        return false;
      }

      return true;
    });
  }

  return {
    resetFromCurrentDocument,
    syncSavedSnapshot,
    recordSnapshot,
    undo,
    redo
  };
}