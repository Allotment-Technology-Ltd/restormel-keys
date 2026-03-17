# ARCHIVED (2026-03-17): Restormel Keys — Infrastructure and Billing (legacy)

This document is archived for traceability. It includes legacy assumptions (GCP/Firebase/Firestore-first, etc.) and is not the canonical current architecture.

For current truth, see:
- `STATUS.md`
- `ARCHITECTURE.md`
- `docs/reference/extraction-vercel.md` (deployment reality and decommissioning path)
- `apps/dashboard/README.md` (current app routes and env)

---

# Restormel Keys — Infrastructure and Billing

---

## 1. Repository strategy

### Decision: separate repo

`Allotment-Technology-Ltd/restormel-keys`, not inside the SOPHIA monorepo. Independent release cadence, clean dependency boundary, open-source credibility, npm publishing simplicity, contributor friendliness.

### Repo structure

```
Allotment-Technology-Ltd/restormel-keys
├── packages/
│   ├── core/                  # @restormel/keys
│   ├── svelte/                # @restormel/keys-svelte
│   ├── elements/              # @restormel/keys-elements
│   ├── react/                 # @restormel/keys-react
│   └── cli/                   # @restormel/keys-cli
├── apps/
│   ├── dashboard/             # Single SvelteKit app: Keys landing, docs/walkthrough (with optional agent prompts), dashboard (Neon Auth/Postgres)
│   ├── site/                  # Archived (Astro/Starlight); all surfaces now in apps/dashboard
│   ├── demo-next/             # Next.js App Router demo
│   └── demo-svelte/           # SvelteKit demo
├── examples/
│   ├── next-app-router/
│   ├── sveltekit/
│   └── express/
├── infra/                     # Pulumi (copied from SOPHIA, simplified)
├── .github/workflows/         # CI/CD (copied from SOPHIA, adapted)
├── pnpm-workspace.yaml
├── LICENSE                    # MIT
└── README.md
```

---

## 2. GCP infrastructure — lift from SOPHIA

| Component | SOPHIA | Keys | Notes |
|-----------|--------|------|-------|
| Cloud Run (app) | Yes | Yes | Dashboard + API + webhooks |
| Cloud Run (ingestion) | Yes | **No** | Keys has no ingestion pipeline |
| SurrealDB (GCE VM) | Yes | **No** | Keys uses Firestore only |
| Firestore | Yes | Yes | Project data, subscriptions, usage, API keys |
| Firebase Auth | Yes | Yes | Same Firebase project. GitHub sign-in. |
| VPC connector | Yes | **No** | No private network needed |
| Load balancer + SSL | Yes | Yes | For restormel.dev domain |
| Artifact Registry | Yes | Yes | Same registry, different image name |
| Secret Manager | Yes | Yes | Paddle keys, Firebase config, API key hash secret |
| Workload Identity Federation | Yes | Yes | Same WIF provider, new service account |

Keys infrastructure is a strict subset of SOPHIA's. No SurrealDB, no VPC, no ingestion jobs.

### Pulumi stack

New stack `restormel-keys` — simplified copy of SOPHIA's `infra/index.ts`. Resources: service account, Artifact Registry, Cloud Run service (dashboard, europe-west2), load balancer + Google-managed SSL, Secret Manager secrets. Remove: VPC connector, SurrealDB VM, ingestion job.

### CI/CD pipeline

Copy SOPHIA's `.github/workflows/deploy.yml`. Replace service names (`sophia` → `keys-dashboard`), image names, path filters. Remove SurrealDB and ingestion references. Keep: TruffleHog, pnpm audit, type check, CodeQL, Docker build, Cloud Run deploy, Pulumi preview/up with WIF auth.

---

## 3. Paddle billing — lift from SOPHIA

### SOPHIA's Paddle implementation (exact files)

**Server-side billing core:**

| File | Purpose | Keys adaptation |
|------|---------|----------------|
| `src/lib/server/billing/paddle.ts` | `paddlePost()`, `paddleGet()`, `createSubscriptionCheckout()`, `createTopupCheckout()`, `createCustomerPortalSession()`, `listRecentTransactions()`, `verifyPaddleWebhookSignature()`, `parsePaddleWebhook()`. Runtime env resolution for sandbox/production. | Keep subscription checkout, portal, webhook verification, API helpers. Remove top-up checkout, founder-offer logic. |
| `src/lib/server/billing/webhook.ts` | `handlePaddleWebhookEvent()`. Routes `subscription.*` to `upsertBillingProfile()`. Routes `transaction.completed` to wallet credit. `normalizeTier()`, `extractUid()`, `findUidForCustomer()`. | Keep subscription lifecycle. Remove top-up/wallet credit. |
| `src/lib/server/billing/store.ts` | Firestore billing profile CRUD. `ensureBillingState()`, `upsertBillingProfile()`. | Adapt: `projects/{projectId}/subscription` instead of `users/{uid}/billing`. |
| `src/lib/server/billing/types.ts` | `BillingTier`, `CurrencyCode`, `BillingProfile`, normalisation helpers. | Adapt BillingTier to `free | pro | team | enterprise`. |
| `src/lib/server/billing/flags.ts` | `BILLING_FEATURE_ENABLED` feature flag. | Copy directly. |

**API routes:**

| Route | Keys adaptation |
|-------|----------------|
| `src/routes/api/billing/checkout/+server.ts` | Simplify: remove founder-offer checks. |
| `src/routes/api/billing/webhook/+server.ts` | Copy directly. |
| `src/routes/api/billing/sync/+server.ts` | Copy for webhook recovery. |

**Client-side:**

| File | Keys adaptation |
|------|----------------|
| `src/routes/pricing/+page.svelte` | Copy Paddle.js init + checkout-open pattern. Rebuild UI for Keys tiers. |
| `src/lib/components/panel/SettingsTab.svelte` | Copy portal-opening pattern for dashboard billing section. |

**What Keys does NOT need:** Top-up/wallet credit system, BYOK handling fee debit, founder offers, ingestion entitlements, source visibility billing.

### Paddle product setup

Create in existing Paddle seller dashboard:

| Product | Type | Amount |
|---------|------|--------|
| Restormel Keys Pro (monthly) | Recurring | £19/mo |
| Restormel Keys Pro (annual) | Recurring | £192/yr |
| Restormel Keys Team (monthly) | Recurring | £49/mo |
| Restormel Keys Team (annual) | Recurring | £468/yr |
| Restormel Keys Enterprise (monthly) | Recurring | £149/mo |

Free tier has no Paddle product — handled in app logic. Each product needs GBP and USD price variants.

### Environment variables

```env
PADDLE_API_KEY=pdl_live_...
PADDLE_WEBHOOK_SECRET=pdl_ntfset_...
PADDLE_ENVIRONMENT=sandbox
PADDLE_CLIENT_TOKEN=...
PADDLE_ALLOW_UNSIGNED_WEBHOOKS=false
PADDLE_PRICE_KEYS_PRO_GBP=pri_...
PADDLE_PRICE_KEYS_PRO_USD=pri_...
PADDLE_PRICE_KEYS_TEAM_GBP=pri_...
PADDLE_PRICE_KEYS_TEAM_USD=pri_...
PADDLE_PRICE_KEYS_ENTERPRISE_GBP=pri_...
PADDLE_PRICE_KEYS_ENTERPRISE_USD=pri_...
PUBLIC_APP_URL=https://restormel.dev/keys
API_KEY_HASH_SECRET=...
```

---

## 4. Zuplo API gateway — lift from SOPHIA

SOPHIA has a partially-implemented Zuplo gateway (`sophia-api-gateway` project) with: API key validation, rate limiting, quota enforcement, upstream auth injection, developer portal, PostHog analytics, and a Phase 1 runbook.

### What Keys reuses

| SOPHIA pattern | Keys adaptation |
|----------------|-----------------|
| Gateway project: `sophia-api-gateway` | New: `restormel-keys-gateway` |
| Backend key prefix: `sk-sophia-` | New: `sk-rk-` |
| Policy chain: `api-key-inbound` → `rate-limit-inbound` → `quota-inbound` → `inject-backend-auth` | Same chain |
| Developer portal: verification API docs | Keys cloud API docs |
| PostHog instrumentation | Same patterns, Keys event names |

---

## 5. Extraction plan from SOPHIA

1. Create repo with pnpm workspace, packages structure, CI/CD, Pulumi.
2. Copy billing directory. Strip top-up/wallet/founder logic. Adapt types and Firestore paths.
3. Copy API key management (HMAC hash + Firestore CRUD). Adapt into framework-agnostic middleware.
4. Copy Zuplo runbook. Adapt for Keys gateway.
5. Copy CI/CD and infra. Remove SurrealDB/VPC/ingestion.
6. Extract core logic (routing, cost, entitlements) into `packages/core/`.
7. Wire SOPHIA to consume `@restormel/keys` as published dependency.

