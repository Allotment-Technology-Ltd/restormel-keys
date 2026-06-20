# Ops Centre — K3s monitoring stack (`deploy/k3s/monitoring/`)

GitOps-delivered observability for the sovereign K3s cluster. **Config + manifests
only — nothing here is applied by CI.** No secret values in git: every credential
is delivered by External Secrets Operator (ESO) from the self-hosted Infisical
`infrastructure` project.

Source of truth: [`planning/ops-centre-k3s-rework.md`](../../../planning/ops-centre-k3s-rework.md)
(decisions D-M1..D-M17) + [`planning/k3s-cluster-target-design.md`](../../../planning/k3s-cluster-target-design.md).

## What's here

| Path | What |
|---|---|
| `00-namespace.yaml` | the `monitoring` namespace (plane: observability) |
| `kube-prometheus-stack/values-*.yaml` | Prometheus + Alertmanager + Grafana + node-exporter + kube-state-metrics (chart **86.3.2**, operator v0.91.0) |
| `loki/values-loki.yaml` + `loki/loki-alerting-rules.yaml` | Loki single-binary, S3→fsn1 (chart **7.1.0**); LogQL alerts |
| `alloy/values-alloy.yaml` | Grafana Alloy DaemonSet log collector (chart **1.10.0**, Alloy v1.17.0) |
| `hubble/cilium-hubble-enablement.yaml` | enable Hubble metrics + UI on the hetzner-k3s-managed Cilium |
| `scrape/*.yaml` | ServiceMonitors/PodMonitors/Probes: Argo CD, cert-manager, Traefik, ESO, Cilium/Hubble, etcd, blackbox, CNPG (reference) |
| `rules/*.yaml` | PrometheusRule alerts (Phase-A scope) |
| `alertmanager/alertmanager-config.template.yaml` | reference for the ESO-rendered Alertmanager config |
| `deadmansswitch/*.yaml` | Watchdog rule + heartbeat CronJob (external DMS) |
| `grafana-dashboards/ops-centre-overview.yaml` | the single-pane RAG board (§2.4) |
| `grafana-ingress.yaml` | **HIGH-RISK** Grafana ingress + portal forward-auth (D-M13/14) |
| `secrets/externalsecrets-monitoring.yaml` | **HIGH-RISK** all ESO ExternalSecrets for the stack |

The Argo CD Application that rolls this up is
[`../gitops/applications/addons/monitoring.yaml`](../gitops/applications/addons/monitoring.yaml)
(sync-wave `-5`, after cluster-addons).

## Key decisions

- **Metrics core = kube-prometheus-stack** (D-M3): Operator/ServiceMonitor-native,
  one Helm release. `serviceMonitorSelectorNilUsesHelmValues:false` (and the
  pod/rule/probe equivalents) so Prometheus discovers EVERY ServiceMonitor/
  PodMonitor/PrometheusRule cluster-wide — including the **CNPG PodMonitor**
  (D-M2) in `cnpg-system` with zero extra wiring.
- **Log store = Loki S3-backed on fsn1** (D-M4 — chosen): reuses the existing
  Hetzner Object Storage (same as CNPG Barman), cheap long retention, no new
  infra, keeps the crowded `.166` PVCs small. **Filesystem-PVC fallback** is a
  1-line revert (see header of `loki/values-loki.yaml`).
- **Dead-man's-switch = external healthchecks.io** (D-M9 — founder accepts the
  `.166` SPOF, so the external DMS is the ONLY guaranteed off-estate pager). Two
  independent in-estate paths feed it: a **heartbeat CronJob** (primary) + the
  **Alertmanager Watchdog route** (secondary). D-M8 recommends a SECOND free
  external prober (UptimeRobot/Cronitor) configured in that provider's dashboard.
- **Alerting = Alertmanager → Telegram** (single human channel; PostHog posts to
  the same channel). Every alert carries `first_action` + `runbook_url`.
- **Auth on the UIs = reuse the portal forward-auth** (D-M14, no oauth2-proxy);
  hosts under `*.allotmentology.tech` (D-M13) so the SSO cookie flows.

## Operator prerequisites (NOT applied by CI / Argo)

1. **Buckets** in fsn1: `restormel-loki-logs-fsn1` (logs). CNPG backups bucket
   already exists.
2. **CNPG `monitoring.enablePodMonitor: true`** on `cluster-pg-restormel.yaml` +
   `cluster-pg-platform.yaml` (the D-M2 config PR — currently ABSENT on all three
   clusters; see `scrape/podmonitor-cnpg-reference.yaml`).
3. **k3s `--etcd-expose-metrics=true`** on the server nodes (restart required) +
   the etcd client cert in Infisical (`K3S_ETCD_*`), then add
   `prometheus.prometheusSpec.secrets: [etcd-client-certs]` to the kps values.
4. **Cilium Hubble enablement** (`helm upgrade cilium --reuse-values ...` OR the
   HelmChartConfig in `hubble/`) — see `../runbooks/monitoring.md`.
5. **Traefik metrics entrypoint** enabled in `deploy/k3s/ingress/traefik-helm-values.yaml`.
6. **Populate the Infisical `infrastructure` keys** (see below).
7. **healthchecks.io check** created; its ping URL → Infisical `HEALTHCHECKS_PING_URL`.

## ESO secret keys the founder must populate (`infrastructure` Infisical project, env `prod`)

| Infisical key | Used by |
|---|---|
| `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD` | Grafana admin login |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Alertmanager Telegram receiver |
| `HEALTHCHECKS_PING_URL` | dead-man's-switch (CronJob + Alertmanager route) |
| `LOKI_S3_FSN1_ACCESS_KEY_ID`, `LOKI_S3_FSN1_SECRET_ACCESS_KEY` | Loki S3 store (fsn1) |
| `K3S_ETCD_CA_CRT`, `K3S_ETCD_CLIENT_CRT`, `K3S_ETCD_CLIENT_KEY` | etcd scrape (base64 PEM) |

All other components scrape over cluster-internal endpoints needing no secret.

## Phase scope

**Phase A only** (plan §7): cluster/control-plane + `pg-restormel`, `pg-platform`,
SurrealDB, Traefik, cert-manager, ESO, Argo CD, Cilium/Hubble, + apps
`restormel-dashboard`/`-worker`/`allotmentology`. **PlotBudget + UseSophia are
Phase B** — deliberately NOT built; they drop in later as new ServiceMonitors with
zero stack rework.
