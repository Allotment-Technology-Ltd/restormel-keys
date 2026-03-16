# Policy enforcement: what is enforced now vs later

**Status:** Reference. Describes the initial policy engine and what is enforced in v1.

## Enforced now (v1)

- **model_allowlist** — Rule shape: `{ modelIds: string[] }`. If the list is non-empty and the request has a `modelId`, the model must be in the list; otherwise a violation is returned.
- **model_denylist** — Rule shape: `{ modelIds: string[] }`. If the request has a `modelId` and it is in the list, a violation is returned.
- **provider_allowlist** — Rule shape: `{ providerTypes: string[] }`. If the list is non-empty and the request has a `providerType`, the provider must be in the list.
- **provider_denylist** — Rule shape: `{ providerTypes: string[] }`. If the request has a `providerType` and it is in the list, a violation is returned.
- **deprecated_model_block** — No rule config. If the context includes `modelLifecycleState === "deprecated"` or `"retired"`, a violation is returned. The caller must pass this from the model catalog when evaluating.

Evaluation is explicit: call `evaluatePolicies(context)` with `workspaceId` and optional `projectId`, `environmentId`, `routeId`, `modelId`, `providerType`, `modelLifecycleState`. Policies bound to the workspace and to any of the given targets (project, environment, route) are loaded; only active policies are applied. The function returns an array of violations; empty means allowed.

## Placeholder (not enforced in v1)

- **budget_cap** — Rule shape: `{ limit?: number }`. Reserved for future usage/budget checks. Not evaluated in v1.
- **token_cap** — Rule shape: `{ limit?: number }`. Reserved for token limits. Not evaluated in v1.
- **environment_restriction**, **privacy_constraint**, **downstream_exposure** — Not implemented in the engine yet.

## Wiring

- **Route selection / request validation:** The dashboard does not yet call `evaluatePolicies` during route resolution or on every request. To enforce policies, call `evaluatePolicies(context)` before or after resolving a route (or in gateway middleware) and block or redirect when `violations.length > 0`. See [routes-bridging.md](routes-bridging.md) for how route resolution could integrate policy checks.
