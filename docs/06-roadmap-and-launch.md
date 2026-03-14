# Restormel Keys — Roadmap and Launch

---

## 1. Phased roadmap

### Phase 1: Foundation + core extraction (Weeks 1–2)

Repo created. CI/CD from SOPHIA. Pulumi infra. `@restormel/keys` core: routing, cost, entitlements, wallet, validator, types. Provider adapters (OpenAI, Anthropic, Google). Storage adapters (memory, encrypted-local). Server middleware. Unit tests >80%. **Done:** npm publish v0.1.0 (first publish complete; `npm info @restormel/keys` shows package).

**Gate:** `npm install @restormel/keys` works. SvelteKit app can configure providers and route requests.

### Phase 2: UI + framework wrappers + CLI (Weeks 3–4)

Svelte components (KeyManager, ModelSelector, CostEstimator). Theming. Web Components. React wrapper + hooks. Next.js demo + integration tests. SOPHIA integration (replace inline BYOK). Accessibility audit. CLI. npm publish all UI packages v0.1.0.

**Gate:** Next.js demo works with zero workarounds. SOPHIA uses Keys.

### Phase 3: Site + dashboard + billing (Weeks 5–7)

Landing page (Astro). Docs (Starlight). Dashboard (SvelteKit). Paddle billing (from SOPHIA). Zuplo gateway. PostHog analytics. Cloud API. Cloud deployment (Cloud Run + Cloudflare Pages).

**Gate:** Landing page live. Dashboard handles CRUD + billing. Zuplo portal accessible.

### Phase 4: Launch + polish (Weeks 8–10)

Paddle production mode. v1.0.0 publish. Blog post. Product Hunt. Dev.to tutorial. README polish. Additional examples. Testing suite. Final accessibility audit.

**Gate:** First paying customer. 100+ npm installs.

### Phase 5: Growth (Weeks 11–16)

Vue wrapper. Additional providers (Cohere, Mistral, Groq). UsageDashboard component. Firestore/Supabase/PostgreSQL adapters. Team features. Community.

---

## 2. Success metrics

### 8-week checkpoint

| Metric | Target |
|--------|--------|
| npm packages published | 6 |
| Next.js compatibility | Zero-workaround |
| Documentation pages | 10+ |
| npm weekly installs | 100+ |
| GitHub stars | 50+ |
| Paying customers | 3+ |

### 16-week checkpoint

| Metric | Target |
|--------|--------|
| npm weekly installs | 500+ |
| GitHub stars | 200+ |
| Paying customers | 30+ |
| MRR | £1,000+ |

---

## 3. Risk register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Extraction breaks SOPHIA | High | Adapter pattern. Tests. Wire only after stable. |
| Next.js incompatibility | High | P0 gate: integration tests must pass. |
| Scope creep toward gateway | Medium | Product def is a library. No proxy by default. |
| LiteLLM adds BYOK UI | High | Ship fast. Library-first positioning is different. |
| Solo founder capacity | High | Prioritise ruthlessly. Use AI coding tools. |
