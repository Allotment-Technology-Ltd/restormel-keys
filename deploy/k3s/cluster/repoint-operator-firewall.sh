#!/usr/bin/env bash
# =============================================================================
# repoint-operator-firewall.sh — recover from a dynamic-broadband-IP lockout
# =============================================================================
# The K3s cluster firewall locks SSH (22) + kube-API (6443) to the operator's
# egress IP (cluster_config.yaml `allowed_networks`). On a dynamic broadband IP a
# change locks you out of kubectl + SSH. This re-points those rules to THIS
# machine's CURRENT public IP via the **hcloud Cloud API** — which needs neither
# SSH nor kube access, so it works *even while you're locked out*.
#
# It ONLY rewrites the source IPs of inbound rules on ports 22 and 6443; all other
# rules (80/443/etc.) are left exactly as-is.
#
# Requires: curl, node. Token: $HCLOUD_TOKEN, else fetched from Infisical
# (restormel-ops/prod). NEVER pass the token on argv — it goes via a curl config.
#
# Usage:  ./repoint-operator-firewall.sh [firewall-name]   (default: restormel-sovereign)
#         HCLOUD_TOKEN=... ./repoint-operator-firewall.sh
# =============================================================================
set -euo pipefail
FW_NAME="${1:-restormel-sovereign}"
PROJECT_ID="f0165998-e695-428e-bf20-b776279a6832"   # Infisical restormel-ops

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
CFG="$TMP/curlcfg"

# --- token (env first, else Infisical) — written to a 600 curl config, never argv
TOK="${HCLOUD_TOKEN:-}"
if [ -z "$TOK" ]; then
  TOK="$(infisical secrets get HCLOUD_TOKEN --projectId="$PROJECT_ID" --env=prod \
        --domain=https://secrets.restormel.dev --plain 2>/dev/null | tr -d '\n\r')"
fi
[ -n "$TOK" ] || { echo "ERROR: no HCLOUD_TOKEN (set env or log in to Infisical)"; exit 3; }
{ printf 'header = "Authorization: Bearer '; printf '%s' "$TOK"; printf '"\n'; } > "$CFG"
chmod 600 "$CFG"; unset TOK
API="https://api.hetzner.cloud/v1"

# --- current public egress IP of this machine
IP="$(curl -fsS --max-time 8 https://api.ipify.org || true)"
[ -n "$IP" ] || { echo "ERROR: could not determine current public IP"; exit 4; }
echo "current egress IP: $IP"

# --- find the firewall by name
curl -fsS --config "$CFG" "$API/firewalls?per_page=50" > "$TMP/fw.json"
FW_ID="$(node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1]));const f=(d.firewalls||[]).find(x=>x.name===process.argv[2]);process.stdout.write(f?String(f.id):"")' "$TMP/fw.json" "$FW_NAME")"
[ -n "$FW_ID" ] || { echo "ERROR: firewall '$FW_NAME' not found"; exit 5; }
echo "firewall: $FW_NAME (id $FW_ID)"

# --- rebuild rules: replace source_ips on inbound 22 + 6443 with <current IP>/32
node -e '
const fs=require("fs");
const all=JSON.parse(fs.readFileSync(process.argv[1]));
const id=process.argv[2], ip=process.argv[3];
const fw=all.firewalls.find(x=>String(x.id)===id);
const repoint=new Set(["22","6443"]);
const rules=(fw.rules||[]).map(r=>{
  if(r.direction==="in" && r.protocol==="tcp" && repoint.has(String(r.port||""))){
    return {...r, source_ips:[ip+"/32"]};
  }
  return r;
});
fs.writeFileSync(process.argv[4], JSON.stringify({rules}));
' "$TMP/fw.json" "$FW_ID" "$IP" "$TMP/body.json"

echo "--- new ports 22/6443 source -> $IP/32 ; applying via set_rules ---"
code="$(curl -sS --config "$CFG" -H "Content-Type: application/json" -X POST \
  "$API/firewalls/$FW_ID/actions/set_rules" -d @"$TMP/body.json" -o "$TMP/resp.json" -w '%{http_code}')"
if [ "$code" = "201" ] || [ "$code" = "200" ]; then
  echo "✅ firewall re-pointed to $IP/32 (HTTP $code). kubectl/SSH should work again."
else
  echo "❌ set_rules HTTP $code:"; head -c 400 "$TMP/resp.json"; echo; exit 6
fi
