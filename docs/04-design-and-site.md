# Restormel Keys — Design and Site Requirements

---

## 1. Design tokens

```css
--rm-bg: #1A1917;
--rm-surface: #141312;
--rm-surface-raised: #201F1D;
--rm-border: #2E2C29;
--rm-text: #E8E6E1;
--rm-muted: #9E9A93;
--rm-dim: #4A4845;
--rm-sage: #7FA383;
--rm-sage-bg: rgba(127,163,131,0.10);
--rm-font-display: 'Cormorant Garamond', Georgia, serif;
--rm-font-ui: 'JetBrains Mono', 'Courier New', monospace;
--rm-radius: 4px;
```

Embeddable components use `--rk-*` namespace for host-app theming via CSS custom properties on the component element. Shadow DOM for style isolation.

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

## 4. Documentation site (Starlight)

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
├── /keys/docs/*         static docs (Starlight)
└── /keys/dashboard/*    reverse-proxy → Cloud Run

keys-dashboard.europe-west2.run.app (Cloud Run)
├── /keys/dashboard      SvelteKit SSR
├── /api/billing/*       Paddle endpoints
├── /api/keys/*          Cloud API
└── /api/health          Health check
```
