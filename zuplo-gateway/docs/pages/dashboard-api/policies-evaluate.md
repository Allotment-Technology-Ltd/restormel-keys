---
description: Evaluate policies for a request context (Dashboard API).
---

# Policies evaluate

This is a **Dashboard API** runtime endpoint used to test whether a model/provider choice is allowed by the active policies for a project/environment.

**Base URL**: `https://restormel.dev/keys/dashboard/api`  
**Auth**: `Authorization: Bearer rk_...` (Gateway Key, project-scoped)

## Endpoint

`POST /policies/evaluate`

### Request body

```json
{
  "projectId": "your_project_id",
  "environmentId": "prod",
  "routeId": "Default",
  "modelId": "gpt-4o",
  "providerType": "openai"
}
```

### Response (200)

```json
{
  "data": {
    "allowed": true,
    "violations": []
  }
}
```

### Errors

- `400`: invalid request
- `401`: missing/invalid Gateway Key
- `403`: forbidden (key scope mismatch / not authorized)

## Notes

- Policy evaluate is a **control** endpoint — it does not execute provider requests.
- For observability/tracing of provider execution, use your existing observability stack (gateway logs, app logs, tracing).

