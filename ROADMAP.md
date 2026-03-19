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

## Dogfood-driven priorities (from SOPHIA Phase 5)

Findings from the first real integration. See [docs/reference/sophia-dogfood-findings.md](docs/reference/sophia-dogfood-findings.md) for full context and workarounds.

1. **Publish UI packages to npm.** `@restormel/keys-svelte`, `@restormel/keys-react`, `@restormel/keys-elements` — installable from npm with release smoke tests. Currently 404.
2. **KeyManager async persistence.** `onKeyAdded`/`onKeyRemoved` should accept promises; show loading/error states; close only on host success.
3. **Richer key-status model.** `pending_validation`, `invalid`, `revoked`, `validated_at`, `last_error`, manual revalidate — so host apps can drop their own diagnostics UI.
4. **Server-side validation pattern.** First-class docs and optional helper for host-owned validation (no raw provider calls from browser).
5. **Provider definitions and icons.** More first-party providers for common OpenAI-compatible APIs; document custom provider definitions as a normal integration path; expand icon set.
6. **KeyManager contract.** Host-driven add/remove flows (async result), richer item metadata prop.
7. **Provider normalization.** Consistent `google` handling across UI, docs, and API helpers.

---

*Update when milestones change. Use roadmap-status-sync skill to keep ROADMAP and STATUS aligned.*
