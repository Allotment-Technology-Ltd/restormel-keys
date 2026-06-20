# Ingress — apply order, per-phase scope, and the wildcard-TLS gap

Traefik (DaemonSet, `traefik-helm-values.yaml`) + cert-manager DNS-01 (Hetzner,
`clusterissuer-letsencrypt.yaml`) + the hostname→Ingress map (`ingress-routes.yaml`).
`00-namespace.yaml` creates the `ingress` namespace the wildcard Certificates live in.

## Apply order (operator, off-cluster — NOT run by CI)

1. **`00-namespace.yaml`** — the `ingress` namespace (Certificates fail with "namespace
   not found" otherwise).
2. **cert-manager** + the `cert-manager-webhook-hetzner` chart (needs the
   `hetzner-dns-token` ExternalSecret rendered first — ESO, infisical-infra).
3. **`clusterissuer-letsencrypt.yaml`** — start on `letsencrypt-staging`; flip the
   Certificate/Ingress annotations to `letsencrypt-prod` once issuance is proven.
4. **Traefik** — `helm install traefik … -f traefik-helm-values.yaml`.
5. **Certificates** (in `ingress-routes.yaml`) — the per-zone wildcards.
6. **Ingresses** (in `ingress-routes.yaml`) — apply ONLY the in-scope ones for the
   current phase (see below). Each references a Service that the product's migration PR
   creates; applying an Ingress before its Service exists yields an intentional 503.

## ⚠ Wildcard TLS secrets are cross-namespace — resolve before apply

The wildcard **Certificates live in the `ingress` namespace** (so one cert per apex
zone), but the **Ingresses live in per-product namespaces** (`restormel`,
`restormel-nonprod`, `data`, `allotmentology`, … ). A Kubernetes Ingress can only use a
TLS secret **in its own namespace**, so the wildcard secret produced in `ingress` is NOT
directly usable by, say, the `data`-namespace SurrealDB Ingress. Pick ONE before apply:

- **(a) Replicate the secret** — run `kubernetes-reflector` (or cert-manager's secret
  `reflector.v1.k8s.emberstack.com` annotations) to mirror each wildcard TLS secret into
  the consuming namespaces. One cert, copied. **Recommended** (least cert churn).
- **(b) Per-namespace Certificates** — issue each wildcard Certificate directly in the
  namespace that consumes it (drop the shared `ingress` ns for certs). More certs, no
  replicator dependency.

## Per-phase Ingress scope (the manifests are the full TARGET map)

`ingress-routes.yaml` is the complete hostname→Ingress map for ALL products; apply only
the current phase's Ingresses (the rest reference Phase-B Services that don't exist yet):

- **Phase A** — apply: `restormel-dashboard`, the Restormel non-prod ingress,
  `allotmentology`, and **`surrealdb`** (host `surreal.restormel.dev` → Service
  `surreal-db`; **HARD INVARIANT**, Sophia dependency, never dark). *(The Ingress backend
  was corrected from the non-existent `surrealdb` Service to `surreal-db` — 2026-06-20.)*
- **Phase B** — apply later: the **`auth-plane`** (auth.restormel.dev), **`usesophia`**
  (usesophia.app), and the **PlotBudget**/Supabase-Kong Ingress + wildcard Certificate
  (domain **plotbudget.com**, Squarespace registrar — supplied 2026-06-20).

Likewise the CNPG `scheduledbackup.yaml` carries a Phase-B `pg-plotbudget` ScheduledBackup —
apply only the `pg-restormel` + `pg-platform` ScheduledBackups in Phase A.
