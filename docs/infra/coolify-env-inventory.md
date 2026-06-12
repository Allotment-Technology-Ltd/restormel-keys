# Coolify environment-variable inventory — restormel-keys dashboard + worker

**For:** product owner performing the Coolify migration (Stage 2)
**Grepped from:** `apps/dashboard/src/**/*.ts`, `apps/dashboard/src/**/*.svelte`,
`apps/dashboard/scripts/`, and cross-referenced with
`docs/infra/coolify-migration-plan-2026-06.md §4.4`.

> **Rule: never paste a value into this file.** This is a names-only reference.
> Values come from `vercel env pull` (or the Vercel dashboard) copied directly
> into Coolify's environment editor. Coolify stores them encrypted at rest;
> access is SSH-tunnel-only (Hetzner Cloud Firewall blocks port 8000).

---

## How to read this table

| Column | Meaning |
|---|---|
| **Name** | Exact env var name — copy-paste into Coolify |
| **Purpose** | One-line description of what the app uses it for |
| **Service** | `dashboard` / `worker` / `both` — which Coolify application needs it |
| **On Vercel?** | Yes = already set in Vercel prod env; copy it. No = must generate or obtain fresh. |
| **Criticality** | `boot-blocking` = app crashes/refuses to start without it. `functional` = feature fails silently or returns errors. `optional` = defaults to a safe value if absent. |
| **Notes** | Anything extra the owner needs to know at setup time |

---

## Group A — Database / Neon

| Name | Purpose | Service | On Vercel? | Criticality | Notes |
|---|---|---|---|---|---|
| `DATABASE_URL` | Neon Postgres connection string (pooled or direct, sslmode=require) | both | Yes | boot-blocking | Staging: use the Forgejo-CI Neon branch URL (not prod). Prod: copy from Vercel. Never share between staging and prod. |
| `NEON_AUTH_BASE_URL` | Neon Auth base URL for sign-in proxy routes — the `/api/auth/*` proxy target | dashboard | Yes | boot-blocking | Returns 503 if unset. Staging: owner must add `https://staging.restormel.dev` as a **trusted origin** in Neon Console (Auth → Trusted Origins) — not yet done; it is the gating step for Stage 2.3. |

---

## Group B — Encryption

| Name | Purpose | Service | On Vercel? | Criticality | Notes |
|---|---|---|---|---|---|
| `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY` | AES-256 key for encrypting stored provider credentials (API keys, Surreal passwords) at rest in Postgres | both | Yes | boot-blocking | 32-byte base64. If absent, Connect credential operations throw and refuse to store or retrieve keys. Do **not** generate a new key — copy the exact value from Vercel; a different key means all stored credentials become unreadable. |

---

## Group C — Auth and OAuth

| Name | Purpose | Service | On Vercel? | Criticality | Notes |
|---|---|---|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth app client ID for sign-in | dashboard | Yes | functional | Without this, Google sign-in button fails; sign-in via GitHub still works. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client secret | dashboard | Yes | functional | Paired with `GOOGLE_OAUTH_CLIENT_ID`. |
| `MS_OAUTH_CLIENT_ID` | Microsoft OAuth client ID | dashboard | Yes | functional | Only needed if Microsoft/Entra sign-in is offered to users. |
| `MS_OAUTH_CLIENT_SECRET` | Microsoft OAuth client secret | dashboard | Yes | functional | Paired with `MS_OAUTH_CLIENT_ID`. |
| `MS_OAUTH_TENANT` | Microsoft tenant ID or `common` | dashboard | Yes | functional | Paired with the MS OAuth credentials. |
| `RESTORMEL_OIDC_CLIENT_ID` | OIDC audience for the portal token endpoint (`/keys/auth/token`) | dashboard | Yes | functional | Used for portal integrations (allotmentology.tech). Missing = portal authentication tokens rejected. |
| `PORTAL_ALLOWED_ORIGINS` | Comma-separated list of extra CORS origins allowed to call portal endpoints | dashboard | Yes | optional | Defaults to empty (only the dashboard origin is allowed). Set for allotmentology.tech if cross-origin portal calls are required. |

---

## Group D — Access control

| Name | Purpose | Service | On Vercel? | Criticality | Notes |
|---|---|---|---|---|---|
| `RESTORMEL_SERVICE_OWNER_EMAILS` | Comma-separated owner emails granted full admin access | both | Yes | boot-blocking | If unset, no user can access the admin console. Copy exactly from Vercel. |
| `RESTORMEL_SERVICE_ADMIN_USER_IDS` | Comma-separated Neon Auth user IDs granted admin role | both | Yes | functional | Supplements owner-email check. Can be empty string if not in use. |

---

## Group E — Billing (Paddle)

> **Flagged:** `PADDLE_API_KEY` and `PADDLE_ENVIRONMENT` have not been confirmed as
> set in Vercel prod. Verify in the Vercel dashboard before cutover.

| Name | Purpose | Service | On Vercel? | Criticality | Notes |
|---|---|---|---|---|---|
| `PADDLE_API_KEY` | Paddle server-side API key for subscription management | dashboard | **Unconfirmed — verify** | functional | Without this, subscription creation/cancellation API calls fail. Paddle Dashboard → Authentication. |
| `PADDLE_SECRET` | Paddle webhook signing secret (HMAC verification) | dashboard | Yes | functional | Used to verify incoming webhook payloads. |
| `PADDLE_WEBHOOK_SECRET` | Second webhook secret (some webhook endpoints use this alias) | dashboard | Yes | functional | Check whether both `PADDLE_SECRET` and `PADDLE_WEBHOOK_SECRET` are in use; set both. |
| `PADDLE_ENVIRONMENT` | `production` or `sandbox` | dashboard | **Unconfirmed — verify** | functional | If unset or wrong, the Paddle SDK sends live charges to sandbox or vice versa — critical to get right at cutover. Set `production` for prod, `sandbox` for staging. |
| `PADDLE_ALLOW_UNSIGNED_WEBHOOKS` | `1` to skip webhook signature check (dev/test only) | dashboard | No (do not set) | optional | Never set in prod. Only set `1` in local dev to replay unsigned webhooks. |
| `PUBLIC_PADDLE_CLIENT_TOKEN` | Paddle.js client-side token for pricing overlays | dashboard | Yes | functional | Browser-visible; safe to expose. Required for checkout to render. |
| `PADDLE_PRICE_KEYS_PRO_MONTHLY` | Paddle price ID for Keys Pro monthly (default/USD) | dashboard | Yes | optional | Defaults baked in code; only override to change the active price ID. |
| `PADDLE_PRICE_KEYS_PRO_MONTHLY_GBP` | Paddle price ID for Keys Pro monthly (GBP) | dashboard | Yes | optional | As above. |
| `PADDLE_PRICE_KEYS_PRO_MONTHLY_USD` | Paddle price ID for Keys Pro monthly (explicit USD) | dashboard | Yes | optional | As above. |
| `PADDLE_PRICE_KEYS_TEAM_MONTHLY_GBP` | Paddle price ID for Keys Team monthly (GBP) | dashboard | Yes | optional | As above. |
| `PADDLE_PRICE_PLATFORM_MONTHLY_GBP` | Paddle price ID for Platform monthly (GBP) | dashboard | Yes | optional | As above. |

---

## Group F — Connect / ingest tunables

> Most of these have safe in-code defaults. Only set them to override.
> `OPENAI_API_KEY` is flagged as unconfirmed but is used by Connect as a fallback
> embedding/LLM provider when the gateway key is unavailable.

| Name | Purpose | Service | On Vercel? | Criticality | Notes |
|---|---|---|---|---|---|
| `CRON_SECRET` | Bearer token that gates the manual drain endpoint (`/keys/dashboard/api/connect/ingest/drain`) | both | Yes | functional | **Generate a fresh one for Coolify** — do not reuse the Vercel value (rotation is recommended at cutover; the migration plan says so explicitly). Use `openssl rand -base64 32`. The worker's scheduled-task backstop must present this token. |
| `CONNECT_INGEST_WORKER_MODE` | `full` or `stub` — whether the worker actually calls LLMs or stubs | worker | Yes | functional | Defaults to `full` when a graph store is connected. Leave unset to use the default. Only set `stub` for isolated testing. |
| `CONNECT_INGEST_WORKER_MAX_JOBS` | Max jobs to claim per drain call (worker) | worker | No | optional | Default: 25. Raise for high-throughput staging testing. |
| `CONNECT_INGEST_MAX_CHUNKS` | Max chunks per ingest job (cost guard) | worker | No | optional | Caps LLM fan-out. Default baked in code. Raise only if you want to allow larger source documents. |
| `CONNECT_INGEST_LEASE_MS` | How long a job lease lasts before it can be reclaimed | worker | No | optional | Default in code. Only change if jobs consistently time out before finishing. |
| `CONNECT_INGEST_WORKER_HEARTBEAT_MS` | Interval at which the worker renews its lease heartbeat | worker | No | optional | Default in code. Keep well below `CONNECT_INGEST_LEASE_MS`. |
| `CONNECT_INGEST_STUB_PAUSE_MS` | Artificial delay in stub mode | worker | No | optional | Only relevant when `CONNECT_INGEST_WORKER_MODE=stub`. |
| `CONNECT_LLM_TIMEOUT_MS` | Timeout for LLM API calls in the ingest pipeline | worker | No | optional | Default in code. Raise if provider latency is high. |
| `CONNECT_EMBED_TIMEOUT_MS` | Timeout for embedding API calls | worker | No | optional | Default in code. |
| `CONNECT_ROUTE_RETRY_DEADLINE_MS` | How long to retry a failing LLM route before giving up | worker | No | optional | Default in code. |
| `CONNECT_MEMORY_RATE_LIMIT` | Max memory-write operations per window (per process) | both | No | optional | Default in code. The limit is per-process and is more meaningful on a long-lived single instance (Coolify) than on Vercel. |
| `CONNECT_MEMORY_RATE_WINDOW_MS` | Window size for the memory-write rate limiter | both | No | optional | Default in code. |
| `CONNECT_LEGACY_VALIDATION` | `1` to enable legacy validation paths | both | No | optional | Leave unset in production. |
| `CONNECT_RUNTIME_DDL` | `1` to run schema-ensure DDL at runtime; `0` to skip (default in production when `NODE_ENV=production`) | both | No | optional | Leave unset — production defaults to `0` automatically via `NODE_ENV=production`. Only set `1` after a migration that adds new tables and before the normal migration runner runs. |
| `CONNECT_STATS_TTL_MS` | Cache TTL for graph statistics queries (alias: `RESTORMEL_GRAPH_STATS_CACHE_TTL_MS`) | both | No | optional | Default in code. |
| `CONNECT_PACK_PROBE_NEG_TTL_MS` | Negative TTL for pack probe cache (how long a miss is cached) | both | No | optional | Default 2 minutes in code. |
| `RESTORMEL_CONNECT_EMBED_MODEL` | Embedding model ID used by Connect | worker | Yes | functional | Required if the default model is not the intended one. Copy from Vercel. |
| `RESTORMEL_CONNECT_DESIGNER_MODEL` | LLM model ID used for design/planning steps in Connect | worker | Yes | functional | Copy from Vercel. |
| `RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT` | `1` to allow private-network SurrealDB endpoints (for self-hosted graphs) | both | Yes | optional | Enables BYO self-hosted SurrealDB. Match Vercel prod value. |
| `RESTORMEL_SURREAL_HTTP_TIMEOUT_MS` | HTTP timeout for SurrealDB calls | both | No | optional | Default in code. |
| `OPENAI_API_KEY` | OpenAI API key — used as a fallback LLM/embedding provider by Connect | worker | **Unconfirmed — verify** | functional | Used when the gateway key does not cover a particular model. If not set, those model routes fall back gracefully. Check the Vercel env. |
| `TOGETHER_API_KEY` (via gateway) | Together AI is accessed via the Restormel gateway, not a raw key here; no direct `TOGETHER_API_KEY` env var in dashboard src. Gateway key `RESTORMEL_GATEWAY_KEY` covers it. | — | — | — | No direct env var needed; Together calls route through the gateway. |
| `UNSTRUCTURED_API_KEY` | Unstructured.io API key for document parsing | worker | Yes | optional | Only needed if Unstructured parsing is used. Missing = Unstructured parser unavailable; LlamaParse or native parser used instead. |
| `LLAMAPARSE_API_KEY` | LlamaIndex LlamaParse API key for document parsing | worker | Yes | optional | Missing = LlamaParse parser unavailable; falls back gracefully. |

---

## Group G — New vars required for Coolify (not on Vercel)

> These are **new** — you need to set them yourself; they do not exist in Vercel.

| Name | Value to set | Service | Criticality | Notes |
|---|---|---|---|---|
| `DEPLOY_TARGET` | `node` | both | boot-blocking | Switches `svelte.config.js` from adapter-vercel to adapter-node. Without this the build produces Vercel edge-function output that cannot run as a plain Node process. |
| `CONNECT_INGEST_INLINE_DRAIN` | `0` | dashboard only | functional | Gates the post-POST inline drain on the dashboard process. Set `0` so the dashboard does **not** try to run ingest on its own event loop — the worker owns that. Default is `1` (enabled), which would recreate F9 on the box. |
| `CONNECT_INGEST_WORKER_INTERVAL_MS` | `5000` (recommended) | worker only | optional | Polling interval between drain calls in the daemon. Default 5000ms with jitter. Raise to reduce DB polling if ingest traffic is low. |
| `ORIGIN` | `https://staging.restormel.dev` (staging) or `https://restormel.dev` (prod) | dashboard | boot-blocking | Required by adapter-node for correct form-action and origin handling. Must match the serving domain exactly. |
| `HOST` | `0.0.0.0` | dashboard | boot-blocking | Makes the Node HTTP server bind to all interfaces (not just localhost) so Traefik can reach it inside the Docker network. |
| `PORT` | `8080` | dashboard | boot-blocking | Already set in `Dockerfile.dashboard`; confirm it is not overridden in Coolify to something else. |
| `BODY_SIZE_LIMIT` | e.g. `10mb` | dashboard | functional | Adapter-node default is 512kb. Connect ingest POSTs carry source document payloads that can exceed that. Set to a value that covers your largest expected source files. |
| `NODE_ENV` | `production` | both | functional | The Dockerfile serve stage should set this. Confirm it is visible at runtime — it disables `CONNECT_RUNTIME_DDL` automatically and suppresses dev-only tooling. |

---

## Group H — Self-consumption / dogfood (gateway)

| Name | Purpose | Service | On Vercel? | Criticality | Notes |
|---|---|---|---|---|---|
| `RESTORMEL_GATEWAY_KEY` | API key for the dashboard's own calls to the Restormel gateway | both | Yes | functional | Used for provider calls that go via the gateway (Together AI, etc.). Copy from Vercel. |
| `RESTORMEL_PROJECT_ID` | Dogfood Restormel project ID | both | Yes | optional | Self-consumption context. Copy from Vercel. |
| `RESTORMEL_ENVIRONMENT_ID` | Dogfood environment ID | both | Yes | optional | Copy from Vercel. |
| `RESTORMEL_WORKSPACE_ID` | Dogfood workspace ID | both | Yes | optional | Copy from Vercel. |
| `RESTORMEL_BASE_URL` | Base URL for the Restormel API (used by the dashboard as a consumer) | both | Yes | optional | Typically `https://restormel.dev` in prod. Copy from Vercel. |
| `RESTORMEL_KEYS_BASE` | Base URL for the Keys API | both | Yes | optional | Copy from Vercel. |

---

## Group I — Product feature flags

| Name | Purpose | Service | On Vercel? | Criticality | Notes |
|---|---|---|---|---|---|
| `RESTORMEL_MODULE_FLAGS` | JSON or comma-separated module enable/disable flags | both | Yes | functional | Controls which product modules are visible. Copy exactly from Vercel; mismatch causes feature discrepancies. |
| `RESTORMEL_PRO_FEATURES` | JSON or comma-separated Pro feature flags | both | Yes | functional | Copy from Vercel. |
| `RESTORMEL_PRO_DEV_DEFAULT` | `1` to treat all dev sessions as Pro | both | No | optional | Set `1` on staging if you want to test Pro features without a billing setup. Never set in prod. |
| `RESTORMEL_SUPPORT_ENABLED` | `1` to enable the support chat widget | dashboard | Yes | optional | Copy from Vercel. |
| `RESTORMEL_SUPPORT_MODEL` | LLM model ID for the support agent | dashboard | Yes | optional | Copy from Vercel if support is enabled. |
| `RESTORMEL_ROLLOUT_PERCENT` | Integer 0–100 for phased feature rollout | both | Yes | optional | Copy from Vercel. |
| `RESTORMEL_DASHBOARD_UI_HIDDEN` | `1` to hide the dashboard from public users | dashboard | Yes | optional | Copy from Vercel; match prod value exactly. |
| `DEFAULT_AI_PROVIDER` | Default AI provider for new sessions | both | Yes | optional | Copy from Vercel. |
| `USE_RESTORMEL_KEYS` | `1` to enable Restormel Keys integration paths | both | Yes | optional | Copy from Vercel. |

---

## Group J — Telemetry and feedback

| Name | Purpose | Service | On Vercel? | Criticality | Notes |
|---|---|---|---|---|---|
| `PUBLIC_POSTHOG_KEY` | PostHog project API key (browser-visible) | dashboard | Yes | optional | Without this, product analytics events are not captured. Copy from Vercel. |
| `PUBLIC_POSTHOG_HOST` | PostHog ingest host (browser-visible; default `https://app.posthog.com`) | dashboard | Yes | optional | Copy from Vercel. |
| `POSTHOG_API_KEY` | PostHog server-side key (for server-sent events / flags) | both | Yes | optional | Copy from Vercel. |
| `POSTHOG_HOST` | PostHog ingest host (server-side) | both | Yes | optional | Copy from Vercel. |
| `POSTHOG_PROJECT_ID` | PostHog project ID | both | Yes | optional | Used by the embed dashboard feature. |
| `POSTHOG_PERSONAL_API_KEY` | PostHog personal API key for dashboard embed URL generation | dashboard | Yes | optional | Only needed if the ingest-quality PostHog embed is used. |
| `POSTHOG_INGEST_QUALITY_DASHBOARD_EMBED_URL` | Pre-minted PostHog embed URL (overrides API-based generation) | dashboard | Yes | optional | Set this to skip the API-based URL generation. |
| `FEEDBACK_GITHUB_TOKEN` | GitHub PAT for writing feedback as GitHub Issues | dashboard | Yes | optional | Without this, the in-app feedback button fails to create issues. Copy from Vercel. |
| `FEEDBACK_GITHUB_REPO` | `owner/repo` for feedback issues | dashboard | Yes | optional | Default `Allotment-Technology-Ltd/restormel-keys`. Copy from Vercel. |
| `GITHUB_TOKEN` | GitHub token for other GitHub API calls (npm insights etc.) | dashboard | Yes | optional | Copy from Vercel. |
| `LIBRARIES_IO_API_KEY` | Libraries.io API key for npm dependent-package stats | dashboard | Yes | optional | Without it the npm insights page falls back to unauthenticated rate limits (429 risk). |
| `RESTORMEL_NPM_INSIGHTS_PACKAGE` | npm package name override for the registry admin page | dashboard | No | optional | Defaults to the canonical Keys package name. Only set to override. |
| `RESTORMEL_NPM_INSIGHTS_GITHUB_REPO` | GitHub repo override for npm insights | dashboard | No | optional | Defaults to a constant in the code. |
| `RESTORMEL_DASHBOARD_VERSION` | Override the build version string shown in the dashboard | dashboard | No | optional | Normally set by CI from the git SHA. Leave unset and let the CI workflow stamp it. |
| `RESTORMEL_DOCS_AGENT_PROMPTS` | JSON config for the docs agent | dashboard | Yes | optional | Copy from Vercel if the docs search agent is in use. |
| `DASHBOARD_PERF_LOG` | `1` to emit server timing spans to stdout | both | No | optional | Set `1` for one week post-cutover to record before/after TTFB measurements (migration plan §2.6 requirement). Remove afterwards. |

---

## Group K — Marketing / founders page

| Name | Purpose | Service | On Vercel? | Criticality | Notes |
|---|---|---|---|---|---|
| `FOUNDERS_CIRCLE_SLOTS_TOTAL` | Total founding slots (integer, default 50) | dashboard | Yes | optional | Copy from Vercel if the founders page is live. |
| `FOUNDERS_SLOTS_REMAINING_DISPLAY` | Override for the displayed remaining slots count | dashboard | Yes | optional | Copy from Vercel. |
| `FOUNDERS_APPLICATION_WEBHOOK_URL` | Webhook URL to notify on founders application submission | dashboard | Yes | optional | Copy from Vercel. |
| `FOUNDING_PROMO_MAX_USERS` | Max users for the founding promo (default 50) | dashboard | Yes | optional | Copy from Vercel. |
| `FOUNDING_PROMO_MONTHS` | Duration of founding promo in months (default 12) | dashboard | Yes | optional | Copy from Vercel. |

---

## Group L — Public / browser-side vars

These must be prefixed `PUBLIC_` in SvelteKit to be available in the browser bundle.

| Name | Purpose | Service | On Vercel? | Criticality | Notes |
|---|---|---|---|---|---|
| `PUBLIC_GITHUB_REPO_URL` | Public GitHub repo URL shown in the UI | dashboard | Yes | optional | Copy from Vercel. |
| `PUBLIC_KEYS_DEVELOPER_PORTAL_URL` | URL to the developer portal (allotmentology.tech) | dashboard | Yes | optional | Copy from Vercel. |
| `PUBLIC_RESTORMEL_SUPPORT_UI` | URL/config for support UI | dashboard | Yes | optional | Copy from Vercel. |
| `PUBLIC_SUITE_TESTING_URL` | URL of the testing suite (for cross-links) | dashboard | Yes | optional | Copy from Vercel. |

---

## Group M — Vars to DROP on Coolify

| Name | Why to drop it |
|---|---|
| `VERCEL_ENV` | Vercel-injected at build time. Two source files check it alongside `NODE_ENV`; with `NODE_ENV=production` set on the Coolify image, the `VERCEL_ENV` check is redundant. Do **not** spoof `VERCEL_ENV=production` on Coolify — this would confuse the adapter guard. The migration plan §4.1 requires auditing these three call sites in Stage 2.1. |

---

## Quick-reference: boot-blockers checklist

The following must be set before the first deploy attempt or the app will not start / will immediately 503:

- [ ] `DATABASE_URL`
- [ ] `NEON_AUTH_BASE_URL`
- [ ] `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY`
- [ ] `RESTORMEL_SERVICE_OWNER_EMAILS`
- [ ] `DEPLOY_TARGET=node`
- [ ] `ORIGIN` (matching the Coolify domain)
- [ ] `HOST=0.0.0.0`
- [ ] `PORT=8080` (or whatever Coolify maps)
- [ ] `NODE_ENV=production`

---

## Vars that need attention before cutover (flagged items)

| Var | Status | Action |
|---|---|---|
| `PADDLE_API_KEY` | Not confirmed present in Vercel prod env | Check Vercel dashboard → Settings → Environment Variables; if absent, add from Paddle Dashboard → Authentication before or at cutover |
| `PADDLE_ENVIRONMENT` | Not confirmed | Verify it is set to `production` on Vercel; copy; set `sandbox` on staging |
| `OPENAI_API_KEY` | Not confirmed | Check Vercel; set on worker if any Connect routes fall back to OpenAI |
| `CRON_SECRET` | Must be rotated | Generate a new value with `openssl rand -base64 32`; set in Coolify; update any external callers of the drain endpoint |
| `NEON_AUTH_BASE_URL` (staging) | Not yet proven | Add `https://staging.restormel.dev` to Neon Auth trusted origins before the Stage 2.3 sign-in test |
