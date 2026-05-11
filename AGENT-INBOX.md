# Agent Inbox

Drop machine-generated notes here. The agent will triage them into `TODO.md`, `ROADMAP.md`, `STATUS.md`, `HISTORY.md`, or `docs/specs.md` and empty this file at session start.

## BF main cleanup follow-up

The current BF-linked downstream state here came from the temporary `baseline-foundry` `master` sync, not the desired long-term `main`-based BF contract.

- Relevant commits:
	- `6d8d9e0` — substantive BF vendor sync and preview-shell update
	- `8a9811e` — docs-only portability handoff note
- Classification: this repo's changes were mostly BF integration work, not unique product feature work.
- Likely easiest recovery path: yes, this is a simple revert-and-resync candidate.
	- Revert or otherwise back out the temporary BF sync slice if that makes the migration cleaner.
	- Then resync from corrected `baseline-foundry` `main` once BF has forward-ported the useful token/accent/search work there.
- Important target: do not preserve `panel` as a design dependency.
	- The temporary sync used `baseline-foundry/presets/panel.css` while the shell ran on `bf-tier-os`.
	- The fix should reproduce the old validated `panel` density and shell feel using the proper `os`/`app` contract from BF `main`, not by keeping `panel` alive.
- Sanity checks after the resync:
	- shell density and spacing match the old validated preview
	- search/input/action padding still matches the BF split-token contract
	- gold authoring accents still match the old validated chrome
	- no local shell CSS is reintroduced unless strictly necessary