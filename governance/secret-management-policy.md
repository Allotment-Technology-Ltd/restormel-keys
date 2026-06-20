---
id: REC-POL-004
title: Secret Management Policy
class: governance
owner: founder
status: approved
approved-by: Adam Boon
approved-on: 2026-06-20
classification: internal
control-tier: 2
created: 2026-06-17
last-reviewed: 2026-06-20
review-interval: P12M
retention: P6Y-after-superseded
---

# Secret Management Policy

**Allotment Technology Ltd** · Version 2026-06-17 · Effective 17 June 2026

> **Change note — 2026-06-20 (founder merge = re-approval).** Records the move from a
> **single** Infisical project (`restormel-ops`) to **five dedicated projects** — one
> shared infrastructure project plus one per product — for least-privilege and
> blast-radius containment, and the **External Secrets Operator (ESO)** access pattern
> for the K3s cluster (one `ClusterSecretStore` per project, one shared read-only
> machine identity used only by ESO in-cluster). See new §3a and the §4 "Project model",
> "Human / external access boundary" and "Kubernetes / ESO" entries. Architecture
> authority: `planning/secrets-architecture-infra-per-product.md` and the K3s target
> design (`planning/k3s-cluster-target-design.md` §6). Migration is **non-breaking**
> (copy → repoint → remove); `restormel-ops` is retained intact until nothing references
> it. The Phase-B per-product projects (sophia, plotbudget) are **defined but not yet
> populated or used**. No secret values changed; this is a structure + access-pattern
> record only.

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
hosts and workstations (the control gap recorded as RISK-002). Within that single
manager, secrets are partitioned into **dedicated per-area projects** (one shared
infrastructure project plus one project per product — see §3a) so that the
*store* stays centralised while *access to any one area's secrets* is least-privilege.

**No secrets in version control.** Secret values are never committed to any
repository (Forgejo or the GitHub mirror). `.env`-style files are gitignored.
Governance records refer to secrets by **key name only**, never by value. The same
rule applies to Kubernetes manifests: ESO `ClusterSecretStore` / `ExternalSecret`
definitions and the machine-identity bootstrap example reference Infisical project
slugs and key **names** only — never values.

**Least privilege.** Access to a secret is the minimum required for the task.
Machine identities are scoped to a single project/environment with a read-only
(`viewer`) role unless write access is justified. The per-project split (§3a) makes
this concrete: a leaked or misused identity can read **only the project(s) it is
attached to**, not the whole estate. Human access is via the secret manager's UI
under the founder admin account, **per project** — see §4 for the per-project
human/external access boundary.

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
| **Infisical** (AST-013, self-hosted, EU) | Primary store for server-side operational secrets — backup passphrases, storage-box credentials, bot tokens, service tokens, DB credentials as migrated — partitioned into dedicated per-area projects (§3a) | Encrypted at rest; UI + machine-identity access **per project**; this policy |
| Infisical master key material | `ENCRYPTION_KEY` + `AUTH_SECRET` for the Infisical backend | `/opt/infisical/.env` on Box B, root-owned `0600`, never committed; backed up only via the encrypted box backup |
| Forgejo CI secrets/variables | CI/CD-time secrets for pipelines | Forgejo project secrets; least-privilege; audited at access review |
| GitHub secrets (legacy mirror) | Residual mirror-side secrets | Being audited and minimised (RISK-002 treatment) |
| Restormel app credential store | BYOK / customer-supplied credentials handled by the product | Application-layer encryption (out of scope of operator secrets, covered by product security review) |
| allotmentology.tech app secrets (Coolify env) | Runtime secrets for the allotmentology.tech portal — including `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (Migadu SMTP credentials for auth email + enquiry notifications, active production secrets as of 2026-06-19) | Coolify environment variables (project allotmentology-pilot); specific operational secrets (e.g. RECORDS_FEED_TOKEN) canonical in Infisical; app-wide Infisical migration for allotmentology.tech in progress — most secrets remain in Coolify env, moving to the dedicated `allotmentology` project over time (§3a) |
| Host key files | **SSH private keys** and host TLS material | Remain as files on disk with `0600` perms — deliberately **not** migrated into Infisical (a key store should not hold the keys used to reach it) |
| Mac keychain (founder workstation, AST-006) | Local developer credentials | OS keychain; FileVault full-disk encryption enabled |

The Infisical store is a single point of failure for runtime secret retrieval;
this is recorded and treated as RISK-010.

## 3a. Project model — dedicated per-area Infisical projects

> Founder decision (2026-06-20): replace the single `restormel-ops` project with one
> shared **infrastructure** project plus **one project per product**. Authority:
> `planning/secrets-architecture-infra-per-product.md`. Rationale: with everything in
> one project a single leaked identity reads *everything* (infra tokens **and** every
> product's data credentials). Splitting contains a leak to one project, gives each
> consumer the least privilege it needs, and maps cleanly onto ESO (one store per
> project; the read boundary follows the project).

Five dedicated projects (slugs as configured in Infisical; project IDs are recorded
in the ESO manifest `deploy/k3s/secrets/secretstore-infisical.yaml`, not duplicated
here):

| Project (slug) | Phase | Holds (key **names** only) |
|---|---|---|
| `infrastructure` (shared infra) | A | Hetzner/cloud tokens, S3 backup creds, DNS, Forgejo, restic/storage-box, Telegram, shared email, cluster CCM/CSI — and the ESO machine-identity itself |
| `restormel` (product) | A | Restormel app + its data stores: pg-restormel credentials, scoped SurrealDB app creds, gateway/dashboard app secrets |
| `allotmentology` (product) | A | allotmentology.tech DB (pg-platform allotmentology role) + app secrets migrating in from Coolify env |
| `sophia` (product) | **B (deferred)** | UseSophia DB + auth — project **defined but not yet populated or used** |
| `plotbudget` (product) | **B (deferred)** | PlotBudget Supabase + pg-plotbudget — project **defined but not yet populated or used** |

`restormel-ops` (the original single project) is **retained intact** during the
non-breaking migration (copy → repoint → remove, §6) and is deprecated only once
nothing references it. A small number of mappings (shared-email keys, the SurrealDB
root vs scoped split, `RECORDS_FEED_TOKEN`) and known duplicates are resolved by the
founder during the copy step; until then they remain canonical in `restormel-ops`.

Each project carries its own environments (`dev` / `staging` / `prod`); production
operational secrets live in `prod`.

## 4. How secrets are accessed (access paths)

**Web UI.** `https://secrets.restormel.dev` — founder admin account. MFA is to be
enabled on the admin account (tracked under RISK-008 / the access-control MFA
remediation). Human reads/edits go through the UI; the UI provides per-secret
audit history.

**Human / external access boundary (per project).** Access to a project's secrets is
granted **per project**, not estate-wide. At the solo-founder stage the founder is the
only human principal and is admin on all five projects via the UI; the boundary is
nonetheless enforced structurally so that (a) any future team member or external
collaborator can be granted access to exactly the project(s) their role needs (e.g. a
product contractor → that product's project only, never `infrastructure`), and (b) any
non-ESO machine identity (CI, an ops script, the dashboard app's own Infisical source)
is attached only to the project it must read. The `infrastructure` project — which
holds the keys that reach everything else — carries the tightest boundary: founder
plus the ESO machine identity only. There is **no external / third-party access** to
any project; sub-processors never receive Infisical credentials.

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

**Kubernetes / External Secrets Operator (ESO).** On the K3s cluster, workloads do
**not** hold Infisical credentials. The **External Secrets Operator** is the only
in-cluster consumer of Infisical: it authenticates once and renders the Infisical
secrets a workload needs into native Kubernetes `Secret`s. ESO is wired with **one
`ClusterSecretStore` per project** (`infisical-infra`, `infisical-restormel`,
`infisical-allotmentology`, and the deferred `infisical-sophia` /
`infisical-plotbudget`), each scoped to its project slug and env `prod`. Each
`ExternalSecret` references the store for the project its secret lives in (infra
secrets → `infisical-infra`; a product's DB/app creds → that product's store).

Because ESO must render **every** project's secrets, it uses **one shared, read-only
machine identity** added to all five projects with READ on env `prod`. This shared
identity is deliberate and correct: it is used **only by ESO, only in-cluster**, and
never by a human or an external party — so it does not weaken the per-project boundary,
which exists to constrain *human/external and non-ESO machine* access (above). The
identity's Universal-Auth `clientId` / `clientSecret` live in a single bootstrap
`Secret` named `infisical-machine-identity` in namespace `external-secrets`. This is
the **one out-of-band secret** in the whole design: it is created by the operator's
hand (`kubectl create secret`, value sourced from the operator's Infisical session,
never written to disk and never committed) before Argo CD / ESO can sync anything, and
GitOps is told to ignore it. It must be rotated on suspected exposure (§5). Its
compromise would expose **all five projects' `prod` secrets**, so it is treated as the
highest-value runtime credential in the estate (and folds into the RISK-010 SPOF
treatment for the secret manager).

**Operator workstation (Mac).** Local operator access uses the same read-only
machine identity pattern, but the client credentials are stored in the **macOS
keychain** (`security` service entries `infisical-cli-*`), never in a plaintext file.
A helper (`~/.local/bin/infisical-get <KEY>`) reads the credentials from the
keychain, exchanges them for a short-lived access token, and prints a single
secret value to stdout for use in a command substitution. This replaced the
former `~/.config/restormel/*.env` and `*.token` plaintext files, which were
deleted on 2026-06-17 after the vault was verified (see §6). SSH private keys
remain as files under `~/.config/restormel/` (excluded from the vault by design).

**Project/environment model.** Secrets are organised by Infisical *project* (the
five dedicated projects in §3a — formerly the single `restormel-ops` project) and
*environment* (`dev` / `staging` / `prod`). Production operational secrets live in
`prod`.

## 5. Rotation

| Secret class | Rotation trigger / cadence |
|--------------|----------------------------|
| ESO shared machine-identity client secret (`infisical-machine-identity`) | Highest-value runtime credential (reads all five projects' `prod`). Rotate on suspected exposure; review at quarterly access review; re-mint via the UI/API, recreate the `external-secrets` bootstrap Secret out-of-band, and verify ESO re-syncs (`SecretSynced`). |
| Other Infisical machine-identity client secrets (CLI / per-consumer) | Rotate on suspected exposure; review at quarterly access review; re-mint via the UI/API and update `/opt/infisical/.env` (or the macOS keychain entry). |
| Infisical admin credentials | Founder-held; rotate on suspected exposure; MFA enforced. |
| Imported operational secrets (bot tokens, storage-box, backup passphrase, DB creds) | Rotate at the source system on suspected exposure or staff/sub-processor change, then update the value in the owning Infisical project. Review coverage at the quarterly access review. |
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
encrypted BX11 backup.

**Project restructure (2026-06-20, in progress).** The single `restormel-ops`
project is being split into the five dedicated projects of §3a via a **non-breaking**
path: (1) create the projects + the shared ESO machine identity (and any per-consumer
identities) in Infisical; (2) **copy** each secret into its target project (leaving
`restormel-ops` intact), deduplicating known duplicates while copying; (3) wire the
per-project ESO `ClusterSecretStore`s and the bootstrap identity Secret, pointing each
`ExternalSecret` at the right store; (4) verify all `ExternalSecret`s are
`SecretSynced` from the new projects; (5) repoint the remaining consumers (ops
scripts, the dashboard app's Infisical source, Coolify) off `restormel-ops` one at a
time; (6) deprecate `restormel-ops` only once nothing references it. The deferred
`sophia` / `plotbudget` projects are created but not populated until Phase B.

**Remaining migration work:** complete the per-project repoint (above), and
consolidate Forgejo CI secrets/variables and GitHub mirror secrets into (or under the
governance of) Infisical, audited at the quarterly access review.
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
