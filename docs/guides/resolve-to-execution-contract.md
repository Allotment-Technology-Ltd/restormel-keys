# From resolve to execution

`resolve` success and host execution success are related, but not identical.

## What `resolve` guarantees

A successful `POST /api/projects/{projectId}/resolve` guarantees that Restormel selected a route decision for the supplied context and returned machine-readable metadata:

- `routeId`, `routeName`
- `selectedStepId`, `selectedOrderIndex`
- `providerType`, `modelId`
- `switchReasonCode`
- `matchedCriteria`, `fallbackCandidates`
- `estimatedCostUsd` (when estimable)

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
