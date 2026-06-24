---
title: Estate SSO Consolidation — Apply Runbook
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-24
last-reviewed: 2026-06-24
review-interval: P12M
---

# Estate SSO Consolidation — Apply Runbook

> **AUTH SURFACE. HIGH LOCKOUT RISK.** Every lockout-risky step below runs
> **founder-present** with the fallback login **verified first**. Reviewed under
> `restormel-high-risk-security` (gate: **PASS WITH NOTES**). `KUBECONFIG` for all
> cluster commands: `/private/tmp/k3s-create/kubeconfig`. Forgejo (`git.allotmentology.tech`)
> is canonical — never the GitHub mirror.

Implements the ranked top-5 of `SSO-CONSOLIDATION-PLAN.md`
(allotmentology.tech repo, PR #12) plus the founder-approved decommission of the
un-gated `argocd.restormel.dev`.

## Staged PRs (NOT merged / NOT applied)

| PR | Repo | What | Apply trigger |
|----|------|------|---------------|
| **allotmentology.tech #13** | portal | Portal as OIDC provider (flag-gated OFF) + migration 0019 | merge (inert) → set env flag (founder) |
| **restormel-gitops #28** | gitops | Decommission `argocd.restormel.dev` + stage Argo OIDC (disabled) + Argo middleware header | merge → `helm upgrade` (founder) |
| *(this doc)* | restormel-keys | apply runbook + SaaS→Google doc | n/a |

## Estate baseline (verified live 2026-06-24)

- `argo.allotmentology.tech` → **307 → portal sign-in** (gated, fails closed). KEEP.
- `argocd.restormel.dev` → un-gated duplicate Ingress (Helm-managed,
  `meta.helm.sh/release-name: argocd`), with `users.anonymous.enabled: "true"`
  (read-only) → an Argo UI reachable bypassing the portal gate. **DECOMMISSION.**
- `git.allotmentology.tech` (Forgejo) → **200**, native login only, no SSO. → Step 1.
- **Grafana `[auth.proxy]` is already LIVE** keyed on `X-Forwarded-User`
  (`monitoring` middleware already emits it; Grafana running config trusts it,
  whitelist `10.244.0.0/24`, admin login kept). Step 2 ≈ already done — verify only.
- Better-Auth `oidc-provider` plugin is available (better-auth 1.5.6) but NOT yet
  enabled — that is what PR #13 stages.

---

## SAFE-TO-APPLY-NOW vs FOUNDER-PRESENT-ONLY

### Safe to apply now (reversible, no auth-decision change)
1. **Merge both PRs** — neither merge changes any live auth decision: the portal
   plugin is flag-OFF; the gitops Ingress removal only takes effect on `helm upgrade`,
   and the Argo middleware `X-Forwarded-User` header is not auth-consumed by Argo today.
2. **Apply the Argo-ns middleware `authResponseHeaders` change** (gitops #28, file
   `monitoring/portal-sso/03-argocd-ingressroute.yaml`) — Argo does not trust the
   header for auth, so emitting it changes nothing now; it only prepares Step 4.
3. **Verify Step 2 (Grafana)** — read-only confirmation, no change.

### Founder-present only (lockout risk)
- **Step 1** enable: `PORTAL_OIDC_PROVIDER_ENABLED=true` + Forgejo OIDC auth source.
- **Decommission** apply: `helm upgrade` removing the `argocd.restormel.dev` Ingress.
- **Step 4** enable: Argo `oidc.config` + RBAC.
- **Step 5** decision + (if yes) enable: Infisical OIDC.

---

## Step 1 — Forgejo → portal OIDC  ·  FOUNDER-PRESENT

Portal becomes the OIDC IdP (PR #13); Forgejo becomes an OIDC client. **Biggest
single login removed.** Forgejo's **local admin password login stays enabled** —
this is the GitOps backbone; lockout = catastrophic.

### Pre-flight (fallback proof — do FIRST)
```bash
# Prove the Forgejo LOCAL admin still works BEFORE touching auth sources.
# (do this in the Forgejo UI: sign in as the local admin with username+password)
# Confirm at least one user has the site-admin flag via password (not OIDC).
```
Do **not** proceed until a password-based admin login is confirmed working.

### A. Portal side (IdP)
1. Merge PR #13 (inert — flag off). Deploy runs migration 0019 (additive tables).
2. Deliver client secrets to the portal env via **Infisical → Coolify env** (key
   NAMES only — never paste values into chat/logs):
   - `PORTAL_OIDC_FORGEJO_SECRET` (generate: `openssl rand -base64 48`)
3. Set `PORTAL_OIDC_PROVIDER_ENABLED=true` in the portal env, redeploy.
4. Verify discovery is up:
   ```bash
   curl -s https://allotmentology.tech/api/auth/.well-known/openid-configuration | head -c 400; echo
   ```
   Expect a JSON document with `authorization_endpoint` / `token_endpoint` / `jwks_uri`.

### B. Forgejo side (client) — on the `.150` VM
Configure via **Site Administration → Authentication Sources → Add → OAuth2 /
OpenID Connect** (or `app.ini` `[oauth2_client]` + restart). Settings:
- Provider: **OpenID Connect**
- Client ID: `forgejo`
- Client Secret: `PORTAL_OIDC_FORGEJO_SECRET` (the value delivered above)
- Auto Discovery URL: `https://allotmentology.tech/api/auth/.well-known/openid-configuration`
- Scopes: `openid profile email`
- Map email → account; **leave "Enable Password Authentication" / local sign-in ON.**

The portal client is pre-registered as a `trustedClient` with redirect
`https://git.allotmentology.tech/user/oauth2/portal/callback` (confirm Forgejo's
actual callback path matches; adjust the `redirectUrls` in the portal config if the
source name differs — Forgejo's callback is `/user/oauth2/<SourceName>/callback`).

### Fallback-login proof (after enable)
- Forgejo local admin password login STILL works (sign in with username+password).
- `https://git.allotmentology.tech` shows the new "Sign in with Allotmentology
  Portal" button AND the password form.

### Rollback
1. Forgejo: disable/delete the OIDC auth source (local login unaffected).
2. Portal: unset `PORTAL_OIDC_PROVIDER_ENABLED` (or set `false`), redeploy → plugin
   unmounts, endpoints disappear, no other auth affected.

---

## Step 2 — Grafana `[auth.proxy]`  ·  ALREADY LIVE — VERIFY ONLY

Already configured and running (no PR needed). Confirm:
```bash
export KUBECONFIG=/private/tmp/k3s-create/kubeconfig
# Middleware emits the identity:
kubectl get middleware -n monitoring portal-forward-auth \
  -o jsonpath='{.spec.forwardAuth.authResponseHeaders}'; echo   # → ["X-Forwarded-User"]
# Grafana trusts it:
kubectl -n monitoring get cm kube-prometheus-stack-grafana \
  -o jsonpath='{.data.grafana\.ini}' | grep -A6 'auth.proxy'      # enabled = true, header_name = X-Forwarded-User
```
**Fallback:** Grafana built-in `admin` login stays enabled (ESO-rendered creds in
`grafana-admin-credentials`) — break-glass independent of the portal.
**Rollback (if ever needed):** set `grafana.ini.auth.proxy.enabled: false` in
`monitoring/kube-prometheus-stack/values-kube-prometheus-stack.yaml`, Argo sync.

---

## Step 3 — SaaS → Google login  ·  FOUNDER (no automation)

Third-party account settings — the founder changes these. See the companion doc:
[`sso-saas-google-consolidation.md`](./sso-saas-google-consolidation.md).
Do **not** attempt to automate vendor SSO config.

---

## Step 4 — Argo CD → portal OIDC  ·  FOUNDER-PRESENT

Lower priority; depends on Step 1 (portal IdP live + `argocd` client). Collapses
Argo's **second** login. **Fallback preserved:** local `admin` + anonymous=readonly
behind the gate (both stay — OIDC only ADDS a write-capable SSO principal).

### Pre-flight (fallback proof)
```bash
export KUBECONFIG=/private/tmp/k3s-create/kubeconfig
# Recover the bootstrap admin password (ESO-rendered) and confirm CLI login works:
argocd login argo.allotmentology.tech --username admin --grpc-web   # must succeed
```

### Apply
1. PR #13 already registers the `argocd` trustedClient (redirect
   `https://argo.allotmentology.tech/auth/callback`) once `PORTAL_OIDC_ARGOCD_SECRET`
   is set in the portal env.
2. In `restormel-gitops/bootstrap/argocd-values.yaml`, **uncomment** the staged
   `oidc.config` block and add the RBAC `policy.csv` granting the operator email
   `role:admin` (templates are in the file). Reference the client secret via ESO
   (`$argocd-oidc:clientSecret`) — never inline.
3. `helm upgrade argocd argo/argo-cd --version 9.5.22 -n argocd -f bootstrap/argocd-values.yaml`
   (or let the `argocd` self-managed Application sync).

### Fallback-login proof
- `argocd login argo.allotmentology.tech --username admin` STILL works.
- The Argo login page shows "LOG IN VIA ALLOTMENTOLOGY PORTAL" AND the admin form.

### Rollback
Re-comment `oidc.config` + drop `policy.csv`, `helm upgrade`. Local admin +
anonymous-readonly unaffected throughout.

---

## Step 5 — Infisical OIDC  ·  FOUNDER DECISION FIRST

**Recommendation: do NOT put Infisical behind the shared portal session by
default.** Infisical is the secret store / break-glass IdP for the rest of the
estate (it delivers Grafana/Argo/portal secrets via ESO). Binding it to the same
session it underwrites is a **circular trust + blast-radius** concern: a portal
compromise would then also reach the secret store, and an Infisical-down event
already degrades the whole estate.

- **Keep Infisical on its own login + its own MFA** (independent strong factor is
  exactly justified for a secret store — same policy as financial vendors).
- **If the founder still wants OIDC here** (tier permitting): enable it **but keep a
  break-glass local admin** that does NOT depend on the portal, and treat Infisical
  MFA as mandatory regardless. This is an explicit **founder decision** — flagged,
  not actioned.

---

## Decommission — `argocd.restormel.dev`  ·  FOUNDER-PRESENT (gitops #28)

Removes the un-gated duplicate front door. KEEPS the SSO-gated
`argo.allotmentology.tech` (a separate IngressRoute). **Verified before staging:**
the only repo reference to the host was `bootstrap/argocd-values.yaml`; the
launchpad tile, CI, Image-Updater and `configs.cm.url` all use
`argo.allotmentology.tech`; the `*.restormel.dev` wildcard cert is not reflected
into the `argocd` namespace. Nothing else depends on the host.

### Pre-flight
```bash
export KUBECONFIG=/private/tmp/k3s-create/kubeconfig
# The host to keep is healthy + gated:
curl -s -o /dev/null -w '%{http_code}\n' https://argo.allotmentology.tech/    # 307
# The Ingress to remove is Helm-managed:
kubectl get ingress -n argocd argocd-server -o jsonpath='{.metadata.annotations.meta\.helm\.sh/release-name}'; echo   # argocd
```

### Apply
Merge gitops #28 (sets `server.ingress.enabled: false`), then:
```bash
helm upgrade argocd argo/argo-cd --version 9.5.22 \
  -n argocd -f bootstrap/argocd-values.yaml
# Helm deletes the argocd-server Ingress + its argocd-server-tls Certificate.
```
(or let the self-managed `argocd` Application sync the new values).

### Proof
```bash
export KUBECONFIG=/private/tmp/k3s-create/kubeconfig
kubectl get ingress -n argocd argocd-server    # → NotFound
curl -s -o /dev/null -w '%{http_code}\n' https://argo.allotmentology.tech/   # still 307 (gated path intact)
argocd login argo.allotmentology.tech --username admin   # local break-glass still works
```

### Rollback
Set `server.ingress.enabled: true` in `argocd-values.yaml`, `helm upgrade`. The
Ingress + cert are recreated; `argocd.restormel.dev` resolves again.

---

## ISMS

File a change record on each founder-present apply (REC-TPL per
`restormel-isms-records`); the decommission removes a public un-gated entry point
to infra internals (security posture improvement — note in the access-control
posture). No incident unless an apply causes an outage (then REC-TPL-004).
