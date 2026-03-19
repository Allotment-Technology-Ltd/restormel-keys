# Roadmap

Execution roadmap. Single source for milestones; keep aligned with [STATUS.md](STATUS.md). See [docs/release-readiness.md](docs/release-readiness.md) for gate criteria.

## Phase 00 — Bootstrap (complete)

- Repo foundation, canonical docs, .cursor/rules, skills, subagents, scripts, .github workflows/templates. No product or business logic.
- **Gate lifted.** Phase 01 may begin.

## Phase 01 — Implementation (current)

- **First publish done:** @restormel/keys v0.1.0 on npm; Phase 1 manual steps complete.
- **Phase 2 complete:** @restormel/keys-svelte (KeyManager, ModelSelector, CostEstimator), @restormel/keys-elements, @restormel/keys-react, CLI, Next.js/SvelteKit demos, SOPHIA runbook, a11y, publish.
- **Phase 3 started:** Astro + Starlight marketing site (3.1) in apps/site — marketing layout, homepage “Restormel makes reasoning visible”, Starlight at /keys/docs/*, Cloudflare Pages. Next: 3.2 Keys landing, 3.3 Pricing, 3.4 dashboard per [docs/reference/09-prompt-pack-phase-3.md](docs/reference/09-prompt-pack-phase-3.md).
- **Experience unification (Phase A–D):** Dashboard logged-out UX and SSO, frontend brand shell and logo integration, journey fixes (pricing checkout, docs handoff, billing copy), docs/Zuplo same-link and documentation strategy, shared tokens package and drift check, UX contracts (nav/copy/state), reintegration seams documented in ARCHITECTURE.md.

## Integrations — Developer Enablement

- **Marketing:** `/integrations` landing page (hero, integration cards, setup steps).
- **Dashboard:** `/keys/dashboard/dev-tools` overview + CLI, MCP, AAIF sub-pages. Existing provider integrations relabelled to "Provider Access".
- **Packages:** `@restormel/aaif` v0.0.1 (types, validation), `@restormel/mcp` v0.1.0 (tool schemas + stdio server `restormel-mcp`, `createRestormelMcpServer()` — `models.list`, `cost.estimate`, `routing.explain`, etc.).
- **CLI:** `keys models list` and `keys routing explain` commands added.
- **Onboarding:** Usage path selector ("In my app / terminal / agent") on dashboard overview.
- **Docs:** `/keys/docs/integrations/` with CLI quickstart, MCP setup, AAIF overview.
- **Next:** AAIF routing integration, webhook/event stream support; MCP transport extras (e.g. HTTP) if demand emerges.
- Full spec: [docs/integrations/INTEGRATIONS-FULL-SPEC.md](docs/integrations/INTEGRATIONS-FULL-SPEC.md).

## Dogfood-driven priorities (from SOPHIA Phase 5)

Findings from the first real integration. See [docs/reference/sophia-dogfood-findings.md](docs/reference/sophia-dogfood-findings.md) for full context and workarounds.

**Restormel-first strategy:** Production issues on Sophia should be treated in two layers: (1) Restormel does more heavy lifting (stronger contract, typings, component behavior, model filtering, diagnostics); (2) then simplify the host app and reassess what is truly app-specific. See [docs/reference/restormel-first-assessment.md](docs/reference/restormel-first-assessment.md).

1. **Publish UI packages to npm.** `@restormel/keys-svelte`, `@restormel/keys-react`, `@restormel/keys-elements` — installable from npm with release smoke tests. Currently 404.
2. **KeyManager async persistence.** `onKeyAdded`/`onKeyRemoved` should accept promises; show loading/error states; close only on host success.
3. **Richer key-status model.** `pending_validation`, `invalid`, `revoked`, `validated_at`, `last_error`, manual revalidate — so host apps can drop their own diagnostics UI.
4. **Server-side validation pattern.** First-class docs and optional helper for host-owned validation (no raw provider calls from browser).
5. **Provider definitions and icons.** More first-party providers for common OpenAI-compatible APIs; document custom provider definitions as a normal integration path; expand icon set.
6. **KeyManager contract.** Host-driven add/remove flows (async result), richer item metadata prop.
7. **Provider normalization.** Consistent `google` handling across UI, docs, and API helpers.
8. **ModelSelector host control (Phase 5 packaged path).** Sophia uses wrapped ModelSelector in main flow; wrapper needed for current-selection visibility, request-scoped routing, host-owned loading/error/empty states, retry/disabled around allowed-models fetch. Make ModelSelector more host-controllable (selection visibility, loading/error/empty/retry/disabled) so hosts need thinner wrappers or none.

### Restormel-first integration (recommended order, from assessment)

Do these before over-rotating on host-app fixes:

- **Stronger Svelte typings** — usable `.d.ts` for KeyManager and ModelSelector (not generic SvelteComponent).
- **Richer packaged component APIs** — built-in loading/error/degraded/empty states so hosts need fewer wrappers.
- **Model-filtering contract** — more complete contract so apps do not have to build custom allowed-models proxy for the common case.
- **Diagnostics** — when Restormel is misconfigured or unavailable, failure should present as "Restormel backend/config issue" not "component broken"; clearer in component behavior and package/debug surface.

---

*Update when milestones change. Use roadmap-status-sync skill to keep ROADMAP and STATUS aligned.*
