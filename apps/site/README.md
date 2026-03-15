# Restormel site (marketing + docs)

Astro + Starlight site for **restormel.dev** (Phase 3.1). Marketing layout (nav, footer), homepage, Starlight docs at `/keys/docs/*`, --rm-* tokens, Cormorant Garamond + JetBrains Mono.

## Commands

- `pnpm dev` — dev server
- `pnpm build` — static build to `dist/`
- `pnpm preview` — preview production build

## Content

- **/** — Homepage: “Restormel makes reasoning visible”, product family links (Keys).
- **/keys** — Keys landing (3.2). **/keys/pricing** — Pricing tiers, annual toggle, FAQ, Paddle checkout (3.3).
- **/keys/docs/** — Starlight docs (sidebar, dark theme, search). Placeholder pages for gate.

## Pricing (Paddle)

Subscribe buttons call the dashboard `/api/billing/checkout` and open the Paddle overlay. On success, the user is redirected to `/keys/dashboard?billing=success`; on cancel they stay on the pricing page.

Optional build-time env (no secrets committed; set in CI/deploy):

- `PUBLIC_PADDLE_CLIENT_TOKEN` — Paddle client-side token (sandbox: `test_...`, production: `live_...`). Required for checkout to open.
- `PUBLIC_KEYS_DASHBOARD_URL` — Base URL of the dashboard (e.g. `https://restormel.dev` when dashboard is proxied at `/keys/dashboard`). If set, Subscribe POSTs to `{url}/api/billing/checkout` and opens overlay with returned `transactionId`.
- `PUBLIC_PADDLE_SANDBOX_PRICE_ID` — Optional sandbox price ID; when dashboard URL is unset, Subscribe opens Paddle with this price so sandbox checkout can be tested without the dashboard.

## Cloudflare Pages deployment

1. From this directory: `pnpm build` then `npx wrangler pages deploy dist --project-name=restormel-site`.
2. Or connect the repo in Cloudflare dashboard: set build command to `pnpm build`, root to `apps/site`, output directory to `dist`. See `wrangler.toml` for config.
