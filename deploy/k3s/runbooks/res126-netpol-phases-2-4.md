# RES-126 network segmentation — phases 2–4 (surreal / cnpg / argocd / eso)

**Status:** DRAFTS — do **not** apply from this doc blindly. Every policy here needs an
**active-traffic Hubble capture** first (see §1). Phase 1 (allotmentology-prod + restormel-prod
default-deny-ingress) already shipped (gitops #109/#110). This runbook covers the harder namespaces.

> Why these are drafts and not live `.yaml` files: `cluster/**` and `applications/**` are **Argo
> auto-sync** — a merged default-deny with an incomplete allow-list severs live traffic instantly.
> The policies are kept here as fenced YAML so they cannot be swept into a sync until verified.

---

## 0. The finding that gates all of this (2026-07-01)

A point-in-time Hubble capture of ingress to `data/surreal-0:8000` showed **only**:

| source | why | in an idle capture? |
|---|---|---|
| `traefik` (ns traefik) | external `surreal.restormel.dev` ingress | visible |
| `monitoring/blackbox-exporter` | `/health` probe (the "status" page) | visible |
| `host` (node) | kubelet liveness/readiness probes + host-sourced backup | visible |
| **`sophia`** | Sophia ingest → surreal | **INVISIBLE (idle)** |
| **`restormel-prod`** | dashboard surreal paths | **INVISIBLE (idle)** |
| **`restormel-integration`** | integration surreal paths | **INVISIBLE (idle)** |

**A default-deny built from an idle capture will pass CI, sync clean, and then 5xx the moment an
app path wakes up.** All three app consumers hold surreal creds (verified: each ns had running
pods) but were quiescent during capture. This is the single most important gotcha for phases 2–4.

---

## 1. Active-traffic capture procedure (run BEFORE merging any policy below)

Exercise every path while capturing, then diff against the allow-list.

```bash
export KUBECONFIG=~/.config/restormel/kubeconfig
CIL=$(kubectl get pod -n kube-system -l k8s-app=cilium \
  -o jsonpath="{range .items[?(@.spec.nodeName=='$(kubectl get pod surreal-0 -n data -o jsonpath='{.spec.nodeName}')')]}{.metadata.name}{end}")

# start observing ingress to the data namespace (leave running)
kubectl exec -n kube-system "$CIL" -c cilium-agent -- \
  hubble observe --to-namespace data --port 8000 -f -o compact
```

While that runs, in another shell **exercise the app paths** so they show up:
- trigger a **Sophia ingest** (the heaviest surreal writer),
- load a **restormel-prod** dashboard page that reads surreal,
- hit a **restormel-integration** surreal path,
- let a `surreal-backup` CronJob tick (or `kubectl create job --from=cronjob/surreal-backup -n data probe`).

Resolve any unexpected source identity:
`kubectl exec -n kube-system "$CIL" -c cilium-agent -- cilium identity get <ID> -o json | grep namespace`

Only merge once every expected source namespace appears in the capture.

---

## 2. Phase-2 — `data` / surreal (CiliumNetworkPolicy, NOT plain NetworkPolicy)

Use a **CiliumNetworkPolicy**: surreal takes kubelet probes + a possibly host-sourced backup, so the
allow-list needs `fromEntities: [host, remote-node, health]`, which a k8s NetworkPolicy can't express.

```yaml
# cluster/surrealdb/60-networkpolicy.yaml  — DO NOT MERGE until §1 capture confirms all app paths
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: surreal-restrict-ingress
  namespace: data
spec:
  endpointSelector:
    matchLabels: { app: surreal }        # confirm surreal-0's pod label before applying
  ingress:
    - fromEndpoints:
        - matchLabels: { k8s:io.kubernetes.pod.namespace: traefik }        # external ingress
        - matchLabels: { k8s:io.kubernetes.pod.namespace: monitoring }     # blackbox /health
        - matchLabels: { k8s:io.kubernetes.pod.namespace: sophia }         # Sophia ingest  (idle-invisible!)
        - matchLabels: { k8s:io.kubernetes.pod.namespace: restormel-prod } # dashboard      (idle-invisible!)
        - matchLabels: { k8s:io.kubernetes.pod.namespace: restormel-integration } # (idle-invisible!)
        - matchLabels: { k8s:io.kubernetes.pod.namespace: data }           # surreal-backup CronJob, intra-ns
      toPorts:
        - ports: [{ port: "8000", protocol: TCP }]
    - fromEntities: [host, remote-node, health]   # kubelet probes + host-sourced backup
      toPorts:
        - ports: [{ port: "8000", protocol: TCP }]
```

**Rollback:** `kubectl delete ciliumnetworkpolicy surreal-restrict-ingress -n data` (or delete the file
→ Argo prune). Egress stays open (surreal only receives). Note surreal is single-node (no HA) so a
mis-scoped policy is a full surreal outage — verify hard.

---

## 3. Phase-4 — `cnpg-system` per-cluster 5432 (pg-plotbudget hostNetwork MUSTFIX)

`cluster/forgejo/15-networkpolicy-pg.yaml` already restricts `pg-forgejo` (additive, pod-scoped by
`cnpg.io/cluster`, does **not** default-deny the namespace — good pattern). Extending the same idiom to
pg-infisical / pg-plotbudget / pg-platform / pg-restormel is fine EXCEPT:

**pg-plotbudget MUSTFIX** — Supabase's DR/migration job runs **hostNetwork**, so its identity is `host`,
**not** `ns:supabase`. A namespaceSelector-only allow (the pg-forgejo pattern) will silently drop it and
the next DR/migration fails. Pair the k8s NetworkPolicy with a CiliumNetworkPolicy:

```yaml
# accompany any pg-plotbudget-restrict-ingress — DO NOT MERGE without it
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: pg-plotbudget-allow-host-dr
  namespace: cnpg-system
spec:
  endpointSelector:
    matchLabels: { cnpg.io/cluster: pg-plotbudget }
  ingress:
    - fromEntities: [host, remote-node]     # hostNetwork DR/migration job
      toPorts:
        - ports: [{ port: "5432", protocol: TCP }]
```

Also carry the pg-forgejo lesson: allow `monitoring → 9187` (instance-manager metrics) and whole-ns
`cnpg-system` (operator/replication/WAL) or failover wedges.

---

## 4. Phase-3 — argocd + external-secrets = **DO NOT MERGE** (self-outage class)

- **external-secrets (eso):** a default-deny here needs the **apiserver → webhook :10250** admission
  path explicitly allowed, or `ExternalSecret`/`ClusterSecretStore` admission fails **estate-wide**
  (every ESO-backed secret stops reconciling — that's every app credential). Recovery in
  `res130-recovery.md` §eso.
- **argocd:** restricting argocd can cut the repo-server / application-controller off from the Argo API
  or the git source and you lose the very tool you'd use to roll back. Only attempt with a break-glass
  `kubectl` path proven first.

Both need an active-traffic capture that includes the **control-plane → webhook** and **argo → git/kube-api**
flows, which a namespaced `--to-namespace` capture won't show — capture with `--to-identity` for the
webhook/apiserver identities specifically.

---

*Generated 2026-07-01 during the infra-excellence delivery. Supersedes the terse RES-126 phase-2-4
notes in the session handover.*
