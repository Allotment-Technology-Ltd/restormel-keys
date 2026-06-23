---
id: REC-INC-009
title: "Incident — SurrealDB K3s knowledge-graph had NO working backup (DR gap); export broken + BX11 repointed to S3 fsn1"
class: evidence
owner: founder
approved-by: "@adam"
approved-on: 2026-06-23
status: closed
classification: internal
control-tier: 3
created: 2026-06-23
last-reviewed: 2026-06-23
review-interval: P12M
retention: P6Y
related: [REC-TPL-004, AST-012, AST-029, AST-014, RISK-001, RISK-009]
---

# Incident — SurrealDB (K3s) knowledge-graph backup DR gap closed; export repaired + BX11 → S3 fsn1

> Filed from REC-TPL-004. Append-only once closed. Severity **high** (latent) — the in-scope Sophia
> knowledge graph (SurrealDB NS=main / DB=sophia on the K3s `data` plane) had **zero working backups**.
> No data was lost (DB is currently near-empty until Sophia migrates its corpus), but the recovery
> control was entirely non-functional — a Disaster-Recovery gap, not a live outage.

- **Detected:** 2026-06-23 — surfaced by Phase-1 infra ground-truth review (PBI **#229**, CRITICAL).
  **Reported by:** infra audit → founder. **Severity:** high (latent DR gap; no live availability impact).

- **What happened:** On the live K3s estate (ns `data`, StatefulSet `surreal`, single replica `surreal-0`,
  20 GB PVC, NS `main` / DB `sophia`) the hourly `CronJob data/surreal-backup` (owned by the
  `cluster-addons` Argo app, source `restormel-gitops` `cluster/surrealdb/`) was **suspended** and **could
  never have run** even if un-suspended, due to **two independent manifest defects**:
  1. **Export defect.** The `surreal-export` initContainer used `command: ["/bin/sh","-ec", "/surreal export …"]`,
     but the `surrealdb/surrealdb:v3.1.4` image is **shell-less** (no `/bin/sh`) AND `surreal` is **not on
     `$PATH`** — so the container failed at start with **StartError / exit 128**
     (`exec: "surreal": executable file not found in $PATH`). The image's **ENTRYPOINT is the surreal
     binary**, so the wrapper override was the bug.
  2. **Transport defect + decommissioning target.** The `restic-ship` container pointed at
     `RESTIC_REPOSITORY = rclone:storagebox:restic-surreal` (BX11 Storage Box, being decommissioned), but
     the `restic/restic:0.18.0` image ships **no rclone binary**, so the `rclone:` backend could never run.
  Net effect: the only backup path for the Sophia graph was structurally dead. The Argo app
  `sophia-surreal-backup` (a separate, parallel, G2-gated design in `sophia.git`, targeting ns `sophia`)
  was `Missing` and had never synced.

- **Impact:** **Recoverability only** — the SurrealDB knowledge-graph store had no restorable backup.
  No confidentiality or integrity impact; no live availability impact (the DB itself, `surreal-0`, was
  Running/healthy throughout). The window of exposure was the whole life of the K3s SurrealDB to date.

- **Response (timeline, 2026-06-23 UTC, KUBECONFIG = K3s cluster):**
  - Confirmed root cause live: probed `surrealdb/surrealdb:v3.1.4` — `command:[surreal]` → StartError/exit128;
    default entrypoint + `args:[version]` → `3.1.4` (binary IS the entrypoint). Confirmed `restic/restic:0.18.0`
    **has** `/bin/sh` and the native `s3:` backend reaches Hetzner Object Storage fsn1.
  - Verified the in-scope export works against the live DB (args-only `surreal export … --auth-level root`,
    root creds from `surreal-root` ExternalSecret) → "exported successfully".
  - **Closed the gap NOW:** ran a manual backup Job (export → restic ship to S3 fsn1). New native-S3 restic
    repo created at `s3:https://fsn1.your-objectstorage.com/restormel-restic-backups/surreal-k3s`. First
    snapshot **`d19605b7`** (host `surreal-k3s`, tags `surreal,main-sophia`).
  - **Restore-verified:** `restic restore latest` from S3 → dump is valid SurrealQL (`OPTION IMPORT;`,
    standard export markers), non-empty. **RESTORE PASS.**
  - **Durable fix:** corrected `cluster/surrealdb/50-backup-cronjob.yaml` (args-only export; native `s3:`
    transport; `RESTIC_CACHE_DIR` on its own emptyDir for the non-root uid) and
    `10-externalsecret.yaml` (pull `RESTIC_PASSWORD` + `HETZNER_S3_FSN1_ACCESS_KEY_ID/_SECRET_ACCESS_KEY`
    from the `infisical-infra` store; drop the legacy rclone→BX11 keys). Opened
    **restormel-gitops PR #4** (NOT merged — founder gate).
  - Applied the fix to the live cluster (ESO via server-side apply; CronJob delete+recreate from the fixed
    manifest — safe because it was suspended) and **un-suspended** it (`suspend: false`). Triggered a run
    from the live CronJob to prove the durable config: second snapshot **`27d20347`**, retention prune ran,
    `restic check --read-data-subset=5%` → **"no errors were found"**.
  - All test artifacts (probe pods, manual/livecheck Jobs, the temporary `surreal-backup-s3-test`
    ExternalSecret/Secret) cleaned up.

- **Root cause:** The backup CronJob was authored against incorrect assumptions about the two container
  images — the SurrealDB image is distroless/shell-less with the binary as entrypoint (not on PATH), and
  the restic image carries no rclone. It was committed `suspend: true` and never executed, so the defects
  were never surfaced by a real run. Compounded by the target being BX11, a box scheduled for
  decommission. Contributing: a parallel/duplicate backup design (`sophia-surreal-backup` Argo app) created
  ambiguity about which path was canonical.

- **Follow-ups:**
  - **MERGE restormel-gitops PR #4** to converge git `main` with the live fix (until merged, the
    `cluster-addons` `selfHeal` could revert the live CronJob to the broken version on a successful sync;
    its sync is currently failing on unrelated resources, so the live fix holds for now). **Founder gate.**
  - **Decide the fate of the duplicate `sophia-surreal-backup` Argo app** (ns `sophia`,
    `sophia.git deploy/k3s/surreal`, still BX11-SFTP-targeted, `Missing`). It is now **redundant** with the
    canonical `cluster-addons` S3 backup. Recommendation: **retire** it (remove from
    `restormel-gitops applications/workloads/sophia.yaml`) rather than activate a second, BX11-bound backup
    of the same DB. **NOT actioned here — flagged for the founder** (touches the sophia repo + an Argo app
    definition; activating it would conflict with the sovereign S3 repoint).
  - **Wire a missed-backup alert** for the surreal-k3s repo (parity with the BX11 dead-man's-switch in the
    `restormel-backup` skill — Uptime-Kuma push + Telegram). Not yet wired on K3s.
  - **Confirm the broader restic→S3 migration** intent: BX11's `restic-surreal` (6 historical snapshots)
    and `restic-buildops` repos are preserved and untouched; this incident only repoints the **K3s** Surreal
    backup to the new sovereign S3 target (AST-029).

- **Closed:** 2026-06-23 — one good backup in S3 (snapshot `d19605b7`), restore verified, durable fix in
  PR #4, live CronJob fixed + un-suspended + a self-produced verifying snapshot (`27d20347`).
