# @restormel/aaif

**Agent-to-Agent Interaction Format (AAIF)** — a structured request/response contract for predictable AI interactions, plus runtime helpers that integrate with **Restormel Keys** routing and cost estimation.

AAIF is designed to keep the contract stable across different host apps and agent frameworks:

- Your host sends an `AAIFRequest`.
- AAIF runtime helpers resolve provider/model via `@restormel/keys`.
- AAIF runtime helpers estimate cost from token-volume hints.
- Your host provides the final `output` (optionally via a callback).

## Install

```bash
pnpm add @restormel/aaif @restormel/keys
```

## Types + validation

```ts
import type { AAIFRequest, AAIFResponse } from "@restormel/aaif";
import { isAAIFRequest, isAAIFResponse } from "@restormel/aaif";
```

## Routing context vs dashboard resolve

- **`routingContext`** (optional on `AAIFRequest`) carries **hints** aligned with Keys resolve: `routeId`, `workload`, `stage`, `attemptNumber`, `previousFailure`, `failureKind`. Use it so logs and downstream services share one vocabulary with SOPHIA-style pipelines.
- **`routingPlan`** (optional) holds typed **`AAIFRoutingPlan`** / **`AAIFRoutingPlanStep`** / **`AAIFRoutingAttempt`** shapes so you can attach a copy of HTTP **`stepChain`** / **`routingAttempts`** from simulate without re-deriving types in the host.
- **Semver (pre-1.0):** additive optional fields on `AAIFRequest` and expansions to `AAIFRoutingPlan*` / `AAIFRoutingPlanStep` are **patch** bumps (for example **0.0.10 → 0.0.11** for `routingPlan`). Hosts should pin a range and read the package **CHANGELOG** when upgrading.
- **Full `stepChain`** and **simulate diagnostics** come from the **dashboard HTTP API** (`POST …/resolve`, `POST …/routes/{routeId}/simulate`), not from `executeAAIFRequest`. Typical pattern: **resolve → execute** in the host. Example walkthrough (placeholders only): [examples/aaif-resolve-then-execute/README.md](../../examples/aaif-resolve-then-execute/README.md).
- Human + agent canonical doc: [docs/keys-routing-contract.md](../../docs/keys-routing-contract.md) — public mirror [/keys/docs/guides/routing-contract](https://restormel.dev/keys/docs/guides/routing-contract). MCP: `docs.canonical_resolve` topic **`keys_routing_contract`**, suite tool **`routing.capabilities`**.

## Runtime helper (routing + cost)

```ts
import { createKeys, openaiProvider } from "@restormel/keys";
import { executeAAIFRequest } from "@restormel/aaif";

const keys = createKeys(
  {
    routing: { defaultProvider: "openai" },
    keys: [{ id: "k1", provider: "openai" }],
  },
  { providers: [openaiProvider] },
);

const response = await executeAAIFRequest(
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

`AAIFResponse.cost` is computed from `inputTokensM` / `outputTokensM` hints (in millions) and provider pricing in `@restormel/keys`.

If you don’t provide token hints, the runtime defaults to `1M` input and `1M` output.

## Security

- Do not log or expose raw API keys in AAIF runtime code or errors.
- The runtime helpers do not call upstream providers directly. Instead, they only resolve routing and estimate cost; the host controls actual upstream execution.

## Parity with MCP (Horizon Phase 1)

**AAIF** today is the structured **HTTP-shaped** contract for **Keys routing + cost** inside app hosts (`executeAAIFRequest` + `@restormel/keys`).

**Suite-wide read operations** (canonical doc map, Testing config validation, RunTrace summarization, GraphData structural checks, State memory preview) ship as **`@restormel/mcp` stdio tools** first. The same semantics are available over HTTP as **`POST /keys/dashboard/api/suite/invoke`** (and **`POST /api/suite/invoke`** through the Zuplo gateway with a consumer key). Request envelope: [docs/integrations/restormel-suite-tool-envelope.schema.json](../../docs/integrations/restormel-suite-tool-envelope.schema.json).

**Optional type:** `import type { RestormelSuiteToolName } from "@restormel/aaif"` — the same string union as **`@restormel/mcp`** suite tools (kept in sync in source; optional peer **`@restormel/mcp@>=0.2.0`** when you use the MCP server). Future work may add a typed AAIF extension or a shared JSON Schema for a generic “tool envelope” across HTTP and MCP.

Human / agent parity table: [docs/restormel/THEME-L-MCP-PARITY.md](../../docs/restormel/THEME-L-MCP-PARITY.md).

