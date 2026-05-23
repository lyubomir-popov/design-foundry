#!/usr/bin/env npx tsx

import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const NETWORK_OVERLAY_VISIBLE_STORAGE_KEY = "brand-layout-ops-network-overlay-visible-v1";
const DEFAULT_ROUTE = "/#document=video-intro-export.brand-layout-ops.json";

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function waitForHttp(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolveReady, rejectReady) => {
    const attempt = () => {
      if (Date.now() > deadline) {
        rejectReady(new Error(`Timed out waiting for ${url}`));
        return;
      }

      fetch(url).then(
        (response) => {
          if (response.ok) {
            resolveReady();
            return;
          }

          setTimeout(attempt, 250);
        },
        () => setTimeout(attempt, 250)
      );
    };

    attempt();
  });
}

function startPreviewServer(port: string): { proc: ChildProcess; url: string } {
  const isWindows = process.platform === "win32";
  const npmCommand = isWindows ? "npm.cmd" : "npm";
  const proc = spawn(npmCommand, ["run", "preview:dev", "--", `--port=${port}`], {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWindows
  });

  proc.stdout?.on("data", () => {});
  proc.stderr?.on("data", () => {});

  return {
    proc,
    url: `http://127.0.0.1:${port}`
  };
}

function stopServer(proc: ChildProcess | null): void {
  if (!proc) {
    return;
  }

  proc.kill();
}

async function openBrowser(): Promise<import("playwright").Browser> {
  try {
    const { chromium } = await import("playwright");
    return await chromium.launch();
  } catch (error) {
    if (error instanceof Error && error.message.includes("Executable doesn't exist")) {
      throw new Error("Playwright Chromium is not installed. Run `npx playwright install chromium` once before UI verification.");
    }

    throw error;
  }
}

async function waitForAutomation(page: import("playwright").Page): Promise<void> {
  await page.waitForFunction(
    () => Boolean((window as unknown as Record<string, { ready?: () => Promise<unknown> }>).__layoutOpsAutomation?.ready),
    { timeout: 15_000 }
  );

  await page.evaluate(
    () => (window as unknown as Record<string, { ready: () => Promise<unknown> }>).__layoutOpsAutomation.ready()
  );
}

function buildPageUrl(baseUrl: string): string {
  if (baseUrl.includes("#")) {
    return baseUrl;
  }

  return `${baseUrl.replace(/\/$/, "")}${DEFAULT_ROUTE}`;
}

async function getActiveBackgroundNodeId(page: import("playwright").Page): Promise<string> {
  const nodeId = await page.evaluate(() => {
    const automation = (window as unknown as Record<string, { getState?: () => Record<string, unknown> }>).__layoutOpsAutomation;
    const state = automation.getState?.();
    const graph = state?.document_background_graph as { activeNodeId?: string } | undefined;
    return graph?.activeNodeId ?? null;
  });

  assert.ok(typeof nodeId === "string", "Expected automation state to expose the active background node id.");
  return nodeId;
}

async function assertTextHidden(page: import("playwright").Page, text: string): Promise<void> {
  assert.equal(
    await page.getByText(text, { exact: true }).count(),
    0,
    `Expected ${text} to be hidden.`
  );
}

async function assertTextVisible(page: import("playwright").Page, text: string): Promise<void> {
  await page.getByText(text, { exact: true }).first().waitFor({ state: "visible" });
}

async function getLayersPanelText(page: import("playwright").Page): Promise<string> {
  return (await page.locator("[data-layers-editor]").textContent()) ?? "";
}

async function getParametersPanelText(page: import("playwright").Page): Promise<string> {
  return (await page.locator("[data-config-editor]").textContent()) ?? "";
}

async function waitForVisibleNumericField(
  page: import("playwright").Page,
  labelText: string
): Promise<void> {
  await page.waitForFunction((targetLabelText) => {
    const panel = document.querySelector<HTMLElement>("[data-config-editor]");
    if (!(panel instanceof HTMLElement)) {
      return false;
    }

    const fields = Array.from(panel.querySelectorAll<HTMLElement>(".bf-field"));
    for (const field of fields) {
      const label = field.querySelector<HTMLElement>(".bf-form-label");
      if (label?.textContent?.trim() !== targetLabelText) {
        continue;
      }

      const inputs = Array.from(field.querySelectorAll<HTMLInputElement>('input[type="number"]'));
      return inputs.some((input) => {
        const style = getComputedStyle(input);
        return style.display !== "none" && style.visibility !== "hidden" && input.offsetParent !== null;
      });
    }

    return false;
  }, labelText, { timeout: 15_000 });
}

async function getVisibleNumericFieldValue(
  page: import("playwright").Page,
  labelText: string
): Promise<string> {
  return page.evaluate((targetLabelText) => {
    const panel = document.querySelector<HTMLElement>("[data-config-editor]");
    if (!(panel instanceof HTMLElement)) {
      throw new Error("Parameters panel not found.");
    }

    const fields = Array.from(panel.querySelectorAll<HTMLElement>(".bf-field"));
    for (const field of fields) {
      const label = field.querySelector<HTMLElement>(".bf-form-label");
      if (label?.textContent?.trim() !== targetLabelText) {
        continue;
      }

      const inputs = Array.from(field.querySelectorAll<HTMLInputElement>('input[type="number"]'));
      const visibleInput = inputs.find((input) => {
        const style = getComputedStyle(input);
        return style.display !== "none" && style.visibility !== "hidden" && input.offsetParent !== null;
      });
      if (visibleInput) {
        return visibleInput.value;
      }
    }

    throw new Error(`Visible numeric field not found for ${targetLabelText}.`);
  }, labelText);
}

async function selectLayersRadio(
  page: import("playwright").Page,
  labelText: string
): Promise<void> {
  await page.locator("[data-layers-editor]").getByRole("button", { name: labelText, exact: true }).click();
}

async function addBackgroundNode(
  page: import("playwright").Page,
  operatorLabel: string
): Promise<void> {
  await page.keyboard.press("Tab");
  const popup = page.locator(".bf-add-node-popup");
  await popup.getByRole("menuitem", { name: operatorLabel, exact: true }).click();
}

async function countLayersTextRows(page: import("playwright").Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-layers-editor]");
    const overlayHeading = Array.from(root?.querySelectorAll<HTMLElement>(".bf-side-navigation-heading") ?? []).find(
      (entry) => entry.textContent?.trim() === "Overlay"
    );
    const overlayList = overlayHeading?.nextElementSibling;
    if (!(overlayList instanceof HTMLUListElement)) {
      return 0;
    }

    return Array.from(overlayList.querySelectorAll<HTMLButtonElement>("button.bf-side-navigation-link")).filter((button) => {
      const label = button.textContent?.trim() ?? "";
      return label !== "Layout" && label !== "Logo";
    }).length;
  });
}

async function waitForLayersTextRowCount(page: import("playwright").Page, expectedCount: number): Promise<void> {
  await page.waitForFunction((expected) => {
    const root = document.querySelector<HTMLElement>("[data-layers-editor]");
    const overlayHeading = Array.from(root?.querySelectorAll<HTMLElement>(".bf-side-navigation-heading") ?? []).find(
      (entry) => entry.textContent?.trim() === "Overlay"
    );
    const overlayList = overlayHeading?.nextElementSibling;
    if (!(overlayList instanceof HTMLUListElement)) {
      return false;
    }

    return Array.from(overlayList.querySelectorAll<HTMLButtonElement>("button.bf-side-navigation-link")).filter((button) => {
      const label = button.textContent?.trim() ?? "";
      return label !== "Layout" && label !== "Logo";
    }).length === expected;
  }, expectedCount, { timeout: 15_000 });
}

async function waitForLayersRadioRemoval(page: import("playwright").Page, labelText: string): Promise<void> {
  await page.waitForFunction((targetLabelText) => {
    const root = document.querySelector<HTMLElement>("[data-layers-editor]");
    if (!(root instanceof HTMLElement)) {
      return false;
    }

    return !Array.from(root.querySelectorAll<HTMLButtonElement>("button.bf-side-navigation-link")).some(
      (button) => button.textContent?.trim() === targetLabelText
    );
  }, labelText, { timeout: 15_000 });
}

async function verifyUiRegressions(origin: string): Promise<void> {
  const browser = await openBrowser();

  try {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1200 },
      deviceScaleFactor: 1
    });

    await page.addInitScript((storageKey) => {
      localStorage.setItem(storageKey, "1");
    }, NETWORK_OVERLAY_VISIBLE_STORAGE_KEY);

    await page.goto(buildPageUrl(origin), { waitUntil: "networkidle" });
    await waitForAutomation(page);
    await page.getByRole("heading", { name: "Parameters" }).waitFor({ state: "visible" });
    await page.getByRole("navigation", { name: "Layers", exact: true }).waitFor({ state: "visible" });

    const layersRailText = await getLayersPanelText(page);
    const overlayParametersText = await getParametersPanelText(page);

    assert.match(layersRailText, /Overlay/);
    assert.match(layersRailText, /Layout/);
    assert.match(layersRailText, /Background/);
    assert.match(layersRailText, /Family/);
    assert.match(layersRailText, /Halo Field/);
    assert.match(overlayParametersText, /Overlay Layout/);
    assert.match(overlayParametersText, /Add Text/);
    assert.match(overlayParametersText, /pick a text or logo layer from the Layers list to edit it\. Press Delete to remove a selected text layer\./i);
    assert.doesNotMatch(overlayParametersText, /Delete Text/);
    assert.doesNotMatch(overlayParametersText, /Node/);
    assert.equal(await page.getByRole("button", { name: "Overlay Layout", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Layout Grid", exact: true }).count(), 0);

    const initialTextLayerCount = await countLayersTextRows(page);
    await page.getByRole("button", { name: "Add Text", exact: true }).click();
    await waitForLayersTextRowCount(page, initialTextLayerCount + 1);

    await page.keyboard.press("Delete");
    await waitForLayersTextRowCount(page, initialTextLayerCount);

    const haloNodeId = await getActiveBackgroundNodeId(page);

    await selectLayersRadio(page, "A Head");

    const textLayerParametersText = await getParametersPanelText(page);
    assert.match(textLayerParametersText, /Text: A Head/);
    assert.doesNotMatch(textLayerParametersText, /Delete Text Layer/);
    assert.doesNotMatch(textLayerParametersText, /Add Text/);
    assert.doesNotMatch(textLayerParametersText, /Layout Grid/);
    assert.doesNotMatch(textLayerParametersText, /Node/);

    await selectLayersRadio(page, "Logo");

    const logoParametersText = await getParametersPanelText(page);
    assert.match(logoParametersText, /Logo/);
    assert.doesNotMatch(logoParametersText, /Add Text/);
    assert.doesNotMatch(logoParametersText, /Delete Text Layer/);
    assert.doesNotMatch(logoParametersText, /Layout Grid/);
    assert.doesNotMatch(logoParametersText, /Node/);

    await page.getByRole("button", { name: "View", exact: true }).click();
    await page.getByText("Hide Overlay", { exact: true }).click();
    await page.waitForFunction(() => {
      const svg = document.querySelector("[data-svg-overlay]");
      return svg instanceof SVGElement && getComputedStyle(svg).display === "none";
    }, { timeout: 15_000 });

    await page.getByRole("button", { name: "View", exact: true }).click();
    await page.getByText("Show Overlay", { exact: true }).click();
    await page.waitForFunction(() => {
      const svg = document.querySelector("[data-svg-overlay]");
      return svg instanceof SVGElement && svg.querySelectorAll("text").length > 0 && getComputedStyle(svg).display === "block";
    }, { timeout: 15_000 });

    await page.evaluate((nodeId) => {
      const node = document.querySelector<HTMLElement>(`[data-network-node-id="${nodeId}"]`);
      if (!node) {
        throw new Error(`Could not find network node ${nodeId}.`);
      }

      node.click();
    }, haloNodeId);
    await page.waitForFunction(() => {
      const panel = document.querySelector<HTMLElement>("[data-config-editor]");
      return panel?.textContent?.includes("Composition") ?? false;
    }, { timeout: 15_000 });

    const haloParametersText = await getParametersPanelText(page);
    const haloLayersText = await getLayersPanelText(page);
    assert.match(haloParametersText, /Composition/);
    assert.doesNotMatch(haloParametersText, /Overlay Layout/);
    assert.doesNotMatch(haloParametersText, /Node/);
    assert.match(haloLayersText, /Overlay/);
    assert.match(haloLayersText, /Background/);
    assert.match(haloLayersText, /Family/);
    assert.match(haloLayersText, /Add/);

    const parametersPanel = page.locator("[data-config-editor]");

    const haloPresetSelect = page.locator("[data-halo-preset-select]");
    const haloPresetApplyButton = page.locator("[data-halo-preset-apply]");
    await haloPresetSelect.waitFor({ state: "visible" });
    await haloPresetApplyButton.waitFor({ state: "visible" });

    const compositionSectionTab = parametersPanel.getByRole("button", { name: "Composition", exact: true });
    await compositionSectionTab.waitFor({ state: "visible" });
    if ((await compositionSectionTab.getAttribute("aria-expanded")) !== "true") {
      await compositionSectionTab.click();
    }

    await waitForVisibleNumericField(page, "Center Y Offset");
    const centerOffsetBeforePreset = await getVisibleNumericFieldValue(page, "Center Y Offset");

    const generatorSectionTab = parametersPanel.getByRole("button", { name: "Generator", exact: true });
    await generatorSectionTab.waitFor({ state: "visible" });
    if ((await generatorSectionTab.getAttribute("aria-expanded")) !== "true") {
      await generatorSectionTab.click();
    }

    await waitForVisibleNumericField(page, "Orbits");
    await waitForVisibleNumericField(page, "Spokes");
    const orbitsBeforePreset = await getVisibleNumericFieldValue(page, "Orbits");
    const spokesBeforePreset = await getVisibleNumericFieldValue(page, "Spokes");

    await haloPresetSelect.selectOption("dense-signal");
    await haloPresetApplyButton.click();
    await haloPresetSelect.waitFor({ state: "visible" });

    const generatorSectionTabAfterPreset = parametersPanel.getByRole("button", { name: "Generator", exact: true });
    await generatorSectionTabAfterPreset.waitFor({ state: "visible" });
    if ((await generatorSectionTabAfterPreset.getAttribute("aria-expanded")) !== "true") {
      await generatorSectionTabAfterPreset.click();
    }

    await waitForVisibleNumericField(page, "Orbits");
    await waitForVisibleNumericField(page, "Spokes");
    const orbitsAfterPreset = await getVisibleNumericFieldValue(page, "Orbits");
    const spokesAfterPreset = await getVisibleNumericFieldValue(page, "Spokes");
    assert.equal(
      orbitsAfterPreset,
      "10",
      "Expected applying the Dense Signal preset to replace Halo behavior from the preset seed."
    );
    assert.equal(
      spokesAfterPreset,
      "84",
      "Expected applying the Dense Signal preset to update the Halo spoke count from the preset seed."
    );
    assert.ok(
      orbitsAfterPreset !== orbitsBeforePreset || spokesAfterPreset !== spokesBeforePreset,
      "Expected applying the Dense Signal preset to change at least one Halo generator value in the loaded document."
    );
    const compositionSectionTabAfterPreset = parametersPanel.getByRole("button", { name: "Composition", exact: true });
    await compositionSectionTabAfterPreset.waitFor({ state: "visible" });
    if ((await compositionSectionTabAfterPreset.getAttribute("aria-expanded")) !== "true") {
      await compositionSectionTabAfterPreset.click();
    }
    await waitForVisibleNumericField(page, "Center Y Offset");
    assert.equal(
      await getVisibleNumericFieldValue(page, "Center Y Offset"),
      centerOffsetBeforePreset,
      "Expected applying a Halo preset to preserve the document-owned composition offset."
    );

    await addBackgroundNode(page, "Fuzzy Boids");
    await page.getByRole("button", { name: "Remove Fuzzy Boids", exact: true }).waitFor({ state: "visible" });

    const fuzzyNodeParametersText = await getParametersPanelText(page);
    assert.match(fuzzyNodeParametersText, /Node/);
    assert.match(fuzzyNodeParametersText, /Remove Fuzzy Boids/);

    await addBackgroundNode(page, "Phyllotaxis");
    await selectLayersRadio(page, "Fuzzy Boids");
    await parametersPanel.getByRole("button", { name: "Node", exact: true }).waitFor({ state: "visible" });

    const nodeSectionTab = parametersPanel.getByRole("button", { name: "Node", exact: true });
    assert.equal(
      await nodeSectionTab.getAttribute("aria-expanded"),
      "true",
      "Expected selecting a new background operator to expose node actions immediately."
    );

    const fuzzyBoidsSectionTab = parametersPanel.getByRole("button", { name: "Fuzzy Boids", exact: true });
    await fuzzyBoidsSectionTab.waitFor({ state: "visible" });
    if ((await fuzzyBoidsSectionTab.getAttribute("aria-expanded")) !== "false") {
      await fuzzyBoidsSectionTab.click();
    }

    const connectButton = page.getByRole("button", { name: "Connect", exact: true }).first();
    await connectButton.waitFor({ state: "visible" });
    await connectButton.click();
    await page.getByRole("button", { name: "Disconnect", exact: true }).first().waitFor({ state: "visible" });

    assert.equal(
      await fuzzyBoidsSectionTab.getAttribute("aria-expanded"),
      "false",
      "Expected same-node connect to preserve a fully collapsed operator pane."
    );

    await page.getByRole("button", { name: "Disconnect", exact: true }).first().click();
    await connectButton.waitFor({ state: "visible" });

    assert.equal(
      await fuzzyBoidsSectionTab.getAttribute("aria-expanded"),
      "false",
      "Expected same-node disconnect to preserve a fully collapsed operator pane."
    );

    await selectLayersRadio(page, "Halo Field");
    const haloSectionTab = parametersPanel.getByRole("button", { name: "Composition", exact: true });
    await haloSectionTab.waitFor({ state: "visible" });
    if ((await haloSectionTab.getAttribute("aria-expanded")) !== "false") {
      await haloSectionTab.click();
    }

    await selectLayersRadio(page, "Fuzzy Boids");
    await fuzzyBoidsSectionTab.waitFor({ state: "visible" });
    assert.equal(
      await fuzzyBoidsSectionTab.getAttribute("aria-expanded"),
      "false",
      "Expected fuzzy-boids section collapse to survive switching to another operator group and back."
    );

    await selectLayersRadio(page, "Halo Field");
    await haloSectionTab.waitFor({ state: "visible" });
    assert.equal(
      await haloSectionTab.getAttribute("aria-expanded"),
      "false",
      "Expected halo section collapse to survive switching to another operator group and back."
    );

    await selectLayersRadio(page, "Fuzzy Boids");
    await page.getByRole("button", { name: "Remove Fuzzy Boids", exact: true }).click();
    await waitForLayersRadioRemoval(page, "Fuzzy Boids");
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const urlArg = getArg("--url");
  const portArg = getArg("--port") ?? "4178";
  let serverProc: ChildProcess | null = null;
  let origin = urlArg ?? "";

  if (!origin) {
    const server = startPreviewServer(portArg);
    serverProc = server.proc;
    origin = server.url;
    await waitForHttp(origin);
  }

  try {
    await verifyUiRegressions(origin);
    console.log("ui regression verification passed");
  } finally {
    stopServer(serverProc);
  }
}

await main();