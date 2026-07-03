---
title: Third-party brand marks (vendor logos)
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-04-14
last-reviewed: 2026-06-13
review-interval: P12M
---

# Third-party brand marks (vendor logos)

**Status:** Canonical policy for **vendor logos and names** on Restormel marketing, docs, and dashboard surfaces. Restormel’s **own** brand rules remain in [design-system-index.md](../design/design-system-index.md).

## Purpose

Make integration surfaces feel credible and scannable **without** misrepresenting relationships with third parties or breaching trademark guidelines.

## Sourcing

1. **Preferred:** [Simple Icons](https://github.com/simple-icons/simple-icons) (CC0 1.0) — copy SVG into [`apps/dashboard/static/integrations/brands/`](../../apps/dashboard/static/integrations/brands/) and record the slug + version in [`ATTRIBUTION.md`](../../apps/dashboard/static/integrations/brands/ATTRIBUTION.md).
2. **Alternative:** The vendor’s official brand / press resources, with written permission or terms that allow on-product use.
3. **Do not:** Hotlink third-party CDNs for logos in production UI, or scrape marks without a clear license.

## Visual treatment

- **Monochrome** on Restormel shells: recolor with `currentColor` or map fills to `--rm-text` / `--rm-muted` via CSS so logos sit on `--rm-surface` / `--rm-bg`.
- **Size:** Target ~22–28px height in strips; touch targets remain governed by [ux-contracts.md](../design/ux-contracts.md) where the whole card is interactive.
- **Density:** Prefer one horizontal strip or a small grid; avoid “logo soup.”

## Copy and legal posture

- Use **“Works with”**, **“Compatible with”**, or **“We document setup with”** — not “Official partner”, “Certified by”, or co-branding unless legal has approved it.
- **No endorsement implication:** A logo indicates technical compatibility or documented integration paths, not a commercial relationship.

## Accessibility

- Provide **`alt` text** that names the vendor (e.g. `alt="OpenAI"`). If the visible label already includes the name and the logo is redundant, use `aria-hidden="true"` on the image and keep text visible.

## Maintenance

- When adding a vendor to the [integration catalog](https://restormel.dev/keys/docs/guides/integration-catalog), add or update the attribution file and this doc only if policy changes; the catalog page should **link here** rather than restating legal guidance.
