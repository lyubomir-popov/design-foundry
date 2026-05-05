#!/usr/bin/env npx tsx
/**
 * Playwright headless PNG sequence exporter for brand-layout-ops.
 *
 * Spins up the Vite dev server, opens the overlay preview in a headless
 * Chromium browser, drives the __layoutOpsAutomation API to render frames
 * at exact playback times, and writes PNG files to disk.
 *
 * Usage:
 *   npx tsx scripts/export-headless.ts                        # 10s at 24fps
 *   npx tsx scripts/export-headless.ts --seconds 5            # 5 seconds
 *   npx tsx scripts/export-headless.ts --start-frame 1 --end-frame 120
 *   npx tsx scripts/export-headless.ts --frame 42             # single frame
 *   npx tsx scripts/export-headless.ts --profile story_1080x1920
 *   npx tsx scripts/export-headless.ts --frame-rate 30
 *   npx tsx scripts/export-headless.ts --preview-document ./tmp/export.json
 *   npx tsx scripts/export-headless.ts --transparent-background
 *   npx tsx scripts/export-headless.ts --output-dir ./output/sequence
 *   npx tsx scripts/export-headless.ts --headed                # visible browser
 *
 * Requires playwright as a peer:
 *   npm i -D playwright
 */

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

const profileKey = getArg("--profile");
const frameRateArg = getArg("--frame-rate");
const secondsArg = getArg("--seconds");
const startFrameArg = getArg("--start-frame");
const endFrameArg = getArg("--end-frame");
const singleFrameArg = getArg("--frame");
const outputDirArg = getArg("--output-dir");
const previewDocumentArg = getArg("--preview-document");
const urlArg = getArg("--url");
const portArg = getArg("--port") ?? "4177";
const transparentBackground = hasFlag("--transparent-background");
const headless = !hasFlag("--headed");
const deviceScaleFactor = Number(getArg("--device-scale-factor") ?? "2");

function loadPreviewDocumentFromArg(): unknown {
  if (!previewDocumentArg) {
    return undefined;
  }

  const filePath = resolve(previewDocumentArg);
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Failed to read preview document from ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// ---------------------------------------------------------------------------
// Server management
// ---------------------------------------------------------------------------

function waitForHttp(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (Date.now() > deadline) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      fetch(url).then(
        (res) => {
          if (res.ok) resolve();
          else setTimeout(attempt, 250);
        },
        () => setTimeout(attempt, 250)
      );
    };
    attempt();
  });
}

function startDevServer(port: string): { proc: ChildProcess; url: string } {
  const isWin = process.platform === "win32";
  const npmCmd = isWin ? "npm.cmd" : "npm";
  const proc = spawn(npmCmd, ["run", "dev", "--", `--port=${port}`], {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWin,
  });
  proc.stdout?.on("data", () => { /* drain */ });
  proc.stderr?.on("data", () => { /* drain */ });
  const url = `http://127.0.0.1:${port}`;
  return { proc, url };
}

function stopServer(proc: ChildProcess | null) {
  if (!proc) return;
  proc.kill();
}

// ---------------------------------------------------------------------------
// Frame number helpers
// ---------------------------------------------------------------------------

function determineFrames(frameRate: number): number[] {
  if (singleFrameArg) {
    return [Math.max(1, Number(singleFrameArg))];
  }

  const start = startFrameArg ? Math.max(1, Number(startFrameArg)) : 1;

  if (endFrameArg) {
    const end = Math.max(start, Number(endFrameArg));
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  const seconds = secondsArg ? Number(secondsArg) : 10;
  const count = Math.max(1, Math.round(seconds * frameRate));
  return Array.from({ length: count }, (_, i) => start + i);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let chromium: typeof import("playwright").chromium;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    console.error(
      "Playwright is not installed. Run:\n" +
      "  npx playwright install chromium\n" +
      "then retry."
    );
    process.exit(1);
  }

  let serverProc: ChildProcess | null = null;
  let url = urlArg ?? "";
  const previewDocument = loadPreviewDocumentFromArg();

  if (!url) {
    console.log(`Starting Vite dev server on port ${portArg}...`);
    const server = startDevServer(portArg);
    serverProc = server.proc;
    url = server.url;
    await waitForHttp(url);
    console.log("Dev server ready.");
  }

  try {
    const browser = await chromium.launch({ headless });
    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: Math.max(1, deviceScaleFactor),
      });
      const page = await context.newPage();

      console.log(`Navigating to ${url}...`);
      await page.goto(url, { waitUntil: "networkidle" });

      // Wait for automation API
      await page.waitForFunction(
        () => Boolean((window as unknown as Record<string, unknown>).__layoutOpsAutomation),
        { timeout: 15_000 }
      );

      // Ready: stops playback and returns state
      const baseState = await page.evaluate(
        () => (window as unknown as Record<string, { ready: () => Promise<unknown> }>).__layoutOpsAutomation.ready()
      ) as Record<string, unknown>;

      // Apply configuration overrides
      const applyPayload: Record<string, unknown> = {};
      if (profileKey) applyPayload.output_profile_key = profileKey;
      if (frameRateArg) applyPayload.frame_rate = Number(frameRateArg);
      if (transparentBackground) applyPayload.transparent_background = true;
      if (typeof previewDocument !== "undefined") applyPayload.preview_document = previewDocument;

      let currentState = baseState;
      if (Object.keys(applyPayload).length > 0) {
        currentState = await page.evaluate(
          (payload) => (window as unknown as Record<string, { applySnapshot: (p: unknown) => Promise<unknown> }>).__layoutOpsAutomation.applySnapshot(payload),
          applyPayload
        ) as Record<string, unknown>;
      }

      const frameRate = frameRateArg
        ? Math.max(1, Math.round(Number(frameRateArg)))
        : Math.max(1, Number(currentState.frame_rate) || 24);

      const frames = determineFrames(frameRate);

      // Determine output directory
      const profile = currentState.output_profile as Record<string, unknown> | undefined;
      const widthPx = Number(profile?.width_px ?? 0);
      const heightPx = Number(profile?.height_px ?? 0);
      const timestamp = new Date().toISOString().replace(/[\-:T]/g, "").slice(0, 14);
      const outputDir = outputDirArg
        ? resolve(outputDirArg)
        : resolve(REPO_ROOT, "output", `${widthPx}x${heightPx}`, `cli-${timestamp}`);

      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const padWidth = Math.max(4, String(Math.max(...frames)).length);
      const totalFrames = frames.length;
      const shouldTransparent = transparentBackground || Boolean(currentState.transparent_background);

      console.log(`Exporting ${totalFrames} frame(s) at ${frameRate} fps to ${outputDir}`);

      for (let i = 0; i < frames.length; i++) {
        const frameNumber = frames[i];
        const playbackTimeSec = (frameNumber - 1) / frameRate;

        const result = await page.evaluate(
          (payload) => (window as unknown as Record<string, { exportFrame: (p: unknown) => Promise<unknown> }>).__layoutOpsAutomation.exportFrame(payload),
          { playback_time_sec: playbackTimeSec, transparent_background: shouldTransparent }
        ) as Record<string, string>;

        const pngBytes = Buffer.from(result.png_base64, "base64");
        const frameName = `frame-${String(frameNumber).padStart(padWidth, "0")}.png`;
        const outputPath = resolve(outputDir, frameName);
        writeFileSync(outputPath, pngBytes);

        const idx = i + 1;
        if (idx === 1 || idx === totalFrames || idx % Math.max(1, Math.floor(frameRate / 2)) === 0) {
          console.log(`  Rendered ${idx}/${totalFrames}: ${frameName}`);
        }
      }

      console.log(`\nExport complete: ${totalFrames} frames in ${outputDir}`);
    } finally {
      await browser.close();
    }
  } finally {
    stopServer(serverProc);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
