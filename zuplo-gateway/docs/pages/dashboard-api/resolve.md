---
description: Resolve which provider/model to use for a request (Dashboard API).
---

# Resolve

Resolve is a **Dashboard API** runtime endpoint. Your backend calls it directly to get a route/provider/model decision, then you execute the request via your existing provider access layer (OpenRouter/Portkey/Vercel AI Gateway or direct providers).

**Base URL**: `https://restormel.dev/keys/dashboard/api`  
**Auth**: `Authorization: Bearer rk_...` (Gateway Key, project-scoped)

## Endpoint

`POST /projects/{projectId}/resolve`

### Request

- Path param: `projectId` (must match your Gateway Key’s project scope)
- JSON body:
  - `environmentId` (required): environment name (e.g. `dev`, `prod`)
  - `routeId` (optional): route UUID or route **name**; when set, only that route is considered (no fallback)
  - `workload` / `stage` (optional): metadata-based discovery when `routeId` is omitted (see [Host runtime discovery](https://restormel.dev/keys/docs/guides/resolve-to-execution-contract))
  - `task` (optional): reserved for future switch criteria

### Response (200)

```json
{
  "data": {
    "contractVersion": "2026-03-26",
    "routeId": "…",
    "routeName": "Default",
    "route": {
      "id": "…",
      "environmentId": "production",
      "workload": null,
      "stage": null,
      "enabled": true,
      "version": 1,
      "publishedVersion": 1
    },
    "providerType": "openai",
    "modelId": "gpt-4o",
    "explanation": "route=… step=0 provider=openai model=gpt-4o"
  }
}
```

### Errors

Read JSON `error` for stable codes (see OpenAPI `docs/api/openapi.yaml`).

- `401` + `unauthorized`: missing/invalid Gateway Key or project not in scope
- `403` + `policy_blocked`: route matched; all enabled steps blocked (`violations` array)
- `403` + `route_disabled`: explicit `routeId` is disabled or not active
- `404` + `no_route`: no matching route or wrong environment for `routeId`
- `409` + `route_unpublished`: explicit `routeId` is draft (`version` ≠ `publishedVersion`)
- `422` + `no_key_available`: route matched but no enabled step to select

## Security

- Call from your backend only (never from the browser).
- Do not log or expose raw `rk_...` keys.
