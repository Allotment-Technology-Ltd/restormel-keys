# Status

Current state and next actions. Single source for "where we are"; keep aligned with [ROADMAP.md](ROADMAP.md).

**Phase:** 01 — Implementation (gate lifted)

**State:** Phase 00 bootstrap complete. **@restormel/keys v0.1.0** is published to npm; first publish and Phase 1 manual steps are done. Phase 2 complete (Svelte, elements, React, CLI, Next.js demo, SOPHIA runbook, a11y, publish, SvelteKit demo). **Auth model (v1):** **Gateway Key (`rk_...`)** for all programmatic/backend access (Resolve, policy evaluate, routes/steps); **Session (GitHub login)** for dashboard admin/config. **Management Key** is deferred/internal-only and not required for v1 flows. **Single app:** All product surfaces live in **apps/dashboard** (SvelteKit 2 + Svelte 5): Keys landing (`/keys`), Pricing (`/keys/pricing`), Docs (`/keys/docs`) including the integration walkthrough (Phase 0–6, migration paths, verification) with optional **agent prompts** per phase (collapsed by default; `RESTORMEL_DOCS_AGENT_PROMPTS=false` hides site-wide). Dashboard at `/keys/dashboard` (Neon Auth, Neon Postgres, Gateway keys, projects, integrations, models, routes, policies, etc.). **Layout:** One header (SiteHeader) and footer (SiteFooter) across the site; GitHub link in footer only; max-width container `--rm-container-max` (72rem) site-wide; docs and dashboard side navs are **collapsible** (state in localStorage). `apps/site` is **archived** (Astro/Starlight no longer used); deploy from `apps/dashboard` only. Keys experience unification (Phase A–D) done: logged-out UX and SSO, brand shell and logo, journey fixes, docs/Zuplo same-link and documentation strategy, shared tokens (`@restormel/keys-tokens`), UX contracts, reintegration seams in ARCHITECTURE.md.

**Next:** Phase 3.2 (Keys landing page), 3.3 (Pricing), 3.4 (dashboard), etc. per [docs/reference/09-prompt-pack-phase-3.md](docs/reference/09-prompt-pack-phase-3.md). For a practical remaining backlog (completed vs partial vs missing, tech debt, next tasks), see [docs/reference/remaining-backlog-after-implementation.md](docs/reference/remaining-backlog-after-implementation.md). **SOPHIA dogfooding** (ingestion pipeline + fallback routes/policies + UI embedding for model selection): [docs/reference/sophia-dogfooding-plan.md](docs/reference/sophia-dogfooding-plan.md).

**Dogfooding / npm:** Publish workflow ships **@restormel/keys-cli** from tag `keys-v0.2.2+` (with keys/doctor/validate). [docs/reference/npm-packages.md](docs/reference/npm-packages.md). Dashboard Gateway Key: human GitHub sign-in.

**Blockers:** None.

---

*Update when state or next actions change. Use roadmap-status-sync skill.*
