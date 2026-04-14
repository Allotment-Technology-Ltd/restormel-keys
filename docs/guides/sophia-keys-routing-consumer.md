# SOPHIA (and similar workers): consuming Keys routing

**Status:** Consumer checklist for apps **outside** this repository that run multi-stage LLM pipelines.

## 1. Model per pipeline stage

For each logical stage (extraction, relations, …):

1. Create a dedicated route with `workload: "ingestion"` and the matching `stage` (see [keys-routing-contract.md](../keys-routing-contract.md#ingestion-workload--stage)), **or** use a shared ingestion route with null `stage` as fallback.
2. Publish the route (`version === publishedVersion`) before production traffic.

## 2. Resolve

Call:

`POST /keys/dashboard/api/projects/{projectId}/resolve`

with at least `environmentId`, and either `routeId` or **`workload` + optional `stage`**.

Read:

- **`providerType` / `modelId`** for the winning tier.
- **`stepChain`** for the full ordered list (with rich metadata as of contract `2026-04-14`).
- **`fallbackCandidates`** for tiers after the winner.

## 3. Two consumption patterns

1. **Client-side tier walk:** use `stepChain` order; on transient failure, try the next row (respect policies and keys). Use `timeoutMs`, `retryPolicy`, `fallbackOn` from each row as hints.
2. **Server-advanced resolve:** call resolve again with `attemptNumber: 1, 2, …` and `previousFailure` from the last response so Keys skips exhausted tiers.

## 3b. Embedding

Use `stage: "ingestion_embedding"` and the same resolve pattern if embeddings should follow Keys routes instead of env-only defaults.

## 4. Deprecating side channels

Replace ad-hoc env JSON (e.g. base64 routing blobs) with **published routes** + resolve when parity is verified. Keep a migration window: merge Keys `stepChain` with any legacy canonical list if required, then narrow legacy usage.

## 5. Simulate before deploy

`POST .../routes/{routeId}/simulate` with `includeStepDiagnostics: true` to preview policy blocks and executability per step.

## 6. Publish vs draft (dashboard parity)

When `version !== publishedVersion`, discovery treats the route as **unpublished** for metadata-based selection; explicit `routeId` may still return `route_unpublished`. Operators should **publish** from the dashboard after edits. Any future **visual diff** UI must keep **accessible** status text (not color-only): use `role="status"` / visible labels for draft vs published (see dashboard route detail banner).

## 7. Typed AAIF carry (`routingPlan`)

Hosts may copy HTTP **`stepChain`** / **`routingAttempts`** into **`AAIFRequest.routingPlan`** (`@restormel/aaif` **0.0.11+**) for logging or downstream agents. See [examples/aaif-resolve-then-execute/README.md](../../examples/aaif-resolve-then-execute/README.md).
