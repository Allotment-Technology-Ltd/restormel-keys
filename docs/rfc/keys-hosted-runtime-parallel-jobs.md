# RFC: Hosted runtime parallel jobs (Phase 4)

**Status:** Draft (implementation scaffold in repo).  
**Audience:** Product, platform, SOPHIA-class integrators.  
**Related:** [keys-no-code-route-runtime.md](keys-no-code-route-runtime.md), [phase-f-parallel-metadata.md](../routing/phase-f-parallel-metadata.md), [keys-routing-contract.md](../keys-routing-contract.md).

## Problem

Phase F exposes **parallel metadata** on steps (`parallelGroupId`, `parallelBranchRole`) for **hosts** to implement fan-out and fan-in. The hosted runtime must not silently claim parallel execution until **job semantics**, **cost caps**, **cancellation**, and **merge strategies** are defined.

## Goals

- **Async-friendly API** for long-running or parallel work: `POST …/runtime/jobs` creates a durable row; `GET …/runtime/jobs/{jobId}` returns status and opaque result summary (no secrets).
- **Fan-out:** Steps sharing a `parallelGroupId` run concurrent upstream calls subject to workspace limits.
- **Fan-in:** One or two **documented** merge strategies in v1 (e.g. `all_succeed`, `first_wins`) with explicit versioning.
- **Idempotency:** Clients may retry `POST` with an idempotency key; server deduplicates or returns the same `jobId` (future).

## Non-goals (initial slice)

- Replacing customer gateways for billing bytes twice without a product rule (see parent RFC).
- Arbitrary DAGs beyond parallel groups + linear backbone (see parent RFC).

## Current implementation (scaffold)

- **Table:** `hosted_runtime_jobs` (migration **033**); self-heal in `ensureIngestionRoutingSchema`.
- **POST** `…/routes/{routeId}/runtime/jobs` — same auth and body shape as **invoke** (`environmentId`, `messages`), plus optional **`async`** (enqueue, **202**), **`mergeStrategy`** (`first_wins` | `all_succeed`), and **`Idempotency-Key`** / **`idempotencyKey`** for deduplication. **Linear and parallel** routes run the hosted pipeline; results persist in **`result_summary`**. **`DELETE …/runtime/jobs/{jobId}`** requests cancellation (queued jobs cancel immediately; in-flight jobs stop at the next cooperative check).
- **GET** `…/runtime/jobs/{jobId}` — project-scoped read of status and stored summary.

## Future work

- **Worker process** (queue + poll or event-driven) for true async and parallel branches.
- **Webhooks** for terminal states (reuse workspace webhook patterns where product commits).
- **OpenAPI** and **MCP** parity once the async contract is stable.

## Security

- Same tenancy and credential rules as [runtime invoke](../security-baseline.md): decrypt only in scoped handlers; no raw keys in job payloads or logs.
