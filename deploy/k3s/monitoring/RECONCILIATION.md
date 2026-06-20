# Ops Centre — how this PR was assembled (two-agent reconciliation)

This stack was built by two parallel agents (2026-06-20): a **monitoring-backend** agent
(Prometheus/Loki/Alloy/Hubble + scrape + rules + alerting + dead-man's-switch) and a
**dashboard/SSO** agent (the single-pane "amygdala" view + the company-portal SSO). They
overlapped on the dashboard and the Grafana ingress; this PR resolves the overlap as follows:

- **Single-pane dashboard** → the **dashboard agent's** `dashboards/ops-centre-single-pane.json`
  is canonical (the design-focused RAG board: tiles ordered by blast radius, fail-to-red on
  no-data, word verdicts for colour-blind safety). It is provisioned via
  `grafana-dashboards/ops-centre-single-pane.yaml` (a ConfigMap with `grafana_dashboard: "1"`,
  generated from that JSON). The monitoring agent's `ops-centre-overview.yaml` was **dropped**
  (superseded) to avoid two competing home dashboards. Design rationale:
  `dashboards/SINGLE-PANE-DESIGN.md`.
- **Grafana SSO / ingress** → the **dashboard agent's** `portal-sso/` is canonical (reuses the
  proven company-portal Traefik forwardAuth; `grafana.allotmentology.tech` chosen so the
  `.allotmentology.tech` Better-Auth cookie flows — see `portal-sso/RECOMMENDATION.md`). The
  monitoring agent's standalone `grafana-ingress.yaml` was **dropped** (superseded). The
  kube-prometheus-stack values keep `grafana.ingress.enabled: false` so the IngressRoute is the
  only ingress, and `grafana.ini server.root_url = https://grafana.allotmentology.tech`.

## TLS dependency (cross-PR — IMPORTANT)
`portal-sso/02-grafana-ingressroute.yaml` and `03-argocd-ingressroute.yaml` consume the
`wildcard-allotmentology-tech-tls` secret in the **`monitoring`** and **`argocd`** namespaces.
That secret is issued by the wildcard Certificate in PR #208 (ns `ingress`) and **mirrored** out
by kubernetes-reflector. PR #208 was updated so the `wildcard-allotmentology-tech` reflector
namespace list includes `monitoring` and `argocd`. **Merge #208 before applying this stack**, and
install kubernetes-reflector at bootstrap (ingress README apply-order step 5). The dashboard
agent's duplicate `portal-sso/00-wildcard-certificate.yaml` was **dropped** in favour of the
single reflected cert (avoids a duplicate Let's Encrypt issuance).

## Security
Auth/secret surfaces (`secrets/externalsecrets-monitoring.yaml`, `portal-sso/*`) went through the
`restormel-high-risk-security` pre-PR gate: **PASS** — no secret values in git (all ESO refs),
Grafana anonymous disabled, forwardAuth is **outbound-only** to the public portal endpoint
(REC-INC-006-clean, fails closed), Loki S3 creds scoped separately from the CNPG Barman key.

## Founder action items (before apply — NOT blocking this merge)
Populate these keys in the **`infrastructure`** Infisical project (env `prod`):
`GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`,
`HEALTHCHECKS_PING_URL`, `LOKI_S3_FSN1_ACCESS_KEY_ID`, `LOKI_S3_FSN1_SECRET_ACCESS_KEY`,
`K3S_ETCD_CA_CRT`, `K3S_ETCD_CLIENT_CRT`, `K3S_ETCD_CLIENT_KEY` (last three base64 PEM).
Plus the operator prereqs in `../runbooks/monitoring.md` (etcd metrics, Hubble enablement,
Traefik metrics, the fsn1 Loki bucket).
