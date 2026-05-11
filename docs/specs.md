# External Specs

## Purpose

This repo does not own a single standalone design-spec programme. Instead, it follows external design-system specs plus implementation contracts from sibling repos. This file records the concrete paths that matter.

## Primary external spec inputs

| Spec | Path | Role in this repo |
|------|------|-------------------|
| Typeface | `../canonical-spacing-spec/specs/typeface/draft.md` | Shared typography assumptions when promoting layout or shell contracts upstream |
| Spacing | `../canonical-spacing-spec/specs/spacing/draft.md` | Vertical spacing and rhythm rules for shell/UI alignment decisions |
| Grid | `../canonical-spacing-spec/specs/grid/draft.md` | Grid and layout rules relevant to document shells and authored surfaces |

## Shared implementation contract

| Reference | Path | Role |
|-----------|------|------|
| Baseline Foundry | `../baseline-foundry/` | Shared shell, modal, navigation, and application-surface contract source; the preview now vendors a local BF `os` snapshot for runtime portability |
| Product parity reference | local `racoon-anim` clone | Behavior and content reference only, not a normative design spec |

## Notes

- When a reusable shell or layout rule should become shared, move it toward `baseline-foundry` rather than treating local preview code as the long-term source of truth.
- `racoon-anim` is a parity reference app, not the source of truth for shared architecture.
- Local implementation should not silently override the linked design specs without recording the deviation in `TODO.md` or `ROADMAP.md`.
- `baseline-foundry` remains the upstream contract and refresh source, but this repo's live preview no longer depends on a sibling BF clone being present on disk.
