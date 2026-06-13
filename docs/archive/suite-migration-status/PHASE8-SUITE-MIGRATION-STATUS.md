# Phase 8 — Suite migration status (SOPHIA reference consumer sign-off)

**Programme:** [SUITE-ARCHITECTURE-MIGRATION.md](./SUITE-ARCHITECTURE-MIGRATION.md)  
**Branch:** `cursor/phase8-sophia-consumer-0cf6`  
**Last updated:** 2026-06-01  

---

## Goal

SOPHIA is the **reference consumer** of the Restormel suite: Keys REST/BYOK, Knowledge REST (optional), **Graph Web Components** (`@restormel/graph-elements`), and platform packages — without hosting platform logic or importing deprecated UI npm adapters directly.

---

## Graph Web Component cutover (mandatory)

| Surface | Action | Status |
| --- | --- | --- |
| Map / graph explorer (`GraphWorkspace`) | `<rg-graph-canvas>` via `GraphCanvasHost.svelte` | Done |
| Dev portability / dogfood routes | `GraphCanvasHost` | Done |
| `package.json` | Remove direct `@restormel/ui-graph-svelte` | Done (transitive via graph-elements) |
| Semantic styles | Import from `@restormel/graph-elements` | Done |

**Extended WC API:** `packages/graph-elements/src/rg-graph-canvas.ts` forwards full `GraphCanvas` props (focus, path, viewport commands, semantic styles).

---

## Optional hosted APIs (consumer wiring)

| API | Env | Client |
| --- | --- | --- |
| Knowledge | `CONNECT_API_BASE` + gateway key | `sophia` `knowledgeApiClient.ts` (Phase 6) |
| Graph layout | `GRAPH_API_BASE` + gateway key | `sophia` `graphLayoutApiClient.ts` (Phase 8) |

When unset, SOPHIA keeps in-process adapters / canvas layout.

---

## restormel-keys deliverables

| Item | Status |
| --- | --- |
| `rg-graph-canvas` full Graph Kit prop surface | Done |
| Re-export `graphCanvasEdgeKey` + semantic types from graph-elements | Done |
| `PHASE8-SUITE-MIGRATION-STATUS.md` | Done |
| Update `docs/restormel-graph-sophia-consumer.md` | Done |

---

## SOPHIA deliverables

| Item | Status |
| --- | --- |
| `GraphCanvasHost.svelte` | Done |
| Remove `@restormel/ui-graph-svelte` from dependencies | Done |
| `check:prod-deps-no-ui-graph-svelte` | Done |
| `graphLayoutApiClient` + tests | Done |

---

## Automated gate

```bash
# restormel-keys
pnpm --filter @restormel/graph-elements run build
pnpm --filter @restormel/graph-elements test

# sophia
pnpm run check:prod-deps-no-ui-graph-svelte
pnpm test
pnpm run smoke:restormel   # when staging secrets available
```

---

## Manual gate (pending)

| Review | Pass criteria |
| --- | --- |
| Product owner dogfood | Map + graph explorer parity vs pre–Phase 8 |
| Reference-consumer sign-off | SOPHIA is consumer, not hidden platform host |
| Ops | Ingest poller documented against Knowledge API |

Record in PR: `Stage gate: automated ✅ manual ☐`

---

## Programme complete

After Phase 8 manual gate passes, the **Suite Architecture Migration** programme (Phases 0–8) is complete for SOPHIA-class consumers.

**Post-programme:** [PHASE9-SUITE-MIGRATION-STATUS.md](./PHASE9-SUITE-MIGRATION-STATUS.md) (Knowledge Ingest job persistence / 5b). Ongoing: ingest workers (5c–5d), npm archive at Phase 7 window close (2026-12-01).
