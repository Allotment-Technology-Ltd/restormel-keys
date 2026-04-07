# Restormel Design System — Canonical Index

**Status:** Canonical. All Restormel Keys UI must align with this design system.

This index is the single entry point for the Restormel design system. All product UI—marketing site, dashboard, embeddable components (Svelte, React, Web Components), and demos—should use the tokens, patterns, and components defined here.

## Target model (confirmed)

- **Single app:** Site, docs, and dashboard are one SvelteKit app (`apps/dashboard`) at restormel.dev (marketing at `/keys`, `/keys/pricing`; docs at `/keys/docs`; dashboard at `/keys/dashboard`). Consistency is achieved through shared tokens, nav, and copy. Embeddable: Svelte (reference components), Web Components (elements), React (wrappers).
- **Token architecture:** Base canonical tokens ([design-tokens.css](./design-tokens.css)) → semantic surface tokens (`--rm-*` for brand/app/docs shells, `--rk-*` for embeddable components) → optional component-level tokens. All surfaces consume from this chain; no ad-hoc values in shells or components.
- **Contract:** Shells (brand, app, docs) and embeddable packages must map to the canonical base and use the same semantic intent; drift checks and docs enforce alignment.

## SSO and same links

One login, one cookie, same links everywhere. Sign-in uses a single entry point (`/keys/dashboard/login`). The session cookie is scoped to the full origin (e.g. `restormel.dev`) when the dashboard is served behind the Worker proxy (Path=/; Domain omitted so the browser uses the current origin). Every surface—marketing nav, docs header, dashboard topbar, and all runbooks/reference docs—must use the same canonical URLs: **Dashboard** → `/keys/dashboard`, **Sign in** → `/keys/dashboard/login`. No alternate URLs or wording.

## Brand and logo usage

Logo and lockup are **core layout primitives**, not decoration. Use them consistently so brand is embedded in structure.

**One lockup in nav contexts:** The same asset (**restormel-lockup-nav.svg**) is used for nav/header/sidebar across site, docs, and dashboard. No alternate lockup in these contexts so the product reads as one brand. Marketing layout and docs layout use it in [keys/+layout.svelte](../apps/dashboard/src/routes/keys/+layout.svelte) and [keys/docs/+layout.svelte](../apps/dashboard/src/routes/keys/docs/+layout.svelte); dashboard uses it in [AppLogo.svelte](../apps/dashboard/src/lib/components/AppLogo.svelte). Hero and marketing full-width contexts may use the larger lockup variants (dark/light); nav, header, and sidebar must use the nav lockup only.

| Context | Asset | Size / rule | Where |
|--------|--------|-------------|--------|
| Marketing nav (header) | restormel-lockup-nav.svg | Height 28px; min-height container `--rm-nav-height` (3.5rem) | [keys/+layout.svelte](../apps/dashboard/src/routes/keys/+layout.svelte) `.marketing-nav-inner` / `.logo`. |
| Marketing footer | restormel-lockup-nav.svg | Height 24px | Same layout, `.marketing-footer-logo`. |
| Dashboard sidebar | restormel-lockup-nav.svg | Height 28px; padding `var(--space-4)` to match nav links | [AppLogo.svelte](../apps/dashboard/src/lib/components/AppLogo.svelte) `height="28"`; layout `.logo` padding. |
| Docs layout | restormel-lockup-nav.svg | Same as marketing nav | [keys/docs/+layout.svelte](../apps/dashboard/src/routes/keys/docs/+layout.svelte) `.docs-nav`. |
| Icon-only (favicon, tight spaces) | Mark | 24–32px | Favicon, OG, or icon-only UI (dashboard static or equivalent). |

**Rules:** (1) **One lockup in nav/header/sidebar:** restormel-lockup-nav.svg everywhere; no exceptions. (2) Lockup = mark + wordmark; use in nav, header, footer. (3) Mark only = concentric symbol; use when space is tight or icon-only is required. (4) **Sizing mandatory:** nav/header = 28px height; footer = 24px; dashboard sidebar = 28px. (5) **Clear-space:** same vertical/horizontal rhythm as surrounding nav (`--space-4` / `--space-6`); header/sidebar use `--rm-nav-height` or equivalent so the logo sits in the layout grid. (6) Focus and contrast: use `--focus-ring-*`; sufficient contrast on `--rm-surface` / `--rm-bg`. (7) All shell headers/sidebars use the same tokenized spacing so the logo is part of the layout system, not a tag-on.

## Canonical documents

| Document | Purpose |
|----------|---------|
| [DESIGN-TOKENS.md](./DESIGN-TOKENS.md) | Colors, typography, spacing, radius, shadows, interaction, focus, component sizes. Single source for token values. |
| [DESIGN-SPECIFICATION.md](./DESIGN-SPECIFICATION.md) | Design principles, foundation, components, graph patterns, page layouts, usage guidelines, accessibility. |
| [COMPONENT-INVENTORY.md](./COMPONENT-INVENTORY.md) | Full component inventory (atoms, molecules, organisms, graph components, templates) with variants and props. |
| [documentation-strategy.md](./documentation-strategy.md) | Single coherent doc journey, agent-readability, compulsory same links (Dashboard/Sign in), runbooks and in-app docs alignment. |
| [ux-contracts.md](./ux-contracts.md) | Shared navigation model, copy registry (product nouns, CTA grammar), and state conventions (loading/error/empty/success) across site, docs, dashboard, and embeddable surfaces. |

## Implementation

- **Reference implementation:** [design-tokens.css](./design-tokens.css) — CSS custom properties that implement DESIGN-TOKENS.md. Use this file (or equivalent values) in site, dashboard, and packages so the whole product shares one visual language.
- **Keys-specific aliases:** The marketing/site layer uses `--rm-*` and embeddable components use `--rk-*`; these are documented in [04-design-and-site.md](./04-design-and-site.md) and must map to the canonical tokens so that changing the design system updates the whole product.
- **Shared tokens package:** **`@restormel/keys-tokens`** on npm provides `base.css`, `semantic-rm.css`, `semantic-rk.css`, and `contracts.ts` (typed semantic keys for tooling). The dashboard imports from the package; [docs/design-tokens.css](./design-tokens.css) remains the human-readable reference—keep it aligned when token values change (source repo: [restormel-platform](https://github.com/Allotment-Technology-Ltd/restormel-platform)). Suite layout: [docs/platform-modularization.md](./platform-modularization.md).
- **Drift check:** Run `pnpm run check-token-drift` (or `scripts/check-token-drift.sh`) to verify `--rk-*` parity between packages/svelte and packages/elements. Fix any drift before committing.

## Where the design system applies

| Surface | Token namespace | Alignment |
|---------|------------------|-----------|
| apps/dashboard (SvelteKit) | `--rm-*` (aliases) | Single app: marketing, docs, and dashboard. app.css and layouts use design-tokens; all routes use canonical or aliased tokens. |
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

## Visual harmony checklist

Use this checklist for reviews and drift checks so the product keeps one look and feel across site, docs, and dashboard.

1. **Logo asset and sizing (nav/header/sidebar)**  
   One lockup (restormel-lockup-nav.svg) in all shells; nav/header/sidebar height 28px; footer 24px; container min-height `--rm-nav-height` (3.5rem); same horizontal padding (`--space-4` / `--space-6`) so the logo sits in the layout grid.

2. **Nav labels and canonical URLs**  
   Only: Keys, Docs, Pricing, GitHub, Dashboard (and Sign in in docs Product section). Same URLs everywhere: Dashboard → `/keys/dashboard`, Sign in → `/keys/dashboard/login`, Docs → `/keys/docs/`, Pricing → `/keys/pricing`, Keys → `/keys`. No alternate labels or paths unless explicitly added.

   Signed-in state: show an **account menu (avatar)** in the header/topbar with Profile & settings, Subscription, and Sign out.

3. **Section pattern (title + intro + content)**  
   Marketing/docs: section-title (h2) + optional section-intro (p) + content; spacing `--space-6` / `--space-8`. Dashboard: page-title (h1) + page-desc (p) + content; `.page-title` margin `0 0 var(--space-2)`, `.page-desc` margin `0 0 var(--space-4)`; font sizes `var(--text-2xl)` and `var(--text-sm)`; desc color `--rm-muted`.

4. **Button and card tokens**  
   Buttons and cards use `--rm-radius`, `--rm-sage`, `--rm-border`, `--rm-surface-raised` and padding scale `--space-2`, `--space-4`, `--space-6`. Same tokens on site and dashboard so components are visually interchangeable.

5. **Empty and error state pattern**  
   Every empty view: explicit copy + one primary recovery action (e.g. Create a project, Generate API key). Every error: clear message + recovery (Try again, Sign in, link to docs). Use shared `.empty-state` (title, description, CTA) and semantic error styling (`--coral-alert` / `--rk-*` error tokens). Loading states shown (e.g. “Creating…”, “Generating…”); no blank content during requests.
