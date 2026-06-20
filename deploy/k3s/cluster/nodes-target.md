# Target node topology + Path-A fold-in note

> **Config-only.** Nothing here provisions infra. This documents the *target*
> 3-box control-plane the bootstrap cluster grows into, and the exact reason
> `cluster_config.yaml` provisions only ONE node at bootstrap.
>
> Source of truth: `planning/k3s-cluster-target-design.md` §2 / §2.1 / §3.3 and
> the Decisions register in `planning/full-migration-plan-k3s.md`.

## Why `masters_pool.instance_count: 1` (not 3)

`hetzner-k3s create` provisions **new Hetzner Cloud nodes** for everything in
`masters_pool`. Our three control-plane members are the **existing** boxes
(.167 / .150 / .166) — **existing Hetzner Cloud servers** running prod (`cx33` /
`cx33` / `cx43`, hel1; verified via the hcloud API 2026-06-20), **not** new nodes
for the tool to create. Setting `instance_count: 3` would spin up three *extra*,
brand-new Cloud servers (unwanted spend, wrong machines — they would NOT be these
prod boxes). So the tool provisions **one** node — the
temporary CX43 bootstrap node — and the boxes are **hand-joined** as additional
control-plane servers out-of-band. hetzner-k3s then *manages* the resulting
cluster (CCM / CSI / autoscaler).

## Bootstrap → target sequence (Path A — DECIDED)

```
STAGE 0  bootstrap        STAGE 1  fold boxes in            STAGE 2  retire temp
─────────────────         ────────────────────────         ──────────────────────
 temp CX43 (Cloud)         temp CX43   (still CP)            [temp node DELETED]
 16GB · cluster-init  ──▶  + .166 joined as CP+etcd    ──▶   .167  CP+etcd
 single etcd member        + .150 joined as CP+etcd          .150  CP+etcd
 hel1, €20 credit          + .167 joined as CP+etcd          .166  CP+etcd
                           = 4 etcd members (transient)      = 3-member quorum
```

Join order for the existing boxes (design §3.3, lowest-risk first):
**`.166` → `.150` → `.167`** (prod box `.167` last), as each box's workloads
move onto the cluster and free it. Once all three are joined and stable, the
temp CX43 is removed from etcd and **deleted** (stop the €20-credit burn).

## Target 3-box control plane (post-fold-in)

| Node   | Public | Private (172.16.0.0/16) | Type | RAM/Disk    | Role label   | Carries (design §2) |
|--------|--------|-------------------------|------|-------------|--------------|----------------------|
| node-a `.167` | prod  | 172.16.0.3 | CX33 | 8 GB / 80 GB  | `role=prod` | Restormel dash+worker; CNPG replica; Traefik; cert-manager |
| node-b `.150` | ops   | 172.16.0.2 | CX33 | 8 GB / 80 GB (tightest) | `role=ops`  | Allotmentology; staging/preview; Traefik; ESO; Argo CD |
| node-c `.166` | data  | 172.16.0.4 | CX43 | 16 GB / 150 GB (roomy)  | `role=data` | CNPG primaries; SurrealDB STS; Supabase (Phase B) |

All three are **control-plane + etcd + schedulable** (`schedule_workloads_on_masters: true`).
3-member embedded-etcd quorum tolerates one node loss.

### Node role labels (apply after each box joins)

`hetzner-k3s` only labels pools it provisions; hand-joined boxes are labelled
out-of-band so workload affinity/anti-affinity (design §2.1, §4.1) can target them:

```bash
# run once per box after it joins (operator, off-cluster) — NOT applied by CI
kubectl label node node-a-167 role=prod  --overwrite
kubectl label node node-b-150 role=ops   --overwrite
kubectl label node node-c-166 role=data  --overwrite
```

## Stays OFF-CLUSTER permanently (bootstrap anchors — Decisions register)

**Forgejo + its Postgres + the Actions runner + Infisical** remain on the host
(plain docker-compose) so CI / GitOps / secrets survive a full cluster rebuild.
The cluster is the deploy *target*; the things that build and deploy it must not
depend on it being healthy (design §1, §4.5, §8).
