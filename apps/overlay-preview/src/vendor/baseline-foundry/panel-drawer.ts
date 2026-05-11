export interface PanelDrawerInitOptions {
  root?: ParentNode;
}

const APPLICATION_SELECTOR = ".bf-application";
const DRAWER_SELECTOR = ".bf-aside.is-overlay, .bf-aside.is-drawer";
const TOGGLE_SELECTOR = "[data-panel-drawer-toggle]";
const CLOSE_SELECTOR = "[data-panel-drawer-close]";
const OVERLAY_SELECTOR = ".bf-application-overlay";
const APPLICATION_OPEN_CLASS = "is-drawer-expanded";
const DRAWER_OPEN_CLASS = "is-open";

const lastTriggerByDrawer = new WeakMap<HTMLElement, HTMLElement>();

function queryAllWithinRoot<T extends Element>(root: ParentNode, selector: string): T[] {
  const elements = Array.from(root.querySelectorAll<T>(selector));

  if (root instanceof Element && root.matches(selector)) {
    elements.unshift(root as T);
  }

  return elements;
}

function getDrawers(root: ParentNode): HTMLElement[] {
  return queryAllWithinRoot<HTMLElement>(root, DRAWER_SELECTOR);
}

function normalizeTargetId(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.startsWith("#") ? value.slice(1) : value;
}

function getApplication(drawer: HTMLElement): HTMLElement | null {
  return drawer.closest<HTMLElement>(APPLICATION_SELECTOR);
}

function getAssociatedToggles(root: ParentNode, drawer: HTMLElement): HTMLElement[] {
  return queryAllWithinRoot<HTMLElement>(root, TOGGLE_SELECTOR).filter(toggle => {
    return resolveDrawer(toggle, root) === drawer;
  });
}

function resolveDrawer(control: Element, root: ParentNode): HTMLElement | null {
  const targetId = normalizeTargetId(
    control.getAttribute("aria-controls")
    ?? (control instanceof HTMLElement ? control.dataset.panelDrawerTarget ?? null : null)
  );

  if (targetId) {
    const target = root.querySelector<HTMLElement>(`#${CSS.escape(targetId)}`);
    if (target?.matches(DRAWER_SELECTOR)) {
      return target;
    }
  }

  const application = control.closest<HTMLElement>(APPLICATION_SELECTOR);
  return application?.querySelector<HTMLElement>(DRAWER_SELECTOR) ?? null;
}

function updateToggles(root: ParentNode, drawer: HTMLElement, expanded: boolean): void {
  for (const toggle of getAssociatedToggles(root, drawer)) {
    toggle.setAttribute("aria-expanded", String(expanded));
  }
}

function isOpen(drawer: HTMLElement): boolean {
  const application = getApplication(drawer);
  if (!application) {
    return drawer.classList.contains(DRAWER_OPEN_CLASS);
  }

  return application.classList.contains(APPLICATION_OPEN_CLASS) || drawer.classList.contains(DRAWER_OPEN_CLASS);
}

function syncApplicationState(application: HTMLElement): void {
  const hasOpenDrawer = Array.from(application.querySelectorAll<HTMLElement>(DRAWER_SELECTOR)).some(drawer => {
    return drawer.classList.contains(DRAWER_OPEN_CLASS);
  });

  application.classList.toggle(APPLICATION_OPEN_CLASS, hasOpenDrawer);

  const overlay = application.querySelector<HTMLElement>(OVERLAY_SELECTOR);
  if (overlay) {
    overlay.setAttribute("aria-hidden", String(!hasOpenDrawer));
  }
}

function focusDrawer(drawer: HTMLElement): void {
  const focusTarget = drawer.querySelector<HTMLElement>(
    "[data-panel-drawer-autofocus], [data-panel-drawer-close], button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
  );

  if (focusTarget) {
    queueMicrotask(() => focusTarget.focus());
  }
}

function openDrawer(drawer: HTMLElement, root: ParentNode, trigger?: HTMLElement): void {
  for (const otherDrawer of getDrawers(root)) {
    if (otherDrawer !== drawer && isOpen(otherDrawer)) {
      closeDrawer(otherDrawer, root, false);
    }
  }

  drawer.classList.add(DRAWER_OPEN_CLASS);
  drawer.setAttribute("aria-hidden", "false");
  updateToggles(root, drawer, true);

  const application = getApplication(drawer);
  if (application) {
    syncApplicationState(application);
  }

  if (trigger) {
    lastTriggerByDrawer.set(drawer, trigger);
  }

  focusDrawer(drawer);
}

function closeDrawer(drawer: HTMLElement, root: ParentNode, restoreFocus: boolean): void {
  drawer.classList.remove(DRAWER_OPEN_CLASS);
  drawer.setAttribute("aria-hidden", "true");
  updateToggles(root, drawer, false);

  const application = getApplication(drawer);
  if (application) {
    syncApplicationState(application);
  }

  if (restoreFocus) {
    lastTriggerByDrawer.get(drawer)?.focus();
  }
}

function syncInitialState(root: ParentNode): void {
  for (const drawer of getDrawers(root)) {
    drawer.setAttribute("aria-hidden", String(!isOpen(drawer)));
    updateToggles(root, drawer, isOpen(drawer));

    const application = getApplication(drawer);
    if (application) {
      syncApplicationState(application);
    }
  }
}

export function initPanelDrawers(options: PanelDrawerInitOptions = {}): () => void {
  const root = options.root ?? document;

  syncInitialState(root);

  const onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const toggle = target.closest<HTMLElement>(TOGGLE_SELECTOR);
    if (toggle) {
      const drawer = resolveDrawer(toggle, root);
      if (!drawer) {
        return;
      }

      if (isOpen(drawer)) {
        closeDrawer(drawer, root, false);
      } else {
        openDrawer(drawer, root, toggle);
      }

      event.preventDefault();
      return;
    }

    const closeControl = target.closest<HTMLElement>(CLOSE_SELECTOR);
    if (closeControl) {
      const drawer = resolveDrawer(closeControl, root)
        ?? closeControl.closest<HTMLElement>(DRAWER_SELECTOR);

      if (drawer) {
        closeDrawer(drawer, root, true);
      }

      event.preventDefault();
      return;
    }

    const overlay = target.closest<HTMLElement>(OVERLAY_SELECTOR);
    if (overlay) {
      const application = overlay.closest<HTMLElement>(APPLICATION_SELECTOR);
      const drawer = application?.querySelector<HTMLElement>(DRAWER_SELECTOR);
      if (drawer) {
        closeDrawer(drawer, root, true);
      }
    }
  };

  const onKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent) || event.key !== "Escape") {
      return;
    }

    for (const drawer of getDrawers(root)) {
      if (isOpen(drawer)) {
        closeDrawer(drawer, root, true);
      }
    }
  };

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeyDown);

  return () => {
    root.removeEventListener("click", onClick);
    root.removeEventListener("keydown", onKeyDown);
  };
}
