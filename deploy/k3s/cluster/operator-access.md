# Operator access to the K3s cluster — dynamic-IP-resilient

The cluster firewall (created by `hetzner-k3s` from `cluster_config.yaml`
`allowed_networks`) locks **SSH (22)** and **kube-API (6443)** to the operator's
egress IP. On a **dynamic broadband IP** a change locks the operator out of `kubectl`
and SSH. The cluster keeps running — only *management access* is cut, and it is always
recoverable. This doc gives the durable operating model + the recovery path.

> **Decision (2026-06-20):** prefer **(A) manage kube-API over the private network via a
> box tunnel** for day-to-day work, with **(B) the firewall re-point helper** as the
> safety net. This removes the broadband-IP dependency for routine management.

## (A) Reach kube-API over the private network (recommended, dynamic-IP-proof)

The cluster nodes sit on `restormel-internal` (`172.16.0.0/16`) alongside the existing
boxes. Instead of hitting the master's **public** IP:6443 (firewalled to your egress
IP), tunnel to its **private** IP:6443 through a box you can already SSH to — exactly
like the existing `pnpm infra` Coolify tunnel.

```bash
# master private IP is .5 during bootstrap (see nodes-target.md); jump via a box (.150).
ssh -i ~/.ssh/id_hetzner_allotment -N -L 6443:172.16.0.5:6443 deploy@77.42.125.150
# then point kubectl at the tunnel:
kubectl --server=https://127.0.0.1:6443 ...      # or set `server:` in the kubeconfig
```

Then **drop the public IP from `allowed_networks.api`** (keep it only on `ssh` for the
occasional `hetzner-k3s create`/`upgrade`). Management no longer depends on your
broadband IP.

> **⚠ TLS SAN requirement.** The kube-API serving cert must include the address you
> connect *through* as a Subject Alternative Name, or `kubectl` TLS fails. When
> tunnelling to `127.0.0.1`/the private IP, ensure those are SANs. Set in
> `cluster_config.yaml`:
> ```yaml
> api_server_args:
>   - "tls-san=127.0.0.1"
>   - "tls-san=172.16.0.5"      # master private IP (adjust per node / fold-in)
> ```
> (hetzner-k3s adds the node public/private IPs by default; add `127.0.0.1` explicitly
> for the local-tunnel case. Verify with `openssl s_client -connect 127.0.0.1:6443`.)

## (B) Firewall re-point helper (safety net for any public-IP operation)

When you *do* need your public IP allowed (a `hetzner-k3s` run, or before (A) is wired)
and your broadband IP has changed, recover with **`repoint-operator-firewall.sh`**:

```bash
HCLOUD_TOKEN="$(infisical secrets get HCLOUD_TOKEN --projectId=<restormel-ops> \
  --env=prod --domain=https://secrets.restormel.dev --plain)" \
  ./deploy/k3s/cluster/repoint-operator-firewall.sh restormel-sovereign
```

It rewrites *only* the ports-22/6443 source IPs on the named firewall to your current
egress IP, via the **hcloud Cloud API** — so it works **even while you're locked out**
(no SSH/kube needed). All other rules (80/443) are untouched.

## (C) Heavier alternatives (if (A)+(B) aren't enough)

- **Tailscale / WireGuard** — reach the API over the tailnet; allowlist the tailnet
  instead of a public IP. No broadband dependency; more setup.
- **Static-IP bastion** — a tiny always-on Cloud server with a static IP as the only
  allowlisted jump host (a few €/mo).
- **ISP static IP** — often available on business broadband for a small fee; cleanest
  if offered.

## Never a permanent lockout

Firewall rules are Cloud-API-managed, so even total loss of access is recovered by (B)
or the Hetzner console. The cluster + workloads keep running throughout; only operator
management is affected.
