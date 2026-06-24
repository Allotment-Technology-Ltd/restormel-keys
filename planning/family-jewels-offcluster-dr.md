---
id: REC-PLAN-021
title: "Family-jewels off-cluster DR — decommission .150, replace standby compute with a storage target"
class: planning
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-24
last-reviewed: 2026-06-24
review-interval: P6M
retention: review-only
related: [REC-PLAN-012, REC-PLAN-016, REC-PLAN-020]
---

# Family-jewels off-cluster DR

**Strategy (founder).** Stop paying for a *compute* standby. The only remaining Coolify box,
`.150` (`77.42.125.150`), exists mainly to host the two cold-start bootstrap services
(**Forgejo** + **Infisical**) plus redundant standbys. Replace it with a cheap **off-cluster
storage target** that holds the complete "family jewels" — comprehensive, encrypted backups of
everything irreplaceable — so a **full cluster loss is recoverable from that one store**. Pay for
storage that gives whole-estate DR, not for idle compute.

**The bootstrap tension (and how the store resolves it) — DECIDED.** Forgejo (GitOps source-of-truth +
container registry every K3s image pulls from) and Infisical (the ESO secret backend every cluster
secret syncs from) are the cold-start backbone. Putting them *on* the very cluster they bootstrap is
the classic circular-dependency / "F8" anti-pattern: if the cluster is gone you cannot reach the
thing you need to rebuild it. **The founder has settled it: move them on-cluster (HA placement)**, with
the **off-cluster S3 store + an automated, tested DR runbook as the mitigation** that makes full `.150`
decommission safe. This is viable *because* the store genuinely holds a restorable copy of Forgejo
(repos + registry blobs + DB) and Infisical (secrets + DB), **and** an automated periodic restore-drill
plus a tested cold-start runbook prove we can rebuild them onto a fresh host from that store alone. The
on-cluster bootstrap risk is accepted **on that condition**; the mitigation is built and the drill
passes *before* the on-cluster flip is irreversible (§5).

**Why this is safe even though the backbone moves on-cluster.** Hetzner Object Storage (S3, `fsn1`) is
an **external, off-cluster service** — it has no dependency on the K3s cluster, on `.150`, or on the
Forgejo/Infisical that move on-cluster. A total cluster loss therefore does **not** take the store down
with it. That independence is exactly what makes the store a valid recovery medium and what licenses
full `.150` decommission: the cold-start backbone disappears with the cluster, but its *restorable copy*
survives in a service nothing in the estate can take out. (§4 cold-start; §3 backup design.)

The founder's decisions are **SETTLED** (§6). This remains a **planning/design record** — nothing here
*itself* changes infra, backups, or DNS — but it is the **agreed plan**, ready for the founder's merge.
Every build/irreversible step is still founder-gated and flagged; Stage A explicitly requires a
`restormel-high-risk-security` review.

---

## 0. Evidence base (live findings, 2026-06-24)

Verified via `KUBECONFIG=/private/tmp/k3s-create/kubeconfig`, the repo, the `restormel-backup`
skill, and Forgejo PR #283.

**Cluster (K3s 3-node HA, ingress `135.181.25.76`):**

| Node | IP | Role |
|------|-----|------|
| `restormel-sovereign-master1` | `135.181.25.76` | control-plane, etcd |
| `restormel-node2` | `204.168.216.166` (was `.166` CI box) | control-plane, etcd |
| `restormel-node3` | `77.42.124.167` (the old `.167`, now a node) | control-plane, etcd |

**Already backed off-cluster today (all to Hetzner Object Storage, region `fsn1`,
`https://fsn1.your-objectstorage.com`):**

- **CNPG Postgres ×3** (`pg-restormel`, `pg-platform`, `pg-plotbudget`, each 2 instances, healthy) →
  Barman-Cloud plugin → ObjectStore `backups-fsn1`, `s3://restormel-cnpg-backups-fsn1/`,
  `retentionPolicy: 30d`, gzip data + WAL. Daily `ScheduledBackup` per cluster, all `completed`,
  last backups 17–18 h old. **Covers `usesophia` DB (on `pg-platform`) too.**
- **Cluster SurrealDB** (`data/surreal-0`, 20 Gi PVC) → hourly `CronJob data/surreal-backup`:
  `surreal export` (ns `main` / db `sophia`) → restic →
  `s3:.../restormel-restic-backups/surreal-k3s`, retention
  `--keep-hourly 24 --keep-daily 7 --keep-weekly 4 --keep-monthly 6`, `restic check 5%`.
- **Loki logs** → S3 `restormel-loki-logs-fsn1` (schema v13, `object_store: s3`). Operational, not
  irreplaceable; out of "family jewels" scope but noted.

**Dead-man's-switch (cluster):** `monitoring/deadmans-heartbeat` CronJob `*/5` curls
`HEARTBEAT_PING_URL` (external). Backup-specific DMS for the `.150` restic job is Uptime Kuma push
monitor #5 + Telegram (per `restormel-backup` skill).

**Forgejo + Infisical (still on `.150`, off-cluster by design):**

- **Registry:** every K3s app image pulls from the **Forgejo built-in registry**
  `git.allotmentology.tech` / `registry.allotmentology.tech` — confirmed live image refs:
  `git.allotmentology.tech/allotment-technology-ltd/{allotmentology-web,dashboard,worker}:<sha>`
  (Sophia currently pulls `ghcr.io/...` — external, see §1). **Cold-start needs these blobs** or
  Argo can sync manifests but pods `ImagePullBackOff`.
- **Infisical** ESO backend: 5 `ClusterSecretStore`s (`infisical-{allotmentology,infra,plotbudget,
  restormel,sophia}`) all `Valid/Ready`, `hostAPI: https://secrets.restormel.dev/api`. Every cluster
  secret syncs from here.

**Today's `.150` backup** (`scripts/backup/buildops-backup.sh`, restic, cron 02:00) DOES capture:
app PG dump, **Forgejo PG dump**, **Forgejo data volume** `nrghbzywi1smlfrpnmdkmd7d_forgejo-data/_data`
(whole volume → includes `data/packages/` **registry blobs** and `data/git/repositories` **git
repos**), Coolify PG + config, **Infisical PG dump** + `/opt/infisical` config (the `.env` master key
`ENCRYPTION_KEY`/`AUTH_SECRET` needed to decrypt). Target today = **BX11 Storage Box**
(`u613941.your-storagebox.de`; repos `restic-buildops` + `restic-surreal` + `restic-app`, shared
rclone `storagebox` remote + shared restic passphrase, retention `--keep-daily 7 --keep-weekly 4
--keep-monthly 6`). **PR #283** (open, now **decided: MERGE**) migrates this restic lane BX11 → **fsn1 S3**
(`restormel-restic-backups/...`), additive, dual-write, restore-drill PASS, not yet deployed to the
box — and **retires BX11** once cut over. The store decision (§3a, §6) **adopts #283**: BX11 → fsn1 S3,
BX11 kept ONLY transitionally until a cold-start drill passes, then cancelled.

**Gaps found live:**

1. **K3s etcd snapshots are LOCAL ONLY.** 49 `ETCDSnapshotFile` CRs, every `location` is
   `file:///var/lib/rancher/k3s/server/db/snapshots/...` on node2/node3. **None shipped to S3.**
   `K3S_ETCD_*` keys exist in the Infisical `infrastructure` project (intent) but `--etcd-s3` is not
   wired. A whole-cluster loss currently loses etcd unless a node disk survives.
2. **Forgejo/Infisical jewels live in a *different* DR lane** (restic→BX11, mid-migration to S3 via
   #283) from the cluster jewels (native fsn1 S3). They are *not yet consolidated* into one store,
   and the `.150` restic job depends on `.150` itself being alive to run.
3. **Restore drill is partial.** `buildops-restore-drill.sh` only restores the **app** DB and counts
   rows. It does **not** drill Forgejo (repos + registry + DB), Infisical, or a full cold start.
4. **No MinIO/SeaweedFS** in-cluster (good — one fewer object store to back up). Object storage for
   everything is Hetzner fsn1.

---

## 1. "Family jewels" inventory

The complete irreplaceable state to rebuild the whole estate from zero. **Status** = is it already
backed off-cluster, and where.

| # | Jewel | Where it lives now | Off-cluster backup today | Status |
|---|-------|--------------------|--------------------------|--------|
| J1 | **Forgejo git repos** (all repos — GitOps source-of-truth for every Argo app) | `.150` `forgejo-data/_data/data/git/repositories` | restic→BX11 (whole volume); → fsn1 S3 once #283 deploys | **PARTIAL** — backed, but in the .150-dependent restic lane, not consolidated; restore untested |
| J2 | **Forgejo container registry blobs** (every K3s image) | `.150` `forgejo-data/_data/data/packages` | restic→BX11 (inside the volume) | **PARTIAL** — captured incidentally inside the volume; never restore-drilled; size unknown |
| J3 | **Forgejo Postgres** (issues, PRs, users, tokens, registry metadata) | `.150` `postgresql-nrghbzywi…` | `pg_dump -Fc` in restic→BX11 | **PARTIAL** — backed, .150-dependent lane |
| J4 | **Infisical secrets** (all projects' encrypted secrets — the ESO root of trust) | `.150` Infisical PG | `pg_dump -Fc infisical` in restic→BX11 | **PARTIAL** — backed; **decrypt requires J5** |
| J5 | **Infisical master key + config** (`ENCRYPTION_KEY`, `AUTH_SECRET` in `/opt/infisical/.env`) | `.150` `/opt/infisical` | restic→BX11 (config dir, pg/redis excluded) | **PARTIAL + SENSITIVE** — without this, J4 is undecryptable ciphertext |
| J6 | **CNPG `pg-restormel`** (operational + auth: workspaces, api_keys, Better Auth) | cluster PVC | Barman→fsn1 S3, daily, 30d | **OK (off-cluster)** |
| J7 | **CNPG `pg-platform`** (platform DB + `usesophia` DB) | cluster PVC | Barman→fsn1 S3, daily, 30d | **OK (off-cluster)** |
| J8 | **CNPG `pg-plotbudget`** (Supabase/Plot data + RLS) | cluster PVC | Barman→fsn1 S3, daily, 30d | **OK (off-cluster)** |
| J9 | **Cluster SurrealDB** (`main/sophia`) | `data/surreal-0` PVC | restic→fsn1 S3, hourly | **OK (off-cluster)** |
| J10 | **K3s etcd** (all cluster state Argo can't regenerate — CRDs, secrets, non-GitOps objects) | node disks (node2/node3) | **none** | **GAP — local snapshots only** |
| J11 | **Other PVCs** (Grafana dashboards, Prometheus/Alertmanager, CloudBeaver workspace) | cluster PVCs | none | **GAP (low value)** — regenerable from GitOps/scrape; Grafana dashboards if hand-edited |
| J12 | **Loki logs** | — | S3 `restormel-loki-logs-fsn1` | OK — operational, not a jewel |

**Re-derivable, NOT jewels (no backup needed):** Argo Applications, Deployments, ConfigMaps,
Ingresses, Services — all reconstructed by Argo from J1. cert-manager certs re-issue from
Let's Encrypt. ESO `ExternalSecret`-materialised Secrets re-sync from J4/J5. **This is the leverage:
back up the *sources* (J1–J10), let GitOps rebuild the rest.**

**Sophia image — SETTLED: move onto the Forgejo registry.** Sophia currently pulls
`ghcr.io/allotment-technology-ltd/sophia:<sha>` (GitHub-hosted, external), so for cold start *one* app's
images sit outside the Forgejo registry. **Decision (§6): standardise EVERY image onto the Forgejo
registry** — Sophia's CI moves from ghcr.io to `git.allotmentology.tech` so cold start has a **single
image source**, and `skopeo`/`oras` mirrors all those blobs into S3 (J2). After the move Sophia's images
become first-class J2 blobs; until then GHCR is a documented stopgap, not the target state.

---

## 2. Gap analysis — what is NOT yet safely off-cluster in ONE store

Ordered by cold-start criticality.

1. **K3s etcd snapshots → off-box (J10).** *Highest-impact gap.* Local-only today. A region/cluster
   loss loses every cluster object that isn't in Git or regenerable: hand-applied secrets, CRD
   instances, the ArgoCD app-of-apps state, anything not yet GitOps-managed. Restoring etcd is the
   fastest path back; rebuilding purely from GitOps is slower and assumes 100% of state is in Git
   (it is not — bootstrap secrets, the ESO machine-identity, etc.). **Fix (decided, §6.6):** enable
   native K3s `--etcd-s3` to fsn1 (`K3S_ETCD_*` creds already in Infisical). Cheap, additive, no app
   impact.

2. **Forgejo registry blobs (J2) — explicit, drilled, sized.** They are *inside* the `.150` restic
   volume today, but: (a) never restore-tested, (b) size/growth unmeasured (registry blobs dominate
   backup size and can balloon), (c) on cold start you must restore them *before* Argo can pull, so
   they are on the critical path. Treat the registry as a **first-class backup target** (a periodic
   `skopeo sync` / registry mirror into the store is more restartable than a tar of the volume).

3. **Forgejo (J1+J3) + Infisical (J4+J5) consolidated into the cluster-jewels store.** Today they are
   in a separate restic lane keyed to `.150` being alive. When `.150` is decommissioned, that lane
   and its cron vanish. Their backup must be **produced by a job that survives `.150`'s death** —
   i.e. once Forgejo/Infisical move on-cluster (§5a), a *cluster* CronJob backs them to fsn1 S3,
   exactly like Surreal does today.

4. **A real cold-start restore drill (not just app-DB row counts).** No current test proves we can
   stand Forgejo + Infisical back up from the store on a fresh host and have ESO + Argo rebuild. This
   is the single most important thing to *prove* before trusting the store as the only safety net.

5. **Low-value PVC gaps (J11).** Grafana hand-edited dashboards, CloudBeaver workspace. Cheap to add
   to the same restic job; flag as optional.

---

## 3. Comprehensive backup design — one dedicated off-cluster store

### 3a. SETTLED DECISION — the family-jewels store: **Hetzner S3 (fsn1), single region, object-lock + versioning**

**Decided (founder).** The single family-jewels store is **Hetzner Object Storage (S3, region `fsn1`),
ONE region, with OBJECT-LOCK + VERSIONING enabled.** No cross-region replica and no permanent second
copy. **PR #283 is MERGED** (BX11 → fsn1 S3); **BX11 is retained ONLY transitionally** — until a
cold-start drill passes — then **cancelled**. The head-to-head below records *why* S3 won over keeping
the BX11 Storage Box; it is settled, not open.

BX11 (`u613941.your-storagebox.de`) was the existing Hetzner Storage Box and an obvious "dedicated
off-cluster storage target", but **PR #283 (now MERGE) migrates the `restic-buildops` /
`restic-surreal` / `restic-app` repos BX11 → fsn1 S3 and retires BX11.** The store decision *is* that
#283 verdict: **adopt S3**. The rejected alternative is recorded for the audit trail:

- **Rejected — keep & repurpose BX11** as the single family-jewels store (restic-only). Rejected because
  5/11 jewels have no good Storage-Box mechanism (below) and it splits DR across two stores.
- **CHOSEN — Hetzner S3 (fsn1)** as the single family-jewels store (already the cluster DR target),
  single-region, object-lock + versioning on.

Head-to-head, for the **complete** family-jewels role (J1–J11), reusing the `restormel-backup` skill
facts (shared rclone `storagebox` remote, shared restic passphrase `/root/.config/restic-password`,
`restic-surreal` + `restic-buildops` repos, retention `--keep-daily 7 --keep-weekly 4 --keep-monthly
6`, the Phase-8 restore drill):

| Criterion | BX11 Storage Box (rejected) | Hetzner S3 fsn1 (CHOSEN) |
|-----------|-----------------------------|-----------------------------|
| **restic** (J1,J4,J5,J9,J10,J11) | ✅ proven today via rclone (WebDAV/SFTP) — `restic-buildops`+`restic-surreal` live | ✅ native `s3:` backend — the `surreal-k3s` job + #283's restore drills already prove it |
| **CNPG Barman** (J3,J6,J7,J8) | ❌ **no native Barman support** — would have to re-route PG through restic, abandoning the live Barman+WAL lane | ✅ Barman's native target — `backups-fsn1` ObjectStore is **already running** with WAL/PITR |
| **Registry mirror** (J2) | ❌ filesystem/SFTP only — no S3 registry driver, `skopeo` can't sync to a Storage Box natively | ✅ first-class S3 registry storage driver + `skopeo sync` target |
| **etcd snapshot ship** (J10) | ⚠️ only via restic/rclone (no native K3s target) | ✅ native K3s `--etcd-s3` (creds already in Infisical `infrastructure`) |
| **Capacity** for repos+registry+Infisical+all PG+Surreal+etcd | ✅ BX11 tiers go large & flat-priced | ✅ base tier ~1 TB; estate is tens of GB (measure J2) |
| **Immutability** (object-lock/versioning, ransomware) | ❌ none (a leaked SFTP/restic cred can `forget`/delete) | ✅ S3 object-lock + versioning available |
| **Multi-writer isolation** | ⚠️ single share, shared remote+passphrase → blast-radius if creds leak | ✅ per-prefix, per-credential isolation |
| **EU sovereignty** | ✅ Falkenstein/Nürnberg (DE) | ✅ `fsn1` = Falkenstein (DE) |
| **Dead-man's-switch** | ✅ reuses the live Uptime-Kuma push + Telegram pattern | ✅ same pattern; cluster jobs also use `HEARTBEAT_PING_URL` |
| **Already the cluster DR target** | ❌ only the legacy `.150`/`.167` restic lane | ✅ CNPG Barman + Surreal restic + Loki **all here today** |
| **Cost** (see §3e) | fixed ~€3.45/mo (BX11-class), flat | base ~€5.99/mo incl. ~1 TB; marginal ≈€0 (bucket already paid) |

**Decision: Hetzner S3 (fsn1) is the single family-jewels store; PR #283 MERGES.** Decisive reasons:
**(1)** five of the eleven jewels (J3, J6, J7, J8 via Barman; J2 via the registry driver) have **no good
Storage-Box mechanism** — keeping BX11 would force CNPG off its live Barman+WAL/PITR lane and leave the
registry without an image-aware mirror. **(2)** S3 is **already the proven DR target** for the cluster
jewels (CNPG/Surreal/Loki) — keeping BX11 would split DR across two stores, the opposite of "one store
holds everything." **(3)** object-lock + versioning give ransomware resilience BX11 can't. **(4)**
marginal cost is ≈€0 (the bucket is already paid for the cluster lanes); the saving comes from killing
`.150` compute, not from the store. **(5)** S3 is **off-cluster / external** (§ intro, §4) — so it stays
a valid independent recovery medium even after Forgejo+Infisical move on-cluster.

**PR #283 — MERGE.** It is the *beginning* of the consolidation, not the whole of it. Its own gates are
adopted as **Stage B preconditions** (§5B), in order: **deploy the dual-write scripts → one clean
S3-only backup cycle (`restic check`) → restore-drill PASS on S3 → only THEN set `BACKUP_BX11=0` and
cancel BX11.** **BX11 stays alive as a transitional second copy until the Stage C cold-start drill
passes** — it is *not* cancelled before then, and *not* kept permanently after (single-region is the
settled end state). Resolve #283's two findings: **`restic-surreal` is frozen** (no snaps since
2026-06-17 — the old `.167` Surreal source migrated to the cluster; the live Surreal jewel J9 is now the
**in-cluster** `data/surreal-backup` job, so retire the BX11 `restic-surreal` repo) and **`restic-app`**
(the old `.167` app DB) — confirm it is superseded by CNPG `pg-restormel` (J6) before dropping it.

**Single-region — accepted (no permanent second copy).** The settled store is **one region (`fsn1`),
one provider**, mitigated by **object-lock + versioning** (a leaked credential cannot silently delete
history) rather than by a second store. BX11-as-transitional-second-copy covers the migration window
only; once the cold-start drill passes, single-region is the deliberate end state.

Use **one bucket family, per-jewel prefixes** under fsn1:
`restormel-cnpg-backups-fsn1/` (exists), `restormel-restic-backups/{surreal-k3s, forgejo, infisical,
etcd}` (extend the existing restic bucket), `restormel-registry-mirror-fsn1/` (new, for J2),
`restormel-loki-logs-fsn1/` (exists).

### 3b. Per-jewel backup mechanism

| Jewel | Mechanism | Destination | Cadence |
|-------|-----------|-------------|---------|
| J1 Forgejo repos | restic of the Forgejo data volume **OR**, post-on-cluster-move, `forgejo dump` → restic | `restic-backups/forgejo` | daily |
| J2 Registry blobs | **`skopeo`/`oras` mirror of ALL images** into S3 (decided) — every tag of every repo, incl. Sophia once moved onto the Forgejo registry | `restormel-registry-mirror-fsn1/` | daily (after each image push ideally) |
| J3 Forgejo PG | CNPG Barman (once on-cluster) **or** `pg_dump -Fc` → restic | Barman `cnpg-backups-fsn1` | daily + WAL |
| J4 Infisical secrets | `pg_dump -Fc infisical` → restic (DB holds ciphertext) | `restic-backups/infisical` | daily |
| J5 Infisical master key | restic of config / a sealed copy of `ENCRYPTION_KEY`+`AUTH_SECRET` | `restic-backups/infisical` (or sealed escrow) | on change |
| J6–J8 CNPG PG | Barman-Cloud plugin (live) | `cnpg-backups-fsn1` | daily + WAL (live) |
| J9 Surreal | restic (live) | `restic-backups/surreal-k3s` | hourly (live) |
| J10 etcd | **native K3s `--etcd-s3`** (decided) shipping snapshots to S3 — `K3S_ETCD_*` creds already in Infisical `infrastructure` | native etcd-s3 prefix in the fsn1 store | per K3s snapshot schedule (e.g. every 6 h) |
| J11 PVCs (opt) | restic of mounted PVC data | `restic-backups/pvc` | daily |

**On the J5 / Infisical bootstrap-key sensitivity.** J4 ciphertext is useless without J5. Today J5 is
captured inside the `.150` restic volume. When Infisical moves on-cluster, its `ENCRYPTION_KEY` /
`AUTH_SECRET` must be backed up to the store too — but those *are* the secret-store master keys, so
they cannot circularly live only inside Infisical. **Recommendation:** keep a **sealed escrow copy**
of the Infisical master key (e.g. an `age`/GPG-encrypted blob in the store whose private key the
founder holds offline, or a sealed-secrets controller key held offline). Never printed; key names
only. This is the one secret that must exist *outside* the system it protects.

### 3c. Encryption, retention, immutability

- **Encryption + immutability (decided).** restic repos are client-side encrypted (passphrase in
  `/root/.config/restic-password` / cluster `Secret`); CNPG Barman objects are gzip (rely on
  bucket-level + transport TLS). **S3 object-lock + versioning are ENABLED** on the jewels bucket (the
  settled single-region mitigation) so a compromised credential can't silently delete history
  (ransomware resilience); enable **SSE** on the bucket too.
- **Retention (proposed, mirrors existing):** restic `--keep-daily 7 --keep-weekly 4 --keep-monthly
  6` (≈6 months); CNPG Barman `30d` (live); etcd keep ~14 daily + 8 weekly; registry mirror = match
  tags in use + last 30 days of historical tags.
- **Dead-man's-switch.** Extend the existing pattern: every new backup job pings the heartbeat
  (`HEARTBEAT_PING_URL`) / an Uptime Kuma push monitor on success; Telegram on failure. A *missing*
  Forgejo/Infisical/etcd backup must page, exactly like the `.150` job does today.

### 3d. AUTOMATED restore-DRILL (the mitigation that licenses the on-cluster move)

This is the **automated, tested** half of the DR mitigation the founder requires before `.150` can go.
It proves cold-start recoverability **continuously and WITHOUT a real outage**. Two tiers run:
this **periodic per-jewel drill** (§3d, automated CronJob) and the **whole-sequence cold-start drill**
(§4, founder-gated, into a throwaway cluster). The per-jewel drill is what keeps the safety net honest
between cold-start drills; a red drill **blocks** any further `.150` decommission step.

**What it is.** A scheduled in-cluster **CronJob `monitoring/dr-restore-drill`** (proposed **weekly**)
that restores every jewel from the S3 store into a **throwaway scratch namespace** (`dr-drill-<ts>`),
validates each restore, reports PASS/FAIL, and **tears the scratch namespace down** — never touching any
prod namespace, DNS, or live data. It generalises today's `buildops-restore-drill.sh` (which only
row-counts the app DB) to the whole jewel set.

**Per-run sequence (all in the scratch namespace, fully isolated):**

1. **Forgejo (J1+J2+J3).** `pg_restore` the latest `forgejo.dump` into a scratch Postgres; restore one
   sample repo from the restic `forgejo` prefix and `git fsck` it; **pull one sample image** from the
   S3 registry mirror (`skopeo inspect` / a scratch `docker pull`) to prove J2 blobs are intact and
   pullable. Validate: row counts in the Forgejo DB > last-known floor, repo HEAD resolves, image
   manifest + at least one layer fetch succeeds.
2. **Infisical (J4+J5) — the decisive check.** `pg_restore infisical.dump` into a scratch Postgres,
   stand up a scratch Infisical, inject the **escrowed J5 master key** (`ENCRYPTION_KEY`/`AUTH_SECRET`
   — pulled from the sealed escrow object, never logged), and **confirm a known canary secret decrypts**
   to its expected value. This is the single most important assertion: it proves J4 ciphertext + J5 key
   are *both* restorable and *together* usable. (Without this, a "successful" Infisical DB restore is a
   bag of undecryptable bytes.)
3. **A database (J6/J7/J8).** Drive a CNPG **`bootstrap.recovery`** of one cluster (rotate which one
   each week) from the Barman ObjectStore into a scratch CNPG cluster; validate it reaches
   `Cluster in healthy state` and row counts clear the floor. Cheap PITR sanity, not a full restore of
   all three every week.
4. **etcd (J10).** Load the newest `--etcd-s3` snapshot into a throwaway single-node etcd / `k3s server
   --cluster-reset-restore-path` dry-run in a sandbox and verify it loads and lists expected keys.
5. **Registry sample (J2).** Covered in step 1 — an explicit pull from the mirror, because the registry
   is on the cold-start critical path and is the easiest jewel to *think* is backed when it isn't.

**Report + alert on failure (required).** Each run emits a structured PASS/FAIL line per jewel +
row-counts/RTO to the job log, **pings the dead-man's-switch / Uptime-Kuma push monitor on full PASS**,
and **fires Telegram (and pages) on ANY FAIL or on a missed run** — exactly the alerting pattern the
`.150` backup job uses today. A missed drill is treated as a failure (the DMS catches silence). File
each result to `evidence/` (posture-style) so the drill history is auditable. **A red drill is a STOP
on every downstream `.150` decommission stage (§5 C/D/E).**

**Why a scratch namespace + teardown.** Restoring into `dr-drill-<ts>` (and a temp etcd sandbox) keeps
the drill **non-destructive and repeatable**: no prod namespace, no real DNS, no live PVC is ever
touched, and the namespace is deleted at the end so the drill itself costs ≈nothing to run weekly.

**This per-jewel drill is what licenses the on-cluster move; the §4 whole-sequence cold-start drill is
the gate that licenses deleting `.150`.** (Full cold-start sequence in §4.)

### 3e. Cost — storage target vs a `cx33` compute standby (the saving)

Order-of-magnitude (Hetzner public pricing; founder to confirm exact invoice):

- **A `cx33` standby box** ≈ **€6.49/mo (~£5.6/mo)** of *pure standby compute* — what we want to stop
  paying. `.150` is roughly this. (The infra budget is £57/mo, currently ~£50.65.)
- **Hetzner S3 Object Storage:** base allocation ~€5.99/mo includes ~1 TB stored + ~1 TB egress, then
  per-GB over. The family jewels are **DB dumps + git + registry blobs**, plausibly **tens of GB**
  (CNPG PVCs are 10 Gi each; Surreal dump ~0.6 GB; registry is the wild card — measure J2 first).
  This comfortably fits the base tier. The **CNPG/Surreal/Loki lanes already pay for this bucket** —
  consolidating Forgejo/Infisical/etcd onto it is **near-zero marginal cost**.
- **Net:** removing the `.150` standby compute saves ≈**£5–6/mo** with **no new storage line item**
  (reuse the existing fsn1 bucket). The saving is modest in absolute terms but the *real* win is
  eliminating a single-box DR dependency and getting **whole-estate, one-store recoverability**. If a
  dedicated Storage Box were chosen instead, a BX11-class box is ~€3.45/mo — still under the saving,
  but loses the Barman/registry/object-lock advantages above.

**Measure J2 (registry blob size) before committing** — it is the only variable that could push
storage past the base tier.

---

## 4. Cold-start DR runbook (cluster is gone → fully restored)

Goal: from "the K3s cluster and `.150` no longer exist" to "estate live", using **only the off-cluster
fsn1 S3 store + founder-held escrow** — nothing that died with the cluster. This is the real cold-start
sequence the §3d drill rehearses continuously. **Dependency order is strict:** secrets → registry →
GitOps source → cluster → data → apps. Each arrow is a hard prerequisite — a later step physically
cannot complete until the earlier one is up (ESO can't sync without Infisical; pods can't pull without
the registry; Argo can't rebuild without the Forgejo repo).

**Pre-reqs in hand (off-cluster, founder-held):** Hetzner account + `HCLOUD_TOKEN`; the **restic
passphrase**; the **Infisical master key escrow** (J5); the **S3 access creds** for the store; this
runbook.

**Step 0 — Provision a fresh host/cluster + recover etcd from S3.** New Hetzner node(s); install K3s
(single-node first is fine for bootstrap). Because etcd now ships to S3 via native `--etcd-s3` (J10,
decided), pull the newest snapshot from the store and `k3s server --cluster-reset
--cluster-reset-restore-path=<etcd-snapshot-from-S3>` to recover cluster objects (CRDs, non-GitOps
secrets, app-of-apps state) in one shot. (Fallback if a snapshot is somehow unusable: start clean and
rebuild from GitOps — slower; see Step 5.) **Dependency:** none — this is the root step.

**Step 1 — Restore Infisical (the root of trust) FIRST.** *Depends on: Step 0.* Nothing else can get
its secrets until Infisical is back. Stand up Infisical (on the fresh host, or a temporary container),
restore J4 (`pg_restore infisical.dump`), inject J5 (`ENCRYPTION_KEY`/`AUTH_SECRET` from escrow). Verify
a known secret decrypts (the J4+J5 check the §3d drill runs continuously). Point `secrets.restormel.dev`
DNS at the new Infisical.

**Step 2 — Restore Forgejo (GitOps source + registry).** *Depends on: Step 0 (etcd helps but isn't
required); independent of Step 1 — can run in parallel, but ESO in Step 3 needs Step 1 done.* Restore J3
(`pg_restore forgejo.dump`), J1 (git repos / `forgejo restore`), and **J2 — pull the registry blobs back
from the S3 `skopeo`/`oras` mirror** so every image (incl. Sophia, now on the Forgejo registry) is
pullable. Verify `git.allotmentology.tech` serves repos and `registry.allotmentology.tech` serves a test
pull. Point DNS at the new Forgejo.

**Step 3 — Re-point ESO + Argo at the restored backbone.** *Depends on: Step 1 (ESO needs Infisical) +
Step 2 (Argo needs the Forgejo repo).* Recreate the ESO machine-identity secret
(`external-secrets/infisical-machine-identity`) from escrow/Infisical; the 5 `ClusterSecretStore`s
become `Valid` again. Install ArgoCD; point the app-of-apps at the restored Forgejo repo. (If Step 0
restored etcd, much of this returns automatically — **verify rather than recreate**.)

**Step 4 — Let Argo rebuild the platform.** *Depends on: Step 3.* Argo syncs cluster-addons (CNPG
operator, ESO, cert-manager, ingress, the Barman ObjectStore CR). Pods now pull images from the
**restored registry** (Step 2 is why this works). ESO materialises all secrets from the **restored
Infisical** (Step 1 is why *this* works).

**Step 5 — Restore the data tier.** *Depends on: Step 4 (CNPG operator + Barman ObjectStore CR present).*
Recreate CNPG clusters with `bootstrap.recovery` pointing at the Barman ObjectStore `backups-fsn1`
(J6–J8 — point-in-time to the last WAL). Restore Surreal (J9) from its restic repo into `data/surreal-0`.
Verify row counts against the last-known-good.

**Step 6 — Bring up apps + validate.** *Depends on: Step 5.* Argo syncs `allotmentology-prod`,
`restormel-prod`, `sophia`, `supabase`. Validate: ingress serves; `restormel.dev` 200; PlotBudget API;
Sophia; CNPG `Cluster in healthy state`; ESO stores `Valid`; a fresh Forgejo push triggers CI →
registry → Argo round-trip. Re-point public DNS to the new ingress.

**Dependency graph (must hold):** Infisical (1) → Forgejo+registry (2) → ESO+Argo (3) → platform (4)
→ data (5) → apps (6). Restoring etcd (Step 0) short-circuits 3–4 but **not** 1–2 (Infisical/Forgejo
are off the cluster's etcd by design) — so 1 and 2 are always on the critical path. **This is the
exact reason J1–J5 must be in the store and drilled.**

**How to TEST it without a real outage (the standing whole-sequence drill).** Quarterly
(founder-gated): provision a **throwaway** single-node K3s on a temp Hetzner box, run Steps 0–6 against
the off-cluster store into that temp cluster (scratch DNS names, **never touching prod / real DNS**),
validate row counts + a registry pull + secret decrypt + apps-up, record the wall-clock RTO, then
**destroy the temp box**. File the result as an `evidence/` posture/incident-style record.

**Two drill tiers, one mitigation.** The **weekly automated per-jewel drill (§3d)** keeps each jewel's
restore honest continuously (and alerts on any FAIL/missed run); this **quarterly whole-sequence drill**
proves the *ordered cold-start* end-to-end. Together they are the "automated, tested DR runbook" that
mitigates the on-cluster bootstrap risk and licenses full `.150` decommission. The first quarterly drill
passing is **Stage C** (§5) — the gate before anything is deleted.

---

## 5. `.150` FULL-decommission sequence (settled, ordered)

`.150` is **fully decommissioned** (the founder's settled decision — *not* kept as an off-cluster seed),
once the on-cluster backbone + comprehensive S3 backups + a PASSED automated cold-start drill are in
place. Each stage gated on the previous **passing**. 🚩 = founder-gated. 🔒 = irreversible. The order is
fixed: **A migrate on-cluster → B comprehensive S3 backups → C run+PASS the automated cold-start drill →
D delete `.150` standbys → cancel BX11 → E decommission `.150`.**

> **Sequencing note.** Stage B's *backbone coverage* (J1–J5 restorable from S3) must land **with or
> before** the Stage A on-cluster flip — never delete or cut the `.150` originals until the store holds a
> drilled, restorable copy. In practice A and B are co-staged (build the on-cluster CNPG/PVC + the
> cluster backup CronJobs together); the irreversible cut of the `.150`-resident Forgejo/Infisical is the
> *end* of A, gated on B coverage being live and the §3d drill green.

**Stage A — Migrate Forgejo + Infisical ON-CLUSTER (HA placement).** 🚩 — **requires
`restormel-high-risk-security` review before the PR** (touches keys / secrets / registry / Postgres).
Migrate Forgejo (DB → a CNPG cluster `pg-forgejo` so it free-rides Barman→S3; registry → a PVC + the
registry mirror job; repos → PVC) and Infisical (DB → CNPG; app on-cluster) onto K3s with HA replica
placement and anti-affinity. **The off-cluster S3 store is the safety net that makes this acceptable:**
before the irreversible cut, J1–J5 must already be restorable from the store (Stage B coverage) —
otherwise this *creates* the F8 circular dependency. *Accepted residual risk:* a true total-region loss
now takes Forgejo+Infisical down *with* the cluster, so cold start depends on the off-cluster store + the
drilled runbook (§4) — the deliberate trade the founder has accepted (§6). The `.150`-resident copies are
**not** deleted here; they are retired in Stage D/E after the drill passes.

**Stage B — Stand up COMPREHENSIVE S3 backups (all jewels + registry mirror + `--etcd-s3` + object-lock).**
🚩 (the etcd-S3 + object-lock changes are cluster/bucket config)
**Land PR #283 first** — in its gate order: deploy the dual-write scripts → one clean S3-only cycle
(`restic check`) → restore-drill PASS on S3 → set `BACKUP_BX11=0` *is deferred to Stage E*. Then wire the
full jewel coverage onto fsn1 S3: **native `--etcd-s3` (J10)**, the **`skopeo`/`oras` registry mirror
of ALL images (J2)** incl. Sophia once moved onto the Forgejo registry, **Forgejo/Infisical cluster
CronJobs (J1,J3,J4,J5)**, optional PVCs (J11), the **J5 sealed escrow object**, and **enable S3
object-lock + versioning** on the jewels bucket. Confirm CNPG/Surreal lanes still green. Every job on the
dead-man's-switch; the **§3d automated per-jewel drill CronJob is deployed and green** here. Confirm
`restic check` / Barman list clean on every prefix. **Keep BX11 as a transitional second copy through
Stages B–C** — do *not* cancel it yet.

**Stage C — Run + PASS the automated cold-start drill.** 🚩
Execute §4 Steps 0–6 into a **throwaway** temp cluster from the off-cluster store alone. Must PASS
end-to-end (Forgejo serves, registry pulls, Infisical decrypts, CNPG+Surreal restore, apps come up)
**before** anything is deleted. Record RTO. File evidence. **This is the gate that proves the safety net
is real** — and the precondition for every irreversible step below. (The §3d weekly drill must also be
green; a red drill is a STOP.)

**Stage D — Delete the redundant `.150` standbys, then cancel BX11.** 🚩 🔒 **irreversible**
Only after C passes: remove the redundant standby services on `.150` (old Coolify standbys / dead prod
UUIDs). Then **cancel BX11** — complete PR #283's final step (`BACKUP_BX11=0`), confirm one more clean
S3-only cycle + `restic check`, and **cancel the Storage Box** (single-region S3 is the settled end
state; no permanent second copy). Keep the `.150` *primary backup cron* running until Stage E so there is
still a live producer until the box itself goes.

**Stage E — Decommission `.150`.** 🚩 🔒 **irreversible**
Confirm nothing live depends on `.150` (no DNS, no registry pull, no ESO host pointing at it — they now
point on-cluster). Stop the `.150` restic cron last. **Then delete the `.150` box.** The fsn1 bucket(s)
are now the **sole** store; confirm lifecycle / object-lock / versioning / retention + DMS coverage.
Update governance via the `restormel-isms-records` skill: `governance/asset-inventory.yaml` +
`suppliers.yaml` (remove `.150` and BX11; confirm Hetzner Object Storage `fsn1` as the DR sub-processor)
and `risk-register.yaml` (close the standby-compute risk; record the accepted "single-region store +
on-cluster bootstrap" residual risk, mitigated by object-lock + the automated/quarterly drills).

**Ordering invariant:** never delete `.150` (E) or cancel BX11 (D) before a cold-start drill passes (C);
never run the drill (C) before the comprehensive backups exist (B); never make the on-cluster cut (end of
A) before the store can restore J1–J5 (B coverage). **J1–J5 must be restorable from the off-cluster store
before any on-cluster cut is irreversible** — co-stage A and B so the backbone's store coverage lands
*with or before* the flip.

---

## 6. SETTLED decisions (founder, final)

All six decisions below are **settled**. This section is the locked record; the rest of the plan is
written to these. Nothing here is open.

1. **Store = Hetzner S3 (fsn1), SINGLE region, with object-lock + versioning.** (Headline — see §3a.)
   The single family-jewels store is Hetzner Object Storage (S3, `fsn1`), **one region**, with
   **object-lock + versioning enabled**. No cross-region replica, no permanent second copy. Chosen over
   keeping BX11 because 5/11 jewels (CNPG via Barman, registry via the S3 driver) have no good
   Storage-Box mechanism, S3 is already the proven cluster DR target, object-lock adds ransomware
   resilience, and S3 is **off-cluster/external** so it stays a valid recovery medium even with the
   backbone on-cluster.

2. **PR #283 = MERGE** (start the BX11 → S3 consolidation), with gates in order:
   **deploy scripts → one clean S3-only backup cycle (`restic check`) → restore-drill PASS → only THEN
   `BACKUP_BX11=0` and cancel BX11.** BX11 is kept ONLY transitionally — until the Stage C cold-start
   drill passes — then cancelled (single-region is the end state). Resolve #283's two findings as part of
   the merge: retire the **frozen `restic-surreal`** repo (source moved on-cluster → J9 is now the
   in-cluster `data/surreal-backup` job) and confirm **`restic-app`** is superseded by CNPG
   `pg-restormel` (J6) before dropping it.

3. **Provider/region concentration — single-region accepted.** No permanent second copy. The mitigation
   is **object-lock + versioning** (a leaked credential cannot silently delete history), **not** a second
   store. BX11-as-transitional-second-copy covers the migration window only; after the cold-start drill
   passes, single-region `fsn1` is the deliberate, accepted end state.

4. **Forgejo + Infisical = migrate ON-CLUSTER (HA placement).** `.150` goes for cost. The founder
   **explicitly accepts the on-cluster bootstrap risk BECAUSE** the off-cluster S3 store + an
   **automated, tested DR runbook** (the §3d weekly per-jewel drill + the §4 quarterly whole-sequence
   cold-start drill) are the mitigation. The flip is irreversible **only after Stage C passes** (§5).
   Stage A **requires a `restormel-high-risk-security` review** (keys/secrets/registry/Postgres).

5. **Registry = `skopeo`/`oras` mirror of ALL images into S3 + STANDARDISE every image onto the Forgejo
   registry.** A mirror job into a dedicated S3 prefix (restartable, image-aware) over a volume tar; and
   **every image standardised onto the Forgejo registry** — including **Sophia's, currently on
   `ghcr.io` → moved to `git.allotmentology.tech`** — so cold start has a **single image source**.

6. **etcd = native K3s `--etcd-s3`** shipping snapshots to the S3 store (J10 — the headline gap; today
   local-only). Creds (`K3S_ETCD_*`) already exist in the Infisical `infrastructure` project. Plus
   **object-lock + versioning ON** for the jewels bucket (folded into Decision 1) — confirmed.

**`.150` decommission = FULL** (not a seed host): once the on-cluster backbone + comprehensive S3
backups + a PASSED cold-start drill are in place (§5 A→E), `.150` is deleted outright and BX11 cancelled.

### Saving

Removing the `.150` standby compute saves **≈£5–6/mo** — a **cx33-class box** (~€6.49/mo). The store is
**≈€0 marginal storage**: the fsn1 bucket is already paid for the cluster CNPG/Surreal/Loki lanes, so
consolidating Forgejo/Infisical/etcd/registry onto it adds near-nothing (measure J2 registry size to
confirm it stays inside the base tier — §3e). The real win is whole-estate, one-store recoverability and
killing the single-box DR dependency, not the £.

---

## Appendix — provenance

All §0 findings verified live on 2026-06-24 (`KUBECONFIG=/private/tmp/k3s-create/kubeconfig`): CNPG
clusters + ObjectStore `backups-fsn1`, `data/surreal-backup` CronJob, Loki S3 config, 49 local-only
`ETCDSnapshotFile` CRs, 5 Infisical `ClusterSecretStore`s, live image refs to
`git.allotmentology.tech`. Repo: `scripts/backup/buildops-backup.sh` (Forgejo volume + Infisical
coverage), `restormel-backup` skill, Forgejo PR #283 (BX11→fsn1 S3 restic migration, open). Memory:
`infra-direction-2026-06-23`, `k3s-migration-program`, `database-strategy`, `coolify-migration`,
`prod-box-disk-guard`.
