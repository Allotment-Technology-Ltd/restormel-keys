---
title: Ops Centre — K3s monitoring stack operator runbook
class: technical
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-20
last-reviewed: 2026-06-20
review-interval: P12M
related: [REC-PLAN-012, RISK-001, AST-003, REC-INC-006]
---

# Ops Centre — monitoring stack operator runbook

How the operator brings up + maintains the in-cluster monitoring stack
(`deploy/k3s/monitoring/`). **Config-only repo; nothing here is auto-applied** —
the steps below are run by the operator out-of-band, plus the Argo CD Application
(`deploy/k3s/gitops/applications/addons/monitoring.yaml`) that auto-syncs the
GitOps-managed parts.

Source: `planning/ops-centre-k3s-rework.md` (§7 Phase 1.6, §8 GitOps delivery).

## Bootstrap order (Phase 1.6 — AFTER the platform, BEFORE data migration)

Monitoring must be watching before prod state moves (plan §7). After Phase 1
(ESO + cert-manager + Traefik + CNPG + Argo CD up):

1. **Buckets** — create the Loki log bucket in fsn1: `restormel-loki-logs-fsn1`.
   (CNPG backup bucket already exists.)
2. **Infisical** — populate the monitoring keys in the `infrastructure` project,
   env `prod` (see `deploy/k3s/monitoring/README.md` table):
   `GRAFANA_ADMIN_USER/PASSWORD`, `TELEGRAM_BOT_TOKEN/CHAT_ID`,
   `HEALTHCHECKS_PING_URL`, `LOKI_S3_FSN1_ACCESS_KEY_ID/SECRET_ACCESS_KEY`,
   `K3S_ETCD_CA_CRT/CLIENT_CRT/CLIENT_KEY`.
3. **healthchecks.io** — create a check (period ~15m, grace ~5m), copy its ping
   URL into `HEALTHCHECKS_PING_URL`. Wire the healthchecks.io alarm to an external
   channel (email/Telegram) — this is the only OFF-ESTATE pager (D-M9). D-M8:
   also create a SECOND free external prober (UptimeRobot/Cronitor) hitting
   `restormel.dev` + `surreal.restormel.dev`.
4. **CNPG metrics (D-M2)** — flip `monitoring.enablePodMonitor: true` on
   `cluster-pg-restormel.yaml` + `cluster-pg-platform.yaml`. CNPG then creates the
   PodMonitor; Prometheus auto-discovers it. **This is the highest-value one-line
   change** (surfaces WAL-archive-to-fsn1 + PITR readiness).
5. **etcd metrics** — set `--etcd-expose-metrics=true` on each k3s server
   (config + restart, on the maintenance window). Place the etcd client cert from
   `/var/lib/rancher/k3s/server/tls/etcd/` into Infisical (base64). Then add
   `prometheus.prometheusSpec.secrets: [etcd-client-certs]` to the
   kube-prometheus-stack values and re-sync.
6. **Cilium Hubble** — enable metrics + UI on the hetzner-k3s-managed Cilium:
   ```
   helm upgrade cilium cilium/cilium -n kube-system --reuse-values \
     --set hubble.enabled=true --set hubble.relay.enabled=true \
     --set hubble.ui.enabled=true --set hubble.metrics.enableOpenMetrics=true \
     --set 'hubble.metrics.enabled={dns,drop,tcp,flow,port-distribution,icmp,httpV2}' \
     --set prometheus.enabled=true --set operator.prometheus.enabled=true
   ```
   If hetzner-k3s templates Cilium via a k3s HelmChartConfig, set the same keys
   there instead so the change survives a reconcile (the HelmChartConfig form is
   in `deploy/k3s/monitoring/hubble/cilium-hubble-enablement.yaml` — apply ONE
   path, not both).
7. **Traefik metrics** — enable the `metrics` entrypoint + prometheus metrics in
   `deploy/k3s/ingress/traefik-helm-values.yaml` (router/service labels on) so
   `traefik_router_requests_total` exists for the 5xx alert.
8. **Sync** — the `monitoring` Argo Application auto-syncs (sync-wave -5, after
   cluster-addons). Verify: Prometheus targets all UP, Grafana reachable at
   `grafana.allotmentology.tech` (behind portal SSO), Alertmanager shows the
   Watchdog firing, a test Telegram message lands.
9. **DR-drill checks** (execution-sequence Phase 5): deliberately fail a backup +
   confirm the WAL-archive / base-backup / Barman-sidecar / etcd-snapshot /
   Surreal-export alerts fire.

## High-risk-security gate

`secrets/externalsecrets-monitoring.yaml` and `grafana-ingress.yaml` touch
auth/secrets (Grafana admin, Telegram token, S3 creds, the DMS capability URL,
the etcd client cert; and the portal forward-auth wiring). **Run
`restormel-high-risk-security` before the PR that applies them** (plan §2.3 /
D-M14 require it explicitly).

## Alert taxonomy → first action

Every PrometheusRule alert carries `first_action` + `runbook_url` pointing at
anchors in `docs/runbooks/infra-alert-response.md`. **That runbook still carries
the old Beszel/Coolify taxonomy + `[TODO]` placeholders (plan §5) — refresh it to
the Alertmanager/Loki taxonomy** with these anchors (one per alert family):
`#node-disk-pressure`, `#node-memory-pressure`, `#node-down`, `#target-down`,
`#etcd-quorum`, `#etcd-snapshot-stale`, `#pods-pending`, `#autoscaler-stuck`,
`#burst-cost`, `#cnpg-wal-archive`, `#cnpg-base-backup`, `#barman-sidecar`,
`#cnpg-replication`, `#cnpg-primary-down`, `#pvc-near-full`, `#csi-attach`,
`#cert-expiry`, `#traefik-5xx`, `#traefik-config`, `#eso-sync`, `#argo-degraded`,
`#argo-drift`, `#argo-postsync`, `#surreal-dark`, `#surreal-export`,
`#crashloop`, `#oomkill`, `#replicas-mismatch`, `#job-failed`, `#app-down`.
Also refresh the `restormel-infra-alert-response` skill from the same taxonomy.

## Day-2

- **Tuning** (D-M17): tighten RAG amber/red cut-offs + alert thresholds after a
  soak period; values are seeded conservative.
- **Retention/sizing** (D-M11): Prometheus 15d / Loki 30d hot. Watch PVC headroom
  on `.166`; the `PVCNearFull` + Loki ingestion-bound alerts guard against
  observability becoming the next egress runaway.
- **Phase B** drops in `pg-plotbudget` + Supabase + UseSophia ServiceMonitors and
  (if chosen) Bugsink — no stack rework.
