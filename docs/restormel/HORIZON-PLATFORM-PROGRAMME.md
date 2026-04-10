# Horizon platform programme

**Purpose:** Single **programme-level** document for Restormel’s horizon themes (capabilities A–J), **Theme L** (IA, dashboard shell, experience), **Theme M** (draft: Restormel Support Agent / platform-market packaging), **MCP/AAIF suite inventory**, **stakeholder capability shortlist**, and **canonical source boundaries**. It does **not** duplicate operational specs—those live in the linked files below.

**Horizon implementation phases:** **Horizon Phase 1** = Theme L + suite MCP/AAIF (see [THEME-L-IA-MATRIX.md](./THEME-L-IA-MATRIX.md)). This is **not** [phase1-restormel-engineering-spec.md](./phase1-restormel-engineering-spec.md) (platform npm extraction: graph-core, contracts, etc.).

**Status:** Canonical for **horizon programme narrative** in this repo. Package APIs and behaviour remain owned by package READMEs and topic-specific docs.

**Audience:** Maintainers, product, and agents planning suite expansion.

---

## 1. Stakeholder capability shortlist (Themes A–J)

**Standing mandate (not optional):** **Theme L** (IA + dashboard + human/agent experience) and **suite-wide MCP/AAIF** ship as **one** experience wave—see [§4 Theme L](#4-theme-l--core-ia-dashboard-shell-and-mcpaaif-parity).

**Prioritised capability bets** (from horizon planning; reorder only via explicit programme decision):


| Order | Themes           | Intent                                                                |
| ----- | ---------------- | --------------------------------------------------------------------- |
| 1     | **L + MCP/AAIF** | Repeatable IA, multi-product dashboard, tool/doc parity               |
| 2     | **A + C**        | Eval/rubric contracts + usage/telemetry ledger (UI + CI + agents)     |
| 3     | **I or J**       | Memory/RAG lane *or* AI gateway++ (pick one anchor big bet per cycle) |
| 4     | **B + E**        | Policy/constitution packs + provenance/audit bundles                  |
| 5     | **D + F + G**    | HITL envelopes, durable execution, production AI probes               |


**Theme reference (one line each):**

- **A** — Portable eval/rubric envelope tied to Testing acceptance ids and trace correlation.
- **B** — Versioned policy/constitution data beyond trace-only signals.
- **C** — Conventional per-run usage/cost/reliability ledger (not distributed ledger); joins observability + Keys resolution.
- **D** — Human-in-the-loop task envelopes linked to state/traces/graph.
- **E** — Exportable audit bundles (context fingerprints, memory refs, trace slice, constitution snapshot).
- **F** — Durable agent execution (checkpoints, resume) as product or spec-first implementation.
- **G** — Production synthetics reusing Testing goal/AC semantics.
- **H** — MCP capability manifests and registry for tools.
- **I** — Retrieval/memory/RAG product lane with Restormel correlation and debugger narrative.
- **J** — Keys + policy + metering + MCP as enterprise AI front door.

**Out of scope for this programme:** Blockchain/DLT spikes (no Theme K workstream).

---

## 2. Canonical sources and boundaries


| Topic                                            | Canonical doc / location                                                                                                     | This programme doc            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Restormel State (library non-goals, correlation) | [RESTORMEL-STATE.md](./RESTORMEL-STATE.md)                                                                                   | Links only                    |
| Phase 1 platform extraction objectives           | [phase1-restormel-engineering-spec.md](./phase1-restormel-engineering-spec.md)                                               | Links only                    |
| Package map, publish trains                      | [docs/restormel-monorepo-packages.md](../restormel-monorepo-packages.md)                                                     | Links only                    |
| npm install truth                                | [docs/reference/npm-packages.md](../reference/npm-packages.md)                                                               | Links only                    |
| Doc IA, same-links, agent-readability            | [docs/documentation-strategy.md](../documentation-strategy.md)                                                               | Extends with Theme L patterns |
| Security, secrets, UX safety                     | [docs/security-baseline.md](../security-baseline.md), [.cursor/rules/04-ux-safety.mdc](../../.cursor/rules/04-ux-safety.mdc) | Mandatory for dashboard + MCP |
| MCP server rollout (ops)                         | [docs/runbooks/mcp-implementation-workflow.md](../runbooks/mcp-implementation-workflow.md)                                   | Complements §3                |
| Testing adoption / Plotbudget class              | [docs/testing/oss-consumption.md](../testing/oss-consumption.md)                                                             | Links only                    |


**Rule:** When a capability bet (A–J) ships, add or update **one** topic owner doc; link it from here only if the programme narrative needs a pointer—do not copy full specs into this file.

---

## 3. MCP and AAIF suite inventory

**Package:** `[@restormel/mcp](../../packages/mcp)` — tool registration in `[packages/mcp/src/register-tools.ts](../../packages/mcp/src/register-tools.ts)`. **AAIF:** `[@restormel/aaif](../../packages/aaif)` — use for server-to-server and typed HTTP where MCP is awkward; same capabilities should share **names and semantics** with MCP where possible.

### 3.1 Tier definitions

- **Read** — No durable mutation of customer resources; safe for broad agent use (still respect env and tokens).
- **Act** — Creates, updates, or deletes control-plane state, or returns **secrets** (e.g. raw Gateway key once). Requires explicit human approval in agent workflows and must mirror dashboard safeguards.

### 3.2 Implemented tools (`@restormel/mcp`)


| Tool                           | Tier | Product area      | Notes                           |
| ------------------------------ | ---- | ----------------- | ------------------------------- |
| `models.list`                  | Read | Keys / catalog    | Local default providers         |
| `providers.validate`           | Read | Keys              | Uses env credentials            |
| `cost.estimate`                | Read | Keys              |                                 |
| `routing.explain`              | Read | Keys              | Static catalog explain          |
| `entitlements.check`           | Read | Keys              | Remote evaluate when configured |
| `integration.generate`         | Read | Keys / integrator | Scaffolding                     |
| `integration.bootstrap_nextjs` | Read | Keys / integrator |                                 |
| `byok.schema.generate`         | Read | Keys / BYOK       |                                 |
| `byok.api_contract.generate`   | Read | Keys / BYOK       |                                 |
| `policy.simulate`              | Read | Keys / policies   | Local simulation                |
| `catalog.sync_check`           | Read | Keys / catalog    |                                 |
| `catalog.deprecation_alerts`   | Read | Keys / catalog    |                                 |
| `readiness.check`              | Read | Keys / deploy     |                                 |
| `docs.search`                  | Read | Docs              | Offline index                   |
| `projects.list`                | Read | Control plane     |                                 |
| `project_models.list`          | Read | Control plane     |                                 |
| `project.environments.list`    | Read | Control plane     |                                 |
| `routes.list`                  | Read | Control plane     |                                 |
| `policies.list`                | Read | Control plane     |                                 |
| `project.gateway_keys.list`    | Read | Control plane     | Prefixes only                   |
| `testing.hub_snapshot`         | Read | Testing           | Env snippet placeholders        |
| `testing.journey`              | Read | Testing / Keys    | Onboarding map                  |
| `testing.ci_env_template`      | Read | Testing           |                                 |
| `testing.resolve_probe`        | Read | Testing           | HTTP status only                |
| `routes.create`                | Act  | Control plane     |                                 |
| `routes.update`                | Act  | Control plane     |                                 |
| `routes.delete`                | Act  | Control plane     |                                 |
| `policies.create`              | Act  | Control plane     |                                 |
| `policies.update`              | Act  | Control plane     |                                 |
| `policies.delete`              | Act  | Control plane     |                                 |
| `fallback_chain.set`           | Act  | Control plane     |                                 |
| `project.gateway_keys.create`  | Act  | Control plane     | Returns **rawKey** once         |
| `project.gateway_keys.delete`  | Act  | Control plane     |                                 |


### 3.3 Desired coverage (not yet implemented)

Use this backlog to extend MCP (and AAIF mirrors) **without** inventing parallel names per product.


| Area                | Suggested tools / capabilities                                                                                                                                    | Tier (default) |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **Testing**         | Validate `restormel-testing.yaml` against schema; explain `testing doctor`; fetch last run summary from CI artifact path (local file) or Runs API when configured | Read           |
| **Testing**         | Trigger `testing run` (optional, gated)                                                                                                                           | Act            |
| **Graph**           | Validate/export `GraphData` fixture; link to integrator doc sections                                                                                              | Read           |
| **State / context** | Sanitized `projectWorkingMemory` from fixture JSON; `restormel_correlation` helper                                                                                | Read           |
| **Observability**   | Normalize pasted trace via `@restormel/observability`; return timeline summary                                                                                    | Read           |
| **Platform docs**   | Resolve canonical path for RESTORMEL-STATE, context-packs, contracts schema epoch                                                                                 | Read           |


**Naming policy:** Prefer `product.action` or `product.resource.action`; keep **dashboard and doc section titles** aligned with tool descriptions (Theme L).

---

## 4. Theme L — core IA, dashboard shell, and MCP/AAIF parity

### 4.1 Role

Theme L is the **centre of gravity** for how Restormel **designs, ships, and extends** the suite: **repeatable information architecture**, a **multi-product dashboard** in `[apps/dashboard](../../apps/dashboard)`, and patterns reused on **every** expansion—including **MCP/AAIF** copy and tool UX.

### 4.2 Repeatable IA primitives

- **Public site modules:** Keys, Testing, Graph, Integrations, Developers (see [documentation-strategy.md](../documentation-strategy.md), [ROADMAP.md](../../ROADMAP.md)).
- **Docs:** Shared **DocsShell** for `/keys/docs`, `/testing/docs`, `/graph/docs` (collapsible nav, data-driven sidebars—e.g. `[apps/dashboard/src/lib/testing/docs-nav.ts](../../apps/dashboard/src/lib/testing/docs-nav.ts)`, `[apps/dashboard/src/lib/graph/docs-nav.ts](../../apps/dashboard/src/lib/graph/docs-nav.ts)`).
- **Signed-in dashboard:** Single shell under `/keys/dashboard` with **sidebar groups** defined in `[apps/dashboard/src/lib/nav-config.ts](../../apps/dashboard/src/lib/nav-config.ts)`:
  - **Set Up:** Connections, Gateway keys, Restormel Testing, Rules, Guard Rails, Model Catalog
  - **Monitor:** Usage & Analytics, Logs, System Health
  - **Advanced:** Test & Preview, GitHub Setup, Dev Tools

**Rules for new capabilities:**

1. **Do not** add a second top-level nav tree for the same product line; extend **existing** modules, docs nav data, or dashboard groups.
2. **Integrator-only** features may live under **Graph docs → Extensions** (or equivalent) when the audience is embedders; **operator mechanics** belong in the **dashboard** when customers have no custom UI.
3. **Same vocabulary** in docs, dashboard labels, and MCP tool descriptions (Workspace, Project, Gateway Key, Restormel Testing, Rules, Guard Rails, etc.—per documentation-strategy).

### 4.3 Dashboard as default operator UI

For any hosted capability where the customer **does not** build their own UI, provide a **home** in `apps/dashboard` using consistent **regions**:


| Region       | Purpose                                                     |
| ------------ | ----------------------------------------------------------- |
| **Overview** | Summary, health, next steps                                 |
| **Activity** | Recent runs, requests, evals, probes (correlation-friendly) |
| **Detail**   | Single resource inspector                                   |
| **Settings** | Configuration and integrations                              |


Use shared **loading, empty, error, success** states; never expose raw keys in UI or tool output except where a **one-time secret** is explicitly created (and warn in copy). See [security-baseline.md](../security-baseline.md) and [04-ux-safety.mdc](../../.cursor/rules/04-ux-safety.mdc).

**Implementation hook:** New sidebar items typically require updates to `nav-config.ts`, route files under `apps/dashboard/src/routes/keys/dashboard/`, and matching docs in `/keys/docs` or product-specific doc trees.

### 4.4 Design system

Customer-facing dashboard and marketing/docs surfaces use `[@restormel/keys-tokens](../../packages/keys-tokens)` and [docs/design-system-index.md](../design-system-index.md).

### 4.5 Deliverables checklist (ongoing)

- **IA pattern library** — [THEME-L-IA-MATRIX.md](./THEME-L-IA-MATRIX.md) (product × surface, Zuplo, journeys).
- **Dashboard epic template** — [THEME-L-DASHBOARD-EPIC-TEMPLATE.md](./THEME-L-DASHBOARD-EPIC-TEMPLATE.md).
- **Agent–human parity** — [THEME-L-MCP-PARITY.md](./THEME-L-MCP-PARITY.md) (suite tools vs docs/dashboard).

---

## 5. Theme M — Restormel Support Agent (draft horizon bet)

**Status:** **Draft** capability theme for horizon scanning—not a commitment to ship or to a specific vendor. **Theme K** remains unused in this programme (reserved “no Theme K” for blockchain/DLT). **Theme M** is intentionally **separate from the A–J lattice** (it is a **cross-suite experience + packaging** bet, not a single technical primitive like evals or ledger rows).

### 5.1 Intent

A **Restormel Support Agent** is an **in-product guide**: help signed-in (and, later, optionally embedded) users **navigate the suite**, **ground answers in Restormel docs and safe read-only tools**, and **hand off** to human support or issue workflows when appropriate. The **platform market** angle is to **productise the pattern**—not only dogfood on `restormel.dev`—so the same contract, UI kit, and tool policy could be **adopted by other Restormel modules** or offered as a **clear integration story** (e.g. npm package, documented embed, marketplace-facing “Restormel Support Agent” module) aligned with [INTEGRATIONS-FULL-SPEC.md](../integrations/INTEGRATIONS-FULL-SPEC.md) and suite MCP semantics.

### 5.2 Relationship to other themes

- **Theme L:** The **first home** for the agent is the **existing dashboard + site shell** (IA, tokens, DocsShell vocabulary). Theme M **does not** replace L; it **consumes** L’s surfaces and extends the matrix ([THEME-L-IA-MATRIX.md](./THEME-L-IA-MATRIX.md)).
- **Theme I (memory / RAG lane):** Theme M may **later** plug into managed retrieval if Theme I ships; **v1** should stay **thin** (e.g. `docs.search`, fixed indices, optional server-side search) to avoid duplicating a full RAG product before I is chosen.
- **Theme H (MCP manifests):** The agent **orchestrates** existing **Read**-tier tools; new tools should follow **one naming story** (`support.`* only if genuinely new semantics—prefer reusing `docs.search`, `testing.journey`, etc.).
- **Bespoke vs third-party skeleton:** Either implementation can sit behind a **provider boundary** (Restormel-branded UI + policy + auth) so **Inkeep OSS**, **hosted widgets**, or **first-party routes** are interchangeable where licenses and subprocessors allow.

### 5.3 Draft deliverables (when the bet is approved)

- **Dogfood:** Site-wide, session-gated assistant on `apps/dashboard` (see implementation plan in workspace `.cursor/plans/` for the Keys repo slice).
- **Contract:** Documented **HTTP + auth model** (session-only vs future API key), rate limits, and **no-secret** rules consistent with [security-baseline.md](../security-baseline.md).
- **Packaging (platform market):** A **reusable layer**—**[`@restormel/support`](../../packages/support)** (types + server adapter; first host `apps/dashboard`), or a **documented integration template** under [platform/](../../platform/) for non-Keys consumers—so “Restormel Support Agent” is a **named module** in the suite story, not a one-off page.

### 5.4 Canonical owner (when active)

**Owner doc:** [RESTORMEL-SUPPORT.md](./RESTORMEL-SUPPORT.md). Link it from here and from [documentation-strategy.md](../documentation-strategy.md) where the surface is customer-visible. Operational env and dogfood: [runbooks/restormel-support-production.md](../runbooks/restormel-support-production.md). Do not duplicate API specs in this programme file.

---

## 6. Optional programme outputs

- **Disruption one-pager** for stakeholders: category × wedge × incumbent (can be a separate short doc under `docs/restormel/` if needed).
- **Contracts sketch** for a chosen bet (A–J): belongs in `packages/contracts` or a dedicated spec under `docs/requirements/`—link from this file, do not inline large schemas here.

---

## 7. Related links

- [state-sophia-integration.md](./state-sophia-integration.md)
- [PHASE2-EXTRACTION-STATUS.md](./PHASE2-EXTRACTION-STATUS.md)
- [docs/integrations/INTEGRATIONS-FULL-SPEC.md](../integrations/INTEGRATIONS-FULL-SPEC.md)