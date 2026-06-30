---
id: REC-INC-026
title: "Infra alert storm — multi-day automation + observability degradations triaged & remediated (node3 cx33→cx43 rescale, webhook/alloy/cert/netpol/alert fixes)"
class: evidence
owner: founder
status: closed
classification: internal
control-tier: 3
created: 2026-06-30
last-reviewed: 2026-06-30
approved-by: founder
approved-on: 2026-06-30
review-interval: P12M
retention: P6Y
related: [REC-INC-024, REC-INC-022, RES-123, RES-72]
---

# Infra alert storm — 2026-06-30

- **Detected:** 2026-06-30 (founder received a day-long cluster of Telegram alerts) · **Reported by:** founder · **Severity:** medium (no prod user-facing outage; automation + observability degradations + alert noise)
- **What happened:** A single triage pass (tracked as Huly **RES-123**) decomposed ~10 firing alert types into ~7 distinct root causes. Two were genuine multi-day degradations; the rest were a planned-capacity heuristic, config defects, and a buggy alert.

## Issues + root causes + remediation

| Issue | Root cause | Remediation | State |
|-------|-----------|-------------|-------|
| **huly-lifecycle-webhook ImagePullBackOff (06-26 → 06-30, WS3 automation DOWN ~4 days)** | Deployment's `imagePullSecrets` pointed at `forgejo-registry-push`, a malformed dockerconfigjson → 401 on pull. The image + the `-pull` secret were both fine. | Live: repointed to `forgejo-registry-pull` (HULY_APPLY=1 preserved) → receiver 1/1. Source: gitops #102 (`30-webhook-receiver.yaml` push→pull). | **Resolved** |
| **alloy on node2 NotReady ~5 days (node2 logs not shipping → observability gap)** | The DaemonSet pod's network namespace was wedged (`no route to 10.43.0.1` API service); other node2 pods were fine. | Deleted the pod → DaemonSet recreated it healthy (2/2). | **Resolved** |
| **NodeMemoryLimitOvercommit (page)** | Lean *heterogeneous* cluster — node3 was an 8 GiB cx33 vs 16 GiB cx43 on node2/master1 (same wolf-crying class as REC-INC-024 / REC-INC-022). | **node3 cx33 → cx43 blue-green rescale** (see asset-inventory + below): joined New-Node-3 (cx43, 157.180.79.201) as a 4th control-plane+etcd member with node2's exact config → drained old node3 → k3s auto-removed the etcd member (raft ConfChangeRemoveNode) → deleted the cx33 box. Cluster now **3× cx43 homogeneous**. | **Resolved** |
| **CertNotReady + CertExpiringSoon — allotment-redirect (page)** | DNS-01 can never solve: `allotment.work`/`.works` are not delegated to Hetzner DNS (`.works`→Vercel NS, `.work`→no NS) → "Zone not found". The redirect program is pre-staged but blocked on a **registrar-side NS flip (founder-only)**. | gitops #102 dropped the Certificate + websecure route (re-add with the registrar NS flip). | **Resolved (noise removed); redirect program awaits registrar NS delegation** |
| **CertNotReady + CertExpiringSoon — argocd-server-tls (page)** | The cert was owned by a **stale, un-gated `argocd-server` Ingress** (argocd.restormel.dev) whose annotation referenced a non-existent `letsencrypt-dns01` issuer. argocd-values already had `ingress.enabled:false` (decommission configured) but it was never applied (Argo CD is bootstrap/helm, no Argo Application). | Deleted the stale Ingress (gated path `argo.allotmentology.tech` IngressRoute intact) → cert cascaded away. | **Resolved** |
| **PVCNearFull / PVCSustainedAboveEighty — Prometheus TSDB (warn)** | `retentionSize: 8GB` on a 10Gi PVC → permanently ~80% (the cap working as designed, too tight). | gitops #102 lowered retentionSize 8→6GB (~60%). | **Resolved** |
| **CSIVolumeAttachmentCapNear — node2 15/16 (warn)** | All stateful PVCs concentrated on node2/master1; node3 held 0 (placement, not capacity — all nodes are same zone). | The rescale + Loki PVC + reschedules spread volumes onto node4; node2 fell to 14/16. RES-72 residual (Loki off emptyDir) closed: Loki PVC bound on node4. | **Resolved** |
| **TargetDown — pg-forgejo-1/-2 (warn)** | pg-forgejo's Stage-A `pg-forgejo-restrict-ingress` NetworkPolicy allowed forgejo→5432 + intra-cnpg-system but **omitted monitoring→:9187**, so Prometheus alone among the CNPG clusters could not scrape it (the metrics endpoint itself is healthy — HTTP 200 via port-forward). | Fix staged in gitops **#103** (adds the monitoring→9187 allow). | **Fix staged (PR #103, awaiting founder merge)** |
| **ArgoSyncOperationFailed ×2 (page, flapping)** | The expr `argocd_app_sync_total{phase="Failed"} > 0` treats a **cumulative counter** as a gauge → fires forever after the first-ever failed sync. | Fix staged in gitops **#103** (`increase(...[15m]) > 0`). | **Fix staged (PR #103, awaiting founder merge)** |
| **"Restormel prod-deploy staleness"** | Not in the firing set at triage time. | Likely cleared when the prior session advanced prod to main HEAD. | **No action (resolved)** |

## Response timeline (2026-06-30, founder-present then autonomous overnight)
1. Triaged all alerts → filed RES-123 with the live root-cause map.
2. P0 (non-prod) live fixes: alloy restart, huly-webhook secret repoint.
3. node3 cx33→cx43 blue-green rescale (E1 join + E2 drain/remove/delete) — verified 3 healthy etcd members, double-pay stopped.
4. gitops **#102** (merged, founder-named): allotment-redirect cert drop, webhook source push→pull, Loki PVC re-enable, prometheus retention. Applied + verified.
5. Live: deleted the stale argocd-server Ingress (cert cascade).
6. gitops **#103** (staged, awaiting founder merge): pg-forgejo monitoring→9187 allow + ArgoSync counter-bug fix.

## Impact
No prod user-facing outage at any point (rolling updates, ingress IP unchanged). Degraded: WS3 Huly automation (down ~4 days), node2 log shipping (~5 days), and page-alert signal quality (noise). DB/data integrity unaffected; the rescale never dropped below 3 etcd members.

## Root cause (meta)
Accumulated config defects + a lean *heterogeneous* cluster + a buggy alert expression, surfaced together as a "storm." The structural fix (homogeneous 3× cx43 + node4 volume headroom) plus the per-defect fixes remove the recurrence.

## Follow-ups
- **Founder:** merge gitops **#103** (clears the last two firing alerts: pg-forgejo TargetDown + ArgoSync flap).
- **Founder (registrar):** flip allotment.work/.works NS to the Hetzner triplet, then re-add the redirect Certificate + websecure route (gitops) to complete that program.
- Asset-inventory updated for the node swap (this PR). RES-72 → move to deployed in Huly.
- Closed: 2026-06-30.
