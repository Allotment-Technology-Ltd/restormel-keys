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
  - `routeId` (optional): route name (if omitted, uses the first active route for the environment)

### Response (200)

```json
{
  "data": {
    "routeId": "Default",
    "providerType": "openai",
    "modelId": "gpt-4o",
    "explanation": "route=Default step=0 provider=openai model=gpt-4o"
  }
}
```

### Errors

- `401`: missing/invalid Gateway Key
- `403`: Gateway Key is valid but not authorized for the requested project/workspace
- `404`: no active route found
- `422`: route exists but no enabled step can resolve

## Security

- Call from your backend only (never from the browser).
- Do not log or expose raw `rk_...` keys.

