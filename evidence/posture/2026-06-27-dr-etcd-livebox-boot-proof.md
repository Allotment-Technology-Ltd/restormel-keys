---
id: REC-EVID-006
title: "Crown-jewels DR — J10 etcd restore + full control-plane boot on real hardware (2026-06-27)"
class: evidence
owner: adam
status: approved
classification: internal
control-tier: 3
created: 2026-06-27
last-reviewed: 2026-06-27
review-interval: P12M
approved-by: adam
approved-on: 2026-06-27
retention: P6Y
related: [REC-PLAN-021, REC-EVID-005, REC-EVID-004]
---

# Crown-jewels DR — J10 etcd restore + full control-plane boot on real hardware (2026-06-27)

> Extends [[REC-EVID-005]] (which proved every DB jewel + escrow C1/C2 restore locally, and J10 etcd
> *cluster-state* via a **standalone** etcd that never boots k3s). This run goes the last mile for J10:
> a **fresh throwaway Hetzner box** restored the prod etcd snapshot from the fsn1 S3 store alone **and
> booted the whole prod control-plane** — egress-firewalled the entire time so prod was physically
> unreachable. It also surfaced + closed a **DR-design gap**: the K3s server token is a jewel-class
> secret and must live in the offline DR kit.

## What was proven (real hardware, 2026-06-27)

Throwaway `cx33` in fsn1, fresh Ubuntu 24.04 + single-node k3s. Egress locked to the S3 store + DNS +
in-cluster CIDRs only (`nft` drop-policy OUTPUT) **before** the restore. The prod etcd snapshot
(`etcd-snapshot-restormel-sovereign-master1-*`, native K3s `--etcd-s3`) was restored and the cluster
booted. Inventory of the **restored** control-plane:

| Object | Count | Note |
|--------|-------|------|
| etcd revisions restored | `current-rev 3286574` | 3.28M revisions = real prod etcd (not an empty restore) |
| Namespaces | 25 | argocd, cnpg-system, forgejo, infisical, huly, sophia, supabase, restormel-prod, allotmentology-prod, monitoring, traefik, external-secrets, … |
| CNPG clusters | 5 | pg-forgejo / pg-infisical / pg-platform / pg-plotbudget / pg-restormel — all "Cluster in healthy state" (CR objects) |
| Argo Applications | 9 | incl. app-of-apps `root` (**OutOfSync** — *because* egress-locked; the desired safety signal) |
| Secrets | 140 | readable → confirms K3s secrets are **not** encrypted-at-rest here ⇒ the snapshot is self-sufficient |
| ExternalSecrets | 52 | external-secrets.io CRs restored |
| ClusterSecretStores | 6 | |
| Certificates (cert-manager) | 13 | |
| IngressRoutes (traefik) | 16 | |
| ConfigMaps | 90 | |

## Safety — prod was physically unreachable throughout

The egress lock held from before the restore through the full boot. Verified on the box at the end:
`api.hetzner.cloud` → **blocked-good**, metadata `169.254.169.254` → **blocked-good**. So the restored
Hetzner CCM (prod cloud token) + external-dns could never reach the real Hetzner project — no volumes
detached, no LBs deleted, no DNS rewritten. The `root` app-of-apps staying `OutOfSync` (it cannot reach
Forgejo to sync) is the in-band confirmation that egress was closed. Box destroyed after the proof;
only the 3 real prod servers remain.

## The blockers it surfaced + the fixes (all now in the harness)

These are findings the **standalone-etcd** weekly jewels-proof structurally cannot catch — it reads the
raw etcd KV without booting k3s, so it never needs the token, the TLS reconcile, or a live apiserver.

1. **Empty "successful" restore → `--etcd-s3` HeadBucket Access Denied.** k3s `--cluster-reset … --etcd-s3`
   runs a bucket-existence (HeadBucket) check the **read-scoped** S3 key is *denied*
   (`failed to test for existence of bucket … Access Denied`), silently restoring nothing.
   **Fix:** download the snapshot host-side (`aws s3 cp` — a plain GET the read key can do) + scp to the
   box, then `--cluster-reset-restore-path=/root/snap.db` with **no** `--etcd-s3`.
2. **`bootstrap data … encrypted with different token`.** k3s seals its in-datastore bootstrap data
   (cluster CA private keys, SA signing keys, secrets-encryption config) with the **server token**; a
   fresh node generates its own, so the restored bootstrap is undecryptable. **Fix + DR-design change:**
   the **prod K3s server token is now part of the offline DR kit** (`~/.config/restormel/dr-kit/k3s-server-token`,
   `K3S_TOKEN_FILE`) and is written to the node before the reset. It **cannot** live in Infisical because
   the etcd restore (Step 0) precedes the Infisical restore (Step 1).
3. **`… tls/* newer than datastore … Remove the file(s) and restart`.** The node's freshly-generated
   TLS/CA + cred files block the boot. **Fix:** remove `server/tls` + `server/cred/{ipsec.psk,passwd}`
   after the reset so k3s recreates them from the **restored** CA.
4. **Remote kubeconfig invalid post-restore** (apiserver now serves with the prod CA). **Fix:** re-fetch
   the kubeconfig after boot.

Harness changes: `scripts/dr/coldstart/{assertions.sh,dr-coldstart-drill.sh,README.md,DESIGN-NOTE-livebox-2026-06-27.md}`
(`k3s_cluster_reset_restore` → local-path + token + tls-removal + kubeconfig re-fetch; new `K3S_TOKEN_FILE`
+ preflight; `box_ssh` → `UserKnownHostsFile=/dev/null` for recycled-IP boxes; egress-lock S3 resolution
hardened). The reused-IP SSH failure (Hetzner recycles IPs; a stale `known_hosts` entry makes
`accept-new` refuse) was also fixed.

## Stage-C status after this run

- **PASS on hardware:** J10 etcd restore + full control-plane boot (this record); egress safety lock.
- **PASS locally (REC-EVID-005):** all DB jewels J3/J4/J6/J7/J8 + escrow C1/C2 + J1/J2/J9/J10 read-only.
- **Code-complete (same PR #367):** the full-drill **Steps 1-2 Barman rewire** — `restore_scratch_postgres`
  now `barman-cloud-restore`s `pg-infisical`/`pg-forgejo` host-side in Docker (the proven
  `jewels-proof-local.sh` lane), recovers, `pg_dump`s, and `pg_restore`s into scratch-pg; the canary
  coordinates were also corrected (`/DR_CANARY` at root, not `/dr/canary`). Pending only its first
  supervised box run.
- **Backlog (founder decision 2026-06-27, nice-to-have):** Steps 3-6 (ESO/Argo/platform/apps-200) +
  recorded RTO. Until the full `etcd-s3` PASS lands + the §3d weekly drill stays GREEN, **Stage D/E
  remains gated** (no `.150` standby delete, no BX11 cancel, no `.150` decommission).

## Custody note

The drill used the founder's offline escrow key and the prod K3s token via **machine-to-machine pipes
only** (master1 → throwaway box, and prod → local DR kit). No secret value entered any transcript, argv,
or log; assertions are over counts / status / blocked-good booleans. The DR-kit passphrase remains
founder-held (never known to any agent).

## Correction (appended 2026-06-27)

The "Stage-C status" section above states **"Stage D/E remains gated (no `.150` standby delete, no BX11
cancel, no `.150` decommission)."** That was written without awareness that **Stage D/E had already been
executed on 2026-06-26** — BX11 cancelled + `.150` (Cloud server 138350520) deleted, governance recorded in
PR #339 (AST-010/AST-012 `status: decommissioned`); see memory `bx11-150-decommission`. The founder
**front-ran the formal full-box gate**, a deliberate risk-acceptance grounded in the per-jewel + escrow
C1/C2 + J10 recovery proven from fsn1 S3 alone (REC-EVID-005, this record) plus the retained recovery
snapshot `401960703`. The crown-jewels recovery does not depend on the retired hosts. This note corrects
the record append-only (the original text is left intact as the point-in-time entry).
