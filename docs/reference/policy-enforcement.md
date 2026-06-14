---
title: Policy enforcement: what is enforced
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-03-16
last-reviewed: 2026-06-13
review-interval: P12M
---

# Policy enforcement: what is enforced

**Status:** Reference. Aligns with dashboard `evaluatePolicies` and resolve route resolution.

## Evaluate vs resolve

- **Evaluate** (`POST .../policies/evaluate`): hypothetical check for a given `modelId` / `providerType` / scope. Returns `{ allowed, violations }`.
- **Resolve** (`POST .../projects/:id/resolve`): walks **enabled route steps in order**; each candidate step is checked with the same policy engine. First passing step wins; if none pass → **403** `policy_blocked`.

## Policy types (rule shapes)

| Type | Rule | Behavior |
|------|------|----------|
| `model_allowlist` | `{ modelIds: string[] }` | Non-empty list → `modelId` must be in list |
| `model_denylist` | `{ modelIds: string[] }` | `modelId` in list → violation |
| `provider_allowlist` | `{ providerTypes: string[] }` | Non-empty → `providerType` must be in list |
| `provider_denylist` | `{ providerTypes: string[] }` | `providerType` in list → violation |
| `deprecated_model_block` | (none) | Violation if `modelLifecycleState` is `deprecated` or `retired` |
| `budget_cap` | `{ limit: number }` | Violation if summed `estimated_cost` in **request_logs** for binding scope **this calendar month** ≥ `limit` |
| `token_cap` | `{ limit: number }` | Violation if summed input+output tokens same window ≥ `limit` |

Bindings attach policies to targets: **workspace**, **project**, **environment**, **route**. Only **active** policies apply.

## Resolve API: `policy_blocked` (403)

| Field | Type | Description |
|-------|------|-------------|
| `error` | string | `"policy_blocked"` |
| `message` | string | Short summary |
| `violations` | array | `{ policyId, policyName, type, message }` each |

Clients should parse JSON on non-2xx; do not rely only on thrown `Error.message`.

## Provider naming

- Policy evaluation uses internal provider keys (e.g. **`google`**).
- Resolve **response** `data.providerType` maps **`google` → `vertex`** for downstream consumers.

## Not implemented here

`environment_restriction`, `privacy_constraint`, `downstream_exposure` — not in the engine yet.

See [routes-bridging.md](../archive/reference/routes-bridging.md) for route/policy context.
