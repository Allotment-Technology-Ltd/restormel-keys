# Phase 3 — Suite migration status (Knowledge Verify extraction)

**Programme:** [SUITE-ARCHITECTURE-MIGRATION.md](./SUITE-ARCHITECTURE-MIGRATION.md)  
**Branch:** `cursor/phase3-knowledge-verify-0cf6`  
**Last updated:** 2026-06-01  

---

## Goal

Verification pipeline lives in **`@restormel/reasoning-core`** (restormel-keys monorepo); SOPHIA consumes via **`sophiaAdapter.ts`** with parity tests unchanged.

---

## Deliverables

| Item | Status |
| --- | --- |
| `packages/reasoning-core` — extraction, reasoning eval, constitution, pipeline | Done |
| `ReasoningCoreContext` DI (no vertex/engine in package) | Done |
| Optional `runPassOutputs` hook (SOPHIA `runDomainAgnosticReasoning`) | Done |
| Platform publish workflow (`platform-v*`) includes reasoning-core | Done |
| SOPHIA `sophiaAdapter.ts` + thin delegates | Done |
| Legacy SOPHIA implementation files retained (delete after one release cycle) | Done |

**Restormel Dashboard / Knowledge REST:** Not in scope this phase (Phase 6).

---

## Automated gate

```bash
# restormel-keys
pnpm --filter @restormel/reasoning-core run build
pnpm --filter @restormel/reasoning-core test
pnpm run test:platform-packages

# sophia
pnpm check
pnpm vitest run src/lib/server/routes/verify-v1-route.test.ts
pnpm vitest run src/lib/server/verification/pipeline.test.ts
pnpm test
```

---

## Manual gate (pending)

| Review | Pass criteria |
| --- | --- |
| Staging `/api/v1/verify` | JSON/SSE output unchanged vs pre-extraction baseline |
| Constitution rules | Deterministic + LLM batch behaviour unchanged on sample corpus |

Record in PR: `Stage gate: automated ✅ manual ☐`

---

## Next phase

**Phase 4 — Knowledge Retrieve extraction** — see [SUITE-ARCHITECTURE-MIGRATION.md § Phase 4](./SUITE-ARCHITECTURE-MIGRATION.md#phase-4--knowledge-retrieve-extract--publish--reintegrate-sophia).

Do not start Phase 4 until Phase 3 manual gate is signed off.
