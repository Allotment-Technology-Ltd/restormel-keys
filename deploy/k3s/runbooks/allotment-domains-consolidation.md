# Runbook — allotment.work + allotment.works → redirect + registrar consolidation

**Status:** PREP COMPLETE — awaiting founder-gated NS flip + transfers.
**Owner:** founder (registrar steps) + ops (DNS / cluster — already done).
**Decision (2026-06-24):** both `allotment.work` and `allotment.works` become permanent
(301) redirects to **allotmentology.tech**. This replaces the old `allotment.works`
Vercel personal site ("Adam Boon — product leadership"). Founder accepted.

---

## TL;DR — what is already done vs what is gated

| Step | State | Where |
|------|-------|-------|
| Hetzner DNS zones created (`allotment.work`, `allotment.works`) | ✅ DONE (inert) | Hetzner Cloud API |
| Zone records: `@ A` / `www A` → `135.181.25.76`, `CAA letsencrypt.org` | ✅ DONE | Hetzner Cloud API |
| Traefik redirect IngressRoutes + RedirectRegex + SAN cert | ✅ PR (not merged) | `restormel-gitops` PR #21 |
| ClusterIssuer `dnsZones` += both zones | ✅ PR (not merged) | `restormel-gitops` PR #21 |
| **Registrar NS flip → Hetzner NS** | ⛔ GATED — founder only | registrar (Vercel / Name.com) |
| **Registrar consolidation → INWX** | ⛔ GATED — founder only | INWX + losing registrars |

Nothing live changes until the **NS flip**. The TLS cert cannot issue until the zone is
authoritative at Hetzner (DNS-01 solver writes a TXT into the Hetzner zone), so the
sequence is: merge PR #21 → flip NS → cert issues automatically → redirect goes live.

---

## Topology / facts

- **K3s ingress IP:** `135.181.25.76` (Traefik DaemonSet, hostPort 80/443). Both zones'
  apex + `www` A records point here.
- **Redirect target:** `https://allotmentology.tech` (currently A → `77.42.125.150`, the
  Coolify/.150 box). The redirect is a 301 to the **hostname**, resolved fresh by the
  client, so it stays correct even if/when allotmentology.tech later moves to K3s.
- **Hetzner NS triplet (set authoritative at the registrar):**
  - `hydrogen.ns.hetzner.com`
  - `helium.ns.hetzner.de`
  - `oxygen.ns.hetzner.com`
- **Hetzner DNS zone IDs:** `allotment.work` = `1418104`, `allotment.works` = `1418105`.
- **Current registrars (pre-flip):**
  - `allotment.work` — **Vercel** (DNS on `ns1/ns2.vercel-dns.com`; domain currently dark — no A record).
  - `allotment.works` — **Name.com** registrar, **Vercel DNS** (`ns1/ns2.vercel-dns.com`),
    serving the personal site (`307 → https://www.allotment.works/`).

> ⚠️ Use the **HCLOUD_TOKEN** (Hetzner **Cloud** API token) for all Hetzner DNS API calls.
> There is NO separate `dns.hetzner.com` token — that endpoint 301-redirects to the console.
> The Cloud API base is `https://api.hetzner.cloud/v1/zones` with `Authorization: Bearer <HCLOUD_TOKEN>`.
> Token lives in Infisical `restormel-ops`/`prod` key `HCLOUD_TOKEN` — fetch scoped, never print.

---

## Phase A — Merge the redirect (ops, low-risk)

1. Review + merge **`restormel-gitops` PR #21** (`feat/allotment-redirect-aliases`).
2. Argo `cluster-addons` app syncs `cluster/ingress/**`. Verify:
   ```bash
   export KUBECONFIG=/private/tmp/k3s-create/kubeconfig
   kubectl get ns redirects
   kubectl get certificate -n redirects allotment-redirect          # READY may be False until NS flip
   kubectl get ingressroute -n redirects
   kubectl get middleware -n redirects to-allotmentology
   ```
   The Certificate will sit `READY=False` (DNS-01 cannot validate) until Phase B — **expected**.
   Traefik serves the route with the default cert meanwhile; the 301 itself works on `:80`
   immediately for any client that already resolves the host to `135.181.25.76`.

---

## Phase B — NS flip per registrar (FOUNDER-GATED)

> Flipping NS makes Hetzner authoritative → cert issues → redirect goes fully live (HTTPS).
> Do ONE domain at a time; verify before the second. **Do not initiate transfers in this phase.**

### B1 — `allotment.work` (registrar: Vercel)
Vercel Dashboard → **Domains** → `allotment.work` → **Nameservers** → switch from
Vercel nameservers to **Custom** and set:
```
hydrogen.ns.hetzner.com
helium.ns.hetzner.de
oxygen.ns.hetzner.com
```
(If `allotment.work` is managed as a Vercel project domain rather than a registrar entry,
the NS change is at whoever the registrar of record is — confirm in the Vercel domain detail
panel; Vercel resells via a registrar partner. Founder has the Vercel account.)

### B2 — `allotment.works` (registrar: Name.com, DNS currently Vercel)
Name.com → **My Domains** → `allotment.works` → **Nameservers** → replace
`ns1/ns2.vercel-dns.com` with the three Hetzner NS above.
> This is what cuts over the old personal site. After propagation, `https://allotment.works`
> and `https://www.allotment.works` 301 → `https://allotmentology.tech`.

### B3 — Verify each (allow up to TTL/propagation, typically <1h, NS up to 24–48h)
```bash
dig +short NS allotment.work        # → the 3 hetzner NS
dig +short NS allotment.works       # → the 3 hetzner NS
dig +short A   allotment.work       # → 135.181.25.76
dig +short A   allotment.works      # → 135.181.25.76
# Cert should go READY once NS is live:
kubectl get certificate -n redirects allotment-redirect
# End-to-end redirect (after cert READY):
curl -sI https://allotment.work     | grep -i -E 'HTTP/|location'   # 301 → https://allotmentology.tech
curl -sI https://allotment.works    | grep -i -E 'HTTP/|location'   # 301 → https://allotmentology.tech
curl -sI https://www.allotment.works| grep -i -E 'HTTP/|location'   # 301 → https://allotmentology.tech
```
Expect `HTTP/2 301` + `location: https://allotmentology.tech/`.

### Rollback (Phase B)
Re-point the registrar NS back to the prior nameservers (Vercel). Propagation reverses it.
No data is destroyed — the redirect cluster resources can stay; they only act on traffic
that resolves to `135.181.25.76`.

---

## Phase C — Registrar consolidation → INWX (FOUNDER-GATED, optional / later)

**Why INWX:** Hetzner's Domain Registration Robot does **not** offer `.work`/`.works`
(it covers only `.de/.com/.net/.org/.info/.biz/.eu/.at`). **INWX registers both**
`.work` and `.works` (dedicated product pages, 2200+ TLDs) and is EU-based — fits the
sovereign/EU posture. So the consolidation target is **INWX**, not Hetzner.

> Transfer ≠ NS flip. NS (Phase B) is reversible in minutes and needs no auth code.
> A registrar **transfer** moves billing/ownership and needs the EPP/auth code + a 60-day
> post-registration/transfer lock to have elapsed. **Transfer can happen AFTER the NS flip
> with zero downtime** because the DNS zone already lives at Hetzner — moving the registrar
> does not touch the (Hetzner) nameservers.

### Founder-only steps (per domain)
1. **Fund / verify the INWX account** (create at inwx.com if not present; add payment).
2. At the **losing registrar** (Vercel for `.work`, Name.com for `.works`):
   - **Unlock** the domain (remove `clientTransferProhibited`).
   - **Obtain the EPP / auth code** (transfer authorization code).
   - Ensure the domain is **outside the 60-day transfer lock** and the registrant email is reachable.
3. At **INWX**: start an **incoming transfer** for the domain, paste the EPP code, pay the
   transfer fee (usually includes +1yr renewal). Approve the transfer-confirmation email.

### Automatable / ops follow-up (post-transfer)
- After the transfer lands at INWX, **keep the Hetzner NS** set on the domain (do NOT switch
  to INWX default NS) — the zone + redirect already live at Hetzner. Verify `dig NS` still
  shows the Hetzner triplet.
- INWX has an [API/XML-RPC + a CLI](https://www.inwx.com/en/help/apidoc) — once the founder
  provisions an INWX API credential, NS/record management and renewal automation can be
  scripted there if ever needed (today the zone is wholly Hetzner-managed, so this is optional).

### Rollback (Phase C)
A registrar transfer is not casually reversible (another 60-day lock applies post-transfer).
If a transfer must be undone, it is a fresh transfer back — coordinate with both registrars'
support. The DNS/redirect is unaffected either way (NS stays at Hetzner).

---

## What ops has ALREADY done (audit trail)

- Created Hetzner DNS zones `allotment.work` (1418104) + `allotment.works` (1418105) via the
  Cloud API, `mode=primary`, default NS = Hetzner triplet.
- Added `@ A` + `www A` → `135.181.25.76` and `@ CAA 0 issue "letsencrypt.org"` to both zones.
- Authored `restormel-gitops` PR #21: `redirects` namespace, noop Service, SAN Certificate
  (apex+www both zones, DNS-01 / letsencrypt-prod), `RedirectRegex` middleware → 301
  `https://allotmentology.tech${path}`, websecure + web IngressRoutes; and added both zones to
  the two ClusterIssuer `dnsZones` selectors. Dry-run validated against live CRDs.

**No NS flip and no registrar transfer were initiated.** Those are the founder-gated steps above.
