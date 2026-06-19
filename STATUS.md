# Status

Current state and next actions. Single source for "where we are"; keep aligned with
[ROADMAP.md](ROADMAP.md). Positioning lives in [docs/product/positioning.md](docs/product/positioning.md).

**Phase:** 01 — Implementation.
**Last reviewed:** 2026-06-13.

## What Restormel is now

The **verified-context layer for AI products**: provenance-traced, quality-gated knowledge an
agent (or its auditor) can trace to the exact source span. Two MVP products in one signed-in
workspace at restormel.dev — **Keys** (Route: the control plane, BYOK + routing) and
**Connect** (Ingest · Retrieve · Verify). Full positioning + market in
[docs/product/positioning.md](docs/product/positioning.md).

## MVP surface (module flags)

Production defaults show **Keys + Connect** only. `MVP_MODULE_DEFAULTS`
(`apps/dashboard/src/lib/module-flags-types.ts`): `connect` + `keys` on; `testing`, `graph`,
`gatewayProviders`, `guardrails`, `environments`, `modelPools`, `hostedRuntime`,
`catalogExternalSignals` off. Gated via PostHog `restormel-module-*` (EU project) or
`RESTORMEL_MODULE_FLAGS`. Post-MVP re-enable = flip flags; no code deletion. Canonical:
[docs/guides/keys-mvp-mode.md](docs/guides/keys-mvp-mode.md),
[docs/guides/keys-mvp-module-flags.md](docs/guides/keys-mvp-module-flags.md).

## Infrastructure — Coolify / Forgejo-native (cutover 2026-06-13)

Production runs **UK/EU self-host on Coolify**; CI/CD is **Forgejo-native** (migrated off
GitHub Actions + Vercel). Deploy from the single `apps/dashboard` SvelteKit app. Runbooks:
[docs/infra/coolify-cutover-runbook.md](docs/infra/coolify-cutover-runbook.md),
[docs/infra/coolify-env-inventory.md](docs/infra/coolify-env-inventory.md),
[docs/infra/suite-server-sizing.md](docs/infra/suite-server-sizing.md),
[docs/infra/off-github-runbook.md](docs/infra/off-github-runbook.md). Data: **self-hosted Postgres**
(spine) + **BYO SurrealDB** (graph). Analytics: **PostHog EU**. Cloud API gateway: **Zuplo**.
Billing: **Paddle**.

> `.forgejo/workflows` overrides `.github` on the Forgejo mirror; push the `.forgejo` variant
> with any CI change. Some `.github` workflows (e.g. tag-driven npm publish) still run on the
> GitHub mirror — confirm per workflow rather than assuming.

## Verified Context pivot — largely shipped

The verification spine is live and proven end-to-end: evidence-bound verification (Layer 1
binding + Layer 2 span-scoped cross-model entailment with abstention), trust scorecard,
provenance traces, published quality bar (≥90% supported / ≤2% unsupported), and a weekly
CI efficacy gate. All ten rows of the
[claims ledger](docs/product/verified-context-claims-ledger.md) are `proven` (2026-06-13). Delivery +
the claims-integrity rule: [docs/product/verified-context-pivot-roadmap.md](docs/product/verified-context-pivot-roadmap.md).
Marketing reposition (Stage 1.3) landed on `/`, `/connect`, `/keys/use-cases`; remaining
public surfaces (`/keys` landing, docs IA, API-doc IA, nav) are the subject of the
public-pages revamp programme.

## Product & platform

- **Single app:** all surfaces in `apps/dashboard` (SvelteKit 2 + Svelte 5) — `/keys` landing,
  `/keys/pricing`, suite docs at `/docs` + product docs at `/keys/docs`, dashboard at
  `/keys/dashboard`. `apps/site` is archived.
- **Auth (v1):** Gateway Key (`rk_…`) for programmatic access; Better Auth (self-hosted)
  session for dashboard admin/config.
- **npm surface:** Keys REST + `@restormel/keys-elements` (Web Components) recommended;
  `@restormel/keys`, `-svelte`, `-react` deprecated (maintenance until 2026-12-01).
  [docs/reference/npm-packages.md](docs/reference/npm-packages.md) is the availability truth source.
- **Connect (MVP):** operator pipeline (BYO graph, domain packs, ingest worker, validation
  review, re-validation) + REST v1 (`/connect/v1/verify|retrieve|ingest/jobs`) + MCP
  `connect.*`. Active gaps: non-degraded Retrieve on populated BYO graphs and Ingest GA
  hardening — see [ROADMAP.md](ROADMAP.md).
- **Dashboard:** "world-class" delivery roadmap completed 2026-06-12 (run console, logs,
  Prove-it gesture, brutalist sweep, copy/a11y). Service operators via `/keys/admin`
  ([docs/runbooks/service-admin-operators.md](docs/runbooks/service-admin-operators.md)).
- **Integrations:** `/integrations` marketing + dashboard dev-tools; `@restormel/aaif`,
  `@restormel/mcp` (suite read tools + `POST /api/suite/invoke`). Full spec:
  [docs/integrations/INTEGRATIONS-FULL-SPEC.md](docs/integrations/INTEGRATIONS-FULL-SPEC.md).

## Next actions

1. **Public-pages + docs revamp** (in planning): reposition `/keys` as the control plane for
   Verified Context; consolidate docs IA; restructure API-doc IA; drop the "Developers" nav
   dropdown (keep one footer GitHub link); close the public-page PostHog analytics gap; SEO
   pass. Decisions captured 2026-06-13.
2. **Connect GA hardening:** reliable Retrieve on populated BYO graphs; Ingest validation at
   scale + observability; SOPHIA hosted cutover.
3. **Remaining pivot stages:** 3.2b (BYO Surreal incremental re-ingest, opt-in) and 3.4
   (agent memory write API) — see the pivot roadmap.

---

*Update when state or next actions change. Use the roadmap-status-sync skill to keep STATUS
and ROADMAP aligned.*
