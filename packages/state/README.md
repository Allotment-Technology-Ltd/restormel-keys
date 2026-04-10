# @restormel/state

**Restormel State** — append-only **agent memory events**, deterministic **materialized views**, and **correlation** helpers for `@restormel/context-packs` and `@restormel/observability`.

## Non-goals

- Vector databases, embeddings, or RAG retrieval services
- Orchestration / checkpoint runners (LangGraph-style)
- Storage backends or hosted dashboards (hosts persist events; this package projects them in memory)

## Install

```bash
npm install @restormel/state
```

Depends on **`@restormel/context-packs`** for `ContextPackRetrievalInput` correlation typing.

### Verify install

Scoped packages are **public**; a bare `404` on install is usually registry or auth misconfiguration, not a missing release.

```bash
npm view @restormel/state version
mkdir -p /tmp/rm-state-smoke && cd /tmp/rm-state-smoke && npm init -y && npm install @restormel/state@latest
```

### Compatibility with `@restormel/context-packs`

Use the **`peerDependencies`** range published on npm for `@restormel/context-packs` (see this package’s `package.json`). Bump minors together when correlation field shapes change; check both packages’ `CHANGELOG.md` for migration notes.

### Module format

**ESM only** (`"type": "module"`, Node **≥ 20**). Use `"moduleResolution": "node16"` or `"bundler"` in TypeScript.

### Host integration (persistence)

Storage is **host-owned**. Prefer an append-only log with monotonic ordering (e.g. `recorded_at` ascending; tie-break with `StateEvent.id` and `ts`). **`StateEvent.id` must be unique** within each batch you append. See [docs/restormel/RESTORMEL-STATE.md](../../docs/restormel/RESTORMEL-STATE.md) for the canonical model.

## Usage

```ts
import {
  attachCorrelationToRetrievalInput,
  projectWorkingMemory,
  workingMemoryToPromptBlock,
  type MemoryPolicy,
  type StateEvent,
} from "@restormel/state";

const policy: MemoryPolicy = {
  maxCellsPerScope: 20,
  maxApproxTokensPerScope: 8000,
};

const events: StateEvent[] = [
  {
    type: "memory_cell_upsert",
    id: "ev-1",
    ts: new Date().toISOString(),
    scope: "session",
    cell_id: "fact-1",
    text: "User prefers dark mode.",
    run_id: "run-123",
  },
];

const view = projectWorkingMemory(events, policy);
const block = workingMemoryToPromptBlock(view);

const packInput = attachCorrelationToRetrievalInput(
  { claims: [], relations: [], arguments: [], seed_claim_ids: [] },
  { run_id: "run-123", state_sequence: view.last_sequence }
);
```

## SOPHIA (Stoa)

Stoa-specific event builders live **only in SOPHIA** — they are not part of this package. Copy the reference module from [docs/restormel/state-sophia-integration.md](../../docs/restormel/state-sophia-integration.md) into your app.

## API (summary)

| Export | Role |
|--------|------|
| `projectWorkingMemory` | Fold + policy prune → `WorkingMemoryView` |
| `workingMemoryToPromptBlock` | Scopes → newline prompt text |
| `workingMemoryToDebugJson` | Operator/support JSON snapshot |
| `attachCorrelationToRetrievalInput` | Set `restormel_correlation` on context-pack input |
| `observabilityCorrelationFromView` | `run_id` + tail event + scope counts for traces/logs |
| `StateEvent`, `MemoryPolicy`, `WorkingMemoryView`, … | Types |

## Publishing

Tag **`platform-v*`** — [publish-restormel-platform.yml](../../.github/workflows/publish-restormel-platform.yml) (after `@restormel/context-packs`). See [CHANGELOG.md](./CHANGELOG.md).

## Docs

- **Integrator overview (in-app, same IA as Graph reasoning docs):** [Restormel State — restormel.dev](https://restormel.dev/graph/docs/extensions/state)
- **Repo canonical spec:** [docs/restormel/RESTORMEL-STATE.md](../../docs/restormel/RESTORMEL-STATE.md) (where docs live, non-goals, model)
- **SOPHIA hooks:** [docs/restormel/state-sophia-integration.md](../../docs/restormel/state-sophia-integration.md)
- **Suite package map:** [docs/restormel-monorepo-packages.md](../../docs/restormel-monorepo-packages.md)
- **npm reference:** [docs/reference/npm-packages.md](../../docs/reference/npm-packages.md)
