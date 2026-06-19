---
id: REC-POL-004
title: Secret Management Policy
class: governance
owner: founder
status: approved
approved-by: Adam Boon
approved-on: 2026-06-17
classification: internal
control-tier: 2
created: 2026-06-17
last-reviewed: 2026-06-19
review-interval: P12M
retention: P6Y-after-superseded
---

# Secret Management Policy

**Allotment Technology Ltd** · Version 2026-06-17 · Effective 17 June 2026

## 1. Purpose and scope

Govern how application and infrastructure **secrets** — API tokens, database
credentials, encryption keys, backup passphrases, bot tokens, storage-box
credentials, and similar — are stored, accessed, injected, and rotated across
all Allotment Technology Ltd in-scope products (Restormel + allotmentology.tech).
This policy supports the Information Security Policy (`REC-POL-001`)
and the Access Control Policy (`REC-POL-002`), and implements ISO 27001:2022
Annex A controls **A.5.17 (authentication information)**, **A.8.5 (secure
authentication)**, **A.8.12 (data leakage prevention)** and **A.8.24 (use of
cryptography)** for secret material.

A *secret* is any credential or key whose disclosure would let a party
authenticate as an ATL product or service, decrypt ATL data, or access an ATL
system or sub-processor.

Scope: all systems in the asset inventory (`asset-inventory.yaml`, REC-GOV-006),
in particular the secrets estate (AST-007) and the self-hosted secret manager
(AST-013), and all sub-processors in the supplier register (`suppliers.yaml`,
REC-GOV-005).

## 2. Principles

**Single auditable store.** Server-side operational secrets are consolidated into
a single self-hosted secret manager — **Infisical** (AST-013, `secrets.restormel.dev`)
— so that storage, access, and rotation are centralised and auditable. This
replaces the previous practice of plaintext `*.env` / `*.token` files scattered on
hosts and workstations (the control gap recorded as RISK-002).

**No secrets in version control.** Secret values are never committed to any
repository (Forgejo or the GitHub mirror). `.env`-style files are gitignored.
Governance records refer to secrets by **key name only**, never by value.

**Least privilege.** Access to a secret is the minimum required for the task.
Machine identities are scoped to a single project/environment with a read-only
(`viewer`) role unless write access is justified. Human access is via the secret
manager's UI under the founder admin account.

**Encryption at rest and in transit.** Secrets are stored encrypted by the secret
manager (envelope encryption under a master key) and only ever transferred over
TLS. The secret manager itself is published over HTTPS (Let's Encrypt via the
Coolify/Traefik proxy).

**No echoing of secret values.** Secrets are injected into processes at runtime;
they are not printed to terminals, logs, CI output, or chat. Operational tooling
verifies secrets by key name and presence, never by printing the value. (This
treats the in-session credential-exposure risk that prompted the migration — see
§7.)

## 3. Where secrets live (storage)

| Store | What it holds | Control |
|-------|---------------|---------|
| **Infisical** (AST-013, self-hosted, EU) | Primary store for server-side operational secrets — backup passphrases, storage-box credentials, bot tokens, service tokens, DB credentials as migrated | Encrypted at rest; UI + machine-identity access; this policy |
| Infisical master key material | `ENCRYPTION_KEY` + `AUTH_SECRET` for the Infisical backend | `/opt/infisical/.env` on Box B, root-owned `0600`, never committed; backed up only via the encrypted box backup |
| Forgejo CI secrets/variables | CI/CD-time secrets for pipelines | Forgejo project secrets; least-privilege; audited at access review |
| GitHub secrets (legacy mirror) | Residual mirror-side secrets | Being audited and minimised (RISK-002 treatment) |
| Restormel app credential store | BYOK / customer-supplied credentials handled by the product | Application-layer encryption (out of scope of operator secrets, covered by product security review) |
| allotmentology.tech app secrets (Coolify env) | Runtime secrets for the allotmentology.tech portal — including `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (Migadu SMTP credentials for auth email + enquiry notifications, active production secrets as of 2026-06-19) | Coolify environment variables (project allotmentology-pilot); specific operational secrets (e.g. RECORDS_FEED_TOKEN) canonical in Infisical project restormel-ops/prod; app-wide Infisical migration for allotmentology.tech deferred — most secrets remain in Coolify env |
| Host key files | **SSH private keys** and host TLS material | Remain as files on disk with `0600` perms — deliberately **not** migrated into Infisical (a key store should not hold the keys used to reach it) |
| Mac keychain (founder workstation, AST-006) | Local developer credentials | OS keychain; FileVault full-disk encryption enabled |

The Infisical store is a single point of failure for runtime secret retrieval;
this is recorded and treated as RISK-010.

## 4. How secrets are accessed (access paths)

**Web UI.** `https://secrets.restormel.dev` — founder admin account. MFA is to be
enabled on the admin account (tracked under RISK-008 / the access-control MFA
remediation). Human reads/edits go through the UI; the UI provides per-secret
audit history.

**CLI / machine identity.** Automated and operational access uses the `infisical`
CLI authenticated by a **machine identity** (Universal Auth: client ID + client
secret), scoped to the relevant project and environment with a read-only role.
Secrets are injected into a process without ever being written to disk in
plaintext:

```
infisical run --projectId=<id> --env=prod -- <command>
```

The machine-identity client credentials live only in `/opt/infisical/.env`
(root, `0600`) on the box and are used by the `/opt/infisical/infisical-run.sh`
wrapper. They are not committed and not printed.

**Operator workstation (Mac).** Local operator access uses the same read-only
machine identity, but the client credentials are stored in the **macOS keychain**
(`security` service entries `infisical-cli-*`), never in a plaintext file. A
helper (`~/.local/bin/infisical-get <KEY>`) reads the credentials from the
keychain, exchanges them for a short-lived access token, and prints a single
secret value to stdout for use in a command substitution. This replaced the
former `~/.config/restormel/*.env` and `*.token` plaintext files, which were
deleted on 2026-06-17 after the vault was verified (see §6). SSH private keys
remain as files under `~/.config/restormel/` (excluded from the vault by design).

**Project/environment model.** Secrets are organised by Infisical *project* (e.g.
`restormel-ops` for build/ops infrastructure secrets) and *environment*
(`dev` / `staging` / `prod`). Production operational secrets live in `prod`.

## 5. Rotation

| Secret class | Rotation trigger / cadence |
|--------------|----------------------------|
| Infisical machine-identity client secret | Rotate on suspected exposure; review at quarterly access review; re-mint via the UI/API and update `/opt/infisical/.env`. |
| Infisical admin credentials | Founder-held; rotate on suspected exposure; MFA enforced. |
| Imported operational secrets (bot tokens, storage-box, backup passphrase, DB creds) | Rotate at the source system on suspected exposure or staff/sub-processor change, then update the value in Infisical. Review coverage at the quarterly access review. |
| Infisical master `ENCRYPTION_KEY` / `AUTH_SECRET` | Treated as long-lived root key material; rotation requires a planned re-encryption and is performed only on confirmed compromise. |
| Any secret known or suspected to be exposed | **Immediately** — rotate at source, update Infisical, and file an incident record (REC-TPL-004) if exposure was real. |

Rotation does not delete the old value's audit trail; Infisical retains version
history.

## 6. Migration from plaintext files

As of 2026-06-17 the operator workstation (Mac) plaintext secret files
(`~/.config/restormel/*.env`, `*.token`) have been migrated into Infisical
(project `restormel-ops`, env `prod`) and **deleted** after the founder verified
the vault end-to-end (27 secrets present and fetchable; representative values
cross-checked by length). Local access is now keychain-backed (§4). SSH private
keys are explicitly excluded from the migration and remain as key files under
`~/.config/restormel/`. Server-side, `/opt/infisical/.env` (master key) and
`/opt/surreal/.env` (SurrealDB root password, needed at container start) remain
as `0600` root-owned files by operational necessity; both are captured in the
encrypted BX11 backup. **Remaining migration work:** consolidate Forgejo CI
secrets/variables and GitHub mirror secrets into (or under the governance of)
Infisical, audited at the quarterly access review.
EU sovereignty and the use of open-source software were the deciding reasons for
self-hosting Infisical rather than adopting a SaaS secret manager, consistent with
the sovereignty posture in REC-POL-001 §4.

## 7. Handling and non-disclosure

Secret values must never be:

- committed to a repository, written into a governance/evidence record, or pasted
  into chat, issues, or PRs;
- printed to a terminal, CI log, or application log;
- transmitted over a non-TLS channel.

Tooling and operators verify secrets by **key name and presence**, never by
value. Where a secret has been exposed (echoed, logged, or mis-filed), the
exposure is treated as a security event: rotate immediately (§5) and file an
incident record per the ISMS records process. This control directly addresses the
in-session credential-exposure risk that motivated the move off plaintext files.

## 8. Exceptions

Exceptions to this policy follow the Information Security Policy §5: written
founder approval plus a risk-register entry with justification and a review date
no more than 12 months out.

## 9. Review

This policy is reviewed at least annually (review interval: P12M) and on any
material change to the secrets estate or the secret-management tooling. Supporting
controls are tracked in the Statement of Applicability (`soa.md`, REC-GOV-004) and
the risk register (`risk-register.yaml`, REC-GOV-002: RISK-002, RISK-010).
