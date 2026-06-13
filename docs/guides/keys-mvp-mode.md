# Keys MVP mode

Restormel **Keys + Connect** production defaults hide non-core suite modules behind PostHog feature flags. Code stays in the monorepo; surfaces are **gated**, not deleted.

## What users see (MVP defaults)

- **Keys dashboard:** direct provider vault (OpenAI, Anthropic, Google), catalog model pick, linear routes **per project**, resolve without environment setup.
- **Connect:** ingest/retrieve/verify when `restormel-module-connect` is on; graph store via **BYO SurrealDB** (host Neon one-click off unless `restormel-module-connect-neon-graph-store` is on).
- **Hidden by default:** Testing marketing/hub, Graph suite pillar, gateway “Connect a Provider”, Guard Rails / policies, dev/prod environments, model pools, hosted runtime invoke, external catalog automation.

## Operator configuration

| Layer | Use when |
|-------|----------|
| **PostHog** (canonical prod) | Toggle rollouts, cohorts, dogfood |
| **`RESTORMEL_MODULE_FLAGS`** | Local dev, CI, emergency bypass without PostHog |
| **`RESTORMEL_DASHBOARD_UI_HIDDEN`** | Extra nav hiding (legacy); prefer module flags |

Flag registry: [keys-mvp-module-flags.md](./keys-mvp-module-flags.md).

## Re-enable for dogfood / SOPHIA

In PostHog (or env override on a preview deployment):

- `restormel-module-testing` → 100% for CI resolve and Testing hub
- `restormel-module-environments` → 100% while consumers still send `environmentId`
- `restormel-module-graph` → `preview` for docs-only Graph pillar

## API behaviour when disabled

- REST: `404` + `{ error: "module_disabled", module: "…" }` (or redirect for HTML routes)
- Hosted runtime: `501` when `hostedRuntime` off
- Resolve: `environmentId` optional when `environments` off (uses project default environment)

## Touchpoint matrix

See [ROADMAP.md](../../ROADMAP.md#keys-mvp-touchpoint-matrix) for marketing / dashboard / API / MCP / docs / CI mapping.

## Verification

```bash
RESTORMEL_MODULE_FLAGS=connect pnpm --filter dashboard run test
node scripts/check-mvp-doc-links.mjs
```

Graph product decision: [GRAPH-MVP-PRODUCT-MEMO.md](../product/GRAPH-MVP-PRODUCT-MEMO.md).

Public npm guidance: [npm-packages.md](../reference/npm-packages.md) — deprecated packages (`@restormel/keys`, `keys-svelte`, `keys-react`, `ui-graph-svelte`) and non-MVP Testing packages are not promoted on default surfaces.
