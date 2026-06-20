# Ops Centre dashboards — portal SSO exposure: recommendation

> Realises **planning §2.3** (visual access + company-portal integration) and the
> resolved decisions **D-M13** (hostnames), **D-M14** (auth method), **D-M15**
> (which UIs are external). Manifests in this directory are the concrete wiring;
> this doc is the rationale + the cross-repo portal change.
>
> **⚠️ AUTH SURFACE — the parent MUST run `restormel-high-risk-security` before
> opening any PR that lands this. It introduces a public, authenticated entry
> point to infra internals (Grafana, Argo CD) and reuses the portal's auth plane.**

---

## TL;DR

- **Hostnames:** **`grafana.allotmentology.tech`** (+ `argo.`, `status.`), **NOT
  `ops.restormel.dev` / `grafana.restormel.dev`.**
- **SSO approach:** **Reuse the portal's existing Traefik `forwardAuth` →
  `https://allotmentology.tech/api/forward-auth` (Better-Auth).** Do **NOT** deploy
  oauth2-proxy.
- **Portal change:** add three `shared` launchpad tiles (Ops Centre/Grafana, Argo CD,
  Status) and drop two stale ones (Sentry, Coolify) in
  `web/src/lib/company/launchpad.ts` — a small data-only edit in the allotmentology
  repo. No portal code/auth changes required for v1.

---

## 1. Hostname recommendation — `*.allotmentology.tech`, not `restormel.dev`

**Recommend: `grafana.allotmentology.tech`** (the Ops Centre front door), with
`argo.allotmentology.tech` and `status.allotmentology.tech` alongside.

This is **forced by the SSO decision**, not a branding preference:

- The portal's Better-Auth session cookie is scoped to **`.allotmentology.tech`**
  (`AUTH_COOKIE_DOMAIN=.allotmentology.tech`, `crossSubDomainCookies` enabled —
  verified in `web/src/lib/auth/better-auth.ts`). Cookies set on `.allotmentology.tech`
  are sent to **every subdomain of that apex** — and to **no other apex**.
- Host the dashboards under **`*.allotmentology.tech`** and the existing portal session
  cookie rides along automatically; Traefik copies it to `/api/forward-auth`, and the
  user is already signed in. **One login, zero re-auth.**
- Host them under **`*.restormel.dev`** and the cookie does **not** flow (different
  apex) — you'd be forced to build oauth2-proxy or a second IdP federation just to
  cross apexes. That is exactly the rebuild D-M14 set out to avoid.

So `restormel.dev` is rejected on a hard technical ground, not aesthetics. (`restormel.dev`
remains the *product* apex — dashboard, surreal, auth — but the *operator/infra* UIs sit
on the *company* apex where the operator's SSO already lives.) **Cost:** needs a
`*.allotmentology.tech` wildcard cert (cert-manager DNS-01) — `00-wildcard-certificate.yaml`.

| Hostname | UI | Exposure (D-M15) |
|---|---|---|
| `grafana.allotmentology.tech` | Grafana (opens the single-pane RAG board) | **external** |
| `argo.allotmentology.tech` | Argo CD (sync/health/drift) | **external** |
| `status.allotmentology.tech` | Uptime-Kuma external status page | **external** |
| *(none — internal only)* | Hubble UI, Alertmanager | **cluster-internal / `kubectl port-forward`** (smaller attack surface) |

## 2. SSO approach — reuse forward-auth, NOT oauth2-proxy

**Recommend: port the existing portal `forwardAuth` middleware into the in-cluster
K3s Traefik.** This is the proven prod pattern (the Coolify tile;
`web/infra/traefik/coolify-portal.deployed.yaml`) and what D-M14 resolved.

### The two options, compared

| Criterion | **Reuse portal forward-auth** ✅ | oauth2-proxy |
|---|---|---|
| **New components** | **none** — a Traefik `Middleware` CRD calling an endpoint that already exists & runs in prod | a new Deployment + Service + config per cluster, plus a new OIDC client registration |
| **New auth surface** | **none new** — the gate logic (`/api/forward-auth`) is already written, reviewed, and live: session validation + `AUTH_ALLOWED_EMAILS` allowlist + `public.users.approval_status='approved'`, **fails closed** | a new auth proxy to configure, secure, patch, and trust; another thing in the cold-start path |
| **Identity model** | the **same** Better-Auth users/allowlist/approval the portal already enforces — one source of truth | needs Better-Auth to expose a conformant **OIDC provider** for oauth2-proxy to talk to; Better-Auth's OIDC plugin would have to be stood up + a client registered (net-new auth config) |
| **Login experience** | **already signed into the portal ⇒ already signed into the dashboards** (cookie flows) | redirect dance to the IdP on first hit; still need the cookie/SSO to land on the same apex anyway |
| **Proven** | **yes, in prod, with Coolify** | no — would be greenfield here |
| **MFA** | inherited: MFA is enforced at portal sign-in / the (app) gate; a valid approved session has already passed it (per the forward-auth route's documented design) | would re-implement or defer the MFA story |
| **Failure mode** | endpoint down ⇒ forwardAuth gets non-2xx ⇒ **fails closed** (deny) | proxy down ⇒ all gated UIs down; another SPOF to monitor |
| **Per-UI native OAuth** | Grafana *could* also use native OAuth against the same IdP later — additive, not required | n/a |

**Decision: reuse forward-auth.** It adds *zero* new auth surface, reuses a
prod-proven, already-reviewed gate, gives true single-sign-on (portal session →
dashboards with no second login), and avoids standing up an OIDC provider just to
re-derive the identity the portal already owns. oauth2-proxy would be strictly more
moving parts for a worse login experience.

### One residual risk to flag

The cluster Traefik calls the **public** portal endpoint outbound on every gated
request. This is the **same** call the box Traefik already makes for Coolify, so it's
proven — but it does mean **dashboard auth depends on the portal app being reachable**.
Mitigations: it fails *closed* (portal down ⇒ deny, never expose), and Grafana keeps a
local admin login (ESO-rendered) as a break-glass path that does not depend on the
portal. Note this in the high-risk-security review.

### How the pieces fit (in this directory)

```
portal session cookie (.allotmentology.tech)
        │  browser → grafana.allotmentology.tech
        ▼
 K3s Traefik IngressRoute (02-grafana-ingressroute.yaml)
        │  middleware: portal-forward-auth (01-forward-auth-middleware.yaml)
        ▼  outbound HTTPS, forwards Cookie + X-Forwarded-*
 https://allotmentology.tech/api/forward-auth   ← EXISTING portal endpoint
        │  validates Better-Auth session + allowlist + approval (fails closed)
        ▼  2xx
 Grafana (single-pane RAG board as home dashboard)
```

- `00-wildcard-certificate.yaml` — `*.allotmentology.tech` cert (DNS-01).
- `01-forward-auth-middleware.yaml` — the `portal-forward-auth` + `https-redirect`
  middlewares in `monitoring` ns.
- `02-grafana-ingressroute.yaml` — `grafana.allotmentology.tech` → Grafana, gated.
- `03-argocd-ingressroute.yaml` — `argo.allotmentology.tech` → Argo CD, gated
  (middlewares duplicated into `argocd` ns; needs `server.insecure=true` on argocd-server).
- *(status page IngressRoute follows the same shape; author when Uptime-Kuma lands.)*

### Wiring caveats (confirm at PR time)

- **Traefik entryPoint names** — manifests assume the K3s Traefik defaults (`web`/
  `websecure`). Confirm against the cluster's Traefik Helm values.
- **Grafana service name** — assumes `kube-prometheus-stack-grafana`; depends on the
  Helm release name the monitoring agent chooses.
- **Set the single-pane board as Grafana's home dashboard** (kube-prometheus-stack
  `grafana.dashboards`/`grafana.ini` default) so `grafana.allotmentology.tech` opens
  straight on the RAG view — that's the §2.4 "front door".
- **`grafana.ini`: disable anonymous auth** (defence in depth behind the proxy).
- **Argo `server.insecure=true`** so Traefik terminates TLS (coordinate with the
  gitops Argo values).
- **Middleware namespace scope** — Traefik middlewares are namespace-scoped; the Argo
  route carries its own copies (or enable `allowCrossNamespace` and use the
  `monitoring-portal-forward-auth@kubernetescrd` cross-ns form).

## 3. The portal-repo change (describe only — do NOT edit)

**Repo:** `allotment-technology-ltd` · **File:**
`web/src/app/(app)/launchpad/page.tsx` is render-only and needs **no change** — it maps
over `LAUNCHPAD` and already renders `shared` tiles with a green "shared session" badge.
The only edit is the **data file**:

**File:** `web/src/lib/company/launchpad.ts`

**Shape of the change** (data-only; the `LaunchTile` / `LaunchSection` types already
support everything needed — `access: "shared"`, `note`, `disabled`):

1. **Add an `"OPS CENTRE"` section** (or extend the existing `"01 — INFRA"` section)
   with three `shared` tiles — `access: "shared"` is the green "shared session" badge
   that signals the portal session carries through:

   ```ts
   {
     index: "03",
     title: "OPS CENTRE",
     blurb: "Live cluster health — opens behind your portal sign-in (forward-auth).",
     tiles: [
       {
         label: "Ops Centre",
         href: "https://grafana.allotmentology.tech",   // opens the single-pane RAG board
         description: "At-a-glance RAG health: backups, cluster, data, apps, edge, secrets.",
         access: "shared",
         note: "Portal session gates it; opens on the single-pane overview.",
       },
       {
         label: "Argo CD",
         href: "https://argo.allotmentology.tech",
         description: "GitOps deploys — sync, health, drift across the cluster.",
         access: "shared",
         note: "Portal session gates it; then Argo's own RBAC login.",
       },
       {
         label: "Status (Uptime-Kuma)",
         href: "https://status.allotmentology.tech",
         description: "External dead-man's-switch / status page (off-estate prober).",
         access: "shared",
       },
     ],
   },
   ```

2. **Drop the two stale tiles** (per D-M14 follow-up):
   - **Sentry** (`02 — EXTERNAL SAAS`) — **never deployed** (PostHog is the error
     tracker; planning §2.1/§5). Remove the tile.
   - **Coolify** (`01 — INFRA`) — **retiring → Argo CD**. Remove (or mark
     `disabled: true` with a "retiring → Argo CD" note during the cutover, then remove).

3. **Update the SurrealDB tile host if needed** — it currently points at
   `surreal.restormel.dev` (still correct; HARD invariant). No change required, noted
   only so the editor doesn't touch it.

**No portal auth/code changes for v1.** The forward-auth endpoint, the cookie scope, and
the allowlist/approval gate already exist and already cover any `*.allotmentology.tech`
host. The only auth follow-up the founder flagged is **confirm/enable MFA on Better
Auth** for the infra gate (the route notes MFA is enforced at sign-in, not re-checked at
the proxy — fine, provided MFA *is* enrolled). That MFA confirmation is itself an
**auth-surface item → restormel-high-risk-security**.

## 4. Decisions this implements

- **D-M13** ✅ per-UI subdomains under `*.allotmentology.tech` (cookie-scope reason).
- **D-M14** ✅ reuse portal forward-auth; no oauth2-proxy; port the middleware into the
  in-cluster Traefik; confirm/enable Better-Auth MFA; update launchpad; drop Sentry +
  Coolify tiles; **route cluster-Traefik wiring through restormel-high-risk-security**.
- **D-M15** (recommend) Grafana + Argo + status external; Hubble + Alertmanager internal.
- **D-M16** (recommend) add the "Ops Centre" launchpad tile → the single-pane overview.

---

## ⚠️ AUTH GATE — for the parent agent

This deliverable wires a **public, authenticated entry point to infrastructure
internals** (Grafana, Argo CD) and **reuses the company portal's auth plane**
(Better-Auth via Traefik forwardAuth). Per CLAUDE.md and planning §2.3/D-M14, the parent
**MUST run `restormel-high-risk-security` before opening any PR** that lands these
manifests or the portal-repo launchpad change. Specific review focuses: forwardAuth
fails-closed behaviour on the in-cluster Traefik; the outbound dependency on the public
portal endpoint (break-glass via Grafana local admin); cross-namespace middleware
exposure; Argo `server.insecure` posture behind TLS-terminating Traefik; and the
Better-Auth MFA confirmation for the infra gate.
