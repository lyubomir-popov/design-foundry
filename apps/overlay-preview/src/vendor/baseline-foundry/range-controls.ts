export interface RangeControlsInitOptions {
  root?: ParentNode;
  rangeSelector?: string;
  numberSelector?: string;
  wrapperSelector?: string;
}

const DEFAULT_RANGE_SELECTOR = "input[type='range']";
const DEFAULT_NUMBER_SELECTOR = ".bf-slider-input";
const DEFAULT_WRAPPER_SELECTOR = ".bf-slider";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getBounds(input: HTMLInputElement): { min: number; max: number; } {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);

  if (Number.isNaN(min) || Number.isNaN(max) || min === max) {
    return { min: 0, max: 100 };
  }

  return { min, max };
}

export function updateRangeFill(range: HTMLInputElement): void {
  const { min, max } = getBounds(range);
  const value = Number(range.value || min);
  const percent = ((clamp(value, min, max) - min) / (max - min)) * 100;
  range.style.setProperty("--bf-slider-fill-percent", `${percent}%`);
}

function findPairedNumberInput(range: HTMLInputElement, options: RangeControlsInitOptions): HTMLInputElement | null {
  const wrapperSelector = options.wrapperSelector ?? DEFAULT_WRAPPER_SELECTOR;
  const numberSelector = options.numberSelector ?? DEFAULT_NUMBER_SELECTOR;
  const wrapper = range.closest<HTMLElement>(wrapperSelector);

  if (!wrapper) {
    return null;
  }

  return wrapper.querySelector<HTMLInputElement>(numberSelector);
}

export function setupRangeControl(range: HTMLInputElement, options: RangeControlsInitOptions = {}): void {
  if (range.dataset.bfRangeInitialized === "true") {
    updateRangeFill(range);
    return;
  }

  const pairedNumberInput = findPairedNumberInput(range, options);
  updateRangeFill(range);

  if (pairedNumberInput) {
    pairedNumberInput.value = range.value;

    const syncFromNumberInput = (): void => {
      const { min, max } = getBounds(range);
      const numericValue = Number(pairedNumberInput.value || range.value);
      const nextValue = clamp(Number.isNaN(numericValue) ? Number(range.value) : numericValue, min, max);
      range.value = String(nextValue);
      pairedNumberInput.value = String(nextValue);
      updateRangeFill(range);
    };

    pairedNumberInput.addEventListener("input", syncFromNumberInput);
    pairedNumberInput.addEventListener("change", syncFromNumberInput);
  }

  range.addEventListener("input", () => {
    updateRangeFill(range);
    if (pairedNumberInput) {
      pairedNumberInput.value = range.value;
    }
  });

  range.addEventListener("change", () => {
    updateRangeFill(range);
    if (pairedNumberInput) {
      pairedNumberInput.value = range.value;
    }
  });

  range.dataset.bfRangeInitialized = "true";
}

export function initRangeControls(options: RangeControlsInitOptions = {}): void {
  const root = options.root ?? document;
  const rangeSelector = options.rangeSelector ?? DEFAULT_RANGE_SELECTOR;
  const ranges = root.querySelectorAll<HTMLInputElement>(rangeSelector);

  ranges.forEach(range => {
    if (range.type === "range") {
      setupRangeControl(range, options);
    }
  });
}
