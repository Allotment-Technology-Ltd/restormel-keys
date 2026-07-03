---
title: ADR: AAIF envelope placement
class: decision
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-08
last-reviewed: 2026-06-11
review-interval: P12M
---

# ADR: AAIF envelope placement

**Status:** Provisional — **pending review. No implementation has been done.** (Stage 5B item 4.)

**Context:** AAIF request/response envelopes (`AAIFRequest` → `AAIFResponse` in `@restormel/aaif`)
describe a *model-execution* call: an input plus routing/cost constraints in, and a generated
output plus the provider/model/cost/routing-reason that produced it out. Today the suite HTTP
surface is `POST /api/suite/invoke` (Zuplo) → `POST /keys/dashboard/api/suite/invoke`, which takes
`{ tool: RestormelSuiteToolName, payload }` and runs **read-only** suite tools (docs, testing,
observability, graph, state, connect read paths). The question is whether AAIF envelopes should ride
on `/api/suite/invoke` or get their own route.

**Decision (proposed):** AAIF envelopes should be served by a **new, dedicated route** (e.g.
`POST /api/aaif/execute`), **not** overloaded onto `/api/suite/invoke`. Rationale: (1) **Different
contract** — `/api/suite/invoke` is a `{ tool, payload }` dispatcher over a closed enum of read-only
tools, whereas AAIF is a single fixed request/response schema for model execution; conflating them
forces a discriminated union and weakens both. (2) **Different side-effects and billing** — AAIF
execution incurs real LLM cost and should sit on the metered/quota'd runtime path, while suite tools
are free, read-only, and cacheable; sharing a route muddies rate-limit, quota, and audit policy.
(3) **Independent versioning** — AAIF is already a stable, additively-versioned envelope in its own
package; a dedicated route lets it version without touching the suite-tool registry. The lighter
alternative (a `tool: "aaif.execute"` entry on the existing route) was considered and rejected
because it would require AAIF to masquerade as a suite tool and inherit the read-only route's
semantics.

**Next step:** Review and confirm before any routing/handler work. This document records the
recommendation only.

---

## Stage 4.3 update — verified-claim envelope placement in AAIF (implemented)

**Status:** Implemented (PR — `fable/aaif-verification-envelope`).

**Question:** Where in the AAIF request/response envelopes should the verified-claim block
sit, so non-MCP consumers (LangChain, LlamaIndex, custom orchestrators) can read
verification metadata?

**Decision:** Two symmetric optional fields, one on each side of the envelope:

- **`AAIFRequest.verifiedContext: AAIFVerifiedContextInput`** — the host-supplied verified
  claim envelopes being fed as grounded context *to* the model. The host fetches these from
  Connect v1 `retrieve` (or the MCP `connect.retrieve_verified` tool), serialises them into
  the model prompt however it likes, and threads the raw envelopes through the AAIF request
  so routing/audit logs have provenance metadata.

- **`AAIFResponse.verifiedContext: AAIFVerifiedContextOutput`** — the same envelopes echoed
  back on the response (plus an auto-computed per-state summary). A non-MCP consumer reads
  this field to inspect which verified claims shaped the response without a separate Connect
  API roundtrip. The host is responsible for populating this field from the request context
  (or from its own retrieval step); `executeAAIFRequest` carries it through if the host
  supplies it.

**Why not a new field on `AAIFRoutingContext`?**
`routingContext` carries *routing/retry metadata* aligned with the dashboard `resolve` path.
Verification context is orthogonal — it is about which factual claims grounded the model's
context window, not about how the routing decision was made. Mixing them muddies the ADR
invariant that `routingContext` is a pass-through mirror of the dashboard's vocabulary.

**Why not extend `integrationStack`?**
`integrationStack` is a declaration of *infrastructure products* in the host environment
(Neon, Vercel, gateways). Verified claims are runtime per-request context, not static
infrastructure declarations.

**Is this a breaking AAIF change?**
No. Both fields are *additive optional* additions to `AAIFRequest` and `AAIFResponse`.
Per the AAIF semver discipline (stated in `packages/aaif/README.md`): additive optional
fields on the request/response envelopes are **patch bumps** (0.0.18 → 0.0.19). Existing
hosts that do not supply verified context continue to work unchanged.

**Wire-up pattern (non-MCP consumer):**

```ts
// 1. Fetch verified claims from Connect v1
const connectResult = await fetch("/connect/v1/retrieve", { ... });
const claims = await connectResult.json(); // VerifiedClaimEnvelope[]

// 2. Build the AAIF request with verified context
const request: AAIFRequest = {
  input: buildPrompt(claims),
  verifiedContext: buildVerifiedContextInput(claims, traceRef),
};

// 3. Execute via AAIF runtime
const response = await executeAAIFRequest(request, keys, {
  generate: async (ctx) => myLlm(ctx.request.input),
});

// 4. Attach verified context to response (host responsibility)
response.verifiedContext = buildVerifiedContextOutput(claims, traceRef);

// 5. Downstream consumer reads verification metadata from the response
const supported = getSupportedClaims(response);
```

**Types added in `@restormel/aaif@0.0.19`** (all plain TypeScript — zero Zod dependency):
`AAIFVerifiedClaimState`, `AAIFEvidenceMatch`, `AAIFVerifiedClaimEvidence`,
`AAIFVerifiedClaimJudge`, `AAIFVerifiedClaimEnvelope`, `AAIFVerifiedContextInput`,
`AAIFVerifiedContextOutput`.

**Helpers added:** `buildVerifiedContextInput`, `buildVerifiedContextOutput`,
`summariseVerifiedClaims`, `filterClaimsByState`, `allClaimsSupported`,
`hasContradictedClaims`, `getRequestVerifiedContext`, `getResponseVerifiedContext`,
`getSupportedClaims`.

**Validators added:** `isAAIFVerifiedClaimEnvelope`, `isAAIFVerifiedContextInput`,
`isAAIFVerifiedContextOutput` (all exported from `@restormel/aaif`).
