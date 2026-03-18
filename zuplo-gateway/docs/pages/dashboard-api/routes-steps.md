---
title: Routes & Steps
description: Create and manage route steps (Dashboard API).
---

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
- `providerPreference` (enum)
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

## Reminder: this is not the gateway surface

These endpoints are **not** served through the Zuplo gateway documented in `/api`. They are part of the Dashboard API surface.

