# Documentation strategy

**Status:** Canonical. All product docs, runbooks, and in-app docs must align with this strategy.

Documentation is a first-class part of the product. It must be **user-friendly** for humans and **agent-readable** for coding agents, with a **single coherent journey** and **compulsory same links** everywhere.

## 1. Single coherent journey

- **One information architecture:** Entry points (docs home, getting started), paths by intent (e.g. “I want to integrate” → framework compatibility → dashboard/API; “I want to use the Cloud API” → Cloud API doc → Zuplo runbooks), and handoffs (docs ↔ dashboard, docs ↔ pricing, runbooks ↔ dashboard) that use the **same canonical link targets**.
- **No fragmented stories:** In-app docs (`/keys/docs`), `docs/` runbooks and reference, and Zuplo runbooks form **one consistent doc map**. Where Zuplo is referenced (Cloud API, gateway, consumer keys, backend URL), use the same canonical dashboard URL and terminology as the rest of the product.
- **Two API surfaces everywhere:** Dashboard API (`rk_…`) vs Zuplo Gateway (`zpka_…`) must be explicit wherever integrators choose a key — especially **project model index** (`GET/POST/PUT …/models`, `PATCH/DELETE …/models/{bindingId}` on Dashboard + Gateway Key only; not Zuplo). The in-app Cloud API page carries the matrix; OpenAPI repeats it so agents and portals do not infer Zuplo for that path.
- **Discoverable paths:**
  - **Integrate:** Docs overview → Framework compatibility → Dashboard (create project, Gateway key) or Cloud API.
  - **Third-party index:** [Integration catalog](https://restormel.dev/keys/docs/guides/integration-catalog) → existing per-vendor guides (Neon, gateways, CI, Cloud API / Zuplo); optional AAIF `integrationStack` for machine-readable stack metadata ([AAIF doc](https://restormel.dev/keys/docs/integrations/aaif#integration-stack)).
  - **Cloud API / gateway:** In-app [Cloud API](https://restormel.dev/keys/docs/cloud-api) → [Zuplo setup runbook](runbooks/zuplo-setup.md) and [Zuplo launch CLI](runbooks/zuplo-launch-cli.md). Runbooks link back to docs and dashboard with the same URLs.

## 2. Same links (compulsory)

Every surface—marketing nav, docs header/sidebar, dashboard, runbooks, and reference docs—must use the same canonical URLs. No alternate URLs or wording.

| Label   | URL                     |
|--------|-------------------------|
| Dashboard | `https://restormel.dev/keys/dashboard`     |
| Sign in   | `https://restormel.dev/keys/dashboard/login` |
| Testing hub | `https://restormel.dev/keys/dashboard/testing` |
| Suite docs hub | `https://restormel.dev/docs` |
| Suite quickstart | `https://restormel.dev/docs/quickstart` |
| Operator model (in-app) | `https://restormel.dev/docs/operator-model` |

Use these in: in-app nav, footer, docs sidebar, runbooks (e.g. zuplo-setup.md, zuplo-launch-cli.md), and any phase/reference doc that points to the product. Site, docs, and dashboard are served from one app at restormel.dev (dashboard at `/keys/dashboard`, product docs at `/keys/docs`, **suite map** at `/docs`).

### Dashboard-first onboarding (Theme L)

- **Primary learning surface:** signed-in dashboard (setup wizard, Connect hub journey, Testing hub). Public docs are for **SEO, agents, and deep reference** — not the first-run tour.
- **Progressive disclosure tiers:** Tier 0 = suite hub `/docs`; Tier 1 = quickstart + operator model + slim product sidebars; Tier 2 = walkthroughs, vendor guides, search — collapsed **Reference** sections in sidebars. Inventory: [docs/restormel/SUITE-IA-REDIRECT-INVENTORY.md](restormel/SUITE-IA-REDIRECT-INVENTORY.md).
- **Canonical operator vocabulary:** [docs/restormel/SUITE-OPERATOR-MODEL.md](restormel/SUITE-OPERATOR-MODEL.md) (mirrored at `/docs/operator-model`).

**Testing hub entry:** Prefer the **Testing hub** URL above in copy and automation. The marketing route `https://restormel.dev/testing/dashboard` **redirects signed-in users** to the Testing hub; anonymous users see a short stub with sign-in.

**Restormel Graph (Svelte graph UI):** Product home `https://restormel.dev/graph`. Public docs live at `https://restormel.dev/graph/docs` with the **canonical integrator guide** at `https://restormel.dev/graph/docs/integration/sveltekit` (install → imports → Vite SSR → CSS → example → verify → migrate). The same docs tree covers **Contract v0 scope**, **@restormel/graph-reasoning-extensions** (+ contracts handoff), **`@restormel/state` (Restormel State — agent memory, `platform-v*`)** at `https://restormel.dev/graph/docs/extensions/state`, **recipes**, **accessibility**, and **performance** under `/graph/docs/...`. npm canvas packages publish on git tags `graph-v*`; reasoning extensions, context packs, observability, and **State** publish on **`platform-v*`**; treat the in-app guides as the versioned narrative alongside package changelogs. **Canonical spec** for State (non-goals, SOPHIA hooks) remains **`docs/restormel/RESTORMEL-STATE.md`** in the repo—Graph docs are the integrator-facing mirror.

## 3. Agent-readability

- **Structure:** Consistent heading hierarchy (e.g. H1 → H2 → H3), predictable section patterns, and canonical file paths so agents can resolve references.
- **Naming:** Same product terms everywhere: Workspace, Project, Environment, Gateway Key, Provider credential, **Connections** (UI for provider integrations), Provider integration, **Restormel Testing** (dashboard hub for Testing project IDs/snippets), Route, Models, Analytics, Logs & Traces, Dashboard, Sign in, Cloud API (umbrella), Dashboard API, Zuplo Gateway API, Zuplo gateway, backend key (Gateway Key), consumer key.
- **Cross-references:** Use stable paths or anchors; avoid duplicate or contradictory truths. One canonical source per topic (see [.cursor/rules/01-doc-governance.mdc](../.cursor/rules/01-doc-governance.mdc)).
- **Runbooks:** Use the same terminology and link to dashboard/docs with the compulsory URLs. Ensure runbooks are discoverable from the main doc index and the Svelte docs so “Cloud API” and “gateway setup” feel part of the same journey.

## 4. Where things live

| Content type        | Location                    | Role |
|---------------------|-----------------------------|------|
| User-facing docs    | In-app docs (`apps/dashboard`, `/keys/docs`) | Overview, compatibility, Cloud API, getting started. |
| Runbooks (ops)      | `docs/runbooks/`            | Zuplo setup/launch, Firestore→Neon, phase-3 manual steps. |
| Reference           | `docs/reference/`, `docs/api/`, `docs/restormel-integration/` | Deployment, extraction, OpenAPI, prompt packs. **Consumer integrator contract (project model index vs catalog):** [docs/restormel-integration/keys-catalog-sync.md](restormel-integration/keys-catalog-sync.md). **Implemented behaviour:** [docs/reference/implemented-behaviour.md](reference/implemented-behaviour.md) — what is live in the dashboard and product so docs do not contradict. **Remaining backlog:** [docs/reference/remaining-backlog-after-implementation.md](reference/remaining-backlog-after-implementation.md) — completed vs partial vs missing, tech debt, next tasks (grounded in repo state). |
| Phase 1 platform extraction (agents) | `docs/archive/suite-migration-status/phase1-agent-prompt-restormel-engineering.md`, `docs/archive/suite-migration-status/phase1-restormel-engineering-spec.md` | **SSOT** for Phase 1 agent prompt text, comms snippet, objectives, §6 SOPHIA reintegration (`@sophia/graph-reasoning-extensions` → `@restormel/graph-reasoning-extensions`), and links to SOPHIA programme paths; reconcile with SOPHIA `docs/restormel/*` when those files land on default branch. |
| Horizon platform programme (suite expansion) | `docs/restormel/HORIZON-PLATFORM-PROGRAMME.md` | Capability shortlist (A–J), Theme L IA + dashboard shell rules, Theme M pointer, MCP/AAIF inventory and backlog, canonical boundaries—does not replace topic-specific specs. |
| Horizon platform programme (suite expansion) | `docs/restormel/HORIZON-PLATFORM-PROGRAMME.md` | Capability shortlist (A–J), Theme L IA + dashboard shell rules, Theme M pointer, MCP/AAIF inventory and backlog, canonical boundaries—does not replace topic-specific specs. |
| Suite architecture migration (Keys / Graph / Knowledge) | `docs/restormel/SUITE-ARCHITECTURE-MIGRATION.md`, `docs/restormel/CONNECT-EXTRACTION-MAP.md`, `docs/archive/suite-migration-status/PHASE0-SUITE-MIGRATION-STATUS.md` | Phased delivery-model migration, SOPHIA extract + reintegrate playbook, stage gates; **Testing delivery changes post-MVP (out of scope)**. |
| Restormel Connect (product) | `docs/restormel/CONNECT-PRODUCT.md`, `@restormel/contracts/connect`, `docs/api/openapi-suite-v1-draft.yaml` | Fourth suite product definition and REST contract epoch. |
| Restormel Support (Theme M product) | `docs/restormel/RESTORMEL-SUPPORT.md`, `docs/runbooks/restormel-support-production.md` | In-product assistant: trust boundaries, production env, dogfood checklist. Package: `@restormel/support`. |
| Design system       | `docs/design-system-index.md`, `docs/design-tokens.css` | Tokens, brand, components. |

The docs sidebar (Svelte app) includes a **Product** group with Dashboard and Sign in links. The Cloud API doc links to the Developer Portal and to the dashboard; runbooks link to the dashboard and Sign in with the canonical URLs above.

## 5. Maintenance

- When adding or changing docs that mention Dashboard or Sign in, use only the canonical URLs.
- When adding runbooks or reference docs that point to the product, add them to [runbooks.md](runbooks.md) or the master index as appropriate and keep same-link compliance.
- Review in-app docs and runbooks periodically for coherence and duplicate/contradictory truths; one canonical source per topic.
