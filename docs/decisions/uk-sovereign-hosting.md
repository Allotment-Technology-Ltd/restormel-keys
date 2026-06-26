---
id: REC-ADR-XXX  # PLACEHOLDER — human to assign the next free REC-ADR-NNN from records/register.yaml (do NOT reuse a disposed id)
title: "ADR: UK-sovereign hosting — migrate the K3s stack off Hetzner-EU to a UK-resident, UK-controlled provider (Civo)"
class: decision
owner: founder
status: proposed
classification: internal
control-tier: 1
created: 2026-06-26
last-reviewed: 2026-06-26
review-interval: P12M
related: [REC-ADR-006, REC-PLAN-012, REC-PLAN-021, RISK-003]
---

# ADR: UK-sovereign hosting — migrate the K3s stack off Hetzner-EU to a UK-resident, UK-controlled provider

**Status: PROPOSED — decision recorded, no infrastructure change authorised.** This ADR records a recommended direction. It does **not** authorise standing up any provider, moving any traffic, deleting any Hetzner resource, or editing any governance register. Acting on it requires founder sign-off and the phased migration plan in `uk-sovereign-hosting-report.md §6`. The record `id` above is a **placeholder** — assignment of a real `REC-ADR-NNN` is for the human, from `records/register.yaml`.

> **Note for the assignee:** `status: proposed` is used here per the brief. The repo's SCHEMA.md controlled vocabulary for `status` is `draft | approved | deprecated | superseded`; if CI rejects `proposed`, map to `draft` on filing (the intent is identical — "recorded direction, not yet approved/executed").

## Context

### What we run today (verified live, 2026-06-26)

A 3-node Hetzner Cloud K3s cluster, **all in region hel1 (Helsinki, Finland)**, all stacked control-plane+etcd (HA quorum 3, embedded etcd), K3s v1.34.8: 2× cx43 (8 vCPU/16 GiB) + 1× cx33 (4 vCPU/8 GiB) = 20 vCPU / ~40 GiB. CNI Cilium v1.17.2 (`kube-proxy-replacement`, tunnel, **no WireGuard/IPsec**). Ingress Traefik v3.7.5 as a DaemonSet on **hostPort 80/443 with zero LoadBalancer services**; all public DNS resolves to a single node IP (master1 135.181.25.76) — a single ingress-failure point. Storage: one `hcloud-volumes` CSI StorageClass, 28 RWO PVCs (~290 GiB). State: 5 CloudNativePG (CNPG) Postgres clusters (PG 16.8, 2-instance HA, continuous Barman base+WAL archive to S3 = PITR-capable), SurrealDB (single replica), Huly stack, monitoring. Backups + object storage in **Hetzner Object Storage fsn1 (Falkenstein, Germany)**. GitOps via Argo CD app-of-apps from the separate `restormel-gitops` Forgejo repo. Secrets via ESO → self-hosted Infisical (on-cluster, EU). etcd snapshots are **local-only on node disks** (no `--etcd-s3`) — the open headline DR gap (J10).

### The bar and the gap

The realistic public-sector bar is **UK government OFFICIAL, handling -SENSITIVE** (SECRET / List X out of scope). Against that bar:

- **Residency is EU, not UK** — compute Helsinki FI, backups Falkenstein DE. Sovereign, but UK-only mandates fail.
- **Jurisdiction is a genuine strength, not a weakness.** Hetzner is a German/EU company, so the core compute is **outside US CLOUD Act / FISA 702 reach** — an advantage no AWS/Azure/GCP "London region" can match (jurisdiction follows the company). A residual US-owned sub-processor surface (Zuplo, Sentry, Google Workspace, GitHub, Anthropic tooling, Resend) sits on the periphery and reintroduces exposure for metadata/correspondence, but is deliberately kept off the verification/regulated path.
- **The binding blockers are certification and framework access.** Cyber Essentials / CE Plus and ISO 27001 are **DRAFT / self-assessed only**, and there is **no G-Cloud / CCS / Digital Marketplace listing**. A public body cannot procure via the compliant route without a G-Cloud listing, and most OFFICIAL tenders require CE/CE Plus as a floor and ISO 27001 as a near-floor.

**The decisive framing:** migrating to a UK provider buys **UK-residency + UK-corporate-jurisdiction + G-Cloud procurability**. It does **not** buy a CLOUD-Act improvement over Hetzner — Hetzner already clears that. If CLOUD-Act avoidance were the only goal, staying on Hetzner is already correct. This ADR therefore frames the decision as conditional on UK-residency + UK-procurement being an actual business requirement.

## The sovereignty rubric

Target tier **OFFICIAL (handling -SENSITIVE)**. Seven weighted criteria (Σ=100); PASS requires a non-US-controlled corporate parent (C2) **and** a credible UK residency story (C1) — US-parented "London regions" structurally FAIL C2 regardless of certs.

| # | Criterion | Weight | Restormel today |
|---|---|---|---|
| C1 | UK data residency | 15 | **partial** (EU-resident) |
| C2 | UK jurisdiction / corporate ownership (CLOUD-Act) | 18 | **partial→pass** core (Hetzner EU), US periphery |
| C3 | CCS / G-Cloud 14 + Digital Marketplace listing | 17 | **fail** (no listing) |
| C4 | Cyber Essentials Plus + ISO 27001 (+27017/27018) | 17 | **fail** (DRAFT only) |
| C5 | NCSC Cloud Security Principles (14) | 12 | **partial** (real coverage; P3/P6/P13 gaps) |
| C6 | UK GDPR / DPA 2018 + sub-processor transparency | 11 | **partial** (placeholders; no buyer-facing page) |
| C7 | GSCP OFFICIAL handling (incl. -SENSITIVE) | 10 | **partial** (ISMS exists; not GSCP-mapped) |

Weighted scores: **iomart 88.8 · Civo 86.6 · Hetzner baseline 49.6** (fails C1+C3+C4, passes C2). US hyperscalers score 73.6–75.6 on raw assurance but FAIL the sovereignty verdict on C2.

## Options considered

| Option | Sovereignty verdict | K3s fit | Notes |
|---|---|---|---|
| **Stay on Hetzner-EU, close cert/procurement gaps** | EU-sovereign, CLOUD-Act-free; **fails UK residency + G-Cloud** | n/a (status quo) | Cheapest infra (~£54/mo); the correct answer **if UK-residency is not a requirement**. Path: CE → CE Plus → ISO 27001 → G-Cloud → buyer-facing DPA → close US-SaaS exposure. |
| **Civo (managed K3s)** — RECOMMENDED | **PASS** (86.6) | **Strongest** — managed Kubernetes *is* K3s; first-party CCM/CSI/S3 = 1:1 analogue | UK founder-controlled, LIVE on G-Cloud 14, CE Plus + ISO 27001 + SOC 2. Free egress, real LB. Gaps: single UK region; ISO 27017/27018 unverified; possible Flannel-pin risk for our Cilium. ~0.52x Hetzner on full TCO once ops labour is valued. |
| **iomart (DIY K3s on UK bare-metal)** | **PASS** (88.8) | Strong, but self-managed — no managed K8s | UK plc, 11–13 wholly-owned UK DCs (real multi-site in-country DR), CE Plus + ISO 27001/27018, on CCS. Forces MetalLB + Longhorn + self-run etcd. ~8x infra, ~1.4x full TCO. Best as the **alternate / DR partner**. |
| **Krystal Cloud** | PARTIAL (66.0) — **not on G-Cloud** | Strong (DIY K3s, own LON DC, first-party CCM) | Fully UK-owned, ISO 27001:2022 + CE Plus. Usable off-framework today while a CCS route is pursued. |
| **OVHcloud UK** | PARTIAL (66.8) — French parent | Strong (single UK AZ, native LB/CSI) | ISO 27001/27017/27018, on G-Cloud, UK Erith, unmetered egress — EU-sovereign-acceptable workloads only, not strict UK-only. Scale/cert hedge. ~7.6x infra. |
| **AWS / Azure / GCP UK** | **FAIL** (jurisd, C2=1) | Strong (EKS) / Adequate (K3s unsupported on Azure) | High on raw certs/residency but a US ultimate parent is CLOUD-Act-reachable regardless of a London region. Excluded. |
| **Vultr / DigitalOcean / Linode / Scaleway / Nscale / Ori** | FAIL | varies | US parent (CLOUD-Act), or no UK region (Scaleway), or foreign-controlled/GPU-only. Excluded. |

## Decision / Recommendation

**Adopt Civo managed Kubernetes as the UK-sovereign target, with iomart as the alternate / DR partner — conditional on UK-residency + G-Cloud procurement being a confirmed business requirement.**

Rationale:

1. **Closest structural analogue.** Civo's managed Kubernetes *is* K3s, with first-party CCM (real LoadBalancers + public IPs), CSI (block-volume PVs), and S3 Object Storage — a 1:1 match for today's four primitives (K3s, `csi.hetzner.cloud`, `hcloud-cloud-controller-manager`, fsn1 S3). The migration is a GitOps re-point + data-restore, not a re-architecture.
2. **Clears the procurement-gating axes.** UK founder-controlled (C2=5), LIVE on G-Cloud 14 (C3=5), CE Plus + ISO 27001 + SOC 2 held (C4=5) — exactly the stack the rubric weights most heavily.
3. **Improves posture during the move.** Managed control plane + etcd offloads the self-operated HA and *closes the live J10 etcd-DR gap*; fronting Traefik with a Civo LoadBalancer fixes the single-node-IP ingress; rebuilding lets us enable Cilium WireGuard (closing the unencrypted-pod-traffic finding).
4. **Cheaper on true TCO.** ~3.7x Hetzner on raw infra (~£200 vs ~£54/mo) but **~0.52x on steady-state full TCO** once self-managed ops labour is valued — Civo's managed control plane saves ~£600/mo of toil.

**Chosen migration approach:** **Blue-green parallel-run, dependency-sequenced (Infisical/ESO first → Forgejo/registry → CNPG ×5 → SurrealDB → apps → monitoring), DNS-switched.** CNPG migrates by **bootstrap-from-Barman-backup** (the existing continuous S3 archive — not pg_dump/snapshot); other PVCs by logical restore where a dump exists, Velero/restic otherwise. Hetzner stays warm; rollback is a DNS flip back. Hard gates before Hetzner decommission: PG row-count/size parity ×5 + a successful PITR restore from the new UK object-locked bucket + Surreal parity + app smoke tests + all certs Ready-from-prod + the comprehensive DR drill, soaked ≥48h.

**Fallbacks:** iomart if multi-UK-site in-country DR is a hard mandate (accepting DIY MetalLB + Longhorn + etcd-DR); Krystal off-framework while a CCS route is pursued; OVHcloud UK for EU-sovereign-acceptable scale workloads. **Null option:** stay on Hetzner and close cert/procurement gaps — the correct choice if UK-residency is not actually required.

## Consequences

- **Sovereignty story changes shape, not strictly improves.** Gains UK soil + UK jurisdiction + G-Cloud procurability; does **not** gain CLOUD-Act avoidance over Hetzner. The "sovereign" claim stays incomplete until the residual US surface (Zuplo gateway, Resend, model-BYOK egress) is addressed — track the Zuplo OSS-gateway migration (REC-ADR-006) in the same programme.
- **Cost rises on raw infra, falls on true TCO.** Budget against the ~£57/mo cap with eyes open: infra ~£200/mo (Civo) but full TCO lower once ops labour counts. One-off migration ~£9.2k [ESTIMATE].
- **New provider dependency + single UK region.** Decide geo-redundancy explicitly (second UK S3, or iomart multi-DC as DR) — don't inherit single-region silently.
- **Mandatory ISMS reconciliation.** The asset/supplier/ROPA records (already stale vs the live K3s reality) must be updated: add Civo/iomart, retire Hetzner-compute, add Resend, record UK residency; file the change/incident record (REC-TPL-004) per CLAUDE.md.
- **Measure-before-commit.** CNPG DB on-disk sizes, registry blob bytes, monthly egress are all [UNKNOWN] read-only — obtain from Prometheus / Hetzner billing before scheduling the cutover window. Re-pull all dated June-2026 pricing before any commitment.
- **Reversible until teardown.** Blue-green + warm Hetzner means rollback is a DNS flip at any point before decommission; Hetzner nodes are deleted first, fsn1 buckets last, after a final archived copy.

## No change yet

This ADR is **proposed** and authorises **nothing operational**. No provider is engaged, no cluster is built, no traffic moves, no Hetzner resource is deleted, and the governance registers are **not** edited on the basis of this document alone. The next step is founder review of this ADR and the migration plan (`uk-sovereign-hosting-report.md §6`); each phase there is independently gated and the Hetzner decommission is the final, separately-approved step after verification passes.
