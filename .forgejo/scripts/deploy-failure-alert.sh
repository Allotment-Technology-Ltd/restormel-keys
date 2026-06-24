#!/usr/bin/env bash
# deploy-failure-alert.sh — post a deploy-pipeline FAILURE alert to the Telegram ops
# channel (and, optionally, PostHog), so a broken deploy is never silent.
#
# WHY THIS EXISTS (REC-INC-006): prod auto-deploy silently broke for ~14 merges
# because nothing alerted on a failed deploy job. The systemic fix is not just to
# remove the on-box control-plane dependency (deploy-k3s.yml does that) but to make a
# failed build/push/bump/deploy LOUD. This script is the alert leg of that fix and is
# called from every deploy workflow's failure path (`if: ${{ failure() }}`).
#
# OUTBOUND-ONLY (REC-INC-006 invariant): this script only egresses to the public
# Telegram Bot API and (optionally) the public PostHog capture endpoint. It never
# dials an on-box control-plane API (Coolify / Argo / kube-API), never 10.0.1.1 /
# 172.16.0.2 / :6443.
#
# Required env (set by the calling workflow):
#   TELEGRAM_BOT_TOKEN  — Telegram bot token (Forgejo Actions secret)
#   TELEGRAM_CHAT_ID    — ops channel chat id (Forgejo Actions secret)
# Optional env:
#   POSTHOG_API_KEY     — PostHog project write key; if set, also captures a
#                         `ci_deploy_failed` event (POSTHOG_HOST default eu.posthog.com)
#   POSTHOG_HOST        — override capture host (default https://eu.posthog.com)
#   DEPLOY_PIPELINE     — human label for the pipeline, e.g. "deploy-k3s (prod)"
#   DEPLOY_ENV          — staging | prod (free-text)
#   RUN_URL             — link to the failing run (built from GITHUB_* if absent)
#
# Secrets absent ⇒ no-op cleanly (GitHub mirror / forks / first-time setup), so wiring
# this in is always safe and additive. NEVER fail the workflow because alerting failed.
set -uo pipefail

PIPELINE="${DEPLOY_PIPELINE:-deploy}"
ENVN="${DEPLOY_ENV:-unknown}"
REPO="${GITHUB_REPOSITORY:-restormel-keys}"
REF="${GITHUB_REF_NAME:-${GITHUB_SHA:-?}}"
RUN_NUMBER="${GITHUB_RUN_NUMBER:-?}"

# Build a run URL if the workflow didn't pass one (Forgejo exposes GITHUB_SERVER_URL).
if [ -z "${RUN_URL:-}" ]; then
  if [ -n "${GITHUB_SERVER_URL:-}" ] && [ -n "${GITHUB_RUN_ID:-}" ]; then
    RUN_URL="${GITHUB_SERVER_URL}/${REPO}/actions/runs/${GITHUB_RUN_ID}"
  else
    RUN_URL="(run url unavailable)"
  fi
fi

MSG="🚨 DEPLOY FAILED — ${PIPELINE}
repo: ${REPO}
env: ${ENVN}
ref: ${REF}
run: #${RUN_NUMBER}
${RUN_URL}

A deploy-pipeline job failed. Prod/staging may be on the previous image. Check the run, then follow deploy/k3s/runbooks/docker-runner.md (or the restormel-infra-alert-response skill)."

# --- Telegram (primary ops channel) ---------------------------------------------
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  curl -s -m 15 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d chat_id="${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${MSG}" >/dev/null \
    && echo "Telegram deploy-failure alert sent." \
    || echo "::warning::Telegram deploy-failure alert POST failed (non-fatal)."
else
  echo "Telegram secrets unset — skipping Telegram alert (expected on the GitHub mirror / forks)."
fi

# --- PostHog (optional, for dashboards/retention of deploy-failure events) -------
if [ -n "${POSTHOG_API_KEY:-}" ]; then
  PH_HOST="${POSTHOG_HOST:-https://eu.posthog.com}"
  PH_HOST="${PH_HOST%/}"
  curl -s -m 15 -X POST "${PH_HOST}/capture/" \
    -H 'Content-Type: application/json' \
    --data "$(printf '{"api_key":"%s","event":"ci_deploy_failed","distinct_id":"ci-deploy-pipeline","properties":{"pipeline":"%s","env":"%s","repo":"%s","ref":"%s","run_number":"%s","run_url":"%s"}}' \
      "${POSTHOG_API_KEY}" "${PIPELINE}" "${ENVN}" "${REPO}" "${REF}" "${RUN_NUMBER}" "${RUN_URL}")" >/dev/null \
    && echo "PostHog ci_deploy_failed event captured." \
    || echo "::warning::PostHog capture failed (non-fatal)."
else
  echo "POSTHOG_API_KEY unset — skipping PostHog capture (optional)."
fi

# Never fail the workflow because of the alert leg itself.
exit 0
