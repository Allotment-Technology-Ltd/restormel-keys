---
id: REC-EVID-004
title: "Crown-jewels DR read-only verification + cold-start topology correction (2026-06-27)"
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
related: [REC-PLAN-021, REC-EVID-003]
---

# Crown-jewels DR — read-only verification + cold-start topology correction (2026-06-27)

> Produced while running the first real Stage-C cold-start drill (REC-PLAN-021). The run **failed at
> preflight before provisioning any box (cost £0)**, surfacing a backup-topology error in the harness;
> the harness was corrected and the recovery medium verified read-only against the fsn1 store. Pairs
> with the per-jewel weekly drill ([[REC-EVID-003]]) and the harness at `scripts/dr/coldstart/`.

## Recovery medium — verified intact + readable (read-only, no infra spent)

All jewels present in the fsn1 S3 store and readable with the founder-held credentials:

| Jewel | Source | Verification |
|-------|--------|--------------|
| **J10** etcd | `restormel-etcd-snapshots-fsn1/k3s` | `etcdutl snapshot status` → **valid db** (hash afcfac8c, rev 2067003, 2109 keys, 26 MB, etcd 3.6.0) |
| **J1** Forgejo repos | restic `forgejo-data-k3s` | 2 snapshots; **10,377** repo-path entries; latest 7.65 GiB |
| **J9** Surreal | restic `surreal-k3s` | latest snapshot 580 MiB; `dump-main-sophia.surql` present |
| **J2** registry | `restormel-registry-mirror-fsn1/oci` | 32 OCI blob/manifest objects |
| **J3/J4/J6/J7/J8** DBs | CNPG Barman `cnpg-backups-fsn1-ol/{pg-infisical,pg-forgejo,pg-restormel,pg-platform,pg-plotbudget}` | each has `base/` backups (3 for pg-infisical: 25/26/27 Jun) + `wals/` |
| **J5 / escrow** | `restormel-restic-backups/escrow` | `eso-bootstrap.age` (477 b) + `dr-drill-canary.age` (378 b) present |

restic repos decrypt with the passphrase (snapshots list); S3 credentials + restic passphrase confirmed working.

## Restorability PROVEN (read-only): J1, J2, J9, J10
These four jewels were proven *restorable* end-to-end without any cluster (etcd snapshot validated by
`etcdutl`; restic snapshots enumerated; registry OCI objects present).

## Topology correction to the harness
The harness assumed restic `infisical`/`forgejo` **DB** prefixes that do not exist. Reality: the Infisical
(J4) + Forgejo (J3) + app (J6/7/8) **databases** are **CNPG Barman**, and Forgejo **repos** (J1) are
restic `forgejo-data-k3s`. Harness preflight + the Forgejo restic prefix corrected; a macOS bash-3.2
`declare -A` blocker fixed. Full detail: `scripts/dr/coldstart/DESIGN-NOTE-topology-2026-06-27.md`.

## Still PENDING (live-recovery proof)
J3/J4/J6/J7/J8 **live** recovery + **C2** (Infisical decrypts the canary from a recovered `pg-infisical`)
+ **C1** (machine-identity from escrow authenticates) — to be proven via a Docker-local
`barman-cloud-restore` rig (recommended) or the full k8s platform bring-up.

## Verdict for the decommission program
- Recovery medium is intact + readable; 4/10 jewels proven restorable; the remaining 6 are present +
  readable but their **live recovery is not yet proven**.
- **Stage C is NOT satisfied.** A full `etcd-s3`-path cold-start PASS (incl. C1 + C2) is still required
  before Stage D/E (`.150` standby delete, BX11 cancel, `.150` decommission). Those remain blocked.
