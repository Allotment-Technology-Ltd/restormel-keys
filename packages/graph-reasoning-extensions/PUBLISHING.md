# `@restormel/graph-reasoning-extensions` — publish and versioning

This package holds **contracts-coupled** reasoning graph logic (compare, diff, evaluation, lineage, projection, summary). It is **not** part of **Restormel Graph Contract v0** (frozen DTOs in `@restormel/graph-core` `viewModel.ts`). See [`packages/graph-core/GRAPH_CORE_V0_SCOPE.md`](https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/packages/graph-core/GRAPH_CORE_V0_SCOPE.md) and [restormel.dev/graph/docs](https://restormel.dev/graph/docs).

## Why a separate package

- **Contract v0** (`@restormel/graph-core`) stays free of `@restormel/contracts` for minimal renderers.
- **Reasoning extensions** depend on `@restormel/contracts` (including `reasoning-object`) and `@restormel/graph-core` (layout, workspace).
- Semver for **extensions** is **independent** of graph-core v0.

## Publish train

Push git tag **`platform-v*`** (e.g. `platform-v0.1.0`) → workflow **Publish Restormel platform packages** (`.github/workflows/publish-restormel-platform.yml`) publishes, in order:

1. `@restormel/contracts`
2. `@restormel/observability`
3. `@restormel/graph-reasoning-extensions`

Requires **`NPM_TOKEN`**. `pnpm publish` rewrites `workspace:*` to semver.

## SOPHIA reintegration

Replace `@sophia/graph-reasoning-extensions` imports with `@restormel/graph-reasoning-extensions` per [docs/archive/suite-migration-status/phase1-restormel-engineering-spec.md](../../docs/archive/suite-migration-status/phase1-restormel-engineering-spec.md) §6.

## Versioning policy

- **Major:** breaking public signatures or diff keys consumed by downstream UIs.
- **Minor:** new findings, optional fields, or additional stable subpath exports.
- **Patch:** bugfixes with no contract change.

## Pre-publish checklist

- [ ] `pnpm --filter @restormel/contracts test && pnpm --filter @restormel/contracts run build`
- [ ] `pnpm --filter @restormel/observability test && pnpm --filter @restormel/observability run build`
- [ ] `pnpm --filter @restormel/graph-reasoning-extensions test && pnpm --filter @restormel/graph-reasoning-extensions run build`
- [ ] `exports` in `package.json` match built `dist/*` entrypoints.

## Related

- [Restormel Graph — SOPHIA extraction artefacts](../../docs/archive/suite-migration-status/restormel-graph-sophia-extraction-artifacts.md)
- [Phase 1 engineering spec](../../docs/archive/suite-migration-status/phase1-restormel-engineering-spec.md)
