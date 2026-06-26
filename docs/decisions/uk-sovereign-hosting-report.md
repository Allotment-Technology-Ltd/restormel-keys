# UK-Sovereign Hosting Investigation — Restormel Keys / Allotment Technology Ltd

**Date:** 2026-06-26 · **Status:** Investigation report for founder decision · **Author:** lead author (multi-agent investigation)

**Question.** Can / should the live Restormel K3s stack move off Hetzner onto a UK-sovereign provider, what would it cost in GBP, and how would the migration be done — calibrated to the realistic public-sector bar (OFFICIAL, handling -SENSITIVE).

**Grounding note.** Current state is from a live read-only `kubectl` survey against `KUBECONFIG=~/.config/restormel/kubeconfig` (2026-06-26) plus repo/governance records. Provider capabilities and prices cite dated primary sources (June-2026). Where a figure was not measurable read-only it is flagged **[ESTIMATE]** or **[UNKNOWN — measure before commit]**. Nothing here invents facts beyond the provided investigation material.

---

## 1. Executive summary

Restormel's live stack is a genuinely sovereign, well-engineered 3-node K3s cluster — but it is **EU-resident, not UK-resident, and not procurable through the compliant public-sector route**. The honest verdict against the realistic bar (UK government **OFFICIAL, handling -SENSITIVE**) is: *technically credible on the sovereignty differentiators, not yet procurable*.

Three structural facts drive everything:

1. **Hetzner already beats the US hyperscalers on jurisdiction.** It is a German/EU company, so it sits **outside US CLOUD Act / FISA 702 reach** — a real advantage that any AWS/Azure/GCP "London region" cannot match (jurisdiction follows the company, not the datacentre). Hetzner's failure against a *UK* bar is therefore **specific**: residency is EU-not-UK (compute Helsinki FI, backups Falkenstein DE) and there is **no G-Cloud/CCS listing and no held CE Plus / ISO 27001**.
2. **The gating blockers are certification and framework access, not residency.** A public body cannot procure via the compliant route without a G-Cloud listing, and most OFFICIAL tenders require CE/CE Plus as a floor and ISO 27001 as a near-floor. These are **DRAFT/self-assessed only** today.
3. **Migrating to a UK provider buys UK-residency + UK-jurisdiction + G-Cloud procurability — it does NOT buy a CLOUD-Act improvement over Hetzner** (Hetzner already clears that). If CLOUD-Act avoidance were the only goal, staying on Hetzner is already correct.

On the sovereignty-scored matrix, only two providers clear the bar cleanly: **iomart Group plc (88.8%)** and **Civo Limited (86.6%)** — both UK-incorporated, UK-controlled, CE Plus + ISO 27001 held, on a CCS route. The Hetzner baseline scores **49.6%** (fails the UK bar on residency + procurement, passes on jurisdiction).

On cost, the headline infra multiplier vs Hetzner is **Civo 3.7x, OVHcloud UK 7.6x, iomart 8.1x** — but that is **not** the true-TCO multiplier. Hetzner's raw infra bill is so small (~£54/mo) that the *self-managed ops labour* dominates its real cost; Civo's managed-K3s control plane cuts that labour enough that on a steady-state full-TCO basis Civo is **~0.52x Hetzner (cheaper)** once ops time is valued.

**Recommendation:** **Civo managed Kubernetes (which is literally K3s)**, blue-green parallel-run migration, **only if** UK-residency + G-Cloud procurement is an actual business requirement. If it is not, the correct action is to **stay on Hetzner and close the procurement gaps** (CE → CE Plus → ISO 27001 → G-Cloud listing → buyer-facing DPA → close residual US-SaaS exposure). The sovereignty rationale either way: Restormel's compute is already CLOUD-Act-free; the migration is about UK *soil + procurability*, and must not be marketed as "sovereign" while Zuplo (US gateway), Resend, and model-BYOK egress remain on non-UK surfaces and the ISMS asset/supplier records stay stale.

---

## 2. Current-state inventory (with jurisdiction tags)

Verified live, 2026-06-26. Jurisdiction tags: **EU-sovereign** (CLOUD-Act-free) / **UK** / **US (FLAGGED)** / **mixed**.

### 2.1 Compute & cluster topology — **EU-sovereign (Hetzner-FI, Helsinki)**

| Item | Live fact | Jurisdiction |
|---|---|---|
| Cluster | 3 nodes, all Ready, all stacked control-plane+etcd (HA quorum 3), embedded etcd | Hetzner-FI hel1 |
| Sizing | 2× cx43 (8 vCPU/16 GiB) + 1× cx33 (4 vCPU/8 GiB) = **20 vCPU / ~40 GiB**; pod cap 110/node | Hetzner-FI hel1 |
| Region | **hel1 / hel1-dc2 (Helsinki, Finland)** on all 3 nodes (resolves the fsn1/hel1 founder flag) | Hetzner-FI hel1 |
| K3s | v1.34.8+k3s1, containerd 2.2.3, Ubuntu 24.04 LTS; **no system-upgrade-controller** (manual patching) | Hetzner-FI hel1 |
| CNI | Cilium v1.17.2, `kube-proxy-replacement=true` (eBPF), tunnel/VXLAN, cidr 10.244.0.0/16; **no WireGuard/IPsec** (pod-to-pod unencrypted, relies on Hetzner private net) | Hetzner-FI hel1 |
| Ingress | Traefik v3.7.5 **DaemonSet on hostPort 80/443**; **zero LoadBalancer services**; all DNS → single node IP (master1 135.181.25.76) = single ingress-failure point | Hetzner-FI hel1 |
| Cloud glue | Hetzner CCM v1.30.1 (node lifecycle + route reconciliation, **no LB**) + Hetzner CSI; cluster-autoscaler burst pool `0:2:CPX31:HEL1` (0 live) | Hetzner-FI hel1 |
| GitOps | Argo CD app-of-apps from **`git.allotmentology.tech/Allotment-Technology-Ltd/restormel-gitops`** (NOT this repo); prod apps = MANUAL sync | Self-hosted EU |

### 2.2 Storage & stateful data — **EU-sovereign (compute FI, backups DE)**

| Item | Live fact | Jurisdiction |
|---|---|---|
| StorageClass | Single `hcloud-volumes` (`csi.hetzner.cloud`, Delete, WaitForFirstConsumer, expandable); 28 PVCs all RWO; **~290 GiB provisioned** | Hetzner-FI hel1 |
| Postgres | **CloudNativePG (CNPG)** — 5 clusters (pg-restormel/platform/plotbudget/forgejo/infisical), all PG 16.8, all 2-instance HA (primary + hot standby); 10Gi data + 10Gi WAL each | Hetzner-FI hel1 |
| PG backup | **Barman Cloud Plugin → S3** `backups-fsn1-ol` (object-lock bucket), gzip, retention 30d, daily ScheduledBackup, **continuous WAL archive = PITR-capable**, last backups <6h | Hetzner-DE fsn1 |
| SurrealDB | v3.1.4, RocksDB, **single replica (no HA)**, 20Gi; hourly restic SurrealQL dump to fsn1 | FI live / DE backup |
| Huly | Cockroach/Elastic/Redpanda, single-replica, **no observed backup CronJob** (coverage gap) | Hetzner-FI hel1 |
| Monitoring | Prometheus/Grafana/Alertmanager PVs; **Loki = emptyDir (ephemeral, logs lost on restart)** → S3 logs bucket | FI live / DE logs |
| etcd snapshots | **LOCAL-ONLY on node disks** (no `--etcd-s3`); whole-region loss loses etcd unless a node disk survives — **headline DR gap (J10), still open** | Hetzner-FI node disks |

### 2.3 Networking — **EU-sovereign; DNS = Hetzner**

- No Hetzner LoadBalancer or Floating IP; ingress via Traefik hostPort, single-node-IP, no IP-level HA.
- **DNS operator = Hetzner DNS** for all domains (register stale — attributes DNS to Vercel/get.tech, which are registrars only).
- TLS via cert-manager + Let's Encrypt (ISRG, US non-profit) DNS-01 through Hetzner. Two certs **not Ready**: `argocd-server-tls` (mis-wired issuer `letsencrypt-dns01`), `allotment-redirect`; `wildcard-usesophia-app` issued from **staging** (browser-untrusted smell).
- DNS for `git.allotmentology.tech` / `secrets.restormel.dev` still points at legacy **.150 box** (Forgejo + Infisical not yet flipped on-cluster).

### 2.4 Off-cluster / DR — **EU-sovereign, with open gaps**

- Object storage = **Hetzner Object Storage fsn1 (Falkenstein DE)**: CNPG Barman, restic (surreal/escrow), registry-mirror, Loki logs. Single "family-jewels" DR store.
- **Monthly egress = UNMONITORED / UNKNOWN** (no measured figure anywhere). [UNKNOWN — measure before commit]
- Object-lock only on the CNPG bucket; escrow/restic/registry/etcd buckets versioning-only (Hetzner object-lock is create-time-only — D-B-3).
- Infisical master-key escrow (age, fsn1) complete + verified; private key offline founder-held (UK).
- Registry: Forgejo built-in, **still served from legacy .150** (on-cluster Forgejo at replicas=0). **Sophia image pulls ghcr.io (US)** — outside the mirror.

### 2.5 Off-cluster sub-processors — **mixed**

| Dep | Role | Jurisdiction tag |
|---|---|---|
| Hetzner (compute + object storage) | Core infra | **EU-sovereign** (DE co; FI compute / DE backup) |
| Hetzner DNS | Authoritative DNS + ACME solver | **EU-sovereign** (control on cert path) |
| Infisical (self-hosted on-cluster) | Secret store on credential path | **EU-sovereign / in-house** |
| Paddle | Billing / Merchant of Record | **UK** |
| Mettle / FreeAgent / QCF | Finance / legal | **UK** |
| Migadu | Transactional email (allotmentology.tech) | EU (CH co) — DPA/residency **unconfirmed** |
| PostHog EU | Analytics | EU data residency (US parent) |
| Mistral (FR) | Model provider | EU |
| Neon (AWS eu-west) | Legacy PG backup, **decommissioning ~2026-06-30** | EU-hosted (US co) |
| **Zuplo** | US-edge API gateway on auth-header path | **US (FLAGGED)** — ADR REC-ADR-006 to migrate is DRAFT |
| **Resend** | PlotBudget auth/magic-link email | **US (FLAGGED) + register gap** (not in suppliers.yaml; REC-INC-012) |
| Sentry / Google Workspace / Notion / Anthropic (tooling) / GitHub | Errors / email-PII / docs / dev-AI / code mirror | **US (FLAGGED)** |
| Model-provider BYOK egress (12 endpoints) | Verification/routing path | **mixed** — US/CN/CA/EU/unverified; geo-filter planned, not shipped |

**Stale governance flag:** `governance/asset-inventory.yaml` + `suppliers.yaml` still describe the pre-K3s 2-box Coolify topology + BX11; they do not record the K3s 3-node cluster, fsn1 object storage, on-cluster Forgejo/Infisical, Hetzner-as-DNS, or Resend. Must be reconciled as part of any change.

---

## 3. Sovereignty rubric (calibrated to OFFICIAL, handling -SENSITIVE)

**Target tier = OFFICIAL with the -SENSITIVE handling caveat** — the correct and only realistic bar for this company. SECRET / List X is explicitly out of scope (needs accredited/air-gapped environments, SC/DV-cleared personnel, assured crypto — not attainable at a solo-founder ISO/CE-aligned SaaS).

Two decisive structural facts: **(a) residency is EU, not UK** (Hetzner Helsinki compute / Falkenstein backups — sovereign but UK-only mandates fail); **(b) jurisdiction follows the company** — Hetzner (German) is outside CLOUD-Act reach, a genuine advantage over US "London regions," but a residual US-owned sub-processor surface (Vercel/Zuplo/Sentry/Google/GitHub/Anthropic) reintroduces exposure on the periphery. The binding gap is **certification + framework access**: CE/CE Plus and ISO 27001 are DRAFT/self-assessed; there is **no G-Cloud/CCS listing** anywhere.

| # | Criterion | Weight | Why it matters |
|---|---|---|---|
| C1 | **UK data residency** | 15 | All regulated data + verification path + backups physically in UK. Restormel = **partial** (EU-resident). |
| C2 | **UK jurisdiction / corporate ownership (CLOUD-Act exposure)** | 18 | Provider + accessing sub-processors non-US so no foreign compulsion. Restormel core = **partial→pass** (Hetzner EU), residual US periphery. |
| C3 | **CCS / G-Cloud 14 + Digital Marketplace listing** | 17 | The compliant procurement route. Restormel = **fail** (no listing). |
| C4 | **Cyber Essentials Plus + ISO 27001 (+27017/27018)** | 17 | Procurement floor/near-floor. Restormel = **fail** (DRAFT only). |
| C5 | **NCSC Cloud Security Principles (14)** | 12 | Technical assurance layer. Restormel = **partial** (real coverage, gaps on P3/P6/P13, unmapped). |
| C6 | **UK GDPR / DPA 2018 + sub-processor transparency** | 11 | Art.28 DPA, published sub-processor list, Art.46 safeguards. Restormel = **partial** (strong internal, placeholders, no buyer-facing page). |
| C7 | **GSCP OFFICIAL handling (incl. -SENSITIVE)** | 10 | Classification-aware access, audit, incident discipline. Restormel = **partial** (ISMS exists, not GSCP-mapped). |

**Pass condition:** a genuine non-US-controlled corporate parent (C2) **AND** a credible UK residency story (C1). US-parented "London regions" structurally FAIL C2 regardless of certs.

**Fix order for public-sector readiness:** certify (CE → CE Plus → ISO 27001) → list on the next G-Cloud iteration → publish a buyer-facing DPA + sub-processor page → close residual US-SaaS exposure on any regulated path → optionally add a UK-resident region for UK-only datasets.

---

## 4. Scored provider matrix + shortlist

Each cell 0–5; **Weighted %** = Σ(score×weight) ÷ 5. Sovereignty **PASS** requires non-US parent (C2) + credible UK residency (C1).

| Provider | C1 (15) | C2 (18) | C3 (17) | C4 (17) | C5 (12) | C6 (11) | C7 (10) | **Wtd %** | Sov verdict | K3s fit |
|---|---|---|---|---|---|---|---|---|---|---|
| **iomart** (UK plc) | 5 | 5 | 4 | 5 | 4 | 4 | 4 | **88.8** | PASS | Strong (own bare-metal, DIY K3s) |
| **Civo** (UK, founder) | 4 | 5 | 5 | 5 | 3 | 4 | 4 | **86.6** | PASS | Strong (native managed K3s) |
| Azure UK (US parent) | 5 | 1 | 5 | 5 | 5 | 5 | 5 | 75.6 | PARTIAL→FAIL (jurisd) | Adequate (K3s unsupported) |
| AWS UK (US parent) | 5 | 1 | 5 | 5 | 5 | 5 | 5 | 75.6 | FAIL (jurisd) | Strong (EKS/EC2) |
| Google Cloud UK (US parent) | 4 | 1 | 5 | 5 | 5 | 5 | 5 | 73.6 | FAIL (jurisd) | Strong (off-grain vs GKE) |
| OVHcloud UK (FR parent) | 3 | 3 | 4 | 3 | 3 | 5 | 4 | 66.8 | PARTIAL | Strong (single UK AZ) |
| Pulsant (UK ops, FR PE owner) | 5 | 2 | 4 | 3 | 3 | 4 | 3 | 66.2 | PARTIAL | Adequate (DIY, VMware) |
| Krystal Cloud (UK, founder) | 4 | 5 | 0 | 4 | 3 | 4 | 3 | 66.0 | PARTIAL (no G-Cloud) | Strong (DIY K3s, own LON DC) |
| IONOS UK (DE parent) | 5 | 4 | 1 | 3 | 3 | 4 | 3 | 64.2 | PARTIAL | Strong (2 UK DCs) |
| UpCloud (FI/EU) | 3 | 4 | 0 | 3 | 3 | 4 | 3 | 57.4 | PARTIAL | Adequate (LON region) |
| Brightbox (UK, founder) | 4 | 5 | 1 | 1 | 2 | 3 | 2 | 51.4 | PARTIAL (weak certs) | Adequate (no CSI) |
| Akamai Linode (US) | 4 | 1 | 1 | 4 | 2 | 3 | 3 | 51.0 | FAIL (US parent) | Strong |
| **— Hetzner (BASELINE)** | 2 | 4 | 0 | 1 | 3 | 3 | 3 | **49.6** | **FAILS UK bar** (passes jurisd) | Strong (current stack) |
| Vultr (US) | 4 | 1 | 0 | 3 | 2 | 3 | 3 | 47.0 | FAIL (US parent) | Strong |
| DigitalOcean (US) | 4 | 1 | 0 | 2 | 2 | 3 | 3 | 44.0 | FAIL (US parent) | Adequate |
| Scaleway (FR, no UK region) | 0 | 4 | 0 | 2 | 2 | 4 | 2 | 40.4 | FAIL (no UK region) | Strong (EU-only) |
| Ori/Radiant (US/CA Brookfield) | 3 | 1 | 0 | 1 | 1 | 2 | 2 | 27.8 | FAIL | Weak |
| Nscale (UK inc, NO/US control) | 3 | 1 | 0 | 0 | 1 | 1 | 1 | 20.0 | FAIL (foreign control) | Weak |

**Reading the scores.** The hyperscalers post very high on technical-assurance columns (C4/C5/C7 = 5/5) and on UK residency, but the decisive **C2 jurisdiction** test caps them: a US ultimate parent is reachable under the CLOUD Act regardless of a London region (C2=1 → FAIL). **Hetzner (49.6%)** *beats* the US clouds on jurisdiction (C2=4, German/EU, CLOUD-Act-free) but fails the UK bar on residency (C1=2, EU-not-UK) and procurement (C3=0, C4=1). Honest picture: **EU-sovereign and CLOUD-Act-free, but not UK-resident and not procurable.**

### Shortlist (carried forward)

1. **iomart Group plc** — cleanest pass: UK plc, 11–13 wholly-owned UK DCs (real in-country DR), CE Plus + ISO 27001/27018 held, on CCS frameworks; K3s self-hosts on its own bare-metal/VMs (closest analogue to the Hetzner cx-node topology). **No managed Kubernetes** → DIY K3s + MetalLB + Longhorn + self-run etcd.
2. **Civo Limited** — best K3s fit of any candidate (managed Kubernetes literally IS K3s, `civo kubernetes create`), UK founder-controlled, LIVE on G-Cloud 14, CE Plus + ISO 27001 + SOC 2 held; free egress, real cloud LB. Gaps: single UK region; ISO 27017/27018 unverified.
3. **Krystal Cloud** — strongest sovereignty-only play (fully UK-owned, ISO 27001:2022 + CE Plus, own London DC, first-party K8s CCM, pooled free egress) — but **NOT on G-Cloud**, so usable off-framework today while a CCS route is pursued.
4. **OVHcloud UK (conditional)** — scale/certification hedge: ISO 27001/27017/27018, on G-Cloud, UK Erith region, native Octavia LB + Cinder/NAS-HA CSI (RWX), unmetered egress — clears residency + procurement but only PARTIAL on jurisdiction (French parent), so EU-sovereign-acceptable workloads only, not strict UK-only mandates.

---

## 5. GBP cost model summary

**Baseline run:** 290 GiB PV, 3 nodes, egress unmonitored/parameterised (1 TB), 1 cloud-LB on target, FX EUR 0.863 / USD 0.760, dated June-2026 pricing. "x vs Hz" = multiplier of monthly **infra** spend vs Hetzner. (Reproduce: `python3 uk-sovereign-cost-model.py`.)

| Provider | GBP/mo infra | x vs Hz (infra) | Migrate (one-off) | Ops GBP/mo | Yr-1 TCO | Steady-yr TCO | x vs Hz (steady-yr, infra+ops) |
|---|---|---|---|---|---|---|---|
| Hetzner (BASELINE) | 53.85 | 1.00x | 0 | 900 | 11,446 | 11,446 | 1.00x |
| Civo (UK) | 199.68 | 3.71x | 9,201 | 300 | 15,198 | 5,996 | **0.52x** |
| iomart (UK plc) | 438.20 | 8.14x | 9,440 | 900 | 25,498 | 16,058 | 1.40x |
| OVHcloud UK | 408.20 | 7.58x | 9,410 | 900 | 25,108 | 15,698 | 1.37x |

**Headline multipliers vs Hetzner (raw monthly infra): Civo 3.7x · OVHcloud UK 7.6x · iomart 8.1x.**

**Crucial nuance — infra multiplier ≠ TCO multiplier.** Hetzner's raw infra bill is tiny (~£54/mo), so the *labour* of self-managing K3s (modelled 12 eng-hr/mo @ £75 = £900/mo) **dominates** its true cost. Civo's managed control plane cuts that to ~4 eng-hr/mo (£300), so on steady-state full TCO **Civo is ~0.52x Hetzner (cheaper)** despite a 3.7x infra bill — the £146/mo extra infra is more than offset by ~£600/mo less ops toil. This **flips** if founder ops-time is valued at zero, in which case Hetzner wins on raw infra. iomart/OVH stay self-managed AND cost more infra → ~1.4x full TCO.

**LB-0 apples-to-apples** (host-port ingress, no cloud LB anywhere): Hetzner 49.20 · Civo 191.43 (3.9x) · OVH 392.67 (8.0x) · iomart 413.20 (8.4x).

**Cost-breakout drivers.** Compute dominates every provider's infra bill. PV (290 GiB) is cheap everywhere (Hetzner £14/mo; OVH cheapest @ €0.04/GB; Civo dearest @ $0.11/GB = ~£24/mo). **Egress is ~free across all four shortlisted providers** (Hetzner bundles ~20 TB/node, Civo free-unlimited, OVH unmetered, iomart generous) — so the egress measurement gap does **not** threaten the conclusions. Object storage trivial. No managed control-plane fee anywhere.

### 5.1 Sensitivity

| Scenario | Hetzner | Civo | iomart | OVH | x(civo) | x(iomart) | x(ovh) |
|---|---|---|---|---|---|---|---|
| BASELINE | 54 | 200 | 438 | 408 | 3.71 | 8.14 | 7.58 |
| node_count +1 | 64 | 266 | 578 | 560 | 4.14 | 9.01 | 8.73 |
| node_count +2 | 75 | 332 | 718 | 713 | 4.45 | 9.64 | 9.56 |
| PV growth ×2 (580 GiB) | 68 | 224 | 490 | 418 | 3.29 | 7.19 | 6.14 |
| PV growth ×5 (1.45 TiB) | 111 | 297 | 647 | 448 | 2.67 | 5.82 | 4.03 |
| PV growth ×10 (2.9 TiB) | 183 | 418 | 908 | 498 | 2.29 | 4.97 | 2.73 |
| RAM drift +25% | 60 | 241 | 526 | 503 | 3.99 | 8.70 | 8.33 |
| RAM drift +50% | 67 | 282 | 613 | 598 | 4.21 | 9.15 | 8.93 |
| egress 5 / 20 TB | 54 | 200 | 438 | 408 | 3.71 | 8.14 | 7.58 |
| FX EUR weak 0.90 | 56 | 200 | 438 | 426 | 3.56 | 7.80 | 7.58 |
| FX USD strong 0.82 | 54 | 215 | 438 | 408 | 4.00 | 8.14 | 7.58 |

**Readings.** (1) **Node count is the steepest lever** — right-size before migrating. (2) **PV growth narrows the multiplier** (at ×10, OVH 2.73x, Civo 2.29x — OVH's €0.04/GB block is cheapest); storage-heavy futures erode Hetzner's edge. (3) **RAM-shortage drift widens** the gap in absolute GBP (scales compute). (4) **Egress is inert** across the shortlist — the measurement gap is moot here (it would only matter against a per-GB hyperscaler, which all FAIL the sovereignty bar). (5) **FX is second-order** (~±10%); GBP-quoted iomart is FX-immune.

**Volatility flag.** Hetzner raised prices three times in 2026 (15-Jun CCX hike +113–169% on dedicated-vCPU; the shared-vCPU CX line was spared but moved +30–37% in Apr-2026). OVHcloud has signalled RAM/storage SKUs could rise 15–300% across 2026–2028. **Re-pull every pricing page before any commitment.**

**Exclusions.** The model prices infrastructure + migration + ops-labour only. It does **not** price the sovereignty/procurement value (G-Cloud listing, CE+/ISO held, UK jurisdiction) that is the actual reason these providers are shortlisted — that benefit is qualitative.

---

## 6. Migration plan

**Scope:** lift the live 3-node Hetzner-FI K3s cluster onto a UK-resident, UK-controlled provider. **Primary = Civo (Path A); alternate = iomart (Path B).** This is fundamentally a **GitOps re-point + data-restore** exercise — most of the cluster is declarative (Argo app-of-apps) and reconstituted automatically, which is the migration's biggest advantage.

> **Honesty caveat:** this buys UK-residency + UK-jurisdiction + G-Cloud procurability, **not** a CLOUD-Act improvement over Hetzner (Hetzner already clears that). The "sovereign" claim is incomplete until Zuplo / Resend / model-BYOK egress are addressed and the stale ISMS asset/supplier/ROPA records are updated.

### (a) Architecture path

**Path A — Civo Managed Kubernetes (RECOMMENDED).** Civo's managed Kubernetes *is* K3s, with a first-party **CCM** (real LoadBalancers + public IPs), first-party **CSI** (block-volume PVs), and **S3-compatible Object Storage** — a 1:1 analogue of today's four primitives (K3s server, `csi.hetzner.cloud`, `hcloud-cloud-controller-manager`, fsn1 S3). Control plane + etcd durability move to Civo (the live J10 etcd-DR gap disappears). We lift our Cilium 1.17.2 values across (BYO-CNI; if Civo pins Flannel on managed clusters → risk R-CNI). We *fix* the single-node-IP ingress: front Traefik with a **Civo LoadBalancer** (one stable IP, health-checked) instead of hostPort+single-DNS.

**Path B — iomart, self-managed K3s on iomart bare-metal/IaaS (ALTERNATE).** iomart sells wholly-owned UK DCs, ISO 27001, on G-Cloud — but **no managed Kubernetes**. Near-true lift-and-shift of existing manifests, but you hand-roll everything the Hetzner CCM/CSI gave us: stand up K3s + stacked-etcd HA yourself, **MetalLB** for `type: LoadBalancer`, **Longhorn** (replicated block storage) as the StorageClass, and bare-metal etcd/Longhorn/CNPG DR targets.

**Verdict:** **Path A (Civo)** preserves the exact four-primitive shape, offloads control-plane/etcd, *improves* ingress HA, and is ~30–40% less effort. iomart is the **alternate / DR partner** — choose only for a hard multi-UK-site in-country-DR mandate, at the cost of owning MetalLB + Longhorn + etcd-DR.

### (b) Workstream mechanics

**WS1 — Cluster stand-up.** Civo: 3-node pool matching 20 vCPU/40 GiB + small burst pool; managed control plane; Cilium (BYO) with WireGuard enabled (closes the live unencrypted-pod-traffic finding); Traefik DaemonSet + Civo LB. iomart: self-run stacked-etcd ×3, pin v1.34.8+k3s1, add `--etcd-s3` (closes J10) and `system-upgrade-controller` (absent today), Cilium + MetalLB.

**WS2 — Storage migration (critical path).**
- **CNPG Postgres — method = bootstrap-from-Barman-backup** (NOT pg_dump, NOT volume snapshot). All 5 clusters already continuously archive base+WAL to S3 with PITR; CNPG `bootstrap.recovery` stands up a new cluster on the target from that exact ObjectStore — *the migration tool already runs nightly*. Minimal-downtime per cluster: (1) pre-seed from fsn1 (no downtime); (2) quiesce app + final WAL ship; (3) repoint `DATABASE_URL` via ESO/Infisical; (4) re-point the target's own backups to a **new UK object-locked bucket** (`restormel-cnpg-backups-uk-ol`, object-lock at create time). Per-cluster DB downtime **≈ 2–5 min [ESTIMATE — DB sizes UNKNOWN; measure `cnpg_pg_database_size_bytes` first]**.
- **SurrealDB** — restore latest hourly `.surql` restic dump, final delta during quiesce; re-point CronJob to UK S3.
- **Huly (no current backup)** — Velero/restic file-level backup of PVCs; the migration is the moment to *add* backup.
- **Monitoring** — rebuild-from-IaC (Prometheus TSDB + Loki logs disposable; Grafana dashboards from Git); Loki bucket re-points to UK S3. **CloudBeaver** — rebuild.

**WS3 — Provider glue.** CSI → Civo CSI StorageClass (alias the `hcloud-volumes` name to minimise churn) / iomart Longhorn. LB/CCM → Civo LB / MetalLB. cert-manager DNS-01 webhook → keep Hetzner DNS through cutover (no webhook swap, one fewer moving part); move DNS to a UK operator post-migration only if a UK-DNS mandate exists. **DNS cutover:** pre-lower all A-record TTLs to 60s 48h ahead, flip node-IPs → new LB IP, restore TTLs. **Secrets — migrate Infisical FIRST** (it's CNPG-backed + a StatefulSet): restore its DB, restore master key from the **age escrow** (`eso-bootstrap.age`), bring ESO up → every namespace's secrets reconcile. **This is the dependency root.** **Registry — complete the Forgejo-on-cluster cutover** (mid-flight anyway), re-point `registry.allotmentology.tech` + the mirror CronJob to UK S3, and **close the Sophia/ghcr.io gap** (REC-PLAN-021 §6.5).

**Off-cluster non-UK deps — surfaced, not silently kept:** move CNPG/restic/registry/Loki S3 to UK S3 (keep fsn1 read-only until verified, then decommission); track the **Zuplo OSS-gateway migration** (REC-ADR-006, DRAFT — a UK cluster behind a US gateway is incoherent) in the same programme; add Resend to the register; ship the model-catalogue jurisdiction filter before any "sovereign" marketing.

**WS-Gov — mandatory ISMS update:** update `asset-inventory.yaml`, `suppliers.yaml` (add Civo/iomart, retire Hetzner-compute, add Resend), `ropa.yaml` (new UK residency), risk register; **file the change + incident/change record** (REC-TPL-004) per CLAUDE.md.

### (c) Cutover strategy — **Blue-green parallel-run, dependency-sequenced, DNS-switched**

Stand up the full target cluster in parallel (Argo app-of-apps pointed at the same `restormel-gitops` repo with a UK-target overlay), Hetzner stays fully live. Pre-seed all stateful data continuously until lag is minutes. **Sequence the cut by dependency: Infisical/ESO first → Forgejo/registry → CNPG clusters (per app, final-WAL-ship) → SurrealDB → apps → monitoring rebuilt.** DNS switch per service (TTL pre-lowered). Hetzner stays warm until verification passes. User-visible downtime ≈ a few minutes per stateful service during its final-WAL-ship/repoint; app layer effectively zero-downtime behind DNS. (Big-bang rejected — too much stateful surface; pure namespace-by-namespace fragile due to cross-namespace coupling on the shared ingress IP.)

### (d) Rollback + verification (BEFORE decommissioning Hetzner)

**Rollback = DNS flip back to the still-warm Hetzner node IPs** — viable at any point until teardown; no split-brain if source is enforced read-only at the cut instant. **Data-integrity gates (all must pass):** (1) PG row-count + `pg_database_size` parity per cluster ×5; (2) CNPG continuous-archiving healthy on target + successful ScheduledBackup to the new UK bucket + a **PITR restore drill** from it; (3) SurrealDB record-count parity + one restic cycle to UK S3 + restore check; (4) app smoke tests (auth/magic-link, Keys resolve/simulate, dashboard render — *check the actual screen*, Connect ingest round-trip, Forgejo push + registry pull); (5) all certs Ready **from prod issuer** (fix the live `argocd-server-tls` + staging usesophia smells); (6) deploy the comprehensive `dr-restore-drill` CronJob (designed, never deployed — also the Stage-C gate licensing .150 decommission). **Only after 1–6 green for a soak ≥48h / ≥1 backup cycle do we decommission Hetzner** (nodes first, fsn1 buckets last, after a final archived copy).

### (e) Effort estimate

[ESTIMATE — single experienced operator who already runs this cluster.]

| Workstream | Path A (Civo) | Path B (iomart) |
|---|---|---|
| WS1 cluster stand-up | 2–3 d | 5–7 d (+MetalLB +Longhorn +self-run etcd) |
| WS3 provider glue | 2–3 d | 3–4 d |
| Infisical/ESO migrate-first | 1–2 d | 1–2 d |
| WS2 CNPG ×5 pre-seed + cutover | 3–4 d | 3–4 d |
| WS2 Surreal + Huly + monitoring | 2–3 d | 3 d |
| Forgejo/registry + Sophia mirror | 2–3 d | 2–3 d |
| Verification + DR drill + soak | 2–3 d | 2–3 d |
| WS-Gov ISMS + change record | 1 d | 1 d |
| **Total** | **~15–22 person-days** | **~22–28 person-days** |

**Critical path:** cluster stand-up → Infisical/ESO → CNPG pre-seed → app cutover → verification. **Parallelisable:** the 5 CNPG clusters, Surreal/Huly/monitoring, provider-glue + governance.

### (f) Risk register

| ID | Risk | L/I | Mitigation |
|---|---|---|---|
| R-DATA | Data loss in CNPG/Surreal cutover | L/H | Read-only-on-source at cut; final-WAL-ship verify; row-count+size parity gate; keep fsn1 + Hetzner warm. CNPG bootstrap-recovery is PITR-exact. |
| R-DOWN | Downtime overruns budget (large DB replay) | M/M | Measure DB sizes first; pre-seed continuously; cut big DBs in low-traffic hours. |
| R-DNS/TLS | DNS lag / ACME re-issue failure | M/M | TTL 60s 48h ahead; keep Hetzner DNS through cutover; validate staging issuer; fix mis-wired `argocd-server-tls`. |
| R-CNI | Civo managed may pin Flannel, blocking Cilium kube-proxy-replacement | M/M | Confirm Civo BYO-Cilium **before commit**; fallback Flannel or BYO-cluster; nil on iomart. |
| R-HetznerDep | Hidden Hetzner-specific glue (CCM routes, CSI handles, Robot creds) | M/M | WS3 replaces 1:1; **enable Cilium WireGuard** so we don't carry the unencrypted-private-net assumption onto a new network. |
| R-GEO | Single-UK-region = no geo-redundancy | M/M | Replicate backups to a second UK S3 or to iomart; or run iomart multi-DC as DR. Decide explicitly. |
| R-PRICE | UK pricing higher than Hetzner cx-class | M/M | Model against the £57 cap before commit; measure egress first; expect a real increase = price of the UK bar. |
| R-SOV-RESIDUAL | Zuplo/Resend/model-BYOK stay off-UK | M/M | Don't ship "sovereign" until OSS-gateway ADR lands, Resend registered, jurisdiction filter shipped; update RISK-003. |
| R-GOV | ISMS records drift during change | L/M | Mandatory WS-Gov + file change/incident record (REC-TPL-004). |
| R-ETCD (Path B) | Self-run etcd DR (J10) | M/H | Wire `--etcd-s3` to UK S3 day one. Moot on Civo. |
| R-STORAGE-B (Path B) | Longhorn operational burden | M/M | Only if iomart; budget extra ops + dedicated Longhorn backup target. Strong reason to prefer Civo. |

**Measure-before-commit blockers:** CNPG DB on-disk sizes, registry blob bytes, monthly egress — all **[UNKNOWN]** read-only today; obtain from Prometheus / Hetzner billing before scheduling the window.

---

## 7. RECOMMENDATION

**Provider:** **Civo Limited** (UK founder-controlled, managed Kubernetes that *is* K3s, LIVE on G-Cloud 14, CE Plus + ISO 27001 + SOC 2 held). Alternate / DR partner: **iomart** (multi-UK-site in-country DR).

**Architecture path:** Civo managed K3s — a 1:1 structural analogue of the live Hetzner stack (K3s + CCM-LB + CSI + S3); offload control-plane + etcd durability (closing the live J10 etcd-DR gap); front Traefik with a Civo LoadBalancer to *upgrade* ingress to real HA; enable Cilium WireGuard.

**Migration approach:** **Blue-green parallel-run, dependency-sequenced (Infisical/ESO first), DNS-switched.** CNPG = bootstrap-from-Barman-backup; other PVCs = logical restore where a dump exists, Velero/restic otherwise. Hard gates before Hetzner decommission: PG parity ×5 + PITR restore from the new UK bucket + Surreal parity + app smoke tests + all certs Ready-from-prod + comprehensive DR drill, soaked ≥48h with Hetzner kept warm for rollback.

**Cost:** ~£200/mo infra (3.7x Hetzner's ~£54), but **~0.52x Hetzner on steady-state full TCO** once self-managed ops labour is valued (Civo's managed control plane saves ~£600/mo of toil). One-off migration ~£9.2k [ESTIMATE]. Effort ~15–22 person-days.

**Sovereignty rationale (stated explicitly):** Restormel's compute is **already EU-sovereign and outside US CLOUD-Act reach** on Hetzner — that is not the problem. The problem the migration solves is **UK soil + UK corporate jurisdiction + a compliant G-Cloud procurement route**, which is what UK public-sector OFFICIAL(-SENSITIVE) buyers actually gate on. **Do this migration only if UK-residency + G-Cloud procurement is a genuine business requirement.** If it is not, the higher-leverage path is to **stay on Hetzner and close the procurement gaps in order** — certify (CE → CE Plus → ISO 27001), list on the next G-Cloud iteration, publish a buyer-facing DPA + sub-processor page, and close residual US-SaaS exposure (Zuplo/Resend/Sentry/Google) on any regulated path. Either way, the move must not be marketed as "sovereign" while Zuplo (US gateway), Resend, and model-BYOK egress remain on non-UK surfaces and the ISMS asset/supplier/ROPA records remain stale.

---

**Key repo references:** `deploy/k3s/gitops/` (Argo GitOps shape — authoring mirror only; live source of truth is the separate `restormel-gitops` repo), `planning/planning-context.md §7/§11` (Zuplo/sovereignty endgame), `governance/suppliers.yaml` + `asset-inventory.yaml` (stale — must update), `governance/risk-register.yaml` RISK-003, `records/SCHEMA.md`.

**Sources:** GSCP / PPN 012 (GOV.UK, 30-Jun-2023); NCSC Cloud Security Principles v2.1 (7-Jun-2023); CCS G-Cloud 14 RM1557.14 (live 29-Oct-2024, extended to Oct-2026); CLOUD-Act jurisdiction analysis (Kiteworks/CMS/techUK 2024–25). Civo Managed Kubernetes / CCM / CSI / Object-Storage-as-PV; iomart UK data centres + G-Cloud supplier listing; OVHcloud public-cloud pricing. Prices dated June-2026 — re-pull before commitment.
