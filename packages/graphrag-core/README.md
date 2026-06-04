# @restormel/graphrag-core

Graph-aware **Retrieve** pipeline for Knowledge RAG — hybrid dense/lexical seeding, beam graph traversal, argument closure, and LLM context formatting. Host apps inject **`GraphStore`** and **`EmbeddingPort`** (no Surreal driver in this package).

## Install

```bash
npm install @restormel/graphrag-core @restormel/contracts
```

## Usage

```ts
import {
  retrieveContext,
  buildContextBlock,
  type GraphRagDeps,
} from "@restormel/graphrag-core";

const deps: GraphRagDeps = {
  store: sophiaGraphStore,
  embedder: { embedQuery: (text) => hostEmbedQuery(text) },
  resolveOriginBucket: (url, sourceType) => hostOriginBucket(url, sourceType),
};

const result = await retrieveContext("What is epistemic injustice?", deps, {
  topK: 6,
  maxClaims: 24,
});

const promptBlock = buildContextBlock(result);
```

Compose with **`@restormel/context-packs`** for pass-specific analysis/critique/synthesis blocks (host adapter maps `RetrievalResult` → `ContextPackRetrievalInput`).

## Publish

Tag **`platform-v*`** in the restormel-keys monorepo — see [docs/restormel/SUITE-ARCHITECTURE-MIGRATION.md](../../docs/restormel/SUITE-ARCHITECTURE-MIGRATION.md) Phase 4.
