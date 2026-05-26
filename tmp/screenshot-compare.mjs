/**
 * Playwright screenshot comparison: racoon-anim (reference) vs design-foundry (new).
 * Both at 1080×1350 (instagram_1080x1350), frozen at t=3s (post-finale).
 * Captures only the animation canvases, not the UI panels.
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REF_URL = "http://127.0.0.1:5173/?automation=1";
const NEW_URL = "http://127.0.0.1:5174/";
const PROFILE_KEY = "instagram_1080x1350";
const PLAYBACK_TIME = 3; // seconds — well past finale

async function screenshotReference(browser) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 } });
  await page.goto(REF_URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__mascotAutomation != null, { timeout: 10000 });

  // Switch to 1080x1350 + seek to t=3s
  await page.evaluate(async ({ profileKey, t }) => {
    await window.__mascotAutomation.applySnapshot({
      output_profile_key: profileKey,
      playback_time_sec: t
    });
  }, { profileKey: PROFILE_KEY, t: PLAYBACK_TIME });

  await page.waitForTimeout(500);

  // Screenshot just the animation canvas container
  const canvasEl = await page.$("canvas");
  const outPath = path.join(__dirname, "ref-1080x1350.png");
  if (canvasEl) {
    await canvasEl.screenshot({ path: outPath });
  } else {
    await page.screenshot({ path: outPath });
  }
  console.log("Reference screenshot:", outPath);
  await page.close();
}

async function screenshotNew(browser) {
  // Use a wide viewport so the animation area is visible alongside the panel
  const page = await browser.newPage({ viewport: { width: 2400, height: 1500 } });
  await page.goto(NEW_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 10000 });

  // Wait 4s for the animation to play through the finale
  await page.waitForTimeout(4000);

  // Click "Pause Motion" to freeze the animation
  const pauseBtn = await page.$("button");
  if (pauseBtn) {
    const text = await pauseBtn.textContent();
    if (text && text.includes("Pause")) {
      await pauseBtn.click();
      await page.waitForTimeout(200);
    }
  }

  // Screenshot the first canvas (WebGL) which is the main animation
  const canvasEl = await page.$("canvas");
  const outPath = path.join(__dirname, "new-1080x1350.png");
  if (canvasEl) {
    await canvasEl.screenshot({ path: outPath });
  } else {
    await page.screenshot({ path: outPath });
  }
  console.log("New screenshot:", outPath);
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await Promise.all([
      screenshotReference(browser),
      screenshotNew(browser)
    ]);
    console.log("Done — compare tmp/ref-1080x1350.png vs tmp/new-1080x1350.png");
  } finally {
    await browser.close();
  }
})();
