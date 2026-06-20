# Secrets architecture — shared infra project + per-product projects

> **Status:** proposal (founder sign-off needed before implementation) · **Created:** 2026-06-20 · **Owner:** founder
> Founder direction (2026-06-20): move from today's single `restormel-ops` Infisical
> project to **one shared infra project + one project per product**, for least-privilege
> and blast-radius containment. This is the target + a **non-breaking** path that does
> NOT block getting Restormel + Allotmentology onto K3s ("up and walking") first.

## Why
Today everything lives in one project (`restormel-ops`) — a leaked identity reads
*everything* (infra tokens + every product's data creds). Splitting gives each consumer
the least privilege it needs, contains a leak to one project, and maps cleanly to ESO
(one store + one machine-identity per project).

## Target project layout

| Project | Holds | Example keys (from today's `restormel-ops`) |
|---|---|---|
| **`restormel-infra`** (shared infra) | infra tokens, backups, ops | `HCLOUD_TOKEN`, `HETZNER_S3_FSN1_*`, `FORGEJO_*`, `COOLIFY_*` (retiring), `RESTIC_*`/`STORAGEBOX_*`/`SB_*`, `SSH_KEY_PROD_167`, `TELEGRAM_*`, (future) Hetzner-DNS token, CCM/CSI token, the ESO machine-identities |
| **`restormel`** (product) | Restormel app + its data stores | `DATABASE_URL`→`PG_RESTORMEL_*`, `SURREAL_*` (scoped app creds), gateway/app secrets, `RECORDS_FEED_TOKEN`(?) |
| **`allotmentology`** (product) | allotmentology DB + app | `PG_PLATFORM_ALLOTMENTOLOGY_*` (created at cutover); app secrets currently in Coolify env (AST-017) move here over time |
| **`plotbudget`** *(Phase B)* | Supabase + pg-plotbudget | `PG_PLOTBUDGET_*`, Supabase `ANON_KEY`/`SERVICE_ROLE_KEY`/`JWT_SECRET` — created when Phase B activates |
| **`usesophia`** *(Phase B)* | Sophia DB + auth | created when Phase B activates |

**Founder calls needed** (flagged, don't guess): (1) keep `restormel-ops` *as* the infra
project vs create a fresh `restormel-infra`; (2) the **ambiguous mappings** — `SMTP_*` /
`EMAIL_FROM` / `BREVO_API_KEY` (shared email infra, or per-product?), `SURREAL_BOX_*` root
(infra, since SurrealDB is shared infra) vs `SURREAL_*` (Restormel scoped), `RECORDS_FEED_TOKEN`.
**Cleanup opportunity:** today's project has duplicates to drop during the move — `RESTIC_PASSWORD`
vs `RESTIC_REPO_PASSWORD`, `STORAGEBOX_*` vs `SB_*`, `SURREAL_*` vs `SURREAL_BOX_*`.

## ESO model (one store + one identity per project — least privilege)

- A **`ClusterSecretStore`** per project: `infisical-infra`, `infisical-restormel`,
  `infisical-allotmentology`, … (cluster-wide so any namespace can reference the right one).
- A **machine-identity per project** (Universal Auth, **read-only** on that project/`prod`),
  each with its own bootstrap Secret in the `external-secrets` namespace
  (`infisical-mi-infra`, `infisical-mi-restormel`, …). One leaked identity ≠ all secrets.
- Each `ExternalSecret` references the store for the project its secret lives in (infra
  secrets → `infisical-infra`; CNPG app/role creds → the product store; etc.).

This **supersedes** the current inconsistency (3 store names + 2 bootstrap names; task #35) —
that reconciliation happens *as* this restructure.

## Non-breaking migration path (COPY → repoint → remove)

The live stack (this repo's scripts, the dashboard app, Coolify) all read `restormel-ops`
today — so we **copy first, repoint, then remove**, never move-and-break:

1. **Founder (Infisical):** create the projects + per-project read-only machine identities.
2. **Founder (Infisical):** **copy** each secret into its target project (leave `restormel-ops`
   intact). Dedupe the known duplicates while copying.
3. **Me (manifests):** wire the per-project ESO `ClusterSecretStore`s + create the bootstrap
   identity Secrets; point each `ExternalSecret` at the right store.
4. **Verify:** `kubectl get externalsecrets -A` all `SecretSynced` from the new projects.
5. **Repoint other consumers** off `restormel-ops` one at a time (ops scripts → use the infra
   project; the dashboard app's Infisical source; Coolify) — verify each.
6. **Deprecate `restormel-ops`** only once nothing references it (or keep it as the infra
   project per decision #1).

## Phasing vs the K3s migration (recommended)

Don't block Phase A on the full restructure:

- **Phase A interim (unblocks now):** reconcile ESO to **one** `ClusterSecretStore` backed by
  the existing `restormel-ops` project (fixes the names-bug, task #35) — Restormel +
  Allotmentology get up and walking on the current single project.
- **Then (parallel/after up-and-walking):** execute this infra+per-product restructure via the
  steps above. New per-product stores slot in without disrupting the running cluster.

> Founder may instead prefer to do the **full restructure first** — viable, just adds the
> project-creation + copy work before the cluster apply. Recommend the interim path for speed.

## Governance impact

Update **`secret-management-policy.md` (REC-POL-004)** + **`access-control-policy.md`** to record
the per-project least-privilege model + the machine-identity-per-project access pattern. Stage
those when the structure is approved (event-triggered governance update).
