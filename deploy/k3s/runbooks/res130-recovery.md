# RES-130 security hardening — RECOVERY

Recovery procedures for the RES-130 hardening controls, especially the ones that can lock **you** out.
Keep this reachable from a shell that does **not** depend on the thing you're recovering (a local
`kubectl` with the cluster-admin `~/.config/restormel/kubeconfig`, which talks straight to the kube-API
and does **not** route through ESO, Argo, or any app netpol).

Golden rule: **host-sourced probes and `kubectl` bypass most of these controls** — if the UI is down but
`kubectl` works, you can always delete the offending policy directly.

---

## eso — external-secrets NetworkPolicy (the estate-wide footgun)

**Blast radius:** ESO's validating/mutating webhook is called by the **kube-apiserver** on every
`ExternalSecret` / `ClusterSecretStore` / `PushSecret` admission. If a default-deny in
`external-secrets` blocks **apiserver → webhook :10250**, admission fails **closed for the whole
estate** — no app can create/rotate a secret, and existing `ExternalSecret` reconciles error. Nothing
"crashes" immediately (running pods keep their already-synced Secrets) but any secret change, new
deploy, or ESO restart wedges.

**Symptom:** `kubectl get externalsecrets -A` shows `SecretSyncedError` / webhook timeouts;
`kubectl apply` of any ExternalSecret hangs then fails with `failed calling webhook ... context deadline exceeded`.

**Recover (kubectl bypasses the netpol):**
```bash
export KUBECONFIG=~/.config/restormel/kubeconfig
kubectl get ciliumnetworkpolicy,networkpolicy -n external-secrets
kubectl delete ciliumnetworkpolicy <name> -n external-secrets      # or the k8s NetworkPolicy
#   if it was merged via Argo, ALSO remove/set to noop the source file or Argo re-syncs it:
kubectl -n argocd patch application cluster-addons --type merge \
  -p '{"spec":{"syncPolicy":{"automated":null}}}'                  # pause auto-sync while you revert the file
```
Then revert the offending file in `restormel-gitops` and re-enable auto-sync.

**Correct policy (if you still want eso segmentation):** the default-deny MUST include
```yaml
    - fromEntities: [kube-apiserver, host, remote-node]   # webhook admission calls
      toPorts: [{ ports: [{ port: "10250", protocol: TCP }] }]
```
plus egress to Infisical (`secrets.restormel.dev` via the LB) and the kube-API. Verify with a Hubble
capture filtered to the webhook identity, **not** `--to-namespace` (the apiserver call shows as
`kube-apiserver` entity, invisible to a namespace filter). Until then: **do not merge.**

---

## Cilium WireGuard (node-to-node encryption) — HELD (founder Q3)

Not enabled. If later turned on (`encryption.enabled=true, type=wireguard` in the cilium Helm values)
and pod-to-pod across nodes breaks:
```bash
# confirm state
kubectl -n kube-system exec ds/cilium -c cilium-agent -- cilium status | grep -i encryption
# disable fast: set encryption.enabled=false in the cilium values, sync; or hot-disable per-agent
kubectl -n kube-system set env ds/cilium CILIUM_ENABLE_WIREGUARD=false   # stopgap, values revert is the real fix
```
Roll one node at a time; a half-encrypted mesh (some agents WG, some not) drops cross-node traffic, so
if mid-rollout it looks broken, **finish or fully revert** — don't sit half-applied.

---

## MFA (IdP) — blocked on founder

MFA is an identity-provider (Forgejo OIDC root) config, not a cluster object — no cluster-side recovery.
If MFA enrollment locks out the only admin, the Forgejo break-glass is the local admin account +
`forgejo admin user must-change-password` from a shell on `forgejo-0` (see the SSO memory / break-glass
runbook). Not in scope for cluster recovery.

---

## General netpol rollback (any namespace)

```bash
export KUBECONFIG=~/.config/restormel/kubeconfig
kubectl get ciliumnetworkpolicy,networkpolicy -A | grep -v health   # find it
kubectl delete <kind> <name> -n <ns>                                # immediate relief
```
If Argo-managed, pause `cluster-addons` auto-sync (above) before deleting, revert the file, then
re-enable — otherwise Argo re-applies the broken policy within the sync interval. Egress is left open on
all RES-126/130 default-denies, and host/kubelet probes bypass Cilium ingress policy, so a node is never
fully unreachable via `kubectl`.

---

*Generated 2026-07-01 (infra-excellence delivery). Companion to `res126-netpol-phases-2-4.md`.*
