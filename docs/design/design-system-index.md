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

**One lockup in nav contexts:** The same **`RestormelLogo`** component (`variant="lockup"`) and matching static asset (**restormel-lockup-nav.svg** for OG/schema) are used for nav/header/sidebar across site, docs, and dashboard. Implementation: [RestormelLogo.svelte](../apps/dashboard/src/lib/components/RestormelLogo.svelte), [AppLogo.svelte](../apps/dashboard/src/lib/components/AppLogo.svelte), [SiteHeader.svelte](../apps/dashboard/src/lib/components/site/SiteHeader.svelte).

| Context | Asset | Size / rule | Where |
|--------|--------|-------------|--------|
| Marketing nav (header) | `RestormelLogo` lockup | Height 32px; min-height container `--rm-nav-height` (3.5rem) | [SiteHeader.svelte](../apps/dashboard/src/lib/components/site/SiteHeader.svelte) |
| Dashboard sidebar | No logo — nav starts with Overview | — | [keys/dashboard/+layout.svelte](../apps/dashboard/src/routes/keys/dashboard/+layout.svelte) |
| Docs layout | Same as marketing nav | SiteHeader + DocsShell | [docs/+layout.svelte](../apps/dashboard/src/routes/docs/+layout.svelte) |
| Icon-only (favicon, tight spaces) | restormel-mark-brutalist.svg / `RestormelLogo variant="mark"` | 24–32px | Favicon, collapsed sidebar, icon-only UI. |

**Rules:** (1) **Marketing/docs nav:** `RestormelLogo variant="lockup"`; static `restormel-lockup-nav.svg` for OG/schema only. (2) **Dashboard sidebar:** no logo — navigation is task-focused. (3) **Login:** `AppLogo` at 36px on the sign-in panel only. (4) Mark-only for favicon and collapsed prototype chrome. (5) **Sizing:** site header 32px; login 36px. (6) Logo links use 1px mechanical press on hover where present.

### Third-party (vendor) marks

Vendor logos are **optional credibility signals**, not decoration. **Canonical rules:** [third-party-brand-marks.md](../guides/third-party-brand-marks.md) — sourcing (Simple Icons / press kits), monochrome treatment, alt text, no implied endorsement, and [`apps/dashboard/static/integrations/brands/ATTRIBUTION.md`](../../apps/dashboard/static/integrations/brands/ATTRIBUTION.md) for files we ship. Implementation: [`EcosystemStrip`](../apps/dashboard/src/lib/components/integrations/EcosystemStrip.svelte) (or successors) under `apps/dashboard/static/integrations/brands/*.svg`.

## Canonical documents

| Document | Purpose |
|----------|---------|
| [DESIGN-TOKENS.md](./DESIGN-TOKENS.md) | Colors, typography, spacing, radius, shadows, interaction, focus, component sizes. Single source for token values. |
| [DESIGN-SPECIFICATION.md](./DESIGN-SPECIFICATION.md) | Design principles, foundation, components, graph patterns, page layouts, usage guidelines, accessibility. |
| [COMPONENT-INVENTORY.md](./COMPONENT-INVENTORY.md) | Full component inventory (atoms, molecules, organisms, graph components, templates) with variants and props. |
| [documentation-strategy.md](../governance/documentation-strategy.md) | Single coherent doc journey, agent-readability, compulsory same links (Dashboard/Sign in), runbooks and in-app docs alignment. |
| [guides/third-party-brand-marks.md](../guides/third-party-brand-marks.md) | Vendor logos: sourcing, tokens, a11y, trademark-neutral copy; complements Brand and logo usage above. |
| [guides/midjourney-cursor-mcp.md](../guides/midjourney-cursor-mcp.md) | Optional Midjourney MCP for agent-generated hero/OG art; subscription vs API billing; links to Cursor skills. |
| [ux-contracts.md](./ux-contracts.md) | Shared navigation model, copy registry (product nouns, CTA grammar), and state conventions (loading/error/empty/success) across site, docs, dashboard, and embeddable surfaces. |

## Implementation

- **Reference implementation:** [design-tokens.css](./design-tokens.css) — CSS custom properties that implement DESIGN-TOKENS.md. Use this file (or equivalent values) in site, dashboard, and packages so the whole product shares one visual language.
- **Keys-specific aliases:** The marketing/site layer uses `--rm-*` and embeddable components use `--rk-*`; these are documented in [04-design-and-site.md](../archive/2026-03-build-pack/04-design-and-site.md) and must map to the canonical tokens so that changing the design system updates the whole product.
- **Shared tokens package:** **`@restormel/keys-tokens`** on npm provides `base.css`, `semantic-rm.css`, `semantic-rk.css`, and `contracts.ts` (typed semantic keys for tooling). The dashboard imports from the package; [docs/design/design-tokens.css](./design-tokens.css) remains the human-readable reference—keep it aligned when token values change (source repo: [restormel-platform](https://github.com/Allotment-Technology-Ltd/restormel-platform)). Suite layout: [docs/architecture/platform-modularization.md](../architecture/platform-modularization.md).
- **Drift check:** Run `pnpm run check-token-drift` (or `scripts/check-token-drift.sh`) to verify `--rk-*` parity between packages/svelte and packages/elements. Fix any drift before committing.

## Where the design system applies

| Surface | Token namespace | Alignment |
|---------|------------------|-----------|
| apps/dashboard (SvelteKit) | `--rm-*` (aliases) | Single app: marketing, docs, and dashboard. app.css and layouts use design-tokens; all routes use canonical or aliased tokens. |
| packages/svelte (KeyManager, ModelSelector, CostEstimator) | `--rk-*` | [packages/svelte/src/theme.css](../packages/svelte/src/theme.css) defaults use design system values (ink, charcoal, path-blue, signal-teal, coral-alert, amber-insight). |
| packages/elements (Web Components) | `--rk-*` | Same as Svelte; host can override via CSS custom properties. |
| apps/demo-svelte, apps/demo-next | `--rm-*` / `--rk-*` | Demos use the same tokens so components look correct in context. |

## Principles (from DESIGN-SPECIFICATION.md)

> **v3 — Neo-Brutalist (committed):** Warm cream canvas (`#F3EAD0`), ink structure (`#0C0C0C`), **yellow-only primary fills** (`#FFD600`), blueprint blue for text/tags only (`#1A3F8A`), tri-font stack (Barlow Condensed / DM Sans / Space Mono), 2px borders, 3/5/7px offset shadows with lift-on-hover. Canonical CSS:
> [`@restormel/keys-tokens/brutalist-rm.css`](../packages/keys-tokens/src/brutalist-rm.css); utilities:
> [`apps/dashboard/src/lib/styles/brutalist-utilities.css`](../apps/dashboard/src/lib/styles/brutalist-utilities.css). Reference mock: [`docs/reference/restormel_redesign.html`](./reference/restormel_redesign.html) when present.

1. **Light cream canvas** — High-contrast ink-on-paper across product surfaces.
2. **Technical credibility over ornament** — 2px borders and hard offset shadows; zero radius on buttons, tags, cards.
3. **Lift on hover** — Interactive cards/buttons translate `(-2px,-2px)` and grow shadow; active state presses in.
4. **Yellow-only primary fills** — CTAs, active nav, highlighted badges; secondary surfaces use `--color-surface` + ink border. **Never** `--color-ink` on `--color-blue` fills; use `--color-on-blue` when a blue background must carry text.
5. **Tri-font roles** — Display headings (Barlow Condensed), body (DM Sans), labels/buttons/code (Space Mono).
6. **Site layer** — `site-brutalist.css` (global), `marketing-brutalist-pass.css` (buttons/cards lift), **`marketing-ledger.css`** (canonical marketing section rhythm from **`/use-cases`**: yellow hero slabs, inverted mono tags, ink left-rule leads, stat chips, framed callouts, hatch bands), `suite-landing.css` (home `/`), `use-cases-brutal.css` (page layout only), `dashboard-surfaces.css` (dashboard chrome).

### Marketing ledger (reference: `/use-cases`)

Use these patterns for suite marketing, module landings, and template grids — not one-off page CSS.

| Pattern | Classes | When |
|---------|---------|------|
| Yellow hero / featured band | `.suite-hero-slab` on `<section>` | Primary thesis + CTA block |
| Inverted eyebrow | `.suite-section-tag--inverted` or `.brut-tag-inverted` | Tags on yellow slabs |
| Display title on slab | `.suite-section-title` inside slab | `text-shadow: 3px 3px 0 var(--color-surface)` |
| Lead with ink rule | `.suite-lead-rule` or `.suite-section-sub` in slab | Left border 4px, body-lg |
| Mono stat chip | `.suite-stat-chip` / `.uc-hero-count` | Counts, meta lines |
| Framed intro | `.suite-callout-frame` | Section intros (e.g. hobby band) |
| Diagonal hatch band | `.suite-section--hatch` | Alternate content sections |
| Template / teaser cards | `.teaser-grid .teaser-card`, `.use-case-card` | Ledger shadow via `marketing-ledger.css` |

Utilities mirror: `brut-hero-slab`, `brut-tag-inverted`, `brut-lead-rule`, `brut-stat-chip` in `brutalist-utilities.css`.

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
