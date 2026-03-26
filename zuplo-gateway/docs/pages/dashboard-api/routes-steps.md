---
description: Create and manage route steps (Dashboard API).
---

# Routes & Steps

Route steps are managed via the **Dashboard API** (runtime/control plane). These endpoints are authenticated with a **Gateway Key** (`rk_...`) and are called directly from your backend.

**Base URL**: `https://restormel.dev/keys/dashboard/api`  
**Auth**: `Authorization: Bearer rk_...` (Gateway Key, project-scoped)

## Endpoints

### List steps

`GET /projects/{projectId}/routes/{routeId}/steps`

- Returns steps ordered by `orderIndex`.

### Create step

`POST /projects/{projectId}/routes/{routeId}/steps`

Request body shape is `RouteStepCreate` (see product OpenAPI for full schema). Typical fields:

- `orderIndex` (integer, >= 0, unique within route)
- `enabled` (boolean)
- `providerPreference` — **authoritative** enum for Keys execution: `openai`, `anthropic`, `google`, `deepseek`, `mistral`, `openrouter`, `portkey`, `together`, `vercel`, `voyage` (Google inbound aliases such as `vertex` normalize to `google`). This set is **narrower** than the project model index (`GET/POST .../models`): registry bindings may list other provider slugs for merge metadata; those values are **not** valid on route steps until Keys extends the Steps API. See product OpenAPI `RouteStepCreate` / `RouteStepPatch` and [From resolve to execution — route step providerPreference](https://restormel.dev/keys/docs/guides/resolve-to-execution-contract#route-step-providerpreference-steps-api).
- `modelId` (string)
- `fallbackOn` (enum)

### Update step

`PATCH /projects/{projectId}/routes/{routeId}/steps/{stepId}`

### Delete step

`DELETE /projects/{projectId}/routes/{routeId}/steps/{stepId}`

## Errors

Common error codes across steps endpoints:

- `401`: missing/invalid Gateway Key
- `403`: forbidden (key scope mismatch)
- `404`: route/step not found
- `409`: duplicate `orderIndex` within a route
- `400` with **`error`: `route_step_provider_not_allowed`**: `providerPreference` is not an allowed route-step execution slug. Response includes **`allowed`** (array) and **`detail`**. Registry-only slugs from the project model index are rejected until Keys extends execution; for aggregator-routed models use **`openrouter`** or **`portkey`** with a supported catalog **`modelId`** when applicable (see [From resolve to execution](https://restormel.dev/keys/docs/guides/resolve-to-execution-contract#route-step-providerpreference-steps-api)).

## Reminder: this is not the gateway surface

These endpoints are **not** served through the Zuplo gateway documented in `/api`. They are part of the Dashboard API surface.

