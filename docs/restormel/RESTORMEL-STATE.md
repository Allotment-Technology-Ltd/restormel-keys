# Restormel State (`@restormel/state`)

**Purpose:** Portable **agent memory timeline** types, deterministic **materialized views**, and **correlation** hooks that tie working memory to `@restormel/context-packs` and `@restormel/observability` runs.

**Package:** [`packages/state`](../../packages/state) — publishes on tag **`platform-v*`** with other platform packages (after `@restormel/context-packs`).

## Where this documentation lives (canonical map)

| Audience | Location | Role |
|----------|----------|------|
| **Repo / maintainers** | This file + [`state-sophia-integration.md`](./state-sophia-integration.md) | Single source of truth for behaviour, non-goals, and SOPHIA wiring. |
| **Integrators (in-app)** | [Restormel Graph docs — Restormel State](https://restormel.dev/graph/docs/extensions/state) | Same information architecture as **Reasoning extensions** and **context packs**: graph-aware LLM stacks often adopt State alongside canvas + `platform-v*` packages. State is **not** a `graph-v*` canvas package; the Graph docs site is a **discovery surface**, not an ownership boundary. |
| **Suite package map** | [`docs/restormel-monorepo-packages.md`](../restormel-monorepo-packages.md) | Workspace path and publish train. |
| **npm consumers** | [`docs/reference/npm-packages.md`](../reference/npm-packages.md) | `npm view`, install notes. |
| **Programme context** | [`phase1-restormel-engineering-spec.md`](./phase1-restormel-engineering-spec.md) | Platform objectives table. |

**Not under Restormel Graph as a product line:** Restormel State is **suite platform** (Keys, SOPHIA, plotbudget, allotment.works, and so on). It is documented under **Graph → Extensions** on restormel.dev only because that is where integrators already find **context packs** and **reasoning extensions**—the same “retrieval + LLM + optional UI” story.

## Non-goals

- Vector search, embedding stores, or RAG pipelines
- Workflow engines, LangGraph-style checkpoint execution, or durable task queues
- Hosted persistence or operator UI (hosts store append-only events; this library only **projects** them)

## Core model

1. **Append-only `StateEvent` stream** — upsert / remove / pin / summarize-compact / scope clear (see package `README`).
2. **`MemoryPolicy`** — per-scope caps on cell count and approximate tokens; unpinned cells evict LRU first.
3. **`projectWorkingMemory(events, policy)`** — pure fold + prune → `WorkingMemoryView`.
4. **Correlation** — `attachCorrelationToRetrievalInput` adds `restormel_correlation` to `ContextPackRetrievalInput`; `observabilityCorrelationFromView` builds a small struct for traces/logs next to `run_id`.

## SOPHIA integration

Step-by-step hook points (Stoa dialogue, escalation): [state-sophia-integration.md](./state-sophia-integration.md).

## Related docs

- Context packs: [PHASE2-EXTRACTION-STATUS.md](./PHASE2-EXTRACTION-STATUS.md)
- Platform programme: [phase1-restormel-engineering-spec.md](./phase1-restormel-engineering-spec.md)
- npm reference: [docs/reference/npm-packages.md](../reference/npm-packages.md)
