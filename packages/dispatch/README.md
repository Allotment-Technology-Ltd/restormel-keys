# @restormel/dispatch

**Restormel Dispatch** — the in-process model-execution **Interaction Format**: a structured request/response envelope for predictable AI interactions, plus runtime helpers that integrate with **Restormel Keys** routing and cost estimation. Dispatch is an in-process contract, **not a wire protocol** — for spec-conformant cross-agent interop see A2A (Agent2Agent).

Dispatch is designed to keep the contract stable across different host apps and agent frameworks:

- Your host sends a `DispatchRequest`.
- Dispatch runtime helpers resolve provider/model via `@restormel/keys`.
- Dispatch runtime helpers estimate cost from token-volume hints.
- Your host provides the final `output` (optionally via a callback).

> **Renamed from `@restormel/aaif`.** This package was previously published as
> `@restormel/aaif` with `AAIF*` identifiers (the "Agent-to-Agent Interaction Format").
> The acronym collided with the Agentic AI Foundation and implied a wire protocol it never
> was, so it is renamed to **Dispatch** (`AAIF* → Dispatch*`). Every old `AAIF*` name is
> still exported as a `@deprecated` alias during the pre-1.0 grace period — migrate to the
> `Dispatch*` names; the aliases are removed at 1.0.

## Install

```bash
pnpm add @restormel/dispatch @restormel/keys
```

## Types + validation

```ts
import type { DispatchRequest, DispatchResponse } from "@restormel/dispatch";
import { isDispatchRequest, isDispatchResponse } from "@restormel/dispatch";
```

## Routing context vs dashboard resolve

- **`routingContext`** (optional on `DispatchRequest`) carries **hints** aligned with Keys resolve: `routeId`, `workload`, `stage`, `attemptNumber`, `previousFailure`, `failureKind`. Use it so logs and downstream services share one vocabulary with SOPHIA-style pipelines.
- **`routingPlan`** (optional) holds typed **`DispatchRoutingPlan`** / **`DispatchRoutingPlanStep`** / **`DispatchRoutingAttempt`** shapes so you can attach a copy of HTTP **`stepChain`** / **`routingAttempts`** from simulate without re-deriving types in the host.
- **`integrationStack`** (optional) declares **third-party products** in the host environment (Neon, Vercel, gateways, model providers, CI). It does **not** change resolve or model selection; use it for logs, MCP agents, and analytics. Shape: `{ schemaVersion: "1", templateId?: string, components: { id: string, role?: string }[] }` where each `id` is one of **`INTEGRATION_COMPONENT_IDS`** exported from this package (see `src/integration-stack-catalog.ts`). **`isDispatchRequest`** validates the field when present. The dashboard **Stack setup** wizard and marketing **ecosystem** catalog use the same ids via **`INTEGRATION_CATALOG`** / **`INTEGRATION_STACK_TEMPLATES`**.
- **Semver (pre-1.0):** additive optional fields on `DispatchRequest` and expansions to `DispatchRoutingPlan*` / `DispatchRoutingPlanStep` are **patch** bumps (for example **0.0.10 → 0.0.11** for `routingPlan`). Hosts should pin a range and read the package **CHANGELOG** when upgrading.
- **Full `stepChain`** and **simulate diagnostics** come from the **dashboard HTTP API** (`POST …/resolve`, `POST …/routes/{routeId}/simulate`), not from `executeDispatchRequest`. Typical pattern: **resolve → execute** in the host. Example walkthrough (placeholders only): [examples/aaif-resolve-then-execute/README.md](../../examples/aaif-resolve-then-execute/README.md).
- Human + agent canonical doc: [docs/architecture/keys-routing-contract.md](../../docs/architecture/keys-routing-contract.md) — public mirror [/keys/docs/guides/routing-contract](https://restormel.dev/keys/docs/guides/routing-contract). MCP: `docs.canonical_resolve` topic **`keys_routing_contract`**, suite tool **`routing.capabilities`**.

## Runtime helper (routing + cost)

```ts
import { createKeys, openaiProvider } from "@restormel/keys";
import { executeDispatchRequest } from "@restormel/dispatch";

const keys = createKeys(
  {
    routing: { defaultProvider: "openai" },
    keys: [{ id: "k1", provider: "openai" }],
  },
  { providers: [openaiProvider] },
);

const response = await executeDispatchRequest(
  {
    input: "Write a one-paragraph summary.",
    task: "completion",
    routing: { model: "gpt-4o-mini" },
    constraints: {
      tokens: { inputTokensM: 1, outputTokensM: 1 },
      maxCost: 1.0,
    },
  },
  keys,
  {
    // Optional: host supplies actual model output
    generate: async ({ cost }) => `host_output_placeholder(cost=${cost})`,
  },
);
```

### Notes on cost

`DispatchResponse.cost` is computed from `inputTokensM` / `outputTokensM` hints (in millions) and provider pricing in `@restormel/keys`.

If you don’t provide token hints, the runtime defaults to `1M` input and `1M` output.

## Security

- Do not log or expose raw API keys in Dispatch runtime code or errors.
- The runtime helpers do not call upstream providers directly. Instead, they only resolve routing and estimate cost; the host controls actual upstream execution.

## Verified-context envelope (Stage 4.3)

Non-MCP agent frameworks (LangChain, LlamaIndex, custom orchestrators) can carry the full
verified-claim envelope in Dispatch request/response payloads without the MCP server.

**Two optional fields — one on each side of the envelope:**

- **`DispatchRequest.verifiedContext`** (`DispatchVerifiedContextInput`) — the Connect-sourced,
  EBV-verified claim envelopes the host is feeding as grounded context *to* the model.
- **`DispatchResponse.verifiedContext`** (`DispatchVerifiedContextOutput`) — the same envelopes
  echoed back with a per-state count summary, so a downstream consumer can inspect
  verification metadata without a separate Connect API roundtrip.

```ts
import {
  buildVerifiedContextInput,
  buildVerifiedContextOutput,
  allClaimsSupported,
  getSupportedClaims,
  isDispatchVerifiedClaimEnvelope,
} from "@restormel/dispatch";
import type { DispatchVerifiedClaimEnvelope } from "@restormel/dispatch";

// 1. Fetch verified claims from Connect v1 and validate them
const rawClaims = await connectClient.retrieve(query);
const claims: DispatchVerifiedClaimEnvelope[] = rawClaims.filter(isDispatchVerifiedClaimEnvelope);

// 2. Thread into the request
const request: DispatchRequest = {
  input: buildPromptWithClaims(claims),
  verifiedContext: buildVerifiedContextInput(claims, traceRef),
};

// 3. Execute and attach context to response
const response = await executeDispatchRequest(request, keys, { generate: myLlm });
response.verifiedContext = buildVerifiedContextOutput(claims, traceRef);

// 4. Consume verification metadata
const supported = getSupportedClaims(response);
console.log(response.verifiedContext?.summary); // e.g. { supported: 3, inferred: 1 }
```

Types are plain TypeScript — **no Zod runtime dependency**. For Zod-validated parsing use
`VerifiedClaimEnvelopeSchema` from `@restormel/contracts`.

Full integration guide: [docs/guides/aaif-verified-context.md](../../docs/guides/aaif-verified-context.md).

**Semver:** additive optional fields on `DispatchRequest` / `DispatchResponse` are **patch bumps**
(0.0.18 → 0.0.19 for this addition).

## Parity with MCP (Horizon Phase 1)

**Dispatch** today is the structured **HTTP-shaped** contract for **Keys routing + cost** inside app hosts (`executeDispatchRequest` + `@restormel/keys`).

**Suite-wide read operations** (canonical doc map, Testing config validation, RunTrace summarization, GraphData structural checks, State memory preview) ship as **`@restormel/mcp` stdio tools** first. The same semantics are available over HTTP as **`POST /keys/dashboard/api/suite/invoke`** (and **`POST /api/suite/invoke`** through the Zuplo gateway with a consumer key). Request envelope: [docs/integrations/restormel-suite-tool-envelope.schema.json](../../docs/integrations/restormel-suite-tool-envelope.schema.json).

**Optional type:** `import type { RestormelSuiteToolName } from "@restormel/dispatch"` — the same string union as **`@restormel/mcp`** suite tools (kept in sync in source; optional peer **`@restormel/mcp@>=0.2.0`** when you use the MCP server). Future work may add a typed Dispatch extension or a shared JSON Schema for a generic “tool envelope” across HTTP and MCP.

Human / agent parity table: [docs/architecture/THEME-L-MCP-PARITY.md](../../docs/architecture/THEME-L-MCP-PARITY.md).

