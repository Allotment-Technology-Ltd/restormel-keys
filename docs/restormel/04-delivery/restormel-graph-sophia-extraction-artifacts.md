# Restormel Graph — SOPHIA extraction artefacts

**Purpose:** file map, integration contract, portability notes, and parity checklist for splitting interactive graph rendering out of the SOPHIA codebase into Restormel platform packages.

**Phase 1 programme (broader extraction):** agent prompt + engineering spec (packages, acceptance pointers, §6 SOPHIA reintegration) — **[docs/restormel/phase1-agent-prompt-restormel-engineering.md](../phase1-agent-prompt-restormel-engineering.md)** and **[docs/restormel/phase1-restormel-engineering-spec.md](../phase1-restormel-engineering-spec.md)**.

**Canonical implementation (this repo):**

| Path | Role |
|------|------|
| `packages/graph-core/src/viewModel.ts` | **Contract v0** — frozen DTOs (banner: `RESTORMEL GRAPH CONTRACT v0`) |
| `packages/graph-core/src/layout.ts` | `computeLayout` — orbital placement; no contracts import |
| `packages/graph-core/src/trace.ts` | Trace label helpers; no contracts import |
| `packages/graph-core/src/workspace.ts` | Generic filter/scope helpers; no contracts import |
| `packages/graph-core/GRAPH_CORE_V0_SCOPE.md` | What is v0 vs deferred |
| `packages/ui-graph-svelte/src/lib/GraphCanvas.svelte` | SVG canvas: zoom, pan, selection, ghost layer, viewport controls |
| `packages/ui-graph-svelte/src/lib/NodeDetail.svelte` | Optional inline node detail |
| `packages/ui-graph-svelte/src/lib/semanticStyles.ts` | `graphCanvasEdgeKey` + canvas semantic style types |
| `apps/restormel-graph-demo/src/routes/dev/graph-portability/+page.svelte` | Portability proof: mock `GraphData` + `GraphCanvas` |

**Reference in SOPHIA** (port source; do not depend at runtime from these packages):

| SOPHIA path | Role |
|-------------|------|
| `packages/graph-core/src/*` | Upstream graph-core (may include non-v0 modules + `contracts`) |
| `src/lib/components/visualization/GraphCanvas.svelte` | Canvas reference |
| `src/lib/graph-kit/adapters/sophiaGraphData.ts` | Consumer adapter: `graphDataFromSophiaGraphKit(...) : GraphData` — stays in SOPHIA |

## Integration contract

- Hosts map domain state to **`GraphData`** (`nodes`, `edges`, `ghostNodes`, `ghostEdges`).
- Renderers consume **`GraphData`** plus optional **`nodeSemanticStyles`** / **`edgeSemanticStyles`** (see `GraphRendererProps` in `viewModel.ts`).
- **No** Graph Kit VM or reasoning contracts inside `ui-graph-svelte`.

## Portability notes

- **restormel-keys** `graph-core` ships **MVP only**: no `compare`, `lineage`, `projection`, `diff`, `evaluation`, `summary`, and **no** `@restormel/contracts` dependency.
- TypeScript `NodeNext` in this repo uses explicit `.js` extensions in relative imports inside `graph-core` (mechanical portability vs SOPHIA source). `layout.ts` adds explicit types on the `reduce` callback (same numeric result as SOPHIA).
- `GraphRendererProps` JSDoc in `viewModel.ts` points at `@restormel/ui-graph-svelte` (SOPHIA still had a stale “until ui-graph-svelte exists” line).
- Demo app loads a **subset mirror** of SOPHIA `design-tokens.css` so CSS-variable-driven colours match.

## Parity checklist

- [x] Contract v0 file matches SOPHIA `viewModel.ts` (types only).
- [x] `computeLayout` matches SOPHIA `layout.ts` (same algorithm; minor typing fix in reduce callback).
- [x] `trace.ts` / `workspace.ts` match SOPHIA.
- [x] `GraphCanvas` / `NodeDetail` / `semanticStyles` behaviour and structure aligned with SOPHIA.
- [x] Mock-data demo route without SOPHIA adapter.

## SOPHIA consumer integration

Single handoff doc: **[docs/restormel-graph-sophia-consumer.md](../../restormel-graph-sophia-consumer.md)** (npm vs tarball, imports, CSS variables, Vite `ssr.noExternal`, duplicate-code removal, drift checks).

## Gaps / non-goals (MVP)

- SOPHIA-only adapters and stores are **not** included.
- **Publishing:** git tag **`graph-v*`** → **Publish Graph packages** workflow; see consumer doc §1.
