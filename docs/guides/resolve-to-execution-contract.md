# From resolve to execution

`resolve` success and host execution success are related, but not identical.

## What `resolve` guarantees

A successful `POST /api/projects/{projectId}/resolve` guarantees that Restormel selected a route decision for the supplied context and returned machine-readable metadata:

- `contractVersion` (e.g. `2026-03-26`)
- `routeId`, `routeName`
- `route` — `{ id, environmentId, workload, stage, enabled, version, publishedVersion }` for host-side checks without a second list call
- `selectedStepId`, `selectedOrderIndex`
- `providerType`, `modelId` — both **non-null** on HTTP 200; `providerType` uses the **canonical API vocabulary** (see below)
- `switchReasonCode`
- `matchedCriteria`, `fallbackCandidates` (steps after the selected step, canonical provider/model), `stepChain` (all enabled steps in order with `selected` flag)
- `estimatedCostUsd` (when estimable)

### Canonical `providerType` (resolve / simulate)

| Persisted step label (dashboard / DB) | JSON `providerType` |
|--------------------------------------|---------------------|
| `openai`, `anthropic`, `openrouter`, `vercel`, `portkey` | same slug |
| `google`, `vertex`, `vertex_ai`, … | `vertex` |

Policy and cost estimation still use the `google` id internally where `@restormel/keys` `defaultProviders` expects it; hosts should key execution off **`vertex`** for Google/Vertex.

## Host runtime discovery (SOPHIA / ingestion)

Hosts that should **not** store Restormel route UUIDs in environment variables can discover routes at runtime and then resolve by metadata.

1. **List routes** — `GET /api/projects/{projectId}/routes?environmentId=...`  
   Optionally filter with `workload` and `stage`. Each row includes `isPublished` (true when `version === publishedVersion`). Prefer routes that are published and enabled before calling resolve.

2. **Ingestion naming convention**

   - **Dedicated stage route:** `workload=ingestion`, `stage=ingestion_<substage>` where `<substage>` is one of: `extraction`, `relations`, `grouping`, `validation`, `json_repair` (embedding may use `ingestion_embedding` when applicable).
   - **Shared fallback:** `workload=ingestion`, `stage` null or empty (same workload, no stage).

3. **Resolve without `routeId`** — `POST .../resolve` with `environmentId`, and for stage-specific work also `workload` + `stage`. The server prefers a dedicated matching route, then a shared ingestion route for that workload.

4. **Resolve with `routeId`** — Still supported (UUID or route **name**). That route wins; there is no fallback. If it is draft, disabled, or wrong environment, the API returns a **stable `error` string** (see walkthrough / OpenAPI).

### Multi-tenant and stage precedence

- **Dedicated route:** same as ingestion naming — set `workload` and a specific `stage` (e.g. `ingestion_extraction`) so only that binding matches when you need per-tenant or per-substage isolation.
- **Shared route:** `workload` set, `stage` null or empty — catches traffic that should share one published route across tenants or substages when no dedicated row exists.
- **Precedence:** With both `workload` and `stage`, the resolver tries **dedicated** (`workload` + exact `stage`) first, then **shared** (`workload` + null `stage`). With `workload` only, only shared routes match.
- **Workload-only resolve:** omitting `stage` is intentional when your deployment uses a single shared route per workload; add `stage` when you publish dedicated routes per substage or tenant lane.

### Example resolve bodies

Dedicated ingestion step (e.g. extraction):

```json
{
  "environmentId": "production",
  "workload": "ingestion",
  "stage": "ingestion_extraction"
}
```

Shared ingestion fallback:

```json
{
  "environmentId": "production",
  "workload": "ingestion"
}
```

### Error handling for hosts

Branch on JSON `error` (not only HTTP status). Typical mapping:

| `error` | HTTP | Host action |
|---------|------|-------------|
| `unauthorized` | 401 | Fix Gateway Key / project scope |
| `no_route` | 404 | No matching route; check list-routes filters and environment |
| `route_unpublished` | 409 | Publish route or pick another route |
| `route_disabled` | 403 | Enable route or pick another |
| `policy_blocked` | 403 | Read `violations`; adjust policy or route steps |
| `no_key_available` | 422 | Add/enable at least one route step, or adjust retry context |
| `resolve_incomplete` | 422 | A step passed policy but has no executable provider/model; set provider + model on the step or `defaultModelId` on the route |

Canonical API tables: [OpenAPI spec](../api/openapi.yaml) (`POST .../resolve`). Optional preflight: `POST .../routes/{routeId}/validate-binding`.

### `@restormel/keys` (npm) — resolve, guards, validate-binding

Use **`@restormel/keys@0.2.11`** or newer from npm (or a tarball built from this repo at that version). Replace legacy `file:vendor/...restormel-keys-0.2.5.tgz`-style pins once published or after you regenerate a vendor tarball from `packages/core`.

```ts
import {
  resolve,
  validateRouteBinding,
  isRouteUnpublished,
  isNoRoute,
  isNoKeyAvailable,
} from "@restormel/keys/dashboard";

// Runtime resolve (metadata discovery — no routeId env secret)
const r = await resolve({
  auth: { type: "bearer", token: process.env.RESTORMEL_GATEWAY_KEY! },
  projectId: process.env.RESTORMEL_PROJECT_ID!,
  environmentId: "production",
  workload: "ingestion",
  stage: "ingestion_extraction",
});

// Admin preflight: optional thin wrapper before showing “bound OK” in UI
const v = await validateRouteBinding({
  auth: { type: "bearer", token: process.env.RESTORMEL_GATEWAY_KEY! },
  projectId: process.env.RESTORMEL_PROJECT_ID!,
  routeId: someRouteIdFromListRoutes,
  environmentId: "production",
  workload: "ingestion",
  stage: "ingestion_extraction",
});
if (v.ok && !v.bindingOk) {
  // v.reasons — e.g. environment_mismatch, route_unpublished, ingestion_metadata_mismatch
}
```

`validateRouteBinding` does **not** evaluate policies or steps; it only checks route record metadata vs the binding you intend. For full execution readiness, still use `resolve` or operator tooling.

## What `resolve` does not guarantee

`resolve` does **not** guarantee that your host runtime can execute the final provider call. Host-side failures can still happen due to:

- missing/invalid provider credentials in the host runtime
- provider-side outages or network issues
- model access restrictions at provider account level
- local host policy/feature flags not aligned with route output

## Host-side checks after resolve

Run these checks after every resolve result:

1. provider credential presence for selected provider
2. provider/model execution capability in current host environment
3. hard guardrails (`maxCost`, fail-open/fail-closed policy)
4. fallback behavior if execution fails

## Fail-hard vs degrade guidance

- **Fail hard** when:
  - policy blocks execution
  - critical provider credentials are missing
  - compliance/safety constraints require deterministic denial
- **Degrade safely** when:
  - fallback providers are acceptable
  - route recommendation can be applied later without violating policy
  - user impact is lower than hard failure

## Relation to provider health

`providers/health` expresses control-plane readiness and integration status.
Execution readiness in the host can still differ. Treat provider health as a prerequisite signal, not an execution guarantee.

## Operational pattern

1. `readiness` to gate preflight
2. `resolve` for route decision
3. host execution check + provider call
4. on failure, use `simulate` + `recommend` + lifecycle endpoints (`publish/rollback/history`) to correct route or policy
