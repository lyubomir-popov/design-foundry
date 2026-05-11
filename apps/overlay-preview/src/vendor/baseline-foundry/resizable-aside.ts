export interface ResizableAsideInitOptions {
  root?: ParentNode;
}

const APPLICATION_SELECTOR = ".bf-application";
const PINNED_ASIDE_SELECTOR = ".bf-aside.is-pinned";
const HANDLE_SELECTOR = ".bf-application-aside-resize-handle";
const DEFAULT_STEP_PX = 16;
const DEFAULT_STORAGE_PREFIX = "baseline-foundry-aside-width";
const RESIZING_CLASS = "is-resizing-aside";

function queryAllWithinRoot<T extends Element>(root: ParentNode, selector: string): T[] {
  const elements = Array.from(root.querySelectorAll<T>(selector));

  if (root instanceof Element && root.matches(selector)) {
    elements.unshift(root as T);
  }

  return elements;
}

function getApplications(root: ParentNode): HTMLElement[] {
  return queryAllWithinRoot<HTMLElement>(root, APPLICATION_SELECTOR);
}

function resolveCssLengthPx(context: HTMLElement, cssValue: string, fallbackPx: number): number {
  const trimmedValue = cssValue.trim();
  if (!trimmedValue) {
    return fallbackPx;
  }

  const probe = document.createElement("div");
  probe.style.border = "0";
  probe.style.inlineSize = trimmedValue;
  probe.style.margin = "0";
  probe.style.opacity = "0";
  probe.style.padding = "0";
  probe.style.pointerEvents = "none";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  context.appendChild(probe);
  const resolvedPx = probe.getBoundingClientRect().width;
  probe.remove();

  return Number.isFinite(resolvedPx) && resolvedPx > 0 ? resolvedPx : fallbackPx;
}

function resolveNumericDatasetValue(...values: Array<string | undefined>): number | null {
  for (const value of values) {
    if (!value) {
      continue;
    }

    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function getPinnedAside(application: HTMLElement): HTMLElement | null {
  return Array.from(application.children).find((child): child is HTMLElement => {
    return child instanceof HTMLElement && child.matches(PINNED_ASIDE_SELECTOR);
  }) ?? application.querySelector<HTMLElement>(PINNED_ASIDE_SELECTOR);
}

function getResizeHandle(application: HTMLElement, aside: HTMLElement | null): HTMLElement | null {
  return aside?.querySelector<HTMLElement>(HANDLE_SELECTOR)
    ?? application.querySelector<HTMLElement>(HANDLE_SELECTOR)
    ?? null;
}

function isPinnedResizableAside(aside: HTMLElement | null): aside is HTMLElement {
  return Boolean(
    aside
    && aside.classList.contains("is-pinned")
    && !aside.classList.contains("is-overlay")
    && !aside.classList.contains("is-drawer")
    && !aside.classList.contains("is-collapsed")
  );
}

function getStorageKey(application: HTMLElement, aside: HTMLElement, handle: HTMLElement): string | null {
  const configuredKey = handle.dataset.asideResizeStorageKey
    ?? aside.dataset.asideResizeStorageKey
    ?? application.dataset.asideResizeStorageKey;

  if (configuredKey === "") {
    return null;
  }

  if (configuredKey) {
    return configuredKey;
  }

  const identity = aside.id || application.id;
  if (!identity) {
    return null;
  }

  return `${DEFAULT_STORAGE_PREFIX}:${location.pathname}:${identity}`;
}

function getStepPx(application: HTMLElement, aside: HTMLElement, handle: HTMLElement): number {
  return resolveNumericDatasetValue(
    handle.dataset.asideResizeStep,
    aside.dataset.asideResizeStep,
    application.dataset.asideResizeStep
  ) ?? DEFAULT_STEP_PX;
}

function getWidthBounds(application: HTMLElement, aside: HTMLElement, handle: HTMLElement): { minPx: number; maxPx: number; } {
  const computedStyle = getComputedStyle(application);
  const minFromDataset = handle.dataset.asideResizeMin
    ?? aside.dataset.asideResizeMin
    ?? application.dataset.asideResizeMin;
  const maxFromDataset = handle.dataset.asideResizeMax
    ?? aside.dataset.asideResizeMax
    ?? application.dataset.asideResizeMax;
  const minValue = minFromDataset
    ?? computedStyle.getPropertyValue("--bf-app-aside-width-min")
    ?? computedStyle.getPropertyValue("--bf-application-aside-width-min")
    ?? computedStyle.getPropertyValue("--bf-app-drawer-width-small")
    ?? computedStyle.getPropertyValue("--bf-application-drawer-width-small");
  const maxValue = maxFromDataset
    ?? computedStyle.getPropertyValue("--bf-app-aside-width-max")
    ?? computedStyle.getPropertyValue("--bf-application-aside-width-max")
    ?? computedStyle.getPropertyValue("--bf-app-drawer-width-medium-max")
    ?? computedStyle.getPropertyValue("--bf-application-drawer-width-medium-max");
  const minPx = resolveCssLengthPx(application, minValue, 240);
  const maxPx = resolveCssLengthPx(application, maxValue, 640);

  return {
    minPx,
    maxPx: Math.max(minPx, maxPx)
  };
}

function getCurrentWidthPx(application: HTMLElement, aside: HTMLElement): number {
  const measuredWidth = aside.getBoundingClientRect().width;
  if (measuredWidth > 0) {
    return measuredWidth;
  }

  const computedStyle = getComputedStyle(application);
  return resolveCssLengthPx(
    application,
    computedStyle.getPropertyValue("--bf-app-aside-width")
      || computedStyle.getPropertyValue("--bf-application-aside-width"),
    465
  );
}

function clamp(value: number, minPx: number, maxPx: number): number {
  return Math.max(minPx, Math.min(maxPx, value));
}

function setHandleInteractivity(handle: HTMLElement, enabled: boolean): void {
  handle.setAttribute("aria-disabled", String(!enabled));
  handle.tabIndex = enabled ? 0 : -1;
}

function updateHandleA11y(application: HTMLElement, aside: HTMLElement, handle: HTMLElement, widthPx = getCurrentWidthPx(application, aside)): void {
  if (!handle.hasAttribute("role")) {
    handle.setAttribute("role", "separator");
  }

  if (!handle.hasAttribute("aria-orientation")) {
    handle.setAttribute("aria-orientation", "vertical");
  }

  if (!handle.hasAttribute("aria-label")) {
    handle.setAttribute("aria-label", "Resize panel");
  }

  if (aside.id && !handle.hasAttribute("aria-controls")) {
    handle.setAttribute("aria-controls", aside.id);
  }

  const enabled = isPinnedResizableAside(aside);
  setHandleInteractivity(handle, enabled);

  if (!enabled) {
    return;
  }

  const { minPx, maxPx } = getWidthBounds(application, aside, handle);
  handle.setAttribute("aria-valuemin", String(Math.round(minPx)));
  handle.setAttribute("aria-valuemax", String(Math.round(maxPx)));
  handle.setAttribute("aria-valuenow", String(Math.round(clamp(widthPx, minPx, maxPx))));
}

function readPersistedWidth(storageKey: string | null): number | null {
  if (!storageKey) {
    return null;
  }

  try {
    const rawWidth = localStorage.getItem(storageKey);
    if (!rawWidth) {
      return null;
    }

    const parsedWidth = Number.parseFloat(rawWidth);
    return Number.isFinite(parsedWidth) ? parsedWidth : null;
  } catch {
    return null;
  }
}

function writePersistedWidth(storageKey: string | null, widthPx: number): void {
  if (!storageKey) {
    return;
  }

  try {
    localStorage.setItem(storageKey, String(Math.round(widthPx)));
  } catch {
    // Ignore storage failures so the shell still works in restricted environments.
  }
}

function clearPersistedWidth(storageKey: string | null): void {
  if (!storageKey) {
    return;
  }

  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures so reset still works visually.
  }
}

function applyWidth(application: HTMLElement, aside: HTMLElement, handle: HTMLElement, storageKey: string | null, widthPx: number, persist: boolean): number {
  const { minPx, maxPx } = getWidthBounds(application, aside, handle);
  const nextWidthPx = clamp(widthPx, minPx, maxPx);

  application.style.setProperty("--bf-app-aside-width", `${nextWidthPx}px`);
  application.style.setProperty("--bf-application-aside-width", `${nextWidthPx}px`);
  updateHandleA11y(application, aside, handle, nextWidthPx);

  if (persist) {
    writePersistedWidth(storageKey, nextWidthPx);
  }

  return nextWidthPx;
}

function resetWidth(application: HTMLElement, aside: HTMLElement, handle: HTMLElement, storageKey: string | null): void {
  clearPersistedWidth(storageKey);
  application.style.removeProperty("--bf-app-aside-width");
  application.style.removeProperty("--bf-application-aside-width");
  updateHandleA11y(application, aside, handle);
}

function syncHandleToRenderedWidth(application: HTMLElement, aside: HTMLElement, handle: HTMLElement): void {
  updateHandleA11y(application, aside, handle, getCurrentWidthPx(application, aside));
}

function setupApplication(application: HTMLElement): () => void {
  const aside = getPinnedAside(application);
  const handle = getResizeHandle(application, aside);
  if (!aside || !handle) {
    return () => {};
  }

  const storageKey = getStorageKey(application, aside, handle);
  const stepPx = getStepPx(application, aside, handle);
  const persistedWidth = readPersistedWidth(storageKey);

  if (persistedWidth !== null) {
    applyWidth(application, aside, handle, storageKey, persistedWidth, false);
  } else {
    updateHandleA11y(application, aside, handle);
  }

  let initialSyncFrameId = 0;
  const onWindowLoad = (): void => {
    syncHandleToRenderedWidth(application, aside, handle);
  };

  initialSyncFrameId = window.requestAnimationFrame(() => {
    syncHandleToRenderedWidth(application, aside, handle);
  });
  window.addEventListener("load", onWindowLoad, { once: true });

  const onDoubleClick = (): void => {
    resetWidth(application, aside, handle, storageKey);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!isPinnedResizableAside(aside)) {
      return;
    }

    const currentWidthPx = getCurrentWidthPx(application, aside);
    const { minPx, maxPx } = getWidthBounds(application, aside, handle);
    const adjustedStepPx = event.shiftKey ? stepPx * 3 : stepPx;

    if (event.key === "ArrowLeft") {
      applyWidth(application, aside, handle, storageKey, currentWidthPx + adjustedStepPx, true);
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowRight") {
      applyWidth(application, aside, handle, storageKey, currentWidthPx - adjustedStepPx, true);
      event.preventDefault();
      return;
    }

    if (event.key === "Home") {
      applyWidth(application, aside, handle, storageKey, minPx, true);
      event.preventDefault();
      return;
    }

    if (event.key === "End") {
      applyWidth(application, aside, handle, storageKey, maxPx, true);
      event.preventDefault();
    }
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !isPinnedResizableAside(aside)) {
      return;
    }

    event.preventDefault();
    const shellRect = application.getBoundingClientRect();
    application.classList.add(RESIZING_CLASS);
    handle.setPointerCapture(event.pointerId);
    let finished = false;

    const onPointerMove = (moveEvent: PointerEvent): void => {
      const nextWidthPx = shellRect.right - moveEvent.clientX;
      applyWidth(application, aside, handle, storageKey, nextWidthPx, false);
    };

    const finishResize = (): void => {
      if (finished) {
        return;
      }

      finished = true;
      application.classList.remove(RESIZING_CLASS);
      applyWidth(application, aside, handle, storageKey, getCurrentWidthPx(application, aside), true);
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", finishResize);
      handle.removeEventListener("pointercancel", finishResize);
      handle.removeEventListener("lostpointercapture", finishResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);

      if (handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
    };

    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", finishResize, { once: true });
    handle.addEventListener("pointercancel", finishResize, { once: true });
    handle.addEventListener("lostpointercapture", finishResize, { once: true });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", finishResize, { once: true });
    window.addEventListener("pointercancel", finishResize, { once: true });
  };

  const onWindowResize = (): void => {
    if (isPinnedResizableAside(aside)) {
      applyWidth(application, aside, handle, storageKey, getCurrentWidthPx(application, aside), false);
      return;
    }

    updateHandleA11y(application, aside, handle);
  };

  handle.addEventListener("dblclick", onDoubleClick);
  handle.addEventListener("keydown", onKeyDown);
  handle.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("resize", onWindowResize);

  return () => {
    if (initialSyncFrameId !== 0) {
      window.cancelAnimationFrame(initialSyncFrameId);
    }

    window.removeEventListener("load", onWindowLoad);
    handle.removeEventListener("dblclick", onDoubleClick);
    handle.removeEventListener("keydown", onKeyDown);
    handle.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("resize", onWindowResize);
  };
}

export function initResizableAsides(options: ResizableAsideInitOptions = {}): () => void {
  const root = options.root ?? document;
  const cleanups = getApplications(root).map(setupApplication);

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
