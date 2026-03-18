---
title: Dashboard API
description: Runtime control plane for Restormel Keys (resolve, policies, routes/steps).
---

The Dashboard API is the runtime control plane for Restormel Keys. Your backend calls it directly — **not through the Zuplo gateway**.

**Base URL**: `https://restormel.dev/keys/dashboard/api`  
**Auth**: `Authorization: Bearer rk_...` (your Gateway Key, project-scoped)

## Available endpoints

| Endpoint | Purpose |
|---|---|
| `POST /projects/{id}/resolve` | Resolve which provider/model to use for a request |
| `POST /policies/evaluate` | Test whether a model/provider passes active policies |
| `POST /projects/{id}/routes/{routeId}/steps` | Add a step to a route |
| `GET /projects/{id}/routes/{routeId}/steps` | List steps for a route |
| `PATCH /projects/{id}/routes/{routeId}/steps/{stepId}` | Update a step |
| `DELETE /projects/{id}/routes/{routeId}/steps/{stepId}` | Remove a step |

## Security

- Your Gateway Key is project-scoped. The `projectId` in the URL must match the key’s bound project.
- Never call these endpoints from the browser — use a server-side proxy.
- Never expose `rk_...` keys to frontend code.

