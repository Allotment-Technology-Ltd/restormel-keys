# Restormel Keys — Prompt Pack Phase 3

**Phase:** Site + Dashboard + Billing + Gateway (Weeks 5–7)
**Target:** Cursor
**Prerequisites:** Phase 2 complete. All npm packages published.

---

## Prompt 3.1 — Astro site scaffold

```
Create Restormel marketing site using Astro + Starlight.

STEPS:

1. Set up apps/site with create-astro, add @astrojs/starlight
2. Create shared styles with --rm-* tokens, Cormorant Garamond + JetBrains Mono
3. Create Marketing layout: nav (logo, Keys, Docs, Pricing, GitHub, Dashboard), footer
4. Create src/pages/index.astro: minimal homepage, "Restormel makes reasoning visible", product family links
5. Configure Starlight for /keys/docs/* with sidebar, dark theme, search
6. Set up Cloudflare Pages deployment

DO NOT: Build Keys landing page yet (3.2). Build dashboard (3.4). Add auth.
```

**Gate:** Homepage and docs shell render. Starlight search works.

---

## Prompt 3.2 — Keys landing page

```

Create restormel.dev/keys landing page following the wireframe in 04-design-and-site.md.

CONTEXT: Framework compatibility is a core product message, not just decoration. The page must clearly communicate that Restormel Keys works where AI builders actually ship: Next.js first, React broadly, SvelteKit natively, and Web Components for everything else.

STEPS:

Create src/pages/keys/index.astro with 9 sections:
S1 Hero:
- "Drop-in BYOK for AI apps."
- subhead should clearly mention shipping key management inside existing apps without heavy infra
- CTAs to docs + GitHub

S2 Two modes:
- builder routing
- end-user BYOK
- clear short copy explaining both

S3 Code example:
- split view server setup + Next.js/React UI
- Shiki highlighting
- code should reinforce the “works in the default AI SaaS stack” story

S4 Framework compatibility:
- logos for Next.js, React, SvelteKit, Vue, Astro
- short copy that makes the compatibility story explicit:
  - Next.js first
  - React-native wrapper
  - SvelteKit native reference stack
  - Web Components for Astro / vanilla / cross-framework embedding
  - Headless core for fully custom UI

S5 Feature grid:
- 6 cards in 3x2 (responsive 2x3 mobile)

S6 Comparison table:
- Keys vs LiteLLM vs Portkey vs Custom

S7 Pricing preview:
- 4 tier cards

S8 Proof point:
- "Extracted from SOPHIA."

S9 Footer CTA:
- "Start in 5 minutes."

Additional requirements:
- dark theme
- plain CSS with design tokens
- mobile responsive
- no decorative framework section with empty logos only; compatibility must be explained in copy
- make Next.js App Router feel like the primary adoption path

DO NOT:
- Use Tailwind
- Import icon libraries
- Add JavaScript interactions
- Present framework compatibility as an afterthought
```

**Gate:** Renders on desktop and mobile. Code examples display.

---

## Prompt 3.3 — Pricing page with Paddle checkout

```
Create Keys pricing page with Paddle Checkout integration.

STEPS:

1. Create src/pages/keys/pricing.astro: full tier comparison, feature grid, annual toggle, FAQ
2. Create client-side paddle-checkout.ts: Paddle.js from CDN, Initialize with client token, eventCallback error handling (copy from SOPHIA's pricing page)
3. "Subscribe" buttons call dashboard /api/billing/checkout, open Paddle overlay
4. Post-checkout: success → /keys/dashboard?billing=success, cancel → stay

DO NOT: Build custom payment forms. Store API keys in static site. Skip legal acceptance.
```

**Gate:** Paddle sandbox checkout opens. Completing redirects to dashboard.

---

## Prompt 3.4 — SvelteKit dashboard scaffold

```
Create Keys dashboard SvelteKit application.

STEPS:

1. Set up apps/dashboard: SvelteKit 2, Svelte 5, adapter-node, firebase, firebase-admin
2. hooks.server.ts: Firebase Auth ID token verification (copy from SOPHIA)
3. Auth routes: login (GitHub sign-in), logout
4. Dashboard shell: dark theme, left sidebar, top bar
5. Routes: /keys/dashboard (overview), /projects (list+create), /projects/[id] (detail), /projects/[id]/usage (placeholder), /billing, /settings
6. API routes: /api/projects (CRUD), /api/projects/[id]/keys (CRUD), /api/health
7. Firestore: projects/{projectId}

DO NOT: Implement billing (3.5). Add Zuplo (3.6). Build usage charts (Phase 4). Use Tailwind.
```

**Gate:** Dashboard runs. Sign in with GitHub. Create project. Generate API key.

---

## Prompt 3.5 — Paddle billing integration

```
Add Paddle billing to Keys dashboard, copied from SOPHIA.

Reference SOPHIA files:
- src/lib/server/billing/paddle.ts
- src/lib/server/billing/webhook.ts
- src/lib/server/billing/store.ts
- src/lib/server/billing/types.ts
- src/lib/server/billing/flags.ts
- src/routes/api/billing/checkout/+server.ts
- src/routes/api/billing/webhook/+server.ts
- src/routes/api/billing/sync/+server.ts

STEPS:

1. Copy billing directory into apps/dashboard/src/lib/server/billing/:
   paddle.ts: KEEP checkout, portal, webhook verify, API helpers. REMOVE topup, founder.
   webhook.ts: KEEP subscription events. REMOVE topup/wallet.
   store.ts: ADAPT paths to projects/{projectId}/billing.
   types.ts: CHANGE BillingTier to free|pro|team|enterprise.
   flags.ts: Copy directly.

2. Create billing API routes: checkout, webhook, sync, entitlements
3. Update dashboard billing page: tier badge, upgrade, manage subscription, refresh
4. Environment variables in .env.example

DO NOT: Rebuild from scratch. Implement topup/wallet. Change webhook verification. Use Stripe.
```

**Gate:** Sandbox checkout completes. Webhook updates Firestore. Dashboard shows tier. Portal opens.

---

## Prompt 3.6 — Zuplo gateway setup

```
Set up Zuplo API gateway for Keys cloud API.

Reference: docs/reference/operations/runbooks/zuplo-phase1-runbook.md in SOPHIA repo.

STEPS:

1. Create Zuplo project: restormel-keys-gateway
2. Configure routes proxying to Cloud Run
3. Inbound policies: api-key-inbound → rate-limit-inbound → quota-inbound → inject-backend-auth
4. Set KEYS_BACKEND_API_KEY env var (sk-rk- key, marked secret)
5. Configure developer portal with OpenAPI spec
6. Create backend API key via dashboard
7. Validation: missing auth → 401, invalid key → 401, valid key → 200, direct backend rejects zpka_ keys

DO NOT: Modify dashboard backend for Zuplo. Give consumer keys direct backend access.
```

**Gate:** External call through Zuplo → Cloud Run works. Developer portal shows docs.

---

## Prompt 3.7 — Documentation content

```
## Prompt 3.7 — Documentation content

Write core documentation using Starlight.

CONTEXT: Documentation must prove that Restormel Keys is genuinely plug-and-play across the stacks that matter most. Next.js App Router should be treated as the flagship integration path.

STEPS:

Create docs pages in apps/site/src/content/docs/keys/:

Core pages:
- getting-started.mdx: install, config, first key, route request, 5-min example
- guides/nextjs.mdx: full App Router integration, treated as the flagship guide
- guides/react.mdx: React wrapper usage, hooks, provider, event handling
- guides/sveltekit.mdx: native Svelte components + server hooks
- guides/web-components.mdx: plain HTML / Astro / universal embedding
- reference/api.mdx: every exported function and type
- reference/config.mdx: keys.config.ts full options
- reference/providers.mdx: per-provider setup + model lists
- reference/cli.mdx: every command
- security.mdx: encryption, HMAC, audit trail
- compatibility.mdx: when to use headless core vs React wrapper vs Web Components vs Svelte components

Requirements for guides:
- Next.js guide must cover:
  - App Router
  - client boundaries
  - next/dynamic with ssr: false where relevant
  - server-side key resolution
  - a copy-paste-ready settings page flow
- React guide must explain the React wrapper as the preferred path for React apps
- Web Components guide must show the universal plug-and-play path for Astro / vanilla / non-native stacks
- Compatibility page must explain package choice by framework and adoption style

All code examples must be copy-paste ready with correct imports.

DO NOT:
- Use placeholder text
- Reference unshipped features
- Include internal-only details
- Claim framework support without showing a real integration path
```

**Gate:** All pages render. Code examples correct. Links work.

---
## Prompt 3.7A — Framework compatibility surfacing
'''

Create framework compatibility surfacing across the docs and site.

STEPS:

1. Add a framework compatibility section to the docs homepage and/or keys docs index
2. Create a concise compatibility table covering:
   - Next.js App Router
   - React (generic)
   - SvelteKit
   - Web Components / Astro / vanilla
   - Vue / Nuxt (planned / secondary, depending current package state)
3. Show install paths for:
   - @restormel/keys
   - @restormel/keys-react
   - @restormel/keys-elements
   - @restormel/keys-svelte
4. Add guidance explaining when to use:
   - headless core
   - React wrapper
   - Web Components
   - Svelte components
5. Add a “Start with Next.js” CTA or highlighted quickstart path
6. Keep the copy calm, practical, and adoption-focused

DO NOT:
- Duplicate large chunks of guide content
- Promise support that is not backed by packages/docs/examples
- Turn this into a generic framework matrix with no guidance
'''
**Gate:** Docs visibly surface compatibility and package choice without needing users to infer it from scattered pages.
---

## Prompt 3.8 — Cloud deployment

```
Deploy dashboard and site to production.

STEPS:

1. Dashboard → Cloud Run: Docker build, push to Artifact Registry, Pulumi up, verify /api/health
2. Configure Paddle webhook URL in Paddle dashboard
3. Site → Cloudflare Pages: connect repo, build, custom domain
4. DNS: point restormel.dev to Cloudflare, route /keys/dashboard/* to Cloud Run
5. Verify: landing page, docs, dashboard, Paddle checkout, Zuplo gateway

DO NOT: Switch Paddle to production. Open public registration.
```

**Gate:** All surfaces accessible. Paddle sandbox works end-to-end.

---

## Prompt 3.9 — PostHog analytics

```
Add PostHog analytics.

STEPS:

1. Create "Restormel Keys" project in existing PostHog account
2. Landing page: page_view, cta_click, pricing_view
3. Dashboard: project_created, api_key_generated, api_key_revoked, checkout_started, checkout_completed, billing_portal_opened
4. Cloud API (server): api_request, key_validated, rate_limit_hit
5. Gate all behind env var

DO NOT: Track PII. Block rendering on PostHog. Add to npm packages.
```

**Gate:** PostHog shows events from landing page and dashboard.

---

## Prompt 3.10 — Docs polish

```
## Prompt 3.10 — Docs polish

Polish documentation site for launch.

STEPS:
1. OpenGraph metadata
2. favicon
3. 404 page
4. Starlight search
5. "Edit on GitHub" links
6. version badge
7. code example verification
8. sitemap.xml
9. Lighthouse audit (>90)
10. mobile check
11. verify that framework compatibility content is visible and easy to find
12. verify that the Next.js quickstart is reachable in one click from docs landing or getting started
13. verify package-choice guidance is consistent across quickstart, compatibility, and framework guides

DO NOT:
- Add new product features
- Hide missing framework guidance behind generic polish work
```

**Gate:** Lighthouse >90. All pages render on mobile.

Before you finish, add a final section titled:

## Manual actions required

This section is mandatory whenever any part of the work requires a human to do something outside the editor, browser, terminal, Git provider, cloud console, payment platform, deployment platform, or third-party dashboard.

Your instructions must be:
- beginner friendly
- step by step
- current and practical
- specific to the work just completed
- written as if the user has never done this before
- explicit about exactly where to go and what to click or run
- explicit about what to copy, save, download, paste, commit, or configure
- explicit about what to do with any code, keys, config values, tokens, URLs, screenshots, or outputs after returning
- explicit about what to ask Cursor to do next once the manual steps are complete

Format the section exactly like this:

## Manual actions required

### 1. What you need to do now
Provide a numbered list of manual steps in exact order.
For each step include:
- where to go
- what to open
- what to click or run
- what value to enter or create
- what to copy back
- anything to avoid doing

### 2. What to bring back into Cursor
List exactly what the user should return with, such as:
- pasted values
- created file contents
- generated credentials or IDs
- URLs
- screenshots
- confirmation that a command succeeded
- confirmation that a service/account/project is ready

If nothing needs to be brought back, say so clearly.

### 3. What to do with any code or files
Explain exactly:
- where any generated code should go
- whether it should be pasted into an existing file or a new file
- whether it should be committed yet
- whether secrets must be stored in env files, secret managers, dashboards, or nowhere yet
- whether any files should be reviewed manually before use

### 4. What to ask Cursor next
Provide a short copy-paste-ready follow-up prompt the user can send after completing the manual steps.
This must be specific to the current phase and the work just completed.

### 5. Safety checks before continuing
List the small number of checks the user should do before moving on.
These must be practical and easy to verify.

Important rules:
- Do not assume the user knows the platform UI.
- Do not say vague things like “set up the account” or “configure the environment”.
- Do not skip steps where the user must leave Cursor.
- Do not bury manual actions in prose earlier in the response.
- If there are no manual actions, still include the section and explicitly say:
  “No manual actions are required for this phase.”
- If instructions may have changed in a third-party UI, say:
  “Menu names may vary slightly, but the flow should be similar.”
- If secrets or tokens are involved, clearly warn:
  - never commit them
  - where to store them safely
  - whether to paste them back into Cursor or not
- If code depends on a manual step, explain exactly what to do after returning before the code is considered complete.

Final requirement:
End every substantial phase response with this manual-actions section before giving the final completion summary.