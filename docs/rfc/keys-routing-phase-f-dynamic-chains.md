# RFC: Phase F — Dynamic chains, parallelism, and model pools (Keys routing)

**Status:** Accepted (Phase F wave 1 shipped in repo: pools + parallel metadata + contract `2026-04-16`).  
**Audience:** Restormel Keys maintainers, SOPHIA / host integrators.  
**Canonical routing:** [docs/architecture/keys-routing-contract.md](../architecture/keys-routing-contract.md), [`RESOLVE_SIMULATE_CONTRACT_VERSION`](../../apps/dashboard/src/lib/server/resolve-response.ts).

## Problem

Hosts need a clear story for dynamic chaining, parallel execution hints, and **model pools** per step without Keys executing LLM calls.

## Trust boundary (non-negotiable)

Keys remains **intent + resolution + policy evaluation metadata**. **Hosts execute** LLM calls, interpret retries, and merge parallel results unless a future hosted execution service exists.

## Non-goals (v1)

- **No arbitrary DAG** in the control plane: resolver remains a linear walk of enabled steps by `orderIndex` (plus pool members **within** a step).
- **No hosted LLM execution** in Keys.
- **No automatic parallel scheduling** in Keys: parallel fields are **metadata** for hosts in v1.
- **No graph editor** for conditional edges between steps in v1 (Option B deferred).

## Phased rollout

| Wave | Scope | Notes |
|------|--------|--------|
| **F1** | **Model pools** (`model_pool` JSON on `route_steps`), resolver selection, policy per member, dashboard + export | Shipped |
| **F2** | **Parallel metadata** (`parallel_group_id`, `parallel_branch_role`) echoed on resolve/simulate | Shipped (linear selection unchanged) |
| **F3** | **Dynamic chaining** | **Option A (host-driven):** document-only + existing `attemptNumber` / `switchCriteria` / `retryPolicy` echoes — no control-plane graph in v1. **Option B (graph):** future; requires migrations + resolver graph walk. |
| **F4** | **Integrators + security** | Consumer docs, OpenAPI alignment, masked identifiers only in logs ([security baseline](../governance/security-baseline.md)). |

## Design summary

### 1. Dynamic chaining

- **Option A (in scope):** Hosts interpret `switchCriteria`, `retryPolicy`, `attemptNumber`, and `previousFailure`; Keys documents and echoes hints (`advanceOn`, `retryOn`).
- **Option B (out of scope for v1):** Conditional edges / arbitrary DAG in Keys.

### 2. Parallelism

- **v1:** Persist optional `parallel_group_id` / `parallel_branch_role`; echo on `stepChain`, simulate diagnostics, `routingAttempts`, and `perStepEstimates`. Merge strategies documented for hosts only.
- **Future:** Optional resolver participation (only if product requires it).

### 3. Model clusters (pools)

- Storage: JSONB **`model_pool`** on **`route_steps`**, version **1** — `selectionStrategy` (`first_eligible`, `deterministic_hash`, `round_robin`, `weighted_random`) and `members[]` with `providerPreference`, `modelId`, optional `weight`.
- **Resolver:** Picks first eligible member after ordering; policies apply **per member** attempted.

### 4. Cross-cutting

- **Policies:** Evaluated against **each pool member** candidate in order (same types as single-step routes).
- **Consumers:** [sophia-keys-routing-consumer.md](../guides/sophia-keys-routing-consumer.md).
- **Security:** No raw secrets in logs; pool JSON must not contain secrets ([security baseline](../governance/security-baseline.md)).

## Deliverables (closed for wave 1)

1. RFC promoted with non-goals and phased rollout (this doc).
2. OpenAPI + `contractVersion` **`2026-04-16`** ([openapi.yaml](../api/openapi.yaml)).
3. Resolver diagrams: [phase-f-resolve-pools.md](../routing/phase-f-resolve-pools.md), [phase-f-parallel-metadata.md](../routing/phase-f-parallel-metadata.md).
4. Governance: [CHANGELOG.md](../../CHANGELOG.md), [STATUS.md](../../STATUS.md).

## References

- [docs/architecture/keys-routing-contract.md](../architecture/keys-routing-contract.md)
- [CHANGELOG.md](../../CHANGELOG.md)
- Resolver: [`apps/dashboard/src/lib/server/route-resolver.ts`](../../apps/dashboard/src/lib/server/route-resolver.ts)
- Model pool helper: [`apps/dashboard/src/lib/server/model-pool.ts`](../../apps/dashboard/src/lib/server/model-pool.ts)
