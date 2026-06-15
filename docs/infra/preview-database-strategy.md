---
title: Per-PR preview database strategy
class: technical
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-14
last-reviewed: 2026-06-14
review-interval: P12M
---

# Per-PR preview database strategy

**Status:** Plan / decision proposal — not built.
**Context:** We are leaving Neon (which gave free DB *branching + auto-expiry* for previews). The
operational DB is now self-hosted vanilla Postgres on the one Coolify box (P3), and **local dev**
uses a disposable local Docker Postgres ([local-dev-database.md](local-dev-database.md)). Preview
environments serve from **Coolify at `preview.restormel.dev`** (Vercel previews + Neon preview
branches are disabled — see [off-github-runbook.md](off-github-runbook.md)). What's missing is an
**ephemeral, isolated database per PR**, created on open and **auto-deleted** on close.

> **Recommendation in one line:** don't build a heavy branching engine. Use **template-DB-per-PR**
> on a small dedicated preview Postgres with CI create/drop + a TTL sweeper — or, as a zero-effort
> interim, keep **Neon's free branching for previews only** until we fully exit Neon.

## Why not the obvious heavy option
Real Neon-style **thin copy-on-write branching** for self-hosted Postgres exists (Postgres.ai
**DBLab** on ZFS): instant clones, TTL auto-delete. But it needs a ZFS host + the DBLab engine and
meaningful disk — **overkill for a one-box PoC** where disk is already guarded (see the prod-box
disk-guard). Migrations are 100% vanilla-PG-portable, so we don't need CoW fidelity; a fresh DB per
PR is cheap and correct.

## Options

| # | Approach | Infra | Auto-delete | Verdict |
|---|---|---|---|---|
| 1 | **Neon branching, previews only** | none (Neon stays for previews; prod is self-hosted) | Neon branch expiry | **Best interim** — zero work; partial Neon stay |
| 2 | **Template-DB-per-PR** on a dedicated preview Postgres (`CREATE DATABASE pr_<n> TEMPLATE restormel_template`) | one small Coolify PG | CI on PR close + TTL sweeper | **Best target** — lightweight, fully off Neon |
| 3 | **Schema-per-PR** on one shared Postgres (`search_path`) | one PG | CI drop schema | Lightest on resources, but needs app-level schema routing (invasive) |
| 4 | DBLab/ZFS thin clones | ZFS host + engine | TTL | Rejected — overkill for the box |

## Recommended target — Option 2 (template-DB-per-PR)

### Components
- **`restormel-preview-pg`** — a dedicated Postgres 16 on Coolify, internal-network only, **separate
  from prod `restormel_ops`** (blast-radius isolation; previews are small and short-lived).
- **`restormel_template`** — a template database kept migrated-to-head: a CI job runs `pnpm migrate`
  against it on every merge to `main`. New previews **copy from it** (`CREATE DATABASE … TEMPLATE`),
  so previews need **no per-PR migration run** — instant, and seed data (catalogue) is carried in.
- **Forgejo Actions** (primary CI — see forgejo-primary-cicd):
  - On PR **open/synchronize** → `CREATE DATABASE pr_<number> TEMPLATE restormel_template` (idempotent)
    and inject `DATABASE_URL=postgres://…/pr_<number>` into that PR's Coolify preview app env.
  - On PR **close/merge** → `DROP DATABASE pr_<number> WITH (FORCE)`.
- **TTL sweeper** — a daily cron that drops `pr_*` databases whose PR is closed or older than N days.
  Belt-and-braces so a missed close-hook never leaks disk (matches the disk-guard discipline).

### Auth on previews
Better Auth `self` per preview, with `BETTER_AUTH_URL` = the preview origin. The wrinkle is GitHub
OAuth: each preview origin needs a registered callback, and OAuth apps allow one callback. Options:
a **single "previews" GitHub OAuth app** with a stable callback on a fixed preview host + path-based
PR routing, or a GitHub **App** (multiple callbacks). **Decision needed** — call it out before build.

### Guardrails
- Cap concurrent previews (e.g. 10) to bound disk; sweeper enforces.
- Preview DBs are **non-prod data only** — never seed real user content (BYO-content rule, see
  database-strategy).
- `WITH (FORCE)` drop to evict lingering connections.

## Phasing
1. **Now (interim):** keep **Neon branching for previews only** (Option 1) — zero work, unblocks
   preview environments while prod moves self-hosted.
2. **Target:** implement **Option 2** when we commit to fully exiting Neon. Gated decisions: dedicated
   vs shared preview PG, the previews-OAuth approach, concurrency cap.

## Out of scope
Local dev (solved — local Docker Postgres). Prod/staging ops DB (P3, `restormel_ops`). Real CoW
branching (Option 4, rejected).
