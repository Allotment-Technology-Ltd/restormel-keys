# `@restormel/graph-core`

**Restormel Graph Contract v0** — portable types and contracts-free helpers for interactive graph rendering.

- **`viewModel.ts`** — frozen DTOs only (no runtime logic, no `@restormel/contracts`).
- **`layout.ts`** — `computeLayout` (orbital placement).
- **`trace.ts`** — trace tag / label helpers for canvas copy.
- **`workspace.ts`** — generic filter and focus helpers (`WorkspaceGraphLike`, `filterGraph`, …).

See **`GRAPH_CORE_V0_SCOPE.md`** for what is in v0 vs explicitly deferred (compare, lineage, projection, …).

## Subpath exports

After `pnpm run build`, Node resolves:

- `@restormel/graph-core`
- `@restormel/graph-core/viewModel`
- `@restormel/graph-core/layout`
- `@restormel/graph-core/trace`
- `@restormel/graph-core/workspace`

## Build

```bash
pnpm --filter @restormel/graph-core run build
```

## Tests

```bash
pnpm --filter @restormel/graph-core test
```
