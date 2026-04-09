# `@restormel/graph-core` — Restormel Graph **Contract v0** scope

This file **locks** what “v0” means for cross-platform work. In **restormel-keys**, `@restormel/graph-core` ships **only** Contract v0 plus the contracts-free helpers listed below. The SOPHIA app may still publish a broader `@restormel/graph-core` with legacy modules; consumers of this repo’s package should treat **this** tree as the MVP surface.

## Contract v0 (frozen — platform review required to change)

**Single source file:** `src/viewModel.ts`

**Exported types (DTOs only):**

- `GraphNode`, `GraphEdge`, `GraphGhostNode`, `GraphGhostEdge`
- `GraphData`
- `GraphViewportCommand`, `GraphRendererProps`
- `GraphNodeSemanticStyle`, `GraphEdgeSemanticStyle`
- Supporting unions: `GraphPhase`, `GraphNodeKind`, `GraphArcKind`, `GraphRejectionReasonCode`, `GraphConflictStatus`, `GraphViewportCommandType`

**Invariants:**

- No imports from SOPHIA or `@restormel/contracts`.
- No runtime logic in `viewModel.ts` (types/interfaces only).

## Explicitly **out of scope** for Contract v0 (future extraction targets)

These modules **depend on `@restormel/contracts`** (or reasoning-object) and are **not** part of the frozen DTO contract:

| Module | Role |
|--------|------|
| `compare.ts` | Reasoning snapshot compare |
| `lineage.ts` | Lineage report / markdown |
| `projection.ts` | Retrieval-like → graph snapshot |
| `diff.ts` | Graph diff |
| `evaluation.ts` | Reasoning graph evaluation |
| `summary.ts` | Snapshot summary |

Do **not** import these from a minimal Restormel Graph dashboard that only needs interactive rendering.

## Co-located **render utilities** (zero `contracts` import today)

SOPHIA’s `GraphCanvas` currently imports these from the same package; they are **not** the frozen DTO file but are **allowed dependencies** for SVG rendering until moved to `ui-graph-svelte`:

| Module | Role |
|--------|------|
| `layout.ts` | `computeLayout` (orbital placement) |
| `trace.ts` | `getNodeTraceTags`, `getNodeTraceLabel`, `formatTraceTag` (label formatting) |
| `workspace.ts` | Generic filter/scope helpers (`WorkspaceGraphLike` — no contracts) |

Restormel may vendor or co-publish these alongside Contract v0 when splitting packages.

## Package dependency note

**restormel-keys** `packages/graph-core` has **no** `@restormel/contracts` dependency. **Contract v0** (`viewModel.ts`) does not use that dependency.
