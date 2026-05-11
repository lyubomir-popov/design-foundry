export interface TopNavigationInitOptions {
  root?: ParentNode;
}

const ROOT_SELECTOR = ".bf-top-navigation";
const NAV_SELECTOR = ".bf-top-navigation-nav";
const SEARCH_SELECTOR = ".bf-top-navigation-search";
const SEARCH_INPUT_SELECTOR = ".bf-top-navigation-search .bf-search-box-input";
const DROPDOWN_ITEM_SELECTOR = ".bf-top-navigation-item.is-dropdown-toggle";
const DROPDOWN_TOGGLE_SELECTOR = ".bf-top-navigation-dropdown-toggle";
const DROPDOWN_SELECTOR = ".bf-top-navigation-dropdown";
const MENU_TOGGLE_SELECTOR = ".bf-top-navigation-menu-toggle";
const SEARCH_TOGGLE_SELECTOR = ".bf-top-navigation-search-toggle";
const OVERLAY_SELECTOR = ".bf-top-navigation-search-overlay";
const DROPDOWN_ACTION_SELECTOR = ".bf-top-navigation-dropdown-item";
const DROPDOWN_ACTIVE_CLASS = "is-active";
const LARGE_BREAKPOINT = "(min-width: 64.75rem)";

let generatedIdCounter = 0;

const lastMenuTriggerByRoot = new WeakMap<HTMLElement, HTMLElement>();
const lastSearchTriggerByRoot = new WeakMap<HTMLElement, HTMLElement>();
const lastDropdownTriggerByRoot = new WeakMap<HTMLElement, HTMLElement>();
const menuOpenRoots = new WeakSet<HTMLElement>();
const searchOpenRoots = new WeakSet<HTMLElement>();

function queryAllWithinRoot<T extends Element>(root: ParentNode, selector: string): T[] {
  const elements = Array.from(root.querySelectorAll<T>(selector));

  if (root instanceof Element && root.matches(selector)) {
    elements.unshift(root as T);
  }

  return elements;
}

function getRootWindow(root: ParentNode): Window | null {
  if (root instanceof Document) {
    return root.defaultView;
  }

  return root.ownerDocument?.defaultView ?? null;
}

function getRoots(root: ParentNode): HTMLElement[] {
  return queryAllWithinRoot<HTMLElement>(root, ROOT_SELECTOR);
}

function getNav(topNavigation: HTMLElement): HTMLElement | null {
  return topNavigation.querySelector<HTMLElement>(NAV_SELECTOR);
}

function getSearch(topNavigation: HTMLElement): HTMLElement | null {
  return topNavigation.querySelector<HTMLElement>(SEARCH_SELECTOR);
}

function getSearchInput(topNavigation: HTMLElement): HTMLElement | null {
  return topNavigation.querySelector<HTMLElement>(SEARCH_INPUT_SELECTOR);
}

function getDropdownItems(topNavigation: HTMLElement): HTMLElement[] {
  return Array.from(topNavigation.querySelectorAll<HTMLElement>(DROPDOWN_ITEM_SELECTOR));
}

function getDropdownToggles(topNavigation: HTMLElement): HTMLElement[] {
  return Array.from(topNavigation.querySelectorAll<HTMLElement>(DROPDOWN_TOGGLE_SELECTOR));
}

function getDropdownItemForToggle(toggle: HTMLElement): HTMLElement | null {
  return toggle.closest<HTMLElement>(DROPDOWN_ITEM_SELECTOR);
}

function getDropdownForToggle(toggle: HTMLElement): HTMLElement | null {
  const controlledId = toggle.getAttribute("aria-controls");
  if (controlledId) {
    const controlledElement = toggle.ownerDocument.getElementById(controlledId);
    if (controlledElement instanceof HTMLElement && controlledElement.matches(DROPDOWN_SELECTOR)) {
      return controlledElement;
    }
  }

  const dropdownItem = getDropdownItemForToggle(toggle);
  return dropdownItem?.querySelector<HTMLElement>(DROPDOWN_SELECTOR) ?? null;
}

function getOverlay(topNavigation: HTMLElement): HTMLElement | null {
  return topNavigation.querySelector<HTMLElement>(OVERLAY_SELECTOR);
}

function getMenuToggles(topNavigation: HTMLElement): HTMLElement[] {
  return Array.from(topNavigation.querySelectorAll<HTMLElement>(MENU_TOGGLE_SELECTOR));
}

function getSearchToggles(topNavigation: HTMLElement): HTMLElement[] {
  return Array.from(topNavigation.querySelectorAll<HTMLElement>(SEARCH_TOGGLE_SELECTOR));
}

function isLargeViewport(target: HTMLElement): boolean {
  return target.ownerDocument.defaultView?.matchMedia(LARGE_BREAKPOINT).matches ?? false;
}

function isMenuOpen(topNavigation: HTMLElement): boolean {
  return menuOpenRoots.has(topNavigation);
}

function isSearchOpen(topNavigation: HTMLElement): boolean {
  return searchOpenRoots.has(topNavigation);
}

function setMenuOpen(topNavigation: HTMLElement, isOpen: boolean): void {
  if (isOpen) {
    menuOpenRoots.add(topNavigation);
    return;
  }

  menuOpenRoots.delete(topNavigation);
}

function setSearchOpen(topNavigation: HTMLElement, isOpen: boolean): void {
  if (isOpen) {
    searchOpenRoots.add(topNavigation);
    return;
  }

  searchOpenRoots.delete(topNavigation);
}

function isDropdownOpen(dropdownItem: HTMLElement): boolean {
  return dropdownItem.classList.contains(DROPDOWN_ACTIVE_CLASS);
}

function hasOpenDropdown(topNavigation: HTMLElement): boolean {
  return getDropdownItems(topNavigation).some(isDropdownOpen);
}

function ensureId(element: HTMLElement, prefix: string): string {
  if (!element.id) {
    generatedIdCounter += 1;
    element.id = `${prefix}-${generatedIdCounter}`;
  }

  return element.id;
}

function ensureRelationships(topNavigation: HTMLElement): void {
  const nav = getNav(topNavigation);
  if (nav) {
    const navId = ensureId(nav, "bf-top-navigation-nav");
    for (const toggle of getMenuToggles(topNavigation)) {
      if (!toggle.hasAttribute("aria-controls")) {
        toggle.setAttribute("aria-controls", navId);
      }
    }
  }

  const search = getSearch(topNavigation);
  if (search) {
    const searchId = ensureId(search, "bf-top-navigation-search");
    for (const toggle of getSearchToggles(topNavigation)) {
      if (!toggle.hasAttribute("aria-controls")) {
        toggle.setAttribute("aria-controls", searchId);
      }
    }
  }

  for (const toggle of getDropdownToggles(topNavigation)) {
    const dropdown = getDropdownForToggle(toggle);
    if (!dropdown) {
      continue;
    }

    const dropdownId = ensureId(dropdown, "bf-top-navigation-dropdown");
    if (!toggle.hasAttribute("aria-controls")) {
      toggle.setAttribute("aria-controls", dropdownId);
    }

    toggle.setAttribute("aria-haspopup", "true");
  }
}

function closeDropdowns(topNavigation: HTMLElement, activeItem?: HTMLElement | null): void {
  for (const item of getDropdownItems(topNavigation)) {
    item.classList.toggle(DROPDOWN_ACTIVE_CLASS, item === activeItem);
  }
}

function updateA11y(topNavigation: HTMLElement): void {
  ensureRelationships(topNavigation);

  const menuOpen = isMenuOpen(topNavigation);
  const searchOpen = isSearchOpen(topNavigation);
  const largeViewport = isLargeViewport(topNavigation);

  for (const toggle of getMenuToggles(topNavigation)) {
    toggle.setAttribute("aria-expanded", String(menuOpen));
  }

  for (const toggle of getSearchToggles(topNavigation)) {
    toggle.setAttribute("aria-expanded", String(searchOpen));
    toggle.setAttribute("aria-pressed", String(searchOpen));
  }

  for (const toggle of getDropdownToggles(topNavigation)) {
    const dropdownItem = getDropdownItemForToggle(toggle);
    const dropdown = getDropdownForToggle(toggle);
    const expanded = dropdownItem ? isDropdownOpen(dropdownItem) : false;

    toggle.setAttribute("aria-expanded", String(expanded));
    dropdown?.setAttribute("aria-hidden", String(!expanded));
  }

  getNav(topNavigation)?.setAttribute("aria-hidden", String(!largeViewport && !menuOpen && !searchOpen));
  getSearch(topNavigation)?.setAttribute("aria-hidden", String(!searchOpen));
  getOverlay(topNavigation)?.setAttribute("aria-hidden", String(!(largeViewport && searchOpen)));
}

function focusSearch(topNavigation: HTMLElement): void {
  const input = getSearchInput(topNavigation);
  if (input) {
    queueMicrotask(() => input.focus());
    return;
  }

  const search = getSearch(topNavigation);
  const focusTarget = search?.querySelector<HTMLElement>(
    "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
  );

  if (focusTarget) {
    queueMicrotask(() => focusTarget.focus());
  }
}

function closeAll(topNavigation: HTMLElement, restoreFocus: boolean): void {
  const hadSearchOpen = isSearchOpen(topNavigation);
  const hadMenuOpen = isMenuOpen(topNavigation);
  const hadDropdownOpen = hasOpenDropdown(topNavigation);

  setMenuOpen(topNavigation, false);
  setSearchOpen(topNavigation, false);
  closeDropdowns(topNavigation);
  updateA11y(topNavigation);

  if (!restoreFocus) {
    return;
  }

  if (hadSearchOpen) {
    lastSearchTriggerByRoot.get(topNavigation)?.focus();
    return;
  }

  if (hadDropdownOpen) {
    lastDropdownTriggerByRoot.get(topNavigation)?.focus();
    return;
  }

  if (hadMenuOpen) {
    lastMenuTriggerByRoot.get(topNavigation)?.focus();
  }
}

function openMenu(topNavigation: HTMLElement, trigger?: HTMLElement): void {
  setSearchOpen(topNavigation, false);
  closeDropdowns(topNavigation);
  setMenuOpen(topNavigation, true);
  updateA11y(topNavigation);

  if (trigger) {
    lastMenuTriggerByRoot.set(topNavigation, trigger);
  }
}

function openSearch(topNavigation: HTMLElement, trigger?: HTMLElement): void {
  closeDropdowns(topNavigation);
  setMenuOpen(topNavigation, false);
  setSearchOpen(topNavigation, true);
  updateA11y(topNavigation);

  if (trigger) {
    lastSearchTriggerByRoot.set(topNavigation, trigger);
  }

  focusSearch(topNavigation);
}

function openDropdown(topNavigation: HTMLElement, trigger: HTMLElement): void {
  const dropdownItem = getDropdownItemForToggle(trigger);
  if (!dropdownItem) {
    return;
  }

  setSearchOpen(topNavigation, false);
  closeDropdowns(topNavigation, dropdownItem);
  updateA11y(topNavigation);
  lastDropdownTriggerByRoot.set(topNavigation, trigger);
}

function syncInitialState(root: ParentNode): void {
  for (const topNavigation of getRoots(root)) {
    ensureRelationships(topNavigation);

    if (isLargeViewport(topNavigation)) {
      setMenuOpen(topNavigation, false);
    }

    if (isMenuOpen(topNavigation) && isSearchOpen(topNavigation)) {
      setMenuOpen(topNavigation, false);
    }

    if (isSearchOpen(topNavigation) || (!isLargeViewport(topNavigation) && !isMenuOpen(topNavigation))) {
      closeDropdowns(topNavigation);
    }

    updateA11y(topNavigation);
  }
}

export function initTopNavigations(options: TopNavigationInitOptions = {}): () => void {
  const root = options.root ?? document;
  const rootWindow = getRootWindow(root);

  syncInitialState(root);

  const onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const menuToggle = target.closest<HTMLElement>(MENU_TOGGLE_SELECTOR);
    if (menuToggle) {
      const topNavigation = menuToggle.closest<HTMLElement>(ROOT_SELECTOR);
      if (!topNavigation) {
        return;
      }

      event.preventDefault();

      if (isMenuOpen(topNavigation)) {
        closeAll(topNavigation, false);
      } else {
        openMenu(topNavigation, menuToggle);
      }

      return;
    }

    const searchToggle = target.closest<HTMLElement>(SEARCH_TOGGLE_SELECTOR);
    if (searchToggle) {
      const topNavigation = searchToggle.closest<HTMLElement>(ROOT_SELECTOR);
      if (!topNavigation) {
        return;
      }

      event.preventDefault();

      if (isSearchOpen(topNavigation)) {
        closeAll(topNavigation, true);
      } else {
        openSearch(topNavigation, searchToggle);
      }

      return;
    }

    const dropdownToggle = target.closest<HTMLElement>(DROPDOWN_TOGGLE_SELECTOR);
    if (dropdownToggle) {
      const topNavigation = dropdownToggle.closest<HTMLElement>(ROOT_SELECTOR);
      const dropdownItem = getDropdownItemForToggle(dropdownToggle);
      if (!topNavigation || !dropdownItem) {
        return;
      }

      event.preventDefault();
      lastDropdownTriggerByRoot.set(topNavigation, dropdownToggle);

      if (isDropdownOpen(dropdownItem)) {
        closeDropdowns(topNavigation);
        updateA11y(topNavigation);
      } else {
        openDropdown(topNavigation, dropdownToggle);
      }

      return;
    }

    const overlay = target.closest<HTMLElement>(OVERLAY_SELECTOR);
    if (overlay) {
      const topNavigation = overlay.closest<HTMLElement>(ROOT_SELECTOR);
      if (!topNavigation) {
        return;
      }

      event.preventDefault();
      closeAll(topNavigation, true);
      return;
    }

    const dropdownAction = target.closest<HTMLElement>(DROPDOWN_ACTION_SELECTOR);
    if (dropdownAction) {
      const topNavigation = dropdownAction.closest<HTMLElement>(ROOT_SELECTOR);
      if (topNavigation && hasOpenDropdown(topNavigation)) {
        closeAll(topNavigation, false);
      }
      return;
    }

    const clickedTopNavigation = target.closest<HTMLElement>(ROOT_SELECTOR);
    for (const topNavigation of getRoots(root)) {
      if (clickedTopNavigation && topNavigation === clickedTopNavigation) {
        continue;
      }

      if (isMenuOpen(topNavigation) || isSearchOpen(topNavigation) || hasOpenDropdown(topNavigation)) {
        closeAll(topNavigation, false);
      }
    }
  };

  const onKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent) || event.key !== "Escape") {
      return;
    }

    for (const topNavigation of getRoots(root)) {
      if (isMenuOpen(topNavigation) || isSearchOpen(topNavigation) || hasOpenDropdown(topNavigation)) {
        closeAll(topNavigation, true);
      }
    }
  };

  const onResize = (): void => {
    syncInitialState(root);
  };

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeyDown);
  rootWindow?.addEventListener("resize", onResize);

  return () => {
    root.removeEventListener("click", onClick);
    root.removeEventListener("keydown", onKeyDown);
    rootWindow?.removeEventListener("resize", onResize);
  };
}