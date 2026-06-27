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

## Steps 1–2 Barman rewire — DONE (implemented; pending its first box run)

Steps 1–2 used to `restic restore` a `<prefix>.dump` from non-existent restic prefixes `infisical`/`forgejo`.
**Rewired** (`restore_scratch_postgres` + new `barman_restore_db_to_dump`/`build_dr_barman_image` in
assertions.sh): for each DB jewel it now `barman-cloud-restore`s `pg-<name>` host-side in throwaway Docker
(`dr-barman:local` = `postgresql:16.8` + upgraded `barman[cloud,aws]`), recovers to backup-end consistency
(recovery.signal + `recovery_target=immediate`), `pg_dump -Fc`s the app DB, tears the container/volume down,
then `kubectl exec pg_restore`s the dump into the box's scratch-pg — the **identical proven path the weekly
`jewels-proof-local.sh` uses** (REC-EVID-005). Host-side (not on the box) because the egress-locked box
can't pull/build the barman image; the harness already restores host-side by default. The downstream
scratch-pg + scratch-Infisical wiring is untouched — only the dead restic SOURCE of the dump changed.

Also fixed in the same pass: the **canary coordinates** — `CANARY_SECRET_PATH` default was `/dr/canary`
(wrong; C2 would fail), corrected to `/DR_CANARY` (secret `DR_CANARY` at root path `/`, per REC-EVID-005).
`docker` added to the preflight tool list; `PG_IMAGE_BASE` added (must match prod PG major).

Forgejo **repos** (J1) remain restic `forgejo-data-k3s`; Surreal (J9) restic `surreal-k3s` — already correct.
Step 5's `cnpg_bootstrap_recovery` (CNPG-operator path) was already Barman-correct.

What's left is **not** code: the first supervised full-box run to confirm Steps 1-2 → C2 end-to-end on the
box (each piece — the etcd J10 path on hardware, the Barman restore in the weekly drill — is already proven
in isolation), plus Steps 3-6 (apps-200) + RTO, which are explicitly backlog.

## Box-run procedure (supervised; founder present with the offline escrow key)

```bash
export HCLOUD_TOKEN=…              # provision/destroy the box (DNS via the same token)
export RESTIC_PASSWORD=…           # repos/surreal jewels
export AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=…   # fsn1 read keys
export DR_DRILL_SSH_KEY=adam@allotment-hetzner DR_DRILL_SSH_PRIVKEY="$HOME/.ssh/id_hetzner_allotment"
export ESCROW_IDENTITY="$HOME/.config/restormel/dr-kit/escrow-primary.key"
export K3S_TOKEN_FILE="$HOME/.config/restormel/dr-kit/k3s-server-token"   # boots the restored etcd (J10)
bash scripts/dr/coldstart/dr-coldstart-drill.sh        # provisions, locks egress, restores, asserts, DESTROYS the box
```

The trap always destroys the box + writes the evidence record (PASS or FAIL). `KEEP_BOX=1` keeps it for
debugging (manual `hcloud server delete` owed). A full `etcd-s3`-path PASS (apps 200 + C1 + C2 + recorded
RTO) is what licenses Stage D/E (delete `.150` standbys, cancel BX11, decommission `.150`).

## First box run (2026-06-27) — what it proved + what it caught

A bounded **Step-0 box drill** ran on a real throwaway cx33 (provision → egress-lock → etcd restore →
verify → destroy):

- ✅ **`lock_box_egress_to_s3` VALIDATED on real hardware** — the box reported `EGRESS LOCKED` and
  `api.hetzner.cloud` was confirmed **unreachable** from it (`blocked-good`). The prod-protection control
  works: a restored CCM/external-dns cannot reach the real Hetzner project.
- ✅ Provision + k3s install + **box teardown** all worked (box destroyed, no orphan).
- ❌ **The etcd restore loaded an EMPTY cluster** (4 ns, 0 CNPG, 0 Argo apps = fresh k3s). The
  `k3s_cluster_reset_restore` step masked the reset exit code behind `; systemctl start k3s`, so a failed
  S3 download/restore silently left the fresh cluster, and `assert_etcd_loaded` was too weak to catch it.

**Fixed this commit:** `k3s_cluster_reset_restore` now captures the reset rc, requires restore-evidence in
`/var/log/dr-etcd-restore.log`, and tails it on failure; `assert_etcd_loaded` now HARD-FAILS unless the
prod expected-key-set (≥5 CNPG clusters or app-of-apps `root`) is present. The next box run will surface the
**actual** restore error in the log — likely the `--cluster-reset-restore-path` + `--etcd-s3` download
semantics (run with `KEEP_BOX=1` to inspect, or download the snapshot to a local path first and pass that).

## Second box run (2026-06-27) — J10 PROVEN end-to-end on real hardware (REC-EVID-006)

The Step-0 etcd path now restores **and boots the whole prod control-plane** on a fresh throwaway cx33,
egress-locked the entire time. Root-cause + fix for each blocker the run surfaced:

1. **Empty restore → `--etcd-s3` HeadBucket Access Denied.** k3s `--cluster-reset … --etcd-s3` does a
   bucket-existence (HeadBucket) check that the **read-scoped** S3 key is *denied*
   (`failed to test for existence of bucket … Access Denied`) → it silently restored *nothing*.
   **Fix:** download the snapshot host-side (`aws s3 cp`, a plain GET the read key CAN do) + scp to the
   box, then `--cluster-reset-restore-path=/root/snap.db` with **no** `--etcd-s3` (no bucket check).
   Verified: `kvstore restored, current-rev 3286574` (3.28M revisions = real prod etcd).
2. **`bootstrap data … encrypted with different token`.** k3s seals its in-datastore bootstrap data
   (cluster CA private keys, SA signing keys, secrets-encryption config) with the **server token**; the
   throwaway box generated its own, so the restored bootstrap couldn't be decrypted. **Fix:** write the
   **prod** token onto `/var/lib/rancher/k3s/server/token` before the reset (new `K3S_TOKEN_FILE`, from
   the offline DR kit — it can't be in Infisical because Step 0 precedes Step 1). This is the headline
   DR-design finding: **the K3s server token is a jewel-class secret and is now in the kit + escrow.**
3. **`… tls/* newer than datastore … Remove the file(s) and restart`.** The box's freshly-generated
   TLS/CA + cred files block the boot. **Fix:** `rm -rf server/tls server/cred/{ipsec.psk,passwd}` after
   the reset so k3s recreates them from the **restored** CA.
4. **Remote kubeconfig invalid post-restore** — the apiserver now serves with the *prod* CA, so the
   provision-time kubeconfig fails TLS. **Fix:** re-fetch the kubeconfig after boot.

**Result (egress-locked throughout — `api.hetzner.cloud` + metadata both `blocked-good`):** 25 namespaces,
**5 CNPG clusters** (all "Cluster in healthy state"), **9 Argo apps** incl. the app-of-apps `root`
(`OutOfSync` *because* egress-locked — the desired safety signal), 140 secrets, 52 ExternalSecrets,
6 ClusterSecretStores, 13 Certificates, 16 IngressRoutes, 90 ConfigMaps. **J10 = PASS on hardware.** Box
destroyed; prod untouched.

> Note these are findings the **standalone-etcd** weekly jewels-proof structurally cannot catch — it reads
> the raw etcd KV without booting k3s, so it never needs the token, the TLS reconcile, or a real apiserver.
> This is exactly why the live-box drill exists.

## What is validated vs pending

- **Validated:** all DB jewels + C1/C2 (barman) + J10 etcd cluster-state locally (REC-EVID-005); the
  **egress safety lock on real hardware**; box provision/install/teardown; **and now J10 etcd restore +
  full control-plane boot on real hardware (REC-EVID-006)** via local-path + token + tls-removal.
- **Code-complete:** Steps 1–2 **Barman rewire** (host-side CNPG-Barman → scratch-pg) + canary-coords fix —
  implemented + syntax-checked, reusing the weekly drill's proven restore. Pending only its first box run.
- **Backlog (founder decision 2026-06-27, nice-to-have not essential):** Steps 3–6 (ESO/Argo/platform/
  apps-200) end-to-end + recorded RTO. Steps 0 (J10, hardware) + escrow C1/C2 (REC-EVID-005) are proven.
