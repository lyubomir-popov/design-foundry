import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, type Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const vitePort = Number.parseInt(process.env.VITE_PORT ?? "4173", 10);
const viteHost = process.env.VITE_HOST ?? "127.0.0.1";
const publicRoot = path.resolve(__dirname, "public");
const sourceDefaultConfigPath = path.resolve(__dirname, "public", "assets", "source-default-config.json");
const sourceDefaultAuthoringPath = "/__authoring/source-default-config";
const sourceDefaultRelativePath = path.relative(__dirname, sourceDefaultConfigPath).replace(/\\/g, "/");
const operatorPresetConfigPath = path.resolve(__dirname, "public", "assets", "operator-presets.json");
const operatorPresetAuthoringPath = "/__authoring/operator-presets";
const operatorPresetRelativePath = path.relative(__dirname, operatorPresetConfigPath).replace(/\\/g, "/");
const overlayCsvAuthoringPath = "/__authoring/overlay-csv";
const documentFileAuthoringPath = "/__authoring/document-file";
const exportMp4AuthoringPath = "/__authoring/export-mp4";
const maxSafeSupersampledExportPixels = 3840 * 2160;
const npxExecutable = process.platform === "win32" ? "npx.cmd" : "npx";

function resolveAuthoringDocumentFilePath(rawFileName: unknown): { fileName: string; filePath: string } {
  const normalizedName = path.basename(String(rawFileName || "").trim().replace(/\\/g, "/"));
  if (!normalizedName) {
    throw new Error("Expected a document file name.");
  }

  const safeFileName = normalizedName.replace(/[^a-zA-Z0-9._ -]+/g, "-");
  if (!safeFileName.toLowerCase().endsWith(".json")) {
    throw new Error("Document file name must end with .json.");
  }

  const projectsRoot = path.join(repoRoot, "projects");
  const filePath = path.resolve(projectsRoot, safeFileName);
  const relativeFromProjects = path.relative(projectsRoot, filePath);
  if (!relativeFromProjects || relativeFromProjects.startsWith("..") || path.isAbsolute(relativeFromProjects)) {
    throw new Error("Document file name must stay within projects/.");
  }

  return { fileName: safeFileName, filePath };
}

function resolvePublicAuthoringAssetPath(rawAssetPath: string): { logicalPath: string; filePath: string } {
  const normalizedAssetPath = String(rawAssetPath || "").trim().replace(/\\/g, "/");
  if (!normalizedAssetPath) {
    throw new Error("Expected an assetPath string.");
  }

  const relativeAssetPath = normalizedAssetPath.startsWith("./")
    ? normalizedAssetPath.slice(2)
    : normalizedAssetPath.replace(/^\/+/, "");
  if (!relativeAssetPath) {
    throw new Error("Expected an assetPath string.");
  }

  const filePath = path.resolve(publicRoot, relativeAssetPath);
  const relativeFromPublic = path.relative(publicRoot, filePath);
  if (!relativeFromPublic || relativeFromPublic.startsWith("..") || path.isAbsolute(relativeFromPublic)) {
    throw new Error("Asset path must stay within apps/overlay-preview/public.");
  }

  return {
    logicalPath: normalizedAssetPath.startsWith("./") ? normalizedAssetPath : `./${relativeFromPublic.replace(/\\/g, "/")}`,
    filePath
  };
}

function getExportDeviceScaleFactor(outputWidthPx: number, outputHeightPx: number): number {
  const pixelCount = Math.max(0, Number(outputWidthPx || 0)) * Math.max(0, Number(outputHeightPx || 0));
  return pixelCount >= maxSafeSupersampledExportPixels ? 1 : 2;
}

function readRequestBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    req.on("data", (chunk) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function runProcess(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout?.on("data", (chunk) => {
      process.stdout.write(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      process.stderr.write(chunk);
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${path.basename(command)} exited with code ${code ?? "null"}${signal ? ` (signal ${signal})` : ""}.`
        )
      );
    });
  });
}

function sourceDefaultAuthoringPlugin(): Plugin {
  return {
    name: "source-default-authoring",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const requestPath = req.url?.split("?")[0];
        if (
          !requestPath ||
          (requestPath !== sourceDefaultAuthoringPath &&
            requestPath !== operatorPresetAuthoringPath &&
            requestPath !== overlayCsvAuthoringPath &&
            requestPath !== documentFileAuthoringPath &&
            requestPath !== exportMp4AuthoringPath)
        ) {
          next();
          return;
        }

        if (requestPath === sourceDefaultAuthoringPath && req.method === "GET") {
          void (async () => {
            try {
              const contents = await fs.readFile(sourceDefaultConfigPath, "utf8");
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(contents);
            } catch (error) {
              const code = (error as NodeJS.ErrnoException).code;
              if (code === "ENOENT") {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Source default snapshot not found." }));
                return;
              }

              res.statusCode = 500;
              res.end(JSON.stringify({ error: "Failed to read source default snapshot." }));
            }
          })();
          return;
        }

        if (requestPath === sourceDefaultAuthoringPath && req.method === "POST") {
          const chunks: Uint8Array[] = [];
          req.on("data", (chunk) => {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
          });
          req.on("end", () => {
            void (async () => {
              try {
                const payload = Buffer.concat(chunks).toString("utf8") || "{}";
                const parsed = JSON.parse(payload);
                await fs.mkdir(path.dirname(sourceDefaultConfigPath), { recursive: true });
                await fs.writeFile(
                  sourceDefaultConfigPath,
                  `${JSON.stringify(parsed, null, 2)}\n`,
                  "utf8"
                );
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, path: sourceDefaultRelativePath }));
              } catch {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Invalid source default snapshot payload." }));
              }
            })();
          });
          return;
        }

        if (requestPath === operatorPresetAuthoringPath && req.method === "GET") {
          void (async () => {
            try {
              const contents = await fs.readFile(operatorPresetConfigPath, "utf8");
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(contents);
            } catch (error) {
              const code = (error as NodeJS.ErrnoException).code;
              if (code === "ENOENT") {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Operator preset library not found." }));
                return;
              }

              res.statusCode = 500;
              res.end(JSON.stringify({ error: "Failed to read operator preset library." }));
            }
          })();
          return;
        }

        if (requestPath === operatorPresetAuthoringPath && req.method === "POST") {
          const chunks: Uint8Array[] = [];
          req.on("data", (chunk) => {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
          });
          req.on("end", () => {
            void (async () => {
              try {
                const payload = Buffer.concat(chunks).toString("utf8") || "{}";
                const parsed = JSON.parse(payload);
                await fs.mkdir(path.dirname(operatorPresetConfigPath), { recursive: true });
                await fs.writeFile(
                  operatorPresetConfigPath,
                  `${JSON.stringify(parsed, null, 2)}\n`,
                  "utf8"
                );
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, path: operatorPresetRelativePath }));
              } catch {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Invalid operator preset payload." }));
              }
            })();
          });
          return;
        }

        if (requestPath === overlayCsvAuthoringPath && req.method === "POST") {
          const chunks: Uint8Array[] = [];
          req.on("data", (chunk) => {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
          });
          req.on("end", () => {
            void (async () => {
              try {
                const payload = Buffer.concat(chunks).toString("utf8") || "{}";
                const parsed = JSON.parse(payload);
                const draft = typeof parsed?.draft === "string" ? parsed.draft : null;
                if (draft === null) {
                  throw new Error("Expected a draft string.");
                }

                const resolvedAsset = resolvePublicAuthoringAssetPath(parsed?.assetPath);
                const normalizedDraft = draft.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
                await fs.mkdir(path.dirname(resolvedAsset.filePath), { recursive: true });
                await fs.writeFile(
                  resolvedAsset.filePath,
                  normalizedDraft.length > 0 && !normalizedDraft.endsWith("\n")
                    ? `${normalizedDraft}\n`
                    : normalizedDraft,
                  "utf8"
                );
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, path: resolvedAsset.logicalPath }));
              } catch (error) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({
                  error: error instanceof Error ? error.message : "Invalid CSV authoring payload."
                }));
              }
            })();
          });
          return;
        }

        if (requestPath === documentFileAuthoringPath && req.method === "GET") {
          void (async () => {
            try {
              const requestUrl = new URL(req.url ?? documentFileAuthoringPath, "http://127.0.0.1");
              const resolvedDocument = resolveAuthoringDocumentFilePath(requestUrl.searchParams.get("file_name"));
              const contents = await fs.readFile(resolvedDocument.filePath, "utf8");
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(contents);
            } catch (error) {
              const code = (error as NodeJS.ErrnoException).code;
              res.statusCode = code === "ENOENT" ? 404 : 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Document file not found." }));
            }
          })();
          return;
        }

        if (requestPath === documentFileAuthoringPath && req.method === "POST") {
          void (async () => {
            try {
              const payload = JSON.parse((await readRequestBody(req)) || "{}");
              const resolvedDocument = resolveAuthoringDocumentFilePath(payload?.file_name);
              const serializedDocument = typeof payload?.serialized_document === "string"
                ? payload.serialized_document
                : "";
              if (serializedDocument.trim().length === 0) {
                throw new Error("Expected a non-empty serialized document.");
              }

              JSON.parse(serializedDocument);
              await fs.mkdir(path.dirname(resolvedDocument.filePath), { recursive: true });
              await fs.writeFile(
                resolvedDocument.filePath,
                serializedDocument.endsWith("\n") ? serializedDocument : `${serializedDocument}\n`,
                "utf8"
              );
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, file_name: resolvedDocument.fileName, path: resolvedDocument.filePath }));
            } catch (error) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Invalid document payload." }));
            }
          })();
          return;
        }

        if (requestPath === exportMp4AuthoringPath && req.method === "POST") {
          void (async () => {
            let tempDirPath: string | null = null;

            try {
              const payload = JSON.parse((await readRequestBody(req)) || "{}");
              const previewDocument = payload?.preview_document;
              const outputWidthPx = Math.max(1, Math.round(Number(payload?.output_width_px || 0)));
              const outputHeightPx = Math.max(1, Math.round(Number(payload?.output_height_px || 0)));
              const exportName = String(payload?.export_name || "export").replace(/[^a-zA-Z0-9_-]/g, "") || "export";
              const frameRate = Math.max(1, Math.round(Number(payload?.frame_rate || 24)));
              const startFrame = Math.max(1, Math.round(Number(payload?.start_frame || 1)));
              const endFrame = Math.max(startFrame, Math.round(Number(payload?.end_frame || startFrame)));
              const fadeInEnabled = Boolean(payload?.fade_in_enabled);
              const fadeOutEnabled = Boolean(payload?.fade_out_enabled);

              if (!previewDocument || typeof previewDocument !== "object" || Array.isArray(previewDocument)) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Expected a preview_document object." }));
                return;
              }

              if (endFrame < startFrame) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "End frame must be greater than or equal to start frame." }));
                return;
              }

              tempDirPath = await fs.mkdtemp(path.join(os.tmpdir(), "brand-layout-ops-mp4-"));
              const tempPreviewDocumentPath = path.join(tempDirPath, "preview-document.json");
              const tempFramesDir = path.join(tempDirPath, "frames");
              await fs.writeFile(tempPreviewDocumentPath, `${JSON.stringify(previewDocument, null, 2)}\n`, "utf8");
              await fs.mkdir(tempFramesDir, { recursive: true });

              const outputDir = path.join(repoRoot, "output", `${outputWidthPx}x${outputHeightPx}`, "mp4");
              await fs.mkdir(outputDir, { recursive: true });
              const mp4Path = path.join(outputDir, `${exportName}_${outputWidthPx}x${outputHeightPx}.mp4`);
              const automationUrl = `http://${req.headers.host ?? "127.0.0.1:4173"}/?automation=1`;

              await runProcess(
                npxExecutable,
                [
                  "tsx",
                  "scripts/export-headless.ts",
                  "--url",
                  automationUrl,
                  "--preview-document",
                  tempPreviewDocumentPath,
                  "--frame-rate",
                  String(frameRate),
                  "--start-frame",
                  String(startFrame),
                  "--end-frame",
                  String(endFrame),
                  "--device-scale-factor",
                  String(getExportDeviceScaleFactor(outputWidthPx, outputHeightPx)),
                  "--output-dir",
                  tempFramesDir
                ],
                repoRoot
              );

              await runProcess(
                npxExecutable,
                [
                  "tsx",
                  "scripts/encode-mp4.ts",
                  "--input-dir",
                  tempFramesDir,
                  "--output",
                  mp4Path,
                  "--fps",
                  String(frameRate),
                  "--delivery",
                  "--all-intra",
                  "--overwrite",
                  ...(fadeInEnabled ? ["--fade-in-sec", "2"] : []),
                  ...(fadeOutEnabled ? ["--fade-out-sec", "2"] : [])
                ],
                repoRoot
              );

              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, output_dir: outputDir, mp4_path: mp4Path }));
            } catch (error) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : "MP4 export failed." }));
            } finally {
              if (tempDirPath) {
                await fs.rm(tempDirPath, { recursive: true, force: true });
              }
            }
          })();
          return;
        }

        res.statusCode = 405;
        res.setHeader(
          "Allow",
          requestPath === sourceDefaultAuthoringPath
            || requestPath === operatorPresetAuthoringPath
            || requestPath === documentFileAuthoringPath
            ? "GET, POST"
            : "POST"
        );
        res.end();
      });
    }
  };
}

export default defineConfig({
  root: __dirname,
  plugins: [sourceDefaultAuthoringPlugin()],
  resolve: {
    alias: {
      "@brand-layout-ops/core-types": path.resolve(repoRoot, "packages/core-types/src/index.ts"),
      "@brand-layout-ops/graph-runtime": path.resolve(repoRoot, "packages/graph-runtime/src/index.ts"),
      "@brand-layout-ops/layout-engine": path.resolve(repoRoot, "packages/layout-engine/src/index.ts"),
      "@brand-layout-ops/layout-grid": path.resolve(repoRoot, "packages/layout-grid/src/index.ts"),
      "@brand-layout-ops/layout-text": path.resolve(repoRoot, "packages/layout-text/src/index.ts"),
      "@brand-layout-ops/document-model": path.resolve(repoRoot, "packages/document-model/src/index.ts"),
      "@brand-layout-ops/overlay-interaction": path.resolve(repoRoot, "packages/overlay-interaction/src/index.ts"),
      "@brand-layout-ops/parameter-ui": path.resolve(repoRoot, "packages/parameter-ui/src/index.ts"),
      "@brand-layout-ops/operator-halo-field": path.resolve(repoRoot, "packages/operator-halo-field/src/index.ts"),
      "@brand-layout-ops/operator-ubuntu-summit-animation": path.resolve(repoRoot, "packages/operator-ubuntu-summit-animation/src/index.ts")
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: [path.resolve(repoRoot, "node_modules")]
      }
    }
  },
  server: {
    host: viteHost,
    port: Number.isFinite(vitePort) ? vitePort : 4173,
    strictPort: true,
    fs: {
      allow: [repoRoot]
    }
  }
});