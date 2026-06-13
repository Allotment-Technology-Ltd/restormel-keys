# @restormel/context-packs

Pure, dependency-free TypeScript library that turns a **minimal graph-shaped retrieval payload** into three pass-specific text blocks (**analysis**, **critique**, **synthesis**) plus diagnostic stats for token budgets, role mix, reply chains, and unresolved tensions.

## Problem

Downstream LLM pipelines (for example SOPHIA’s multi-pass analysis) need **stable, budget-aware prose** built from claims, relations, and arguments — without importing database drivers, full retrieval DTOs, or SSE machinery.

## Install

```bash
npm install @restormel/context-packs
```

## Usage

```ts
import {
  buildPassSpecificContextPacks,
  type ContextPackRetrievalInput,
} from "@restormel/context-packs";

const input: ContextPackRetrievalInput = {
  claims: [
    {
      id: "c1",
      text: "Example claim text.",
      claim_type: "thesis",
      source_title: "Source A",
      confidence: 0.9,
    },
  ],
  relations: [],
  arguments: [],
  seed_claim_ids: ["c1"],
};

const packs = buildPassSpecificContextPacks(input, { depthMode: "standard" });
console.log(packs.analysis.block);
console.log(packs.analysis.stats.estimated_tokens, packs.analysis.stats.token_budget);
```

### Imports

- **Supported:** `import … from "@restormel/context-packs"` (ESM + TypeScript types via `dist/index.d.ts`).
- **CJS:** not shipped; consume from ESM bundlers or Node ESM.

### SOPHIA integration

SOPHIA keeps a full `RetrievalResult` in `engine.ts`. Map it into this package’s input with `contextPackInputFromRetrieval(result)` in SOPHIA (shallow pick of `claims`, `relations`, `arguments`, `seed_claim_ids`); that adapter lives in SOPHIA — **do not** import SOPHIA from this package.

## API

| Export | Role |
|--------|------|
| `buildPassSpecificContextPacks(input, options?)` | Main entry; `options.depthMode` is `quick` \| `standard` \| `deep` (token budgets per pass match SOPHIA). |
| `ContextPackRetrievalInput` | Input: `claims`, `relations`, `arguments`, `seed_claim_ids`. |
| `ContextPackClaim`, `ContextPackRelation`, `ContextPackArgument` | Element types; arguments may include `key_premises` and `conclusion_text` for ranking. |
| `PassSpecificContextPacks`, `ContextPack`, `ContextPackStats`, … | Output shapes and pass/role unions. |

Token **estimation** is `Math.ceil(characterLength / 4)`. See TSDoc on `ContextPackStats` for field meanings.

## Publishing

Tag **`platform-v*`** triggers [publish-restormel-platform.yml](../../.github/workflows/publish-restormel-platform.yml) together with other platform packages. See [CHANGELOG.md](./CHANGELOG.md) for semver policy.

## Docs

- Scope and parity: [docs/archive/suite-migration-status/phase2-context-packs-extraction-scope.md](../../docs/archive/suite-migration-status/phase2-context-packs-extraction-scope.md)
- Status / integration: [docs/archive/suite-migration-status/PHASE2-EXTRACTION-STATUS.md](../../docs/archive/suite-migration-status/PHASE2-EXTRACTION-STATUS.md)
