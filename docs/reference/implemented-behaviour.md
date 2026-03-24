# Implemented behaviour (dashboard and product)

**Status:** Reference. Describes what is actually implemented so docs and runbooks do not contradict the product. Update when behaviour or terminology changes.

**Canonical terminology:** [docs/ux-contracts.md](../ux-contracts.md) (copy registry). **Dashboard routes:** [apps/dashboard/README.md](../../apps/dashboard/README.md) and [apps/dashboard/src/lib/nav-config.ts](../../apps/dashboard/src/lib/nav-config.ts).

---

## Terminology (live in UI and docs)

| Concept | Term used | Notes |
|--------|-----------|--------|
| Credential for app → Restormel | **Gateway Key** | Created under Access; format `rk_...`. Do not use "API key" for this in user-facing copy. |
| Credential for Restormel → provider | **Provider credential** | Stored in Provider Integrations. Optional; user can use Gateway Key only or both. |
| Account boundary | **Workspace** | One default per user; created on first sign-in. |
| App/product boundary | **Project** | Contains Gateway keys, routes, usage. |
| Dev/staging/prod | **Environment** | Per project. |
| Upstream connection | **Provider integration** | OpenAI, Anthropic, Google, etc.; managed under Provider Integrations. |
| Model selection and fallbacks | **Route** | Per project/environment; default model, steps, billing mode. |
| Catalog | **Models** | Canonical models and provider variants; lifecycle, deprecation, replacement. |
| Summaries | **Analytics** | Request count, latency, error rate, provider/model/route mix, spend placeholder. |
| Request-level data | **Logs & Traces** | Request logs; filter by project/route. |

---

## What is implemented (dashboard)

- **Auth:** Sign in with GitHub (Neon Auth). Workspace created on first use.
- **Projects:** List, create, detail. Environments per project.
- **Access:** List/create/revoke Gateway Keys across projects (key prefix only in UI; raw key shown once on create).
- **Provider Integrations:** List, create, connect providers; bindings to projects/environments; verification.
- **Models:** Catalog (list, detail, lifecycle badges, source verification, migration section); seed/ingestion via `pnpm run seed:catalog`.
- **Routes:** List routes; project → routes → route detail (steps, default model, lifecycle warnings for deprecated/retiring models).
- **Policies:** List, create, detail; policy bindings (groundwork).
- **Analytics:** Overview (request count, latency, error rate, spend placeholder); mix by provider, model, route; period selector (24h, 7d, 30d, 90d); recent requests; links to Logs and model catalog.
- **Logs & Traces:** Request logs; filter by project/route; cross-link from Analytics.
- **Lifecycle & Migrations:** Placeholder page; migration recommendations note; model detail shows Migration section when deprecated/retired.
- **Billing & Forecasting:** Placeholder.
- **Onboarding:** Unauthenticated welcome explains order (workspace, project, key model, billing, Gateway Key, provider, route, first request, analytics). Signed-in Overview shows a "Get started" checklist when user has no projects, no Gateway Keys, or no provider integrations; steps link to Projects, Access, Integrations, Routes, Billing, Analytics, Logs, Docs.
- **Dashboard UI hiding (optional):** Env **`RESTORMEL_DASHBOARD_UI_HIDDEN`** (comma-separated section tokens) removes matching areas from the sidebar and related overview/onboarding links; direct navigation to those paths redirects to Overview with a notice. **Does not disable dashboard REST APIs** — see [apps/dashboard/README.md](../../apps/dashboard/README.md).

---

## What is not implemented (do not describe as live)

- Management keys / PATs, Service Accounts, OIDC (Access).
- Restormel-managed billing (real charge; spend is placeholder from request_logs when `estimated_cost` is set).
- Full route step editing UI (steps exist; create/update via API or future UI).
- Dynamic model ingestion from provider APIs (catalog is static seed + script).
- Customer/tenant or exposure rules.

---

## Migration notes (user-facing changes)

- **Gateway Key naming:** The product uses "Gateway Key" (and "Provider credential" for provider keys) everywhere in the dashboard and runbooks. Older docs that said "API key" for the Restormel auth key have been updated to "Gateway Key" where they refer to the dashboard key (e.g. runbooks, phase-3 manual steps, firestore-to-neon-migration).
- **Legacy terms (backwards compatibility):** Table name `api_keys` is unchanged (stores Gateway keys; see [control-plane-schema-004.md](control-plane-schema-004.md)). Env var `KEYS_BACKEND_API_KEY` is unchanged (value = a Gateway Key from the dashboard; document as "backend Gateway Key" in runbooks). External APIs (e.g. key list response) do not rename fields; add optional `type: "gateway"` or docs only where helpful.
