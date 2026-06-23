---
id: REC-ADR-007
title: "ADR: Host-managed Postgres graph store as the default onboarding tier, provider-abstracted"
class: decision
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-23
last-reviewed: 2026-06-23
review-interval: P12M
related: [REC-ADR-003, REC-ADR-004, REC-PLAN-012]
---

# ADR: Host-managed Postgres graph store as the default onboarding tier, provider-abstracted

**Status: Draft — direction recorded, NOT default-on in prod.** This ADR records the chosen
direction for the Connect zero-setup onboarding tier. It does **not** authorise any flag flip,
endpoint rename, migration, or traffic change. The module flag `connectNeonGraphStore`
(to be renamed — see below) **stays `false` in `MVP_MODULE_DEFAULTS` and OFF in prod** until
founder sign-off after Stage-1 build + the G4 retrieval gate is green on Postgres. The later
Stage-1 implementation PR touches Postgres credentials + SvelteKit server routes + graph
credentials and is therefore subject to a mandatory `restormel-high-risk-security` review before
it opens (not before this ADR).

## Context

Connect onboarding currently requires the user to bring their own graph store (BYO Surreal/Neo4j)
before they can run an ingest. A host-managed Postgres "graph spine" already exists dashboard-side
(`migrations/038_knowledge_graph_postgres_spine.sql`; the `*Postgres` writer/read functions in
`apps/dashboard/src/lib/server/neon.ts`; `PostgresGraphWriter` in `graph-writer.ts`) and the
one-click provisioner `connectDashboardNeonTarget()` already upserts a credential-free
`provider:"postgres", use_dashboard_database:true` target that reuses the dashboard's own
server-side `DATABASE_URL`. The write/ingest/review/memory paths on this spine are fully wired.

Two things block making it the **default happy path**:

1. The auto-provision is gated behind a module flag that **defaults OFF**
   (`MVP_MODULE_DEFAULTS.connectNeonGraphStore = false`, `module-flags-types.ts:62`), and the
   target provider defaults to `surreal`.
2. **Query-time retrieval does not yet read the Postgres spine.** A real `GraphStore` is built
   only when `targetRow.provider === "surreal"` (`connect-v1/graph-orchestrator-service.ts:142-153`);
   a Postgres target falls through to `emptyGraphStore`. `graphrag-core` ships no `postgres` adapter
   (`AdapterFactory.ts` switches surrealdb/neo4j/weaviate/neptune/arangodb only). So a
   Postgres-defaulted workspace **ingests fine but retrieves empty** — the opposite of a happy path.
   Closing this (a `PostgresGraphStore` or a Postgres-native retrieval path) is out of scope for
   this ADR's decision but is the load-bearing Stage-1 build item, and is what the G4 gate guards.

The store names itself "Neon" throughout the code (flag id `connectNeonGraphStore`, PostHog key
`restormel-module-connect-neon-graph-store`, `connectDashboardNeonTarget`, route segment
`/graph-target/neon`, UI label "Workspace Neon database", the file `neon.ts`). This is **legacy
naming debt only** — the actual store is the self-hosted EU Postgres (verified `DATABASE_URL` →
in-cluster Postgres on the .167 box, `AUTH_PROVIDER=self`). There is no Neon/US managed-DB
dependency and none should be implied.

## Decision

1. **Backend = self-hosted EU Postgres (SOVEREIGN).** The default onboarding graph store is the
   host-managed, credential-free Postgres spine that reuses the dashboard's own `DATABASE_URL`.
   Custody stays Restormel-side; no secret is surfaced. A managed sub-tier (e.g. Neon-for-Platforms)
   is a possible **future** option — explicitly **OUT of scope** here. This ADR creates **no Neon/US
   dependency**.

2. **This is a RETRIEVAL / STARTER tier, not the graph-native engine.** The Postgres spine is a
   relational retrieval store, **not** the graph-native beam-traversal reasoning engine. It is the
   low-friction starting tier; the graph-native experience remains a BYO (Surreal/Neo4j) path. The
   onboarding guide MUST NOT claim parity with the graph-native engine.

3. **Verification contract is identical; the parity boundary is exact.** Evidence-Bound Verification
   (EBV) is store-free — verbatim-span binding, source-version-hash re-check, cross-model entailment,
   and abstention all run in memory over extracted units and write a `verification_state` regardless
   of store. Therefore **G2 (≥90% supported, ≤2% unsupported; `assertG2Targets`) transfers to the
   Postgres spine unchanged.** What does **NOT** transfer for free is the **store-side trust-state
   retrieval filter**: the strict/annotated predicate is compiled to SurrealQL
   (`graphrag-core/src/retrieve-context.ts:138-165`) using Surreal-specific null semantics
   (`verification_state = NONE` → Postgres `IS NULL`). A Postgres adapter re-implements that predicate
   from scratch. **G4 (golden-query context hit@k vs the SOPHIA baseline) MUST be re-validated on
   Postgres — with zero strict-mode claim-set delta vs Surreal — before any "parity" or "verified
   retrieval on the host-managed graph" claim is made.** Until G4 is green on Postgres, no new
   claims-ledger row for Postgres parity may be marked `proven`, and ledger row #4 (strict-mode
   "excluded, not blended") is treated as conditionally store-scoped.

4. **Tenancy = shared dashboard Postgres with workspace-scoped rows (logical isolation).** All spine
   tables FK to `workspaces` and are queried workspace-scoped. This is logical, not physical,
   isolation. Physical isolation (per-tenant DB / managed sub-tier) is a later decision, not this one.

5. **Rename `connectNeonGraphStore` → host-managed Postgres graph store, with back-compat aliases.**
   Rename the flag id, PostHog key, env tokens, endpoint segment, service fn, and UI labels to a
   sovereign-Postgres naming (`connectHostManagedGraphStore`, etc.). The rename is **presentation /
   flag-layer only** and MUST preserve:
   - the **OFF default** in `MVP_MODULE_DEFAULTS` and the env-builder seed;
   - **PostHog dual-read** of the old key until the EU-project flag is migrated (else any env with
     the rollout ON silently reverts to MVP-default OFF — coordination dependency, not code-only);
   - the **old env tokens** (`connect_neon_graph_store` / kebab) as permanent aliases so existing
     Coolify `RESTORMEL_MODULE_FLAGS` values keep working;
   - an **alias / 308 route** at `/graph-target/neon` alongside the new `/graph-target/host-managed`.
   The persisted discriminator column `knowledge_graph_targets.use_dashboard_database` and the
   provider value `"postgres"` are the **data-compat boundary — NOT renamed** (column rename would
   need a migration and is excluded). The error code `connect_neon_graph_store_disabled` may be
   renamed (it leaks "Neon") only after inventorying external/SOPHIA consumers. The broad legacy
   "Neon" naming elsewhere (`$lib/server/neon.ts`, Neon-Auth references) is a **separate follow-up
   rename program**, out of scope here. CSS `--brut-neon` accent tokens are explicitly excluded.

6. **STATUS: draft — no default-on in prod until founder sign-off.** `MVP_MODULE_DEFAULTS` stays OFF.
   Per-env enablement remains via PostHog / `RESTORMEL_MODULE_FLAGS`. Default-on is gated on:
   (a) Stage-1 build incl. the Postgres retrieval path; (b) the EBV parity suite green (esp. the
   `verification_state = NONE` → `IS NULL` predicate-equivalence test); (c) G4 green on Postgres vs
   the SOPHIA baseline, recorded as a committed dated snapshot + CI gate; (d) founder sign-off.

## Consequences

- **Positive:** zero-setup onboarding; sovereign EU data residency by default; custody stays
  Restormel-side; EBV/G2 guarantees ship on day one; BYO graph-native path preserved as an override.
- **Costs / risks:** a Postgres retrieval path is net-new (embeddings are `JSONB` today with no
  `pgvector` index — an ANN decision is required); the SurrealQL trust-state predicate must be
  re-implemented and proven equivalent (highest-risk parity surface); PostHog/env/route aliases are a
  coordination, not code-only, change; provenance-audit Postgres branch is partial. Mandatory
  `restormel-high-risk-security` review before the Stage-1 implementation PR.
- **Reversible:** the flag stays OFF until all gates pass; BYO continues to work throughout; no
  destructive migration is implied.

## Out of scope

Managed Neon-for-Platforms sub-tier; physical per-tenant isolation; Neo4j BYO provider (no path
today); the broad `neon.ts` / Neon-Auth rename program; the `use_dashboard_database` column rename.
