# Ops Centre — Single-Pane Overview: design rationale

> Companion to `ops-centre-single-pane.json`. Realises **planning §2.4** (the
> single-pane RAG overview) and seeds **D-M17** (per-tile amber/red thresholds).
> Authoring lives here in `restormel-keys` under `deploy/k3s/monitoring/dashboards/`;
> it moves 1:1 into the `cluster/monitoring/**` path of `restormel-gitops` and is
> delivered as a Grafana sidecar **ConfigMap** (GitOps-managed, never hand-edited in
> the UI — same discipline as every other manifest here).

---

## 1. The ask, restated

The founder wants **one screen** — the "amygdala view" — where a non-expert can
glance and instantly know **what's healthy vs what's on fire**. Not a wall of graphs;
a small set of **big, legible, colour-coded tiles** for the operational areas that
actually matter, each a **door** into the detail.

The design goal is *pre-cognitive*: the answer to "is everything OK?" should land
before you read a single word — from **colour and layout alone**. Words are the
second layer (what specifically); drill-down is the third (why).

## 2. The at-a-glance philosophy

Three principles drive every choice:

1. **Worst-of, not average-of.** Each tile rolls up several signals by taking the
   **worst** child state, never an average. A backup that's 5/6 healthy is still
   "one backup degraded" (amber), because an average would hide the failure. Ops
   health is a chain — it's as strong as its weakest link, so the tile shows the
   weakest link.
2. **Red must mean *act now*; amber must mean *look soon*; green must mean *ignore*.**
   If green ever shows while something is wrong, the whole pane loses trust and the
   founder goes back to ad-hoc checks. So tiles **fail toward red** (`noValue` ⇒ red
   for safety-critical tiles) — a missing metric is treated as a possible outage, not
   silently green. (Two tiles fail to *amber* on no-data — Cost and the DMS — because
   for those, "not wired yet" is a setup gap, not a live outage; see §6.)
3. **Importance = blast radius, and layout encodes it.** Tiles are ordered by how
   much it hurts if they go red, top-left first (Western reading order). The eye
   lands on the most consequential area first.

## 3. Tile taxonomy & ordering (by operational importance)

Nine top tiles in a 3-wide grid, then a "right now" strip. Order is deliberate:

| # | Tile | Why it's where it is | RAG source |
|---|---|---|---|
| 1 | **BACKUPS** *(most important)* | A silent WAL-archive failure is the single worst undetected failure in the estate (planning §3, incident history: Neon egress runaway with no alarm). Data you can't restore is the only truly unrecoverable loss. Top-left. | worst-of: CNPG WAL-archive age, base-backup age, **Barman plugin sidecar up**, Surreal export age, restic→BX11, etcd snapshot age |
| 2 | **CLUSTER** | Quorum tolerates only **one** node loss; a second NotReady = estate down. The substrate everything else rides on. | nodes Ready · `etcd_server_has_leader` · unschedulable pods |
| 3 | **DATA** | Postgres is the crown-jewel state plane; Surreal is single-writer (any restart = downtime, HARD Sophia invariant). | CNPG primary up · replication lag · Surreal STS ready |
| 4 | **APPS** | The revenue/product surfaces — the reason the cluster exists. | replicas available · Traefik 5xx ratio (+ PostHog, see §7) |
| 5 | **EDGE** | All public TLS is DNS-01 wildcards; a stuck renewal is a silent time-bomb that takes the whole estate offline at expiry. | min cert days-to-expiry · ingress up |
| 6 | **DELIVERY** | Argo drift = an out-of-band change (governance/security concern) or a failed sync; a broken #184 PostSync hook silently drops the planning→delivery audit trail. | Argo app health · OutOfSync/drift |
| 7 | **SECRETS** | ESO renders every pod's secrets incl. the CNPG→fsn1 S3 creds; a sync failure silently breaks backups, deploys, cold-start. | ExternalSecret errors · SecretStore reachability |
| 8 | **COST / SCALE** | Should be 0 at rest; burst nodes that don't scale to zero are a silent €-bleed breaking the "€0 at rest" guarantee. Not an outage — a money leak. | burst node count |
| 9 | **OFF-ESTATE PAGER** | The **only** signal outside `.166`'s failure domain (D-M9: founder accepted the `.166` SPOF). If the dead-man's-switch is silent, the whole estate — cluster node, Forgejo, Infisical, *and* the in-`.166` meta-monitor — may be dark. | external DMS last-ping age |

**Below the fold — the "Right now" strip:** firing-page count, firing-warn count, a
**6-hour RAG state-timeline** (was that red a blip or sustained? which areas flap?),
and the **live alert list** (the forensic detail behind the tiles). The tiles answer
*is it OK?*; the strip answers *what, and for how long?*.

### Why these nine and not the full §3 component list

Planning §3 monitors ~16 components. The single pane is **not** that list — it's the
**founder-facing roll-up**. Component-level detail (per-component etcd fsync, Cilium
policy-drops, CSI attach errors, autoscaler internals) lives in the **drill-down
dashboards** each tile links to. The single pane collapses 16 components into 9
human-meaningful questions ("are my backups safe?", "is the cluster up?"). This is the
whole point of "at a glance" — fewer, bigger, louder.

## 4. RAG thresholds (D-M17 seed defaults)

Seeded sensibly; **tune after soak** (every threshold is a one-line ConfigMap edit).

| Tile | GREEN | AMBER | RED |
|---|---|---|---|
| **Backups** | all 6 sub-checks pass | exactly 1 degraded (≥0.834) | ≥1 of: WAL-archive age > 10 min · base-backup age > 26 h · **Barman sidecar not ready** · Surreal export age > 70 min · restic > 26 h · etcd snapshot > 25 h |
| **Cluster** | all nodes Ready · etcd has leader · 0 unschedulable | — (binary; a soft-pressure amber can be added post-soak) | any node NotReady · no etcd leader · any pod unschedulable |
| **Data** | primary up · lag < 30 s · Surreal ready | lag ≥ 30 s **or** PVC pressure | primary down · Surreal down |
| **Apps** | all replicas available · 5xx ratio < 2% | 5xx ratio ≥ 2% | any app 0 ready replicas |
| **Edge** | min cert ≥ 21 d to expiry | 7 d ≤ min cert < 21 d | min cert < 7 d (or ingress down) |
| **Delivery** | all apps Healthy & Synced | drift / OutOfSync | any prod app Degraded · sync/PostSync-hook failed |
| **Secrets** | 0 ExternalSecret errors | — | ≥1 ExternalSecret error or SecretStore unreachable |
| **Cost/scale** | 0 burst nodes | 1–2 burst nodes (> 30 min, no burst workload) | ≥3 burst nodes lingering |
| **Off-estate DMS** | heartbeat < 5 min ago | not wired (no-data) | heartbeat missed (≥ 5 min) |

Thresholds are encoded **inline in the JSON** (`thresholds.steps` + value `mappings`)
so the pane is self-describing — no external alert dependency to colour a tile, though
the same numbers should mirror the §5.1 Alertmanager rules so the pane and the pager
never disagree.

> **The Surreal 70-min export-age threshold matches D-M10** (RESOLVED 2026-06-20:
> RPO = 1 h; the hourly `0 * * * *` CronJob + grace). If the founder ever relaxes RPO,
> change the `4200` literal in the Backups expr (and the §5.1 alert) together.

## 5. Legibility & colour choices

- **Colour-blind safety.** Red/amber/green alone fails ~8% of men. So **colour is never
  the only channel**: every tile also carries a **word verdict** ("ALL BACKUPS GOOD",
  "BACKUP FAILED / STALE", "0 — €0 AT REST"). Red/green are distinguishable in the most
  common (red-green) deficiency by the *text*; the state-timeline additionally separates
  states by position over time. A future hardening is to bias the palette toward the
  Grafana "colour-blind friendly" scheme (orange/blue) — noted, not yet applied, to keep
  the founder's mental model of "traffic lights".
- **Background colour mode, not just text colour.** `colorMode: "background"` floods the
  whole tile with the RAG colour — maximum pre-cognitive signal. A red tile is a red
  *block*, readable across the room / on a phone glance.
- **Big numbers, big titles.** `valueSize: 34`, `titleSize: 16`. The verdict is the
  hero; the metric is secondary. Edge shows actual days-to-expiry (a number you act on);
  Cost shows the literal node count. The roll-up tiles show a word, not a fraction —
  "1 BACKUP DEGRADED" is more legible than "0.834".
- **Quiet when healthy.** All-green is visually calm (Grafana's green is desaturated);
  red/amber are loud. The pane should be *boring* most of the time — boring is the goal.
- **One screen, no scroll for the verdict.** The nine tiles + header fit in a single
  1080p viewport (`h:3` header + two `h:7` tile rows = 17 grid-rows ≈ above the fold).
  The "right now" strip is the only thing below the fold — detail you reach *after* the
  glance has already told you something's wrong.
- **30 s auto-refresh + `liveNow`.** Fresh enough to trust as a live board; not so fast
  it hammers Prometheus. Default window `now-6h` so the timeline has context.
- **Europe/London timezone** pinned — the operator's timezone, so "26 h ago" reads right.

## 6. Fail-safe behaviour (the trust contract)

The pane is only useful if **green is trustworthy**. So:

- **Safety-critical tiles fail to RED on no-data** (`noValue: "NO DATA"` + red step):
  Backups, Cluster, Data, Apps, Edge, Delivery, Secrets. A scrape gap on Postgres must
  *never* render green — absence of signal is treated as possible failure.
- **Two tiles fail to AMBER/neutral, deliberately:**
  - **Cost** defaults to `0` (`or vector(0)`) — no burst label series legitimately means
    zero burst nodes (the healthy resting state), so green-0 is correct, not a gap.
  - **Off-estate DMS** shows **"DMS NOT WIRED" (amber)** on no-data — distinguishing
    "not set up yet" from "heartbeat missed" (red). This avoids a permanent false-red
    before the external prober's exporter exists, while still never showing green until
    a real heartbeat lands.

## 7. What infra metrics can't see — and why PostHog still matters

The Apps tile uses infra-level liveness (replicas, Traefik 5xx). **Product-level errors
and security/business anomalies (auth-failure spikes, ingest error rate, credential-
resolve failures, egress runaway by endpoint) live in PostHog** (planning §3, §5) and
route to the **same Telegram channel**, not into Prometheus. The single pane intentionally
does **not** try to swallow PostHog: it shows *infra* RAG. The Apps tile description and
the drill-down dashboard call this out so the operator knows to also watch PostHog/Signals
for the app-layer signals infra metrics structurally can't carry. (If desired post-soak,
a PostHog error-rate webhook → Pushgateway could feed an amber sub-condition into the Apps
tile — noted as an enhancement, not built here.)

## 8. How this satisfies the founder's ask

> "see at a glance what is happening for the most important operational areas"

- **At a glance:** one screen, nine background-flooded RAG tiles, verdict-in-words,
  ordered by blast radius, calm-when-healthy, loud-when-not — readable pre-cognitively,
  on a phone, across a room.
- **The most important areas:** the nine are chosen by *consequence* (data-loss first,
  then substrate, then state, then product, then edge/delivery/secrets, then money, then
  the off-estate safety net) — and validated against the incident history the whole
  monitoring rework exists to never repeat.
- **What is happening:** green/amber/red answers "OK?"; the words say "what"; the
  6-hour timeline says "blip or sustained?"; the alert list says "exactly which signal";
  and each tile is a **drill-down** into the deep dashboard for "why".
- **As the front door:** this is the dashboard the company-portal **"Ops Centre" tile
  opens by default** (planning §2.3/§2.4) — the portal session flows straight in via
  forward-auth (see `../portal-sso/`), so it's one click from the launchpad to "is
  everything OK?".

---

## 9. Dependencies — metrics the monitoring agent must expose

This dashboard is **best-effort PromQL**. The sibling monitoring-stack agent
(`/tmp/swarm/opscentre-monitoring`) owns the stack; these are the metric/label
contracts the tiles need to light up. Where a metric doesn't exist natively, the
expected **source** is noted. **Do not build the stack here — this is the interface.**

| Tile | Metric(s) used | Source / what must be exposed | Status |
|---|---|---|---|
| Backups | `cnpg_collector_last_archived_wal_time`, `cnpg_collector_last_available_backup_timestamp`, `cnpg_collector_up` | **CNPG PodMonitor** — requires `monitoring.enablePodMonitor: true` on each `cnpg/cluster-*.yaml` (**D-M2, RESOLVED YES**). | needs CNPG exporter ON |
| Backups | Barman plugin sidecar readiness via `kube_pod_container_status_ready{namespace="data", pod=~".*-barman.*\|.*plugin.*"}` | **kube-state-metrics** (in the stack). Confirm the actual sidecar pod/namespace label shape and tighten the regex. | label shape TBC |
| Backups | `restormel_surreal_export_last_success_timestamp`, `restormel_restic_last_success_timestamp`, `etcd_snapshot_last_success_timestamp` | **Custom** — these CronJobs/timers have no native gauge. Emit a `last_success_timestamp` via **Pushgateway** (job pushes on success) or a tiny textfile-collector exporter. **Monitoring agent must add this.** | NOT native — must build |
| Cluster | `kube_node_status_condition`, `kube_pod_status_unschedulable` | kube-state-metrics | in stack |
| Cluster | `etcd_server_has_leader` | etcd ServiceMonitor (Operator auto-discovers on K3s) | in stack |
| Data | `cnpg_pg_replication_lag`, `cnpg_pg_replication_in_recovery`, `cnpg_collector_up` | CNPG PodMonitor (D-M2) | needs CNPG exporter ON |
| Data | `kube_statefulset_status_replicas_ready{statefulset=~"surreal.*"}` | kube-state-metrics. **Confirm the StatefulSet name** (`surreal-db` vs `surrealdb`); regex `surreal.*` is defensive. | name TBC |
| Apps | `kube_deployment_status_replicas_available{deployment=~"restormel-dashboard\|restormel-worker\|allotmentology"}` | kube-state-metrics. Confirm deployment names match. | name TBC |
| Apps | `traefik_router_requests_total` | **Traefik metrics** must be enabled (Prometheus metrics in Traefik Helm values) + a ServiceMonitor. | needs Traefik metrics ON |
| Edge | `certmanager_certificate_expiration_timestamp_seconds` | cert-manager metrics ServiceMonitor | in stack (enable cert-manager metrics) |
| Delivery | `argocd_app_info{health_status=..., sync_status=...}` | Argo CD metrics ServiceMonitor (`argocd-application-controller` metrics) | needs Argo metrics scrape |
| Secrets | `externalsecret_status_condition{condition="Ready"}`, `externalsecret_sync_calls_error` | ESO ServiceMonitor (ESO exposes Prometheus metrics) | needs ESO metrics ON |
| Cost | `kube_node_labels{label_workload="burst"}` | kube-state-metrics. **Requires the burst pool's `workload=burst` node label to surface** — confirm kube-state-metrics `--metric-labels-allowlist` includes node labels, OR substitute the autoscaler's `cluster_autoscaler_nodes_count{state="..."}`. | label allowlist TBC |
| Off-estate DMS | `restormel_external_dms_last_ping_timestamp` | **Custom** — the external monitor (healthchecks.io/UptimeRobot, D-M8) state must be mirrored into Prometheus (their API → a small exporter, or Pushgateway heartbeat). The DMS lives *outside* the cluster, so this tile reflects a mirrored copy; the **authoritative** off-estate pager is the external provider itself + Telegram, not this tile. | NOT native — must build |
| Alerts strip | `ALERTS{severity=~"page\|critical\|warn"}` | Prometheus rule files must set a **`severity`** label (values `page`/`critical`/`warn`) on every alert (§5.1). The strip is empty if alerts lack a `severity` label. | needs severity label convention |

**Two genuinely-new exporters the monitoring agent must build** (everything else is a
flag-flip or a name confirmation):
1. **CronJob/timer `last_success_timestamp` gauges** for Surreal export, restic→BX11,
   and etcd snapshot (Pushgateway or textfile collector). Without these the Backups tile
   can only see CNPG, not the three other backup legs.
2. **External DMS state mirror** into Prometheus for the Off-estate Pager tile.

**One config change already decided:** D-M2 — `monitoring.enablePodMonitor: true` on each
`cnpg/cluster-*.yaml` (RESOLVED YES). Without it the Backups + Data tiles are dark.

**Label/name confirmations** (cheap, do at wiring time): the CNPG namespace + Barman
sidecar pod naming, the Surreal StatefulSet name, the three app Deployment names, the
burst node-label exposure, and Traefik/Argo/ESO/cert-manager metrics being enabled with
ServiceMonitors. The PromQL uses defensive regexes so a near-miss degrades to amber/red
(fail-safe), not a false green.
