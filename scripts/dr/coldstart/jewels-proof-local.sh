#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Crown-jewels LOCAL jewels-proof drill  (REC-PLAN-021 §3d weekly per-jewel drill)
#
# Proves — on the operator's own machine, from the fsn1 S3 store ALONE, with NO
# paid Hetzner box — that every database jewel restores to a LIVE Postgres and
# that the two escrow conditions hold:
#
#   J3  pg-forgejo     → restore base backup → live Postgres, table count
#   J4  pg-infisical   → restore → boot real Infisical over it → C1 + C2
#   J5  escrow key     → its ENCRYPTION_KEY decrypts the recovered KMS (implicit in C2)
#   J6  pg-restormel   → restore → live Postgres, table count
#   J7  pg-platform    → restore → live Postgres, table count
#   J8  pg-plotbudget  → restore → live Postgres, table count
#   C1  machine-identity from the escrow bundle authenticates to recovered Infisical
#   C2  the DR canary decrypts from the recovered pg-infisical + escrow key,
#       sha256 == the published expected hash (value NEVER printed)
#
# (J1 repos / J2 registry / J9 Surreal / J10 etcd are proven read-only by the
#  cold-start harness preflight + REC-EVID-004; this script covers the DB lane.)
#
# WHY a separate lighter lane: the prod DB jewels are CNPG-Barman backups, whose
# *live* recovery on a real box needs the whole platform (cert-manager + CNPG op +
# barman-cloud plugin + ESO + Infisical). This script restores the SAME backups
# directly with `barman-cloud-restore` into throwaway Docker Postgres — proving the
# same jewels with seconds of setup and zero infra spend. See DESIGN-NOTE-topology.
#
# SECURITY
#   • Secret VALUES never touch the terminal — only char-counts and the canary
#     sha256 (a hash, equal to the published expected value on success).
#   • The recovered pg-infisical ciphertext DB + the escrow master key together can
#     decrypt all prod secrets; everything is torn down + volumes removed on exit.
#   • The offline escrow key (~/restormel-escrow-primary.key) is read, never copied.
#
# PREREQS:  docker, age, aws-cli, infisical (logged in for the weekly drill).
#   The OFFLINE DR KIT must hold three things so this runs when Infisical is down:
#     1. ~/restormel-escrow-primary.key   (age identity — J5/C1/C2)
#     2. fsn1 S3 read key id + secret      (env DR_S3_ACCESS_KEY_ID / _SECRET)
#     3. restic passphrase                 (only needed for the repo jewels, not here)
#   In a live disaster set those env vars directly; in the weekly drill they are
#   fetched scoped from Infisical (restormel-ops/prod). See README.md.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
export INFISICAL_DISABLE_UPDATE_CHECK=true

# ── config (non-secret) ──────────────────────────────────────────────────────
S3_ENDPOINT="${S3_ENDPOINT:-https://fsn1.your-objectstorage.com}"
CNPG_BUCKET="${CNPG_BUCKET:-restormel-cnpg-backups-fsn1-ol}"
DB_CLUSTERS="${DB_CLUSTERS:-pg-forgejo pg-restormel pg-platform pg-plotbudget}"  # J4 handled separately
ESCROW_BUCKET="${ESCROW_BUCKET:-restormel-restic-backups}"
ESCROW_OBJECT="${ESCROW_OBJECT:-escrow/eso-bootstrap.age}"
ESCROW_KEY="${ESCROW_KEY:-$HOME/restormel-escrow-primary.key}"

# Infisical app — keep in sync with cluster/infisical/10-infisical-app.yaml.
# If the recovered DB needs migrations on boot, the script WARNS (version drift).
INFISICAL_IMAGE="${INFISICAL_IMAGE:-infisical/infisical@sha256:6336e25530ae22a081cde6327b8813e729f90b39363b5479fa6cc98098a02891}"  # v0.154.6
PG_IMAGE_BASE="${PG_IMAGE_BASE:-ghcr.io/cloudnative-pg/postgresql:16.8}"   # MUST match prod PG major (backup version=160008)

# Canary coordinates (non-secret) + published expected hash.
CANARY_WORKSPACE="${CANARY_WORKSPACE:-f0165998-e695-428e-bf20-b776279a6832}"  # restormel project
CANARY_ENV="${CANARY_ENV:-prod}"
CANARY_PATH="${CANARY_PATH:-/}"
CANARY_NAME="${CANARY_NAME:-DR_CANARY}"
CANARY_EXPECTED_SHA="${CANARY_EXPECTED_SHA:-fa3444cbb7d1deebd11875b62bd992cc9728632913e261a81217121b875276e2}"

OPS_PID=f0165998-e695-428e-bf20-b776279a6832
NET=dr-jewels-net
WORK="$(mktemp -d "${TMPDIR:-/tmp}/dr-jewels.XXXXXX")"
PASS=(); FAILED=()  # indexed arrays (bash 3.2 safe — macOS)

log(){ printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
pass(){ PASS+=("$1"); log "PASS  $1"; }
faild(){ FAILED+=("$1"); log "FAIL  $1"; }

cleanup(){
  log "CLEANUP: removing dr-* containers/volumes/network + scratch"
  docker rm -f dr-infisical dr-redis >/dev/null 2>&1 || true
  for c in $(docker ps -aq --filter name=dr-pg- 2>/dev/null); do docker rm -f "$c" >/dev/null 2>&1 || true; done
  docker volume ls -q --filter name=dr-pg 2>/dev/null | while read -r v; do docker volume rm "$v" >/dev/null 2>&1 || true; done
  docker network rm "$NET" >/dev/null 2>&1 || true
  find "$WORK" -name '*.age' -exec shred -u {} \; 2>/dev/null || true
  rm -rf "$WORK" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── credentials: offline env first, else scoped Infisical fetch ──────────────
load_s3_creds(){
  if [ -n "${DR_S3_ACCESS_KEY_ID:-}" ] && [ -n "${DR_S3_SECRET_ACCESS_KEY:-}" ]; then
    export AWS_ACCESS_KEY_ID="$DR_S3_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$DR_S3_SECRET_ACCESS_KEY"
    log "S3 creds: from offline DR-kit env"
  else
    export AWS_ACCESS_KEY_ID="$(infisical secrets get HETZNER_S3_FSN1_ACCESS_KEY_ID --projectId="$OPS_PID" --env=prod --domain=https://secrets.restormel.dev --plain --silent)"
    export AWS_SECRET_ACCESS_KEY="$(infisical secrets get HETZNER_S3_FSN1_SECRET_ACCESS_KEY --projectId="$OPS_PID" --env=prod --domain=https://secrets.restormel.dev --plain --silent)"
    log "S3 creds: fetched scoped from Infisical (weekly-drill mode)"
  fi
  [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ] || { echo "no S3 creds"; exit 1; }
}

# decrypt escrow bundle into the current shell env (var NAMES only echoed)
load_escrow_env(){
  local f="$WORK/eso.age"
  aws --endpoint-url "$S3_ENDPOINT" s3 cp "s3://$ESCROW_BUCKET/$ESCROW_OBJECT" "$f" >/dev/null
  while IFS='=' read -r k v; do [ -n "$k" ] && export "$k=$v"; done < <(age -d -i "$ESCROW_KEY" "$f")
  shred -u "$f" 2>/dev/null || rm -f "$f"
  : "${INFISICAL_MI_CLIENT_ID:?escrow missing MI client id}" "${INFISICAL_ENCRYPTION_KEY:?escrow missing encryption key}"
}

# ── step 1: build PG16 + barman>=3.14 image (prod writes backup.info w/ encryption field) ──
build_image(){
  log "STEP 1: build dr-barman:local (${PG_IMAGE_BASE} + upgraded barman)"
  cat > "$WORK/Dockerfile" <<EOF
FROM ${PG_IMAGE_BASE}
USER root
RUN pip install --no-cache-dir --upgrade 'barman[cloud,aws]'
EOF
  docker build -q -t dr-barman:local "$WORK" >/dev/null
  local bv; bv="$(docker run --rm dr-barman:local barman-cloud-backup-list --version)"
  log "      $bv"
}

# write standalone recovery config into a restored data dir (neutralise CNPG /controller paths)
write_recovery_conf(){  # $1=cluster  $2=target(immediate|latest)
  local cluster="$1" target="$2" tgt=""
  [ "$target" = immediate ] && tgt="recovery_target = 'immediate'
recovery_target_action = 'promote'"
  docker run --rm --user 26:26 -v "dr-${cluster}-data":/recovery dr-barman:local bash -c "
cat > /recovery/pgdata/custom.conf <<CONF
cluster_name = '${cluster}-dr'
listen_addresses = '*'
port = 5432
unix_socket_directories = '/tmp'
shared_buffers = 128MB
dynamic_shared_memory_type = posix
max_connections = 200
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
log_destination = stderr
shared_preload_libraries = ''
restart_after_crash = off
CONF
cat > /recovery/pgdata/override.conf <<CONF
recovery_target_timeline = 'latest'
${tgt}
restore_command = 'barman-cloud-wal-restore --cloud-provider aws-s3 --endpoint-url ${S3_ENDPOINT} s3://${CNPG_BUCKET} ${cluster} %f %p'
CONF
touch /recovery/pgdata/recovery.signal
"
}

# restore latest base backup of $1 into a fresh volume + recover to $2 consistency
restore_cluster(){  # $1=cluster  $2=target  -> leaves container dr-$1 running
  local cluster="$1" target="${2:-immediate}"
  local vol="dr-${cluster}-data" ctr="dr-${cluster}"
  docker rm -f "$ctr" >/dev/null 2>&1 || true; docker volume rm "$vol" >/dev/null 2>&1 || true
  docker volume create "$vol" >/dev/null
  docker run --rm -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -v "$vol":/recovery dr-barman:local bash -c "
    set -e
    barman-cloud-restore --cloud-provider aws-s3 --endpoint-url ${S3_ENDPOINT} s3://${CNPG_BUCKET} ${cluster} latest /recovery/pgdata
    chown -R 26:26 /recovery/pgdata && chmod 700 /recovery/pgdata
  " >/dev/null
  write_recovery_conf "$cluster" "$target"
  docker run -d --name "$ctr" --network "$NET" --user 26:26 \
    -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY \
    -v "$vol":/recovery --entrypoint postgres dr-barman:local -D /recovery/pgdata >/dev/null
  local i
  for i in $(seq 1 80); do
    docker logs "$ctr" 2>&1 | grep -qi 'database system is ready to accept connections' && return 0
    docker logs "$ctr" 2>&1 | grep -qiE 'FATAL|PANIC' && { docker logs "$ctr" 2>&1 | grep -iE 'FATAL|PANIC|insufficient|max_' | tail -3; return 1; }
    sleep 3
  done
  return 1
}

psql_q(){ docker exec -u 26 "dr-$1" psql -h /tmp -U postgres -d "${2:-postgres}" -tAc "$3" 2>/dev/null; }

# ── main ─────────────────────────────────────────────────────────────────────
log "JEWELS-PROOF LOCAL DRILL START  store=$CNPG_BUCKET"
for t in docker age aws infisical; do command -v "$t" >/dev/null || { echo "missing tool: $t"; exit 1; }; done
[ -f "$ESCROW_KEY" ] || { echo "escrow key not found: $ESCROW_KEY"; exit 1; }
load_s3_creds
docker network create "$NET" >/dev/null 2>&1 || true
build_image

# Step 2: the four straightforward DB jewels (J3/J6/J7/J8) — restore to immediate consistency
log "STEP 2: DB jewels J3/J6/J7/J8 (restore → live Postgres)"
for c in $DB_CLUSTERS; do
  if restore_cluster "$c" immediate; then
    dbs="$(psql_q "$c" postgres "select string_agg(datname,',') from pg_database where datistemplate=false and datname<>'postgres';")"
    info=""
    for d in ${dbs//,/ }; do
      tc="$(psql_q "$c" "$d" "select count(*) from information_schema.tables where table_schema not in ('pg_catalog','information_schema');")"
      info="$info $d=${tc}t"
    done
    pass "$c restore →$info"
  else
    faild "$c restore"
  fi
  docker rm -f "dr-$c" >/dev/null 2>&1 || true; docker volume rm "dr-$c-data" >/dev/null 2>&1 || true
done

# Step 3: J4 pg-infisical + J5 + C1 + C2
log "STEP 3: J4 pg-infisical → boot Infisical → C1 (escrow MI auth) + C2 (canary decrypt)"
REPLAY="${REPLAY_TO_LATEST:+latest}"; REPLAY="${REPLAY:-immediate}"
if restore_cluster pg-infisical "$REPLAY"; then
  secrets="$(psql_q pg-infisical infisical "select count(*) from secrets_v2;")"
  pass "J4 pg-infisical restore → infisical db, ${secrets} secrets (recovery=$REPLAY)"
  load_escrow_env
  docker rm -f dr-redis dr-infisical >/dev/null 2>&1 || true
  docker run -d --name dr-redis --network "$NET" redis:7-alpine >/dev/null
  docker exec -u 26 dr-pg-infisical psql -h /tmp -U postgres -d postgres -c "ALTER ROLE infisical_app WITH PASSWORD 'drlocal' LOGIN;" >/dev/null 2>&1
  ENCRYPTION_KEY="$INFISICAL_ENCRYPTION_KEY" AUTH_SECRET="$INFISICAL_AUTH_SECRET" \
  docker run -d --name dr-infisical --network "$NET" -p 8088:8080 \
    -e ENCRYPTION_KEY -e AUTH_SECRET \
    -e DB_CONNECTION_URI="postgresql://infisical_app:drlocal@dr-pg-infisical:5432/infisical?sslmode=disable" \
    -e REDIS_URL="redis://dr-redis:6379" -e SITE_URL="http://localhost:8088" \
    "$INFISICAL_IMAGE" >/dev/null
  # wait ready
  ready=no
  for i in $(seq 1 40); do
    [ "$(curl -s --max-time 5 http://localhost:8088/api/status 2>/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin).get("message",""))' 2>/dev/null)" = Ok ] && { ready=yes; break; }
    sleep 3
  done
  if docker logs dr-infisical 2>&1 | grep -qi 'No migrations pending'; then
    log "      schema check: recovered DB == Infisical image version (no migrations) ✓"
  elif [ "$REPLAY" = immediate ]; then
    log "      note: recovered DB applied catch-up migrations on boot (expected — the base backup lags current schema in immediate mode; canary proof below is unaffected)"
  else
    log "      WARN: recovered current-state DB needed migrations — Infisical image drifted from prod (update INFISICAL_IMAGE to the live cluster/infisical/10-infisical-app.yaml digest)"
  fi
  if [ "$ready" = yes ]; then
    # C1
    TOKEN="$(python3 -c 'import os,json;print(json.dumps({"clientId":os.environ["INFISICAL_MI_CLIENT_ID"],"clientSecret":os.environ["INFISICAL_MI_CLIENT_SECRET"]}))' \
      | curl -s --max-time 15 -X POST http://localhost:8088/api/v1/auth/universal-auth/login -H 'Content-Type: application/json' --data-binary @- \
      | python3 -c 'import sys,json;print(json.load(sys.stdin).get("accessToken",""))' 2>/dev/null)"
    if [ -n "$TOKEN" ]; then
      pass "C1 escrow machine-identity authenticated (token ${#TOKEN}c)"
      # C2 (value never printed — only its sha256)
      SHA="$(curl -s --max-time 15 -H "Authorization: Bearer $TOKEN" \
        "http://localhost:8088/api/v3/secrets/raw/${CANARY_NAME}?workspaceId=${CANARY_WORKSPACE}&environment=${CANARY_ENV}&secretPath=$(python3 -c "import urllib.parse;print(urllib.parse.quote('${CANARY_PATH}',safe=''))")" \
        | python3 -c 'import sys,json,hashlib;v=json.load(sys.stdin).get("secret",{}).get("secretValue","");print(hashlib.sha256(v.encode()).hexdigest() if v else "")' 2>/dev/null)"
      if [ "$SHA" = "$CANARY_EXPECTED_SHA" ]; then
        pass "C2 canary decrypted from recovered pg-infisical + escrow key — sha256 MATCH"
      else
        faild "C2 canary sha mismatch (got ${SHA:-empty})"
      fi
    else
      faild "C1 escrow machine-identity auth (no token)"
    fi
  else
    faild "Infisical did not become ready"; docker logs dr-infisical 2>&1 | tail -8
  fi
else
  faild "J4 pg-infisical restore"
fi

# ── summary ──────────────────────────────────────────────────────────────────
echo "──────────────────────────────────────────────────────────────"
log "JEWELS-PROOF SUMMARY: ${#PASS[@]} pass / ${#FAILED[@]} fail"
for p in ${PASS[@]+"${PASS[@]}"}; do echo "  ✅ $p"; done
for f in ${FAILED[@]+"${FAILED[@]}"}; do echo "  ❌ $f"; done
[ "${#FAILED[@]}" -eq 0 ] && { log "ALL DB JEWELS + C1 + C2 PROVEN ✅"; exit 0; } || { log "DRILL FAILED"; exit 1; }
