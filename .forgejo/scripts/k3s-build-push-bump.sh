#!/usr/bin/env bash
# k3s-build-push-bump.sh — build the dashboard + worker images with BuildKit, push
# them to the Forgejo container registry, and bump the deployed image tag in the
# restormel-gitops repo so Argo CD (PULL model) sees the new release as OutOfSync.
#
# Called by .forgejo/workflows/deploy-k3s.yml. Runs INSIDE a privileged
# `moby/buildkit` job container on the on-cluster Forgejo runner (the .166/.150
# off-cluster `docker-build` runner premise died when those boxes became K3s nodes
# / were retired — REC-PLAN-021). BuildKit builds natively on an amd64 cluster node;
# no Docker daemon / docker CLI is required.
#
# REC-INC-006 INVARIANT: OUTBOUND-ONLY. This script must NEVER call an on-box
# control-plane API (Coolify / Argo / kube-API), never `kubectl`/`argocd`, never dial
# 10.0.1.1 / 172.16.0.x / :6443. It only: builds, pushes to the public registry
# (egress), and `git push` to the public restormel-gitops repo. The deploy completes
# by Argo CD PULLING from git inside the cluster.
#
# Required env (set by the workflow):
#   ENV_NAME           — "integration" | "prod"  (also accepted as $1)
#   REG                — registry host (git.allotmentology.tech)
#   IMAGE_REPO         — registry path/org ("allotment-technology-ltd")
#   REG_USER REG_TOKEN — registry push creds. REG_TOKEN needs write:package
#                        (FORGEJO_REGISTRY in Infisical; the PM token is read-only).
#   GITOPS_TOKEN       — write token for restormel-gitops (the bump commit)
#   GITOPS_REPO        — Allotment-Technology-Ltd/restormel-gitops
set -euo pipefail

ENV_NAME="${1:-${ENV_NAME:?ENV_NAME (integration|prod) required}}"
case "${ENV_NAME}" in
  integration|prod) ;;
  *) echo "FATAL: ENV_NAME must be 'integration' or 'prod', got '${ENV_NAME}'"; exit 2 ;;
esac

: "${REG:?REG required}"
: "${IMAGE_REPO:?IMAGE_REPO required}"
: "${REG_USER:?REG_USER required}"
: "${REG_TOKEN:?REG_TOKEN required}"
: "${GITOPS_TOKEN:?GITOPS_TOKEN required}"
GITOPS_REPO="${GITOPS_REPO:-Allotment-Technology-Ltd/restormel-gitops}"

# 12-hex short SHA — matches the running prod image tag convention
# (git.allotmentology.tech/allotment-technology-ltd/dashboard:<12hex>).
SHA="$(git rev-parse --short=12 HEAD)"
DASH_IMG="${REG}/${IMAGE_REPO}/dashboard:${SHA}"
WORKER_IMG="${REG}/${IMAGE_REPO}/worker:${SHA}"

echo "=== K3s build→push→bump | env=${ENV_NAME} sha=${SHA} reg=${REG}/${IMAGE_REPO} ==="

# --- 1. registry auth for BuildKit's pusher (egress) -------------------------
# buildctl reads $DOCKER_CONFIG/config.json (or ~/.docker/config.json) and forwards
# the auth to buildkitd, which performs the push. No `docker login` / daemon needed.
DKR_CFG="$(mktemp -d)"; export DOCKER_CONFIG="${DKR_CFG}"
AUTH_B64="$(printf '%s:%s' "${REG_USER}" "${REG_TOKEN}" | base64 | tr -d '\n')"
umask 077
cat > "${DKR_CFG}/config.json" <<JSON
{"auths":{"${REG}":{"auth":"${AUTH_B64}"}}}
JSON
unset AUTH_B64

# --- 2. build + push with BuildKit (native amd64, in the buildkit container) --
# Same Dockerfiles as before (built from the repo root so the pnpm workspace +
# lockfile resolve). buildctl-daemonless.sh starts an ephemeral buildkitd.
buildkit_build_push() {
  local dockerfile="$1" image="$2" name="$3"
  echo "--- build+push ${name} (${dockerfile}) → ${image} ---"
  buildctl-daemonless.sh build \
    --frontend dockerfile.v0 \
    --local context=. \
    --local dockerfile=. \
    --opt filename="${dockerfile}" \
    --output "type=image,name=${image},push=true"
}
buildkit_build_push Dockerfile.dashboard "${DASH_IMG}" dashboard
buildkit_build_push Dockerfile.worker    "${WORKER_IMG}" worker

# DRY_RUN=true|1 → validate the build+push surface without touching prod gitops.
case "${DRY_RUN:-}" in
  true|1|yes)
    echo "=== DRY_RUN: images built+pushed (${SHA}); skipping gitops bump. ==="
    exit 0 ;;
esac

# --- 3. bump the deployed image tag in restormel-gitops (egress git push) -----
# BOTH envs are RAW MANIFESTS now (applications/<app>/*-deployment.yaml,
# image: <reg>/<path>/<name>:<tag>) — the dead helm-values staging path (which
# targeted the never-created values/restormel-*-staging.yaml and was the root
# cause of the broken staging Argo app) has been removed. Argo:
#   prod        → AUTO-SYNCS restormel-app-prod  (REC-ADR-011, 2026-06-27)
#   integration → AUTO-SYNCS restormel-integration (project restormel-nonprod).
# The integration manifests are authored by RES-114 Phase 1 (separate workstream);
# until they land, bump_manifest_image()'s FATAL-on-missing-file guard aborts the
# bump so the env is never half-bumped.
WORKDIR="$(mktemp -d)"
trap 'rm -rf "${WORKDIR}" "${DKR_CFG}"' EXIT
echo "--- clone restormel-gitops ---"
git clone --depth 1 "https://x-access-token:${GITOPS_TOKEN}@git.allotmentology.tech/${GITOPS_REPO}.git" "${WORKDIR}/gitops"
cd "${WORKDIR}/gitops"

# Replace only the tag on the `image: <reg>/<repo>/<component>:<tag>` line.
bump_manifest_image() {
  local file="$1" component="$2"
  if [[ ! -f "${file}" ]]; then
    echo "FATAL: ${file} not found in restormel-gitops — prod manifest must exist. Aborting so prod is never half-bumped." >&2
    exit 3
  fi
  sed -i -E "s|(image:[[:space:]]*${REG}/${IMAGE_REPO}/${component}:)[A-Za-z0-9._-]+|\1${SHA}|" "${file}"
  grep -qE "image:[[:space:]]*${REG}/${IMAGE_REPO}/${component}:${SHA}" "${file}" \
    || { echo "FATAL: tag bump did not apply to ${file} (image line shape changed?)." >&2; exit 3; }
  echo "bumped ${file} → ${component}:${SHA}"
}

case "${ENV_NAME}" in
  prod)
    bump_manifest_image "applications/restormel-app-prod/20-dashboard-deployment.yaml" dashboard
    bump_manifest_image "applications/restormel-app-prod/40-worker-deployment.yaml"    worker
    ;;
  integration)
    # Same raw-manifest image-line bump as prod, against the RES-114 integration env's
    # deployments (authored by Phase 1). Reuses bump_manifest_image() so the identical
    # FATAL-on-missing-file guard protects against a half-bump until those files exist.
    bump_manifest_image "applications/restormel-integration/20-dashboard-deployment.yaml" dashboard
    bump_manifest_image "applications/restormel-integration/40-worker-deployment.yaml"    worker
    ;;
esac

if git diff --quiet; then
  echo "::notice::image tag already ${SHA} in ${ENV_NAME} — nothing to commit (re-run / no-op)."
  exit 0
fi

git -c user.name=forgejo-ci -c user.email=ci@allotmentology.tech \
    commit -am "deploy(${ENV_NAME}): dashboard+worker ${SHA}"
echo "--- push bump to restormel-gitops main ---"
git push origin HEAD:main

echo "=== done: ${ENV_NAME} bumped to ${SHA}. Argo will reconcile (prod=manual sync). ==="
