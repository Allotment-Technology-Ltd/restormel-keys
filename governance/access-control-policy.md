---
id: REC-POL-002
title: Access Control Policy
class: governance
owner: founder
status: approved
approved-by: Adam Boon
approved-on: 2026-06-20
classification: internal
control-tier: 2
created: 2026-06-15
last-reviewed: 2026-06-20
review-interval: P12M
retention: P6Y-after-superseded
---

# Access Control Policy

**Allotment Technology Ltd** · Version 2026-06-15 · Effective 15 June 2026

> **Change note — 2026-06-20 (founder merge = re-approval).** Records the per-project
> Infisical access model: the single `restormel-ops` secret project is replaced by
> **five dedicated projects** (one shared `infrastructure` project plus one per product),
> so secret access is granted **per project** on least-privilege rather than estate-wide.
> The in-cluster **External Secrets Operator (ESO)** uses **one shared, read-only
> machine identity** (added to all five projects, READ on `prod`) — used only by ESO,
> never by a human or external party — while the project boundaries constrain
> human/external and non-ESO machine access. See the updated §2 "Secrets handling" and
> §4. Full detail and rationale live in the Secret Management Policy (REC-POL-004 §3a,
> §4) and `planning/secrets-architecture-infra-per-product.md`. The Phase-B product
> projects (`sophia`, `plotbudget`) are defined but not yet populated or used.

## 1. Purpose and scope

Govern how access to **Allotment Technology Ltd systems and data (across all in-scope
products)** is granted, reviewed, and revoked. Supports the Information Security Policy
(`REC-POL-001`) and ISO 27001 Annex A controls A.5.15–A.5.18 and A.8.2–A.8.5.

Scope: all systems in the asset inventory (`asset-inventory.yaml`, REC-GOV-006)
and sub-processors in the supplier register (`suppliers.yaml`, REC-GOV-005).

## 2. Principles

**Least privilege / need-to-know.** Access is the minimum required for a given
role or task. Over-privileged accounts are remediated at the next access review.

**Individual accountability.** Named accounts only; shared logins are prohibited
where individual accounts are available.

**Strong authentication.** MFA is required on every system where it is technically
available. See §3 for the system-by-system requirement and current status.

**Secrets handling.** Credentials are never committed to version control (`.env`
files are gitignored and not committed). API keys are stored as hashes or ciphertext
only. Tokens are scoped to least privilege and rotated on any suspected exposure.
Secrets are consolidated into the self-hosted Infisical secrets manager (see
`asset-inventory.yaml`), now the store of record; residual locations (CI secrets,
app credential stores including the allotmentology.tech app's Coolify env, and the Mac
keychain) are being migrated in (tracked as RISK-002, in-treatment). Within Infisical,
secrets are partitioned into **five dedicated projects** — one shared `infrastructure`
project plus one per product (`restormel`, `allotmentology`, and the Phase-B
`sophia` / `plotbudget`) — replacing the original single `restormel-ops` project.
Access to a project's secrets is granted **per project**, on least privilege, so a
leaked identity or a future collaborator is contained to one project rather than the
whole estate. The full model (storage, the per-project ESO `ClusterSecretStore`s, and
the one shared read-only ESO machine identity used only in-cluster) is governed by the
Secret Management Policy (REC-POL-004).

**New system onboarding.** When a new system or service is adopted, MFA must be
enabled within 24 hours of account creation. The system must be added to the asset
inventory or supplier register, and the access review checklist updated accordingly.
A Cowork task is scheduled at onboarding to confirm MFA setup (see §3).

## 3. MFA requirements

> ⚠ **URGENT REMEDIATION IN PROGRESS** — MFA is not yet enabled on all systems
> as of 2026-06-15. This is tracked as RISK-008 in the risk register. The remediation
> task `isms-mfa-remediation` is scheduled and must be completed as a priority.
> Update this table and close RISK-008 once all systems are confirmed.

MFA is **required** on all systems marked "required" below. "Priority" indicates the
order for remediation given the sensitivity of the data or access granted.

| System | Role | MFA required | Priority | Status (2026-06-15) |
|---|---|---|---|---|
| Google Workspace (admin) | Email + admin | Yes | 1 — Urgent | ⚠ Confirm enabled |
| Hetzner control panel | Compute host | Yes | 1 — Urgent | ⚠ Confirm enabled |
| Coolify | App/infra control | Yes | 1 — Urgent | ⚠ Confirm enabled (compensating control: Coolify dashboard additionally gated by portal BetterAuth forwardAuth — portal MFA required to reach Coolify) |
| Forgejo | Canonical repo | Yes | 1 — Urgent | ⚠ Confirm enabled |
| Mettle | Business banking | Yes | 1 — Urgent | ⚠ Confirm enabled |
| Paddle | Billing / customer data | Yes | 1 — Urgent | ⚠ Confirm enabled |
| FreeAgent | Financial records | Yes | 2 — High | ⚠ Confirm enabled |
| GitHub | Code mirror | Yes | 2 — High | ⚠ Confirm enabled |
| PostHog EU | Analytics | Yes | 2 — High | ⚠ Confirm enabled |
| Sentry | Error tracking | Yes | 2 — High | ⚠ Confirm enabled |
| Neon | Legacy DB (decommissioning) | Yes | 3 — Medium | ⚠ Confirm enabled |
| Notion | Internal tooling | Yes | 3 — Medium | ⚠ Confirm enabled |
| allotmentology.tech portal / BetterAuth admin | Portal (magic-link auth) | Yes | 2 — High | ✅ Enabled (magic-link; founder-only) |
| Migadu | Transactional/company email | Yes | 2 — High | ✅ Enabled |
| Huly local admin (break-glass) | Self-hosted PM/tracker admin (AST-030) | n/a at the app — gated by portal forward-auth (portal MFA) + IP-allowlist on the break-glass host | 2 — High | ⚠ WS1 staged (restormel-gitops PR #6). Huly has no native MFA; the compensating controls are the portal forward-auth gate (portal MFA required to reach huly.allotmentology.tech) and, on the portal-bypassing break-glass host, a Traefik IP-allowlist. Credential in Infisical (huly project) only; rotate on the access-review cadence. See §4 + RISK-015. |

Mac login serves as a hardware second factor for SSH key-based access to the
Coolify/Hetzner host. FileVault is confirmed enabled (2026-06-15).

**New service procedure:** when a new service is onboarded, the founder creates a
Cowork scheduled task (`fireAt` next morning) with the prompt: *"Enable MFA on
[service name] and update the MFA status table in access-control-policy.md. Stage
a governance bundle once confirmed."* This task is in addition to adding the service
to the supplier register and asset inventory.

## 4. Systems and data access

Access to in-scope systems is restricted to the founder while the company is
solo-led. The full system list is maintained in the asset inventory (REC-GOV-006)
and supplier register (REC-GOV-005).

Remote access to the Coolify/Hetzner host is via SSH key only; password
authentication is disabled on the server.

**Secret access (per-project boundary).** Operational secrets live in the self-hosted
Infisical manager (AST-013), partitioned into five dedicated projects — `infrastructure`
(shared infra), `restormel`, `allotmentology`, and the Phase-B `sophia` / `plotbudget`.
Access to secrets is granted **per project, on least privilege**, not estate-wide:

- **Human access** is via the Infisical UI under the founder admin account, granted
  per project. At the solo-founder stage the founder is admin on all five; the boundary
  is enforced structurally so a future team member or external collaborator can be given
  exactly the project(s) their role needs — e.g. a product contractor → that product's
  project only, never `infrastructure`. There is **no external / third-party access** to
  any project; sub-processors never receive Infisical credentials.
- The `infrastructure` project (which holds the credentials that reach everything else)
  carries the tightest boundary: founder plus the ESO machine identity only.
- **In-cluster access** is via the External Secrets Operator (ESO), the only in-cluster
  consumer of Infisical. ESO uses **one shared, read-only machine identity** added to all
  five projects (READ on env `prod`) so it can render each workload's secrets into native
  Kubernetes `Secret`s. That shared identity is used **only by ESO, only in-cluster** —
  never by a human or external party — so it does not weaken the per-project human/external
  boundary above. Its single bootstrap credential (`infisical-machine-identity` in
  namespace `external-secrets`) is the one out-of-band secret, created by hand and excluded
  from GitOps; its rotation and SPOF treatment are governed by REC-POL-004 (§5) and
  RISK-010.

The allotmentology.tech portal uses its own self-contained BetterAuth authentication and is
currently founder-only. Coolify dashboard (coolify.allotmentology.tech) is published behind
the allotmentology.tech portal's BetterAuth session via Traefik forwardAuth. All Coolify
access requires an authenticated, approved portal session. This is a controlled forward-auth
gate — not a federated identity protocol. Coolify's own local-auth login layer is retained as
a second layer of protection. Note: this is a forward-auth gate, not SSO federation; if a
true federated IdP (SAML/OIDC) is introduced later, this section and the risk register must
be revisited (a shared auth service would carry cross-product blast radius).

**Portal forward-auth gated hosts (same model).** The same Traefik forward-auth gate to the
allotmentology.tech portal also fronts the in-cluster operator surfaces on the
`.allotmentology.tech` apex — `grafana.` and `argo.` (Ops Centre / Argo CD), and as of WS1
(restormel-gitops PR #6) `huly.` (Huly, AST-030). Reaching any of them requires an
authenticated, approved portal session; each app then keeps its own local login as a second
layer (two-layer auth — the portal gates the network, the app gates the account; Huly does NOT
header-trust X-Forwarded-User into a session, so the operator still logs into Huly's own local
account). Because they share the portal as the gate, the portal is a single point of failure
for normal access — see the break-glass note below and RISK-015.

**Huly break-glass admin — a standing privileged credential.** Huly (AST-030) runs with
`disableSignup:true`, so the only way in is a seeded local admin account; that account is a
standing privileged credential and is governed here. Owner: founder. Its password lives ONLY in
Infisical (the `huly` project, key `HULY_BREAKGLASS_ADMIN_PASSWORD`, delivered into the cluster
via ESO — never in git), and it is rotated on the quarterly access-review cadence (§6). Because
the portal is a SPOF for the normal gated path, Huly has a deliberate portal-BYPASSING
break-glass path: (1) the IP-allowlisted `huly-admin.allotmentology.tech` host — DEFERRED, it is
fail-closed until the founder supplies the operator source `/32` (and the host DNS is created);
and (2) a `kubectl port-forward` runbook needing only cluster API access (KUBECONFIG), which is
the path WS1 deploys with. Both reach Huly's own account service directly, never the portal. The
break-glass admin is in scope for the quarterly access review (§6).

## 5. Joiner / mover / leaver

**Solo-founder stage:** not applicable in the conventional sense — the founder is
the only user. This section will be expanded when the first team member joins.

**When a new team member joins:** access is granted on the principle of least
privilege for their role, documented in a named account per system, and recorded
in an onboarding access log in `evidence/access-reviews/`. MFA must be enabled
before production access is granted. Secret access in particular is scoped to the
specific Infisical project(s) the role requires (§4) — never the whole estate, and
never the `infrastructure` project unless the role is operational.

**When a team member leaves:** all access is revoked within 24 hours. API keys,
tokens, and shared secrets they had access to are rotated. Revocation is documented
in `evidence/access-reviews/`.

## 6. Access review

Access to all in-scope systems is reviewed **quarterly** via the access review
playbook (`playbooks/quarterly-access-review.md`). The review covers:

- All active accounts and their privilege levels
- All secret locations (AST-007): the per-project Infisical estate (the
  `infrastructure` / `restormel` / `allotmentology` projects, plus the Phase-B
  `sophia` / `plotbudget` projects once active), Forgejo CI secrets, GitHub secrets,
  app credential store, and the Mac keychain — including which identities (human and
  machine) are attached to each Infisical project and at what role
- MFA status on all systems in §3
- Any stale, over-privileged, or shared accounts — including the ESO shared
  machine identity (confirm it remains read-only and used only by ESO)

Results are recorded in `evidence/access-reviews/` with the date and reviewer.
Anomalies are remediated and tracked in the risk register.

## 7. Exceptions

Exceptions to this policy follow the process in the Information Security Policy
(§5, REC-POL-001): written approval by the founder plus a risk register entry with
a review date.

## 8. Review

Annual review (P12M), next scheduled via `isms-annual-management-review` (15 December
2026). Updated immediately when a new system is onboarded or a team member joins or
leaves.
