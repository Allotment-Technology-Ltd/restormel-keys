# Rollback runbook — cascade verifier tiers (REC-ADR-023 build step 1B)

Per `restormel-component-plugpoints` §"Rollback procedure" and D-2026-07-02-1 (proceed
at-risk, rollback is the mitigation). This runbook covers the three CLEARED-set verifier
tiers wired behind the one `VerifierTier` port in `packages/connect-core/src/cascade/`:

| Tier role | Adapter file | Component (REC-GOV-022 verdict) |
|---|---|---|
| `prefilter` | `cascade/tiers/hhem-prefilter.ts` | HHEM-2.1-Open — CLEARED (Apache-2.0), recommended set |
| `mid` | `cascade/tiers/granite-mid.ts` | Granite Guardian 3.3 8B — CLEARED (Apache-2.0), recommended set |
| `escalation` | `cascade/tiers/frontier-escalation.ts` | frontier verification API — CLEARED, recommended set |
| `excluded_cheap_slot` | `cascade/tiers/excluded-cheap-slot-stub.ts` | STUB — candidates BLOCKED/AMBIGUOUS, no model wired |

> **Status of what shipped in step 1B:** the in-repo tier files are fixture-backed **doubles**
> (no weights, no credential, no network — connect-core stays MIT). The **live** adapters
> (self-hosted Granite/HHEM endpoints, a credentialed frontier route) are host-app wiring
> injected at the port seam via `buildDefaultCascade({ frontierGenerate })`. Rollback of the
> live adapters follows the same three tiers below; the doubles carry no credential to revoke.

## Six required fields (per adapter)

### Config key (composition root)
Single selection point: `cascade/default-cascade.ts` — one `{ role, tier }` slot entry per
tier. Disabling a tier = delete its slot object (and, for the escalation tier, the
`frontierGenerate`/`frontierModelFamily`/`frontierModelVersion` options) and redeploy the host
app. Selection is evaluated **once** here (plugpoints: one edit kills the surface). A missing
tier **fails closed**: the cascade continues with the remaining tiers, and a claim that cannot
be decided resolves to `abstained` (labelled-unverified / withheld per mode) — never a silent
pass (REC-ADR-023 invariant 3).

### Secret name (host-app live adapters only)
- `prefilter` / `mid` (self-hosted endpoints): endpoint URL/token secret, `ADAPTER_HHEM_*` /
  `ADAPTER_GRANITE_*` in Infisical (host app).
- `escalation`: `ADAPTER_FRONTIER_API_KEY` in Infisical (host app), injected into the
  `frontierGenerate` route.
- The in-repo doubles read **no** secret (they never touch `process.env`).

### Adapter id + version strings used in cache keys
Cache keys (`cascade/verdict-cache.ts`) fold `checkerId`, `checkerModelVersion`, and
`checkerConfigHash`:
- `hhem-2.1-open` / `2.1-open-double`
- `granite-guardian-3.3-8b` / `3.3-8b-double`
- `frontier-api` / (host-set model version)
Live adapters set real `modelVersion` strings; a version bump re-versions the key, so
dependent verdicts miss automatically (invalidation by construction).

### Purge commands (tier-2 evict)
Verdicts are keyed by adapter id + version with a `checker-version → entries` index. Evict one
tier's cached verdicts via the store port:
```ts
await cache.purgeByChecker("granite-guardian-3.3-8b", "<modelVersion>");
```
(`InMemoryVerdictCache.purgeByChecker` in-repo; a Postgres/Redis store implements the same
`VerdictCacheStore` method in the host app.) This is exercised by the purge test in
`__tests__/cascade-verdict-cache.test.ts`.

### Fallback adapter
Removing the `escalation` tier falls back to `mid` deciding or `abstained`; removing `mid`
falls back to `prefilter` deciding or `abstained`; removing `prefilter` sends everything
straight to `mid`. There is always the `abstained`-to-human terminal — no configuration
produces a silent pass.

### Rehearsal log
| Date | Environment | Tiers exercised | Outcome |
|---|---|---|---|
| pending | staging | tier-1 disable + tier-2 evict | **pending** — must be filled before first production use of any live adapter (plugpoints gate) |

## Three rollback tiers (all pre-tested; the PR's `## Excise dry-run` section carries the output)

Per-tier excise is independent: the fixture doubles share their lexical heuristics through the
NEUTRAL `cascade/tiers/heuristics.ts` module (never adapter-to-adapter), so `git rm` of any one
adapter file does not break a sibling's build (removability checks 1+2).

1. **Disable (same day):** delete the tier's slot in `default-cascade.ts`; redeploy the host
   app. Cascade falls back per the table above; fails closed.
2. **Evict (days):** `purgeByChecker(id, version)` to delete the tier's verdict-cache entries;
   re-queue affected documents for re-verification through the remaining tiers.
3. **Excise (within the sprint):** `git rm` the adapter file
   (`cascade/tiers/<tier>.ts`), delete its `default-cascade.ts` slot + options, its
   `cascade/index.ts` re-exports, its calibration band in `cascade/calibration.ts`, its tests,
   and (live) delete the Infisical secret. Run the removability checklist; record the removal
   in `planning/horizon/strategic-review-2026-07-01-decisions.md`. The **excise dry-run**
   (attached in the PR's `## Excise dry-run` section) proves this leaves the cascade spine
   (`cascade.ts`, `verdict.ts`, `verdict-cache.ts`, `economics.ts`) untouched and the package
   building green.

Instrumentation continuity: every verification is tagged with tier id + role (economics.ts —
cost/claim, cache-hit rate, tier distribution, abstention rate, latency per tier), so
post-rollback deltas are visible in the weekly CI gate; the ≥90%/≤2% bar is re-measured after
any swap or rollback (ADR invariant 4).
