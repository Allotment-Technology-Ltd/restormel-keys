#!/usr/bin/env bash
# k3s-build-push-bump.sh — build the dashboard + worker images with BuildKit, push
# them to the Forgejo container registry, and bump the deployed image reference in the
# restormel-gitops repo so Argo CD (PULL model) sees the new release as OutOfSync.
#
# Called by .forgejo/workflows/deploy-k3s.yml.
#
# ---------------------------------------------------------------------------------
# TRUST MODEL (RES-114 hardening, PR #374) — TRUSTED ORCHESTRATION FROM TRUNK
# ---------------------------------------------------------------------------------
# For the INTEGRATION env this script builds the UNTRUSTED batch of un-merged,
# `stage`-labelled PRs (the disposable `integration` branch). Untrusted code must NEVER
# run with access to a write secret. Therefore:
#
#   * This script is executed FROM TRUNK (the job's own checkout of the default branch),
#     NEVER from the `integration` branch tree. The integration tree is consumed ONLY as
#     the buildkit BUILD CONTEXT (Dockerfile + app source) via --local context=...; it is
#     never sourced and never bash-executed.
#   * The two write privileges are SPLIT across two sub-commands so no single step ever
#     holds a write token AND executes against the untrusted context:
#
#       build <env>   — REG creds ONLY (write:package). Builds BUILD_CONTEXT and PUSHES
#                       BY DIGEST to the registry. Emits the immutable sha256 digests
#                       (to $GITHUB_OUTPUT when set). NO gitops token in scope. No secret
#                       is mounted into the build (no --build-arg / --secret / RUN env),
#                       so an untrusted Dockerfile RUN cannot read REG_TOKEN — buildkit
#                       only uses it to authenticate the push.
#       bump  <env>   — GITOPS_TOKEN ONLY (gitops write). Runs TRUSTED (trunk) code only;
#                       reads DASH_DIGEST/WORKER_DIGEST (validated sha256) and pins the
#                       gitops manifests to the image BY DIGEST. Never touches the build
#                       context; never executes untrusted code; NO registry token.
#
#       <env>         — LEGACY COMBINED (build+push+bump in one process). Used by the PROD
#         (integration|   job ONLY, whose source is a TRUSTED `dashboard-v*` tag on trunk.
#          prod)         Prod pins by mutable :tag exactly as before (byte-compatible) —
#                        digest-pinning is the integration-path defense-in-depth.
#
#       promote <from> <to>
#                     — GITOPS_TOKEN ONLY (gitops write + PR-create). NO build/rebuild.
#                       Reads the live @sha256 digests off the FROM-env manifests
#                       (aborts if FROM is still :tag), pins them into the TO-env
#                       manifests, and STAGES a gitops PR on a `promote/<from>-to-<to>`
#                       branch — NEVER pushes HEAD:main, NEVER merges. The PR MERGE is
#                       the founder deploy gate. DRY_RUN=true|1|yes prints the resolved
#                       digests + proposed diff and stops (no branch/push/PR). This is
#                       build-once/promote-by-digest (ADR §5.3).
#
# ---------------------------------------------------------------------------------
# REC-INC-006 INVARIANT: OUTBOUND-ONLY. This script must NEVER call an on-box
# control-plane API (Coolify / Argo / kube-API), never `kubectl`/`argocd`, never dial
# 10.0.1.1 / 172.16.0.x / :6443. It only: builds, pushes to the public registry
# (egress), and `git push` to the public restormel-gitops repo. The deploy completes
# by Argo CD PULLING from git inside the cluster.
#
# Runs inside a buildkit job container on a Forgejo runner. For integration that runner
# is the ROOTLESS, NON-PROD-SCHEDULABLE, egress-restricted `integration-build` surface
# (see deploy-k3s.yml). BuildKit builds natively on amd64; no Docker daemon required.
#
# Required env (set by the workflow):
#   ENV_NAME           — "integration" | "prod"  (also the positional env arg)
#   REG                — registry host (git.allotmentology.tech)
#   IMAGE_REPO         — registry path/org ("allotment-technology-ltd")
#   REG_USER REG_TOKEN — registry push creds (build/combined modes). REG_TOKEN needs
#                        write:package (FORGEJO_REGISTRY in Infisical; the PM token is
#                        read-only on packages).
#   GITOPS_TOKEN       — write token for restormel-gitops (bump/combined modes only)
#   GITOPS_REPO        — Allotment-Technology-Ltd/restormel-gitops
#   BUILD_CONTEXT      — (build mode) dir of the buildkit context. Default ".".
#   DASH_DIGEST WORKER_DIGEST — (bump mode) sha256 digests handed over from the build step.
set -euo pipefail

# --- sub-command dispatch ----------------------------------------------------
# First arg is either a MODE (build|bump|promote) or, for the legacy combined call, the env.
MODE=all
case "${1:-}" in
  build)   MODE=build;   shift ;;
  bump)    MODE=bump;    shift ;;
  promote) MODE=promote; shift ;;
  ''|*) : ;;  # legacy combined: first arg (if any) is ENV_NAME, handled below
esac

if [[ "${MODE}" == promote ]]; then
  # promote <from-env> <to-env> — copy the live @sha256 digest between env manifests
  # with NO rebuild, and STAGE a gitops promotion PR (never merge/deploy). GITOPS_TOKEN
  # only; no registry token, no build.
  PROMOTE_FROM="${1:?promote requires: promote <from-env> <to-env>}"
  PROMOTE_TO="${2:?promote requires: promote <from-env> <to-env>}"
  for _e in "${PROMOTE_FROM}" "${PROMOTE_TO}"; do
    case "${_e}" in
      integration|prod) ;;
      *) echo "FATAL: promote env must be 'integration' or 'prod', got '${_e}'"; exit 2 ;;
    esac
  done
  [[ "${PROMOTE_FROM}" != "${PROMOTE_TO}" ]] \
    || { echo "FATAL: promote <from> and <to> must differ (got '${PROMOTE_FROM}')"; exit 2; }
  : "${REG:?REG required}"
  : "${IMAGE_REPO:?IMAGE_REPO required}"
  GITOPS_REPO="${GITOPS_REPO:-Allotment-Technology-Ltd/restormel-gitops}"
  echo "=== K3s promote | ${PROMOTE_FROM} → ${PROMOTE_TO} (digest copy, PR-only, no rebuild) ==="
else
  ENV_NAME="${1:-${ENV_NAME:?ENV_NAME (integration|prod) required}}"
  case "${ENV_NAME}" in
    integration|prod) ;;
    *) echo "FATAL: ENV_NAME must be 'integration' or 'prod', got '${ENV_NAME}'"; exit 2 ;;
  esac

  : "${REG:?REG required}"
  : "${IMAGE_REPO:?IMAGE_REPO required}"
  GITOPS_REPO="${GITOPS_REPO:-Allotment-Technology-Ltd/restormel-gitops}"

  # 12-hex short SHA (informational :tag + commit message).
  #   build : read from the build context (the integration HEAD = the train's batch tag).
  #   bump  : handed over from the build step via IMAGE_SHA (the job workspace is NOT a git
  #           repo, so NEVER call git here). Falls back to "unknown" only if unset.
  #   all   : combined prod path — from CWD (the trusted `dashboard-v*` tag checkout).
  case "${MODE}" in
    build) SHA="$(git -C "${BUILD_CONTEXT:-.}" rev-parse --short=12 HEAD)" ;;
    bump)  SHA="${IMAGE_SHA:-unknown}" ;;
    *)     SHA="$(git rev-parse --short=12 HEAD)" ;;
  esac
  DASH_IMG="${REG}/${IMAGE_REPO}/dashboard:${SHA}"
  WORKER_IMG="${REG}/${IMAGE_REPO}/worker:${SHA}"

  echo "=== K3s ${MODE} | env=${ENV_NAME} sha=${SHA} reg=${REG}/${IMAGE_REPO} ==="
fi

# =============================================================================
# BUILD + PUSH (registry token only; never sees the gitops token)
# =============================================================================
do_build_push() {
  : "${REG_USER:?REG_USER required}"
  : "${REG_TOKEN:?REG_TOKEN required}"
  local ctx="${BUILD_CONTEXT:-.}"

  # registry auth for BuildKit's pusher (egress). buildctl reads
  # $DOCKER_CONFIG/config.json and forwards the auth to buildkitd, which performs the
  # PUSH. This config is NEVER exposed to the build's RUN layers (no --secret mount),
  # so an untrusted Dockerfile cannot read REG_TOKEN.
  DKR_CFG="$(mktemp -d)"; export DOCKER_CONFIG="${DKR_CFG}"
  local auth_b64
  auth_b64="$(printf '%s:%s' "${REG_USER}" "${REG_TOKEN}" | base64 | tr -d '\n')"
  umask 077
  cat > "${DKR_CFG}/config.json" <<JSON
{"auths":{"${REG}":{"auth":"${auth_b64}"}}}
JSON
  unset auth_b64

  # Build + push, capturing the immutable image digest from buildkit's metadata file.
  # No --build-arg / --secret: the untrusted context cannot exfiltrate any credential.
  buildkit_build_push() { # $1 dockerfile  $2 image  $3 name  -> echoes sha256 digest
    local dockerfile="$1" image="$2" name="$3" meta
    meta="$(mktemp)"
    echo "--- build+push ${name} (${dockerfile}) from context '${ctx}' → ${image} ---" >&2
    buildctl-daemonless.sh build \
      --frontend dockerfile.v0 \
      --local context="${ctx}" \
      --local dockerfile="${ctx}" \
      --opt filename="${dockerfile}" \
      --output "type=image,name=${image},push=true" \
      --metadata-file "${meta}" >&2
    jq -r '."containerimage.digest" // empty' "${meta}"
  }

  DASH_DIGEST="$(buildkit_build_push Dockerfile.dashboard "${DASH_IMG}" dashboard)"
  WORKER_DIGEST="$(buildkit_build_push Dockerfile.worker  "${WORKER_IMG}" worker)"
}

# Validate + hand a digest to the bump step via $GITHUB_OUTPUT (typed step output —
# avoids sourcing any file). The sha256 regex blocks output injection.
emit_digest() { # $1 key  $2 digest
  local key="$1" digest="$2"
  [[ "${digest}" =~ ^sha256:[0-9a-f]{64}$ ]] \
    || { echo "FATAL: '${key}' is not a valid sha256 digest: '${digest}'" >&2; exit 4; }
  echo "${key}=${digest}"
  [[ -n "${GITHUB_OUTPUT:-}" ]] && echo "${key}=${digest}" >> "${GITHUB_OUTPUT}"
  return 0
}

# =============================================================================
# GITOPS BUMP (gitops token only; trusted code; never builds; never sees REG_TOKEN)
# =============================================================================
do_bump() {
  : "${GITOPS_TOKEN:?GITOPS_TOKEN required}"

  # DRY_RUN=true|1|yes → validate without touching gitops.
  case "${DRY_RUN:-}" in
    true|1|yes) echo "=== DRY_RUN: skipping gitops bump (env=${ENV_NAME}). ==="; return 0 ;;
  esac

  local workdir; workdir="$(mktemp -d)"
  trap 'rm -rf "${workdir}"' RETURN
  echo "--- clone restormel-gitops ---"
  git clone --depth 1 "https://x-access-token:${GITOPS_TOKEN}@git.allotmentology.tech/${GITOPS_REPO}.git" "${workdir}/gitops"
  cd "${workdir}/gitops"

  case "${ENV_NAME}" in
    prod)
      # PROD: mutable :tag bump (trusted source). Unchanged behaviour.
      bump_manifest_tag "applications/restormel-app-prod/20-dashboard-deployment.yaml" dashboard "${SHA}"
      bump_manifest_tag "applications/restormel-app-prod/40-worker-deployment.yaml"    worker    "${SHA}"
      ;;
    integration)
      # INTEGRATION: pin BY DIGEST (build provenance). The digests come from the build
      # step's typed outputs; never trusts a mutable tag for the untrusted batch.
      : "${DASH_DIGEST:?DASH_DIGEST required (from the build step output)}"
      : "${WORKER_DIGEST:?WORKER_DIGEST required (from the build step output)}"
      [[ "${DASH_DIGEST}"   =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "FATAL: bad DASH_DIGEST"   >&2; exit 4; }
      [[ "${WORKER_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "FATAL: bad WORKER_DIGEST" >&2; exit 4; }
      pin_manifest_digest "applications/restormel-integration/20-dashboard-deployment.yaml" dashboard "${DASH_DIGEST}"
      pin_manifest_digest "applications/restormel-integration/40-worker-deployment.yaml"    worker    "${WORKER_DIGEST}"
      ;;
  esac

  if git diff --quiet; then
    echo "::notice::image reference already current in ${ENV_NAME} — nothing to commit (re-run / no-op)."
    return 0
  fi

  git -c user.name=forgejo-ci -c user.email=ci@allotmentology.tech \
      commit -am "deploy(${ENV_NAME}): dashboard+worker ${SHA}"
  echo "--- push bump to restormel-gitops main ---"
  git push origin HEAD:main
  echo "=== done: ${ENV_NAME} bumped to ${SHA}. Argo will reconcile (prod=auto-sync). ==="
}

# Replace only the :tag on the `image: <reg>/<repo>/<component>:<tag>` line (prod).
bump_manifest_tag() {
  local file="$1" component="$2" sha="$3"
  if [[ ! -f "${file}" ]]; then
    echo "FATAL: ${file} not found in restormel-gitops — manifest must exist. Aborting so the env is never half-bumped." >&2
    exit 3
  fi
  sed -i -E "s|(image:[[:space:]]*${REG}/${IMAGE_REPO}/${component}:)[A-Za-z0-9._-]+|\1${sha}|" "${file}"
  grep -qE "image:[[:space:]]*${REG}/${IMAGE_REPO}/${component}:${sha}" "${file}" \
    || { echo "FATAL: tag bump did not apply to ${file} (image line shape changed?)." >&2; exit 3; }
  echo "bumped ${file} → ${component}:${sha}"
}

# Pin the `image: <reg>/<repo>/<component>(:tag|@sha256:...)` line to an immutable
# digest (integration). Accepts either an existing :tag or @sha256 reference.
pin_manifest_digest() {
  local file="$1" component="$2" digest="$3"
  if [[ ! -f "${file}" ]]; then
    echo "FATAL: ${file} not found in restormel-gitops — manifest must exist. Aborting so the env is never half-bumped." >&2
    exit 3
  fi
  # NB: '#' delimiter (not '|') — the ERE uses '|' for alternation (:tag | @sha256:…),
  # which would collide with a '|' sed delimiter. Image refs never contain '#'.
  sed -i -E "s#(image:[[:space:]]*${REG}/${IMAGE_REPO}/${component})(@sha256:[0-9a-f]{64}|:[A-Za-z0-9._-]+)#\1@${digest}#" "${file}"
  grep -qE "image:[[:space:]]*${REG}/${IMAGE_REPO}/${component}@${digest}" "${file}" \
    || { echo "FATAL: digest pin did not apply to ${file} (image line shape changed?)." >&2; exit 3; }
  echo "pinned ${file} → ${component}@${digest}"
}

# =============================================================================
# PROMOTE (gitops token only; NO build, NO rebuild) — copy the live @sha256 digest
# from the FROM-env manifests into the TO-env manifests and STAGE a gitops promotion
# PR. NEVER pushes HEAD:main and NEVER merges — the PR MERGE is the founder deploy
# gate (HARD RULE 1 / infra rule 8). Build-once/promote-by-digest (ADR §5.3):
# the byte-identical tested image moves envs; only env config differs.
# =============================================================================

# Map an env name to its restormel-gitops manifest directory.
env_manifest_dir() {
  case "$1" in
    integration) echo "applications/restormel-integration" ;;
    prod)        echo "applications/restormel-app-prod" ;;
    *) echo "FATAL: no manifest dir for env '$1'" >&2; exit 2 ;;
  esac
}

# Read the live @sha256 digest off a component's `image:` line. Aborts if the
# component is still pinned by :tag — you can ONLY promote an immutable digest.
# Prints ONLY the digest on stdout (for capture); diagnostics go to stderr.
read_env_digest() { # $1 file  $2 component  $3 env-label -> echoes sha256:...
  local file="$1" component="$2" env="$3" digest
  [[ -f "${file}" ]] || { echo "FATAL: ${file} not found in restormel-gitops." >&2; exit 3; }
  digest="$(grep -oE "image:[[:space:]]*${REG}/${IMAGE_REPO}/${component}@sha256:[0-9a-f]{64}" "${file}" \
            | grep -oE 'sha256:[0-9a-f]{64}' | head -1)"
  if [[ -z "${digest}" ]]; then
    echo "FATAL: ${env} '${component}' is NOT digest-pinned (@sha256) in ${file} — it is still a :tag." >&2
    echo "       You can only promote an immutable digest. Deploy ${env} by digest first" >&2
    echo "       (a merge→integration run pins ${env} by @sha256), then re-run promote." >&2
    exit 3
  fi
  printf '%s' "${digest}"
}

# Open a Forgejo PR (outbound to the git host — allowed; REC-INC-006 forbids the
# CLUSTER control-plane, not the git host). Best-effort: a failed PR-create leaves the
# pushed branch (durable), so a founder can open the PR by hand — never fails the run.
open_promotion_pr() { # $1 from  $2 to  $3 branch  $4 dash-digest  $5 worker-digest
  local from="$1" to="$2" branch="$3" dash="$4" worker="$5"
  local api="https://git.allotmentology.tech/api/v1" title body
  title="promote(${to}): ${from}-tested digest → ${to} (dashboard+worker)"
  body="Automated **digest promotion** (\`k3s-build-push-bump.sh promote ${from} ${to}\`) — NO rebuild.

Copies the ${from}-tested image digests into the \`${to}\` manifests:

- dashboard \`${dash}\`
- worker \`${worker}\`

**Merging this PR is the ${to} deploy gate** (HARD RULE 1 / infra rule 8). Argo reconciles ${to} after merge. Rollback = revert this commit / re-point to the prior digest."
  jq -nc --arg t "${title}" --arg b "${body}" --arg h "${branch}" \
     '{title:$t, body:$b, head:$h, base:"main"}' \
    | curl -fsS -H "Authorization: token ${GITOPS_TOKEN}" -H 'Content-Type: application/json' \
        -X POST --data @- "${api}/repos/${GITOPS_REPO}/pulls" >/dev/null 2>&1 \
    && echo "::notice::Opened ${to} promotion PR from '${branch}' in ${GITOPS_REPO}. Review + MERGE to deploy ${to}." \
    || echo "::warning::branch '${branch}' pushed but PR creation failed — open it by hand (${GITOPS_REPO}: ${branch} → main)."
}

do_promote() { # $1 from-env  $2 to-env
  local from="$1" to="$2"
  : "${GITOPS_TOKEN:?GITOPS_TOKEN required (gitops write + PR-create scope)}"
  local from_dir to_dir
  from_dir="$(env_manifest_dir "${from}")"
  to_dir="$(env_manifest_dir "${to}")"

  local workdir; workdir="$(mktemp -d)"
  trap 'rm -rf "${workdir}"' RETURN
  echo "--- clone restormel-gitops (read ${from} digests → stage ${to} promotion PR) ---"
  git clone --depth 1 "https://x-access-token:${GITOPS_TOKEN}@git.allotmentology.tech/${GITOPS_REPO}.git" "${workdir}/gitops"
  cd "${workdir}/gitops"

  # Read the live @sha256 digests from the FROM env (aborts if still :tag).
  local dash_digest worker_digest
  dash_digest="$(read_env_digest "${from_dir}/20-dashboard-deployment.yaml" dashboard "${from}")"
  worker_digest="$(read_env_digest "${from_dir}/40-worker-deployment.yaml"   worker    "${from}")"
  echo "resolved ${from} digests:"
  echo "  dashboard ${dash_digest}"
  echo "  worker    ${worker_digest}"

  # Pin them into the TO env (pin_manifest_digest converts a :tag or @digest line).
  pin_manifest_digest "${to_dir}/20-dashboard-deployment.yaml" dashboard "${dash_digest}"
  pin_manifest_digest "${to_dir}/40-worker-deployment.yaml"    worker    "${worker_digest}"

  if git diff --quiet; then
    echo "::notice::${to} already at the ${from} digests — nothing to promote (no-op)."
    return 0
  fi

  case "${DRY_RUN:-}" in
    true|1|yes)
      echo "=== DRY_RUN: promote ${from} → ${to} — resolved digests above; proposed diff: ==="
      git --no-pager diff
      echo "=== DRY_RUN: no branch/commit/push/PR. ==="
      return 0
      ;;
  esac

  local short branch
  short="${dash_digest#sha256:}"; short="${short:0:12}"
  branch="promote/${from}-to-${to}-${short}"
  git checkout -b "${branch}"
  git -c user.name=forgejo-ci -c user.email=ci@allotmentology.tech \
      commit -am "promote(${to}): ${from} digest → ${to} (dashboard+worker)

Copies the ${from}-tested image digests into the ${to} manifests. NO rebuild.
Merging this PR is the ${to} deploy gate (HARD RULE 1 / infra rule 8)."
  echo "--- push promotion branch '${branch}' (NEVER HEAD:main) ---"
  git push origin "HEAD:${branch}"
  open_promotion_pr "${from}" "${to}" "${branch}" "${dash_digest}" "${worker_digest}"
  echo "=== done: staged ${from}→${to} promotion on branch '${branch}'. The PR MERGE deploys ${to}. ==="
}

# =============================================================================
# dispatch
# =============================================================================
case "${MODE}" in
  build)
    do_build_push
    emit_digest DASH_DIGEST   "${DASH_DIGEST}"
    emit_digest WORKER_DIGEST "${WORKER_DIGEST}"
    # Hand the batch SHA to the bump step (its workspace is not a git repo).
    [[ "${SHA}" =~ ^[0-9a-f]{12}$ ]] && [[ -n "${GITHUB_OUTPUT:-}" ]] && echo "IMAGE_SHA=${SHA}" >> "${GITHUB_OUTPUT}"
    echo "=== build done: ${ENV_NAME} ${SHA} pushed by digest. ==="
    ;;
  bump)
    do_bump
    ;;
  promote)
    do_promote "${PROMOTE_FROM}" "${PROMOTE_TO}"
    ;;
  all)
    # Legacy combined path (PROD): build+push then bump :tag in one trusted process.
    do_build_push
    case "${DRY_RUN:-}" in
      true|1|yes) echo "=== DRY_RUN: images built+pushed (${SHA}); skipping gitops bump. ==="; exit 0 ;;
    esac
    do_bump
    ;;
esac
