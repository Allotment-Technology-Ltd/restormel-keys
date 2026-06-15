#!/usr/bin/env bash
#
# infra.sh — one-command access to the self-hosted Forgejo + Coolify box.
#
# Forgejo and Coolify run as always-on Docker stacks on the Hetzner box
# (git.allotmentology.tech / 77.42.125.150). They are NOT local services and
# normally never need starting. What you actually need each session is the
# LOCAL ACCESS PATH:
#   - Forgejo web  : already public over HTTPS (no tunnel needed)
#   - Coolify UI   : firewall-blocked from the internet -> reach via SSH tunnel
#                    forwarding localhost:8000 -> box:8000
#   - Forgejo SSH  : optional tunnel localhost:22223 -> box:22222 (git push now
#                    uses HTTPS, so this is secondary)
#
# This script: checks the box stacks are healthy (and starts any that have
# genuinely stopped), opens one multiplexed SSH tunnel for both forwards, then
# prints the URLs. Safe to run repeatedly — it's idempotent and never restarts
# healthy production containers.
#
# Usage:
#   bash scripts/infra.sh up        # ensure healthy + open tunnel (default)
#   bash scripts/infra.sh status    # show box + local tunnel state
#   bash scripts/infra.sh down       # close the local tunnel
#   bash scripts/infra.sh open       # open Coolify + Forgejo in the browser
#
# Or via pnpm: pnpm infra | pnpm infra:status | pnpm infra:down | pnpm infra:open

set -euo pipefail

# --- config -----------------------------------------------------------------
BOX_HOST="77.42.125.150"
BOX_USER="deploy"
SSH_KEY="${HOME}/.ssh/id_hetzner_allotment"
CONTROL_SOCK="${HOME}/.ssh/cm-restormel-box.sock"

COOLIFY_LOCAL_PORT=8000
COOLIFY_BOX_PORT=8000
FORGEJO_SSH_LOCAL_PORT=22223
FORGEJO_SSH_BOX_PORT=22222

COOLIFY_URL="http://localhost:${COOLIFY_LOCAL_PORT}"
FORGEJO_URL="https://git.allotmentology.tech"

SSH_BASE=(ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=8)

# --- helpers ----------------------------------------------------------------
say()  { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
err()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }

tunnel_alive() {
  ssh -O check -S "${CONTROL_SOCK}" "${BOX_USER}@${BOX_HOST}" >/dev/null 2>&1
}

port_listening() { # $1 = local port
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# Reachability + on-box health, and start anything that genuinely stopped.
# Only restarts containers with a restart policy (the real services) — never the
# ephemeral Forgejo CI-job containers (restart policy "no").
ensure_box() {
  say "Box: ${BOX_USER}@${BOX_HOST}"
  if ! "${SSH_BASE[@]}" -o BatchMode=yes "${BOX_USER}@${BOX_HOST}" true 2>/dev/null; then
    err "SSH unreachable. Is the box up / VPN needed? (key: ${SSH_KEY})"
    return 1
  fi
  ok "SSH reachable"

  "${SSH_BASE[@]}" -o BatchMode=yes "${BOX_USER}@${BOX_HOST}" 'bash -s' <<'REMOTE'
set -euo pipefail
core=$(docker ps -a --format '{{.Names}}' | grep -iE 'forgejo|coolify' | grep -viE 'ACTIONS-TASK' || true)
down=0
while IFS= read -r c; do
  [ -z "$c" ] && continue
  state=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo unknown)
  policy=$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$c" 2>/dev/null || echo no)
  if [ "$state" = "running" ]; then
    printf '  \033[32m✓\033[0m %-48s running\n' "$c"
  elif [ "$policy" != "no" ] && [ -n "$policy" ]; then
    printf '  \033[33m!\033[0m %-48s %s -> starting\n' "$c" "$state"
    if docker start "$c" >/dev/null 2>&1; then
      printf '      \033[32m✓\033[0m started\n'
    else
      printf '      \033[31m✗\033[0m start FAILED\n'; down=$((down+1))
    fi
  else
    printf '  \033[33m!\033[0m %-48s %s (ephemeral, left alone)\n' "$c" "$state"
  fi
done <<EOF
$core
EOF
exit $down
REMOTE
}

open_tunnel() {
  if tunnel_alive; then
    ok "Tunnel already open (Coolify ${COOLIFY_LOCAL_PORT}, Forgejo SSH ${FORGEJO_SSH_LOCAL_PORT})"
    return 0
  fi
  # A stale socket or a foreign process may hold the ports.
  rm -f "${CONTROL_SOCK}" 2>/dev/null || true
  for p in "${COOLIFY_LOCAL_PORT}" "${FORGEJO_SSH_LOCAL_PORT}"; do
    if port_listening "$p"; then
      err "Local port $p already in use by another process — close it or run 'down'."
      return 1
    fi
  done
  ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new \
      -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
      -M -S "${CONTROL_SOCK}" -fNT \
      -L "${COOLIFY_LOCAL_PORT}:localhost:${COOLIFY_BOX_PORT}" \
      -L "${FORGEJO_SSH_LOCAL_PORT}:localhost:${FORGEJO_SSH_BOX_PORT}" \
      "${BOX_USER}@${BOX_HOST}"
  if tunnel_alive; then
    ok "Tunnel open"
  else
    err "Tunnel failed to start"
    return 1
  fi
}

print_urls() {
  echo
  say "Ready:"
  printf '  Coolify console : \033[36m%s\033[0m  (via SSH tunnel)\n' "${COOLIFY_URL}"
  printf '  Forgejo         : \033[36m%s\033[0m  (public HTTPS)\n' "${FORGEJO_URL}"
  printf '  Forgejo SSH     : ssh -p %s git@localhost  (git push uses HTTPS; tunnel optional)\n' "${FORGEJO_SSH_LOCAL_PORT}"
  echo
  printf '  Stop the tunnel: \033[2mpnpm infra:down\033[0m   Open in browser: \033[2mpnpm infra:open\033[0m\n'
}

cmd_up() {
  ensure_box || warn "Box health check reported problems (see above) — opening tunnel anyway."
  echo
  open_tunnel
  print_urls
}

cmd_status() {
  say "Local tunnel"
  if tunnel_alive; then ok "open"; else warn "closed (run 'pnpm infra')"; fi
  port_listening "${COOLIFY_LOCAL_PORT}" && ok "Coolify ${COOLIFY_URL} listening" || warn "Coolify port ${COOLIFY_LOCAL_PORT} not listening"
  echo
  ensure_box || true
}

cmd_down() {
  if tunnel_alive; then
    ssh -O exit -S "${CONTROL_SOCK}" "${BOX_USER}@${BOX_HOST}" 2>/dev/null || true
    rm -f "${CONTROL_SOCK}" 2>/dev/null || true
    ok "Tunnel closed"
  else
    warn "No tunnel running"
  fi
}

cmd_open() {
  tunnel_alive || { warn "Tunnel not open — running 'up' first"; cmd_up; }
  if command -v open >/dev/null 2>&1; then
    open "${COOLIFY_URL}" "${FORGEJO_URL}"
    ok "Opened Coolify + Forgejo in your browser"
  else
    print_urls
  fi
}

case "${1:-up}" in
  up)     cmd_up ;;
  status) cmd_status ;;
  down)   cmd_down ;;
  open)   cmd_open ;;
  *) echo "usage: infra.sh [up|status|down|open]"; exit 2 ;;
esac
