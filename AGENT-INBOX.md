# Agent Inbox

Drop machine-generated notes here. The agent will triage them into `TODO.md`, `ROADMAP.md`, `STATUS.md`, `HISTORY.md`, or `docs/specs.md` and empty this file at session start.

## Lightning talk demo — deadline May 13

Brand Layout Ops needs to deliver a polished format-switching demo for a 5-minute lightning talk on May 13. This is now the top priority.

### What the demo needs to show

1. The Ubuntu Summit 26.04 identity loaded in the browser editor.
2. Smooth radio-button switching between social media format variants — at minimum Instagram Feed (1080×1350), Instagram Story (1080×1920), and Full HD (1920×1080) — with grid, safe areas, and overlay content visibly adapting to each format.
3. Optionally, a short mp4 clip or animated preview if the playback path is stable.
4. The result must look polished enough for a screenshot or short screen recording on a slide in front of ~1000 people.

### What this means for task priority

- **Visual polish is the critical path.** The format switching already works. The remaining work is ensuring the demo looks clean: correct fonts loading, stage background neutral, guides rendering correctly, overlay text properly placed in each format variant.
- **Save/load reliability on demo day.** Confirm the happy-path save → close → reopen cycle works cleanly on the machine the talk will be delivered from. The dev-browser `/__authoring/document-file` fallback should not be needed.
- **The baseline-foundry panel preset CSS workaround** (importing app-tier preset instead of panel preset) — confirm this does not cause visible visual issues in the demo.
- Lane P preset work, new operator surfaces, export-recipe modeling, and any further architecture work can wait until after May 13.
- Do not start new lanes or refactors until the demo artifact is confirmed.

### Deliverable

A browser URL showing the Ubuntu Summit identity with format switching working cleanly, plus a screenshot or short screen recording artifact suitable for a presentation slide.