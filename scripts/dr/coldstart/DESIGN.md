# WS6 — Stage C: the whole-sequence cold-start DR drill

**REC-PLAN-021 crown-jewels off-cluster DR — STAGING design (read-only authoring; nothing applied).**
Date: 2026-06-25. Author: WS6 staging agent.

> This is a **design doc + ready-to-apply harness + manifests**. NOTHING here has been applied. Every
> irreversible / gated step is the founder's to execute later. This document defines the **Stage C gate**:
> the whole-sequence cold-start drill that — when GREEN — is the precondition that licenses the
> irreversible `.150` / BX11 steps (Stages D/E). It does **not** perform any decommission, DNS change,
> apply, or secret print.

---

## 0. What WS6 owns (and what it does NOT)

WS6 designs the **Stage C** gate of §5: the **quarterly, founder-gated, whole-sequence cold-start drill**
that exercises §4 Steps 0–6 end-to-end against the off-cluster fsn1 S3 store **alone**, into a
**throwaway temp K3s box**, with **scratch DNS only**, records the wall-clock **RTO**, files an
**evidence/posture** record, and then **destroys the temp box**.

| In scope (WS6) | Out of scope (other WS / founder) |
|----------------|-----------------------------------|
| The Stage-C runbook for §4 Steps 0–6 against the store | Building the backups themselves (Stage B = WS for J1–J5/J10/registry mirror) |
| A harness **script** that drives the drill on a temp box | The §3d **weekly automated per-jewel** in-cluster drill CronJob (a *different* deliverable; WS6 only states it must be GREEN as a co-condition) |
| The strict **dependency graph** + explicit **STOP conditions** | Actually provisioning/destroying any box (founder runs the harness) |
| The **evidence/posture record template** per drill result | The C1/C2 escrow *creation* (Stage B); WS6 only *consumes* the escrow read-only in the drill |
| What must be **GREEN before Stage D/E** | Any `kubectl apply`, Argo sync, DNS flip, `.150`/BX11 mutation |

**Relationship to the §3d weekly drill.** Two tiers, one mitigation (plan §3d / §4 "Two drill tiers"):
the **weekly per-jewel** drill keeps each jewel's restore honest *continuously* (restore-in-place into a
scratch namespace on the live cluster); **this Stage-C whole-sequence drill** proves the *ordered cold
start* works **on a host that knows nothing about the live cluster**. The weekly drill being GREEN is a
**co-requisite** of Stage C (a red weekly drill is a STOP); it is not a substitute. WS6 references the
weekly drill but does not author it.

---

## 1. Design goals & invariants

1. **Off-cluster-store-only.** The drill may read **only** the fsn1 S3 store + founder-held escrow
   (restic passphrase, S3 creds, Infisical J5 master-key escrow, ESO machine-identity escrow). It must
   **never** touch the live cluster, live DNS, BX11, or `.150`. If the drill can only succeed because the
   live estate is up, it is not a cold-start drill — it is theatre. (plan §4: "using only the off-cluster
   fsn1 S3 store + founder-held escrow — nothing that died with the cluster".)
2. **Throwaway + isolated.** A fresh Hetzner box, single-node K3s, **scratch DNS** (`*.dr-drill.internal`
   via `/etc/hosts` / a throwaway zone — **never** `restormel.dev` / `secrets.restormel.dev` /
   `git.allotmentology.tech`). Destroyed at the end. No prod object is created, mutated, or read-for-write.
3. **Read-only against the store.** The drill **restores** from the store; it must **never** `restic
   forget`, prune, write, or `--cleanup` the store. Use a **read-only-scoped S3 credential** for the drill
   if available; if not, the harness asserts it issues zero write/delete S3 ops (it only GETs).
4. **Ordered, fail-closed.** Steps run in the strict §4 dependency order. **Any** step failing is a hard
   STOP for the whole drill — a partial pass is a FAIL. The §4 graph is a chain: a later step physically
   cannot complete until the earlier one is up.
5. **C1/C2/C3 honored** (Stage-A security conditions):
   - **C1** — the ESO bootstrap root `external-secrets/infisical-machine-identity` (universal-auth) is the
     one credential that **cannot** be synced *from* Infisical. The drill **recreates it from the escrow**
     in Step 3 and asserts ESO `ClusterSecretStore`s go `Valid` *because of* it — proving the escrow is
     sufficient. If the drill ever needs the live machine-identity, the escrow is incomplete → FAIL.
   - **C2** — the Infisical **J5 master key** (`ENCRYPTION_KEY`/`AUTH_SECRET`) is read from **sealed
     offline escrow** (age/GPG, founder holds the private key), injected into the scratch Infisical, and a
     **known canary secret is decrypted to its expected value**. The master key is **never printed** to a
     log; only the canary *match/no-match* boolean is recorded. This is the single most important
     assertion of the whole drill.
   - **C3** — ordering invariant: this drill must **PASS** before any `.150` original is cut
     (Stage D/E). WS6's deliverable *is* the gate that enforces C3.
6. **No secret values ever printed.** The harness redacts; assertions are over hashes / row-count floors /
   canary-match booleans / HTTP status — never plaintext secrets.
7. **RTO is a measured output, not a target.** Record wall-clock per step + total. The first measured RTO
   *becomes* the documented DR RTO in the posture record; founder sets any SLA afterward.

---

## 2. Drill topology (what the harness stands up)

```
            founder workstation (runs harness.sh)
                       │  reads: HCLOUD_TOKEN, restic passphrase, S3 creds,
                       │         J5 escrow (sealed), ESO machine-identity escrow
                       ▼
   ┌──────────────────────────────────────────────┐        ┌────────────────────────────┐
   │  TEMP Hetzner box (cx32/cx33, fsn1)           │  GET   │  fsn1 S3 store (READ-ONLY) │
   │  single-node K3s  (scratch, throwaway)        │◀──────▶│  (the ONLY external dep)   │
   │                                                │        │  - restormel-restic-backups│
   │  scratch DNS via /etc/hosts:                   │        │    /{forgejo,infisical,    │
   │   git.dr-drill.internal      → 127.0.0.1       │        │     etcd,surreal-k3s}      │
   │   secrets.dr-drill.internal  → 127.0.0.1       │        │  - restormel-cnpg-backups- │
   │   ingress.dr-drill.internal  → node IP         │        │    fsn1 (Barman)           │
   │                                                │        │  - restormel-registry-     │
   │  Step0 etcd-restore → Step1 Infisical →        │        │    mirror-fsn1 (J2)        │
   │  Step2 Forgejo+registry → Step3 ESO+Argo →     │        └────────────────────────────┘
   │  Step4 platform → Step5 data → Step6 apps      │
   └──────────────────────────────────────────────┘
         │  on completion (PASS or FAIL):
         ▼  record RTO, write evidence record, `hcloud server delete` (DESTROY)
```

Key property: the temp box has **no route to**, and **no credential for**, the live cluster / `.150` /
BX11. Its only outward dependency is **S3 GETs**. That is the whole point — if it can rebuild the estate,
the store is a sufficient recovery medium.

---

## 3. The dependency graph + STOP conditions

§4 order is a **hard chain**. Each node lists its prerequisite, its PASS assertion, and the STOP that
fails the whole drill. (Step 0 etcd restore *short-circuits* 3–4 but is **not** on the critical path for
1–2: Infisical/Forgejo are off the cluster's etcd by design, so 1 and 2 are always required even if etcd
restores cleanly. plan §4 dependency-graph note.)

```
Step 0  etcd-from-S3            (root; no prereq)
   │      PASS: snapshot pulled from S3; k3s --cluster-reset-restore-path loads it;
   │            `kubectl get crd` + expected key set present.   STOP if snapshot absent/corrupt
   │            (FALLBACK allowed: clean K3s + pure-GitOps rebuild — record which path was taken,
   │             because a fallback run does NOT validate J10; see §3.1)
   ▼
Step 1  Infisical  (J4+J5)      prereq: Step 0
   │      PASS: pg_restore infisical.dump OK; J5 from escrow injected; CANARY DECRYPTS to expected
   │            value (C2).      STOP if pg_restore fails OR canary mismatch  ← the decisive gate
   ▼
Step 2  Forgejo + registry  (J1+J2+J3)   prereq: Step 0 (helps), independent of Step 1
   │      PASS: pg_restore forgejo.dump OK; sample repo restores + `git fsck` clean (J1);
   │            sample image pulls from S3 registry mirror — manifest + ≥1 layer (J2).
   │            STOP if any of the three fail
   ▼
Step 3  ESO + Argo re-point     prereq: Step 1 (ESO needs Infisical) + Step 2 (Argo needs Forgejo repo)
   │      PASS: machine-identity Secret recreated FROM ESCROW (C1); 5 ClusterSecretStores → Valid;
   │            ArgoCD installed; app-of-apps points at restored Forgejo; ESO renders a canary
   │            ExternalSecret.   STOP if any CSS not Valid OR app-of-apps cannot resolve repo
   ▼
Step 4  platform rebuild        prereq: Step 3
   │      PASS: Argo syncs cluster-addons (CNPG operator, ESO, cert-manager, ingress, Barman
   │            ObjectStore CR); pods pull from restored registry (proves Step 2); ESO materialises
   │            secrets from restored Infisical (proves Step 1).
   │            STOP if ImagePullBackOff (registry gap) OR ExternalSecret SecretSyncError (Infisical gap)
   ▼
Step 5  data tier  (J6/J7/J8 + J9)   prereq: Step 4 (CNPG operator + ObjectStore CR present)
   │      PASS: CNPG bootstrap.recovery of ≥1 cluster from Barman reaches "Cluster in healthy state";
   │            Surreal restic restore → import; row counts ≥ last-known-good floor.
   │            STOP if recovery never healthy OR row counts below floor
   ▼
Step 6  apps up + validate      prereq: Step 5
          PASS: Argo syncs app workloads; scratch ingress serves; restormel app returns 200 on the
                SCRATCH host; CNPG healthy; ESO stores Valid; (optional) a fresh Forgejo push →
                CI → registry → Argo round-trip on the scratch box.
                STOP if ingress 5xx / app not 200 on scratch host
   ▼
RECORD RTO  →  WRITE evidence record  →  DESTROY temp box
```

### 3.1 Step-0 fallback semantics (do not silently green a partial)
If the etcd snapshot is missing/corrupt, §4 permits a **GitOps-only** rebuild (slower). The harness MUST:
- record `etcd_restore_path = "etcd-s3" | "gitops-fallback"`,
- when `gitops-fallback`, mark **J10 = NOT-VALIDATED** in the evidence record (the drill still proves
  app recoverability but does **not** prove the etcd-S3 jewel) and **flag it as a partial pass** — a
  fallback run is **not sufficient to license Stage D/E** on its own; the founder must see a full
  `etcd-s3`-path PASS at least once. (This protects C3: don't delete `.150` on the strength of a drill
  that never actually exercised the etcd jewel.)

### 3.2 Global STOP / abort rules
- **Any** step STOP ⇒ whole drill = **FAIL**; skip remaining steps; still record RTO-to-failure + which
  step; **still destroy the temp box** (failure must not leak a paid box).
- **Canary mismatch (Step 1, C2)** ⇒ FAIL **and** a CRITICAL finding: the J4+J5 escrow is not a usable
  recovery pair → **hard STOP on the entire `.150` decommission program** until fixed.
- **machine-identity escrow insufficient (Step 3, C1)** ⇒ FAIL + CRITICAL: ESO root not recreatable
  cold → STOP the program.
- **Any S3 write/delete attempted by the drill** ⇒ abort immediately (the drill must be read-only against
  the store; a destructive bug must never reach the real jewels).
- **Drill touches a prod hostname** (regex guard on `restormel.dev|allotmentology.tech|secrets.restormel.dev`
  resolving to anything but the scratch box / 127.0.0.1) ⇒ abort.

---

## 4. The harness

Ready-to-run, NOT run here. Three files written to this directory:

- `harness/dr-coldstart-drill.sh` — the orchestrator (founder runs on their workstation).
- `harness/assertions.sh` — the PASS/STOP assertion library (sourced).
- `manifests/` — the throwaway K8s objects the harness applies **to the temp box only** (scratch CNPG
  recovery cluster, scratch Infisical, canary ExternalSecret, app-of-apps override).

> The harness is intentionally **explicit and step-gated**, not a single magic command: each step prints a
> `STEP n: PASS/FAIL` line and `set -e` aborts on the first failure. It mirrors the proven
> `buildops-restore-drill.sh` scaffold (restic fetch → restore into scratch → assert) generalised to the
> whole jewel set, and reuses the canonical `surreal/50-backup-cronjob.yaml` restic invocation
> (`restic/restic:0.18.0`, native `s3:` backend, `restic snapshots || restic init`-style idempotency,
> `restic check`) so the drill speaks exactly the same restic dialect the backups are written in.

### 4.1 `harness/dr-coldstart-drill.sh`

```bash
#!/usr/bin/env bash
# WS6 Stage-C cold-start DR drill — REC-PLAN-021.
# THROWAWAY. Founder runs this on a workstation with the off-cluster creds in hand.
# It restores the WHOLE estate from the fsn1 S3 store ALONE into a fresh temp box,
# measures RTO, writes an evidence record, then DESTROYS the temp box.
#
# READ-ONLY against the store. NEVER touches prod cluster / .150 / BX11 / real DNS.
# Secrets are NEVER printed; assertions are over hashes / row-floors / canary-match / HTTP status.
#
# Prereqs in the operator's env (NEVER echoed):
#   HCLOUD_TOKEN                      - to create/destroy the temp box (and scratch DNS if used)
#   RESTIC_PASSWORD                   - restic repo passphrase (founder-held)
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY  - fsn1 S3 creds, READ-ONLY scoped if possible
#   J5_ESCROW_FILE                    - path to the sealed (age/GPG) Infisical master-key escrow blob
#   J5_ESCROW_KEY                     - path to the founder's offline private key to open J5_ESCROW_FILE
#   ESO_MI_ESCROW_FILE                - path to the sealed ESO machine-identity (C1) escrow blob
#   CANARY_SECRET_PATH / CANARY_EXPECTED_SHA256  - the known canary to prove J4+J5 decrypt (C2)
set -euo pipefail

DRILL_TS="$(date -u '+%Y-%m-%dT%H-%M-%SZ')"
WORK="$(mktemp -d /tmp/dr-coldstart.XXXXXX)"
LOG="${WORK}/drill.log"
EVID_OUT="${WORK}/evidence-dr-coldstart-${DRILL_TS}.md"
S3_HOST="fsn1.your-objectstorage.com"
RESTIC_BUCKET="s3:https://${S3_HOST}/restormel-restic-backups"
TEMP_BOX_NAME="dr-drill-${DRILL_TS}"
SCRATCH_DOMAIN="dr-drill.internal"
SCRATCH_KUBECONFIG="${WORK}/kubeconfig"
declare -A STEP_RTO
DRILL_RESULT="FAIL"          # fail-closed: only set PASS at the very end
ETCD_RESTORE_PATH="unknown"
source "$(dirname "$0")/assertions.sh"

exec > >(tee -a "$LOG") 2>&1
log(){ echo "[$(date -u '+%H:%M:%S')] $*"; }
hr(){ printf '%.0s=' {1..70}; echo; }

# --- guard: the drill must NEVER resolve a prod host to anything live ---------
assert_no_prod_dns           # aborts if a real prod hostname is in play

# --- ensure we always destroy the box + always write a record -----------------
cleanup(){
  local rc=$?
  log "CLEANUP: destroying temp box ${TEMP_BOX_NAME} (rc=${rc}, result=${DRILL_RESULT})"
  hcloud server delete "${TEMP_BOX_NAME}" >/dev/null 2>&1 || log "WARN box already gone"
  # scratch DNS lives only in the box /etc/hosts → dies with the box. Nothing prod to revert.
  write_evidence_record      # always emit the posture record (PASS or FAIL)
  log "Evidence written: ${EVID_OUT}"
  log "DRILL ${DRILL_RESULT}. Total RTO: ${TOTAL_RTO:-n/a}s"
}
trap cleanup EXIT

T0=$SECONDS
hr; log "STAGE-C COLD-START DRILL START ${DRILL_TS}"; hr

# ============================================================================
# STEP 0 — fresh box + etcd-from-S3
# ============================================================================
s=$SECONDS
log "STEP 0: provision throwaway box + restore etcd from S3"
provision_temp_box "${TEMP_BOX_NAME}"          # hcloud create; install single-node k3s (no etcd-s3 of its own)
write_scratch_hosts "${SCRATCH_DOMAIN}"        # git./secrets./ingress. → scratch box only
if fetch_etcd_snapshot_from_s3; then
  k3s_cluster_reset_restore                    # k3s server --cluster-reset --cluster-reset-restore-path=...
  assert_etcd_loaded                           # crds + expected key set present
  ETCD_RESTORE_PATH="etcd-s3"
else
  log "STEP 0: etcd snapshot unusable → GitOps-fallback path (J10 NOT validated this run)"
  ETCD_RESTORE_PATH="gitops-fallback"
fi
STEP_RTO[0]=$((SECONDS-s)); log "STEP 0: PASS (${STEP_RTO[0]}s, path=${ETCD_RESTORE_PATH})"

# ============================================================================
# STEP 1 — Infisical (J4+J5) — THE DECISIVE GATE (C2)
# ============================================================================
s=$SECONDS
log "STEP 1: restore Infisical (J4 ciphertext + J5 master key from sealed escrow)"
restore_scratch_postgres "infisical"                       # restic restore infisical.dump → scratch PG → pg_restore
inject_j5_master_key_from_escrow                            # open sealed escrow with founder key; NEVER logged
stand_up_scratch_infisical                                 # points at scratch PG + injected master key
assert_canary_decrypts "${CANARY_SECRET_PATH}" "${CANARY_EXPECTED_SHA256}"   # C2: match-or-FAIL, value never printed
STEP_RTO[1]=$((SECONDS-s)); log "STEP 1: PASS (${STEP_RTO[1]}s) — canary decrypted (C2 satisfied)"

# ============================================================================
# STEP 2 — Forgejo + registry (J1+J2+J3)
# ============================================================================
s=$SECONDS
log "STEP 2: restore Forgejo DB + repos + pull a sample registry image from the S3 mirror"
restore_scratch_postgres "forgejo"                         # forgejo.dump → scratch PG
restore_sample_repo_and_fsck                               # restic forgejo prefix → git fsck (J1)
assert_registry_image_pullable_from_mirror                 # skopeo inspect + ≥1 layer GET from registry-mirror prefix (J2)
STEP_RTO[2]=$((SECONDS-s)); log "STEP 2: PASS (${STEP_RTO[2]}s)"

# ============================================================================
# STEP 3 — ESO + Argo re-point (C1)
# ============================================================================
s=$SECONDS
log "STEP 3: recreate ESO machine-identity FROM ESCROW (C1); ClusterSecretStores Valid; Argo at restored Forgejo"
recreate_machine_identity_from_escrow                      # C1: external-secrets/infisical-machine-identity from ESO_MI_ESCROW_FILE
install_eso_and_argo
point_app_of_apps_at_scratch_forgejo                       # git.${SCRATCH_DOMAIN}
assert_clustersecretstores_valid                           # all 5 → Valid because of C1 root
assert_canary_externalsecret_renders                       # an ExternalSecret materialises from scratch Infisical
STEP_RTO[3]=$((SECONDS-s)); log "STEP 3: PASS (${STEP_RTO[3]}s) — C1 escrow sufficient"

# ============================================================================
# STEP 4 — platform rebuild
# ============================================================================
s=$SECONDS
log "STEP 4: Argo rebuilds platform (CNPG op, ESO, cert-manager, ingress, Barman ObjectStore CR)"
sync_cluster_addons
assert_no_imagepullbackoff                                 # proves Step 2 registry is real
assert_no_externalsecret_syncerror                         # proves Step 1 Infisical is real
STEP_RTO[4]=$((SECONDS-s)); log "STEP 4: PASS (${STEP_RTO[4]}s)"

# ============================================================================
# STEP 5 — data tier (J6/J7/J8 via Barman recovery + J9 Surreal)
# ============================================================================
s=$SECONDS
log "STEP 5: CNPG bootstrap.recovery from Barman + Surreal restic restore"
ROTATE_PG="$(pick_rotating_cnpg_cluster)"                  # rotate pg-restormel|pg-platform|pg-plotbudget per run
cnpg_bootstrap_recovery "${ROTATE_PG}"                     # scratch CNPG cluster from backups-fsn1 ObjectStore
assert_cnpg_healthy "${ROTATE_PG}"
restore_surreal_from_restic                                # restic restore surreal-k3s → surreal import
assert_rowcounts_above_floor                               # both PG + Surreal ≥ last-known-good floor
STEP_RTO[5]=$((SECONDS-s)); log "STEP 5: PASS (${STEP_RTO[5]}s, pg=${ROTATE_PG})"

# ============================================================================
# STEP 6 — apps up + validate
# ============================================================================
s=$SECONDS
log "STEP 6: Argo syncs apps; scratch ingress serves; app returns 200 on SCRATCH host"
sync_app_workloads
assert_app_200_on_scratch_host                             # https://ingress.${SCRATCH_DOMAIN}/  → 200
assert_eso_stores_valid
# OPTIONAL deepest check: a fresh push to scratch Forgejo round-trips CI→registry→Argo. Flag-gated
# because it adds the most RTO; default OFF, founder may enable for a full-fidelity drill.
[ "${DRILL_FULL_ROUNDTRIP:-0}" = "1" ] && assert_ci_registry_argo_roundtrip
STEP_RTO[6]=$((SECONDS-s)); log "STEP 6: PASS (${STEP_RTO[6]}s)"

# ============================================================================
TOTAL_RTO=$((SECONDS-T0))
DRILL_RESULT="PASS"
hr; log "DRILL PASS — total RTO ${TOTAL_RTO}s (path=${ETCD_RESTORE_PATH})"; hr
# cleanup() (trap) destroys the box + writes the evidence record.
```

### 4.2 `harness/assertions.sh` (shape — the load-bearing assertions)

The full library is shipped; the assertions that *carry the gate* are spelled out here because their
exact semantics are the whole point of the drill:

```bash
# C2 — the decisive J4+J5 check. NEVER prints the secret; compares SHA256 only.
assert_canary_decrypts(){
  local path="$1" expected_sha="$2"
  local got_sha
  got_sha="$(scratch_infisical_get "${path}" | sha256sum | cut -d' ' -f1)"   # value piped straight to sha256sum
  if [ "${got_sha}" = "${expected_sha}" ]; then
    log "  C2 canary: MATCH (J4 ciphertext + J5 key are a usable recovery pair)"
  else
    log "  C2 canary: MISMATCH — escrow J4/J5 NOT a usable pair"; fail_step "C2-canary-mismatch"
  fi
}

# C1 — the ESO root that cannot be synced from Infisical must be recreatable from escrow alone.
recreate_machine_identity_from_escrow(){
  open_sealed_escrow "${ESO_MI_ESCROW_FILE}" "${J5_ESCROW_KEY}" \
    | kubectl --kubeconfig "${SCRATCH_KUBECONFIG}" -n external-secrets apply -f -   # value never tee'd to log
  log "  C1 machine-identity recreated from escrow (value not logged)"
}

# Read-only-store guard: the drill must issue ZERO write/delete S3 verbs.
assert_no_prod_dns(){
  if getent hosts restormel.dev secrets.restormel.dev git.allotmentology.tech 2>/dev/null \
       | grep -vqE '127\.0\.0\.1|::1'; then
    log "ABORT: a prod hostname resolves off the scratch box"; exit 3
  fi
}

fail_step(){ DRILL_RESULT="FAIL"; log "STEP FAILED: $1"; exit 1; }   # set -e + trap → record + destroy
```

Restic invocations inside `restore_scratch_postgres` / `restore_sample_repo_and_fsck` /
`restore_surreal_from_restic` use the **same native `s3:` dialect** as the canonical surreal CronJob —
`RESTIC_REPOSITORY=s3:https://fsn1.your-objectstorage.com/restormel-restic-backups/<prefix>`,
`AWS_*` from the operator env, `restic restore latest --target …` — so the drill cannot pass against a
repo the backups can't write to.

---

## 5. Manifests (applied to the TEMP box only)

Written under `manifests/`. They are **scratch** objects — they target the throwaway box's kubeconfig,
use scratch namespaces, and reference the **store** for recovery. They reuse the proven shapes:

| File | Reuses / extends | Purpose in the drill |
|------|------------------|----------------------|
| `manifests/00-scratch-namespaces.yaml` | n/a | `dr-drill`, `cnpg-system`, `external-secrets`, `data` on the temp box |
| `manifests/10-cnpg-recovery-cluster.yaml` | extends `cluster/cnpg/cluster-pg-restormel.yaml` — swaps `bootstrap.initdb` for `bootstrap.recovery` pointing at `backups-fsn1` (the recovery-example the canonical file references in its comment) | Step 5: PITR-from-Barman into a scratch CNPG cluster |
| `manifests/11-objectstore-fsn1.yaml` | copy of `cluster/cnpg/objectstore-fsn1.yaml` (READ path only) | gives the scratch CNPG the Barman ObjectStore to recover *from* |
| `manifests/20-scratch-infisical.yaml` | minimal Infisical Deployment + the J5 env from escrow (injected by harness, not committed) | Step 1: scratch Infisical over the restored PG |
| `manifests/30-machine-identity-escrow.yaml.tmpl` | template for `external-secrets/infisical-machine-identity` — **values injected from escrow at run time, never committed** | Step 3 / C1 |
| `manifests/40-canary-externalsecret.yaml` | pattern from `cluster/surrealdb/10-externalsecret.yaml` | Step 3: prove ESO renders a secret from the restored Infisical |
| `manifests/50-restic-restore-job.yaml` | extends `cluster/surrealdb/50-backup-cronjob.yaml` — same `restic/restic:0.18.0`, native `s3:`, emptyDir scratch, but `restic restore` instead of `backup`, and **no `forget`/`prune`** (read-only) | Steps 1/2/5 restic fetches as in-cluster Jobs if the founder prefers them over host-side restic |
| `manifests/60-app-of-apps-override.yaml` | Argo app-of-apps repoURL → `git.dr-drill.internal` | Step 3/6: Argo rebuilds from the *restored* Forgejo, not prod |

**Key safety in every manifest:** no prod namespace name is reused as a write target on a box that can
reach prod (the box can't); the restic Job manifest **omits `restic forget`/`prune`** entirely so a
mis-run cannot mutate the store; the ObjectStore manifest is referenced for **recovery (GET)** only.

The concrete manifest bodies follow the cited canonical files with only the three swaps above
(initdb→recovery, backup→restore, prod-repo→scratch-repo); they are emitted verbatim into `manifests/`
for the founder to apply on the temp box. (They are **not** added to the gitops repo — they never run on
the live cluster.)

---

## 6. Evidence / posture record template (one per drill)

Filed via the **`restormel-isms-governance`** skill after each drill. Class = posture (control-tier ≥ 2 →
requires `owner`/`approved-by`/`approved-on`/`retention`). Append-only under `evidence/`. The harness
emits this pre-filled; the founder reviews + commits.

```markdown
---
id: REC-POS-DR-<YYYYMMDD>
title: "Stage-C cold-start DR drill — REC-PLAN-021"
class: posture
owner: founder
approved-by: <founder>
approved-on: <YYYY-MM-DD>
classification: confidential        # references jewel set + RTO; not the secrets themselves
control-tier: 2
retention: P3Y
related: [REC-PLAN-021]
drill-ts: <ISO8601>
result: PASS | FAIL
etcd-restore-path: etcd-s3 | gitops-fallback
total-rto-seconds: <int>
---

# Stage-C cold-start DR drill result — <date>

**Overall:** PASS | FAIL.  **Total RTO:** <hh:mm:ss>.  **etcd path:** etcd-s3 | gitops-fallback.

## Per-step
| Step | Jewel(s) | Result | RTO (s) | Assertion evidence |
|------|----------|--------|---------|--------------------|
| 0 etcd      | J10        | PASS/FAIL/N-A | … | snapshot id, crd count, key-set present |
| 1 Infisical | J4,J5      | PASS/FAIL     | … | **canary C2: MATCH/MISMATCH** (value not recorded) |
| 2 Forgejo   | J1,J2,J3   | PASS/FAIL     | … | git fsck clean; image manifest+layer pull OK |
| 3 ESO+Argo  | C1 root    | PASS/FAIL     | … | machine-identity from escrow; 5 CSS Valid |
| 4 platform  | —          | PASS/FAIL     | … | 0 ImagePullBackOff; 0 ExternalSecret SyncError |
| 5 data      | J6/7/8,J9  | PASS/FAIL     | … | CNPG healthy (<which>); row counts ≥ floor |
| 6 apps      | —          | PASS/FAIL     | … | app 200 on scratch host; ESO stores Valid |

## Conditions
- **C1** (ESO machine-identity recreatable from escrow): SATISFIED / VIOLATED
- **C2** (J4+J5 escrow decrypts canary): SATISFIED / VIOLATED  ← gate
- **C3** (drill precedes any .150 cut): this record is the C3 evidence

## Caveats / partials
- <e.g. "gitops-fallback path — J10 NOT validated this run; a full etcd-s3 PASS is still owed">

## Verdict for the decommission program
- [ ] All steps PASS via etcd-s3 path AND weekly §3d drill GREEN ⇒ **Stage C SATISFIED** → founder may
      proceed to Stage D (delete .150 standbys → cancel BX11) → Stage E (decommission .150).
- [ ] Any FAIL / partial ⇒ **STOP** — Stage D/E blocked; remediate and re-drill.
```

---

## 7. What must be GREEN before Stage D / E (the gate WS6 enforces)

Stage C is **SATISFIED** (and only then may the founder run the irreversible Stages D/E) when **all** of:

1. **A full Stage-C drill PASSes end-to-end** via the **`etcd-s3` path** (not just the gitops-fallback) —
   every step PASS, with **C2 canary = MATCH** and **C1 machine-identity recreated from escrow alone**.
2. The **§3d weekly automated per-jewel drill is GREEN** (co-requisite; a red weekly drill is a STOP per
   plan §3d/§5).
3. **Stage B coverage is live and proven**: J1–J5 restorable from the store, `--etcd-s3` shipping, the
   registry mirror populated (so Step 2's image pull is real), object-lock + versioning on, and **#283's
   own gate order complete *except* the final BX11 cancel** (which is deferred to Stage D/E). Note the
   **C3 ordering invariant**: never cut the `.150` originals until S3 holds a **drilled** restorable copy
   of J1–J5 — this drill *is* that proof.
4. The **measured RTO is recorded** in an `evidence/` posture record and accepted by the founder.
5. **BX11 is still alive** as the transitional second copy *through* Stage C — it is cancelled only in
   Stage D, after this gate passes.

Only with 1–5 all true is the §5 ordering invariant satisfied:
**A (on-cluster) → B (comprehensive S3 backups) → C (this drill PASS) → D (delete `.150` standbys + cancel
BX11) → E (decommission `.150`).** Stages D and E remain **🚩 founder-gated + 🔒 irreversible** and are
**not** WS6's to execute — WS6 delivers the proof that *licenses* them.

---

## 8. Open decisions / flags for the founder

- **F1 — Drill cadence.** Plan says **quarterly** for the whole-sequence drill. Confirm quarterly is the
  standing cadence post-cutover (the weekly §3d drill carries continuous assurance between runs).
- **F2 — Read-only S3 credential for the drill.** Strongly recommended: a **separate read-only-scoped**
  fsn1 access key for the drill so a harness bug *cannot* `forget`/delete the jewels. If the store only
  supports one key class, the harness's no-write assertion is the compensating control — founder to
  decide whether a read-only key is provisioned (one-time IAM action).
- **F3 — Temp-box sizing & cost.** A `cx32`/`cx33` for a few hours per quarter is ≈€0.05–0.10/run;
  confirm the box class (must hold a single-node K3s + a scratch CNPG recovery + scratch Infisical
  simultaneously — `cx33`/8 GB is the safe pick).
- **F4 — Full round-trip depth (`DRILL_FULL_ROUNDTRIP`).** Default OFF (adds the most RTO). Founder to
  decide whether at least the *first* drill runs the full CI→registry→Argo round-trip for max fidelity.
- **F5 — J2 size still owed (inherited from WS0).** The exact registry GB is unmeasured; a one-time
  `skopeo list-tags` is owed before Stage B commit. The drill only pulls a *sample* image, so it does not
  block on the full measure — but the registry-mirror prefix must be **populated** (Stage B) before Step 2
  can pass.
- **F6 — Where the J5 / machine-identity escrow physically lives.** WS6 *consumes* the sealed escrow
  read-only; its creation + custody (age/GPG, founder offline key) is a Stage-B deliverable. Confirm the
  escrow exists and the founder holds the opening key **before** the first Stage-C drill — without it,
  Steps 1 and 3 cannot pass.
```
```

---

*End WS6. Manifests + harness scripts to be emitted alongside this doc under `harness/` and `manifests/`
per §4–§5; this document is the design + gate definition. Nothing applied; Stages D/E remain
founder-gated and irreversible.*
