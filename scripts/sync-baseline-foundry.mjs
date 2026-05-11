import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sourceRoot = path.resolve(repoRoot, "..", "baseline-foundry");
const vendorRoot = path.resolve(repoRoot, "vendor", "baseline-foundry");
const ifPresent = process.argv.includes("--if-present");

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function log(message) {
  console.log(`[sync-baseline-foundry] ${message}`);
}

async function main() {
  const distDir = path.join(sourceRoot, "dist");
  const fontsDir = path.join(sourceRoot, "assets", "fonts");
  const packageJsonPath = path.join(sourceRoot, "package.json");
  const readmePath = path.join(sourceRoot, "README.md");

  const hasSource = await pathExists(sourceRoot);
  const hasDist = await pathExists(distDir);
  const hasFonts = await pathExists(fontsDir);
  const hasPackageJson = await pathExists(packageJsonPath);

  if (!hasSource || !hasDist || !hasFonts || !hasPackageJson) {
    if (ifPresent) {
      log("skipping sync because sibling baseline-foundry with built dist/fonts is not available.");
      return;
    }

    throw new Error("Expected ../baseline-foundry with built dist and assets/fonts.");
  }

  const sourcePackage = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  const vendorPackage = {
    name: sourcePackage.name,
    version: sourcePackage.version,
    description: sourcePackage.description,
    type: sourcePackage.type,
    exports: sourcePackage.exports,
    license: sourcePackage.license,
    files: ["dist", "assets/fonts", "README.md"]
  };

  await fs.rm(vendorRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(vendorRoot, "assets"), { recursive: true });
  await fs.cp(distDir, path.join(vendorRoot, "dist"), { recursive: true });
  await fs.cp(fontsDir, path.join(vendorRoot, "assets", "fonts"), { recursive: true });

  if (await pathExists(readmePath)) {
    await fs.copyFile(readmePath, path.join(vendorRoot, "README.md"));
  }

  await fs.writeFile(path.join(vendorRoot, "package.json"), `${JSON.stringify(vendorPackage, null, 2)}\n`, "utf8");
  log(`synced ${sourcePackage.name}@${sourcePackage.version} into ${path.relative(repoRoot, vendorRoot)}`);
}

main().catch((error) => {
  console.error(`[sync-baseline-foundry] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});