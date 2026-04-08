# MCP Implementation Workflow

## Overview
Use `@restormel/mcp` when you want a tool surface inside an IDE, agent, or automation runner (via MCP stdio).

This runbook focuses on wiring the MCP server/tools so your agent workflow can:
- list and validate model/provider availability
- estimate cost and explain routing decisions
- check entitlements/policy access
- scaffold integration config and search offline docs

## Target use-cases
- IDE/agent tool calling: agent needs to call Restormel tools at runtime.
- Debugging and pre-flight validation inside agent workflows.
- Automated “select model -> estimate cost -> explain routing -> proceed” flows.

## Prerequisites
1. Dependencies installed:
   - `@restormel/mcp`
   - `@restormel/keys`
2. Your environment provides provider credentials needed for:
   - `providers.validate`
   - `cost.estimate`
   - (optional) `entitlements.check` remote evaluation
3. MCP client configuration knows how to start the stdio binary:
   - `restormel-mcp` (stdio, runs in your agent/IDE process context)

## Implementation steps
1. Start the MCP server (stdio transport)
   - Configure your MCP client to run `restormel-mcp`.
2. Use CLI commands to establish baseline routing/cost expectations
   - `npx @restormel/doctor`
   - `npx keys routing explain <model>`
   - `npx keys estimate <model> -i <inputTokensM> -o <outputTokensM>`
3. In your agent workflow, call MCP tools in the intended order
   - `models.list` to inventory candidates
   - `providers.validate` to confirm provider access
   - `cost.estimate` to compute estimated cost for token volume
   - `routing.explain` to obtain routing explanations
   - `entitlements.check` for plan/policy gating
   - `integration.generate` / `docs.search` to scaffold integration/config and locate docs
4. Connect entitlements policy evaluation (if needed)
   - Local rules: set `RESTORMEL_MCP_CONFIG`
   - Remote evaluation: set `RESTORMEL_EVALUATE_URL` + `RESTORMEL_GATEWAY_KEY`

## Server-side environment (production rollout) — user journey

MCP reads **only** the **stdio server process environment** (your IDE/agent host). Treat that env as **server-side**: never commit keys, never expose Gateway keys to the browser, and assume MCP host logs are untrusted. Canonical security rules: [docs/security-baseline.md](../security-baseline.md).

**Canonical names** for every `RESTORMEL_*` variable and URL role (Gateway key vs server token, `KEYS_BASE` vs control plane vs evaluate): **[docs/guides/restormel-environment-vocabulary.md](../guides/restormel-environment-vocabulary.md)** (in-product: [Environment vocabulary](https://restormel.dev/keys/docs/guides/environment-vocabulary)). Other docs should link there instead of inventing alternate names.

Restormel exposes **two different URL bases** MCP tools may call. Do not confuse them.

### A) Policy evaluation (`entitlements.check` → Dashboard API)

Use this when you want `entitlements.check` to hit **live project policies** instead of local `RESTORMEL_MCP_CONFIG` rules.

Set **`RESTORMEL_EVALUATE_URL`** to the **full** `POST` URL (hosted: `https://restormel.dev/keys/dashboard/api/policies/evaluate`) and **`RESTORMEL_GATEWAY_KEY`** to the project Gateway key (`rk_…`). Never log the raw key.

The MCP server posts a small JSON body (e.g. `{ "modelId": "<feature>" }`). With **Gateway Key** auth, the API evaluates in the **key’s bound project**; you may omit `projectId` in the body or must match the key’s project if you send it. API reference: in-product [Cloud API](https://restormel.dev/keys/docs/cloud-api) (Policy evaluate), typed client `evaluatePolicies` in `@restormel/keys/dashboard`, and the **Restormel API portal** doc *Policies evaluate* (Dashboard API).

### B) Control-plane route/policy tools (`routes.*`, `policies.*`, `fallback_chain.set`)

These tools call REST paths under **`/api/projects/...`** on the **dashboard app** origin. Set **`RESTORMEL_CONTROL_PLANE_URL`** so that `{RESTORMEL_CONTROL_PLANE_URL}/api/projects/{projectId}/…` is valid (hosted: `https://restormel.dev/keys/dashboard`, **no trailing slash**).

Set **`RESTORMEL_SERVER_TOKEN`** to the **same value** as the Gateway key unless you use a separate management token; **`RESTORMEL_GATEWAY_KEY`** is accepted as a fallback for the same Bearer header. See the vocabulary doc for why two names exist.

**Trust:** control-plane responses must not contain raw provider secrets; MCP surfaces `serverOnlyToken: true` on write-tool results to remind operators these calls require server credentials.

### C) Readiness, catalog, BYOK templates, simulation

No separate cloud URL: `readiness.check`, `catalog.sync_check`, `catalog.deprecation_alerts`, `policy.simulate`, `byok.*`, and `integration.bootstrap_nextjs` run **locally** in the MCP process (provider env for validation, generated contracts only).

### D) Projects, model index, environments, Gateway keys, and Restormel Testing (agents)

- **`projects.list`** and **`project_models.list`** use the **same** `RESTORMEL_CONTROL_PLANE_URL` + `RESTORMEL_SERVER_TOKEN` (or gateway key) as `routes.*` / `policies.*`. They call `GET /api/projects` and `GET /api/projects/{id}/models` (read-only).
- **`project.environments.list`** calls `GET /api/projects/{id}/environments` (read-only; environment UUIDs for `RESTORMEL_ENVIRONMENT_ID`).
- **`project.gateway_keys.list`**, **`project.gateway_keys.create`**, **`project.gateway_keys.delete`** call the dashboard keys API (`GET`/`POST`/`DELETE` under `/api/projects/{id}/keys`). **`.create` returns `rawKey` once** — same handling as the dashboard: store in a secret manager immediately; never log.
- **`testing.hub_snapshot`** composes `GET /api/projects`, optional `GET /api/projects/{id}`, plus environments + masked keys + a suggested canonical `RESTORMEL_*` snippet (placeholders only). Picks the Restormel Testing project when `projectId` is omitted.
- **`testing.journey`** and **`testing.ci_env_template`** are **offline** structured guides (dashboard URLs, doc links, canonical env names — no HTTP), except **`testing.journey`** only returns JSON.
- **`testing.resolve_probe`** performs a single `POST` to **`{RESTORMEL_KEYS_BASE}/v1/testing/resolve-model`** with the Testing bearer token (same precedence as the CLI: `RESTORMEL_GATEWAY_KEY` and aliases — see [environment vocabulary](../guides/restormel-environment-vocabulary.md) § Testing runner). Returns **HTTP status only**; response body is not echoed.

### Journey checklist (copy for onboarding)

1. Create a **Gateway Key** in the dashboard for the target project (`rk_…`).
2. For **live policy checks** in MCP: set `RESTORMEL_EVALUATE_URL` to the full evaluate URL above and `RESTORMEL_GATEWAY_KEY` to that key.
3. For **project list, model bindings, route/policy CRUD** from MCP: set `RESTORMEL_CONTROL_PLANE_URL` to `https://restormel.dev/keys/dashboard` (or your self-host equivalent) and `RESTORMEL_SERVER_TOKEN` (or gateway key) for Bearer auth.
4. For **Restormel Testing resolve checks** from MCP: set `RESTORMEL_KEYS_BASE` and the same Gateway bearer as for `testing doctor` / CI.
5. For **provider validation** and **readiness**: set normal provider env vars (`OPENAI_API_KEY`, etc.) in the same MCP host environment.
6. Re-open or restart the MCP client so the stdio server picks up new env vars.

**Where this is documented in-product:** [MCP integration doc](https://restormel.dev/keys/docs/integrations/mcp), [Developer Tools → MCP](https://restormel.dev/keys/dashboard/dev-tools/mcp), [Cloud API](https://restormel.dev/keys/docs/cloud-api). **Package:** `packages/mcp/README.md`.

## Verification commands
- `npx @restormel/doctor`
- `npx keys models list`
- `npx keys estimate <model> -i <inputTokensM> -o <outputTokensM>`
- `npx keys routing explain <model>`

## Operator workflow example
1. Call `GET /api/projects/{projectId}/providers/health` and confirm each bound provider has `health=ok` or a clear remediation path.
2. Call `GET /api/projects/{projectId}/route-coverage` to verify each required stage/workload tuple has an enabled route.
3. Call `GET /api/projects/{projectId}/readiness` and resolve any `high` severity issues before rollout.
4. Call `POST /api/projects/{projectId}/routes/{routeId}/recommend` to inspect non-breaking improvements before changing route order/policies.

## Production readiness checklist
- Ensure your MCP client only enables tools that do not write to stdout (MCP protocol uses stdout for tool transport).
- Handle tool error states in the agent workflow:
  - unknown model pricing
  - provider access failures
  - policy/entitlement denials
- Keep policy evaluation and credential handling privacy-safe:
  - never log raw provider API keys
  - surface masked identifiers only

## References (related functionality)
- `@restormel/keys`: models, routing, and pricing primitives
- `@restormel/keys` dashboard client: `evaluatePolicies`, `resolveProviderModel` — same URLs as Cloud API
- `@restormel/validate`: provider validation logic (CI-friendly)
- `@restormel/doctor`: sanity checks and actionable “what to fix next”
- `@restormel/aaif`: alternative structured contract surface for app/service hosts
- API portal (public): Dashboard API docs under **Policies evaluate** and **Dashboard API overview**

