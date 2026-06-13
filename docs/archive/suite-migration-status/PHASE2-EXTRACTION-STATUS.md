# Phase 2 — context packs extraction (status)

**Package:** [`@restormel/context-packs`](../../packages/context-packs/) (`packages/context-packs`)

**Purpose:** Portable pass-specific context blocks for SOPHIA-style multi-pass LLM flows, without Surreal/engine imports.

## Current status

- [x] `buildPassSpecificContextPacks(input, options?)` implemented; public input type is **`ContextPackRetrievalInput` only** (no `RetrievalResult` import in the library).
- [x] `ContextPackArgument` includes optional **`key_premises`** and **`conclusion_text`** (argument scoring matches SOPHIA `RetrievedArgument` heuristics).
- [x] Vitest parity tests ported from SOPHIA `contextPacks.test.ts` (portable fixture JSON).
- [x] README, CHANGELOG, TSDoc, CI build + test on platform job; npm publish wired on **`platform-v*`** train with other platform packages.

**First npm version:** `0.1.0` — treat as **initial**; breaking vs additive changes tracked in [packages/context-packs/CHANGELOG.md](../../packages/context-packs/CHANGELOG.md).

## Post-publish integration (SOPHIA)

1. Add dependency: `@restormel/context-packs` (version from npm after publish).
2. Replace local `buildPassSpecificContextPacks` import with `import { buildPassSpecificContextPacks } from '@restormel/context-packs'`.
3. Call with `buildPassSpecificContextPacks(contextPackInputFromRetrieval(retrievalResult), { depthMode })` — keep `contextPackInputFromRetrieval` in SOPHIA next to `engine.ts` (adapter only).
4. Remove duplicated `contextPacks.ts` / tests once CI parity is confirmed, or keep a thin drift test that runs the same fixture against the package.
5. **OpenAPI:** this library has no HTTP surface. If a Cloud API later returns pack text, document it in Restormel Keys OpenAPI **upstream first**, then consume in SOPHIA.

## References

- Scope + checklist: [phase2-context-packs-extraction-scope.md](./phase2-context-packs-extraction-scope.md)
- Agent prompt (copy-paste): [phase2-agent-prompt-restormel-engineering.md](./phase2-agent-prompt-restormel-engineering.md)
- Phase 1 programme (graph/platform): [PHASE1-EXTRACTION-STATUS.md](./PHASE1-EXTRACTION-STATUS.md)
- Graph extraction map: [04-delivery/restormel-graph-sophia-extraction-artifacts.md](./04-delivery/restormel-graph-sophia-extraction-artifacts.md)
