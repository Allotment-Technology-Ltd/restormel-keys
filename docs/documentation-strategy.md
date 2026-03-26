# Documentation strategy

**Status:** Canonical. All product docs, runbooks, and in-app docs must align with this strategy.

Documentation is a first-class part of the product. It must be **user-friendly** for humans and **agent-readable** for coding agents, with a **single coherent journey** and **compulsory same links** everywhere.

## 1. Single coherent journey

- **One information architecture:** Entry points (docs home, getting started), paths by intent (e.g. “I want to integrate” → framework compatibility → dashboard/API; “I want to use the Cloud API” → Cloud API doc → Zuplo runbooks), and handoffs (docs ↔ dashboard, docs ↔ pricing, runbooks ↔ dashboard) that use the **same canonical link targets**.
- **No fragmented stories:** In-app docs (`/keys/docs`), `docs/` runbooks and reference, and Zuplo runbooks form **one consistent doc map**. Where Zuplo is referenced (Cloud API, gateway, consumer keys, backend URL), use the same canonical dashboard URL and terminology as the rest of the product.
- **Two API surfaces everywhere:** Dashboard API (`rk_…`) vs Zuplo Gateway (`zpka_…`) must be explicit wherever integrators choose a key — especially **project model index** (`GET …/models` is Dashboard + Gateway Key only; writes are UI-only until the requirements spec ships). The in-app Cloud API page carries the matrix; OpenAPI `info.description` and the `listProjectModels` operation repeat it so agents and portals do not infer Zuplo for that path.
- **Discoverable paths:**
  - **Integrate:** Docs overview → Framework compatibility → Dashboard (create project, Gateway key) or Cloud API.
  - **Cloud API / gateway:** In-app [Cloud API](https://restormel.dev/keys/docs/cloud-api) → [Zuplo setup runbook](runbooks/zuplo-setup.md) and [Zuplo launch CLI](runbooks/zuplo-launch-cli.md). Runbooks link back to docs and dashboard with the same URLs.

## 2. Same links (compulsory)

Every surface—marketing nav, docs header/sidebar, dashboard, runbooks, and reference docs—must use the same canonical URLs. No alternate URLs or wording.

| Label   | URL                     |
|--------|-------------------------|
| Dashboard | `https://restormel.dev/keys/dashboard`     |
| Sign in   | `https://restormel.dev/keys/dashboard/login` |

Use these in: in-app nav, footer, docs sidebar, runbooks (e.g. zuplo-setup.md, zuplo-launch-cli.md), and any phase/reference doc that points to the product. Site, docs, and dashboard are served from one app at restormel.dev (dashboard at `/keys/dashboard`, docs at `/keys/docs`).

## 3. Agent-readability

- **Structure:** Consistent heading hierarchy (e.g. H1 → H2 → H3), predictable section patterns, and canonical file paths so agents can resolve references.
- **Naming:** Same product terms everywhere: Workspace, Project, Environment, Gateway Key, Provider credential, Provider integration, Route, Models, Analytics, Logs & Traces, Dashboard, Sign in, Cloud API (umbrella), Dashboard API, Zuplo Gateway API, Zuplo gateway, backend key (Gateway Key), consumer key.
- **Cross-references:** Use stable paths or anchors; avoid duplicate or contradictory truths. One canonical source per topic (see [.cursor/rules/01-doc-governance.mdc](../.cursor/rules/01-doc-governance.mdc)).
- **Runbooks:** Use the same terminology and link to dashboard/docs with the compulsory URLs. Ensure runbooks are discoverable from the main doc index and the Svelte docs so “Cloud API” and “gateway setup” feel part of the same journey.

## 4. Where things live

| Content type        | Location                    | Role |
|---------------------|-----------------------------|------|
| User-facing docs    | In-app docs (`apps/dashboard`, `/keys/docs`) | Overview, compatibility, Cloud API, getting started. |
| Runbooks (ops)      | `docs/runbooks/`            | Zuplo setup/launch, Firestore→Neon, phase-3 manual steps. |
| Reference           | `docs/reference/`, `docs/api/` | Deployment, extraction, OpenAPI, prompt packs. **Implemented behaviour:** [docs/reference/implemented-behaviour.md](reference/implemented-behaviour.md) — what is live in the dashboard and product so docs do not contradict. **Remaining backlog:** [docs/reference/remaining-backlog-after-implementation.md](reference/remaining-backlog-after-implementation.md) — completed vs partial vs missing, tech debt, next tasks (grounded in repo state). |
| Design system       | `docs/design-system-index.md`, `docs/design-tokens.css` | Tokens, brand, components. |

The docs sidebar (Svelte app) includes a **Product** group with Dashboard and Sign in links. The Cloud API doc links to the Developer Portal and to the dashboard; runbooks link to the dashboard and Sign in with the canonical URLs above.

## 5. Maintenance

- When adding or changing docs that mention Dashboard or Sign in, use only the canonical URLs.
- When adding runbooks or reference docs that point to the product, add them to [runbooks.md](runbooks.md) or the master index as appropriate and keep same-link compliance.
- Review in-app docs and runbooks periodically for coherence and duplicate/contradictory truths; one canonical source per topic.
