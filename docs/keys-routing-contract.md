# Keys routing contract (canonical)

**Status:** Canonical technical reference for Restormel Keys **control-plane routing** (routes, steps, resolve, simulate).  
**Audience:** SOPHIA-class workers, integrators, and coding agents (MCP `docs.canonical_resolve` topic `keys_routing_contract`).  
**Public mirror:** [Routing contract](/keys/docs/guides/routing-contract) on the hosted dashboard docs.

## Trust boundary

- **Keys** stores **intent**: named routes, ordered steps, policies, workload/stage metadata, optional JSON policies on steps (`switchCriteria`, `retryPolicy`, `costPolicy`), timeouts, and `fallbackOn` hints.
- **Hosts / SOPHIA** run the **data plane**: they call providers, handle retries, parse responses, and decide when to advance tiers using **their** runtime signals unless you later add a hosted execution proxy in Keys.
- Keys **resolve** and **simulate** do **not** execute upstream LLM calls; they return provider/model decisions and **rich step metadata** for hosts to consume.

## Contract versions

| Version    | Summary |
|------------|---------|
| `2026-03-26` | Baseline: `stepChain`, `fallbackCandidates`, `attemptNumber`, workload/stage discovery. |
| `2026-04-14` | Rich **`stepChain` / `fallbackCandidates`** rows: `label`, `timeoutMs`, `fallbackOn`, `switchCriteria`, `retryPolicy`, `costPolicy`, `notes`. Simulate adds optional **`stepDiagnostics`** (policy + executable probe per enabled step). |
| Additive (same `contractVersion` string) | **`advanceOn` / `retryOn`** on `stepChain` when set in step JSON; **`GET …/export`** bundle; simulate **`routingAttempts`** when requested. Documented as **2026-04-15** in repo changelog. |

Clients should read `contractVersion` on resolve/simulate success payloads and tolerate unknown fields.

## Capability matrix (vs common gateways)

Industry patterns (documentation only — no endorsement):

| Idea (gateways) | Keys control plane | Host (e.g. SOPHIA) |
|-----------------|--------------------|--------------------|
| Ordered model list ([LiteLLM fallbacks](https://docs.litellm.ai/docs/proxy/reliability), [Vercel AI Gateway model fallbacks](https://vercel.com/docs/ai-gateway/models-and-providers/model-fallbacks)) | **`stepChain`**: all **enabled** steps in order, with metadata per row | Walk tiers in order; on failure, advance or call resolve with `attemptNumber` |
| Status-triggered fallback ([Portkey `on_status_codes`](https://portkey.ai/docs/product/ai-gateway/fallbacks)) | Persisted **`fallbackOn`** per step (`error`, `rate_limit`, `no_key`, `policy_block`, `any`) | Map provider HTTP / errors to advance vs retry (see vocabulary below) |
| Retries before next tier | **`retryPolicy`** JSON (schema in [route-step-rich.schema.json](schemas/route-step-rich.schema.json)) | Interpret JSON; Keys does not run retries for LLM calls |
| Timeouts | **`timeoutMs`** on step + response echo in `stepChain` | Enforce client-side / worker-side timeouts |
| Pre-flight / cost | **`costPolicy`** JSON + resolve **`constraints`** (`maxCost`, `latency`) | Enforce before call or use for logging |
| `modelAttempts`-style forensics | **`traceId`**, **`switchReasonCode`**, simulate **`stepDiagnostics`** | Log attempts without raw secrets ([security baseline](security-baseline.md)) |

## Resolve: discovery and chains

### `POST /keys/dashboard/api/projects/{projectId}/resolve`

- **Auth:** Gateway Key (`rk_…`) or session.
- **Discovery:** With **`workload`** + **`stage`**, Keys prefers a route where both match, then a **shared** route with the same `workload` and **empty** `stage`. See server: `selectRouteForDiscovery` in `apps/dashboard/src/lib/server/route-resolver.ts`.
- **Explicit route:** `routeId` (UUID or **name**) skips discovery for other routes.
- **Advance after failure:** send **`attemptNumber`** (0-based) and **`previousFailure`** `{ selectedOrderIndex, selectedStepId }` so the resolver skips prior steps (server-driven chain walk).

### Success payload highlights

- **`providerType` / `modelId`:** winning executable step (canonical `vertex` for Google).
- **`stepChain`:** every **enabled** step in order; exactly one `selected: true` on success. When `switchCriteria.advanceOn` or `retryPolicy.retryOn` are string arrays on the step row, the same arrays are echoed top-level as **`advanceOn`** / **`retryOn`** on each `stepChain` entry (Keys does not evaluate them).
- **`fallbackCandidates`:** suffix after the winner (no `selected` field); same rich metadata as chain rows minus selection.

### Ingestion workload / stage

When **`workload`** is `ingestion`, **`stage`** may be one of:

| `stage` value | Typical use |
|---------------|-------------|
| `ingestion_extraction` | Extract |
| `ingestion_relations` | Relate |
| `ingestion_grouping` | Group |
| `ingestion_validation` | Validate |
| `ingestion_remediation` | Remediate |
| `ingestion_embedding` | Embed (separate from chat resolve in many hosts) |
| `ingestion_json_repair` | JSON repair |

Create routes via dashboard or API; duplicate dedicated `(workload, stage)` pairs per environment are rejected (`409`).

## Recommended error-kind vocabulary (hosts)

Keys does not standardize provider error bodies. Hosts may map failures to a small set and combine with **`fallbackOn`**:

| Kind | Suggested meaning |
|------|-------------------|
| `rate_limit` | 429 / provider rate limit |
| `timeout` | Client or upstream timeout |
| `http_5xx` | Upstream 5xx |
| `context_exceeded` | Context / token limit exceeded |
| `content_filtered` | Safety / content policy |
| `policy_block` | Keys policy evaluation blocked step (already surfaced at resolve) |
| `provider_error` | Other provider errors |

**Advance vs retry:** use step **`retryPolicy`** for “retry same tier” hints; use **`fallbackOn`** and chain order for “try next tier”. Exact mapping is host-specific.

## Simulate and diagnostics

### `POST .../routes/{routeId}/simulate`

Same selection logic as resolve for the given route id (path), plus cost hints.

- **`includeStepDiagnostics`:** default **true**. When enabled, **`stepDiagnostics`** lists each **enabled** step with `policyViolations` and `executable` (provider+model pair viability). Set **`includeStepDiagnostics: false`** to skip extra policy evaluations.
- **`includeRoutingAttempts`:** when **true**, response includes **`routingAttempts`**: one row per **enabled** step in order with `hypotheticalOutcome` in `selected` | `blocked_by_policy` | `not_executable` | `not_selected` (dry-run only; no provider calls). Policy evaluation runs internally when this flag is set, even if `includeStepDiagnostics` is false.

### `GET .../routes/{routeId}/export`

Portable **route graph** JSON for GitOps and agent diffs: `schemaVersion` **`1.0.0`**, `exportedAt`, `projectId`, `route`, ordered **`steps`**. No secrets. Schema: [route-graph-bundle.schema.json](schemas/route-graph-bundle.schema.json).

## JSON Schemas

- [route-step-rich.schema.json](schemas/route-step-rich.schema.json) — optional objects on route steps (`switchCriteria`, `retryPolicy`, `costPolicy`).
- [route-graph-bundle.schema.json](schemas/route-graph-bundle.schema.json) — full route + steps export bundle.

## MCP and AAIF (development-time)

- **MCP:** `docs.canonical_resolve` with topic **`keys_routing_contract`** → this file and public URL. Use **`routing.capabilities`** (suite tool) for a structured list of routing-related MCP tools and HTTP paths. Control-plane tools include **`routing.export`** (GET bundle), **`routing.import`** (POST apply bundle), **`routing.explain_chain`** (GET route + steps + policy-scope summary for agents), and **`routes.simulate`**. Tool **outputSchema** for **`routing.export`**, **`routing.import`**, **`routing.explain_chain`**, and **`routes.simulate`** documents success payload shapes (Zod in `packages/mcp/src/register-tools.ts`, JSON Schema mirrors in `packages/mcp/src/routing-mcp-output-schemas.ts`).
- **AAIF:** Types in `@restormel/aaif`; optional **`routingContext`** mirrors resolve hints; optional **`routingPlan`** carries typed **`stepChain` / `routingAttempts`** mirrors from HTTP responses; optional **`integrationStack`** (`schemaVersion: "1"`, optional `templateId`, `components[]` with ids from **`INTEGRATION_COMPONENT_IDS`**) declares third-party products in the host environment for logs and agents — it does **not** participate in resolve. AAIF does not replace resolve for full chains — see package README and [examples/aaif-resolve-then-execute/README.md](../examples/aaif-resolve-then-execute/README.md). In-product: [/keys/docs/integrations/aaif#integration-stack](https://restormel.dev/keys/docs/integrations/aaif#integration-stack).

## Catalog signals (optional / future)

Automated reordering or cooldown from production telemetry is **not** on by default. Design and trust boundary: [routing-catalog-signals.md](guides/routing-catalog-signals.md). **Read-only crowdsignal hints** (aggregated counts only, off by default): `GET …/explain-chain?includeCatalogHints=true` — see [routing-implementation-checkpoints-closed.md](guides/routing-implementation-checkpoints-closed.md).

## Planning checkpoints (closed)

Outcomes of routing parity **CHECKPOINT** reviews (DB/MCP/OpenAPI alignment, tool overlap, doc drift script, AAIF semver, catalog opt-in): [routing-implementation-checkpoints-closed.md](guides/routing-implementation-checkpoints-closed.md).

## SOPHIA consumer checklist

Step-by-step adoption for workers outside this repo: [sophia-keys-routing-consumer.md](guides/sophia-keys-routing-consumer.md).

## Changelog (doc)

- **2026-04-15:** `GET .../export` route graph bundle (schema 1.0.0); `POST .../routes/import` apply bundle; `GET .../explain-chain` agent summary (route + steps + policy bindings); MCP **`routing.export`** / **`routing.import`** / **`routing.explain_chain`**; simulate **`includeRoutingAttempts`** + **`routingAttempts`**; `stepChain` **`advanceOn`** / **`retryOn`** hints from step JSON.
- **2026-04-14:** Rich `stepChain`, simulate `stepDiagnostics`, `ingestion_remediation` stage, contract `2026-04-14`; optional AAIF **`integrationStack`** (host environment metadata; validated in `@restormel/aaif`) aligned with Dashboard stack wizard and [integration catalog](https://restormel.dev/keys/docs/guides/integration-catalog).
