---
title: "Ops Centre — K3s Rework (observability for the sovereign cluster)"
class: planning
owner: founder
status: proposal-awaiting-founder-sign-off
classification: internal
control-tier: 1
created: 2026-06-20
last-reviewed: 2026-06-20
review-interval: P12M
related: [REC-PLAN-012, RISK-001, AST-003, AST-019, REC-INC-001, REC-INC-006]
---

# Ops Centre — K3s Rework

> **This revision incorporates an adversarial review** (2026-06-20). It corrects a recorded-decision
> reversal (GlitchTip → Bugsink, #166 F-3), an honest restatement of the meta-monitoring topology
> (`.166` is *both* a cluster node and the off-cluster Forgejo/Infisical host — not an isolated
> watcher), a concrete GitOps placement (a new child Argo Application under `applications/addons/`),
> and adds five previously-missing monitored surfaces (Barman plugin sidecar, Surreal export RPO,
> Argo PostSync/PBI-lifecycle hook, cluster-autoscaler + burst-pool cost meta-health, etcd-snapshot
> age). §10 is completed.

**Reworks the Operations Centre plan (PR #166, `docs/infra/operations-centre-delivery-plan.md`,
2026-06-19) for the sovereign K3s model.** The #166 plan put a Grafana + Loki + Prometheus + Alloy
stack on the off-cluster build box `.166` and treated *boxes* as the unit of observation. The K3s
migration replaces three Coolify boxes with one orchestrated cluster, so the unit is now **pods +
ServiceMonitors + CRDs**, and Alloy-Docker-agent collection is obsolete. The **tooling philosophy,
backup mechanics, Telegram channel, and the PostHog error-tracking decision all survive** — what
changes is *placement* (in-cluster, GitOps-delivered) and *collection* (cluster-native scrape, not
box agents).

Companion to [full-migration-plan-k3s.md](full-migration-plan-k3s.md) (Decisions register =
authoritative), [k3s-cluster-target-design.md](k3s-cluster-target-design.md) (the *how* of the
platform), and [k3s-migration-execution-sequence.md](k3s-migration-execution-sequence.md) (the
*when*). The *how* of each manifest lands in `deploy/k3s/monitoring/**` (to be authored). **This is
a planning doc — no infra/config has been changed.**

> This plan defers to the migration plan's **Decisions register** for all cross-cutting decisions
> (topology, off-cluster anchors, fsn1 backups, Argo/GitOps, Telegram, DR targets). The monitoring
> decisions it adds are tabled in §10 and proposed for adoption into that register so the two docs
> can't silently drift.

---

## 1. What changed, and why the rework

| #166 assumption | K3s reality | Effect on the plan |
|---|---|---|
| Three discrete Hetzner boxes on a private mesh | One 3-node K3s cluster (embedded-etcd HA, all CP nodes schedulable) | Unit of observation is pods/CRDs, not boxes |
| Monitoring control plane on the off-cluster build box `.166` | `.166` becomes **node-c** *inside* the cluster (`role=data`/most headroom) **while also** hosting Forgejo + Infisical off-cluster as docker-compose | Primary stack moves **in-cluster**; the off-cluster anchor shares `.166`'s failure domain (§2.2) |
| Alloy Docker agents (`loki.source.docker`) | K3s workloads log via kubelet, not Docker | Log collection becomes a cluster-native DaemonSet |
| Prometheus scrape via Alloy `remote_write` from box agents | ServiceMonitor CRDs + Operator service-discovery | Adopt **kube-prometheus-stack**, not hand-assembled Prometheus |
| Beszel for host metrics | node-exporter DaemonSet (uniform across CP nodes + burst pool) | Beszel **dropped** (it was never built; node-exporter supersedes it) |
| Coolify as control plane | Argo CD GitOps | Stack delivered as an Argo Application; Coolify labels (rate-limit etc.) move to Traefik values |
| No cluster-component signals (etcd, scheduler, CNPG, Argo, ESO…) | A whole new distributed-systems surface to watch | New per-component coverage (§3) — the bulk of the rework |
| CNPG exporter assumed off (boxes ran hand-rolled PG) | CNPG ships a Prometheus exporter, **currently dark** — no `monitoring:` block on any `deploy/k3s/cnpg/cluster-*.yaml` | One-line spec change per cluster is the single highest-value fix (§3, §10 D-M2) |
| #166 had no monitoring in the K3s artifacts; the execution sequence has no observability phase | Monitoring is a platform invariant (like ESO/cert-manager) and must watch **before** prod state moves | Insert **Phase 1.6** (§7) |
| Error tracking = **GlitchTip** (#166 body, written before F-3) | **#166 F-3 (2026-06-19) DROPPED GlitchTip**; fallback is **Bugsink** only if PostHog falls short | Every "GlitchTip" reference is corrected to "Bugsink (optional)"; PostHog stays the product error tracker (§5, §10 D-M5) |

**Two structural gaps this plan closes:** (1) there is **no monitoring in `deploy/k3s/**` yet**
(grep finds only Cilium/Hubble + CNPG backups + Surreal); (2) the **execution sequence has no
observability phase** — monitoring must be a Phase-1.6 add-on so it is watching before Phase-2 data
migration.

**Incident history this is built to never repeat:** the Neon egress runaway (no alarm, REC-INC →
database-strategy), the disk-full PG PANIC that crashed Forgejo (prod box), a prod-box OOM during
migration, the broken push-deploy (REC-INC-006), and the catalog 503 (REC-INC-001) — the alert that
*did* fire, via Telegram, proving the channel. Each maps to a concrete cluster alert below.

---

## 2. Target architecture — what to deploy, and where

**In-cluster primary stack + a thin off-cluster meta-monitor + a genuinely off-estate external
dead-man's-switch. One Grafana pane for metrics, logs, and Hubble flows. Telegram stays the human
channel; PostHog stays the product error tracker.**

### 2.1 The stack
1. **Metrics + alerting core — `kube-prometheus-stack` (Helm), in-cluster.** Prometheus Operator +
   Prometheus + Grafana + node-exporter DaemonSet + kube-state-metrics + Alertmanager, one Helm
   release with curated K8s dashboards/alerts. The Operator auto-discovers the API server, etcd,
   scheduler/controller-manager, nodes, and **any component shipping a ServiceMonitor** — CNPG,
   Traefik, cert-manager, ESO, Argo CD, Cilium all do. This is strictly better than #166's
   "discrete Prometheus/Grafana/node-exporter," which was sized for a Docker box with no pods to
   scrape. **node-exporter replaces Beszel** (host metrics, native + uniform across nodes + burst
   pool). **Pin a tested chart version** (§10 D-M11) — don't track latest.
2. **Logs — Loki + Grafana Alloy (DaemonSet), self-hosted.** Keeps #166's named Alloy as the
   collector, now as a kubelet-tailing DaemonSet (not Docker agents); Loki as the store. This is
   the K3s realisation of #166's deferred B5/Loki. (Grafana-stack `promtail` is the 1-line fallback
   if Alloy-on-K8s bites.)
3. **Network — Cilium **Hubble**** metrics + UI, already specified in design §3.2. Scrape
   cilium/hubble into the same Prometheus; no extra component.
4. **App/product layer — keep PostHog.** Product error tracking (`handleError` hooks,
   `hooks.server.ts`) + security/business events (auth-failure spike, ingest error rate, egress
   runaway by endpoint) + Signals anomaly scouts. PostHog sees what infra metrics can't — do **not**
   migrate it into Prometheus. **Bugsink stays OPTIONAL — adopt only if PostHog Error Tracking falls
   short (per #166 F-3, 2026-06-19); GlitchTip was DROPPED.** Bugsink is single-process and EU-built,
   the right footprint for a lean cluster. If adopted, it lives in-cluster (greenfield — no Sentry
   migration, #166 Finding 1). **Sentry remains never-deployed.**
5. **Alerting — Alertmanager → Telegram**, carrying #166's actionable-alert template (first action
   + runbook link + auto-captured context). PostHog alerts also route to Telegram. One human
   channel, two producers.

### 2.2 Placement — in-cluster `monitoring` ns; a meta-monitor that shares `.166`'s domain; one truly off-estate pager

- **Primary stack runs IN-CLUSTER** in a dedicated `monitoring` namespace, deployed as an Argo CD
  Application alongside the other platform add-ons (a new child under `applications/addons/`,
  sync-wave after CRDs — see §8). In-cluster is correct now: the things to watch (pods, etcd, CNPG,
  Cilium) are in-cluster and ServiceMonitor-native. #166's "control plane on the build box, never
  the prod box" was a Coolify-era RAM constraint; K3s scheduling handles it better. Prefer a **soft**
  affinity toward `role=data` (`.166`/CX43, 16 GB, most headroom) plus a PodDisruptionBudget, **not**
  a hard pin — see the contention caveat below — with tight retention and requests/limits.

- **Be honest about the meta-monitor topology — there is a residual `.166` SPOF.** The monitor of the
  cluster must not depend on the cluster, so an in-cluster Prometheus/Alertmanager cannot page when
  the cluster is down. The instinct is to put a thin watcher "off-cluster" on the Forgejo/Infisical
  host. **But that host *is* `.166`, which is simultaneously cluster node-c (schedulable CP+etcd) AND
  the off-cluster docker-compose host for Forgejo + Infisical (design §2 topology + Decision-4).** So
  a docker-compose watcher there survives a *control-plane/etcd* failure (it is not a pod) **but does
  NOT survive a `.166` node loss** — a single `.166` outage takes the cluster node, Forgejo,
  Infisical, *and* the watcher together. **Do not claim isolation the topology does not give.**

- **Layering, stated plainly:**
  - **OUTERMOST (genuinely off-estate): an external dead-man's-switch** — healthchecks.io /
    UptimeRobot free tier — pages if *everything*, including `.166`, is dark. This is the **only**
    layer not in `.166`'s failure domain. **Recommend adding a second free external prober** (e.g. the
    other of healthchecks.io / UptimeRobot, or a free Cronitor/Better-Uptime monitor) hitting
    `restormel.dev` + `surreal.restormel.dev` from outside, so the outermost pager is not itself a
    single free-tier dependency.
  - **MIDDLE (shares `.166`'s domain): Uptime-Kuma + a small Blackbox prober** on the `.166`
    docker-compose host, probing `restormel.dev`, `surreal.restormel.dev`, the kube-API, and Argo
    from outside the cluster → Telegram. Useful for fast "cluster is down but `.166` is up" detection,
    **but explicitly NOT a true off-box pager** — it dies with `.166`.
  - **INNER (in-cluster): the kube-prometheus-stack itself** — full-fidelity alerting while the
    cluster is healthy.

- **Open founder decision (§10 D-M9): the meta-monitor needs a non-`.166` home.** Burst nodes are
  scale-to-zero, so they are unusable as a watcher home (they may not exist when needed). The founder
  must either (a) **accept the residual `.166` SPOF** for the Uptime-Kuma/Blackbox layer, relying on
  the external DMS(es) as the only guaranteed off-estate pager, or (b) **fund a tiny always-on
  external box** (e.g. a CX22 ≈ €4–5/mo, or a free-tier VM elsewhere) to host the meta-monitor truly
  off-estate. This is a real decision with a real (small) cost — not a thing the plan can wave away.

```
 OUTERMOST (off-estate, free): healthchecks.io / UptimeRobot  +  2nd external prober
      ▲ dead-man ping / external HTTP — the ONLY layer outside .166's failure domain
 MIDDLE (.166 docker-compose host — SHARES .166's failure domain, dies with the node):
      Uptime-Kuma + Blackbox  ── probe restormel.dev · surreal.restormel.dev · kube-API · Argo  → Telegram
      ▲ external HTTP/TCP (survives a cluster rebuild, NOT a .166 loss)
 INNER (in-cluster, ns: monitoring, Argo-managed):
      Prometheus(+Operator) · Grafana · node-exporter · kube-state-metrics · Alertmanager → Telegram
      Loki + Alloy(DaemonSet)   ·   scrapes: api/etcd/sched/CM · Cilium/Hubble · CNPG (+Barman plugin) · Surreal
                                     Traefik · cert-manager · ESO · Argo · CSI · autoscaler · Phase-A apps
 PRODUCT (SaaS EU): PostHog — app errors + security/business events + Signals  → Telegram
```

### 2.3 Visual access — the dashboards + company-portal integration

The Ops Centre's UI surface, fronted by **Grafana**:

- **Grafana** (the front door) — every dashboard (cluster, CNPG/backups, nodes, apps) + the unified alert view; Loki logs are queried *through* Grafana.
- **Hubble UI** (Cilium) — live network flows / policy drops · **Argo CD UI** — sync/health/drift · **Alertmanager** — active/silenced alerts · **Uptime-Kuma** — the external status page (the off-estate meta-monitor).

**Exposure.** Traefik ingress + cert-manager TLS per UI at stable hostnames under `*.restormel.dev` (e.g. `grafana.`, `hubble.`, `argo.`, `alerts.`, `status.`). UIs not needed externally (Hubble, Alertmanager) can stay cluster-internal / `kubectl port-forward` only — least exposure.

**Auth — single sign-on, NOT per-tool passwords.** An `oauth2-proxy` (or Traefik forward-auth) middleware fronts the UIs, tied to the **company portal's Better Auth** so one login carries through (Grafana can alternatively use its native OAuth against the same IdP). Interim fallback before SSO is wired: Traefik basic-auth + operator-IP allowlist. **These UIs expose infra internals → auth is mandatory and this is a high-risk surface — route the auth wiring through `restormel-high-risk-security`.**

**Company-portal integration (allotmentology.tech).** Add an **"Ops Centre" card/section to the portal launchpad** linking to Grafana (+ the others), alongside the existing infra links. This is **cross-repo**: the ingress + auth manifests live HERE (restormel-keys, `deploy/k3s/monitoring/`); the launchpad links live in the **allotmentology repo** (a small follow-up PR there). With Better-Auth SSO, the portal session flows straight into the dashboards — no second login.

Open decisions for this: §10 **D-M13** (hostname scheme), **D-M14** (auth method), **D-M15** (which UIs are external vs internal-only).

### 2.4 The single-pane overview — at-a-glance operational health

The Ops Centre's **home** is ONE curated Grafana dashboard: a **RAG (red/amber/green) status board** of the most important operational areas, readable in a glance, where **each tile is a drill-down link** into the detailed view (CNPG dashboard, Hubble, Argo, logs, …). This is the dashboard the company-portal **"Ops Centre" card opens by default** (§2.3) — the "what's happening right now" front door; the deep views are one click in.

At-a-glance tiles (Phase A):

| Tile | Green / Amber / Red signal |
|---|---|
| **Cluster** | nodes Ready, etcd quorum, control-plane up, pending/unschedulable pods |
| **Backups** *(the one that matters most)* | CNPG last-backup success + **WAL-archiving-to-fsn1 healthy + age**; Surreal export age; restic→BX11 last-run. Red = any backup stale/failed. |
| **Apps** | restormel-dashboard / worker / allotmentology up + error rate (PostHog) + p95 latency |
| **Data** | CNPG replication lag · PVC headroom (the 10Gi vols) · Surreal up |
| **Delivery** | Argo app health/sync + **drift** · the PBI PostSync-hook last status (#184) |
| **Edge** | min cert days-to-expiry (wildcards) · Traefik 5xx rate · ingress up |
| **Secrets** | ESO sync status (any `SecretSyncedError`) |
| **Cost/scale** | **burst nodes count — should be 0 at rest** (€-bleed guard) |
| **Alerts** | count of firing alerts by severity (Alertmanager), linking to the alert list |

Built as a Grafana dashboard (stat + state-timeline panels), **provisioned as a ConfigMap via the Grafana sidecar** so it's GitOps-managed + version-controlled (not hand-built in the UI). RAG thresholds (amber-vs-red cut-offs per tile) → §10 **D-M17**.

---

## 3. What's monitored, per component

Phase-A scope first (cluster + control plane + the Phase-A apps); Phase-B components drop in as
new ServiceMonitors with zero stack rework (§7).

| Component | Key signals | Why it matters |
|---|---|---|
| **K3s API server** | 5xx rate, p99 latency, inflight requests, webhook-admission latency, apiserver-side etcd latency | All 3 boxes are schedulable CP nodes carrying prod load co-resident with etcd; API saturation is the leading indicator of node pressure / Argo/kubelet cascade. ServiceMonitor (built into the stack). |
| **Embedded etcd (3-member quorum)** | `etcd_server_has_leader`, leader-change churn, WAL-fsync + backend-commit p99, db size vs quota, peer RTT, member health, **etcd snapshot age** | **Quorum tolerates only ONE node loss**; etcd shares small 8 GB boxes with prod DB/app I/O → fsync contention is a real OOM/quorum risk (design §2.1). DR = `--cluster-reset` from snapshot, so a silently-failing k3s etcd snapshot is as dangerous as a failing CNPG backup — alert on snapshot age (§5.1). |
| **Scheduler + controller-manager** | pending/unschedulable pods, scheduling latency, CM workqueue depth, leader-election status | Tight node capacity + CNPG anti-affinity + burst taints → pods can silently fail to schedule; surfaces capacity exhaustion before a deploy hangs. |
| **Nodes (3 CP + burst pool) — node-exporter** | CPU, MemAvailable + **swap usage** (the deliberate OOM cushion), root + PVC fs %/inodes, disk I/O saturation, NotReady / Memory/Disk/PIDPressure, kubelet up | Disk-full and OOM were both real prod outages. node-exporter is the K3s-native successor to Beszel, uniform across every node. |
| **Cluster-autoscaler + burst pool** | autoscaler errors / `cluster_autoscaler_errors_total`, scale-up failures (unschedulable pods pending > N min), **burst node count > 0 for > N min**, last-scale-activity age | Two distinct silent failures: **(a) autoscaler stuck** → CI/overflow pods pend forever; **(b) burst nodes fail to scale back to zero** → silent €-bleed that breaks the "€0 at rest" guarantee. The generic pending-pods alert does not catch the autoscaler itself or the cost leak (§5.1). |
| **kube-state-metrics** | pod restarts / CrashLoopBackOff, Deployment/StatefulSet desired-vs-ready, PVC phase + capacity, **Job/CronJob failures** (Surreal export, etcd snapshot, scheduled backups) | Richest single source of workload health; the CronJob-failure alerts directly cover the Surreal-export and backup jobs. |
| **Cilium + Hubble** | agent up, endpoint-regen errors, BPF map pressure, **policy-drops by reason/namespace**, DNS errors, HTTP flow latency/status app↔DB; Hubble UI for ad-hoc flows | Cilium NetworkPolicy is **the** mechanism isolating prod DB traffic from build/ops pods on shared nodes — the entire rationale for leaving the single-blast-radius box (design §3.2). Policy drops = attack/misconfig *or* a broken legitimate path. |
| **CloudNativePG** (`pg-restormel`, `pg-platform`; `pg-plotbudget` Phase B) — **needs `monitoring.enablePodMonitor: true` added (currently ABSENT)** | primary/standby roles, connections vs max, TPS, query latency, **replication lag**, **WAL-archive health + last-archived-WAL age + archive failures to fsn1**, **last-base-backup age + PITR window**, switchover events, data + walStorage capacity | Postgres is the crown-jewel state plane; the Neon egress runaway (no alarm) and the disk-full PG PANIC are both in the incident history. **WAL-archiving-to-fsn1 + PITR readiness are the load-bearing DR guarantees (RPO ≤ 5 min)** — a silent WAL-archive failure is the worst undetected failure in the whole system. |
| **Barman Cloud *plugin* sidecar** (`barman-cloud.cloudnative-pg.io`) — **distinct from CNPG/PG health** | sidecar pod **up + ready**, WAL-archiver process **running**, plugin↔cert-manager cert validity, sidecar restarts/crashloop, plugin reconcile errors | These clusters use the **sidecar PLUGIN** (`plugins: - name: barman-cloud.cloudnative-pg.io`), NOT in-tree `barmanObjectStore` — first real validation on Hetzner is Phase 1.5 (less-trodden path, execution-sequence risk). The sidecar can crashloop or lose its cert-manager dependency **while Postgres itself looks perfectly healthy**, silently stopping archiving. Alert **"Barman plugin sidecar up + WAL-archiver running"** is **separate from** the WAL-archive-age alert (§5.1) — the age alert catches *output* gaps; this catches the *mechanism* being down. |
| **SurrealDB** (1-replica StatefulSet) | pod up/ready/restarts (single writer = any restart is downtime), PVC capacity/inodes, **no `/metrics` port exists** → blackbox `/health` on `surreal.restormel.dev` + the in-cluster Service (`surreal-db.data.svc.cluster.local:8000`), **hourly `surreal export` CronJob (`0 * * * *`) success + artifact age in BX11** | rocksdb single-writer = no HA; restore-from-backup *is* recovery, so export-success is critical. `surreal.restormel.dev` resolving to the cluster is a HARD cross-phase invariant (UseSophia) — a dark endpoint must page immediately. **RPO threshold is contested across the source docs — see §5.1 + §10 D-M10.** |
| **Traefik ingress (DaemonSet)** | request totals by code (2xx/4xx/**5xx rate**), duration p50/p99 per router, open connections, retries, TLS handshake errors, config-reload success | Single-node ingress (no LB) makes Traefik the sole public entry; edge 5xx/latency is the earliest user-facing signal. The #166 PostHog "5xx spike" alert moves here, at the edge. Also the rate-limit/egress-runaway defence surface (Coolify labels → Traefik values). |
| **cert-manager (DNS-01 wildcards)** | days-to-expiry, `certificate_ready_status`, ACME order/challenge failures, renewal errors | All public TLS (`restormel.dev`, `surreal.restormel.dev` wildcards) flows through DNS-01; a stuck renewal is a silent time-bomb that takes the estate offline at expiry. Also a dependency of the Barman plugin sidecar's cert. |
| **External Secrets Operator (← Infisical)** | ExternalSecret sync status / `SecretSyncedError`, last-sync age, SecretStore reachability to Infisical, reconcile errors | ESO renders **every** pod's secrets incl. the CNPG→fsn1 S3 creds; a sync failure silently breaks backups, deploys, cold-start. Infisical is off-cluster on `.166` → the link itself is a dependency to watch. |
| **Argo CD** | per-Application health + sync status, **OutOfSync/drift**, sync failures, reconcile latency, repo-server/redis up, **sync-operation + PostSync-hook failures** | Argo is the deploy control plane; **drift = an out-of-band change (governance/security concern) or a failed sync**. Prod sync is manual/gated → alert on *drift*, not "pending manual sync." **A failing PostSync hook (the PBI-lifecycle callback, now an Argo PostSync hook — still to implement, #184) silently breaks the planning→delivery audit trail** → alert on PostSync-hook / sync-operation failure (§5.1). |
| **Hetzner CCM + CSI / hcloud-volumes** | PV/PVC used vs capacity %, attach errors, CSI controller/node health, FailedMount/FailedAttach events | CSI volumes are deliberately tight — **`walStorage` is 10Gi, the Hetzner CSI floor (a smaller request silently rounds up — rehearsal finding 2026-06-20)**, separate from the 10Gi data PVC. A full WAL volume stalls Postgres **and** breaks archiving simultaneously. Attach failures on a node-move (Phase-3 box-fold) are a known failure mode. |
| **Phase-A apps** — `restormel-dashboard`, `restormel-worker`, `allotmentology` | HTTP RED metrics (if exposed) + Traefik per-router view, readiness/restarts/**OOMKills**, worker queue depth + job success/lag, `/health` blackbox; **PLUS PostHog**: exception capture + structured security events (auth failures, rate-limit hits, webhook-sig failures, credential-resolve, ingest error rate) | The revenue/product surfaces — the reason the cluster exists. `restormel-worker` is a separate Deployment (`restormel-worker-prod.yaml`). Infra metrics cover liveness; PostHog covers product-level errors + security/business signals infra can't see (#166 B1 — keep it, don't replace). |

---

## 4. Logs — Loki + Alloy, and retention

- **Collection:** **Grafana Alloy as a DaemonSet** tails every pod's stdout/stderr via kubelet —
  Traefik access logs, app logs, CNPG/Surreal logs, Barman-plugin sidecar logs, and K3s component
  logs — and writes to Loki. This replaces #166's `loki.source.docker` Docker-agent collection (no
  Docker socket in K3s).
- **Store:** **Loki** single-binary, in-cluster, on a small `hcloud-volumes` PVC; optionally
  back the chunk store to **fsn1** S3 (same object store as CNPG) to keep retention cheap.
- **LogQL alerts (the forensic layer behind every metric alert):** error-rate by namespace,
  **OOMKill** log lines, **NetworkPolicy-drop** correlation (with Hubble), **PG PANIC/FATAL**,
  **Barman-plugin archive errors**, ACME failures.
- **Retention (carry #166's "don't recreate a cost runaway" constraint):** Loki hot **30 d**;
  if S3-backed, cold tail to fsn1 mirroring the CNPG/restic cadence (7 d / 4 w / 6 m). Prometheus
  hot **15 d** + weekly TSDB snapshots. Bound ingestion; alert on Loki dropped-lines / ingestion
  spikes so observability doesn't quietly become the next egress runaway. **Storage/retention sizing
  on the crowded `.166`/16 GB box is an open call (§10 D-M11).**

---

## 5. Alerting — Telegram + PostHog + (optional) Bugsink

**One human channel (Telegram); two producers (Alertmanager + PostHog); Bugsink only as a fallback.**

- **Alertmanager → Telegram** routes/groups/inhibits all Prometheus + Loki alerts. Telegram is
  free, needs no SMTP, is already proven live (REC-INC-001) and is the channel PostHog already uses.
- **PostHog → Telegram** for product errors + business anomalies + Signals scouts (auth-failure
  spike, ingest error rate, egress runaway) — the app-layer producer.
- **Bugsink (optional, only if PostHog falls short — per #166 F-3, 2026-06-19; GlitchTip was
  dropped):** single-process, EU-built Sentry-SDK error tracker; add **only** if PostHog Error
  Tracking proves insufficient for dedicated Sentry-SDK triage. If adopted, it lives in-cluster
  (greenfield — no Sentry migration, #166 Finding 1) and webhooks into Loki for unified alerting.
- **Every alert carries #166's actionable template:** concrete first action + runbook link +
  auto-captured context (e.g. top processes on a RAM alert). **No bare metric alerts.** Refresh the
  `[TODO]`-laden `docs/runbooks/infra-alert-response.md` + the `restormel-infra-alert-response`
  skill from the old Beszel/Coolify taxonomy to the new Alertmanager/Loki one.

### 5.1 Seed alert rules (Phase A)

| Alert | Condition (indicative) | Severity | First action |
|---|---|---|---|
| **Node down / NotReady** | node `Ready=false` or kubelet down > 5 m | page | check box; if hard-down, quorum is at risk (only 1 loss tolerated) → runbook |
| **etcd quorum at risk** | `etcd_server_has_leader == 0` OR leader-change churn OR a member down | page | do NOT restart blindly; runbook (`--cluster-reset` from snapshot is last resort) |
| **etcd fsync slow** | WAL-fsync p99 > 100 ms sustained | warn→page | check disk I/O contention on the node; consider moving WAL-heavy CNPG off it |
| **etcd snapshot stale** | last k3s etcd snapshot age > 24 h (treat like a backup-success alert) | page | DR depends on this snapshot — verify the snapshot CronJob/timer + target; runbook |
| **CNPG backup failed / WAL-archive stalled** | last-archived-WAL age > threshold OR base-backup age > 26 h OR archive error to fsn1 | **page (highest)** | verify ESO `cnpg-s3-creds` synced + fsn1 reachable; PITR gap = data-loss risk |
| **Barman plugin sidecar down** | sidecar pod not ready OR WAL-archiver process not running OR plugin crashloop (distinct from archive-age) | **page (highest)** | the *mechanism* is down even if PG is healthy — check sidecar logs + its cert-manager cert; archiving is silently stopped |
| **CNPG replication lag / primary down** | lag > threshold OR primary unavailable | page | check standby streaming; switchover runbook |
| **Surreal endpoint dark / export failed** | blackbox `surreal.restormel.dev` `/health` failing OR export CronJob failed OR **export artifact age > ~70 min** (hourly `0 * * * *` + grace) | page | hard UseSophia invariant — restore path is backup; runbook. **NB: this ~70 min threshold tightens the design's stated ≤24h RPO — discrepancy flagged for the founder (§10 D-M10)** |
| **Traefik 5xx spike** | edge 5xx rate over baseline | page | identify router; correlate Loki + Hubble; rate-limit if abuse |
| **Cert expiring & not renewing** | expiry < 21 d AND `Ready=false` | warn→page | check DNS-01 challenge + Hetzner DNS token ExternalSecret |
| **ESO sync failing** | any ExternalSecret in error OR SecretStore unreachable | page | check Infisical (off-cluster, `.166`) reachability + machine-identity creds |
| **Argo drift on prod app** | prod Application OutOfSync unexpectedly OR Degraded | warn→page | out-of-band change or failed sync — investigate before re-sync |
| **Argo PostSync / sync-operation failed** | any Application sync-operation phase = Failed OR PostSync hook job failed (e.g. the #184 PBI-lifecycle callback) | page | the deploy succeeded but the audit-trail callback broke — check the hook Job logs; planning→delivery trail is at risk |
| **Autoscaler stuck / scale-up failing** | `cluster_autoscaler_errors_total` rising OR pods unschedulable + no scale-up for > N min | warn→page | burst capacity can't provision — CI/overflow will hang; check Hetzner CCM creds + quota |
| **Burst nodes not scaling to zero (€-bleed)** | burst node count > 0 for > N min with no pending burst workload | warn→page | the "€0 at rest" guarantee is breached — check autoscaler scale-down + node taints; cordon/drain if needed |
| **PVC near-full** | any PVC > 80% (CNPG data, Surreal) **/ `walStorage` > 70%** (tightest, highest-consequence volume) | warn→page | a full WAL volume stalls Postgres + breaks archiving — expand/clean immediately |
| **Node disk / RAM pressure** | disk > 75% (ahead of any prune) OR MemAvailable low + swap climbing | warn→page | top consumers (auto-captured); prune/scale |
| **Meta: Alertmanager silent** (external DMS) | dead-man ping missed | page | the in-cluster stack itself is down — escalate to off-cluster checks; if `.166` is also dark the external DMS is the only signal left |

---

## 6. What carries over from #166 vs what's replaced

| Carries over (reuse as-is) | Replaced / retired |
|---|---|
| **Telegram** as the single human alert channel (now an Alertmanager receiver) | **Build-box `.166` as monitoring home** → in-cluster `monitoring` ns (`.166`'s off-cluster role is now Forgejo/Infisical, and it is *also* a cluster node — §2.2) |
| **PostHog** error tracking + security/business events + Signals scouts | **Beszel** host agents → node-exporter (Beszel was never built) |
| **Backup mechanics + retention** (Loki 30 d hot, restic 7 d/4 w/6 m cold, CNPG Barman→fsn1, Prometheus 15 d + snapshots) | **Alloy Docker agents** (`loki.source.docker`) → Alloy kubelet DaemonSet |
| **Alerting philosophy** — actionable alerts + remediation + runbook links; **external dead-man's-switch** as the one truly off-estate pager; alert SLAs | **Box-level monitoring over private mesh** → cluster-level (pods, etcd, CNI, controllers) |
| **Uptime-Kuma** — repurposed as the off-cluster blackbox prober in the meta-monitor (but shares `.166`'s failure domain — §2.2) | **Alloy `remote_write` from box agents** → ServiceMonitor CRDs + Operator discovery |
| **Loki + unified alerting design** — central log store; shift is upstream (cluster→Loki, not agent→Loki) | **Coolify** as control plane → Argo CD (Coolify rate-limit labels → Traefik values) |
| **PostHog-as-product-error-tracker decision** + the webhook→Loki pattern for any error tracker | **Hand-assembled discrete Prometheus/Grafana/node** → kube-prometheus-stack |
| **Monitoring runbook philosophy** (`infra-alert-response.md`) + the `restormel-infra-alert-response` skill | **Discrete-Prometheus sizing for a Docker box** (no pods to scrape) → Operator/ServiceMonitor model |
| **The error-tracking decision flag (F-3)** — resolved 2026-06-19: **GlitchTip DROPPED**; PostHog default, **Bugsink** as the only fallback (folded into §10 D-M5) | **GlitchTip** (the #166 body's default candidate) → **dropped** per F-3; Bugsink replaces it as the optional fallback |
| Sentry — **stays never-deployed** (no decommission work, #166 Finding 1) | — |

---

## 7. Phasing — Phase-A cluster + apps first, Phase-B extension

Slots into the migration plan's existing phases (it does **not** invent a parallel program):

- **Phase 1.6 — Observability platform add-on (NEW; before Phase 2 data migration).** Insert into
  [k3s-migration-execution-sequence.md](k3s-migration-execution-sequence.md) immediately after
  Phase 1 (platform up: ESO, cert-manager, Traefik, CNPG, Argo) and **before** Phase 2 (data moves).
  Monitoring is a platform invariant — it must be watching before prod state moves. Deliver:
  kube-prometheus-stack + Loki/Alloy + Hubble scrape in `monitoring` ns; **flip
  `monitoring.enablePodMonitor: true` on each CNPG cluster** (§10 D-M2); **Barman-plugin-sidecar +
  etcd-snapshot + autoscaler/burst-cost alerts**; Alertmanager→Telegram; the meta-monitor
  (Uptime-Kuma + Blackbox on `.166`) **plus** the off-estate external DMS(es); seed alert rules
  (§5.1); refresh the runbook + skill.
- **Phase-A scope (first):** API server, etcd (+snapshot), scheduler/CM, nodes, autoscaler/burst
  pool, kube-state-metrics, Cilium/Hubble, `pg-restormel` + `pg-platform` (+Barman plugin sidecar),
  SurrealDB, Traefik, cert-manager, ESO, Argo CD (+PostSync hook once #184 lands), CSI; apps
  `restormel-dashboard`, `restormel-worker`, `allotmentology` + their PostHog signals.
- **Phase-B extension (drops in, zero stack rework):** `pg-plotbudget` + self-hosted Supabase
  ServiceMonitors, UseSophia app + ingestion CronJob, and — if chosen — Bugsink. Each is a new
  ServiceMonitor / Argo app under the same stack.

---

## 8. GitOps delivery (Argo-managed, Helm, prod-gated)

- **Authored under `deploy/k3s/monitoring/**`** (to be created; the dir is currently empty — gap to
  close): kube-prometheus-stack Helm values, Loki + Alloy values, Grafana datasources/dashboards as
  ConfigMaps, ServiceMonitors/PodMonitors for components that don't self-register, Alertmanager
  config (Telegram receiver + routes/inhibitions), and the alert rules (§5.1).
- **Delivered as a NEW child Argo CD Application — author
  `deploy/k3s/gitops/applications/addons/monitoring.yaml`** pointing its `source.path` at
  `deploy/k3s/monitoring/`. The app-of-apps **root** already globs
  `include: '{addons/*.yaml,workloads/*.yaml}'`, so a new `addons/monitoring.yaml` is **picked up
  automatically** — no change to the root needed. Give it
  **`argocd.argoproj.io/sync-wave` AFTER `cluster-addons` (which is `-10`)** — e.g. `"-5"` — so the
  Prometheus-Operator CRDs land **before** the ServiceMonitors/PodMonitors that reference them.
  Mirror `cluster-addons`'s sync options (`CreateNamespace=true`, `ServerSideApply=true`,
  `ApplyOutOfSyncOnly=true`, `selfHeal: true`) since the stack is a platform invariant.
- **Do NOT try to extend `cluster-addons` to recurse `monitoring/` — it's impossible.**
  `cluster-addons` has `path: cluster` (it sweeps `deploy/k3s/cluster/**`); it cannot recurse a
  sibling dir. A separate child Application is the only correct route, and the root's glob makes it
  the cheap one.
- **Standard repo-move caveat:** as with every other Application here, **authoring lives in
  `restormel-keys` under `deploy/k3s/gitops/**`**, but the real GitOps path is the
  **`restormel-gitops` repo root** (`applications/addons/monitoring.yaml` → `cluster`/`monitoring`).
  The README "Repo move map" documents the 1:1 move.
- **No secrets in git, ever** — the Telegram bot token, Grafana admin, and any Loki/S3 creds render
  via **ESO ← Infisical** as ExternalSecrets (same pattern as `cnpg-s3-creds`).
- **Prod-gated where it touches prod:** the platform add-on auto-syncs (it's an invariant); but any
  alert-rule change that could *silence* a prod alert, and the off-cluster meta-monitor, follow the
  same manual/gated discipline as prod app sync. The Argo **PostSync hook (PBI-lifecycle callback,
  #184)** is itself monitored (§3, §5.1) so a broken hook doesn't silently drop the audit trail.

---

## 9. Backups, retention, and DR coverage of the monitoring data itself

- **Monitoring data is observability, not state of record** — it does **not** need the crown-jewel
  DR guarantees. Prometheus 15 d hot + weekly TSDB snapshots; Loki 30 d hot (optional fsn1 cold
  tail). Losing it loses history, not the business.
- **Grafana dashboards + Alertmanager config + alert rules ARE state of record** — but they live in
  git (`deploy/k3s/monitoring/**`), so the GitOps repo (Forgejo + GitHub mirror) is their backup;
  re-sync restores them. No separate backup job needed.
- **The things the monitoring *protects* — CNPG→fsn1 (Barman plugin), restic→BX11, etcd snapshots —
  are unchanged** (Decisions register #4); this plan only adds the alarms that prove those backups
  are working. DR drills (execution-sequence Phase 5) gain new checks: confirm the **WAL-archive +
  base-backup + Barman-plugin-sidecar + etcd-snapshot + Surreal-export alerts fire** when a backup
  is deliberately failed.

---

## 10. Open decisions for the founder (proposed for the Decisions register)

Tabled in register style so they can be promoted into
[full-migration-plan-k3s.md](full-migration-plan-k3s.md) once decided.

| ID | Area | Proposed decision | Status |
|---|---|---|---|
| **D-M1** | Monitoring placement | **In-cluster `monitoring` ns (kube-prometheus-stack) + meta-monitor on the `.166` docker-compose host + off-estate external DMS.** | **Proposed** — supersedes #166's "all on `.166`" |
| **D-M2** | CNPG exporter | **Add `monitoring.enablePodMonitor: true` to each `deploy/k3s/cnpg/cluster-*.yaml`** (currently absent). Highest-value one-line change — surfaces WAL-archive-to-fsn1 + PITR readiness. | **Proposed — recommend yes** |
| **D-M3** | Metrics tool | **kube-prometheus-stack** vs hand-assembled. Recommend the stack (Operator/ServiceMonitor native). Trade-off: heavier RAM on 8 GB boxes — mitigate via soft `role=data` affinity, tight retention, scrape-interval tuning, drop unused default rules. | **Proposed — recommend stack** |
| **D-M4** | Log store backend | Loki on a small PVC **vs** Loki S3-backed to **fsn1** (cheaper long retention, reuses CNPG bucket). | **Open** |
| **D-M5** | Error tracking (#166 F-3) | **Keep PostHog Error Tracking only; add self-hosted Bugsink (single-process, EU-built, in-cluster, Phase B) ONLY if PostHog falls short. GlitchTip is DROPPED (F-3, 2026-06-19).** Recommend PostHog-only until proven insufficient. | **Resolved direction (F-3): GlitchTip dropped, Bugsink is the fallback — confirm "PostHog-only for now"** |
| **D-M6** | Hubble UI exposure | Expose the Hubble UI via ingress (operator convenience) vs port-forward only (smaller attack surface). | **Open** |
| **D-M7** | Sequence | Adopt **Phase 1.6** into the execution sequence (monitoring before data migration). | **Proposed — recommend yes** |
| **D-M8** | External DMS provider | healthchecks.io vs UptimeRobot free tier as the outermost pager **plus a second free external prober** (the outermost layer must not be a single free-tier dependency). | **Open (low-stakes) — recommend two providers** |
| **D-M9** | Meta-monitor home (the real SPOF call) | The `.166` docker-compose meta-monitor **shares `.166`'s failure domain** — a `.166` loss takes the cluster node, Forgejo, Infisical, and the watcher together (burst nodes are scale-to-zero, so unusable as a home). **Either (a) accept the residual `.166` SPOF** (external DMS is then the only guaranteed off-estate pager) **or (b) fund a tiny always-on external box** (≈ CX22 €4–5/mo) for a truly off-estate meta-monitor. | **Open — founder must pick (a) or (b); real €-cost decision** |
| **D-M10** | Surreal export RPO discrepancy | The sources **disagree**: CronJob is **hourly (`0 * * * *`)**, the design Decisions register says **≤24h (daily)**, the execution sequence says **~1h**. The alert is set to export-age **> ~70 min** (the CronJob reality), which **tightens the design's ≤24h RPO**. Founder must reconcile: either ratify the hourly RPO into the design, or relax the alert to match ≤24h. | **Open — discrepancy flagged, do NOT silently pick** |
| **D-M11** | Monitoring storage/retention sizing + chart pin | (a) **Pin a tested `kube-prometheus-stack` (and Loki/Alloy) chart version** — don't track latest. (b) Decide Prometheus/Loki PVC sizes + retention on the **crowded `.166`/16 GB** box (which also carries Forgejo, Infisical, CI runner, and the WAL-heavy CNPG primaries) — size retention to the box's real headroom, prefer soft affinity + PDB over a hard pin. | **Open — sizing + version pin** |
| **D-M12** | Doc control-tier | This proposal is `control-tier: 1`. If it becomes the **authoritative** monitoring design (referenced by the execution sequence), it arguably warrants **tier ≥2**, which then requires `approved-by` / `approved-on` / `retention` per CLAUDE.md. Decide deliberately at sign-off. | **Open — set tier at sign-off** |
| **D-M13** | UI hostnames | Per-UI subdomains under `*.restormel.dev` (`grafana.`/`hubble.`/`argo.`/`alerts.`/`status.`) **vs** one `ops.restormel.dev` + paths. Recommend per-UI subdomains (clean TLS via the existing DNS-01 wildcard). | **Open — recommend per-UI subdomains** |
| **D-M14** | Dashboard auth (portal SSO) | `oauth2-proxy` / Traefik forward-auth tied to the company portal's **Better Auth** (one login, operator-scoped) **vs** Grafana-native OAuth **vs** interim Traefik basic-auth + operator-IP allowlist. Route the wiring through `restormel-high-risk-security`. | **Open — recommend Better-Auth SSO via oauth2-proxy** |
| **D-M15** | External vs internal UIs | Expose **Grafana (+ Argo CD + status page)** externally for the portal launchpad; keep **Hubble + Alertmanager** cluster-internal / port-forward (smaller attack surface). | **Open — recommend Grafana+Argo external, rest internal** |
| **D-M16** | Portal launchpad link | Add an **"Ops Centre" card** to the allotmentology.tech company portal launchpad → the single-pane overview (§2.4). Cross-repo follow-up in the **allotmentology repo** (ingress/auth live here in restormel-keys). | **Proposed — recommend yes** |
| **D-M17** | Single-pane RAG thresholds | Define amber/red cut-offs per overview tile (§2.4): backup age, cert days-to-expiry, replication lag, PVC %, 5xx rate, burst-nodes>0 duration, alert counts. Seed sensible defaults; tune after soak. | **Open — seed defaults, tune post-soak** |

**Still genuinely open elsewhere (not monitoring-specific, noted for completeness):**
PlotBudget's prod domain is needed before its Phase-B ingress/Supabase signals can be wired.
(The `governance/bcp-dr-policy.md` record is already filed + approved — REC-POL-005, PR #191.)
