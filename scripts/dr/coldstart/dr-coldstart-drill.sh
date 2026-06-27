#!/usr/bin/env bash
# =============================================================================
# WS6 Stage-C cold-start DR drill — REC-PLAN-021 (crown-jewels off-cluster DR).
# =============================================================================
# THROWAWAY. The FOUNDER runs this on a trusted workstation with the off-cluster
# creds + the OFFLINE escrow key in hand. It restores the WHOLE estate from the
# fsn1 S3 store ALONE into a fresh temp Hetzner box, measures RTO, writes an
# evidence record, then DESTROYS the temp box.
#
#   READ-ONLY against the store. NEVER touches the prod cluster / .150 / BX11 /
#   real DNS. Secrets are NEVER printed; assertions are over hashes /
#   row-count-floors / canary-match booleans / HTTP status — never plaintext.
#
# This is the Stage-C gate (WS6 §7): a full PASS via the etcd-s3 path, with the
# §3d weekly per-jewel drill GREEN, is the precondition that licenses the
# irreversible Stage D/E ( .150 standby delete + BX11 cancel + .150 decommission ).
# A FAIL or a gitops-fallback-only run does NOT license D/E.
#
# ---------------------------------------------------------------------------
# PREREQS in the operator's env (NEVER echoed). See README.md for the one-liner.
#   HCLOUD_TOKEN                   create/destroy the temp box
#   RESTIC_PASSWORD               restic repo passphrase (founder-held)
#   AWS_ACCESS_KEY_ID             fsn1 S3 access key  (read-only-scoped if possible, F2)
#   AWS_SECRET_ACCESS_KEY         fsn1 S3 secret key
#   ESCROW_IDENTITY               path to the founder OFFLINE age key
#                                 (default: ~/restormel-escrow-primary.key — NEVER leaves the founder)
# Optional overrides (sane defaults baked in — see the block below):
#   ESCROW_BUNDLE  CANARY_SECRET_PATH  CANARY_EXPECTED_SHA256  SCRATCH_STORAGECLASS
#   SCRATCH_DOMAIN  TEMP_BOX_TYPE  DR_DRILL_SSH_KEY  DR_DRILL_SSH_PRIVKEY  INFISICAL_IMAGE
#   FORGEJO_IMAGE  J2_SAMPLE_REPO  DRILL_FULL_ROUNDTRIP  KEEP_BOX
#   DR_DRILL_SSH_PRIVKEY = local private key to SSH the temp box (else uses ssh-agent/default)
# Tools required on the workstation (preflight asserts them): age, hcloud, aws,
#   restic, skopeo, kubectl, jq, ssh, git, curl, sha256sum|shasum.
# =============================================================================
set -euo pipefail

# ── timing / scratch workspace ──────────────────────────────────────────────
DRILL_TS="$(date -u '+%Y-%m-%dT%H-%M-%SZ')"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/dr-coldstart.XXXXXX")"
LOG="${WORK}/drill.log"
EVID_OUT="${WORK}/evidence-dr-coldstart-${DRILL_TS}.md"

# ── the ONE external dependency: the fsn1 S3 store ──────────────────────────
S3_HOST="${S3_HOST:-fsn1.your-objectstorage.com}"
S3_ENDPOINT="https://${S3_HOST}"
RESTIC_BUCKET="s3:${S3_ENDPOINT}/restormel-restic-backups"   # native restic s3: backend (infisical/forgejo/surreal)
CNPG_BUCKET_OL="restormel-cnpg-backups-fsn1-ol"              # object-locked Barman store (prod writes here)
REGISTRY_MIRROR_BUCKET="restormel-registry-mirror-fsn1"      # J2 OCI mirror
ESCROW_S3="s3://restormel-restic-backups/escrow"            # raw S3 objects (aws s3 cp, not restic)
ETCD_BUCKET="restormel-etcd-snapshots-fsn1"                 # J10 — native K3s --etcd-s3 (raw objects, NOT restic)
ETCD_FOLDER="k3s"                                           # prefix inside the etcd bucket

# ── escrow (single bundle, opened ONCE with the founder offline key) ────────
ESCROW_IDENTITY="${ESCROW_IDENTITY:-$HOME/restormel-escrow-primary.key}"
ESCROW_BUNDLE="${ESCROW_BUNDLE:-eso-bootstrap.age}"          # C1 MI + C2 J5; offline key only
ESCROW_ENV="${WORK}/.escrow.env"                            # tmpfs-ish; 600; shredded in cleanup

# ── canary (C2) — non-secret expected sha256 of the sentinel value ──────────
CANARY_SECRET_PATH="${CANARY_SECRET_PATH:-/dr/canary}"      # in the `restormel` Infisical project
CANARY_EXPECTED_SHA256="${CANARY_EXPECTED_SHA256:-fa3444cbb7d1deebd11875b62bd992cc9728632913e261a81217121b875276e2}"

# ── scratch box / cluster ───────────────────────────────────────────────────
TEMP_BOX_NAME="dr-drill-${DRILL_TS}"
TEMP_BOX_TYPE="${TEMP_BOX_TYPE:-cx33}"                      # F3: 8GB holds k3s + scratch CNPG + Infisical
SCRATCH_DOMAIN="${SCRATCH_DOMAIN:-dr-drill.internal}"       # scratch DNS ONLY (never a prod host)
SCRATCH_KUBECONFIG="${WORK}/kubeconfig"
SCRATCH_STORAGECLASS="${SCRATCH_STORAGECLASS:-local-path}"  # fresh k3s default; NOT hcloud-volumes
MANIFESTS="$(cd "$(dirname "$0")/manifests" && pwd)"

# image pins (read during the 2026-06-25 ceremony; override if rotated) — see README
INFISICAL_IMAGE="${INFISICAL_IMAGE:-infisical/infisical:v0.154.6}"
FORGEJO_IMAGE="${FORGEJO_IMAGE:-codeberg.org/forgejo/forgejo:8.0.3}"
J2_SAMPLE_REPO="${J2_SAMPLE_REPO:-dashboard}"               # a repo present in the registry mirror

STEP_RTO=()                       # indexed array (keys 0-6); avoids bash-4-only `declare -A` (macOS bash is 3.2)
DRILL_RESULT="FAIL"                # fail-closed: only ever set PASS at the very end
ETCD_RESTORE_PATH="unknown"
TOTAL_RTO=""

export WORK LOG EVID_OUT S3_HOST S3_ENDPOINT RESTIC_BUCKET CNPG_BUCKET_OL \
       REGISTRY_MIRROR_BUCKET ESCROW_S3 ETCD_BUCKET ETCD_FOLDER ESCROW_IDENTITY ESCROW_BUNDLE ESCROW_ENV \
       CANARY_SECRET_PATH CANARY_EXPECTED_SHA256 TEMP_BOX_NAME TEMP_BOX_TYPE \
       SCRATCH_DOMAIN SCRATCH_KUBECONFIG SCRATCH_STORAGECLASS MANIFESTS \
       INFISICAL_IMAGE FORGEJO_IMAGE J2_SAMPLE_REPO DRILL_TS

source "$(dirname "$0")/assertions.sh"

exec > >(tee -a "$LOG") 2>&1
log(){ echo "[$(date -u '+%H:%M:%S')] $*"; }
hr(){ printf '%.0s=' {1..70}; echo; }

# ── guards: no prod host in play; always destroy the box + always record ────
assert_no_prod_dns

cleanup(){
  local rc=$?
  log "CLEANUP: destroying temp box ${TEMP_BOX_NAME} (rc=${rc}, result=${DRILL_RESULT})"
  shred -u "${ESCROW_ENV}" 2>/dev/null || rm -f "${ESCROW_ENV}" 2>/dev/null || true
  if [ "${KEEP_BOX:-0}" = "1" ]; then
    log "KEEP_BOX=1 — NOT destroying ${TEMP_BOX_NAME} (manual teardown owed: hcloud server delete ${TEMP_BOX_NAME})"
  else
    hcloud server delete "${TEMP_BOX_NAME}" >/dev/null 2>&1 || log "WARN box already gone / never created"
  fi
  # scratch DNS lived only in the box /etc/hosts → died with the box. Nothing prod to revert.
  write_evidence_record         # always emit the posture record (PASS or FAIL)
  log "Evidence written: ${EVID_OUT}"
  log "DRILL ${DRILL_RESULT}. Total RTO: ${TOTAL_RTO:-n/a}s"
  log "File the evidence record via the restormel-isms-records skill (append-only under evidence/)."
}
trap cleanup EXIT

T0=$SECONDS
hr; log "STAGE-C COLD-START DRILL START ${DRILL_TS}"; hr
log "store=${RESTIC_BUCKET}  cnpg=${CNPG_BUCKET_OL}  registry=${REGISTRY_MIRROR_BUCKET}"

# ── PREFLIGHT — assert tools + that every S3 restore source EXISTS (read-only)
preflight_checks

# ── STEP 0 — fresh box + etcd-from-S3 (J10) ────────────────────────────────
s=$SECONDS
log "STEP 0: provision throwaway box + restore etcd from S3"
provision_temp_box "${TEMP_BOX_NAME}"
write_scratch_hosts "${SCRATCH_DOMAIN}"
lock_box_egress_to_s3            # SAFETY: restored CCM/external-dns must NOT reach the real Hetzner project
if fetch_etcd_snapshot_from_s3; then
  k3s_cluster_reset_restore
  assert_etcd_loaded
  ETCD_RESTORE_PATH="etcd-s3"
else
  log "STEP 0: etcd snapshot unusable → GitOps-fallback path (J10 NOT validated this run; PARTIAL — see §3.1)"
  bring_up_clean_k3s            # fallback: clean single-node k3s, rebuilt purely by GitOps
  ETCD_RESTORE_PATH="gitops-fallback"
fi
STEP_RTO[0]=$((SECONDS-s)); log "STEP 0: PASS (${STEP_RTO[0]}s, path=${ETCD_RESTORE_PATH})"

# ── STEP 1 — Infisical (J4+J5) — THE DECISIVE GATE (C2) ────────────────────
s=$SECONDS
log "STEP 1: restore Infisical (J4 ciphertext + J5 master key from sealed escrow)"
open_escrow_bundle                                   # opens eso-bootstrap.age ONCE with the OFFLINE key
restore_scratch_postgres "infisical"                 # restic → pg_restore into scratch CNPG
stand_up_scratch_infisical                           # scratch Infisical over restored PG + J5 from escrow
assert_canary_decrypts "${CANARY_SECRET_PATH}" "${CANARY_EXPECTED_SHA256}"   # C2: match-or-FAIL
STEP_RTO[1]=$((SECONDS-s)); log "STEP 1: PASS (${STEP_RTO[1]}s) — canary decrypted (C2 satisfied)"

# ── STEP 2 — Forgejo + registry (J1+J2+J3) ─────────────────────────────────
s=$SECONDS
log "STEP 2: restore Forgejo DB + repos + pull a sample image from the S3 registry mirror"
restore_scratch_postgres "forgejo"
restore_sample_repo_and_fsck                         # git fsck clean (J1)
assert_registry_image_pullable_from_mirror           # manifest + ≥1 layer from the OCI mirror (J2)
STEP_RTO[2]=$((SECONDS-s)); log "STEP 2: PASS (${STEP_RTO[2]}s)"

# ── STEP 3 — ESO + Argo re-point (C1) ──────────────────────────────────────
s=$SECONDS
log "STEP 3: recreate ESO machine-identity FROM ESCROW (C1); ClusterSecretStores Valid; Argo at restored Forgejo"
recreate_machine_identity_from_escrow                # C1 — from the SAME opened bundle
install_eso_and_argo
repoint_clustersecretstores_at_scratch_infisical     # hostAPI → secrets.${SCRATCH_DOMAIN}
point_app_of_apps_at_scratch_forgejo                 # repoURL → git.${SCRATCH_DOMAIN}
assert_clustersecretstores_valid
assert_canary_externalsecret_renders
STEP_RTO[3]=$((SECONDS-s)); log "STEP 3: PASS (${STEP_RTO[3]}s) — C1 escrow sufficient"

# ── STEP 4 — platform rebuild ──────────────────────────────────────────────
s=$SECONDS
log "STEP 4: Argo rebuilds platform (CNPG op, ESO, cert-manager, ingress, Barman ObjectStore CR)"
sync_cluster_addons
assert_no_imagepullbackoff                           # proves Step 2 registry is real
assert_no_externalsecret_syncerror                   # proves Step 1 Infisical is real
STEP_RTO[4]=$((SECONDS-s)); log "STEP 4: PASS (${STEP_RTO[4]}s)"

# ── STEP 5 — data tier (J6/J7/J8 via Barman recovery + J9 Surreal) ─────────
s=$SECONDS
log "STEP 5: CNPG bootstrap.recovery from Barman + Surreal restic restore"
ROTATE_PG="$(pick_rotating_cnpg_cluster)"
cnpg_bootstrap_recovery "${ROTATE_PG}"
assert_cnpg_healthy "${ROTATE_PG}"
restore_surreal_from_restic
assert_rowcounts_above_floor "${ROTATE_PG}"
STEP_RTO[5]=$((SECONDS-s)); log "STEP 5: PASS (${STEP_RTO[5]}s, pg=${ROTATE_PG})"

# ── STEP 6 — apps up + validate ────────────────────────────────────────────
s=$SECONDS
log "STEP 6: Argo syncs apps; scratch ingress serves; app returns 200 on SCRATCH host"
sync_app_workloads
assert_app_200_on_scratch_host
assert_eso_stores_valid
[ "${DRILL_FULL_ROUNDTRIP:-0}" = "1" ] && assert_ci_registry_argo_roundtrip
STEP_RTO[6]=$((SECONDS-s)); log "STEP 6: PASS (${STEP_RTO[6]}s)"

# ── verdict ─────────────────────────────────────────────────────────────────
TOTAL_RTO=$((SECONDS-T0))
DRILL_RESULT="PASS"
hr
if [ "${ETCD_RESTORE_PATH}" = "etcd-s3" ]; then
  log "DRILL PASS — total RTO ${TOTAL_RTO}s (path=etcd-s3 → Stage-C gate SATISFIABLE; see verdict in evidence record)"
else
  DRILL_RESULT="PASS-PARTIAL"
  log "DRILL PASS-PARTIAL — total RTO ${TOTAL_RTO}s (gitops-fallback path; J10 NOT validated → does NOT license Stage D/E)"
fi
hr
# cleanup() (trap) shreds the escrow env, destroys the box, writes the evidence record.
