# `deploy/k3s/` — Sovereign K3s cluster config artifacts

> **CONFIG-ONLY. NOTHING IN THIS TREE IS APPLIED OR PROVISIONS INFRASTRUCTURE.**
> These are reviewable configuration files for the sovereign migration
> (Coolify-on-3-boxes → self-managed K3s). No cluster is created, no manifest is
> applied, and no secret value is committed by merging this. Every file is run
> **by hand, off-cluster, by the operator** during the migration window.
>
> Source of truth: [`planning/k3s-cluster-target-design.md`](../../planning/k3s-cluster-target-design.md)
> (the *how*) and the **Decisions register** in
> [`planning/full-migration-plan-k3s.md`](../../planning/full-migration-plan-k3s.md)
> (authoritative for both docs — the *what/when*). Decisions here are taken from
> those documents and are not re-litigated.

## Path-A bootstrap (the one-paragraph version)

The cluster is **first stood up on a TEMPORARY Hetzner CLOUD node** (≈ **CX43**,
x86 shared-vCPU, 8 vCPU / 16 GB, €15.99/mo) funded by the **€20 "Hetzner Cloud Community" credit
(redeem before 31 Aug 2026)** — a Hetzner **Cloud** server, **not** a
Robot/dedicated box (€20 won't cover one, and `hetzner-k3s` provisions Cloud
only). State is migrated onto the cluster, then the **three existing boxes
(.167 / .150 / .166) are folded in** as control-plane (embedded-etcd) members,
and the **temp node is retired**. A live prod box is **never** converted in
place. See [`cluster/nodes-target.md`](cluster/nodes-target.md) for the exact
bootstrap→fold-in→retire sequence and why `masters_pool.instance_count: 1`.

## Files

| Path | What it is |
|---|---|
| `cluster/cluster_config.yaml` | **hetzner-k3s v2.5.0** cluster config for the Path-A bootstrap: reuse the existing `restormel-internal` private net (172.16.0.0/16), Cilium CNI, pinned k3s version, schedulable control plane, scale-to-zero burst pool (min=0/max=2, `workload=burst` NoSchedule taint), locked `allowed_networks.api/ssh`, etcd secrets-encryption + snapshots. `hetzner_token` is **empty** → sourced from `$HCLOUD_TOKEN` at runtime, never inlined. |
| `cluster/nodes-target.md` | Target 3-box control-plane topology, node role labels, and the bootstrap→fold-in→retire mechanics. Documents why only 1 master node is provisioned. |
| `ingress/traefik-helm-values.yaml` | **Traefik** Helm values (chart v41.0.0) — **our own** ingress, **DaemonSet**, hostPort :80/:443, single-node ingress (no paid LB). NOT Coolify's, NOT k3s' bundled Traefik (which `cluster_config.yaml` disables). TLS comes from cert-manager, not Traefik ACME. |
| `ingress/clusterissuer-letsencrypt.yaml` | **cert-manager** (v1.20.2) `ClusterIssuer`s — Let's Encrypt **ACME DNS-01 via Hetzner DNS** (official `cert-manager-webhook-hetzner`, `groupName: acme.hetzner.com`). Staging + prod issuers; **deSEC fallback** block (commented); **no Cloudflare**. |
| `ingress/ingress-routes.yaml` | The **hostname → Ingress map** (design §3.5) + wildcard `Certificate`s. Includes the **`surreal.restormel.dev` HARD INVARIANT** (Sophia dependency). Forgejo/Infisical deliberately **off-cluster** (not routed). |
| `secrets/secretstore-infisical.yaml` | **External Secrets Operator** (v2.6.0) `SecretStore` — Infisical provider, machine-identity (Universal Auth), project `restormel-ops` / env `prod`. Optional `ClusterSecretStore` variant commented. |
| `secrets/machine-identity-bootstrap.example.yaml` | **EXAMPLE** placeholder for the single out-of-band secret (the Infisical machine-identity clientId/clientSecret). Created by the operator's hand, never via git. |
| `secrets/externalsecrets.yaml` | Example `ExternalSecret`s — CNPG S3 creds, Hetzner DNS token, hcloud CCM/CSI token, an app env bundle, and a scoped SurrealDB credential. **Placeholders only** (Infisical secret *names*, no values). |

## Apply order (operator, off-cluster — for reference; NOT executed by CI)

0. **Operator tooling** — `hetzner-k3s` shells out to **`kubectl`** and **`helm`**;
   all three must be on PATH. Install them locally first (rehearsal finding 2026-06-20).
1. **Pre-flight** — set `<OPERATOR_IP>/32` to the operator's **current** egress IP, the
   SSH key name, and confirm the existing private network name in
   `cluster/cluster_config.yaml`. Export `HCLOUD_TOKEN` from the secret store (never
   write it to disk; the `hetzner_token` key stays **omitted** — see that file).
   ⚠ The operator IP locks SSH + kube-API; on a **dynamic broadband IP** a change locks
   you out — recoverable by updating the firewall via the **hcloud API** (never
   SSH/kube-dependent). Durable fix: reach kube-API over the **private network** via a
   box tunnel and drop the public IP from `allowed_networks.api`.
2. **Create the cluster** — `hetzner-k3s create --config cluster/cluster_config.yaml`
   (provisions the **temp CX43 bootstrap node** only).
3. **Hetzner CCM + CSI** — install the cloud-controller-manager + CSI driver
   (needs the hcloud token; delivered in-cluster by ESO once it's up, or via a
   one-shot operator Secret to bootstrap).
4. **External Secrets Operator** — `helm install external-secrets …`, then create
   the out-of-band `infisical-machine-identity` Secret (step from
   `secrets/machine-identity-bootstrap.example.yaml`), then apply
   `secrets/secretstore-infisical.yaml` and `secrets/externalsecrets.yaml`.
5. **cert-manager + Hetzner webhook** — `helm install cert-manager …` and the
   `cert-manager-webhook-hetzner` chart, then apply
   `ingress/clusterissuer-letsencrypt.yaml` (the `hetzner-dns-token` ExternalSecret
   from step 4 must exist first).
6. **Traefik** — `helm install traefik … -f ingress/traefik-helm-values.yaml`.
7. **Workloads + ingress** — per the **per-product migration PRs** (Phase A/B):
   CNPG, SurrealDB, the apps, then `ingress/ingress-routes.yaml` (the Services it
   references are created by those PRs — applying it earlier yields intentional 503s).
8. **Fold the boxes in & retire the temp node** — per `cluster/nodes-target.md`
   (`.166` → `.150` → `.167`), then delete the temp CX43.

> GitOps (Argo CD) takes over routine syncs after bootstrap (design §8). Prod
> sync stays **manual / gated** (prod is never main-auto-deploy). Forgejo +
> Infisical stay **off-cluster permanently** (bootstrap anchors).

## Pinned tool versions (verified 2026-06-20)

| Tool | Version | Note |
|---|---|---|
| hetzner-k3s | **v2.5.0** | config_format_version 2; matches design §3.1 |
| k3s | **v1.34.8+k3s1** | pinned one minor back from latest stable (v1.36.1) for soak |
| Cilium | **v1.19.5** | installed by hetzner-k3s (`cni.mode: cilium`) |
| Traefik Helm chart | **v41.0.0** | DaemonSet ingress |
| cert-manager | **v1.20.2** | + official `cert-manager-webhook-hetzner` |
| External Secrets Operator | **v2.6.0** | chart `external-secrets` 2.6.0; API `external-secrets.io/v1` |
| CloudNativePG | **v1.29.1** | DB plane (manifests in the **CNPG** migration PR, not here) |
| Argo CD | **v3.4.4** | GitOps (manifests land later; off-cluster Forgejo hosts the repo) |

## Rehearsal validation (2026-06-20)

A full Path-A rehearsal stood the cluster up on a temp CX43 (`172.16.0.5`), validated it,
and tore it down clean — **no orphaned servers / firewalls / volumes; the existing network
and the 3 boxes untouched**. Proven end-to-end: provisioning, k3s v1.34.8, Cilium, Hetzner
CCM + CSI (dynamic `hcloud-volumes` attach), the autoscaler, and **CNPG → Barman → S3
backups landing in `restormel-cnpg-backups-fsn1`** (base backup + WAL archiving, verified at
the object-storage layer). Findings folded into config/docs:

- **`hetzner_token: ""` aborts `create`** — the key must be **absent**, not an empty string
  (fixed in `cluster/cluster_config.yaml`).
- **`kubectl` + `helm` are operator prerequisites** — hetzner-k3s shells out to them (step 0).
- **Hetzner CSI minimum volume = 10 GiB** — CNPG `storage` / `walStorage` requests below 10 Gi
  round up, so size them **≥ 10 Gi** to avoid paying for unused capacity.
- **`protect_against_deletion: true`** makes `hetzner-k3s delete` prompt for the cluster name
  (set it `false` or pipe the name) — kept `true` here as the safe default.
- **Still to validate at the real apply** (not exercised in this rehearsal): ESO ← Infisical,
  cert-manager DNS-01, Traefik, the **Barman Cloud _plugin_** path (needs cert-manager; the
  rehearsal used in-tree `barmanObjectStore` for speed), and SurrealDB.

## Known gaps / open items (flag for founder)

- **PlotBudget production domain (TBD)** — needed for its wildcard `Certificate`,
  ingress route, and Supabase `SITE_URL`/JWT. Omitted here; add a Certificate +
  Ingress block when supplied (design §10).
- **Object Storage region — DECIDED `fsn1`** (cross-region from the `hel1` compute,
  for DR geo-separation; 2026-06-20). The Decisions register, full plan, and these
  CNPG/ESO manifests all target **`fsn1`**; the design doc §4.3 is reconciled to match,
  so the endpoint the CNPG migration PR wires is `https://fsn1.your-objectstorage.com`.
- **Operator IP / SSH key name** — set `<OPERATOR_IP>/32` to the operator egress IP
  before apply (the live `surreal-box-fw` currently allows SSH from `82.42.129.209/32`).
  SSH key = **`adam@allotment-hetzner`** (resolved 2026-06-20 — already attached to the
  bootstrap node; private key `~/.ssh/id_hetzner_allotment` on the operator Mac).
  `restormel-internal` private network confirmed live.
- **Auth plane** — `auth.restormel.dev` is routed to a `auth-plane` Service on the
  Better Auth decision (register); the concrete Deployment lands in a later PR.
