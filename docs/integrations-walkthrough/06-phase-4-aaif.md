# Phase 4 — AAIF

> **Time:** ~10 minutes  
> **Prerequisites:** [Phase 0](02-phase-0-overview.md) read; you want a structured request/response contract  
> **You'll need:** TypeScript or JavaScript; optional: an app that calls AI APIs

This phase introduces the Agent-to-Agent Interaction Format (AAIF): typed request and response shapes for predictable AI interactions. **Types and validation** live in `@restormel/aaif`; runtime integration with routing is planned.

---

## Step 4.1 — Request shape

`AAIFRequest`:

- `input: string`
- `task?: "chat" | "completion" | "embedding"`
- `constraints?: { maxCost?: number; latency?: "low" | "balanced" | "high" }`
- `user?: { id: string; plan?: string }`

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
```

```ts
import type { AAIFRequest, AAIFResponse } from "@restormel/aaif";
import { isAAIFRequest, isAAIFResponse } from "@restormel/aaif";
```

Use the type guards to validate incoming/outgoing payloads. When the AAIF runtime is available, you will send `AAIFRequest` to the service and receive `AAIFResponse`.

### How to test

Import types and guards; pass a sample object to `isAAIFRequest` / `isAAIFResponse` and confirm they return true for valid shapes and false for invalid ones.

---

## Checkpoint

You now have:

- `@restormel/aaif` installed.
- Request/response types and validation guards in use (or ready for when the runtime exists).
- [AAIF reference](/keys/docs/integrations/aaif) bookmarked.
