# @restormel/reasoning-core

Knowledge **Verify** pipeline — claim extraction, reasoning quality evaluation, and epistemic constitution checks. Host apps inject LLM routing and `generateText` via **`ReasoningCoreContext`** (no SOPHIA vertex, DB, or engine imports).

## Install

```bash
npm install @restormel/reasoning-core @restormel/contracts
```

Peer: `ai` (Vercel AI SDK) when wiring real models in the host adapter.

## Usage

```ts
import {
  runVerificationPipeline,
  type ReasoningCoreContext,
} from "@restormel/reasoning-core";

const ctx: ReasoningCoreContext = {
  generateText: (params) => hostGenerateText(params),
  resolveExtractionRoute: (opts) => hostResolveExtraction(opts),
  resolveReasoningRoute: (opts) => hostResolveReasoning(opts),
  trackTokens: (input, output) => hostTrackTokens(input, output),
};

const result = await runVerificationPipeline(
  { text: "Argument to verify…" },
  {
    ctx,
    includePassOutputs: false,
  }
);
```

When `includePassOutputs` is true, pass a host hook (e.g. SOPHIA `runDomainAgnosticReasoning`):

```ts
await runVerificationPipeline(request, {
  ctx,
  runPassOutputs: (inputText, callbacks, opts) =>
    runDomainAgnosticReasoning(inputText, callbacks, opts),
});
```

## Publish

Tag **`platform-v*`** in the restormel-keys monorepo — see [docs/restormel/SUITE-ARCHITECTURE-MIGRATION.md](../../docs/restormel/SUITE-ARCHITECTURE-MIGRATION.md) Phase 3.

## Related

- Types/schemas: `@restormel/contracts/verification`, `@restormel/contracts/constitution`
- SOPHIA consumer adapter: `src/lib/server/verification/sophiaAdapter.ts` in the sophia repo
