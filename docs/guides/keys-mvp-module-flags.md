# Keys MVP module flags

Canonical registry for **PostHog `restormel-module-*` flags** and the **`RESTORMEL_MODULE_FLAGS`** env override used by the dashboard and MCP stdio server.

## PostHog flags (EU project 123553)

| Flag key | Module id | MVP default | Surfaces |
|----------|-----------|-------------|----------|
| `restormel-module-connect` | `connect` | **ON** | Connect marketing, dashboard hub, `/connect/v1/*`, MCP `connect.*` |
| `restormel-module-testing` | `testing` | OFF | `/testing`, Testing hub, `copy-for-ci`, `/v1/testing/*`, MCP `testing.*` |
| `restormel-module-graph` | `graph` | **disabled** (multivariate) | Suite nav; variants: `disabled` \| `preview` \| `enabled` |
| `restormel-module-gateway-providers` | `gatewayProviders` | OFF | OpenRouter / Portkey / Vercel connect UI + docs |
| `restormel-module-guardrails` | `guardrails` | OFF | Policies nav, route guard rails, resolve policy eval |
| `restormel-module-environments` | `environments` | OFF | Dev/prod UX; when off → project-only resolve |
| `restormel-module-model-pools` | `modelPools` | OFF | Model pools + parallel route UI |
| `restormel-module-hosted-runtime` | `hostedRuntime` | OFF | `POST …/runtime/invoke` |
| `restormel-module-catalog-external-signals` | `catalogExternalSignals` | OFF | External catalog signals + weekly sync workflow |
| `restormel-module-connect-neon-graph-store` | `connectNeonGraphStore` | OFF | One-click graph store reusing host `DATABASE_URL` (Postgres spine). MVP expects BYO Surreal; future 1-click Neon should link the operator's own Neon account. |
| `restormel-module-monitor` | `monitor` | OFF | Usage, Logs, Health dashboard pages. When off, Monitor nav shows **coming soon** and fires `dashboard_feature_interest` events. |

**Keys** has no flag (always on). **`landing-variant`** is separate (marketing A/B).

Bootstrap: `POSTHOG_API_KEY=… POSTHOG_PROJECT_ID=123553 node scripts/setup-posthog-restormel-keys.mjs --apply`

## Evaluation order

1. **`RESTORMEL_MODULE_FLAGS`** env override — when set, **skips PostHog** for that process.
2. **PostHog server `/decide`** — cached 60s in `hooks.server.ts` (`event.locals.moduleFlags`).
3. **MVP defaults** — Connect on; everything else off; graph `disabled`.

## Env override tokens

Comma-separated (case-insensitive):

```
connect, testing, graph:preview, graph:enabled, graph:disabled,
gateway_providers, guardrails, environments, model_pools,
hosted_runtime, catalog_external_signals, connect_neon_graph_store, monitor
```

Examples:

```bash
# Force MVP locally
RESTORMEL_MODULE_FLAGS=connect

# Dogfood Testing + environments for SOPHIA
RESTORMEL_MODULE_FLAGS=connect,testing,environments,graph:preview

# Enable Monitor (Usage, Logs, Health) for internal dogfood
RESTORMEL_MODULE_FLAGS=connect,monitor
```

## Monitor interest analytics (coming soon)

When `monitor` is **off**, the dashboard keeps the **Monitor** sidebar group visible with a coming-soon panel. PostHog event **`dashboard_feature_interest`** captures demand (fake-door pattern):

| Property | Values |
|----------|--------|
| `feature` | `monitor` |
| `action` | `section_expand` · `item_click` · `direct_navigation` · `notify_feedback` |
| `item` | `usage` · `logs` · `health` (optional) |

**Roadmap signals:** unique users with any `dashboard_feature_interest` where `feature=monitor`; breakdown `item` for Usage vs Logs vs Health priority; funnel `section_expand` → `item_click` → `notify_feedback`.

**PostHog (EU project 123553):**

- Feature flag: [restormel-module-monitor](/feature_flags/198750) — **0% rollout** (coming soon for all users)
- Demand dashboard: [Monitor — coming soon demand](/dashboard/723590) — unique users, item breakdown, intent funnel

## Code references

- Types + defaults: `apps/dashboard/src/lib/module-flags-types.ts`
- Server resolver: `apps/dashboard/src/lib/server/module-flags.ts`
- Route redirects: `apps/dashboard/src/lib/server/module-gates.ts`
- Client helpers: `apps/dashboard/src/lib/posthog.ts`
- MCP stdio: `packages/mcp/src/module-flags-env.ts`

Operator overview: [keys-mvp-mode.md](./keys-mvp-mode.md).
