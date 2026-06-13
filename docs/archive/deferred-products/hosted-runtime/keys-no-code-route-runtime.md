# RFC: Hosted no-code route runtime (Keys data plane)

**Status:** Draft (design / phasing).  
**Audience:** Product, security, SOPHIA-class integrators.  
**Related:** [docs/keys-routing-contract.md](../keys-routing-contract.md), [docs/guides/resolve-to-execution-contract.md](../guides/resolve-to-execution-contract.md), [docs/security-baseline.md](../security-baseline.md), [docs/threat-model-starter.md](../threat-model-starter.md).

## Problem

Today, **resolve** and **simulate** answer *which* provider/model (and rich metadata) a **host** should use. The host still **calls** upstream APIs, applies retries, and advances tiers using its own runtime. The dashboard **visual graph** (Option B) configures **order** and **per-step policies** in the control plane, but there is **no** Restormel-hosted execution path that runs a full flow **without** customer code.

**Goal:** Offer an optional **hosted runtime** so operators can run route-defined flows from HTTP alone (“no-code” relative to the host app), while preserving trust boundaries, tenancy, and the existing resolve contract for integrators who keep execution in their own workers.

## Non-goals (initial phases)

- Replacing **Zuplo** or customer proxies where those already terminate traffic; this RFC assumes **either** Keys-hosted invoke **or** external proxy, not duplicate billing for the same byte twice without a clear product rule.
- **General-purpose workflow** (arbitrary HTTP nodes, human tasks, CRM): out of scope; scope stays **LLM route execution** aligned with existing route/step semantics.
- **Guaranteed** parity with every gateway feature (streaming modes, all providers day one): phased.

## Current trust boundary (unchanged unless opted in)

| Layer | Responsibility |
|-------|------------------|
| Keys control plane | Routes, steps, graph edges, policies, resolve/simulate, credentials **storage** (encrypted), audit surfaces |
| Host / gateway | **Execution** unless customer opts into hosted invoke |

Hosted runtime **adds** an explicit **opt-in execution path** inside Keys (or a dedicated worker service sharing the same auth and DB), not a silent change to resolve.

## Phased delivery

### Phase 1 — Hosted single-step invoke (MVP “no-code”)

**User story:** With a Gateway key, `POST …/runtime/invoke` with `environmentId` + **messages** (or equivalent body) executes **one** resolved step: resolve → pick credentials for resolved `providerType` → **server-side** upstream request → return assistant content + usage metadata. **No** raw API keys in responses.

**Requirements:**

- **Auth:** Same as resolve (Gateway key or session); project scoping unchanged.
- **Credentials:** Use existing **Connections** / provider integration decrypt paths; never log secrets ([security baseline](../security-baseline.md)).
- **Providers:** Start with **OpenAI-compatible** HTTP (one base URL pattern); expand per provider with explicit matrices in OpenAPI.
- **Logging:** Reuse **request_logs** / usage aggregation; extend metadata with `routeStepId` when present for **route_step** policy caps (see existing `metadata` design).
- **Errors:** Stable `error` codes; no key material in error bodies.

**API sketch (illustrative):**

`POST /keys/dashboard/api/projects/{projectId}/routes/{routeId}/runtime/invoke`

```json
{
  "environmentId": "…",
  "messages": [{ "role": "user", "content": "…" }]
}
```

Response: `{ "content": "…", "usage": { … }, "resolved": { …subset of resolve… } }` — exact shape to be versioned (`runtimeContractVersion`).

### Phase 2 — Graph-linear execution

Walk **enabled** steps in **graph order** (or linear `orderIndex` when no edges): on failure matching persisted **`fallbackOn`** / **`attemptNumber`** semantics, advance to next step **inside** the same request or via documented **continuation token** (long-running chains need idempotency and timeouts).

**Status (repo):** **Shipped (sync)** — `POST …/runtime/invoke` walks the linear chain in one request, chains messages (later steps append the previous assistant output as a `user` message), aggregates usage, returns optional **`runtimeSteps[]`**, and enforces step count + wall-time caps (`runtimeContractVersion` **2026-06-01**). **Continuation tokens** for very long chains remain **future** work.

- Respect **policy** evaluation per step (already modeled for resolve).
- **Pool** steps: same selection rules as resolve; one member per invoke unless extended.

### Phase 3 — Server-evaluated switch criteria (optional)

Today **`switchCriteria`** / **`advanceOn`** remain **hints** for **resolve** and for **hosts**. **Hosted runtime** (`POST …/runtime/invoke`) evaluates a **narrow allowlist** only: upstream failures are classified to **`error`** / **`rate_limit`** (and analogous kinds), then **`fallbackOn`** and filtered **`advanceOn`** decide whether to **advance** to the next enabled step instead of returning **502**. Version: **`runtimeSwitchEvalVersion`** (paired with `runtimeContractVersion` **2026-06-01**). **Simulate** may include **`hostedRuntimeSwitch`** when **`includeHostedSwitchEvaluation`** is true. Arbitrary expressions or LLM-as-judge are **out of scope**.

### Phase 4 — Parallel groups

**Scaffold (repo):** `POST …/runtime/jobs` and **`hosted_runtime_jobs`** persistence; **linear and parallel** routes use the same invoke pipeline (parallel merge strategies + optional async queue + worker drain); **idempotency** and **cancel** on **`DELETE …/runtime/jobs/{jobId}`**. Design: [keys-hosted-runtime-parallel-jobs.md](keys-hosted-runtime-parallel-jobs.md).

## Security and compliance

- **Secrets:** Only server-side decrypt; rotate and audit per existing integration model.
- **Tenancy:** Every invoke must validate **project** + **environment** + route ownership (same as resolve).
- **Abuse:** Rate limits per Gateway key / workspace; entitlements (Pro vs free) must gate hosted invoke if it has higher cost than resolve-only.
- **Data residency / logging:** Same classes as resolve + request logs; document **retention** for message bodies if stored (default: avoid storing full prompts; prefer hashes / aggregates).

## Relationship to resolve

- **Resolve** remains the **decision** API; hosted invoke **calls** resolve internally (or shared library) before execution.
- Integrators can **mix**: use resolve-only in their worker, or delegate execution to Phase 1–2 endpoints.

## Open questions

1. **Zuplo vs Keys:** Should hosted invoke live **behind** the same gateway route as today’s customers, or only on dashboard API origin? (Affects latency, billing, DDoS.)
2. **Streaming:** SSE/chunked responses vs buffered only for v1.
3. **Idempotency:** Required for multi-step continuations and retries at scale.

## Implementation note (repo)

When Phase 1 is approved, add: OpenAPI + dashboard doc page + tests + `CHANGELOG`; consider **`@restormel/keys`** client types if the surface is stable.

## Dashboard vocabulary (Keys, not generic CS)

Operator-facing UI should use **routing** language, not implementation terms:

| Avoid on labels / help text | Prefer |
|-----------------------------|--------|
| Graph, edge, node (as jargon) | **Route map**, **next-step link**, **step**, **first step** |
| Canvas (as a product noun) | **Route map** (layout is optional detail) |
| Connect (ambiguous) | **Link next steps** |

Internal APIs and migrations may still use `route_step_edges`, `flow_layout`, etc.; that is **backend vocabulary**.

---

*This RFC does not implement execution by itself; it defines the path from control-plane-only to a full no-code **hosted** runtime.*
