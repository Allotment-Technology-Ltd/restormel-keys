---
id: REC-POL-002
title: Access Control Policy
class: governance
owner: founder
status: approved
approved-by: Adam Boon
approved-on: 2026-06-19
classification: internal
control-tier: 2
created: 2026-06-15
last-reviewed: 2026-06-19
review-interval: P12M
retention: P6Y-after-superseded
---

# Access Control Policy

**Allotment Technology Ltd** · Version 2026-06-15 · Effective 15 June 2026

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
Secrets are consolidating into the self-hosted Infisical secrets manager (see
`asset-inventory.yaml`), now live as the store of record; residual locations (CI secrets,
app credential stores including the allotmentology.tech app's local `.env`, and the Mac
keychain) are being migrated in. Tracked as RISK-002 (in-treatment).

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

The allotmentology.tech portal uses its own self-contained BetterAuth authentication and is
currently founder-only. Coolify dashboard (coolify.allotmentology.tech) is published behind
the allotmentology.tech portal's BetterAuth session via Traefik forwardAuth. All Coolify
access requires an authenticated, approved portal session. This is a controlled forward-auth
gate — not a federated identity protocol. Coolify's own local-auth login layer is retained as
a second layer of protection. Note: this is a forward-auth gate, not SSO federation; if a
true federated IdP (SAML/OIDC) is introduced later, this section and the risk register must
be revisited (a shared auth service would carry cross-product blast radius).

## 5. Joiner / mover / leaver

**Solo-founder stage:** not applicable in the conventional sense — the founder is
the only user. This section will be expanded when the first team member joins.

**When a new team member joins:** access is granted on the principle of least
privilege for their role, documented in a named account per system, and recorded
in an onboarding access log in `evidence/access-reviews/`. MFA must be enabled
before production access is granted.

**When a team member leaves:** all access is revoked within 24 hours. API keys,
tokens, and shared secrets they had access to are rotated. Revocation is documented
in `evidence/access-reviews/`.

## 6. Access review

Access to all in-scope systems is reviewed **quarterly** via the access review
playbook (`playbooks/quarterly-access-review.md`). The review covers:

- All active accounts and their privilege levels
- All secret locations (AST-007: .env files, Forgejo CI secrets, GitHub secrets,
  app credential store, Mac keychain)
- MFA status on all systems in §3
- Any stale, over-privileged, or shared accounts

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
