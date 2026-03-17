# Restormel Keys — Design and Site Requirements

---

## 1. Design tokens

**Canonical design system:** All tokens, typography, and components are defined in [DESIGN-TOKENS.md](./DESIGN-TOKENS.md), [DESIGN-SPECIFICATION.md](./DESIGN-SPECIFICATION.md), and [COMPONENT-INVENTORY.md](./COMPONENT-INVENTORY.md). See [design-system-index.md](./design-system-index.md) for how the whole product aligns.

The Keys marketing/site layer uses **`--rm-*`** as aliases to the canonical tokens so that site and dashboard share the same visual language. Implementations should use [design-tokens.css](./design-tokens.css) and map as follows:

| Alias (--rm-*) | Canonical token | Usage |
|----------------|-----------------|--------|
| `--rm-bg` | `--ink` | Page background |
| `--rm-surface` | `--charcoal` | Panels, cards |
| `--rm-surface-raised` | `--elevated` | Raised surfaces |
| `--rm-border` | `--slate` | Borders, dividers |
| `--rm-text` | `--paper` | Primary text |
| `--rm-muted` | `--mist` | Body/secondary text |
| `--rm-dim` | `--steel` | Captions, metadata |
| `--rm-sage` | `--signal-teal` | Primary actions, success, links |
| `--rm-sage-bg` | `--signal-teal-10` | Subtle teal backgrounds |
| `--rm-font-display` | `--font-sans` (or design system display) | Headings |
| `--rm-font-ui` | `--font-mono` | UI, code |
| `--rm-radius` | `--radius-base` | Default radius |

Embeddable components use **`--rk-*`** for host-app theming (see packages/svelte theme.css); those values must align with the design system (e.g. `--rk-accent` → path-blue, `--rk-success` → signal-teal, `--rk-danger` → coral-alert). Shadow DOM for style isolation.

---

## 2. Landing page wireframe (restormel.dev/keys)

**S1 — Hero:** "Drop-in BYOK for AI apps." Subhead about shipping key management in an afternoon. CTAs: "Get started" + "View on GitHub". Dark code editor visual.

**S2 — Two modes:** Builder routing + end-user BYOK. Two cards side by side.

**S3 — Code example:** Split view — server setup (10 lines TS) | React component (5 lines JSX). JetBrains Mono.

**S4 — Framework logos:** Next.js, React, SvelteKit, Vue, Astro. "No Docker. No Redis. No proxy server."

**S5 — Feature grid:** 6 cards (key management, routing, cost, entitlements, embeddable UI, storage adapters).

**S6 — Comparison table:** Keys vs LiteLLM vs Portkey vs Custom.

**S7 — Pricing preview:** Four tier cards. Link to full pricing.

**S8 — Proof point:** "Extracted from SOPHIA, a production AI application."

**S9 — Footer CTA:** "Start in 5 minutes."

---

## 3. Dashboard routes

| Route | Content |
|-------|---------|
| `/keys/dashboard` | Overview: project list, quick stats |
| `/keys/dashboard/projects` | List projects, create project, generate API key |
| `/keys/dashboard/projects/[id]` | Project detail: stored keys count, usage, API key display |
| `/keys/dashboard/projects/[id]/usage` | Usage graphs: requests by provider, cost breakdown |
| `/keys/dashboard/billing` | Current tier, next billing, "Manage subscription" → Paddle portal |
| `/keys/dashboard/settings` | Account settings, team members (Team+) |

---

## 4. Documentation site (Svelte)

P0 pages: Quickstart, Next.js guide, React guide, SvelteKit guide, API reference, Configuration reference, Provider reference, Storage adapters, Security model.

P1 pages: CLI reference, Entitlements guide, Theming guide, Web Components guide.

P2 pages: Remix guide, Vue/Nuxt guide, Self-hosting guide, Migration guide.

---

## 5. Site technology

| Component | Technology |
|-----------|-----------|
| Marketing pages | Astro |
| Documentation | Starlight (Astro plugin) |
| Dashboard | SvelteKit |
| Static hosting | Cloudflare Pages |
| Dashboard hosting | GCP Cloud Run (europe-west2) |
| Auth | Firebase Auth (GitHub sign-in) |
| Billing | Paddle Checkout + Customer Portal |

### Deployment architecture

```
restormel.dev (Cloudflare Pages)
├── /                    static homepage
├── /keys                static landing page
├── /keys/pricing        static + Paddle.js
├── /keys/docs/*         docs (Svelte routes)
└── /keys/dashboard/*    reverse-proxy → Cloud Run

keys-dashboard.europe-west2.run.app (Cloud Run)
├── /keys/dashboard      SvelteKit SSR
├── /api/billing/*       Paddle endpoints
├── /api/keys/*          Cloud API
└── /api/health          Health check
```
