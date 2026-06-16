#!/usr/bin/env bash
# deploy-callback.sh — flip linked PBIs to status/deployed and close them after a successful
# deploy. Wire this as a Coolify *post-deployment command* (Resource → General → Post-deploy),
# or call it from a notification webhook handler. Deployed at .forgejo/lifecycle/deploy-callback.sh
#
# Resolves issue numbers from (in order): args, or $COMMIT's message, or the latest commit on
# $BRANCH (default main). Env: FORGEJO_URL, REPO (owner/name), FORGEJO_TOKEN, [BRANCH], [COMMIT].
set -euo pipefail
: "${FORGEJO_URL:?}"; : "${REPO:?owner/name}"; : "${FORGEJO_TOKEN:?}"
BRANCH="${BRANCH:-main}"
API="${FORGEJO_URL%/}/api/v1/repos/${REPO}"
AUTH=(-H "Authorization: token ${FORGEJO_TOKEN}" -H 'Content-Type: application/json')
HERE="$(cd "$(dirname "$0")" && pwd)"

nums=("$@")
if [ "${#nums[@]}" -eq 0 ]; then
  sha="${COMMIT:-$(curl -fsS "${AUTH[@]}" "$API/branches/${BRANCH}" | jq -r '.commit.id')}"
  msg="$(curl -fsS "${AUTH[@]}" "$API/git/commits/${sha}" | jq -r '.commit.message')"
  nums=()
  while IFS= read -r x; do [ -n "$x" ] && nums+=("$x"); done \
    < <(printf '%s' "$msg" | grep -oE '#[0-9]+' | tr -d '#' | sort -u)
fi

for n in "${nums[@]:-}"; do
  [ -n "$n" ] || continue
  STATUS_NOTE="deployed to ${BRANCH}" "$HERE/set-status.sh" "$n" status/deployed "status/ready-deploy,status/in-review,status/in-progress" || true
  curl -fsS "${AUTH[@]}" -X PATCH "$API/issues/${n}" -d '{"state":"closed"}' >/dev/null || true
  echo "deployed + closed #$n"
done
