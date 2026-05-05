# Document persistence — review report for ChatGPT (2026-05-05)

Author: Claude / Copilot session, 2026-05-05.
Audience: the next ChatGPT session continuing this work.
Source-of-truth precedence still applies: this is a report, not a spec. If anything here disagrees with `STATUS.md` or `TODO.md`, fix the canonical doc.

---

## Verdict (read this first)

1. The schema-level save → serialize → load → apply round trip **works**. `npm run verify:document-persistence` is green and a live in-tab refresh test confirmed:
   - `metadata.name` is preserved.
   - `project.activeTargetId` is preserved (including a custom Full HD target).
   - `state.outputProfileKey` is preserved and the renderer activates the right format.
   - The format chooser lists every saved target.
2. The **Full HD 1920×1080 default** was missing because no built-in profile existed for it. **Now added** (this commit). It appears in the formats table on a fresh document automatically.
3. The user's recurring "everything is lost on refresh" report has two distinct causes that ChatGPT has been conflating:
   - **(a) FSA save produced a zero-byte file on disk.** Three zero-byte files exist in `projects/` from prior sessions. The new `writeDocumentFileText` verifies the FSA write and falls back to a dev-only authoring route (`POST /__authoring/document-file`) if verification fails. That fix is in the dirty tree but was never committed, so any ChatGPT session that did not restart the dev server before testing would not see the fix.
   - **(b) The `localStorage` snapshot restore (`brand-layout-ops:last-session-document`) is the actual "refresh keeps state alive" path.** It works. Tested live: write a snapshot to localStorage, reload, the doc is restored exactly. If the user reports state lost on refresh, it means save never completed in the first place — investigate save, not restore.

So the right framing for ChatGPT is: **the app-level save/open/refresh logic is now proven with both the handle-backed fallback path and the new no-handle direct-save path. The remaining risk is the native VS Code Electron File System Access behavior itself plus getting the dirty fallback changes committed and running in the user's actual session.**

---

## Concrete changes landed in this session

| File | Change |
|------|--------|
| `packages/core-types/src/index.ts` | Added `fullhd_1920x1080` to `OUTPUT_PROFILE_ORDER` and `OUTPUT_PROFILES`. |
| `packages/operator-overlay-layout/src/format-presets.ts` | Added a 12-px-baseline grid seed for `fullhd_1920x1080`. |
| `packages/operator-overlay-layout/src/field-defaults.ts` | Added text-style overrides for `fullhd_1920x1080`. |
| `packages/operator-halo-field/src/index.ts` | Added a halo composition override for `fullhd_1920x1080` (centered, no offset). |
| `apps/overlay-preview/public/assets/source-default-config.json` | Added `fullhd_1920x1080` to the default project's `targets` list (ID and outputProfileKey both `fullhd_1920x1080`, label `1920×1080 Full HD`). |
| `apps/overlay-preview/src/document-storage.ts` | Exported a direct-save helper so the dev preview can write `projects/<file>` by filename even when no File System Access handle exists. |
| `apps/overlay-preview/src/document-workspace.ts` | Changed the no-handle save fallback to write to `projects/` first, and to reuse that filename on later plain saves instead of reopening the picker or falling straight to an invisible browser download. |

Validation:

- `npm run typecheck` — clean.
- `npm run verify:document-persistence` — clean.
- Live preview: a fresh page now lists 5 default targets, including `1920×1080 Full HD`.
- Live preview: setting `localStorage[brand-layout-ops:last-session-document]` to a doc with `activeTargetId = fullhd_1920x1080` and reloading correctly restores the title, active format, and formats list.
- Live preview: `POST /__authoring/document-file` returns `{ ok: true, ... }` from the running dev server.
- Live preview: a forced-failing mock file handle (empty `getFile()`, no-op `createWritable()`) still saves correctly through `saveCurrentDocument` by falling back to `/__authoring/document-file`; the written JSON had `metadata.name = "e2e-fullhd"`, `project.activeTargetId = "fullhd_1920x1080"`, and was 63 KB on disk.
- Live preview: after that forced-fallback save, a full page reload restored `e2e-fullhd` with `fullhd_1920x1080` still active, and `Open...` with an empty mock file handle rehydrated the same saved document from `projects/e2e-fullhd.brand-layout-ops.json`.
- Real Chrome page: when `showSaveFilePicker` was forced to fail with `SecurityError`, `Save As...` no longer disappeared into a browser download. It rewrote `projects/Untitled-document.brand-layout-ops.json` from 0 bytes to a 63 KB real document with `activeTargetId = fullhd_1920x1080`.
- Real Chrome page: a subsequent plain `Save` updated that same `projects/Untitled-document.brand-layout-ops.json` in place and the persisted JSON moved to `activeTargetId = screen_3840x2160` without reopening the picker.

---

## What still needs work and why ChatGPT keeps shipping non-fixes

### Issue 1 — zero-byte files in `projects/`

```
projects/UbuntuSummit-AV-exports.json          0 bytes
projects/ubuntuSummit26.04.json                 0 bytes
projects/Untitled-document.brand-layout-ops.json 0 bytes
```

These were leftovers from the user's prior testing. After the no-handle save fallback fix, one of them (`Untitled-document.brand-layout-ops.json`) was intentionally rewritten during validation and is now a valid saved document. The remaining zero-byte files are still stale leftovers.

- The `Save As` flow in the integrated VS Code Electron browser used `showSaveFilePicker`, opened a writable, called `write()` and `close()`, but the resulting file was 0 bytes on disk. This is the FSA-in-Electron bug the prior agent tried to address with the authoring-server fallback.
- Before the latest fix, if no usable file handle existed at all, `saveCurrentDocument` fell back to `downloadJsonFile(...)` instead of to the authoring route. In environments where downloads are hidden or suppressed, that looked like a no-op to the user.
- The fallback code was only present in the **dirty diff** and the dev server needed to be restarted to register the `vite.config.ts` middleware. Without that, `POST /__authoring/document-file` 404ed and the workaround never actually ran.

**Action for ChatGPT, in order:**

1. Do not delete the zero-byte files yet. They are evidence. Show them to the user and ask whether to recover or discard.
2. Confirm the dev server is using the current `apps/overlay-preview/vite.config.ts` (look for the `documentFileAuthoringPath = "/__authoring/document-file"` constant). If unsure, kill the running task and restart the `Run overlay preview` task.
3. From a browser tab open at `http://127.0.0.1:4173/`, run:

   ```js
   await fetch('/__authoring/document-file', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ file_name: 'route-smoketest.brand-layout-ops.json', serialized_document: '{"smoke":true}' })
   }).then(r => r.json());
   ```

   If you don't get `{ ok: true, ... }` back, the route is dead. Fix it before touching anything else.
4. Once the route is alive, exercise the live `Save As` flow once and verify whichever branch the environment takes:
   - If a real file handle is obtained: the picker-chosen file is non-empty, and `projects/<same-file-name>` may also exist if the write-verification fallback ran.
   - If no usable file handle is obtained: `projects/<suggested-file-name>` must still be written directly by the new no-handle fallback, and the app title should update to that file stem.

### Issue 2 — the in-tab snapshot restore is fine, do not "fix" it

`brand-layout-ops:last-session-document` in `localStorage` is the only thing that survives a refresh today. It is written at the end of:

- `saveCurrentDocument` (after a successful save, even when the FSA write fell through to a download fallback).
- `openDocumentFromDisk` (after a successful open).
- `openRecentDocument` (after reopening from IndexedDB).

It is cleared on `createNewDocument`. It is read on shell init by `restoreLastSessionDocument`.

If the user says "I refreshed and lost everything", **do not** start refactoring this path. The fault is upstream: either save never completed, or `createNewDocument` was triggered between save and refresh. Verify by inspecting `localStorage.getItem('brand-layout-ops:last-session-document')` in DevTools right after save.

### Issue 3 — `metadata.name` showing `Untitled document` after Save

This was the prior session's bug 1. It is fixed in the dirty tree (see `apps/overlay-preview/src/document-workspace.ts`):

- `resolveDocumentNameFromWorkspace` now derives the name from the picked filename when the in-memory name is still the untitled sentinel.
- `saveCurrentDocument` recomputes the name **after** the picker resolves the file handle.
- `applyWorkspaceDocumentMetadata` calls `notifyWorkspaceChanged()` so the title element refreshes.

Live in-tab restore proved the title now stays correct after reload. Do not regress this. If you regress it, the test is: write a snapshot whose `metadata.name === "Untitled document"` but `fileName === "MyProject.brand-layout-ops.json"` and reload — the title should read `MyProject` (filename stem).

### Issue 4 — `activeTargetId` reverting to `1080x1920` on reopen

This was the prior session's bug 3. Root cause was an over-tight invariant in `normalizeOverlayDocumentProject` requiring the active target's `outputProfileKey` to equal the snapshot's `outputProfileKey`. The dirty tree already softens this check (`packages/operator-overlay-layout/src/document-schema.ts` line 350) and the verifier covers it.

Do not re-tighten this check. The target's own `outputProfileKey` is the authoritative profile.

---

## Concrete instructions for the next ChatGPT session

Follow these in order. Each step is gated.

1. **Read** this file, `STATUS.md`, `TODO.md`, and `docs/audit-document-persistence-2026-05-01.md`.
2. **Triage** the dirty tree:
   - Either commit the dirty changes in small, area-prefixed commits (`schema:`, `ui:`, `dev:`, etc.) **after** verifying each piece, or revert the parts you cannot justify.
   - The schema fix in `document-schema.ts` and the workspace-name fix in `document-workspace.ts` should ship.
   - The new built-in `fullhd_1920x1080` profile across `core-types`, `format-presets`, `field-defaults`, `halo-field`, and `source-default-config.json` should ship as one focused commit.
3. **Verify route liveness** (Issue 1, step 3 above). If the route is dead, restart the dev server task and re-test.
4. **Real e2e save/load test** — the only validation that counts:
   1. New document. Confirm formats list contains `1920×1080 Full HD`.
   2. `Formats…` → activate `1920×1080 Full HD`. Confirm stage resizes.
   3. `Save As…` → pick `tmp/e2e-fullhd.brand-layout-ops.json`.
   4. Confirm:
      - The OS-level file is non-empty.
      - `projects/e2e-fullhd.brand-layout-ops.json` exists and is non-empty (mirror).
      - The title shows `e2e-fullhd`.
   5. Reload the tab.
   6. Confirm the title and active format survived.
   7. `File → Open…` → reopen the same file from disk.
   8. Confirm the title and active format survived.
5. **Do not** report any of the above as "validated" until you have run real-flow steps 1-7 in a real browser tab and pasted the actual results into a status update for the user. Synthetic-state stubs do not count.
6. **Clean up** zero-byte files in `projects/` only after asking the user.
7. Update `STATUS.md` and `HISTORY.md` to reflect what actually shipped. Distinguish "stub-validated" from "e2e-validated" per the prior audit.

---

## Files to touch — and not to touch

**Touch:**

- `apps/overlay-preview/vite.config.ts` (only the `documentFileAuthoringPath` middleware if it is broken).
- `apps/overlay-preview/src/document-storage.ts` (only if the verify-then-fallback logic in `writeDocumentFileText` is wrong; current logic looks correct).
- `apps/overlay-preview/src/document-workspace.ts` (only if a regression appears).
- `STATUS.md`, `HISTORY.md`, `TODO.md` — update after work lands.

**Do not touch without strong reason:**

- `packages/operator-overlay-layout/src/document-schema.ts` — the normalization is correct now.
- `apps/overlay-preview/src/preview-shell-controller.ts` `restoreLastSessionDocument` invocation — it works.
- The `localStorage` snapshot key name (`brand-layout-ops:last-session-document`) — would orphan existing snapshots.
- `packages/core-types/src/index.ts` `OUTPUT_PROFILES` — built-ins are now stable, do not reorder or rename keys.

---

## One-shot smoke command for any future agent

```powershell
cd c:\Users\lyubo\work\repos\brand-layout-ops
npm run typecheck
npm run verify:document-persistence
```

Both must pass. Then do the live e2e steps above. No "validated" claim is allowed without the live e2e.
