# Phase 4 — AAIF

> **Time:** ~10 minutes  
> **Prerequisites:** [Phase 0](02-phase-0-overview.md) read; you want a structured request/response contract  
> **You'll need:** TypeScript or JavaScript; optional: an app that calls AI APIs

This phase introduces the Agent-to-Agent Interaction Format (AAIF): typed request and response shapes for predictable AI interactions. **Types, validation, and runtime helper** live in `@restormel/aaif`.

---

## Step 4.1 — Request shape

`AAIFRequest`:

- `input: string`
- `task?: "chat" | "completion" | "embedding"`
- `constraints?: { maxCost?: number; latency?: "low" | "balanced" | "high"; tokens?: { inputTokensM?: number; outputTokensM?: number } }`
- `user?: { id: string; plan?: string }`
- `routing?: { model?: string; provider?: string }`

---

## Step 4.2 — Response shape

`AAIFResponse`:

- `output: string`
- `provider: string`
- `model: string`
- `cost: number`
- `routing: { reason: string }`

---

## Step 4.3 — Install and use

```bash
pnpm add @restormel/aaif
# if npm returns 404, consume from workspace/local path until publish is completed
```

```ts
import type { AAIFRequest, AAIFResponse } from "@restormel/aaif";
import { isAAIFRequest, isAAIFResponse } from "@restormel/aaif";
```

Use the type guards to validate incoming/outgoing payloads. In this repo, the runtime helper is available as `executeAAIFRequest()` and integrates with `@restormel/keys` for routing + cost estimation.

Implementation workflow runbook: [runbooks/aaif-implementation-workflow.md](../runbooks/aaif-implementation-workflow.md)

### How to test

Import types and guards; pass a sample object to `isAAIFRequest` / `isAAIFResponse` and confirm they return true for valid shapes and false for invalid ones.

---

## Checkpoint

You now have:

- `@restormel/aaif` installed.
- Request/response types and validation guards in use (or ready for when the runtime exists).
- [AAIF reference](/keys/docs/integrations/aaif) bookmarked.
