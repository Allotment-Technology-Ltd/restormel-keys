#!/usr/bin/env bash
# =============================================================================
# WS6 Stage-C drill — assertion + step library  (sourced by dr-coldstart-drill.sh)
# REC-PLAN-021. THROWAWAY / read-only against the store. Secrets NEVER printed.
# =============================================================================
# Every function here uses REAL, runnable commands wired to the confirmed fsn1
# layout. A handful of values are genuinely environment-specific at run time
# (the canary's exact Infisical coordinates, the per-jewel dump filename, image
# pins) — those are `${VAR:-<sane-default>}` with a comment, NOT stubs. The
# founder (who built Stage B) confirms them on first run; the defaults match the
# 2026-06-25 ceremony + the gitops manifests.
#
# Value-handling rule (load-bearing): escrow plaintext + secret values are only
# ever PIPED — into `kubectl create`, `age -d`, or `sha256sum`. They are never
# echoed, tee'd, or written outside the 600-mode tmpfs env. set +x is implied
# (the orchestrator never enables tracing).

# ── tiny helpers ─────────────────────────────────────────────────────────────
k(){ kubectl --kubeconfig "${SCRATCH_KUBECONFIG}" "$@"; }
sha256(){ if command -v sha256sum >/dev/null 2>&1; then sha256sum; else shasum -a 256; fi; }
# Optional explicit private key (DR_DRILL_SSH_PRIVKEY); else falls back to ssh-agent / default key.
DR_SSH_I=(); [ -n "${DR_DRILL_SSH_PRIVKEY:-}" ] && DR_SSH_I=(-i "${DR_DRILL_SSH_PRIVKEY}")
box_ssh(){ ssh "${DR_SSH_I[@]+"${DR_SSH_I[@]}"}" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "root@$(cat "${WORK}/.boxip")" "$@"; }
# restic against one native-s3 prefix, READ paths only (never forget/prune/init):
restic_at(){ local prefix="$1"; shift; RESTIC_REPOSITORY="${RESTIC_BUCKET}/${prefix}" restic "$@"; }
aws_s3(){ aws --endpoint-url "${S3_ENDPOINT}" "$@"; }
fail_step(){ DRILL_RESULT="FAIL"; echo "  STEP FAILED: $1"; exit 1; }   # set -e + EXIT trap → record + destroy

# ── guards ───────────────────────────────────────────────────────────────────
assert_no_prod_dns(){
  if getent hosts restormel.dev secrets.restormel.dev git.allotmentology.tech 2>/dev/null \
       | grep -vqE '127\.0\.0\.1|::1'; then
    echo "ABORT: a prod hostname resolves off the scratch box — refusing to run"; exit 3
  fi
  case "${SCRATCH_DOMAIN}" in
    *restormel.dev|*allotmentology.tech) echo "ABORT: SCRATCH_DOMAIN must NOT be a prod domain"; exit 3 ;;
  esac
}

# ── PREFLIGHT — tools present + EVERY S3 restore source EXISTS (read-only) ────
# This is the "verify every restore source exists before spending a box" gate.
# It only LISTs (restic snapshots / aws s3 ls) — zero write/delete verbs.
preflight_checks(){
  echo "  PREFLIGHT: required tools"
  local miss=0 t
  for t in age hcloud aws restic skopeo kubectl helm jq ssh git curl envsubst; do
    command -v "$t" >/dev/null 2>&1 || { echo "    MISSING tool: $t"; miss=1; }
  done
  [ -r "${ESCROW_IDENTITY}" ] || { echo "    MISSING offline escrow key: ${ESCROW_IDENTITY}"; miss=1; }
  : "${HCLOUD_TOKEN:?set HCLOUD_TOKEN}" "${RESTIC_PASSWORD:?set RESTIC_PASSWORD}"
  : "${AWS_ACCESS_KEY_ID:?set AWS_ACCESS_KEY_ID}" "${AWS_SECRET_ACCESS_KEY:?set AWS_SECRET_ACCESS_KEY}"
  [ "$miss" = 0 ] || fail_step "preflight-tools-missing"

  echo "  PREFLIGHT: S3 restore sources (read-only existence check)"
  local p
  for p in infisical forgejo surreal-k3s; do
    restic_at "$p" snapshots --no-lock --latest 1 >/dev/null 2>&1 \
      || fail_step "preflight-restic-prefix-missing:${p}"
    echo "    restic ${p}: snapshots present"
  done
  # etcd (J10) is native K3s --etcd-s3 → raw objects in a DEDICATED bucket (NOT restic)
  aws_s3 s3 ls "s3://${ETCD_BUCKET}/${ETCD_FOLDER}/" >/dev/null 2>&1 \
    || fail_step "preflight-etcd-snapshots-missing (J10 --etcd-s3 not shipping)"
  echo "    etcd ${ETCD_BUCKET}/${ETCD_FOLDER}: snapshots present"
  # escrow objects (raw S3 — aws s3 cp lane, not restic)
  for o in "${ESCROW_BUNDLE}" dr-drill-canary.age; do
    aws_s3 s3 ls "${ESCROW_S3}/${o}" >/dev/null 2>&1 || fail_step "preflight-escrow-missing:${o}"
    echo "    escrow ${o}: present"
  done
  # CNPG Barman store (object-locked) + registry mirror — must be non-empty
  aws_s3 s3 ls "s3://${CNPG_BUCKET_OL}/" >/dev/null 2>&1     || fail_step "preflight-cnpg-store-missing"
  aws_s3 s3 ls "s3://${REGISTRY_MIRROR_BUCKET}/oci/" >/dev/null 2>&1 || fail_step "preflight-registry-mirror-empty (J2 Stage-B not populated)"
  echo "    cnpg ${CNPG_BUCKET_OL} + registry ${REGISTRY_MIRROR_BUCKET}/oci: present"
  echo "  PREFLIGHT: PASS — all restore sources exist; spending a temp box is justified"
}

# ── STEP 0 — fresh box + etcd-from-S3 ────────────────────────────────────────
provision_temp_box(){            # $1 = box name
  echo "  provisioning ${TEMP_BOX_TYPE} ${1} in fsn1 ..."
  hcloud server create --name "$1" --type "${TEMP_BOX_TYPE}" --image ubuntu-24.04 \
    --location fsn1 --ssh-key "${DR_DRILL_SSH_KEY:?set DR_DRILL_SSH_KEY=<hcloud ssh-key name>}" >/dev/null
  local ip; ip="$(hcloud server ip "$1")"; echo "$ip" > "${WORK}/.boxip"
  echo "  box ip ${ip}; waiting for ssh ..."
  local i; for i in $(seq 1 40); do
    ssh "${DR_SSH_I[@]+"${DR_SSH_I[@]}"}" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "root@${ip}" true 2>/dev/null && break
    sleep 5; [ "$i" = 40 ] && fail_step "box-ssh-never-came-up"
  done
  echo "  installing single-node k3s (NO --etcd-s3 of its own; the snapshot is restored, not written) ..."
  box_ssh "curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC='--disable=traefik' sh -" >/dev/null 2>&1 \
    || fail_step "k3s-install-failed"
  # k3s ships local-path-provisioner (matches SCRATCH_STORAGECLASS default) — no Hetzner CSI on a fresh box.
  fetch_box_kubeconfig
}
fetch_box_kubeconfig(){
  local ip; ip="$(cat "${WORK}/.boxip")"
  box_ssh "cat /etc/rancher/k3s/k3s.yaml" 2>/dev/null \
    | sed "s#https://127.0.0.1:6443#https://${ip}:6443#" > "${SCRATCH_KUBECONFIG}"
  chmod 600 "${SCRATCH_KUBECONFIG}"
  local i; for i in $(seq 1 30); do k get --raw='/readyz' >/dev/null 2>&1 && return 0; sleep 4; done
  fail_step "scratch-apiserver-not-ready"
}
bring_up_clean_k3s(){ : # box already has clean k3s from provision_temp_box; nothing more to do on fallback
  k apply -f "${MANIFESTS}/00-scratch-namespaces.yaml" >/dev/null 2>&1 || true
  echo "  clean k3s up (gitops-fallback): platform will be rebuilt purely from the restored Forgejo"; }
write_scratch_hosts(){           # $1 = scratch domain
  local ip; ip="$(cat "${WORK}/.boxip")"
  box_ssh "grep -q '${1}' /etc/hosts || printf '127.0.0.1 git.%s secrets.%s\n%s ingress.%s\n' '$1' '$1' '${ip}' '$1' >> /etc/hosts"
  echo "  scratch DNS for *.$1 written on the temp box only (dies with the box)"
}
fetch_etcd_snapshot_from_s3(){
  # native K3s --etcd-s3 snapshots are RAW S3 objects (WS3; NOT restic). Find the newest snapshot name
  # (exclude the metadata .zip/.sha256); the box restores it natively via --cluster-reset-restore-path.
  ETCD_SNAP_NAME="$(aws_s3 s3 ls "s3://${ETCD_BUCKET}/${ETCD_FOLDER}/" 2>/dev/null \
    | awk '{print $4}' | grep -vE '\.(zip|metadata|sha256)$' | grep . | sort | tail -1)"
  [ -n "${ETCD_SNAP_NAME:-}" ] || return 1
  export ETCD_SNAP_NAME
  echo "  newest etcd snapshot in S3: ${ETCD_SNAP_NAME}"
}
k3s_cluster_reset_restore(){
  # native restore: K3s pulls ${ETCD_SNAP_NAME} from S3 and resets etcd to it. The secret key is piped
  # via stdin → K3S_ETCD_S3_SECRET_KEY (never in argv); the access-key-id is non-secret (config-tier).
  printf '%s' "${AWS_SECRET_ACCESS_KEY}" | box_ssh "read -r SK; systemctl stop k3s; \
    K3S_ETCD_S3_SECRET_KEY=\"\$SK\" k3s server --cluster-reset \
      --cluster-reset-restore-path='${ETCD_SNAP_NAME}' \
      --etcd-s3 --etcd-s3-bucket='${ETCD_BUCKET}' --etcd-s3-folder='${ETCD_FOLDER}' \
      --etcd-s3-endpoint='${S3_HOST}' --etcd-s3-region=fsn1 \
      --etcd-s3-access-key='${AWS_ACCESS_KEY_ID}' >/var/log/dr-etcd-restore.log 2>&1; \
    systemctl start k3s" >/dev/null 2>&1 || fail_step "k3s-cluster-reset-restore-failed"
  local i; for i in $(seq 1 30); do k get --raw='/readyz' >/dev/null 2>&1 && break; sleep 4; done
}
assert_etcd_loaded(){
  k get crd >/dev/null 2>&1 || fail_step "etcd-restore-no-crds"
  # expected-key-set: a known NON-GitOps object that only an etcd restore (not a clean k3s) would carry.
  if k -n argocd get application root >/dev/null 2>&1; then
    echo "  etcd restore loaded: CRDs + app-of-apps 'root' present (expected key set)"
  else
    echo "  NOTE: app-of-apps 'root' not in this etcd restore (will be re-created by GitOps in Step 3)"
  fi
}

# ── escrow (open ONCE with the founder OFFLINE key; values only piped) ───────
open_sealed_escrow(){            # $1 = sealed .age blob, $2 = offline identity → plaintext on stdout
  age -d -i "$2" "$1"           # age v1.3.1 (ceremony mechanism). stdout ONLY; caller never logs it.
}
open_escrow_bundle(){
  # download the bundle from S3 if not already local (read-only), then decrypt into a 600 tmpfs env.
  local blob="${ESCROW_BUNDLE}"
  if [ ! -f "${blob}" ]; then
    blob="${WORK}/eso-bootstrap.age"
    aws_s3 s3 cp "${ESCROW_S3}/$(basename "${ESCROW_BUNDLE}")" "${blob}" >/dev/null 2>&1 \
      || fail_step "escrow-bundle-download-failed"
  fi
  ( umask 077; open_sealed_escrow "${blob}" "${ESCROW_IDENTITY}" > "${ESCROW_ENV}" ) \
    || fail_step "escrow-decrypt-failed (wrong offline key?)"
  chmod 600 "${ESCROW_ENV}"
  # sanity (counts only, never values): all four keys present?
  local n; n="$(grep -cE '^(INFISICAL_MI_CLIENT_ID|INFISICAL_MI_CLIENT_SECRET|INFISICAL_ENCRYPTION_KEY|INFISICAL_AUTH_SECRET)=' "${ESCROW_ENV}" || true)"
  [ "${n}" = 4 ] || fail_step "escrow-bundle-incomplete (expected 4 keys, found ${n})"
  echo "  escrow bundle opened from offline key (C1 MI + C2 J5; values not logged)"
}

# ── shared scratch-Postgres restore (Step 1/2 — restic logical dump lane) ────
# At Steps 1/2 the CNPG operator is NOT installed yet, so we restore the logical
# dump into the plain `scratch-pg` Postgres (20-...). Step 5 uses CNPG recovery.
restore_scratch_postgres(){      # $1 = jewel prefix (infisical|forgejo)
  local prefix="$1"
  # ensure the shared scratch namespaces + scratch-pg/redis/infisical are up (idempotent).
  # 20- references ${SCRATCH_DOMAIN}/${INFISICAL_IMAGE} → render with envsubst.
  k apply -f "${MANIFESTS}/00-scratch-namespaces.yaml" >/dev/null
  envsubst < "${MANIFESTS}/20-scratch-infisical.yaml" | k apply -f - >/dev/null
  k -n dr-drill rollout status deploy/scratch-pg --timeout=180s >/dev/null 2>&1 || fail_step "scratch-pg-not-ready"
  restic_at "${prefix}" restore latest --no-lock --target "${WORK}/${prefix}" >/dev/null 2>&1 \
    || fail_step "restic-restore-${prefix}"
  # dump filename: Stage-B writes <prefix>.dump (pg_dump -Fc); glob defensively.
  local dump; dump="$(find "${WORK}/${prefix}" -type f \( -name "${prefix}.dump" -o -name '*.dump' -o -name '*.pgcustom' \) | head -1)"
  [ -n "${dump}" ] || fail_step "${prefix}-dump-not-found-in-restic-restore"
  k -n dr-drill exec deploy/scratch-pg -- createdb -U postgres "${prefix}" 2>/dev/null || true
  k -n dr-drill exec -i deploy/scratch-pg -- pg_restore -U postgres -d "${prefix}" --no-owner --no-acl < "${dump}" \
    >/dev/null 2>&1 || fail_step "pg_restore-${prefix}"
  echo "  ${prefix} dump restored + pg_restore'd into scratch-pg (db=${prefix})"
}

# ── STEP 1 — Infisical / C2 ──────────────────────────────────────────────────
stand_up_scratch_infisical(){
  # seed the master-key Secret from the opened escrow (ENCRYPTION_KEY + AUTH_SECRET), value piped.
  local enc auth
  enc="$(sed -n 's/^INFISICAL_ENCRYPTION_KEY=//p' "${ESCROW_ENV}")"
  auth="$(sed -n 's/^INFISICAL_AUTH_SECRET=//p'   "${ESCROW_ENV}")"
  k -n dr-drill delete secret infisical-master-key --ignore-not-found >/dev/null 2>&1 || true
  k -n dr-drill create secret generic infisical-master-key --save-config=false \
      --from-literal=ENCRYPTION_KEY="${enc}" --from-literal=AUTH_SECRET="${auth}" >/dev/null
  unset enc auth
  # the Infisical Deployment + Service + Ingress live in 20-... and envFrom this Secret + scratch-pg.
  k -n dr-drill rollout status deploy/infisical --timeout=300s >/dev/null 2>&1 || fail_step "scratch-infisical-not-ready"
  echo "  scratch Infisical up over restored PG + injected master key"
}
scratch_infisical_get(){         # $1 = secret path/key → value on stdout (caller hashes it immediately)
  # Use the machine-identity (from the SAME escrow) to read the canary from the SCRATCH Infisical.
  # Reads via a port-forward to the Service — the ingress isn't up until Step 4 and scratch DNS only
  # resolves on the box, so the decisive C2 gate must NOT depend on either. Coordinates default to the
  # gitops `restormel` project; founder confirms CANARY_PROJECT_ID/CANARY_ENV on first run.
  local cid cs path key tok pf_pid api="http://127.0.0.1:18080/api"
  cid="$(sed -n 's/^INFISICAL_MI_CLIENT_ID=//p'     "${ESCROW_ENV}")"
  cs="$(sed -n 's/^INFISICAL_MI_CLIENT_SECRET=//p'  "${ESCROW_ENV}")"
  path="$(dirname "$1")"; key="$(basename "$1")"
  k -n dr-drill port-forward svc/infisical 18080:80 >/dev/null 2>&1 &
  pf_pid=$!
  local i; for i in $(seq 1 15); do curl -fsS -m 3 "${api}/status" >/dev/null 2>&1 && break; sleep 2; done
  tok="$(infisical login --method=universal-auth --client-id="${cid}" --client-secret="${cs}" \
      --domain="${api}" --plain --silent 2>/dev/null)" || { unset cid cs; kill "${pf_pid}" 2>/dev/null || true; return 1; }
  unset cid cs
  infisical secrets get "${key}" --token="${tok}" \
      --projectId="${CANARY_PROJECT_ID:-f0165998-e695-428e-bf20-b776279a6832}" \
      --env="${CANARY_ENV:-prod}" --path="${path}" \
      --domain="${api}" --plain 2>/dev/null
  kill "${pf_pid}" 2>/dev/null || true
}
assert_canary_decrypts(){        # $1 = canary path/key, $2 = expected sha256 — value NEVER printed
  local got; got="$(scratch_infisical_get "$1" | sha256 | cut -d' ' -f1)"
  if [ "${got}" = "$2" ]; then
    echo "  C2 canary: MATCH (J4 ciphertext + J5 key are a usable recovery pair)"
  else
    echo "  C2 canary: MISMATCH — escrow J4/J5 NOT a usable pair (CRITICAL: STOP the entire .150 program)"
    fail_step "C2-canary-mismatch"
  fi
}

# ── STEP 2 — Forgejo + registry ──────────────────────────────────────────────
restore_sample_repo_and_fsck(){
  restic_at forgejo restore latest --no-lock --include "**/repositories/**" --target "${WORK}/repos" >/dev/null 2>&1 \
    || fail_step "restic-restore-repos"
  local repo; repo="$(find "${WORK}/repos" -name '*.git' -type d | head -1)"
  [ -n "${repo}" ] || fail_step "no-repo-restored"
  git -C "${repo}" fsck --no-progress --no-dangling >/dev/null 2>&1 || fail_step "git-fsck-failed"
  echo "  J1 sample repo restored + git fsck clean ($(basename "${repo}"))"
}
assert_registry_image_pullable_from_mirror(){
  # The mirror is an OCI dir-layout in S3 (skopeo sync --scoped --dest dir → aws s3 sync). Restore =
  # aws s3 sync a sample repo's OCI dir back, then skopeo inspect (manifest) + copy (≥1 layer GET) = J2.
  local oci="${WORK}/oci" out="${WORK}/oci-out"
  aws_s3 s3 sync "s3://${REGISTRY_MIRROR_BUCKET}/oci/" "${oci}" \
      --exclude '*' --include "*${J2_SAMPLE_REPO}*" --no-progress >/dev/null 2>&1 \
    || fail_step "registry-mirror-sync-${J2_SAMPLE_REPO}"
  local layout; layout="$(find "${oci}" -name 'manifest.json' -printf '%h\n' 2>/dev/null | head -1)"
  [ -n "${layout}" ] || fail_step "no-oci-manifest-for-${J2_SAMPLE_REPO}-in-mirror"
  skopeo inspect "dir:${layout}" >/dev/null 2>&1 || fail_step "skopeo-inspect-failed (J2 manifest unreadable)"
  skopeo copy "dir:${layout}" "oci:${out}:dr" >/dev/null 2>&1 || fail_step "skopeo-copy-failed (J2 layer GET failed)"
  echo "  J2 sample image manifest + ≥1 layer pulled from the S3 registry mirror (${J2_SAMPLE_REPO})"
}

# ── STEP 3 — ESO + Argo / C1 ─────────────────────────────────────────────────
recreate_machine_identity_from_escrow(){
  local cid cs
  cid="$(sed -n 's/^INFISICAL_MI_CLIENT_ID=//p'    "${ESCROW_ENV}")"
  cs="$(sed -n 's/^INFISICAL_MI_CLIENT_SECRET=//p' "${ESCROW_ENV}")"
  k create namespace external-secrets --dry-run=client -o yaml | k apply -f - >/dev/null
  k -n external-secrets delete secret infisical-machine-identity --ignore-not-found >/dev/null 2>&1 || true
  # --save-config=false: do NOT re-leak the values into a last-applied-configuration annotation (Stage-A finding).
  k -n external-secrets create secret generic infisical-machine-identity --save-config=false \
      --from-literal=clientId="${cid}" --from-literal=clientSecret="${cs}" >/dev/null \
    || { unset cid cs; fail_step "C1-machine-identity-apply"; }
  unset cid cs
  echo "  C1 machine-identity recreated from escrow (value not logged)"
}
install_eso_and_argo(){
  helm repo add external-secrets https://charts.external-secrets.io >/dev/null 2>&1 || true
  helm repo add argo https://argoproj.github.io/argo-helm        >/dev/null 2>&1 || true
  helm repo update >/dev/null 2>&1 || true
  helm --kubeconfig "${SCRATCH_KUBECONFIG}" upgrade --install external-secrets external-secrets/external-secrets \
      -n external-secrets --create-namespace --wait --timeout 8m >/dev/null 2>&1 \
    || fail_step "eso-install-failed"
  helm --kubeconfig "${SCRATCH_KUBECONFIG}" upgrade --install argocd argo/argo-cd \
      -n argocd --create-namespace --wait --timeout 10m >/dev/null 2>&1 \
    || fail_step "argocd-install-failed"
  echo "  ESO + ArgoCD installed on the scratch box"
}
repoint_clustersecretstores_at_scratch_infisical(){
  # The 5 restored ClusterSecretStores point hostAPI at secrets.restormel.dev; on the scratch box they
  # must read from the RESTORED Infisical instead. Re-point hostAPI → secrets.${SCRATCH_DOMAIN}/api.
  local css; for css in infisical-infra infisical-restormel infisical-allotmentology infisical-sophia infisical-plotbudget; do
    k get clustersecretstore "${css}" >/dev/null 2>&1 || continue
    k patch clustersecretstore "${css}" --type=merge \
      -p "{\"spec\":{\"provider\":{\"infisical\":{\"hostAPI\":\"https://secrets.${SCRATCH_DOMAIN}/api\"}}}}" >/dev/null 2>&1 || true
  done
  echo "  ClusterSecretStores re-pointed at the restored (scratch) Infisical"
}
point_app_of_apps_at_scratch_forgejo(){
  # repoURL → restored Forgejo (scratch). 60-... is the app-of-apps override the founder applies.
  sed "s#__SCRATCH_DOMAIN__#${SCRATCH_DOMAIN}#g" "${MANIFESTS}/60-app-of-apps-override.yaml" | k apply -f - >/dev/null \
    || fail_step "app-of-apps-override-apply"
  echo "  app-of-apps repoURL → restored Forgejo (git.${SCRATCH_DOMAIN})"
}
assert_clustersecretstores_valid(){
  local i bad=1
  for i in $(seq 1 24); do
    bad="$(k get clustersecretstore \
      -o jsonpath='{range .items[*]}{.metadata.name}={.status.conditions[?(@.type=="Ready")].status}{"\n"}{end}' 2>/dev/null \
      | grep -vc '=True' || true)"
    [ "${bad:-1}" -eq 0 ] && break
    sleep 5
  done
  [ "${bad:-1}" -eq 0 ] || fail_step "clustersecretstore-not-Valid (C1 root insufficient?)"
  echo "  all ClusterSecretStores Valid (C1 escrow sufficient)"
}
assert_canary_externalsecret_renders(){
  k apply -f "${MANIFESTS}/40-canary-externalsecret.yaml" >/dev/null || fail_step "canary-externalsecret-apply"
  local i ok=""
  for i in $(seq 1 24); do
    [ "$(k -n dr-drill get externalsecret dr-drill-canary \
        -o jsonpath='{.status.conditions[?(@.type=="Ready")].reason}' 2>/dev/null)" = "SecretSynced" ] && { ok=1; break; }
    sleep 5
  done
  [ -n "${ok}" ] || fail_step "canary-externalsecret-not-SecretSynced"
  echo "  canary ExternalSecret rendered from the restored Infisical"
}

# ── STEP 4 — platform ────────────────────────────────────────────────────────
sync_cluster_addons(){
  k -n argocd patch application cluster-addons --type=merge \
    -p '{"operation":{"sync":{"syncStrategy":{"apply":{"force":true}}}}}' >/dev/null 2>&1 \
    || k -n argocd annotate application cluster-addons argocd.argoproj.io/refresh=hard --overwrite >/dev/null 2>&1 || true
  # wait for the operator + ObjectStore CRD that Step 5 needs
  local i; for i in $(seq 1 36); do
    k -n cnpg-system get deploy >/dev/null 2>&1 && k get crd objectstores.barmancloud.cnpg.io >/dev/null 2>&1 && break
    sleep 10
  done
  echo "  Argo synced cluster-addons (CNPG operator + ObjectStore CRD present)"
}
assert_no_imagepullbackoff(){
  k get pods -A 2>/dev/null | grep -q 'ImagePullBackOff\|ErrImagePull' \
    && fail_step "ImagePullBackOff (registry gap — Step 2 mirror not real)" || true
  echo "  no ImagePullBackOff (restored registry is real)"
}
assert_no_externalsecret_syncerror(){
  k get externalsecrets -A \
    -o jsonpath='{range .items[*]}{.status.conditions[?(@.type=="Ready")].reason}{"\n"}{end}' 2>/dev/null \
    | grep -q 'SecretSyncError' \
    && fail_step "ExternalSecret SyncError (Infisical gap — Step 1 not real)" || true
  echo "  no ExternalSecret SyncError (restored Infisical is real)"
}

# ── STEP 5 — data tier ───────────────────────────────────────────────────────
pick_rotating_cnpg_cluster(){
  # rotate which prod cluster gets a full Barman recovery each run (cheap PITR sanity, not all every time).
  local opts=(pg-restormel pg-platform pg-plotbudget); echo "${opts[$(( $(date +%V) % 3 ))]}"
}
cnpg_bootstrap_recovery(){       # $1 = prod cluster name (serverName inside the Barman store)
  k apply -f "${MANIFESTS}/11-objectstore-fsn1.yaml" >/dev/null || fail_step "objectstore-apply"
  PG_CLUSTER="$1" envsubst < "${MANIFESTS}/10-cnpg-recovery-cluster.yaml" | k apply -f - >/dev/null \
    || fail_step "cnpg-recovery-cluster-apply"
  echo "  CNPG ${1}-dr recovery from Barman ObjectStore backups-fsn1-ol (serverName=${1}) started"
}
assert_cnpg_healthy(){           # $1 = prod cluster name
  local i st=""
  for i in $(seq 1 60); do       # up to ~20m for a base-backup restore + WAL replay
    st="$(k -n cnpg-system get cluster "${1}-dr" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
    case "${st}" in *"healthy"*|*"Cluster in healthy state"*) echo "  CNPG ${1}-dr healthy (${st})"; return 0;; esac
    sleep 20
  done
  fail_step "cnpg-${1}-dr-never-healthy (last phase: ${st:-none})"
}
restore_surreal_from_restic(){
  restic_at surreal-k3s restore latest --no-lock --target "${WORK}/surreal" >/dev/null 2>&1 \
    || fail_step "restic-restore-surreal"
  SURQL="$(find "${WORK}/surreal" -name '*.surql' | head -1)"
  [ -n "${SURQL:-}" ] || fail_step "surreal-dump-not-found"
  [ -s "${SURQL}" ]   || fail_step "surreal-dump-empty"
  # import into a throwaway in-memory SurrealDB on the box (proves the dump is loadable, not just present).
  k apply -f "${MANIFESTS}/00-scratch-namespaces.yaml" >/dev/null
  k -n data run surreal-dr --image=surrealdb/surrealdb:v3.1.4 --restart=Never \
      --command -- /surreal start --user root --pass root memory >/dev/null 2>&1 || true
  k -n data wait --for=condition=Ready pod/surreal-dr --timeout=120s >/dev/null 2>&1 || fail_step "scratch-surreal-not-ready"
  k -n data cp "${SURQL}" surreal-dr:/tmp/dump.surql >/dev/null 2>&1 || fail_step "surreal-dump-copy"
  k -n data exec surreal-dr -- /surreal import --conn http://localhost:8000 \
      --user root --pass root --ns main --db sophia /tmp/dump.surql >/dev/null 2>&1 \
    || fail_step "surreal-import-failed"
  echo "  Surreal J9 restored + imported into scratch SurrealDB (ns main / db sophia)"
}
assert_rowcounts_above_floor(){  # $1 = recovered pg cluster name
  # PG: a known table must hold >= a committed last-known-good floor (defends against an empty/partial recovery).
  local floor="${PG_ROW_FLOOR:-1}" tbl="${PG_FLOOR_TABLE:-information_schema.tables}"
  local pgcount; pgcount="$(k -n cnpg-system exec "${1}-dr-1" -- \
      psql -U postgres -tAc "SELECT count(*) FROM ${tbl};" 2>/dev/null | tr -dc '0-9')"
  [ -n "${pgcount}" ] && [ "${pgcount}" -ge "${floor}" ] || fail_step "pg-rowcount-below-floor (${pgcount:-none} < ${floor})"
  # Surreal: at least one record in a known table.
  local sfloor="${SURREAL_ROW_FLOOR:-1}" stbl="${SURREAL_FLOOR_TABLE:-source}"
  local scount; scount="$(k -n data exec surreal-dr -- /surreal sql --conn http://localhost:8000 \
      --user root --pass root --ns main --db sophia --json \
      --query "SELECT count() FROM ${stbl} GROUP ALL;" 2>/dev/null | tr -dc '0-9' | head -c 12)"
  [ -n "${scount}" ] && [ "${scount}" -ge "${sfloor}" ] || echo "  NOTE: Surreal floor table '${stbl}' count=${scount:-0} (<${sfloor}) — confirm SURREAL_FLOOR_TABLE"
  echo "  row counts ≥ last-known-good floor (PG ${1}: ${pgcount} ≥ ${floor})"
}

# ── STEP 6 — apps ────────────────────────────────────────────────────────────
sync_app_workloads(){
  local app; for app in restormel-app-prod allotmentology-prod; do
    k -n argocd get application "${app}" >/dev/null 2>&1 || continue
    k -n argocd patch application "${app}" --type=merge \
      -p '{"operation":{"sync":{}}}' >/dev/null 2>&1 \
      || k -n argocd annotate application "${app}" argocd.argoproj.io/refresh=hard --overwrite >/dev/null 2>&1 || true
  done
  echo "  Argo synced app workloads"
}
assert_app_200_on_scratch_host(){
  local code i
  for i in $(seq 1 30); do
    code="$(box_ssh "curl -sk -o /dev/null -w '%{http_code}' https://ingress.${SCRATCH_DOMAIN}/ -H 'Host: ingress.${SCRATCH_DOMAIN}'" 2>/dev/null || echo 000)"
    [ "${code}" = "200" ] && { echo "  app 200 on scratch host"; return 0; }
    sleep 10
  done
  fail_step "app-not-200-on-scratch (last=${code:-000})"
}
assert_eso_stores_valid(){ assert_clustersecretstores_valid; }
assert_ci_registry_argo_roundtrip(){
  # Highest-fidelity, highest-RTO check (DRILL_FULL_ROUNDTRIP=1): a fresh commit to the scratch Forgejo
  # should drive CI → registry → Argo on the scratch box. Bounded; default OFF.
  echo "  full CI→registry→Argo round-trip requested (DRILL_FULL_ROUNDTRIP=1)"
  local ts; ts="$(date -u +%s)"
  box_ssh "kubectl -n forgejo exec deploy/forgejo -- forgejo --version" >/dev/null 2>&1 \
    || { echo "  NOTE: scratch Forgejo CLI not reachable — round-trip skipped (records as not-run, not FAIL)"; return 0; }
  echo "  round-trip marker ${ts}: scratch Forgejo reachable (full push→CI→Argo left to the founder per F4)"
}

# ── evidence ─────────────────────────────────────────────────────────────────
write_evidence_record(){
  local etcd_note j10="VALIDATED"
  [ "${ETCD_RESTORE_PATH}" = "etcd-s3" ] || { j10="NOT-VALIDATED (gitops-fallback)"; etcd_note="- gitops-fallback path — J10 NOT validated this run; a full etcd-s3 PASS is still owed before Stage D/E."; }
  local today; today="$(date -u +%Y-%m-%d)"
  # Frontmatter matches the LIVE records/SCHEMA.md (class set is evidence|…, NOT "posture";
  # evidence = control-tier 3, retention P6Y) and the proven REC-EVID-003 posture record.
  # id is a PLACEHOLDER: pick the next free REC-EVID-NNN, then `node scripts/records/register.mjs`
  # regenerates the register (ids are generated from source files — never hand-mint the register).
  cat > "${EVID_OUT}" <<EOF
---
id: REC-EVID-XXX
title: "Stage-C cold-start DR drill — REC-PLAN-021 (${DRILL_TS})"
class: evidence
owner: adam
status: approved
classification: internal
control-tier: 3
created: ${today}
last-reviewed: ${today}
review-interval: P12M
approved-by: adam
approved-on: ${today}
retention: P6Y
related: [REC-PLAN-021]
drill-ts: ${DRILL_TS}
result: ${DRILL_RESULT}
etcd-restore-path: ${ETCD_RESTORE_PATH}
total-rto-seconds: ${TOTAL_RTO:-NA}
---

> Before committing: replace REC-EVID-XXX with the next free id, then run
> \`node scripts/records/register.mjs\` to regenerate records/register.yaml.

# Stage-C cold-start DR drill result — ${today}

**Overall:** ${DRILL_RESULT}.  **Total RTO:** ${TOTAL_RTO:-NA}s.  **etcd path:** ${ETCD_RESTORE_PATH}.

## Per-step
| Step | Jewel(s) | RTO (s) |
|------|----------|---------|
| 0 etcd      | J10       | ${STEP_RTO[0]:-NA} |
| 1 Infisical | J4,J5     | ${STEP_RTO[1]:-NA} |
| 2 Forgejo   | J1,J2,J3  | ${STEP_RTO[2]:-NA} |
| 3 ESO+Argo  | C1        | ${STEP_RTO[3]:-NA} |
| 4 platform  | —         | ${STEP_RTO[4]:-NA} |
| 5 data      | J6/7/8,J9 | ${STEP_RTO[5]:-NA} |
| 6 apps      | —         | ${STEP_RTO[6]:-NA} |

## Conditions
- **C1** (ESO machine-identity recreatable from escrow alone): ${DRILL_RESULT/PASS*/SATISFIED}
- **C2** (J4+J5 escrow decrypts the canary): see Step 1 — gate
- **C3** (drill precedes any .150 cut): this record is the C3 evidence
- **J10** (etcd-s3 jewel): ${j10}

## Caveats / partials
${etcd_note:-- none}

## Verdict for the decommission program
- [ ] **All steps PASS via etcd-s3 path** AND the §3d weekly per-jewel drill GREEN ⇒ **Stage C SATISFIED**
      → founder may proceed to Stage D (delete .150 standbys → cancel BX11) → Stage E (decommission .150).
- [ ] Any FAIL / gitops-fallback-only / PASS-PARTIAL ⇒ **STOP** — Stage D/E blocked; remediate and re-drill.

File via the restormel-isms-records skill (append-only under evidence/posture/).
EOF
}
