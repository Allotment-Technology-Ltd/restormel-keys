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

