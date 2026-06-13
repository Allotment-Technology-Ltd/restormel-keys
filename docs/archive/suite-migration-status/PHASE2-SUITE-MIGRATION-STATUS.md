# Phase 2 — Suite migration status (Graph Layout REST + Web Components)

**Programme:** [SUITE-ARCHITECTURE-MIGRATION.md](./SUITE-ARCHITECTURE-MIGRATION.md)  
**Branch:** `cursor/phase2-graph-rest-wc-0cf6`  
**Last updated:** 2026-06-01  

---

## Goal

Graph visualisation without `@restormel/ui-graph-svelte` npm for new integrators; Layout REST wraps `@restormel/graph-core`.

---

## Deliverables

| Item | Status |
| --- | --- |
| `@restormel/graph-elements` (`<rg-graph-canvas>`) | Done — `packages/graph-elements/` |
| `POST /graph/v1/layout` | Done — `apps/dashboard/src/routes/graph/v1/layout/` |
| `GET /graph/v1/snapshots/{snapshotId}` | Done — 404 until Phase 6 persistence |
| Zuplo Graph v1 routes + `validate-zuplo-graph-v1.mjs` | Done |
| Docs `/graph/docs/integration/web-components` | Done |
| `@restormel/ui-graph-svelte` maintenance mode README | Done |
| OpenAPI draft Graph v1 **implemented** | Done |

**SOPHIA:** No WC adoption this phase (Phase 8). No sophia repo changes.

---

## Automated gate

```bash
pnpm run smoke:graph-consumer
pnpm --filter @restormel/graph-elements run build
pnpm --filter dashboard run test -- src/lib/server/graph-v1-layout.test.ts src/routes/graph/v1/graph-v1-api.test.ts
pnpm --filter dashboard run build
node scripts/check-graph-dashboard-doc-routes.mjs
node scripts/validate-openapi-suite-draft.mjs
node scripts/validate-zuplo-graph-v1.mjs
pnpm run review-docs
pnpm run hygiene
pnpm run check-secrets
```

---

## Manual gate (pending)

| Review | Pass criteria |
| --- | --- |
| WC embed demo | Plain HTML page renders `<rg-graph-canvas>` with sample GraphData |
| Layout API parity | Positions match in-process `computeLayout` on staging sample |
| OpenAPI | Product owner accepts Graph v1 namespace |

Record in PR: `Stage gate: automated ✅ manual ☐`

---

## Next phase

**Phase 3 — Knowledge Verify extraction** — see [SUITE-ARCHITECTURE-MIGRATION.md § Phase 3](./SUITE-ARCHITECTURE-MIGRATION.md#phase-3--knowledge-verify-extract--publish--reintegrate-sophia).

Do not start Phase 3 until Phase 2 manual gate is signed off.
