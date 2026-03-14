# Restormel Keys — Master Build Pack Index

**Version:** 3.0
**Date:** March 2026
**Status:** Ready for implementation

---

## Document suite

This build pack contains everything needed to take Restormel Keys from concept to launched product. Read the strategy documents first, then execute the prompt packs in order.

### Strategy documents

| # | Document | What it covers |
|---|----------|---------------|
| 01 | `01-product-strategy.md` | Vision, mission, problem statement, two product modes, target users, use cases, competitive positioning |
| 02 | `02-architecture.md` | Framework compatibility, package structure, CLI, SDK, hosted API, Zuplo API management, security model |
| 03 | `03-infrastructure-and-billing.md` | GCP infrastructure (lift from SOPHIA), Paddle billing (lift from SOPHIA), Zuplo gateway (lift from SOPHIA), repo strategy, what to copy and what to adapt |
| 04 | `04-design-and-site.md` | Restormel brand design tokens, restormel.dev/keys landing page wireframe, dashboard routes, docs site, site technology stack, deployment architecture |
| 05 | `05-monetisation.md` | Pricing tiers, open-source vs paid boundaries, bolt-ons, revenue sequence, unit economics, pricing decision framework |
| 06 | `06-roadmap-and-launch.md` | Phased roadmap (weeks 1–16), launch sequence, success metrics, risk register |

### Prompt packs (Cursor-targeted)

| # | Document | Phase | Prompts | Est. effort |
|---|----------|-------|---------|-------------|
| 07 | `07-prompt-pack-phase-1.md` | Repo, infra, core extraction | 1.1–1.10 | ~2 weeks |
| 08 | `08-prompt-pack-phase-2.md` | UI components, framework wrappers, CLI | 2.1–2.10 | ~2 weeks |
| 09 | `09-prompt-pack-phase-3.md` | Zuplo, Paddle, dashboard, docs, landing | 3.1–3.10 | ~2 weeks |
| 10 | `10-prompt-pack-phase-4.md` | Analytics, testing, polish, launch | 4.1–4.8 | ~1.5 weeks |

**Total: 38 prompts across 4 phases, ~7.5 weeks of focused execution.**

---

## Recommended reading order

1. **Product strategy** — understand what we're building and why
2. **Architecture** — understand the package structure, framework approach, and API surface
3. **Infrastructure and billing** — understand what we're lifting from SOPHIA and what changes
4. **Design and site** — understand the visual direction and site pages
5. **Monetisation** — understand the pricing and revenue model
6. **Roadmap** — understand the delivery sequence and gates
7. **Prompt packs 1–4** — execute in order

---

## Key decisions (quick reference)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Billing provider | Paddle | Already operational in SOPHIA. Merchant of Record. Lift and adapt. |
| API management | Zuplo | Already partially implemented in SOPHIA. Free tier. TypeScript-native. Edge-deployed. Built-in API key management, rate limiting, developer portal. |
| Cloud infrastructure | GCP (Cloud Run, Firestore, Secret Manager, Artifact Registry) | Already operational in SOPHIA. Copy Pulumi + deploy.yml. |
| CI/CD | GitHub Actions | Already operational in SOPHIA. Copy and adapt. |
| IaC | Pulumi | Already operational in SOPHIA. Copy and simplify. |
| Auth | Firebase Auth (GitHub sign-in) | Already operational in SOPHIA. Developer audience prefers GitHub sign-in. |
| Static site | Astro + Starlight | Fast, Markdown-friendly, good SEO. Starlight is purpose-built for docs. |
| Dashboard | SvelteKit | Matches SOPHIA's stack. SSR for auth. Svelte for interactive UI. |
| Static hosting | Cloudflare Pages | Free tier, global CDN, fast deploys from GitHub. |
| Product analytics | PostHog | Already configured for SOPHIA. Generous free tier. Open-source. |
| UI framework priority | Next.js (P0) → React (P0) → SvelteKit (P1) → Web Components (P1) → Vue (P2) |
| Repo | Separate: `Allotment-Technology-Ltd/restormel-keys` | Independent release cadence. Clean dependency boundary. Open-source credibility. |
| Package manager | pnpm | Matches SOPHIA. Workspace support. |
| License | MIT | Adoption maximisation for open-source core. |

---

## What we're lifting from SOPHIA

| SOPHIA module | Keys target | Adaptation required |
|---------------|-------------|-------------------|
| `src/lib/server/billing/paddle.ts` | `apps/dashboard/src/lib/server/billing/paddle.ts` | Strip top-up/wallet/founder logic. Keep subscription checkout, portal, webhook verification. Replace price ID env keys. |
| `src/lib/server/billing/webhook.ts` | `apps/dashboard/src/lib/server/billing/webhook.ts` | Strip top-up credit handling. Keep subscription lifecycle events. Replace Firestore paths. |
| `src/lib/server/billing/store.ts` | `apps/dashboard/src/lib/server/billing/store.ts` | Replace `users/{uid}/billing` with `projects/{projectId}/subscription`. |
| `src/lib/server/billing/types.ts` | `apps/dashboard/src/lib/server/billing/types.ts` | Adapt `BillingTier` to Keys tiers. Keep currency and normalisation helpers. |
| `src/lib/server/billing/flags.ts` | `apps/dashboard/src/lib/server/billing/flags.ts` | Copy directly. |
| `src/routes/api/billing/checkout/+server.ts` | `apps/dashboard/src/routes/api/billing/checkout/+server.ts` | Simplify. Remove founder-offer checks. |
| `src/routes/api/billing/webhook/+server.ts` | `apps/dashboard/src/routes/api/billing/webhook/+server.ts` | Copy directly. |
| `src/routes/api/billing/sync/+server.ts` | `apps/dashboard/src/routes/api/billing/sync/+server.ts` | Copy. Useful for webhook recovery. |
| `src/routes/pricing/+page.svelte` | `apps/site/src/pages/keys/pricing.astro` + `apps/dashboard/` | Copy Paddle.js initialisation and checkout-open pattern. Rebuild UI for Keys tiers. |
| `src/lib/server/apiAuth.ts` | `packages/core/src/server/middleware.ts` | Extract API key verification pattern (HMAC hash, Firestore lookup, daily quota transaction). |
| `src/routes/api/v1/keys/+server.ts` | `apps/dashboard/src/routes/api/keys/+server.ts` | Copy key CRUD (create with HMAC hash, list masked, delete). Adapt for Keys project scoping. |
| `docs/reference/operations/runbooks/zuplo-phase1-runbook.md` | `docs/runbooks/zuplo-setup.md` | Adapt for Keys gateway project. Same Zuplo patterns. Different backend URL and key prefix. |
| `docs/reference/api/api-development-portal-roadmap.md` | `docs/api-portal-roadmap.md` | Adapt phasing for Keys. Same Zuplo + PostHog architecture. |
| `.github/workflows/deploy.yml` | `.github/workflows/deploy.yml` | Copy. Replace service names, image names, path filters. Remove SurrealDB and ingestion job steps. |
| `infra/index.ts` | `infra/index.ts` | Copy and simplify. Remove SurrealDB, VPC connector, ingestion job. Keep Cloud Run, load balancer, SSL, Artifact Registry, Secret Manager. Custom domain: see `docs/domain-mapping-restormel-dev.md`. |
| `Dockerfile` | `Dockerfile` | Copy multi-stage build pattern. Adapt for dashboard SvelteKit app. |

### Operational runbooks

| Document | Purpose |
|----------|---------|
| `docs/domain-mapping-restormel-dev.md` | Custom domain restormel.dev on GCP (load balancer, managed SSL, Vercel DNS). |
| `docs/reference/phase-1-manual-steps.md` | Phase 1 manual steps (npm, GCP, Pulumi config). |

---

## Canonical framing

- Restormel = the platform
- Restormel Keys = standalone BYOK product, first revenue product
- Restormel Graph = reasoning workspace, ships after Keys
- SOPHIA = reference application, consumes platform packages
- Allotment Technology Ltd = parent company
