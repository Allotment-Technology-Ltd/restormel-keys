---
id: REC-EVID-005
title: "Crown-jewels DR live-recovery proof — all DB jewels + escrow C1/C2 (2026-06-27)"
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
related: [REC-PLAN-021, REC-EVID-004, REC-EVID-003]
---

# Crown-jewels DR — live-recovery proof of all DB jewels + escrow C1/C2 (2026-06-27)

> Closes the live-recovery gap left open by [[REC-EVID-004]] (which proved the recovery medium
> intact + read-only restorable for J1/J2/J9/J10). This run **restored every database jewel to a
> live, queryable Postgres from the fsn1 S3 store alone, and proved both escrow conditions** — on the
> founder's Mac, with the offline escrow key, **zero paid infra spent**. Repeatable harness:
> `scripts/dr/coldstart/jewels-proof-local.sh`.

## What was proven (live restore, 2026-06-27 ~14:28–14:32 UTC)

Each CNPG-Barman backup was restored with `barman-cloud-restore` into a throwaway Docker Postgres
(PG 16.8, matching prod `version=160008`), recovered to consistency, started, and queried:

| Jewel | Source (Barman serverName) | Result |
|-------|----------------------------|--------|
| **J3** Forgejo DB | `cnpg-backups-fsn1-ol/pg-forgejo` | live Postgres → `forgejo` db, **117 tables** ✅ |
| **J4** Infisical DB | `…/pg-infisical` | live Postgres → `infisical` db, **318 secrets** (216 tables) ✅ |
| **J6** restormel app DB | `…/pg-restormel` | live Postgres → `restormel_ops`, **64 tables** ✅ |
| **J7** platform DB | `…/pg-platform` | live Postgres → `allotmentology` 33t (+ `restormel_staging`/`usesophia` empty) ✅ |
| **J8** plotbudget DB | `…/pg-plotbudget` | live Postgres → `plotbudget`, **85 tables** ✅ |

### The decisive escrow conditions (J4 + J5)

A real Infisical **v0.154.6** (the prod image, pinned by digest) was booted over the recovered
`pg-infisical`, with `ENCRYPTION_KEY` + `AUTH_SECRET` supplied **only** from the offline escrow bundle
(`eso-bootstrap.age`, decrypted with `~/restormel-escrow-primary.key`):

- **C1 — machine-identity from escrow authenticates.** The escrowed universal-auth client-id/secret
  logged in against the recovered Infisical and received a valid access token. ✅
- **C2 — canary decrypts.** Using that token, the `DR_CANARY` secret (restormel/prod, path `/`) was
  fetched and **decrypted from the recovered ciphertext using the escrow master key**; its sha256
  equalled the published expected hash `fa3444cb…5276e2` — triple-confirmed against the hard-coded
  expected value **and** the separately-stored `DR_DRILL_CANARY_SHA256` secret. The value itself was
  never printed. ✅

This chains J4 (ciphertext DB) + J5 (escrow master key) + C1 (escrow identity) + C2 (decrypt) — the
exact sequence a real cold-start depends on — entirely from cold-start sources.

## Recovery-time observations

- WAL **replay-to-latest** of `pg-infisical` (04:00 backup → ~14:11 present, ~6 GB of prod WAL):
  **base restore 1 s + redo ~282 s**, then promote; Infisical ready ~3 s; migrations **no-op**
  (recovered current-state schema == v0.154.6).
- **Immediate-consistency** restores (weekly-drill default): each DB jewel **6–15 s** end-to-end; the
  full 7-assertion drill (4 DB jewels + J4 + C1 + C2) completes in **~3 min** with clean teardown.

## Topology + tooling notes (baked into the harness)

- Prod CNPG-Barman writes `backup.info` with an `encryption` field (`encryption=None`, i.e. **not**
  client-side encrypted) that **barman < 3.14 cannot parse**. The harness builds a one-off image =
  `postgresql:16.8` + `pip install -U barman[cloud]` (→ barman 3.19.1) for both restore and WAL-restore.
- CNPG data dirs carry operator-only `/controller/*` config (certs, log dir, `manager` archive/restore
  hooks); the harness neutralises these for standalone archive-recovery and restores the primary's
  `max_worker_processes`/slots so WAL replay isn't refused.

## Security

The recovered `pg-infisical` ciphertext DB + the escrow master key together can decrypt all prod
secrets. The drill keeps secret values out of the terminal (char-counts + the canary sha256 only), and
**tears down all containers/volumes + shreds the escrow env on exit**. The offline escrow key was read,
never copied, and remains founder-held. Verified post-run: no `dr-*` containers/volumes/`.age` files
left; `~/restormel-escrow-primary.key` intact.

## Follow-up surfaced

For a **real disaster** (Infisical down), the fsn1 **S3 read credentials** + **restic passphrase** must
be available offline — they are *not* in the escrow age bundle. The harness reads them from
`DR_S3_ACCESS_KEY_ID` / `DR_S3_SECRET_ACCESS_KEY` / `RESTIC_PASSWORD` env (offline DR-kit), falling back
to scoped Infisical fetch only in weekly-drill mode. **Action:** add these to the founder's offline DR
kit alongside the escrow key. (The weekly drill itself fetches them from Infisical and is unaffected.)

## Verdict for the decommission program

- **All 10 jewels are now proven recoverable**: J1/J2/J9/J10 read-only ([[REC-EVID-004]]); J3/J4/J6/J7/J8
  live + the escrow C1/C2 conditions (this record).
- This satisfies the **per-jewel + escrow** half of the Stage-C gate (REC-PLAN-021 §3d). The remaining
  Stage-C requirement is the **full `etcd-s3`-path cold-start on a real box** (orchestration + RTO under
  the cold-start harness) before the irreversible Stage D/E (`.150` standby delete, BX11 cancel,
  `.150` decommission). Those remain **blocked** pending that founder-run cold-start.

## Addendum (2026-06-27) — J10 etcd: cluster state recovers + added to the weekly drill

REC-EVID-004 proved the J10 snapshot is a *valid etcd db* (`etcdutl snapshot status`). This addendum
upgrades that to a **cluster-state-recovers** proof and folds it into the automatable weekly drill:

- The latest master snapshot (`restormel-etcd-snapshots-fsn1/k3s/etcd-snapshot-…-master1-…`) was restored
  into a **standalone etcd** (Docker, etcd v3.6) and its keyspace enumerated: **2516 objects, 25
  namespaces, 5 CNPG clusters, 9 Argo applications, 184 services, 139 secrets, 59 deployments, 6
  statefulsets** — i.e. the entire estate's declarative state is present and recoverable from S3 alone.
- **Done with zero controllers, zero cloud token, zero prod risk.** This is deliberate: restoring the prod
  etcd into a *live, networked* K3s would start the Hetzner **CCM** (holding the cloud token) and
  **external-dns**, which could reconcile against the real Hetzner project and **mutate/tear down prod**.
  Therefore the safe, automatable J10 proof restores the snapshot **offline**; the full live-cluster boot
  ("apps return 200") stays a **founder-supervised, egress-firewalled** exercise (the cold-start box drill).
- **Finding: K3s secrets are NOT encrypted at rest** — the etcd snapshot alone restores all secrets (no
  separate encryption-config key needs escrowing for J10). It also means the etcd snapshot is itself
  sensitive (plaintext secrets); the drill shreds it after use, like the escrow bundle.
- **Drill bug caught by the drill:** the first J10 run picked a stray `verify-s3-*` S3-write-probe object
  (older state, 3 CNPG clusters) because it sorts after `etcd-snapshot-*`; the selector now matches only
  `etcd-snapshot-<node>-<epoch>`.

`jewels-proof-local.sh` now runs **8/8** (J3/J4/J6/J7/J8 + C1 + C2 + J10) in ~3 min, £0, full teardown —
so **9 of the 10 jewels** (all but J1 repos / J2 registry, covered read-only in REC-EVID-004) are proven
by one automatable command. The weekly run is wired as a macOS launchd agent
(`tech.allotmentology.dr-jewels-proof`, Sun 04:15, runs the latest `origin/main` blob).
