---
id: REC-ADR-009
title: "ADR: Provider-abstracted per-workspace database provisioning across tiers (EU-sovereign default, Neon quick-start)"
class: decision
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-23
last-reviewed: 2026-06-23
review-interval: P12M
related: [REC-ADR-008]
---

# ADR: Provider-abstracted per-workspace database provisioning across tiers (EU-sovereign default, Neon quick-start)

**Status: Draft — decision direction recorded, NOTHING provisioned, no tier default-on.**
This ADR records the recommended tenancy model and phased path for Stage-2 (the *physical*
per-workspace database question that REC-ADR-008 / PR #277 deferred). It authorises **no**
provisioning code, no infrastructure change, no sub-processor onboarding, and no customer-facing
tier. **No tier is default-on until founder sign-off.** The companion plan
(`scratchpad/tenant-db-provisioning-design.md`, Step-1 design) carries the governance triplet
drafts and pricing recommendation that this ADR depends on.

## Context

REC-ADR-008 (PR #277) is the **EU-sovereign DEFAULT tier** in a multi-tier design: every
workspace's graph lives as `workspace_id`-scoped *rows* inside one shared dashboard Postgres
(the live `useDashboardDatabase` path in
`apps/dashboard/src/lib/server/connect/graph-target-service.ts`; every helper in
`apps/dashboard/src/lib/server/neon.ts` carries a `WHERE workspace_id = $1` predicate). That is
the **logical** model. This ADR addresses the **physical** question: when does a workspace stop
being *rows in a shared DB* and become *its own database*, how is that provisioned safely, and how
do other tiers (a Neon-backed quick-start) sit alongside it under one provider-abstracted
interface.

**The binding constraint is topology, not capacity.** The production data-plane runs on **one**
Hetzner cx43 node (`restormel-sovereign-master1`, hel1, 8 vCPU / ~15.25 GiB) that is **at the
16-PersistentVolume attachment cap**. Node CPU/RAM are light (~12% / ~48%), but each CNPG cluster
+ its WAL volume consumes PVs, and single-node loss = total-estate outage. This kills per-tenant
*clusters* as a default and forces the recommended model below
(`scratchpad/phase1-infra-groundtruth.md`).

## Decision

### 1. Tenancy model (recommended)

Adopt **per-tenant DATABASE with a scoped, non-superuser role, inside ONE shared sovereign CNPG
cluster (`pg-restormel`)** as the sovereign per-workspace unit. It gives catalog-level isolation
and a clean `DROP DATABASE` erasure primitive **without consuming a PV per tenant** — the only
model that respects the 16-PV cap while scaling to the workspace counts Connect needs. Rejected
alternatives:

| Model | Why not the default |
|---|---|
| Shared DB + row scoping (REC-ADR-008 logical) | Kept as the MVP / quick-start spine, but isolation relies entirely on app-layer `WHERE` discipline. |
| **Per-tenant DATABASE, shared cluster** | **RECOMMENDED** — catalog isolation, `DROP DATABASE` erasure, 0 extra PVs. |
| Per-tenant CNPG `Cluster` (own pods/PVs) | Strongest isolation but ~6–7 tenants TOTAL before the 16-PV cap; reserved for a gated premium "dedicated instance" SKU only. |
| Schema-per-tenant | Strictly worse than per-tenant DATABASE at the same density (weaker isolation, migration fan-out). Rejected. |

### 2. Provider-abstracted interface

The `graph-target-service` abstraction is the seam: call sites do not know which physical model
or provider backs a workspace. The same provision / suspend / delete lifecycle state machine
(keyed on `workspace_id`) drives both the sovereign tier and the Neon quick-start tier;
credentials are always held encrypted-at-rest server-side via the existing `credential-crypto`
module and never exposed in plaintext or logs.

### 3. Phased path (each phase ships independently, fail-closed)

- **Phase 0 — Logical MVP (today, REC-ADR-008 DEFAULT tier).** Default + quick-start both ride
  shared row-scoped Postgres. Ship only the *tenancy-model abstraction* so call sites are
  provider/model-agnostic. **This is the only phase required before GA; everything below is
  opt-in / scale-driven.**
- **Phase 1 — Per-tenant DATABASE on the sovereign cluster (the Stage-2 deliverable).** A
  workspace can be *promoted* from shared rows to its own `db_ws_<id>` + scoped role on
  `pg-restormel` via an idempotent, fail-closed provisioning controller (declarative CNPG
  `Database`/managed-role + ESO-delivered secret; never superuser creds in the app). This is
  where physical sovereignty is actually delivered.
- **Phase 2 — Dedicated `Cluster` SKU (deferred, HA-gated).** Per-tenant CNPG `Cluster` for a
  premium tier — **blocked** until the estate is multi-node (the single cx43 + 16-PV cap make it
  unsafe at any volume today).

### 4. Tier defaults

- **EU-sovereign self-hosted (CNPG, hel1) = the DEFAULT tier.** It is the premium, defensible,
  data-residency product and carries margin.
- **Neon = a labelled, non-sovereign OPT-IN quick-start tier**, one Neon project per workspace,
  **EU region `aws-eu-central-1` (Frankfurt)** pinned immutably at creation, funded by the Neon
  open-source-programme credit (~USD 5000/yr) via Neon for Platforms. It is the cheap/free signup
  funnel — never the default, always clearly labelled non-sovereign with the sovereign option one
  click away.

> **Framing note (resolves the REC-ADR-008 wording):** Neon here is **not** legacy technical debt.
> The legacy Neon backup project (decommissioning by 2026-06-30 under RISK-004) is a *separate,
> dying* relationship. This ADR re-introduces Neon in a **new, distinct, active role** — a managed
> quick-start tier pursued via the OSS programme — alongside the EU-sovereign DEFAULT tier that
> REC-ADR-008 specifies.

### 5. Governance dependency (Neon tier is a NEW sub-processor)

The Neon quick-start tier processes **customer personal data on a US-company-managed DB** — a
higher risk class than the legacy backup ever was, and **a new sub-processor relationship**. Before
the tier may be offered:

- `governance/suppliers.yaml` — a **new active** sub-processor entry (NOT an edit to the legacy
  decommissioning entry); the Art-28 sub-processor change-notification hook MUST fire.
- `governance/ropa.yaml` — a new processing activity (PROC-009, lawful basis = contract; transfers
  governed by Neon DPA + SCCs/IDTA despite EU residency).
- `evidence/dpia/neon-quick-start-tier.md` — a DPIA (control-tier 3) recording the Schrems-II /
  US-government-access residual risk, accepted **only** because the tier is opt-in, labelled, and
  shadowed by a fully sovereign default.
- Cross-record touches: `data-inventory.yaml`, `asset-inventory.yaml`, `risk-register.yaml`,
  `ce-control-mapping.md` / `soa.md`, and the privacy notice sub-processor list.

These are drafted (with `[PLACEHOLDER]` fields) in the companion plan and require founder sign-off
before filing. **The tier does not go live until the governance triplet is filed.**

### 6. Cost-recovery pricing direction

True marginal cost of a sovereign per-tenant DB in the shipping (shared-cluster, separate-database)
regime is **~EUR 0.50–1.00 / workspace / mo** — dominated by the fixed node + ops allocation, not
storage or volumes. Recommended direction (founder sets the list price):

- **Sovereign Standard ≈ £5–6 / workspace / mo flat + £0.50/GB over a generous quota** — wide margin
  funds the owed HA / multi-node / DR work; priced as the premium tier, not a loss-leader.
- **Sovereign Isolated (dedicated CNPG cluster) ≈ £25–40 / mo**, gated behind the 16-PV capacity
  work — covers its ~EUR 3.30/mo cost plus the scarce-volume opportunity cost.
- **Neon quick-start = the free/cheap funnel**, OSS-credit-funded (scale-to-zero sustains hundreds
  of mostly-idle trial workspaces), with a per-workspace credit cap and graduation to sovereign or
  BYO-key for heavy/steady users.

### 7. Lifecycle ties to GDPR Art-17 (erasure) and Art-20 (export)

- **Art-17 erasure / day-0 reset.** The per-tenant `DROP DATABASE db_ws_<id>` (sovereign) or
  Neon `DELETE /projects/{id}` (quick-start) is the **physical erasure primitive** the logical tier
  lacks — atomic and provable, vs the per-resource scoped `DELETE`s in `neon.ts` today (which
  remain, but should be wrapped in a single audited `eraseWorkspace()` transaction).
  - **Documented erasure-completion lag (flag):** CNPG Barman backups to fsn1 retain WAL/base
    backups for **30 days**, so a `DROP DATABASE` does not erase the tenant from backups for up to
    30 days. The DPIA/RoPA MUST state this lag (or a per-tenant logical backup stream is needed for
    true point-of-request erasure). Founder decision required.
- **Art-20 portability / export.** Per-tenant physical isolation makes a clean, complete export
  (per-DB `pg_dump` / Neon project export) tractable — a stronger portability story than scraping
  workspace-scoped rows out of a shared DB.

## Consequences

- **Positive:** strong tenant isolation without breaking the PV cap; atomic erasure/export
  primitives; a provider-abstracted seam that lets the sovereign default and the Neon funnel
  coexist; a cost-recovery pricing basis with margin to fund HA.
- **Risks / open items (founder sign-off gates):** single-node SPOF + 16-PV cap make any *physical*
  per-tenant default non-viable today (no availability claim until multi-node); the new
  direct-credential surface and the 30-day backup-residue erasure lag are the two items the DPIA
  must record; several Neon capability/contract claims are unverified against the Neon for Platforms
  contract; migration tooling (Neon↔sovereign, BYO-key) is an unbudgeted build dependency. Issuing
  direct DB credentials and any Postgres/Connect server-route work MUST pass the
  `restormel-high-risk-security` review before build.

## References

- REC-ADR-008 (PR #277) — EU-sovereign DEFAULT tier (logical model this Stage-2 extends).
- Companion plan: `scratchpad/tenant-db-provisioning-design.md` (Step-1 design; governance triplet
  drafts + pricing).
- `scratchpad/phase1-infra-groundtruth.md`, `scratchpad/phase2-infra-recommendations.md` — infra
  cost/capacity ground truth.
- Code seams: `graph-target-service.ts`, `neon.ts`, `credential-crypto.ts`,
  `connect-readonly-profile.ts`, `deploy/k3s/cnpg/eso-secret-placeholders.yaml`.
