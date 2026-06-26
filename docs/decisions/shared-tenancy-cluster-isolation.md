---
id: REC-ADR-010
title: "ADR: Shared-tenancy on the in-scope K3s cluster — accept residual risk vs. isolate"
class: decision
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-26
last-reviewed: 2026-06-26
review-interval: P12M
retention: review-only
related: [RISK-001, REC-GOV-004, REC-ADR-008]
---

# ADR: Shared-tenancy on the in-scope K3s cluster — accept residual risk vs. isolate

**Status: Draft — PROVISIONAL, pending founder decision.** This ADR records the decision *to be made*
and the options. It does **not** authorise any isolation work, namespace change, NetworkPolicy
rollout, secret-store re-scoping, or backup re-scoping. Nothing in the live estate changes on the
strength of this file. (Raised by RES-65 / orig issue #239 while re-scoping the ISMS for the shared
cluster.)

## Context

The 2026-06-23 scope expansion brought PlotBudget and Sophia formally **in scope** because they run
live on the shared K3s sovereign cluster (`asset-inventory.yaml` AST-022..028). Re-scoping then
surfaced a deeper structural fact that *scope membership alone does not address*: **every product
co-resides on the same plane with no workload isolation**.

Co-residence (verified against the asset inventory and Phase-1 infra ground-truth):

- **One control plane / etcd** — AST-022 (3-node embedded-etcd HA today; was single-node).
- **One secret machinery** — External Secrets Operator + Infisical ClusterSecretStores, **AST-027**,
  delivering *every* product's secrets into the cluster.
- **One backup plane** — etcd snapshots + CNPG/restic, all writing to the **single hel1 S3 bucket
  (AST-019)**.
- **In-scope + adjacent workloads on the same node(s)** — the 3 CNPG Postgres clusters (AST-023),
  SurrealDB (AST-024), the self-hosted Supabase / PlotBudget backend (AST-025), Sophia (AST-026),
  monitoring (AST-028).
- **No isolation in force today** — no namespace default-deny NetworkPolicy between products, no
  per-product ESO secret-store segregation, no per-product backup scoping.

### Why this is wider than RISK-001 as originally framed

RISK-001 began as an **availability SPOF** ("everything on one host"). The shared-tenancy reality
broadens the blast radius to **confidentiality and integrity as well**:

- A fault, resource-exhaustion, or **compromise** of *any one* co-resident product can take down — or
  be taken down with — the in-scope estate.
- A compromise of the **shared secret operator** (AST-027) exposes every product's secrets at once.
- A compromise or corruption in the **shared backup plane** (AST-019) can poison or deny recovery for
  every product at once.
- This applies to products **nominally "out-of-scope-until-their-phase"** and to **any new product
  later spun up on the cluster** — they inherit the coupling regardless of declared scope.

Crucially, the HA/SPOF work tracked in RISK-001 (3-node etcd quorum, CNPG anti-affinity) **does not
mitigate this** — HA makes the shared plane *more available*, not *more isolated*.

## Decision required (founder)

Pick one. **This ADR does not pick for you.**

### Option A — Accept shared-tenancy as residual risk

Record a deliberate risk acceptance against RISK-001: owner, rationale (proportionate to a
solo-founder, pre-scale, single-tenant-per-product estate where the founder controls all four
products), and a review date. Lowest effort; leaves the confidentiality/integrity coupling in place.
Appropriate only while there is no untrusted multi-tenant workload and no external-customer data
boundary on the cluster. **Revisit triggers:** first external/enterprise customer data on-cluster,
first third-party-operated workload, or any product leaving sole-founder control.

### Option B — Commission workload isolation (recommended for review)

Treat the coupling as a risk to mitigate. Indicative scope (each a filed follow-up PBI, sequenced,
**not** authorised here):

1. **Network** — per-product namespaces with a default-deny `NetworkPolicy`, allow-listing only the
   required cross-namespace flows. (Note the existing Huly NetworkPolicy↔Traefik gap: new
   Traefik-fronted pods get silently dropped unless allow-listed — any rollout must account for it.)
2. **Secrets** — split the single ClusterSecretStore into least-privilege per-product `SecretStore`s
   (AST-027) so one product's compromise cannot read another's secrets.
3. **Backups** — per-product backup scoping / separate prefixes or buckets (AST-019) so one product's
   backup corruption or exhaustion cannot deny another's recovery.
4. **Compute** — node pools / taints so a noisy-neighbour or compromised workload is bounded.

## Recommendation (advisory — for founder decision)

Given the estate is **single-tenant-per-product and entirely founder-controlled today**, Option A
(documented acceptance) is defensible **as an interim posture**, *provided* the **revisit triggers
above are written into RISK-001** and Option B's namespace + secret-store split is scheduled before
any external-customer data or third-party workload lands on the cluster. The confidentiality blast
radius through the **shared secret operator (AST-027)** is the highest-value isolation step and should
be the first PBI if Option B is chosen. **No isolation work is started until the founder records the
decision here and against RISK-001.**

## Consequences

- **If A:** RISK-001 carries a documented, time-bound acceptance with explicit revisit triggers; SoA
  scope note and RISK-001 stand as the standing record of the residual exposure.
- **If B:** the indicative PBIs above are filed and sequenced; RISK-001 treatment is updated from
  "decision required" to "in-treatment" with the isolation plan referenced.

## References

- `governance/risk-register.yaml` → **RISK-001** (shared-tenancy blast-radius update, 2026-06-26).
- `governance/soa.md` → **REC-GOV-004** scope note (shared-tenancy blast radius, 2026-06-26).
- `governance/asset-inventory.yaml` → **AST-022..028** (co-residence of record).
- RES-65 / orig issue #239 — re-scope the ISMS for the shared cluster.
