# Choosing a route model

Use this guide to choose between **shared generic routes** and **dedicated stage-aware routes**.

## Two route categories

### Shared generic route
- `workload: null`, `stage: null`
- Best for broad traffic where one route handles multiple request types.
- Typical when you want a default route for an environment and do not need per-stage specialization.

**Resolve payload example:**

```json
{
  "environmentId": "prod",
  "routeId": "interactive"
}
```

### Dedicated stage-aware route
- `workload: "ingestion"`, `stage: "<ingestion stage>"`
- Best for ingestion pipelines where each stage can have different provider/model and fallback behavior.
- Required when calling resolve/simulate with stage-aware context.

**Resolve payload example:**

```json
{
  "environmentId": "prod",
  "routeId": "ingestion-extraction",
  "workload": "ingestion",
  "stage": "ingestion_extraction",
  "task": "completion",
  "attemptNumber": 1
}
```

## Required vs optional fields by route type

| Field | Shared generic | Dedicated stage-aware |
|---|---|---|
| `environmentId` | Required | Required |
| `routeId` | Optional but recommended | Optional but recommended |
| `workload` | Omit | Required for stage-aware behavior |
| `stage` | Omit | Required for stage-aware behavior |
| `attemptNumber`, `failureKind`, `constraints`, `previousFailure` | Optional | Optional |

## Common failure mode

If you send stage-aware payload fields to a generic route, resolve/simulate can return:

```json
{
  "error": "no_route"
}
```

This is a **route configuration mismatch**, not necessarily a runtime API regression.

## Operator checklist

- Confirm route shape with `GET /api/projects/{projectId}/routes`.
- If you need stage-aware routing, ensure routes are created/published with explicit `workload` and `stage`.
- Verify coverage with `GET /api/projects/{projectId}/route-coverage`.
