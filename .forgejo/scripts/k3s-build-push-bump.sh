#!/usr/bin/env bash
# k3s-build-push-bump.sh — build the dashboard + worker images, push them to the
# Forgejo container registry, and bump `image.tag` in the restormel-gitops helm
# values so Argo CD (PULL model) sees the new release as OutOfSync.
#
# Called by .forgejo/workflows/deploy-k3s.yml for both staging and prod. The ONLY
# difference between environments is which values files get the tag bump; the build
# + push are identical (one SHA, consumed by both apps and both envs of that release).
#
# REC-INC-006 INVARIANT: OUTBOUND-ONLY. This script must NEVER call an on-box
# control-plane API (Coolify / Argo / kube-API), never `kubectl`/`argocd`, never dial
# 10.0.1.1 / 172.16.0.2 / :6443. It only: builds, `docker push` (egress to the public
# registry), and `git push` to the public restormel-gitops repo. The deploy completes
# by Argo CD PULLING from git inside the cluster. See deploy/k3s/runbooks/docker-runner.md §0.
#
# Required env (set by the workflow):
#   ENV_NAME           — "staging" | "prod"  (also accepted as $1)
#   REG                — registry host (registry.allotmentology.tech)
#   REG_USER REG_TOKEN — registry push/pull creds (scoped to the restormel org)
#   GITOPS_TOKEN       — write token for restormel-gitops
#   GITOPS_REPO        — Allotment-Technology-Ltd/restormel-gitops
#   GITOPS_VALUES_DIR  — "values"
set -euo pipefail

ENV_NAME="${1:-${ENV_NAME:?ENV_NAME (staging|prod) required}}"
case "${ENV_NAME}" in
  staging|prod) ;;
  *) echo "FATAL: ENV_NAME must be 'staging' or 'prod', got '${ENV_NAME}'"; exit 2 ;;
esac

: "${REG:?REG required}"
: "${REG_USER:?REG_USER required}"
: "${REG_TOKEN:?REG_TOKEN required}"
: "${GITOPS_TOKEN:?GITOPS_TOKEN required}"
GITOPS_REPO="${GITOPS_REPO:-Allotment-Technology-Ltd/restormel-gitops}"
GITOPS_VALUES_DIR="${GITOPS_VALUES_DIR:-values}"

# 12-hex short SHA — matches the staging Image-Updater allow-tags regexp
# (^[0-9a-f]{12}$) in restormel-gitops applications/workloads/restormel-dashboard-staging.yaml.
SHA="$(git rev-parse --short=12 HEAD)"
DASH_IMG="${REG}/restormel/dashboard:${SHA}"
WORKER_IMG="${REG}/restormel/worker:${SHA}"

echo "=== K3s build→push→bump | env=${ENV_NAME} sha=${SHA} ==="

# --- 1. registry login (egress) ---------------------------------------------
# Surface auth vs network failure clearly (runbook §8 follow-up: no bare -sf).
echo "--- docker login ${REG} ---"
echo "${REG_TOKEN}" | docker login "${REG}" -u "${REG_USER}" --password-stdin

# --- 2. build (buildkit/buildx on the docker-build runner) -------------------
# Same Dockerfiles as the Coolify build pack (Dockerfile.dashboard / Dockerfile.worker),
# built from the repo root so the workspace + lockfile resolve.
echo "--- build dashboard ---"
docker build -f Dockerfile.dashboard -t "${DASH_IMG}" .
echo "--- build worker ---"
docker build -f Dockerfile.worker -t "${WORKER_IMG}" .

# --- 3. push (egress) --------------------------------------------------------
echo "--- push dashboard ---"
docker push "${DASH_IMG}"
echo "--- push worker ---"
docker push "${WORKER_IMG}"

# --- 4. bump the image tag in restormel-gitops (egress git push) -------------
# Argo Applications read ../../values/restormel-{dashboard,worker}-{env}.yaml and
# consume `.image.tag`. Bumping it makes Argo OutOfSync:
#   staging → auto-syncs;  prod → OPERATOR SYNCS BY HAND (manual gate).
WORKDIR="$(mktemp -d)"
trap 'rm -rf "${WORKDIR}"' EXIT
echo "--- clone restormel-gitops ---"
# Token in the URL is masked by the runner; never echoed.
git clone --depth 1 "https://x-access-token:${GITOPS_TOKEN}@git.allotmentology.tech/${GITOPS_REPO}.git" "${WORKDIR}/gitops"
cd "${WORKDIR}/gitops"

DASH_VALUES="${GITOPS_VALUES_DIR}/restormel-dashboard-${ENV_NAME}.yaml"
WORKER_VALUES="${GITOPS_VALUES_DIR}/restormel-worker-${ENV_NAME}.yaml"

bump_tag() {
  local file="$1"
  if [[ ! -f "${file}" ]]; then
    echo "FATAL: ${file} not found in restormel-gitops — the helm values file must exist (gitops chart deliverable). Aborting so prod is never half-bumped." >&2
    exit 3
  fi
  if command -v yq >/dev/null 2>&1; then
    yq -i ".image.tag = \"${SHA}\"" "${file}"
  else
    # No yq on the runner: in-place edit of the `tag:` under `image:` only.
    # Assumes the canonical two-line block:  image:\n    tag: <value>
    # (the chart values are authored that way; yq is preferred when available).
    perl -0pi -e "s/(^image:\\s*\\n(?:[^\\S\\n].*\\n)*?\\s*tag:\\s*)\\S+/\${1}${SHA}/m" "${file}"
  fi
  echo "bumped ${file} → image.tag=${SHA}"
}

bump_tag "${DASH_VALUES}"
bump_tag "${WORKER_VALUES}"

if git diff --quiet; then
  echo "::notice::image.tag already ${SHA} in ${ENV_NAME} values — nothing to commit (re-run / no-op)."
  exit 0
fi

git -c user.name=forgejo-ci -c user.email=ci@allotmentology.tech \
    commit -am "deploy(${ENV_NAME}): dashboard+worker ${SHA}"
echo "--- push bump to restormel-gitops main ---"
git push origin HEAD:main

echo "=== done: ${ENV_NAME} bumped to ${SHA}. Argo will reconcile (staging auto-sync; prod manual sync). ==="
