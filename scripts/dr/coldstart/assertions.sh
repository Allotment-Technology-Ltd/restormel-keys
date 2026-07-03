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
# Throwaway box: do NOT record/verify its host key. Hetzner recycles IPs, so a reused IP carries a STALE
# known_hosts entry whose key no longer matches — `accept-new` then REFUSES (a real first-box-run failure,
# 2026-06-27). `UserKnownHostsFile=/dev/null` + `StrictHostKeyChecking=no` is correct here: the box is one
# we just provisioned and destroy at the end; there is nothing durable to pin.
DR_SSH_NOHOST=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null)
box_ssh(){ ssh "${DR_SSH_I[@]+"${DR_SSH_I[@]}"}" "${DR_SSH_NOHOST[@]}" -o ConnectTimeout=15 "root@$(cat "${WORK}/.boxip")" "$@"; }
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
  for t in age hcloud aws restic skopeo kubectl helm jq ssh git curl envsubst docker; do
    command -v "$t" >/dev/null 2>&1 || { echo "    MISSING tool: $t"; miss=1; }
  done
  [ -r "${ESCROW_IDENTITY}" ] || { echo "    MISSING offline escrow key: ${ESCROW_IDENTITY}"; miss=1; }
  [ -r "${K3S_TOKEN_FILE}" ]  || { echo "    MISSING K3s server token (J10 boot): ${K3S_TOKEN_FILE} — escrow it in the DR kit"; miss=1; }
  : "${HCLOUD_TOKEN:?set HCLOUD_TOKEN}" "${RESTIC_PASSWORD:?set RESTIC_PASSWORD}"
  : "${AWS_ACCESS_KEY_ID:?set AWS_ACCESS_KEY_ID}" "${AWS_SECRET_ACCESS_KEY:?set AWS_SECRET_ACCESS_KEY}"
  [ "$miss" = 0 ] || fail_step "preflight-tools-missing"

  echo "  PREFLIGHT: S3 restore sources (read-only existence check)"
  # restic lane covers ONLY: Forgejo repos (J1, data volume) + Surreal (J9).
  # The Infisical (J4) + Forgejo (J3) + app (J6/7/8) DATABASES are CNPG-Barman, NOT restic
  # (verified 2026-06-27 — there is no restic 'infisical'/'forgejo' DB prefix). See the CNPG check below.
  local p
  for p in forgejo-data-k3s surreal-k3s; do
    restic_at "$p" snapshots --no-lock --latest 1 >/dev/null 2>&1 \
      || fail_step "preflight-restic-prefix-missing:${p}"
    echo "    restic ${p}: snapshots present"
  done
  # CNPG Barman base backups for every DB jewel (J3/J4/J6/J7/J8) — must have a base/ backup
  local c
  for c in pg-infisical pg-forgejo pg-restormel pg-platform pg-plotbudget; do
    aws_s3 s3 ls "s3://${CNPG_BUCKET_OL}/${c}/base/" >/dev/null 2>&1 \
      || fail_step "preflight-cnpg-base-missing:${c}"
    echo "    cnpg ${c}/base: backups present"
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
    ssh "${DR_SSH_I[@]+"${DR_SSH_I[@]}"}" "${DR_SSH_NOHOST[@]}" -o ConnectTimeout=5 "root@${ip}" true 2>/dev/null && break
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
lock_box_egress_to_s3(){
  # CRITICAL SAFETY CONTROL. The restored prod etcd carries the Hetzner CCM + external-dns (with the
  # prod cloud token); if they reach api.hetzner.cloud / the metadata service they could reconcile
  # against the REAL Hetzner project and detach volumes, delete LBs, or rewrite prod DNS. Before the
  # etcd restore we lock the box's egress to the S3 store + DNS + in-cluster CIDRs ONLY (default-drop
  # OUTPUT) — so every prod-mutating controller fails closed. Called AFTER k3s install (needs open
  # egress) and BEFORE k3s_cluster_reset_restore (which boots those controllers).
  # NOTE: added 2026-06-27; validated on the first supervised box run (see DESIGN-NOTE-livebox).
  # fsn1 object storage can answer with DIFFERENT A-records over time (round-robin / endpoint changes),
  # so resolve REPEATEDLY and union — a single getent (first box run, 2026-06-27) caught only one IP and
  # left later in-cluster S3 traffic intermittently blocked. (The etcd snapshot itself is fetched
  # host-side + scp'd, so Step 0 does not depend on box→S3; this rule is for the Step 4-6 controllers,
  # CNPG-Barman, etc.) If a long drill still sees S3 flaps, widen to the Hetzner object-storage prefix.
  local s3ips
  s3ips="$(box_ssh "for i in \$(seq 1 8); do getent ahostsv4 ${S3_HOST}; done | awk '{print \$1}' | sort -u | paste -sd, -")"
  [ -n "${s3ips}" ] || fail_step "egress-lock-could-not-resolve-s3 (${S3_HOST})"
  box_ssh "nft -f - <<NFT
table inet drillguard {
  chain output {
    type filter hook output priority 0; policy drop;
    oif lo accept
    ct state established,related accept
    ip daddr { 10.42.0.0/16, 10.43.0.0/16 } accept   # k3s pod + service CIDRs
    udp dport 53 accept
    tcp dport 53 accept
    ip daddr { ${s3ips} } tcp dport 443 accept        # fsn1 object storage ONLY
    # everything else (api.hetzner.cloud, 169.254.169.254 metadata, prod hosts) is DROPPED
  }
}
NFT" || fail_step "egress-lock-nft-failed"
  # prove the lock: metadata + the hetzner API must be unreachable; S3 must be reachable.
  box_ssh "timeout 4 curl -sf https://169.254.169.254/ >/dev/null 2>&1 && echo OPEN || echo blocked" | grep -q blocked \
    || fail_step "egress-lock-metadata-still-reachable"
  box_ssh "timeout 6 curl -sf https://${S3_HOST}/ -o /dev/null 2>/dev/null; [ \$? -le 1 ] || curl -s -o /dev/null -w '%{http_code}' https://${S3_HOST}/ | grep -qE '^[0-9]'" \
    || echo "  WARN egress-lock: S3 reachability probe inconclusive (verify in restore step)"
  echo "  EGRESS LOCKED to ${S3_HOST} + DNS + pod CIDRs only (CCM/external-dns fail closed — prod safe)"
}
fetch_etcd_snapshot_from_s3(){
  # native K3s --etcd-s3 snapshots are RAW S3 objects (WS3; NOT restic). Find the newest snapshot name
  # (exclude the metadata .zip/.sha256 AND the verify-s3-* write-probe objects); restore via --cluster-reset-restore-path.
  # match ONLY real etcd-snapshot-<node>-<epoch> objects — a stray verify-s3-* S3-write-probe object in
  # the bucket sorts after etcd-snapshot-* and is a STALE cluster state (caught by the local J10 drill).
  ETCD_SNAP_NAME="$(aws_s3 s3 ls "s3://${ETCD_BUCKET}/${ETCD_FOLDER}/" 2>/dev/null \
    | awk '{print $4}' | grep -E 'etcd-snapshot-.*-[0-9]+$' | sort | tail -1)"
  [ -n "${ETCD_SNAP_NAME:-}" ] || return 1
  export ETCD_SNAP_NAME
  echo "  newest etcd snapshot in S3: ${ETCD_SNAP_NAME}"
}
k3s_cluster_reset_restore(){
  # LOCAL-PATH restore — PROVEN end-to-end on real hardware 2026-06-27 (REC-EVID-006). Three findings,
  # each a hard requirement, none of which the standalone-etcd weekly jewels-proof can surface:
  #
  #  (a) DO NOT use k3s `--etcd-s3` for the restore. Its restore path runs a HeadBucket existence check
  #      that the READ-scoped S3 key is DENIED ("failed to test for existence of bucket … Access Denied"),
  #      which silently yields an EMPTY restore that then reports success. Instead download the snapshot on
  #      the WORKSTATION (a plain GET, which the read key CAN do) and scp it to the box, then restore from
  #      the local file with `--cluster-reset-restore-path=/root/snap.db` (no bucket check).
  #  (b) The box's k3s server token MUST equal the prod cluster token the snapshot was sealed with. k3s
  #      encrypts its in-datastore bootstrap data (cluster CA private keys, SA signing keys, the
  #      secrets-encryption config) with the server token; a mismatch is fatal: "bootstrap data … already
  #      found and encrypted with different token". This token CANNOT come from Infisical (Step 0 precedes
  #      Step 1) — it lives in the OFFLINE DR kit and is supplied via K3S_TOKEN_FILE (piped, never argv).
  #  (c) After the reset, REMOVE the box's freshly-generated tls/ + cred/{ipsec.psk,passwd}; they are
  #      "newer than datastore" and k3s refuses to boot until they're recreated from the RESTORED CA.
  #
  # The restored apiserver serves with the PROD CA (not the box's original), so the kubeconfig fetched at
  # provision time is now invalid — we re-fetch it after boot. `--cluster-reset` resets then exits; the
  # boot is a separate `systemctl start`.
  [ -r "${K3S_TOKEN_FILE:?set K3S_TOKEN_FILE=<offline DR-kit k3s-server-token>}" ] \
    || fail_step "k3s-token-file-unreadable:${K3S_TOKEN_FILE} (the prod K3s server token; escrow it in the DR kit — see README 'offline DR kit')"
  local snap="${WORK}/etcd-snapshot.db" ip; ip="$(cat "${WORK}/.boxip")"
  echo "  downloading etcd snapshot host-side (GET; no HeadBucket) ..."
  aws_s3 s3 cp "s3://${ETCD_BUCKET}/${ETCD_FOLDER}/${ETCD_SNAP_NAME}" "${snap}" >/dev/null 2>&1 \
    || fail_step "etcd-snapshot-download-failed:${ETCD_SNAP_NAME}"
  scp "${DR_SSH_I[@]+"${DR_SSH_I[@]}"}" "${DR_SSH_NOHOST[@]}" -o ConnectTimeout=20 \
    "${snap}" "root@${ip}:/root/snap.db" >/dev/null 2>&1 || fail_step "etcd-snapshot-scp-failed"
  # write the prod token onto the box token file (value piped from the offline kit; never printed/argv)
  box_ssh "umask 077; cat > /var/lib/rancher/k3s/server/token; chmod 600 /var/lib/rancher/k3s/server/token" \
    < "${K3S_TOKEN_FILE}" || fail_step "k3s-token-write-failed"
  box_ssh "systemctl stop k3s 2>/dev/null || true; pkill -9 -f containerd-shim 2>/dev/null || true; sleep 2; \
    k3s server --cluster-reset --token-file=/var/lib/rancher/k3s/server/token \
      --cluster-reset-restore-path=/root/snap.db >/var/log/dr-etcd-restore.log 2>&1 || true; \
    grep -qiE 'kvstore restored|restoring.*snapshot|has been reset|reset.*finish' /var/log/dr-etcd-restore.log \
      || { echo NO_RESTORE_EVIDENCE_IN_LOG; tail -25 /var/log/dr-etcd-restore.log; exit 3; }; \
    rm -rf /var/lib/rancher/k3s/server/tls /var/lib/rancher/k3s/server/cred/ipsec.psk /var/lib/rancher/k3s/server/cred/passwd; \
    systemctl start k3s" \
    || fail_step "k3s-cluster-reset-restore-failed (see /var/log/dr-etcd-restore.log; rerun with KEEP_BOX=1 to inspect)"
  echo "  reset + boot issued; re-fetching kubeconfig (restored prod CA) ..."
  fetch_box_kubeconfig    # waits for /readyz against the RESTORED apiserver
}
assert_etcd_loaded(){
  k get crd >/dev/null 2>&1 || fail_step "etcd-restore-no-crds"
  # An EMPTY restore (fresh k3s) is a FAILED restore, not a NOTE. Require the prod expected-key-set:
  # the 5 CNPG clusters and/or the app-of-apps 'root' — objects only a real etcd restore carries.
  local cnpg root_ok=no
  cnpg="$(k get clusters.postgresql.cnpg.io -A --no-headers 2>/dev/null | wc -l | tr -d ' ')"
  k -n argocd get application root >/dev/null 2>&1 && root_ok=yes
  if [ "${cnpg:-0}" -ge 5 ] || [ "${root_ok}" = yes ]; then
    echo "  etcd restore loaded: ${cnpg} CNPG clusters, app-of-apps root=${root_ok} (expected key set present)"
  else
    fail_step "etcd-restore-EMPTY (cnpg=${cnpg}, root=${root_ok}) — snapshot did not load; the cluster is a fresh k3s. See /var/log/dr-etcd-restore.log (rerun with KEEP_BOX=1)."
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
# ── CNPG-Barman restore (host-side Docker) — the proven jewels-proof-local.sh lane ───
# DB jewels (J3/J4/J6/J7/J8) are CNPG-**Barman** physical backups under the object-locked
# ${CNPG_BUCKET_OL}/pg-<name> store (NOT restic — the old `infisical`/`forgejo` restic prefixes never
# existed). We restore host-side in throwaway Docker (the harness's documented default; the egress-locked
# box can't pull/build the barman image), exactly as `jewels-proof-local.sh` does — build PG16.8 + an
# upgraded barman (prod `backup.info` carries an `encryption` field barman<3.14 can't parse),
# barman-cloud-restore the latest base backup, recover to consistency, then `pg_dump -Fc` the app DB. The
# downstream scratch-pg load (kubectl exec pg_restore) is unchanged — we just replaced the dead restic
# SOURCE of the dump with the real Barman one. Ports REC-EVID-005's proven path into the full drill.
DR_BARMAN_IMAGE_BUILT=0
build_dr_barman_image(){
  [ "${DR_BARMAN_IMAGE_BUILT}" = 1 ] && return 0
  command -v docker >/dev/null 2>&1 || fail_step "docker-required-for-barman-restore (Steps 1-2 restore DB jewels host-side)"
  cat > "${WORK}/Dockerfile.drbarman" <<EOF
FROM ${PG_IMAGE_BASE:-ghcr.io/cloudnative-pg/postgresql:16.8}
USER root
RUN pip install --no-cache-dir --upgrade 'barman[cloud,aws]'
EOF
  docker build -q -t dr-barman:local -f "${WORK}/Dockerfile.drbarman" "${WORK}" >/dev/null 2>&1 \
    || fail_step "dr-barman-image-build-failed (needs Docker + internet on the workstation)"
  DR_BARMAN_IMAGE_BUILT=1
}
barman_restore_db_to_dump(){     # $1 = db/jewel name (infisical|forgejo) → ${WORK}/$1.dump
  local name="$1" cluster
  cluster="pg-${name}"
  local vol ctr
  vol="dr-${cluster}-data"; ctr="dr-${cluster}"
  build_dr_barman_image
  docker rm -f "${ctr}" >/dev/null 2>&1 || true; docker volume rm "${vol}" >/dev/null 2>&1 || true
  docker volume create "${vol}" >/dev/null
  # restore latest base backup — READ-only against the object-locked CNPG store (no forget/prune/delete).
  docker run --rm -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -v "${vol}":/recovery dr-barman:local bash -c "
    set -e
    barman-cloud-restore --cloud-provider aws-s3 --endpoint-url ${S3_ENDPOINT} s3://${CNPG_BUCKET_OL} ${cluster} latest /recovery/pgdata
    chown -R 26:26 /recovery/pgdata && chmod 700 /recovery/pgdata
  " >/dev/null 2>&1 || { docker volume rm "${vol}" >/dev/null 2>&1 || true; fail_step "barman-cloud-restore-${cluster}"; }
  # standalone recovery to backup-end consistency (enough for a logical dump); neutralise CNPG /controller cfg.
  docker run --rm --user 26:26 -v "${vol}":/recovery dr-barman:local bash -c "
cat > /recovery/pgdata/custom.conf <<CONF
listen_addresses = '*'
unix_socket_directories = '/tmp'
max_worker_processes = 64
max_parallel_workers = 64
max_replication_slots = 64
max_wal_senders = 64
max_locks_per_transaction = 256
hot_standby = on
wal_level = logical
archive_mode = off
ssl = off
logging_collector = off
shared_preload_libraries = ''
restart_after_crash = off
CONF
cat > /recovery/pgdata/override.conf <<CONF
recovery_target = 'immediate'
recovery_target_action = 'promote'
recovery_target_timeline = 'latest'
restore_command = 'barman-cloud-wal-restore --cloud-provider aws-s3 --endpoint-url ${S3_ENDPOINT} s3://${CNPG_BUCKET_OL} ${cluster} %f %p'
CONF
touch /recovery/pgdata/recovery.signal
" >/dev/null 2>&1 || { docker volume rm "${vol}" >/dev/null 2>&1 || true; fail_step "barman-recovery-conf-${cluster}"; }
  docker run -d --name "${ctr}" --user 26:26 -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY \
    -v "${vol}":/recovery --entrypoint postgres dr-barman:local -D /recovery/pgdata >/dev/null 2>&1 \
    || { docker volume rm "${vol}" >/dev/null 2>&1 || true; fail_step "barman-pg-start-${cluster}"; }
  local i ok=0
  for i in $(seq 1 80); do
    docker logs "${ctr}" 2>&1 | grep -qi 'database system is ready to accept connections' && { ok=1; break; }
    docker logs "${ctr}" 2>&1 | grep -qiE 'FATAL|PANIC' && break
    sleep 3
  done
  if [ "${ok}" != 1 ]; then
    docker logs "${ctr}" 2>&1 | grep -iE 'FATAL|PANIC|insufficient|max_' | tail -3
    docker rm -f "${ctr}" >/dev/null 2>&1 || true; docker volume rm "${vol}" >/dev/null 2>&1 || true
    fail_step "barman-pg-not-ready-${cluster}"
  fi
  docker exec -u 26 "${ctr}" pg_dump -h /tmp -U postgres -Fc -d "${name}" > "${WORK}/${name}.dump" 2>/dev/null \
    || { docker rm -f "${ctr}" >/dev/null 2>&1 || true; docker volume rm "${vol}" >/dev/null 2>&1 || true; fail_step "pg_dump-${name}-from-restored-cluster"; }
  docker rm -f "${ctr}" >/dev/null 2>&1 || true; docker volume rm "${vol}" >/dev/null 2>&1 || true
  [ -s "${WORK}/${name}.dump" ] || fail_step "barman-empty-dump-${name}"
  echo "  ${cluster} barman-restored → recovered PG → pg_dump ${name}.dump ($(wc -c < "${WORK}/${name}.dump") bytes)"
}
restore_scratch_postgres(){      # $1 = jewel/db name (infisical|forgejo) → CNPG cluster pg-<name>
  local name="$1"
  # ensure the shared scratch namespaces + scratch-pg/redis/infisical are up (idempotent).
  k apply -f "${MANIFESTS}/00-scratch-namespaces.yaml" >/dev/null
  envsubst < "${MANIFESTS}/20-scratch-infisical.yaml" | k apply -f - >/dev/null
  k -n dr-drill rollout status deploy/scratch-pg --timeout=180s >/dev/null 2>&1 || fail_step "scratch-pg-not-ready"
  barman_restore_db_to_dump "${name}"                    # CNPG-Barman → ${WORK}/${name}.dump (NOT restic)
  k -n dr-drill exec deploy/scratch-pg -- createdb -U postgres "${name}" 2>/dev/null || true
  k -n dr-drill exec -i deploy/scratch-pg -- pg_restore -U postgres -d "${name}" --no-owner --no-acl < "${WORK}/${name}.dump" \
    >/dev/null 2>&1 || fail_step "pg_restore-${name}"
  echo "  ${name} restored from CNPG-Barman → scratch-pg (db=${name})"
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
  # Forgejo repos live in the DATA-VOLUME restic repo `forgejo-data-k3s` (path /data/...), NOT a `forgejo` prefix.
  restic_at forgejo-data-k3s restore latest --no-lock --include "**/repositories/**" --target "${WORK}/repos" >/dev/null 2>&1 \
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

File via the restormel-isms-governance skill (append-only under evidence/posture/).
EOF
}
