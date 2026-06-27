# Live-box cold-start — safety + readiness note (2026-06-27)

The local jewels-proof (`jewels-proof-local.sh`, REC-EVID-005) proves **9/10 jewels + escrow C1/C2 + J10
cluster-state** restore from S3, offline, £0. The remaining Stage-C item is the **full live-box
cold-start** (`dr-coldstart-drill.sh`, Steps 0–6 → apps return 200 on the restored cluster, with an RTO).
This note records what was hardened for that run and what still needs doing **before** it can pass — so the
supervised box run is clean, not exploratory.

## THE safety control: egress isolation (added this commit)

Restoring the prod etcd into a *live, networked* K3s starts the workloads the snapshot contains — including
the **Hetzner Cloud Controller Manager** (holds the prod cloud token) and **external-dns**. If they reach
`api.hetzner.cloud` or the metadata service `169.254.169.254`, they can reconcile against the **real**
Hetzner project and **detach volumes, delete load balancers, or rewrite prod DNS**. This is the one way the
drill could damage prod, irreversibly.

`lock_box_egress_to_s3` (assertions.sh) installs an nftables `drop`-policy OUTPUT chain on the box that
allows egress only to: loopback, established/related, the k3s pod+service CIDRs (10.42/10.43), DNS (53), and
the **fsn1 object-storage IPs on 443**. Everything else — the Hetzner API, the metadata endpoint, all prod
hosts — is dropped. It runs in Step 0 **after** k3s install (which needs open egress) and **before**
`k3s_cluster_reset_restore` (which boots the controllers), and it self-verifies that metadata is unreachable.
So from the instant the restored controllers start, they fail closed. **Validate on the first box run.**

## STILL TO DO before a passing run (Steps 1–2 Barman rewire)

Steps 1–2 currently call `restore_scratch_postgres "infisical"/"forgejo"`, which `restic restore`s a
`<prefix>.dump` (pg_dump -Fc) from restic prefixes `infisical`/`forgejo`. **Those restic prefixes do not
exist** — the DB jewels are CNPG-**Barman** physical backups (see DESIGN-NOTE-topology). The proven restore
path is in `jewels-proof-local.sh`: `barman-cloud-restore` the cluster (e.g. `pg-infisical`) into a Postgres
**data dir**, recover to consistency, serve it. The rewire:

1. Replace the `scratch-pg` + `pg_restore` lane (manifest `20-scratch-infisical.yaml`) with a scratch
   Postgres whose data dir is a **barman-cloud-restore of `pg-infisical`** (init-container or a pre-seeded
   PVC), exactly as the local drill does. The Infisical image must match prod (`v0.154.6`); on a current
   restore "No migrations pending" confirms the version.
2. Step 2 Forgejo DB likewise restores from Barman `pg-forgejo` (not restic). Forgejo **repos** (J1) remain
   restic `forgejo-data-k3s`; Surreal (J9) restic `surreal-k3s` — those are already correct.
3. Step 5's `cnpg_bootstrap_recovery` (CNPG operator path) is already Barman-correct; it's only the
   *early* Steps 1–2 (pre-operator) that used the dead restic-dump lane.

Until that rewire lands, a full run fails at Step 1.

## Box-run procedure (supervised; founder present with the offline escrow key)

```bash
export HCLOUD_TOKEN=…              # provision/destroy the box (DNS via the same token)
export RESTIC_PASSWORD=…           # repos/surreal jewels
export AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=…   # fsn1 read keys
export DR_DRILL_SSH_KEY=adam@allotment-hetzner DR_DRILL_SSH_PRIVKEY="$HOME/.ssh/id_hetzner_allotment"
export ESCROW_IDENTITY="$HOME/restormel-escrow-primary.key"
bash scripts/dr/coldstart/dr-coldstart-drill.sh        # provisions, locks egress, restores, asserts, DESTROYS the box
```

The trap always destroys the box + writes the evidence record (PASS or FAIL). `KEEP_BOX=1` keeps it for
debugging (manual `hcloud server delete` owed). A full `etcd-s3`-path PASS (apps 200 + C1 + C2 + recorded
RTO) is what licenses Stage D/E (delete `.150` standbys, cancel BX11, decommission `.150`).

## What is validated vs pending

- **Validated (this session, REC-EVID-005):** all DB jewels + C1/C2 (barman) + J10 etcd cluster-state, locally.
- **Pending first box run:** `lock_box_egress_to_s3`, `k3s_cluster_reset_restore` on real hardware, the
  Steps 1–2 Barman rewire, and Steps 3–6 (ESO/Argo/platform/apps-200) end-to-end.
