#!/usr/bin/env bash
# set-status.sh — the one place a PBI's lifecycle state changes.
# Removes any existing status/* label, adds the target one, posts a timeline comment.
# Used by: the lifecycle Action, the Cowork intent applier, and ad-hoc by Claude Code.
# Deployed in the repo at .forgejo/lifecycle/set-status.sh
#
# Usage:  set-status.sh <issue-number> <status/value> [allowed-from-csv]
#   allowed-from-csv (optional): only transition if the current status is one of these
#   (or the issue has no status yet). Prevents regressions like deployed -> in-progress.
#
# Env: FORGEJO_URL, REPO (owner/name), FORGEJO_TOKEN
set -euo pipefail

ISSUE="${1:?issue number}"; NEW="${2:?new status, e.g. status/in-progress}"; ALLOWED="${3:-}"
: "${FORGEJO_URL:?}"; : "${REPO:?owner/name}"; : "${FORGEJO_TOKEN:?}"
API="${FORGEJO_URL%/}/api/v1/repos/${REPO}"
AUTH=(-H "Authorization: token ${FORGEJO_TOKEN}" -H 'Content-Type: application/json')

labels_json="$(curl -fsS "${AUTH[@]}" "$API/issues/${ISSUE}/labels")"
current="$(printf '%s' "$labels_json" | jq -r '[.[]|select(.name|startswith("status/"))|.name][0] // ""')"

if [ "$NEW" = "$current" ]; then echo "= #$ISSUE already $NEW"; exit 0; fi

if [ -n "$ALLOWED" ] && [ -n "$current" ]; then
  case ",$ALLOWED," in
    *",$current,"*) : ;;
    *) echo "skip #$ISSUE ($current not in [$ALLOWED])"; exit 0 ;;
  esac
fi

# remove existing status/* labels (by id)
printf '%s' "$labels_json" | jq -r '.[]|select(.name|startswith("status/"))|.id' | while read -r id; do
  [ -n "$id" ] && curl -fsS "${AUTH[@]}" -X DELETE "$API/issues/${ISSUE}/labels/${id}" >/dev/null || true
done

# Add the new status BY ID. Adding by name is a silent no-op on this Forgejo: the labels are
# org-level, and POST /issues/N/labels by name only matches *repo* labels (returns 200, adds
# nothing). So resolve name->id from org + repo labels, then add by id.
new_id="$(
  { curl -fsS "${AUTH[@]}" "${FORGEJO_URL%/}/api/v1/orgs/${REPO%%/*}/labels?limit=200" 2>/dev/null || true
    curl -fsS "${AUTH[@]}" "$API/labels?limit=200" 2>/dev/null || true; } \
  | jq -r --arg n "$NEW" '.[]?|select(.name==$n)|.id' | head -1)"
if [ -z "$new_id" ]; then echo "! label not found (run apply-forgejo-pm.sh?): $NEW"; exit 1; fi
curl -fsS "${AUTH[@]}" -X POST "$API/issues/${ISSUE}/labels" -d "{\"labels\":[${new_id}]}" >/dev/null

# timeline comment = the audit trail entry
note="${STATUS_NOTE:-}"
curl -fsS "${AUTH[@]}" -X POST "$API/issues/${ISSUE}/comments" \
  -d "{\"body\":\"⏩ status: \`${current:-none}\` → \`${NEW}\`${note:+ — ${note}}\"}" >/dev/null

echo "+ #$ISSUE → $NEW"
