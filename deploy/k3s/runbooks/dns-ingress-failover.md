---
title: DNS / ingress failover — Hetzner LB (restormel-ingress) ↔ K3s nodes
class: technical
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-07-01
last-reviewed: 2026-07-01
review-interval: P12M
related: [AST-032, AST-022, AST-011, AST-020, RISK-001]
---

# DNS / ingress failover — Hetzner LB ↔ K3s nodes

**Delivers RES-135** (and supersedes its original "interim master1 → node2 re-point" intent — that
interim is no longer needed because the **Hetzner LB is the automatic failover**, RES-124/RES-134).
Context: `deploy/k3s/INFRA-EXCELLENCE-REVIEW-2026-06-30.md` (Resilience §, P0 ingress SPOF).

## Current topology (post-RES-124, 2026-07-01)

```
 public DNS (Hetzner DNS, *.ns.hetzner.com)
   A records ─────────────►  77.42.13.120   (Hetzner LB "restormel-ingress", id 6962337, hel1)
                                  │  TCP :80→:80  +  TCP :443→:443   (passthrough, health-check tcp:80)
                                  ▼  targets = 3 nodes via PRIVATE IP (use_private_ip)
        ┌───────────────────────┼───────────────────────┐
   node2 172.16.0.4        master1 172.16.0.5        node4 172.16.0.2
   Traefik hostPort         Traefik hostPort          Traefik hostPort
     :80/:443                 :80/:443                  :80/:443
```

- TLS is **end-to-end to Traefik** (the LB is a TCP passthrough; cert-manager certs on all 3 nodes). SNI
  routing happens at Traefik, so any node serves any host.
- **A-records now on the LB** (all TTL 300): `restormel.dev` @/www/surreal/secrets/integration ·
  `allotmentology.tech` @/www/git/grafana/argo/db/studio/huly/huly-lifecycle · `usesophia.app` @ ·
  `plotbudget.com` **api only**.
- **NOT on the LB** (leave alone): `coolify.allotmentology.tech` → `.150` (legacy) · `plotbudget.com`
  apex → Vercel `216.198.79.1`.

## 1. Single node loss — NO ACTION (automatic)

Losing one node (incl. master1) is now **self-healing at the ingress**: the LB health-check (tcp:80)
marks that target unhealthy within ~30s and serves via the other two. etcd still has quorum (2/3).
Verify:

```bash
export HCLOUD_TOKEN="$(infisical secrets get HCLOUD_TOKEN --projectId=7ea6ec41-1998-4899-8e47-0bd81b8f5b71 --env=prod --domain=https://secrets.restormel.dev --plain)"
hcloud load-balancer describe restormel-ingress -o json | \
  python3 -c "import sys,json;[print(t['server']['id'],[h['status'] for h in t.get('health_status',[])]) for t in json.load(sys.stdin)['targets']]"
```

## 2. LB itself fails (rare — Hetzner LBs are internally HA) → re-point DNS to a node

If `77.42.13.120` is unreachable, fail public ingress back onto a single healthy node's IP (node2
`204.168.216.166`, master1 `135.181.25.76`, or node4 `157.180.79.201`). This re-introduces the SPOF but
restores service. TTL is 300s so propagation ≤ 5 min.

```bash
export HCLOUD_TOKEN="$(infisical secrets get HCLOUD_TOKEN --projectId=7ea6ec41-1998-4899-8e47-0bd81b8f5b71 --env=prod --domain=https://secrets.restormel.dev --plain)"
NODE=204.168.216.166   # pick a node whose Traefik is confirmed serving
for pair in "restormel.dev @" "restormel.dev www" "restormel.dev surreal" "restormel.dev secrets" "restormel.dev integration" \
            "allotmentology.tech @" "allotmentology.tech www" "allotmentology.tech git" "allotmentology.tech grafana" \
            "allotmentology.tech argo" "allotmentology.tech db" "allotmentology.tech studio" "allotmentology.tech huly" \
            "allotmentology.tech huly-lifecycle" "usesophia.app @" "plotbudget.com api"; do
  set -- $pair; hcloud zone rrset set-records "$1" "$2" A --record "$NODE"
done
# verify against authoritative NS
for h in restormel.dev git.allotmentology.tech secrets.restormel.dev; do dig +short "$h" A @hydrogen.ns.hetzner.com; done
```

## 3. Roll back the whole cutover (LB → master1)

Same as §2 but target `135.181.25.76` (the pre-RES-124 state). Then optionally delete the LB:
`hcloud load-balancer delete restormel-ingress`.

## 4. Rebuild the LB from scratch (if deleted)

```bash
hcloud load-balancer create --name restormel-ingress --type lb11 --location hel1
hcloud load-balancer attach-to-network --network restormel-internal restormel-ingress
hcloud load-balancer add-service restormel-ingress --protocol tcp --listen-port 80  --destination-port 80  --health-check-protocol tcp --health-check-port 80
hcloud load-balancer add-service restormel-ingress --protocol tcp --listen-port 443 --destination-port 443 --health-check-protocol tcp --health-check-port 80
for s in restormel-build restormel-sovereign-master1 restormel-node4; do hcloud load-balancer add-target restormel-ingress --server "$s" --use-private-ip; done
```

**Pre-flip verification** (before pointing DNS at any new LB): curl each host at the LB IP with
`--resolve <host>:443:<LB_IP>` and confirm parity with a known-good node before changing DNS.

## ISMS

Link this runbook from the incident-response checklist. The LB is asset **AST-032**; the cutover is
logged in `evidence/ledger.jsonl` (2026-07-01). Availability control: ISO 27001 **A.8.14** (redundancy of
processing facilities) — treats RISK-001 (single-K3s-ingress SPOF).
