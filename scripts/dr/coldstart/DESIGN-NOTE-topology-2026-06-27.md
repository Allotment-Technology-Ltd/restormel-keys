# Cold-start harness — backup-topology correction (2026-06-27)

The first real drill run surfaced that the harness's Step 1–2 assumed a backup lane that **does not
exist**. Corrected understanding, verified read-only against the fsn1 store on 2026-06-27:

## The real backup topology (what actually exists in S3)

| Jewel | Real source | NOT (the harness's wrong assumption) |
|-------|-------------|--------------------------------------|
| J1 Forgejo repos | restic `restormel-restic-backups/forgejo-data-k3s` (the `/data` volume) | ~~restic `forgejo`~~ |
| J3 Forgejo DB | **CNPG Barman** `restormel-cnpg-backups-fsn1-ol/pg-forgejo` | ~~restic `forgejo`~~ |
| J4 Infisical DB | **CNPG Barman** `…/pg-infisical` | ~~restic `infisical`~~ (no such prefix) |
| J5 Infisical master key | escrow `eso-bootstrap.age` (offline key) | (unchanged) |
| J6/7/8 app DBs | **CNPG Barman** `…/{pg-restormel,pg-platform,pg-plotbudget}` | (unchanged) |
| J9 Surreal | restic `…/surreal-k3s` | (unchanged ✓) |
| J10 etcd | native `restormel-etcd-snapshots-fsn1/k3s` | (unchanged ✓) |
| J2 registry | `restormel-registry-mirror-fsn1/oci` | (unchanged ✓) |

Also present (legacy, ignore): `restic-{app,buildops,surreal}` (pre-K3s .150/BX11-era dumps).

## Consequence for the harness

The Infisical (J4) and Forgejo (J3) **databases** must be restored via **CNPG `bootstrap.recovery`**
from `backups-fsn1-ol` (serverName = the cluster name), **not** restic + `pg_restore`. That changes the
ordering: a CNPG recovery needs **cert-manager + the CNPG operator + the barman-cloud plugin + an
`s3-backup-creds-fsn1` secret + the ObjectStore CR up *before* Step 1** — i.e. a chunk of the platform
comes up first. (`restore_scratch_postgres` / `manifests/20-`'s plain scratch-pg lane is therefore
superseded for the DB jewels; it remains valid only if a future logical-dump lane is added.)

Two viable ways to prove the DB jewels restore (J3/J4/J6/J7/J8) + the decisive C2 canary:
1. **k8s path** (full cold-start, `DRILL_MODE=full`): bring up cert-manager + CNPG operator +
   barman-cloud plugin + ESO on the box, then CNPG-recover each cluster — this is essentially the full
   platform bring-up (Step 4) and is the option-B end-to-end.
2. **Docker-local path** (lighter, no box, fast iteration): use the CNPG postgres image's
   `barman-cloud-restore` + `barman-cloud-wal-restore` to restore `pg-infisical` into a local Postgres,
   run Infisical (docker) over it + the escrow J5, and assert the canary decrypts (C2) + the
   machine-identity (C1) authenticates. Proves the same *jewels* without the k8s plumbing.

## What's already PROVEN (read-only, 2026-06-27 — zero box)

- **J1** Forgejo repos: 10,377 repo-path entries in the restic snapshot.
- **J2** registry: 32 OCI blob/manifest objects in the mirror.
- **J9** Surreal: `dump-main-sophia.surql` present (latest snapshot).
- **J10** etcd: `etcdutl snapshot status` → valid db (hash afcfac8c, rev 2067003, 2109 keys, etcd 3.6.0).
- **Store integrity:** all 5 CNPG clusters have `base/` backups + WALs; restic repos decrypt with the
  passphrase; both escrow objects present. The recovery medium is intact + readable.

## Pending (the live-recovery proof)

J3/J4/J6/J7/J8 live-recovery + **C2** (Infisical decrypts the canary from a recovered `pg-infisical`) +
**C1** (machine-identity from escrow authenticates) — via the Docker-local path above (recommended) or
the full k8s path. Until that passes via the `etcd-s3` route, Stage C is **not** satisfied and Stage D/E
remain blocked.
