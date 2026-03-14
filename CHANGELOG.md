# Changelog

Single record of meaningful repo changes.

## Unreleased

### Added

- **Prompt 2.10 (SvelteKit demo):** apps/demo-svelte with SvelteKit 2 and Svelte 5. Routes: / (landing), /settings (KeyManager + ModelSelector), /api/keys and /api/keys/[id] (Keys middleware, in-memory storage), /demo (chat with mock responses using resolved provider). Styled with --rm-* tokens; Keys components use --rk-* from theme. README with run and gate. No auth; mock only.
- **Prompt 2.9 (Publish Phase 2):** @restormel/keys bumped to 0.2.0. Root README: package table (core 0.2.0, svelte/elements/react/cli 0.1.0), quickstart (core, React, Svelte, CLI), publish note (dry-run, tag keys-v0.2.0, no Vue).
- **Prompt 2.8 (Accessibility audit):** axe-core at WCAG 2 AA for KeyManager, ModelSelector, CostEstimator in @restormel/keys-svelte. Zero violations (jsdom-safe rules; color-contrast/target-size disabled in test env). Keyboard: Escape closes entry and collapses detail; Enter/Space toggles expand; tab through controls. Screen reader: region labels, aria-live status, aria-expanded on list rows, labelled inputs, role="status" on budget badges. Fix: statusMessage→announceLive; dialog role and Escape on form.
- **Prompt 2.7 (SOPHIA integration runbook):** `docs/reference/sophia-integration.md` — runbook for replacing SOPHIA's inline BYOK with @restormel/keys. Steps: add dependency in SOPHIA repo, create `src/lib/server/keys-adapter.ts` (template with Firestore KeyStorage, createKeys, createMiddleware, createResolveMiddleware), refactor BYOK routes to use Keys middleware, keep billing, verify tests and BYOK flow. Gate: SOPHIA tests pass, BYOK end-to-end. DO NOT: change API contracts, remove billing, break functionality.
- **Prompt 2.6:** @restormel/keys-cli. Commands: `keys init` (detect framework, generate config, suggest packages), `keys add <provider>` (prompt, validate, store), `keys list` (masked), `keys validate` (exit 1 if invalid — CI-friendly), `keys doctor` (framework, packages, config, keys), `keys estimate <model> --input --output`. Framework detection: Next.js App Router, React, SvelteKit, Astro. Config (restormel.config.json) has no secrets; key store (.restormel/key-store.json) is gitignored. Tests: framework detection, config read/write, store, validate exit code.
- **Custom domain restormel.dev (GCP).** Pulumi infra extended for apex + www: dual-domain Google-managed SSL cert, URL map (www → 301 to apex), HTTP→HTTPS redirect on same global IP. New exports: `dashboardServiceName`, `managedCertificateName`, `dnsRecordsForVercel`. Runbook: `docs/domain-mapping-restormel-dev.md` (commands, Pulumi outputs, Vercel DNS records, verification).
- **@restormel/keys-svelte** (Phase 2): Svelte 5 package with KeyManager component. Vite library build, dependency on @restormel/keys. KeyManager: props `keys`, `userId`, `onKeyAdded`, `onKeyRemoved`, `providers`; states Empty / Key entry / Key list / Key detail; --rk-* theme (theme.css with .rk-dark, .rk-light); inline SVG icons; keyboard nav, aria-labels, focus management, live region. No raw keys in UI; add, validate, list, delete keys via host callbacks.
- **Prompt 2.2:** ModelSelector and CostEstimator Svelte 5 components. ModelSelector: models grouped by provider, available/unavailable styling with reasons (No API key), click fires onSelect(modelId, providerId). CostEstimator: cost breakdown (model, provider, input/output per 1M tokens), optional budget comparison with green/amber/red badges (Within budget, Near budget, Over budget). Icons module: PROVIDER_ICONS, GENERIC_ICON, getProviderIcon() for OpenAI, Anthropic, Google, generic. All exported from index. Tests: icons, ModelSelector (rendering, grouping, theme), CostEstimator (empty, breakdown, budget badges, theme). KeyManager now uses shared getProviderIcon.
- **Prompt 2.4:** @restormel/keys-react — React wrapper and hooks. Deps: @restormel/keys, @restormel/keys-elements; peer React 18+. KeyManager, ModelSelector, CostEstimator TSX wrap Web Components; useRef + useEffect for props/events; typed props and callbacks; "use client". Hooks: useKeys(config, options) → { keys, loading, error }; useModels(keys, providers) → { modelIds, groups }; useCost(keys, modelId) → { cost }. KeysProvider context. README: generic React, Next.js App Router settings page, dynamic import. Tests: wrapper rendering and event propagation, useKeys/useModels/useCost, KeysProvider and useKeysContext throw.
- **Prompt 2.3:** @restormel/keys-elements — Web Component wrappers. Single Vite lib bundle. Custom elements: &lt;rk-key-manager&gt;, &lt;rk-model-selector&gt;, &lt;rk-cost-estimator&gt;. Each: shadow DOM, default theme CSS, :host --rk-* for host theming, kebab-case attributes (user-id, budget, estimated-cost), object props via properties (keys, providers, cost), custom events (rk-key-added, rk-key-removed, rk-model-selected, rk-cost-updated). register.ts side-effect import. README: plain HTML, Astro, script import examples; React/Next.js compatibility note (object props, @restormel/keys-react). Tests: registration, attribute/prop mapping, event dispatch, defaultThemeCss :host/--rk-*, no shadow before connect.

## [0.1.0] — first npm release

### Added

- **@restormel/keys** v0.1.0 published to npm. First publish; Phase 1 manual steps complete (NPM_TOKEN in GitHub, tag `keys-v0.1.0`, Publish workflow succeeded). Package: headless core (routing, cost, entitlements, wallet, providers, storage adapters, server middleware, key hashing/security).

### Earlier

- Phase 00 bootstrap scaffold per [docs/bootstrap-plan.md](docs/bootstrap-plan.md): root docs, docs/ canonical package, .cursor/rules, skills, subagents, scripts, .github workflows and templates, apps/packages placeholders, root config.

---

*Update for meaningful changes. Use changelog-updater skill.*
