# Restormel Design System — Canonical Index

**Status:** Canonical. All Restormel Keys UI must align with this design system.

This index is the single entry point for the Restormel design system. All product UI—marketing site, dashboard, embeddable components (Svelte, React, Web Components), and demos—should use the tokens, patterns, and components defined here.

## Canonical documents

| Document | Purpose |
|----------|---------|
| [DESIGN-TOKENS.md](./DESIGN-TOKENS.md) | Colors, typography, spacing, radius, shadows, interaction, focus, component sizes. Single source for token values. |
| [DESIGN-SPECIFICATION.md](./DESIGN-SPECIFICATION.md) | Design principles, foundation, components, graph patterns, page layouts, usage guidelines, accessibility. |
| [COMPONENT-INVENTORY.md](./COMPONENT-INVENTORY.md) | Full component inventory (atoms, molecules, organisms, graph components, templates) with variants and props. |

## Implementation

- **Reference implementation:** [design-tokens.css](./design-tokens.css) — CSS custom properties that implement DESIGN-TOKENS.md. Use this file (or equivalent values) in site, dashboard, and packages so the whole product shares one visual language.
- **Keys-specific aliases:** The marketing/site layer uses `--rm-*` and embeddable components use `--rk-*`; these are documented in [04-design-and-site.md](./04-design-and-site.md) and must map to the canonical tokens so that changing the design system updates the whole product.

## Where the design system applies

| Surface | Token namespace | Alignment |
|---------|------------------|-----------|
| apps/site (Astro) | `--rm-*` (aliases to design tokens) | Uses design-tokens; global.css and layouts use canonical or aliased tokens. |
| apps/dashboard (SvelteKit) | `--rm-*` (aliases) | Same; app.css and components use design system. |
| packages/svelte (KeyManager, ModelSelector, CostEstimator) | `--rk-*` | [packages/svelte/src/theme.css](../packages/svelte/src/theme.css) defaults use design system values (ink, charcoal, path-blue, signal-teal, coral-alert, amber-insight). |
| packages/elements (Web Components) | `--rk-*` | Same as Svelte; host can override via CSS custom properties. |
| apps/demo-svelte, apps/demo-next | `--rm-*` / `--rk-*` | Demos use the same tokens so components look correct in context. |

## Principles (from DESIGN-SPECIFICATION.md)

1. **Dark-mode first** — All colors optimized for dark backgrounds.
2. **Technical credibility over ornament** — Restraint, no decorative flourish.
3. **Calm, analytical interface** — Subtle motion, muted palette, generous space.
4. **Graph-inspired visual language** — Nodes, edges, hierarchies; color has semantic meaning.
5. **Semantic color meaning** — Blue = primary/selection, Teal = verified/success, Amber = warning, Coral = error, Violet = inference/reasoning.

When adding or changing UI, prefer tokens and components from this system; avoid one-off colors or typography.
