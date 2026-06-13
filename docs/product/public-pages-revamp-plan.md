# Public pages & docs revamp — Phase 2 plan

**Status:** Active programme plan. **Created:** 2026-06-13. **Owner:** Allotment Technology Ltd.
**Phase 1 (internal docs audit/reorg):** done — PR #303.

Aligns the **public** surface (marketing + docs + nav + analytics + SEO) with the current
product per [positioning.md](positioning.md). Built to run as a parallel agent swarm.

## Locked decisions (2026-06-13)
1. **Keys = the control plane for Verified Context.** Remove gateway-vs-Keys comparison
   tables; demote BYOK/routing to supporting. `gatewayProviders` is OFF in the MVP.
2. **Drop the header "Developers" dropdown**; keep ONE GitHub link in the footer. Surface
   Dashboard + the in-site API reference (`/keys/docs/api-reference`, Scalar) in their own right.
3. **Analytics: extend the existing PostHog (EU Cloud)** — close the public-page gap.
4. Marketing copy may only assert `proven` rows of [verified-context-claims-ledger.md](verified-context-claims-ledger.md).

## Workstreams

| ID | Workstream | Key files | Discipline / model | Deps |
|----|-----------|-----------|--------------------|------|
| **W1** | Marketing reposition | `apps/dashboard/src/routes/keys/+page.svelte` (gateway table ~ll.256–290), `VariantA/B.svelte`, `(marketing)/product`, `keys/use-cases`, `keys/pricing` | marketing/sales + copy → **Opus, high thinking** (Fable preferred for copy quality but unavailable in this env) | W4, W5/W6 helpers |
| **W2** | Docs IA consolidation | `routes/docs/**`, `routes/keys/docs/**`, `lib/keys/docs-nav.ts`, `docs-walkthrough-nav.ts`, `docs-integrations-walkthrough-nav.ts` (collapse 3 tutorial trees) | technical writing + IA → **Opus** | W4 |
| **W3** | API documentation IA | `routes/keys/docs/api-reference/+page.svelte`, `cloud-api/+page.svelte`, OpenAPI tag groups, `scripts/copy-openapi.mjs` | tech writing + SWE → **Opus** | W2 |
| **W4** | Navigation & global IA | `lib/components/site/SiteHeader.svelte`, `SiteFooter.svelte`, `lib/site-nav.ts`, `developer-portal-url.ts` | UX/UI + SWE → **Sonnet** | — |
| **W5** | Analytics pipeline (PostHog EU) | `hooks.client.ts`, `lib/posthog.ts`, new `lib/analytics/*`, root `+layout.svelte`; PostHog dashboards via MCP | analytics + SWE → **Opus** | — |
| **W6** | SEO | `lib/seo.ts` (OG is SVG → PNG), `routes/sitemap.xml/+server.ts` (curated→exhaustive), `robots.txt`, JSON-LD in layouts, OG image pipeline | SEO + SWE → **Sonnet** | — |
| **W7** | Accessibility & UX/UI polish | rewritten surfaces (focus, contrast, landmarks, CSS-only tabs) | a11y + UX → **Opus, high thinking** (Fable preferred, unavailable) | W1–W4 |
| **CD** | CI/CD & deployment | `.forgejo/workflows/*`, `.github/workflows/*`, Lighthouse-CI for public routes, build verification for all Phase 2 PRs | DevOps → **Sonnet** | — |

## Acceptance criteria (per workstream)
- **W1:** `/keys` leads with Verified Context (Keys = control plane); gateway comparison table
  removed; a "claim → citation → trace" proof block citing only `proven` ledger rows; no
  invented benchmarks; svelte-check + build green; before/after screenshots in PR.
- **W2:** one suite docs hub + per-product sections; the three tutorial trees merged into one
  Guides/Tutorials/Reference spine; no dead links; sidebar nav configs updated; build green.
- **W3:** OpenAPI tags grouped (Resolve / Routes / Policies / Catalog / Connect / Webhooks) so
  Scalar paginates; `cloud-api` folded into the reference; API ref + Dashboard surfaced.
- **W4:** Developers dropdown removed from header + mobile menu; Dashboard + API reference
  first-class; single footer GitHub link; `site-nav.ts` tests updated; build green.
- **W5:** documented event taxonomy (`lib/analytics/events.ts`); typed `track()` helper;
  global outbound-link + scroll-depth + enriched pageview; consent/cookieless config; PostHog
  dashboards (traffic, bounce, docs engagement, founders funnel) + weekly digest; no PII.
- **W6:** exhaustive flag-gated sitemap; PNG OG images per template; per-page canonical/meta;
  JSON-LD (FAQ for pricing, SoftwareApplication); Lighthouse target ≥ 90 SEO/Best-practices.
- **W7:** axe-clean on rewritten routes; keyboard + screen-reader pass; visual QA vs neo-brutalist system.
- **CD:** Lighthouse-CI workflow (`.forgejo` + `.github`) on public routes; every Phase 2 PR
  verified to build on the Forgejo-native pipeline; Coolify deploy unaffected.

## Orchestration model
- **Orchestrator:** the main Claude Code thread — defines non-overlapping file ownership,
  sequences waves, integrates PRs, runs per-PR review before merge ([[merge-after-review-verdict]]).
  **Run the orchestrator on the top tier: Opus (1M context) + high/extended thinking** — it
  must hold the whole programme + all open PRs + the positioning/claims constraints in context
  and make correctness-critical merge/conflict verdicts. Do not down-tier orchestration.
- **Wave 1 (parallel):** CD, W4, W5, W6, W1, W2 — foundation + top-priority + mostly disjoint.
- **Wave 2:** W3 (after W2 settles the docs tree), then W7 (reviews everyone's output).
- **Conventions for every agent:** branch off `origin/main`; tight scope; **Draft PR, never
  merge**; run `pnpm --filter dashboard run check` / `build` where feasible; invoke the relevant
  project skills (`restormel-suite-integrations-marketing`, `restormel-neu-brutalist-ui`,
  `restormel-use-cases-page`, `restormel-product-flow-diagrams`, `restormel-integration-docs-hub`,
  `restormel-admin-technical-writing`, `restormel-design-imagery`, PostHog skills); STOP and
  ask if scope changes.
- **Model tiering:** Opus (high thinking) for orchestration, IA/analytics judgment, SWE-critical,
  and **design/usability/copy** (Fable preferred for copy quality per
  [[multi-agent-orchestration-preference]] but **unavailable in this environment** — fall back to
  Opus); Sonnet for bounded SWE/config (W4 nav, W6 SEO, CI/CD).

## Success metrics (PostHog EU)
Organic traffic ↑, landing bounce ↓, docs-engagement (search + page depth), founders-apply funnel
conversion, "verified context / provenance / auditable RAG" keyword impressions, Lighthouse ≥ 90.

## Risks
- Parallel agents on one app → file collisions: mitigated by strict ownership + waves + the
  orchestrator integrating. W5/W6 own *infra* (helpers, layout head); page agents adopt later.
- Claims integrity: every quality phrase must cite a `proven` ledger row, or it's weakened.
