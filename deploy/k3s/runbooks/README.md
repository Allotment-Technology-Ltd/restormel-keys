# Sovereign migration — per-product cutover runbooks

Operational runbooks for cutting each product off its current managed home and onto the
self-hosted **K3s + CloudNativePG (CNPG)** cluster described in
[`planning/k3s-cluster-target-design.md`](../../../planning/k3s-cluster-target-design.md)
and [`planning/full-migration-plan-k3s.md`](../../../planning/full-migration-plan-k3s.md).

> **Authoring docs only.** Nothing here touches live data. The actual cutover is run by a
> human operator following these steps, with the source database kept authoritative until
> the target is verified.

## Locked decisions these runbooks are built to

| Decision | Value | Source |
|---|---|---|
| **DB cutover method** | **Short `pg_dump` maintenance window** for *all* products (pre-launch, low traffic). Logical replication is deferred until live with real users. | k3s-design §3 decision 3, full-plan §E.8 |
| **PlotBudget** | Gets a **rehearsed, tested** cutover (real user financial data + the security-critical GoTrue auth + 158-policy RLS boundary). | full-plan §B, §D |
| **Source of truth during cutover** | Old home (Coolify app / Vercel / Railway / managed Supabase) stays **warm and authoritative** until the K3s target is verified. | full-plan §D |
| **Rollback** | **Re-point the connection string** (and DNS / env) back to the source. No data is destroyed on the source during the window. | task + full-plan §D |
| **DR targets** | **RTO ≤ 2 h**, **RPO ≤ 5 min** (Postgres / CNPG-Barman PITR), **~1 h** (SurrealDB hourly export). | [`governance/bcp-dr-policy.md`](../../../governance/bcp-dr-policy.md) |

## The runbooks

| Product | Source home | Target | Runbook |
|---|---|---|---|
| Restormel Keys | Coolify (`restormel_ops` Postgres) | `pg-restormel` CNPG | [`restormel.md`](restormel.md) |
| Allotmentology | Coolify (`allotmentology-postgres`) | `pg-platform` CNPG | [`allotmentology.md`](allotmentology.md) |
| UseSophia | Railway + Neon PG + Neon Auth + shared SurrealDB | `pg-platform` CNPG + Better Auth + in-cluster SurrealDB | [`usesophia.md`](usesophia.md) |
| PlotBudget | Vercel + managed Supabase (GoTrue/PostgREST/Storage/Realtime) | self-hosted Supabase on `pg-plotbudget` CNPG | [`plotbudget.md`](plotbudget.md) |
| PlotBudget — auth/RLS (high-risk, rehearsed) | `auth.*` + 158 RLS policies + storage + email hook | self-hosted GoTrue + verified RLS | [`plotbudget-auth-rls.md`](plotbudget-auth-rls.md) |

## How every runbook is structured

Each runbook follows the same skeleton so an operator can execute it under pressure:

1. **Scope & invariants** — what moves, what must never break.
2. **Pre-checks** — green-light conditions before the window opens.
3. **Maintenance-window steps** — freeze → `pg_dump` → restore into CNPG → verify → flip the
   connection string → smoke test.
4. **Rollback** — re-point the connection string / DNS / env to the still-authoritative source.
5. **Validation checklist** — the tick-boxes that close the window.

All commands are **illustrative templates** — no real hostnames, passwords, or tokens appear.
Secrets are referenced by their Infisical key name only and injected via External Secrets
Operator (ESO) per k3s-design §6. Never paste a live connection string into a terminal history
or a ticket; pull it from Infisical at the moment of use and let it expire from scrollback.

## Conventions

- **All times UTC.** Log every action to [`planning/migration-log.md`](../../../planning/migration-log.md).
- `kubectl` examples assume the cluster context is selected and the operator is on the bastion.
- `psql`/`pg_dump`/`pg_restore` run from a throwaway client pod or the operator workstation over
  the private network — never expose a DB publicly for the window.
- A **two-person check** is recommended at each "flip the connection string" step. For PlotBudget
  it is **mandatory** (security boundary over financial data).
