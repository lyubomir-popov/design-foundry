# Document persistence audit — 2026-05-01

## Scope

User report (verbatim):

> ok dialog appears, but same bugs we discussed above are still happening — top
> left still says untitled document, on save and reopen the newly added format
> is missing, and it reverts to 1080x1920. please audit chatgpt's work and the
> entire project — it seems very flaky.

This document audits the prior agent ("chatgpt") session and the surrounding
overlay-preview document/format persistence stack against current behaviour,
identifies the actual root causes, and tags follow-up tasks with the model
expected to execute each one.

> Note on the model tagging convention: there is no `/orchestrate` command
> definition committed to this repo or to the user prompts folder
> (`%APPDATA%/Code/User/prompts`). I'm using a straightforward two-tier scheme
> derived from the user instruction "you do the hardest bits, delegate smaller
> tasks if it will save tokens to chatgpt 5.4":
>
> - `[model: claude-sonnet-4.5]` — load-bearing logic, persistence/state
>   plumbing, anything that requires whole-system reasoning across multiple
>   modules. Done by the primary agent.
> - `[model: gpt-5-mini]` — mechanical edits, doc updates, isolated unit
>   tests, single-file refactors with clear before/after. Safe to delegate.
>
> If a different `/orchestrate` spec exists elsewhere, retag at that point.

## Resolution update — 2026-05-05

Later live testing found an additional concrete failure behind the user's
continued reset reports: the files in `projects/` that the user was opening
were zero bytes. Opening those files correctly produced "Selected file is not a
valid Brand Layout Ops document" and left the app on the default 1080x1920
document. To prevent the integrated browser's File System Access path from
creating or leaving empty project files again, the dev preview now verifies the
written handle contents and falls back to a dev-only `/__authoring/document-file`
route that writes the same filename under `projects/`. Empty file-handle reads
also try that route, so opening an empty picker-selected file can recover if a
valid `projects/<same file name>` copy exists.

Validation for the empty-file fallback used the live preview with an intentionally
failing File System Access save handle: Add custom `Full HD 1920x1080` -> Save As
`fallback-fullhd.brand-layout-ops.json` -> confirm the dev route wrote a 63 KB
JSON file with `project.activeTargetId = format-5` and
`state.outputProfileKey = custom_1920x1080` -> reload restored the Full HD format
active -> New -> explicit Open from an empty selected file recovered the same
valid `projects/` JSON and activated `custom_1920x1080`. The temporary smoke-test
file was deleted afterward.

The fix pass found two concrete persistence faults and one stale audit
hypothesis:

- `normalizeOverlayDocumentProject()` coupled `project.activeTargetId` to the
  compatibility snapshot's `state.outputProfileKey`. If those fields ever
  desynchronised, load silently demoted the active format back to the snapshot
  profile. The shared schema now accepts any `activeTargetId` that points to a
  saved target; the bridge then activates that target's own output profile.
- `applyWorkspaceDocumentMetadata()` changed the workspace name/file metadata
  without immediately notifying the shell. If recent-file storage stalled or
  failed after Open, the top-navigation title could stay on the old value even
  though a file-backed document had applied. Metadata application now notifies
  the shell immediately, and recent-document `IndexedDB.put()` clone failures
  reject instead of leaving the workflow pending.
- The earlier hypothesis that the Formats table enumerated built-ins only was
  wrong. `apps/overlay-preview/src/document-target-controller.ts` renders
  `state.documentProject.targets`; the missing custom format was caused by the
  active-format normalisation/apply path, not by the table source.

Validation completed after the fixes:

- `npm run typecheck`
- `npm run verify:document-persistence`
- Live preview e2e at `http://127.0.0.1:4173/` with a File System
  Access-compatible browser handle: clean untitled document -> Save As
  `audit-e2e.brand-layout-ops.json` -> add and activate custom
  `Landscape Proof 1920x1080` -> Save -> reload session snapshot -> explicit
  Open from the captured file. The title stayed `audit-e2e`; saved
  `metadata.name` stayed `audit-e2e`; saved `project.activeTargetId` stayed
  `format-5`; saved `state.outputProfileKey` stayed `custom_1920x1080`; both
  reload and explicit Open showed the custom 1920x1080 row as active.

The user clarified `GPT-5.4` as a model selection. There is still no registered
VS Code subagent named `gpt-5.4` in this workspace, so the primary agent kept
the load-bearing code changes and used the available helper tooling for
read-only exploration.

## Reproduced bugs

1. **Title still reads "Untitled document" after Save / Save As.**
   Top-left document title shows `Untitled document` even after the user picks
   a filename in the OS save dialog.
2. **Newly added custom format disappears on reopen.**
   Adding a custom output format (e.g. 1920×1080), saving, reopening the file
   leaves the format absent from the format list.
3. **Active format reverts to the default `1080x1920` on reopen.**
   Even when the saved file was authored against a non-default format, the
   reopened document activates the built-in `1080x1920` profile.

## Audit of prior agent claims

`STATUS.md` / `HISTORY.md` currently record two "validated" fixes from the
previous session:

- `apps/overlay-preview/src/document-workspace.ts` — `saveCurrentDocument` and
  `openDocumentFromDisk` patched to adopt the picker filename stem when the
  document name is still equal to the untitled sentinel.
- `apps/overlay-preview/src/grid-section.ts` — safe-area input handlers
  patched to spread `state.params.safeArea` instead of a captured snapshot.

Findings:

- The grid-section safe-area fix is real and the patch is correct in
  isolation. It was validated only against a synthetic state stub, not the
  real authoring shell flow. The user has not re-reported the off-center
  safe-area regression in the current message, so treat this as
  provisionally good but flag a real-flow re-check.
- The `saveCurrentDocument` filename-adoption patch IS present in the source
  (see `document-workspace.ts` lines ~588-670) and the relevant branch
  (`workspace.name === untitledName → adopt filename stem`) does run. The
  reason the title in the nav still shows `Untitled document` is **not** in
  the save path — it's a wiring/observer issue in the title element. See
  root-cause analysis below.
- The previous session's "validated" claims used local stubs, not the real
  File System Access flow. That is the structural reason these regressions
  shipped: stub validation does not exercise picker-driven name resolution,
  custom-profile registration, or the post-load apply path. The audit log
  in `HISTORY.md` should be qualified to say "validated against synthetic
  state" rather than "validated", or the claim should be moved back into
  `TODO.md` until end-to-end validation lands.

## Root-cause analysis

### Bug 1 — title stays "Untitled document" after Save

Save flow (`document-workspace.ts → saveCurrentDocument`):

1. Picker returns `fileHandle` with `name = "myproject.json"`.
2. When `nameOverride` is undefined and `workspace.name === untitledName`,
   `resolveDocumentNameFromWorkspace` derives the name from the filename via
   `deriveDocumentNameFromFileName` and stores it on `workspace.name`. **This
   part is correct.**
3. `setStatus("Saved …", "success")` is called, which invokes
   `notifyWorkspaceChanged()`.
4. `notifyWorkspaceChanged()` calls `options.onWorkspaceChange?.()`.

The wiring in `apps/overlay-preview/src/main.ts` (around line 198-201) routes
`onWorkspaceChange` to `previewShellController?.updateDocumentUi()`, which
updates `[data-document-title]`. So in principle the title should refresh.

Likely actual failure modes (need real-flow confirmation, not stubs):

- `previewShellController` is captured by reference at controller-creation
  time but may still be `null` when `createDocumentWorkspaceController` is
  constructed, leaving `onWorkspaceChange` permanently bound to a `?.`
  short-circuit. If the closure captures the variable's current binding
  (it should — `let`/`var` lookup at call time), this is fine. **Verify by
  logging `previewShellController` at the first `updateDocumentUi` after
  Save.**
- `updateDocumentUi()` reads `deps.documentWorkspace.getNormalizedName(state.name)`.
  If `state.name` is being read from a snapshotted object (not the live
  workspace), the title never sees the rename. The current code passes
  `documentWorkspace` controller by reference; this should be live. **Verify.**
- `restoreLastSessionDocument()` may re-fire after Save and overwrite
  `workspace.name` back to `untitledName` from a stale localStorage entry.
  Inspect ordering of `persistSessionDocumentSnapshot` vs the next session
  restore. The snapshot writer captures `metadata.name = nextDocumentName`,
  so a same-session restore should be idempotent — but a *post-reload*
  restore reads `metadata.name` from the persisted document; if
  `buildPersistedDocument` does not propagate the adopted name into
  `metadata.name`, the title reverts on reload. **This is the most likely
  real cause of the persistent rename failure across sessions.**

The sequence to confirm in real flow:

1. New document → name is `Untitled document`.
2. Save As → picker returns `myproject.json` → `workspace.name` becomes
   `myproject` in memory.
3. Title in the nav updates? If not, this is a UI-observer issue.
4. Reload → `restoreLastSessionDocument` re-runs → reads
   `localStorage["brand-layout-ops:last-session-document"]` →
   `metadata.name` field of the stored serialized document.
5. If that `metadata.name` is `Untitled document`, the renamed save was
   never propagated into the persisted JSON.

The structural fix is to feed the *adopted* name into
`buildPersistedDocument` BEFORE serialization in `saveCurrentDocument`. The
current code already does this (`nextDocumentName` is updated, then passed
into the metadata block). So the regression is one of:

- (a) `metadata.name` is being overwritten downstream during sanitisation
  (`sanitizeOverlayDocumentFile`) when the document is loaded back —
  because a fallback `options.fallbackName` is wired to a stale source.
- (b) The stored snapshot in localStorage was written by a code path that
  bypasses the rename branch (e.g. `persistWorkspaceDocumentSnapshot` at
  `document-workspace.ts:339` — which receives whatever metadata its caller
  passes; if a caller passes `workspace.name` before the rename, the
  snapshot is stale).

Both branches need verification against a real save/reload cycle, not a
stub.

### Bug 2 — newly added custom format disappears on reopen

Path: `packages/operator-overlay-layout/src/document-schema.ts` →
`normalizeOverlayDocumentProject`.

Save side: `buildOverlayPreviewDocument` calls
`normalizeOverlayDocumentProject(state.documentProject, snapshot)`. This
should preserve any custom-key target (`custom_1920x1080`). Earlier
validation in the prior session reportedly confirmed the custom key IS
present in the serialized `project.targets`. Treat that as plausible but
re-verify by inspecting an actual round-tripped `.json` file from the user.

Load side: `normalizeOverlayDocumentProject` walks `rawProject.targets`,
keys uniqueness on `outputProfileKey` (good), and runs
`createOverlayDocumentTarget(outputProfileKey, rawTarget)`. That helper
calls `getOverlayDocumentTargetLabel(outputProfileKey)` →
`getOutputProfile(outputProfileKey).label`. `getOutputProfile` correctly
synthesises a `custom` profile from a `custom_WxH` key, so the target
survives shape-wise.

**Most likely real loss point**: the format **list UI** (the radio set / format
chooser) almost certainly enumerates from `OUTPUT_PROFILE_ORDER` (built-ins
only) rather than from `project.targets`. So the custom format is preserved
in the saved data and loaded into `project.targets`, but never appears in
the chooser, and `state.outputProfileKey` is reset to a built-in by
`switchOutputProfile`'s "is this profile in the registry?" guard.

Confirm by:

- `grep` for the format-list build in `apps/overlay-preview/src/` —
  likely `format-section.ts`, `output-profile-section.ts`,
  `formats-modal.ts`, or similar — and verify whether it iterates
  `project.targets` or `OUTPUT_PROFILE_ORDER`.
- Re-check that `switchOutputProfile` accepts a `custom_WxH` key without
  rejecting it.

### Bug 3 — active format reverts to `1080x1920` on reopen

Same as bug 2 root cause, plus: in
`normalizeOverlayDocumentProject` (lines ~349-353):

```ts
const activeTargetId = typeof rawProject.activeTargetId === "string" && targets.some((target) => (
  target.id === rawProject.activeTargetId && target.outputProfileKey === snapshot.outputProfileKey
))
  ? rawProject.activeTargetId
  : snapshotTargetId;
```

The validity check requires that the matching target's `outputProfileKey`
equals **`snapshot.outputProfileKey`**. So `activeTargetId` is only
honoured when the saved active target's profile equals the saved
state-snapshot's `outputProfileKey`. If anything in the save path lets
`state.outputProfileKey` and `project.activeTargetId` desynchronise
(custom add → active in project, but state snapshot still on default),
the load path silently rewrites `activeTargetId` to whatever
`snapshotTargetId` (the target matching `snapshot.outputProfileKey`) is —
i.e. the default `1080x1920`.

Even when the two are in sync, if the format-list UI reset (bug 2) calls
`switchOutputProfile(DEFAULT_OUTPUT_PROFILE_KEY)` post-apply, it overwrites
the just-restored active format.

The fix is two-sided:

- Soften the `activeTargetId` validity check: accept any target whose `id`
  is in `targets`, drop the `outputProfileKey === snapshot.outputProfileKey`
  invariant. The target's own `outputProfileKey` is what matters; the
  snapshot's is for picking a fallback when `activeTargetId` is missing.
- Make the format-list UI enumerate `project.targets` (or the union of
  built-ins and `project.targets`), so post-load activation never has to
  fall back.

## Why this regressed under "validated" claims

The previous session validated against synthetic stubs: hand-built
`workspace`-shaped objects passed directly to `saveCurrentDocument`-shaped
helpers. Real failures here are in:

- The cross-module observer chain (`onWorkspaceChange` → `updateDocumentUi`
  → DOM).
- The persistence sanitiser (`sanitizeOverlayDocumentFile`,
  `normalizeOverlayDocumentProject`) which only fires on a real save and a
  real reload.
- The format-list UI which is rendered by `preview-shell-controller` /
  one of its section builders, only when the live document is mutated.

Stubs cannot exercise any of these. End-to-end validation requires:

1. Launch the dev preview.
2. Save As → enter a name.
3. Confirm title updates.
4. Add a custom format (e.g. 1920×1080).
5. Save.
6. Reload the page (do not use restore — actually reload).
7. Reopen via Open... or Open Recent...
8. Confirm format is in chooser AND active.

This sequence MUST be the validation gate for any future claim. The audit
recommends that `STATUS.md` / `HISTORY.md` distinguish "stub-validated"
from "end-to-end validated" entries going forward.

## Remediation tasks (model-tagged)

### T1 — Capture a real round-tripped saved document

`[model: gpt-5-mini]`

Goal: produce a real `.json` file from the running preview by:

1. Launch `npm run preview:dev`.
2. New document → Save As → name `audit-fixture` → format **default**.
3. Save → close picker.
4. Add custom format 1920×1080 → activate it → Save (overwrite).
5. Copy the resulting JSON into `tmp/audit-fixture.json` in the repo.

Deliverable: `tmp/audit-fixture.json` plus a one-paragraph note in this
audit file documenting which keys (`metadata.name`,
`project.activeTargetId`, `project.targets[].outputProfileKey`,
`state.outputProfileKey`) are actually present.

This is a mechanical capture task; safe to delegate.

### T2 — Confirm format-list UI source

`[model: gpt-5-mini]`

Goal: identify where the output-format chooser is rendered in
`apps/overlay-preview/src/` and confirm whether it enumerates
`OUTPUT_PROFILE_ORDER` or `state.documentProject.targets`. Do not change
any behaviour. Append a short paragraph to this audit under "Findings"
naming the file, the function, and the iteration source.

Search hints:
- `grep -r "OUTPUT_PROFILE_ORDER" apps/overlay-preview/src/`
- `grep -r "project.targets" apps/overlay-preview/src/`
- Likely candidates: `format-*-section.ts`, `output-profile-*.ts`.

### T3 — Fix `activeTargetId` validity check

`[model: claude-sonnet-4.5]`

File: `packages/operator-overlay-layout/src/document-schema.ts`,
`normalizeOverlayDocumentProject`.

Change the validity check from:

```ts
target.id === rawProject.activeTargetId && target.outputProfileKey === snapshot.outputProfileKey
```

to:

```ts
target.id === rawProject.activeTargetId
```

Rationale: `activeTargetId` belongs to `project`; coupling it to
`state.outputProfileKey` makes the load path silently demote the active
target whenever the two desync. The target's own
`outputProfileKey` is the authoritative profile for that target.

After the change, also update `state.outputProfileKey` in the apply
path (`applySourceDefaultSnapshotToState`) to follow the active
target's profile, not the snapshot's, so the renderer activates the
right profile.

Add a tiny round-trip unit test: build a project with two targets,
mark the second active, normalise → serialise → re-normalise →
assert `activeTargetId` is preserved.

### T4 — Make the format chooser iterate `project.targets`

`[model: claude-sonnet-4.5]`

Conditional on T2's findings. If the chooser enumerates
`OUTPUT_PROFILE_ORDER`, change it to render the union:

- All `project.targets` entries (preserving order).
- Optionally a "+ Add format…" affordance that opens the existing
  formats modal.

Built-in profiles are still discoverable through "Add format" but the
chooser itself shows whatever the document actually owns. This makes
custom formats first-class on reload and removes the implicit reset
to `1080x1920`.

### T5 — Trace the title-stays-"Untitled" path end-to-end

`[model: claude-sonnet-4.5]`

This requires runtime instrumentation, not just static reading.

1. In `preview-shell-controller.ts → updateDocumentUi`, add a temporary
   `console.debug` printing `state.name`, `state.fileName`,
   `state.isDirty`, and the resolved `normalizedName`.
2. In `document-workspace.ts → saveCurrentDocument`, add a temporary
   `console.debug` printing `nextDocumentName`,
   `workspace.name` (before and after assignment), and the metadata
   passed into `buildPersistedDocument`.
3. Run the real Save As flow once; capture the console output; attach
   it as a fenced block under "Findings" in this audit file.
4. Diagnose from the trace whether the regression is in the in-memory
   rename, the observer fan-out, or the persisted `metadata.name`.
5. Implement the minimal fix at the actual fault site. Remove the
   debug logs.

This is whole-system reasoning across save → observer → DOM → persist
→ reload → sanitise → restore. Do not delegate.

### T6 — Persisted-snapshot freshness on Save

`[model: claude-sonnet-4.5]`

Audit `persistSessionDocumentSnapshot` callers. Confirm that every
caller that runs after a successful Save passes the **adopted** name
(not `workspace.name` captured before the rename branch). Specifically
check `persistWorkspaceDocumentSnapshot` (line ~339) — its `metadata`
parameter must be built from `nextDocumentName`, not from a stale
`workspace.name`. Fix any caller that passes pre-rename metadata.

Add a regression test: simulate Save with `workspace.name === untitledName`
and a picker filename of `xyz.json`; assert the localStorage payload's
`metadata.name === "xyz"`.

### T7 — Re-validate the safe-area handler fix in real flow

`[model: gpt-5-mini]`

Open preview, edit each safe-area input (top, right, bottom, left)
sequentially, confirm none clobber the others. If they do, escalate
to Sonnet — there is likely another captured-snapshot pattern in
`grid-section.ts` or its siblings.

### T8 — Update STATUS.md / HISTORY.md to distinguish stub vs e2e validation

`[model: gpt-5-mini]`

Find the prior-session entries claiming the save-name and safe-area
fixes were "validated". Append " (stub-validated; e2e re-check pending)"
to each. Add a short rule under the existing conventions section
stating that "validated" means real-flow validation against a running
preview, and stub validation must be labelled as such.

### T9 — Triage the inboxes

`[model: gpt-5-mini]`

Per `.github/copilot-instructions.md`, drain `INBOX.md` and
`AGENT-INBOX.md` into `TODO.md` / `ROADMAP.md` and reset both files
to their header templates. (Out of scope for this audit pass; tracked
here so it isn't lost.)

## Suggested execution order

1. T1, T2, T7, T9 in parallel (gpt-5-mini, mechanical, no
   inter-dependencies).
2. T5 (Sonnet) — gates everything else for bug 1.
3. T6 (Sonnet) — likely the actual fix surfaced by T5.
4. T3 (Sonnet) — independent; fixes the activeTargetId desync.
5. T4 (Sonnet) — depends on T2's findings.
6. T8 (gpt-5-mini) — last, after fixes land, so the doc edits reflect
   reality.

## Open questions for the user

- Is there a canonical `/orchestrate` command spec somewhere outside
  the workspace + user prompts folder I should adopt verbatim? The
  current tagging is a sensible default but not bound to a published
  schema.
- Is "chatgpt 5.4" intended as `gpt-5-mini`, `gpt-5`, or a custom
  model alias in your routing? The tasks above assume "the smaller,
  cheaper GPT-5 tier" wherever they say `gpt-5-mini`; rename the tag
  if your routing uses a different identifier.
