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

**The bootstrap tension (and why the store resolves it).** Forgejo (GitOps source-of-truth +
container registry every K3s image pulls from) and Infisical (the ESO secret backend every cluster
secret syncs from) are the cold-start backbone. Putting them *on* the very cluster they bootstrap is
the classic circular-dependency / "F8" anti-pattern: if the cluster is gone you cannot reach the
thing you need to rebuild it. The founder leans toward **moving them on-cluster** anyway, with the
**off-cluster store as the safety net**. That is viable *only if* the store genuinely holds a
restorable copy of Forgejo (repos + registry blobs + DB) and Infisical (secrets + DB), and we have a
**tested cold-start drill** that rebuilds them onto a fresh host from that store alone. This plan
designs for the on-cluster choice but names the residual risk honestly (§6).

This is a **planning/design record only.** Nothing here changes infra, backups, or DNS. Every
build/irreversible step is founder-gated and flagged.

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
--keep-monthly 6`). **PR #283** (open, DO-NOT-MERGE) migrates this restic lane BX11 → **fsn1 S3**
(`restormel-restic-backups/...`), additive, dual-write, restore-drill PASS, not yet deployed to the
box — and **would RETIRE BX11** once cut over. The store choice (§3a) therefore collides directly with
#283.

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

**Sophia image caveat:** Sophia currently pulls `ghcr.io/allotment-technology-ltd/sophia:<sha>`
(GitHub-hosted, external). It is reproducible from its own repo's CI, so it is not a J2 blob today —
but note for cold start that *one* app's images are not in the Forgejo registry (decision point in
§6: standardise all images into the Forgejo registry, or accept GHCR as a second pull source).

---

## 2. Gap analysis — what is NOT yet safely off-cluster in ONE store

Ordered by cold-start criticality.

1. **K3s etcd snapshots → off-box (J10).** *Highest-impact gap.* Local-only today. A region/cluster
   loss loses every cluster object that isn't in Git or regenerable: hand-applied secrets, CRD
   instances, the ArgoCD app-of-apps state, anything not yet GitOps-managed. Restoring etcd is the
   fastest path back; rebuilding purely from GitOps is slower and assumes 100% of state is in Git
   (it is not — bootstrap secrets, the ESO machine-identity, etc.). **Fix:** enable K3s `--etcd-s3`
   to fsn1 (`K3S_ETCD_*` creds already in Infisical) OR a CronJob that ships the newest snapshot to
   S3. Cheap, additive, no app impact.

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

### 3a. HEADLINE DECISION — the family-jewels store: HOLD-and-repurpose-BX11 vs MERGE-#283-and-use-S3

This is **the** central decision, because it collides with an open PR. BX11
(`u613941.your-storagebox.de`) is the existing Hetzner Storage Box and the obvious "dedicated
off-cluster storage target" — but **open PR #283 would RETIRE it** (migrate the `restic-buildops` /
`restic-surreal` / `restic-app` repos BX11 → fsn1 S3, so BX11 can be cancelled). So the store choice
*is* the PR #283 verdict:

- **Option A — HOLD #283, keep & repurpose BX11** as the single family-jewels store (restic-only).
- **Option B — MERGE #283, use Hetzner S3 (fsn1)** as the single family-jewels store (already the
  cluster DR target).

Head-to-head, for the **complete** family-jewels role (J1–J11), reusing the `restormel-backup` skill
facts (shared rclone `storagebox` remote, shared restic passphrase `/root/.config/restic-password`,
`restic-surreal` + `restic-buildops` repos, retention `--keep-daily 7 --keep-weekly 4 --keep-monthly
6`, the Phase-8 restore drill):

| Criterion | BX11 Storage Box (Option A) | Hetzner S3 fsn1 (Option B) |
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

**Recommendation: Option B — MERGE #283 (after its own review) and make Hetzner S3 (fsn1) the single
family-jewels store.** Decisive reasons: **(1)** five of the eleven jewels (J3, J6, J7, J8 via Barman;
J2 via the registry driver) have **no good Storage-Box mechanism** — keeping BX11 would force CNPG off
its live Barman+WAL/PITR lane and leave the registry without an image-aware mirror. **(2)** S3 is
**already the proven DR target** for the cluster jewels (CNPG/Surreal/Loki) — Option A would split DR
across two stores, the opposite of "one store holds everything." **(3)** object-lock gives ransomware
resilience BX11 can't. **(4)** marginal cost is ≈€0 (the bucket is already paid for the cluster lanes);
the saving comes from killing `.150` compute, not from the store.

**PR #283 verdict:** **proceed toward MERGE** (it is the right direction for the store) — but it is the
*beginning* of the consolidation, not the whole of it. Before BX11 is actually cancelled, treat #283's
own gates (deploy the dual-write scripts, one clean S3-only cycle + `restic check` + restore-drill
PASS on S3, then `BACKUP_BX11=0`) as **Stage B preconditions** (§5B), and **keep BX11 alive as a
belt-and-braces second copy until a cold-start drill (Stage C) passes**. Resolve #283's two findings:
**`restic-surreal` is frozen** (no snaps since 2026-06-17 — the old `.167` Surreal source migrated to
the cluster; the live Surreal jewel J9 is now the **in-cluster** `data/surreal-backup` job, so retire
the BX11 `restic-surreal` repo) and **`restic-app`** (the old `.167` app DB) — confirm it is
superseded by CNPG `pg-restormel` (J6) before dropping it. *Net:* MERGE-#283-and-use-S3, with BX11
retained as a transitional second copy, not cancelled until Stage C passes.

*Caveat (not a blocker):* Option B concentrates all DR in one Hetzner region (`fsn1`) on one provider.
BX11 retained-as-second-copy through the transition mitigates this; a longer-term option is a
cross-region S3 replica or keeping a downsized Storage Box purely as an independent second target.
Flagged in §6.

Use **one bucket family, per-jewel prefixes** under fsn1:
`restormel-cnpg-backups-fsn1/` (exists), `restormel-restic-backups/{surreal-k3s, forgejo, infisical,
etcd}` (extend the existing restic bucket), `restormel-registry-mirror-fsn1/` (new, for J2),
`restormel-loki-logs-fsn1/` (exists).

### 3b. Per-jewel backup mechanism

| Jewel | Mechanism | Destination | Cadence |
|-------|-----------|-------------|---------|
| J1 Forgejo repos | restic of the Forgejo data volume **OR**, post-on-cluster-move, `forgejo dump` → restic | `restic-backups/forgejo` | daily |
| J2 Registry blobs | **`skopeo sync` / registry mirror** of every tag, OR restic of `data/packages` | `restormel-registry-mirror-fsn1/` | daily (after each image push ideally) |
| J3 Forgejo PG | CNPG Barman (once on-cluster) **or** `pg_dump -Fc` → restic | Barman `cnpg-backups-fsn1` | daily + WAL |
| J4 Infisical secrets | `pg_dump -Fc infisical` → restic (DB holds ciphertext) | `restic-backups/infisical` | daily |
| J5 Infisical master key | restic of config / a sealed copy of `ENCRYPTION_KEY`+`AUTH_SECRET` | `restic-backups/infisical` (or sealed escrow) | on change |
| J6–J8 CNPG PG | Barman-Cloud plugin (live) | `cnpg-backups-fsn1` | daily + WAL (live) |
| J9 Surreal | restic (live) | `restic-backups/surreal-k3s` | hourly (live) |
| J10 etcd | K3s `--etcd-s3` **or** ship-newest-snapshot CronJob | `restic-backups/etcd` (or native etcd-s3 prefix) | hourly/daily |
| J11 PVCs (opt) | restic of mounted PVC data | `restic-backups/pvc` | daily |

**On the J5 / Infisical bootstrap-key sensitivity.** J4 ciphertext is useless without J5. Today J5 is
captured inside the `.150` restic volume. When Infisical moves on-cluster, its `ENCRYPTION_KEY` /
`AUTH_SECRET` must be backed up to the store too — but those *are* the secret-store master keys, so
they cannot circularly live only inside Infisical. **Recommendation:** keep a **sealed escrow copy**
of the Infisical master key (e.g. an `age`/GPG-encrypted blob in the store whose private key the
founder holds offline, or a sealed-secrets controller key held offline). Never printed; key names
only. This is the one secret that must exist *outside* the system it protects.

### 3c. Encryption, retention, immutability

- **Encryption.** restic repos are client-side encrypted (passphrase in
  `/root/.config/restic-password` / cluster `Secret`); CNPG Barman objects are gzip (rely on
  bucket-level + transport TLS). Recommend enabling **SSE** on the bucket and **S3 object-lock /
  versioning** so a compromised credential can't silently delete history (ransomware resilience).
- **Retention (proposed, mirrors existing):** restic `--keep-daily 7 --keep-weekly 4 --keep-monthly
  6` (≈6 months); CNPG Barman `30d` (live); etcd keep ~14 daily + 8 weekly; registry mirror = match
  tags in use + last 30 days of historical tags.
- **Dead-man's-switch.** Extend the existing pattern: every new backup job pings the heartbeat
  (`HEARTBEAT_PING_URL`) / an Uptime Kuma push monitor on success; Telegram on failure. A *missing*
  Forgejo/Infisical/etcd backup must page, exactly like the `.150` job does today.

### 3d. Restore-drill (periodic, automated)

A scheduled CronJob (weekly) that, **without touching prod**: restores the latest Forgejo PG + a
sample repo + a sample registry image into a scratch namespace/host, restores Infisical PG into a
scratch Infisical and confirms a known secret decrypts (proving J4+J5 together), restores the newest
etcd snapshot into a throwaway etcd and verifies it loads. Emits PASS/row-counts to the log + heartbeat,
like `buildops-restore-drill.sh` does for the app DB today. **This is what licenses the on-cluster
move.** (Full cold-start sequence in §4.)

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

Goal: from "the K3s cluster and `.150` no longer exist" to "estate live", using only the fsn1 store +
founder-held escrow. **Dependency order is strict:** secrets → registry → GitOps source → cluster →
data → apps.

**Pre-reqs in hand (off-cluster, founder-held):** Hetzner account + `HCLOUD_TOKEN`; the **restic
passphrase**; the **Infisical master key escrow** (J5); the **S3 access creds** for the store; this
runbook.

**Step 0 — Provision a fresh host/cluster.** New Hetzner node(s); install K3s (single-node first is
fine for bootstrap). If etcd snapshot (J10) exists in the store: `k3s server
--cluster-reset --cluster-reset-restore-path=<etcd-snapshot-from-S3>` to recover cluster objects in
one shot. If not, start clean and rebuild from GitOps (slower; see Step 5).

**Step 1 — Restore Infisical (the root of trust) FIRST.** Nothing else can get its secrets until
Infisical is back. Stand up Infisical (on the fresh host, or a temporary container), restore J4
(`pg_restore infisical.dump`), inject J5 (`ENCRYPTION_KEY`/`AUTH_SECRET` from escrow). Verify a known
secret decrypts. Point `secrets.restormel.dev` DNS at the new Infisical.

**Step 2 — Restore Forgejo (GitOps source + registry).** Restore J3 (`pg_restore forgejo.dump`),
J1 (git repos volume / `forgejo restore`), **J2 (registry blobs** — restore the mirror so images are
pullable). Verify `git.allotmentology.tech` serves repos and `registry.allotmentology.tech` serves a
test pull. Point DNS at the new Forgejo.

**Step 3 — Re-point ESO + Argo at the restored backbone.** Recreate the ESO machine-identity secret
(`external-secrets/infisical-machine-identity`) from escrow/Infisical; the 5 `ClusterSecretStore`s
become `Valid` again. Install ArgoCD; point the app-of-apps at the restored Forgejo repo. (If Step 0
restored etcd, much of this returns automatically — verify rather than recreate.)

**Step 4 — Let Argo rebuild the platform.** Argo syncs cluster-addons (CNPG operator, ESO,
cert-manager, ingress, the Barman ObjectStore CR). Pods now pull images from the **restored registry**
(Step 2 is why this works). ESO materialises all secrets from the **restored Infisical** (Step 1).

**Step 5 — Restore the data tier.** Recreate CNPG clusters with `bootstrap.recovery` pointing at the
Barman ObjectStore `backups-fsn1` (J6–J8 — point-in-time to the last WAL). Restore Surreal (J9) from
its restic repo into `data/surreal-0`. Verify row counts against the last-known-good.

**Step 6 — Bring up apps + validate.** Argo syncs `allotmentology-prod`, `restormel-prod`, `sophia`,
`supabase`. Validate: ingress `135.181.25.76` (new IP) serves; `restormel.dev` 200; PlotBudget API;
Sophia; CNPG `Cluster in healthy state`; ESO stores `Valid`; a fresh Forgejo push triggers CI →
registry → Argo round-trip. Re-point public DNS to the new ingress.

**Dependency graph (must hold):** Infisical (1) → Forgejo+registry (2) → ESO+Argo (3) → platform (4)
→ data (5) → apps (6). Restoring etcd (Step 0) short-circuits 3–4 but **not** 1–2 (Infisical/Forgejo
are off the cluster's etcd by design) — so 1 and 2 are always on the critical path. **This is the
exact reason J1–J5 must be in the store and drilled.**

**How to TEST it without a real outage (the standing drill).** Quarterly (founder-gated): provision a
**throwaway** single-node K3s on a temp Hetzner box, run Steps 0–5 against the store into that temp
cluster (scratch DNS names, never touching prod / real DNS), validate row counts + a registry pull +
secret decrypt, record the wall-clock RTO, then destroy the temp box. File the result as an
`evidence/` posture/incident-style record. The weekly automated drill (§3d) covers the per-jewel
restore; this quarterly drill covers the *whole sequence*.

---

## 5. `.150` decommission sequence (safe, ordered)

Each stage gated on the previous **passing**. 🚩 = founder-gated / irreversible.

**Stage A — Move Forgejo + Infisical onto the cluster (HA placement).** 🚩
Migrate Forgejo (DB → a CNPG cluster `pg-forgejo` so it free-rides Barman→S3; registry → a PVC + the
registry mirror job; repos → PVC) and Infisical (DB → CNPG; app on-cluster) onto K3s with HA replica
placement and anti-affinity. **The off-cluster store is the safety net that makes this acceptable:**
before flipping, J1–J5 must already be restorable from the store (Stage B) — otherwise this *creates*
the F8 circular dependency. *Residual risk (be honest):* a true total-region loss now takes
Forgejo+Infisical down *with* the cluster, so cold start depends entirely on the store + a drilled
runbook. That is the deliberate trade (see §6). **Touches keys/secrets/registry → run
`restormel-high-risk-security` before the PR.**

**Stage B — Stand up + verify the comprehensive off-cluster backups.** 🚩 (the etcd-S3 change is
cluster-config)
**Land PR #283 first** (its own deploy + one clean S3-only cycle + `restic check` + restore-drill PASS
on S3 are Stage-B preconditions) so the `.150` lane is on fsn1 S3. Then wire: etcd→S3 (J10), registry
mirror (J2), Forgejo/Infisical cluster CronJobs → fsn1 (J1,J3,J4,J5), optional PVCs (J11). Confirm
CNPG/Surreal lanes still green. Every job on the dead-man's-switch. Confirm `restic check` / Barman
list clean on every prefix. **Keep BX11 as a second copy through Stages B–C** — do not cancel it yet
(set `BACKUP_BX11=0` / cancel BX11 only at Stage E, after the cold-start drill passes).

**Stage C — Run a tested cold-start restore drill.** 🚩
Execute §4 Steps 0–6 into a **throwaway** temp cluster from the store alone. Must PASS end-to-end
(Forgejo serves, registry pulls, Infisical decrypts, CNPG+Surreal restore, apps come up) **before**
anything is deleted. Record RTO. File evidence. **This is the gate that proves the safety net is
real.**

**Stage D — Delete the redundant `.150` standbys.** 🚩 **irreversible**
Only after C passes: remove the redundant standby services on `.150` (old Coolify standbys / dead
prod UUIDs). Keep the `.150` *backups* until D is confirmed stable for a few days.

**Stage E — Decommission `.150` + finalise the storage target.** 🚩 **irreversible**
Confirm nothing live depends on `.150` (no DNS, no registry pull, no ESO host pointing at it — they
now point on-cluster). Stop the `.150` restic cron last. **Then** delete the `.150` box. Now (and only
now) **cancel BX11** if Decision 2 chose single-store — set `BACKUP_BX11=0`, complete PR #283's final
step, confirm a clean S3-only cycle, then cancel the Storage Box; **or** keep BX11 as the permanent
independent second copy if Decision 2 chose belt-and-braces. The fsn1 bucket(s) are then the primary
(or sole) store; confirm lifecycle/object-lock/retention + DMS coverage. Update
`governance/asset-inventory.yaml` + `suppliers.yaml` (remove `.150`; confirm Hetzner Object Storage as
the DR sub-processor; remove BX11 if cancelled) and `risk-register.yaml` (close the standby-compute
risk, record the "single-store + on-cluster backbone" residual risk).

**Ordering invariant:** never delete `.150` (E) before a cold-start drill passes (C); never run the
drill (C) before the comprehensive backups exist (B); never move the backbone on-cluster (A) before
the store can restore it (B preconditions). A-before-B is a chicken-and-egg only if you skip the rule
that **J1–J5 must be restorable from the store before the on-cluster flip is irreversible** —
sequence A and B so the store coverage for the backbone lands *with or before* the flip.

---

## 6. Open decisions for the founder

1. **Store + PR #283: HOLD-and-repurpose-BX11 vs MERGE-#283-and-use-S3.** (Headline — see §3a.)
   *Recommend MERGE #283 → Hetzner S3 (fsn1) as the single family-jewels store*, because 5 of 11
   jewels (CNPG via Barman, registry via the S3 driver) have no good Storage-Box mechanism, S3 is
   already the proven cluster DR target, and object-lock adds ransomware resilience. **Keep BX11 alive
   as a transitional second copy** until the Stage C cold-start drill passes; only then cancel it
   (completing #283). Also resolve #283's two findings: retire the **frozen `restic-surreal`** repo
   (source moved on-cluster → J9 is now `data/surreal-backup`) and confirm **`restic-app`** is
   superseded by CNPG `pg-restormel` (J6). **Decision needed:** confirm MERGE-#283-and-use-S3 with
   BX11-retained-until-drill (vs HOLD #283 and keep BX11 as the store).

2. **Provider/region concentration.** Option B puts all DR in one provider, one region (`fsn1`).
   *Recommend* keeping BX11 as an independent second copy through the transition; longer-term, decide
   whether to add a cross-region S3 replica (or a downsized Storage Box) as a permanent second target,
   or accept single-region with object-lock. **Decision needed:** permanent second copy yes/no.

3. **Forgejo + Infisical: on-cluster vs a minimal off-cluster seed.** Founder leans **on-cluster +
   store-as-safety-net**; this plan designs for that (§5A). **Residual risk, stated honestly:** a
   total-region loss then takes the bootstrap backbone down *with* the cluster, so recovery depends
   100% on (a) the store holding restorable J1–J5 and (b) a *drilled* cold-start runbook. The
   alternative — keep Forgejo+Infisical on one tiny always-on seed host (a small CX) off the cluster
   — preserves an independent bootstrap path but **doesn't fully achieve "stop paying for standby
   compute"** (you still pay for the seed). *Recommendation:* go on-cluster **only after Stage C
   passes**; if the founder wants belt-and-braces, keep the *cheapest possible* seed (or even
   `.150` itself) running Forgejo+Infisical until two clean quarterly cold-start drills have passed,
   then retire it. **Decision needed:** on-cluster-after-drill (max saving, store-only safety net) vs
   keep-a-seed (smaller saving, independent bootstrap).

4. **Registry backup approach.** *Recommend* a `skopeo sync` / registry-mirror job into a dedicated
   S3 prefix (restartable, image-aware) **over** relying on the volume tar inside the restic snapshot.
   **Sub-decision:** standardise *all* images (incl. Sophia, currently on GHCR) into the Forgejo
   registry so cold start has a single image source — or accept GHCR as a documented second pull
   source. **Decision needed:** mirror-job + single-registry standardisation (yes/no).

5. **etcd off-box mechanism.** Native K3s `--etcd-s3` (simplest, creds already in Infisical) vs a
   ship-snapshot CronJob. *Recommend* native `--etcd-s3`. **Decision needed:** confirm.

6. **Immutability.** Enable S3 **object-lock + versioning** on the jewels bucket for ransomware
   resilience? *Recommend yes.* **Decision needed:** confirm (adds slight storage cost for retained
   versions).

---

## Appendix — provenance

All §0 findings verified live on 2026-06-24 (`KUBECONFIG=/private/tmp/k3s-create/kubeconfig`): CNPG
clusters + ObjectStore `backups-fsn1`, `data/surreal-backup` CronJob, Loki S3 config, 49 local-only
`ETCDSnapshotFile` CRs, 5 Infisical `ClusterSecretStore`s, live image refs to
`git.allotmentology.tech`. Repo: `scripts/backup/buildops-backup.sh` (Forgejo volume + Infisical
coverage), `restormel-backup` skill, Forgejo PR #283 (BX11→fsn1 S3 restic migration, open). Memory:
`infra-direction-2026-06-23`, `k3s-migration-program`, `database-strategy`, `coolify-migration`,
`prod-box-disk-guard`.
