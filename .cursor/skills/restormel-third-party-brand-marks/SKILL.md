---
name: restormel-third-party-brand-marks
description: >-
  Third-party logos and trademarks on Restormel surfaces: sourcing, monochrome token styling, alt text, no implied
  endorsement, and attribution files. Use when adding or changing vendor marks under static/integrations/brands or
  marketing ecosystem components.
---

# Third-party brand marks

## Canonical policy

Human-readable rules: [docs/guides/third-party-brand-marks.md](../../../docs/guides/third-party-brand-marks.md) (linked from [docs/design/design-system-index.md](../../../docs/design/design-system-index.md)).

## Agent rules

1. **Source:** Prefer [Simple Icons](https://github.com/simple-icons/simple-icons) (CC0 1.0) or the vendor’s official press kit. Record provenance in `apps/dashboard/static/integrations/brands/ATTRIBUTION.md`.
2. **Style:** Monochrome SVGs, `currentColor` or `--rm-*` tokens; no rainbow vendor fills on dark shells unless the design index explicitly allows an exception.
3. **Copy:** “Works with” / “Compatible with”—not “Partner of” unless legally approved.
4. **A11y:** Every logo has meaningful `alt` (e.g. “Neon logo”) or `aria-hidden` when redundant with adjacent visible text.
5. **Security:** Do not embed tracking pixels or external hotlinked assets in customer-facing pages.

## Do not

- Commit vendor artwork without a clear license path.
- Use logos as decorative clutter; cap density on strips (typically 6–10 marks).
