---
name: restormel-dr-recovery
description: >-
  Restormel/Allotment DISASTER RECOVERY runbook for the self-hosted 3-node K3s estate — invoke the
  moment a real or suspected outage, data-loss, corruption, or total cluster/region loss is happening
  and you need to know what to do. It TRIAGES first (most "disasters" are partial — one app, one node,
  one DB, secrets down — and must NOT trigger a full cold-start), then routes to the right scoped
  recovery; and for a true total loss it walks the ordered crown-jewels COLD-START (REC-PLAN-021) that
  rebuilds the whole estate from the fsn1 S3 store + the founder's offline escrow key. Knows the jewel
  set (J1–J10), the proven restore procedure (scripts/dr/coldstart/ harness), the hard dependency
  order, and exactly which steps are founder-gated (declaring a disaster, new infra, DNS flips, the
  offline key). Use it to drive a recovery, to decide whether something even IS a disaster, or to brief
  another agent. Pairs with restormel-infra-alert-response (alerts), restormel-backup (BX11/restic),
  restormel-isms-records (the mandatory incident record), and restormel-k3s-architecture (target design).
---

# Restormel disaster recovery (crown-jewels) — runbook

**This is the "what do I do RIGHT NOW" skill for a real or suspected disaster.** Stay calm, work the
triage first, and **gate the irreversible/outward steps on the founder** (declaring a disaster,
provisioning new infra, flipping real DNS, touching the offline escrow key).

> **The proven procedure already exists and is dress-rehearsed:** `scripts/dr/coldstart/` (the WS6
> Stage-C harness). A real recovery is the *same ordered restore* it performs, but into **real**
> replacement nodes with **real** DNS instead of a throwaway box + scratch DNS. Don't reinvent it —
> follow it.

## 0. Estate facts (so you don't have to rediscover them mid-incident)
- 3-node K3s HA, Hetzner **fsn1**, Package C: `master1` 135.181.25.76, `node2` .166, `node3` .167.
  `KUBECONFIG=~/.config/restormel/kubeconfig`. Argo CD = GitOps **PULL**, cluster-wide auto-sync;
  source of truth = `git.allotmentology.tech/Allotment-Technology-Ltd/restormel-gitops`.
- **The crown jewels** (the only things you truly must recover): **J1** Forgejo repos · **J2** registry
  images · **J3** Forgejo DB · **J4** Infisical ciphertext · **J5** Infisical master key · **J6/7/8**
  CNPG Postgres (pg-restormel/platform/plotbudget + pg-forgejo + pg-infisical) · **J9** SurrealDB · **J10** etcd.
- **Where they live in S3 (fsn1, read-only recovery medium):** restic `restormel-restic-backups/{infisical,forgejo,surreal-k3s}`;
  CNPG Barman `restormel-cnpg-backups-fsn1-ol` (object-locked); registry mirror `restormel-registry-mirror-fsn1/oci`;
  etcd `restormel-etcd-snapshots-fsn1/k3s` (native `--etcd-s3`); escrow `restormel-restic-backups/escrow/*.age`.
- **The two secrets nothing in the cluster can recreate (must come from offline escrow):** the ESO
  **machine-identity** (C1) and the Infisical **master key** (C2) — both inside `eso-bootstrap.age`,
  opened only by the founder's **offline** key `~/restormel-escrow-primary.key`.
- DNS is Hetzner-managed via `HCLOUD_TOKEN` (one token does Cloud + DNS). `.150` = hot standby until
  Stage C passes; **BX11** = transitional 2nd backup copy until Stage D.

## 1. TRIAGE FIRST — is this actually a total loss? (usually not)

| Symptom | This is NOT a cold-start — do this instead |
|---|---|
| App 5xx / one workload down, cluster healthy | `restormel-infra-alert-response`; check Argo app health; `kubectl -n argocd` resync; roll back the bad image/manifest. |
| One node down | K3s HA self-heals; confirm **etcd quorum (2 of 3)** with `kubectl get nodes` + etcd member health; replace the node (hcloud) and let Argo reconcile. |
| etcd quorum LOST (≥2 nodes gone) but disks/S3 intact | etcd restore only: `k3s server --cluster-reset --cluster-reset-restore-path=<snap> --etcd-s3 …` (see harness Step 0). |
| One CNPG cluster corrupt / bad data | **Scoped** CNPG `bootstrap.recovery` of *that one cluster* from `backups-fsn1-ol` (harness `manifests/10-` is the template) — NOT the whole estate. |
| Infisical / secrets down (ESO `SecretSyncError`) | Restore Infisical only (J4 from backup + J5 from escrow); ESO + the rest recover once it's back. |
| SurrealDB lost | restic restore `surreal-k3s` → `surreal import` into a fresh StatefulSet (J9). |
| **Whole cluster / region gone; nothing answers** | → **§2 full cold-start.** |

**Always, regardless of severity:** file an incident record immediately via **`restormel-isms-records`**
(REC-INC-*, append-only) — capture detected/impact/response while fresh. This is mandatory.

## 2. FULL COLD-START (total loss) — the ordered rebuild

This is the harness's procedure, executed **for real**. The order is a **hard chain** — each step
physically cannot complete until the prior one is up.

**Prereqs (founder):** declare the disaster; have the offline escrow key on the recovery machine;
`HCLOUD_TOKEN`, `RESTIC_PASSWORD`, fsn1 S3 keys to hand. Tools: `age hcloud aws restic skopeo kubectl helm jq envsubst`.

0. **Provision replacement node(s)** in fsn1 + install K3s, then **restore etcd from S3** (native
   `--cluster-reset-restore-path` from `restormel-etcd-snapshots-fsn1/k3s`). If etcd is unusable, fall
   back to a clean K3s + pure-GitOps rebuild (slower; some history not in git is lost).
1. **Infisical (J4+J5) — the decisive step.** Restore the Infisical DB, inject the **J5 master key from
   escrow**, and confirm a known value **decrypts** (the canary). If the escrow J4/J5 don't pair, STOP —
   nothing else can be decrypted.
2. **Forgejo + registry (J1+J2+J3).** Restore the Forgejo DB + repos (`git fsck`), and confirm images
   pull from the registry mirror — Argo and every workload need both.
3. **ESO + Argo (C1).** Recreate the **machine-identity from escrow** (`kubectl create secret … --save-config=false`),
   install ESO + Argo, point the app-of-apps at the restored Forgejo; confirm ClusterSecretStores go Valid.
4. **Platform.** Let Argo sync `cluster-addons` (CNPG operator, ESO, cert-manager, ingress, ObjectStore CR).
5. **Data tier (J6/7/8 + J9).** CNPG `bootstrap.recovery` of each Postgres cluster from `backups-fsn1-ol`;
   restic-restore + import SurrealDB. Verify row counts against last-known-good.
6. **Apps.** Argo syncs the workloads; verify each app serves.

**The two deltas vs the drill harness** (everything else is identical — reuse `scripts/dr/coldstart/assertions.sh` step-for-step):
- **Target = the REAL cluster**, not a throwaway box; do **not** destroy at the end, do **not** use scratch DNS.
- **Flip REAL DNS** (founder-gated): point `git.allotmentology.tech`, `secrets.restormel.dev`, `restormel.dev`,
  `api.plotbudget.com`, `argo.`/`grafana.allotmentology.tech` at the new master/ingress IP (Hetzner DNS via `HCLOUD_TOKEN`).

A fast way to *prove the restore mechanics still work* before/while doing the real thing is to run the
**drill** (`scripts/dr/coldstart/README.md`) — it exercises Steps 0–6 read-only into a throwaway box.

## 3. Founder-gated (never autonomous)
Declaring a disaster · provisioning new infra · **any real DNS flip** · using the **offline escrow key** ·
deleting/cancelling the old estate (`.150` standby, BX11). An agent may *prepare and execute the restore*
(the harness is pipe-only — escrow values never enter a transcript) but must **pause for explicit founder
consent** before each irreversible/outward action. This is why it's a skill an agent follows with a human
in the loop, **not** a fully autonomous cron/dispatch job — the recurring assurance is covered separately
by the §3d weekly per-jewel drill (in-cluster CronJob) and the quarterly cold-start drill.

## 4. After
- Keep the incident record current (timeline, root cause, RTO/RPO actually achieved, follow-ups).
- File the recovery as evidence (posture record) via `restormel-isms-records` — the achieved RTO updates
  the documented DR RTO.
- Re-run the cold-start **drill** once the dust settles to re-prove the gate.

## Pointers
- Procedure + harness: `scripts/dr/coldstart/` (README, DESIGN=WS6, assertions.sh = the exact steps).
- Blueprint + escrow facts + runbook: `~/.config/restormel/crown-jewels-dr/` (off-repo, founder machine).
- Target architecture: `restormel-k3s-architecture` · backups/restic + BX11: `restormel-backup`.
- Alerts → cause/first-action: `restormel-infra-alert-response` · records: `restormel-isms-records`.
- Memory: `dr-coldstart-harness`, `dr-drill-activation`, `stage-a-execution-2026-06-25`, `infra-direction-2026-06-23`.
