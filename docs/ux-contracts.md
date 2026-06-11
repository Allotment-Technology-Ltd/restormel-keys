# UX contracts

**Status:** Canonical. Shared navigation, copy, and state conventions across site, docs, dashboard, and embeddable surfaces.

All user-facing surfaces must align with these contracts so the product feels consistent and predictable.

> **Visual system (v2 — Neo-Brutalist):** Product chrome uses the light drafting-paper canvas,
> pure-black `4px` borders, hard `8px 8px 0` block shadows, zero radius, monospace type, and `100ms`
> mechanical press. State styling below maps to the brutalist tokens: error = coral fill + black
> border (`BrutalErrorBanner`), empty = bordered block + recovery CTA (`EmptyState`), loading =
> bordered block with optional skeleton rows (`BrutalLoadingState`). Page headers use
> `BrutalPageHeader` (heavy uppercase H1 + description). See
> [DESIGN-SPECIFICATION.md](DESIGN-SPECIFICATION.md) (Neo-Brutalist v2).

## 1. Navigation model

### Route taxonomy and canonical URLs

| Label / concept   | URL                     | Use everywhere |
|-------------------|-------------------------|----------------|
| Dashboard         | `https://restormel.dev/keys/dashboard`       | Nav, footer, docs, runbooks, CTAs. |
| Sign in           | `https://restormel.dev/keys/dashboard/login` | Auth CTAs, runbooks ("sign in" links). |
| Log out           | `https://restormel.dev/keys/dashboard/logout`| Dashboard only. |
| Docs              | `/keys/docs/`           | Marketing nav, dashboard welcome. |
| Pricing           | `/keys/pricing`         | Marketing nav, dashboard welcome, billing. |
| Keys (product)    | `/keys`                 | Marketing nav, breadcrumbs. |

Site, docs, and dashboard are one app at restormel.dev (dashboard at `/keys/dashboard`). Use the canonical dashboard URLs above in links; no alternate paths or wording (e.g. "Login" vs "Sign in").

### Shell entry points

- **Marketing (site):** Nav links → Keys, Docs, Pricing, GitHub, Dashboard. Footer → same + Dashboard.
- **Docs (in-app):** Sidebar → Overview, Framework compatibility, Cloud API; Product → Dashboard, Sign in.
- **Dashboard:** The authenticated shell has three layers of navigation.

  **Sidebar — primary work destinations (always visible):**

  | Label      | URL                        | Notes |
  |------------|----------------------------|-------|
  | Overview   | `/keys/dashboard/activity` | Workspace home; login lands here. |
  | Connect    | `/keys/dashboard/connect`  | Verified-context hub root; active for all `/connect/**`. |
  | Testing    | `/keys/dashboard/testing`  | Auto-provisioned testing project hub. |

  **Sidebar — collapsible groups:**

  | Group     | Items (label → URL)                                                                               |
  |-----------|---------------------------------------------------------------------------------------------------|
  | Configure | Connections → `/integrations`; Gateway keys → `/access`; Routes → `/routes`; Guard rails → `/policies`; Model catalog → `/models` |
  | Monitor   | Usage → `/analytics`; Logs → `/logs`; Health → `/healthcheck`. Shows "coming soon" placeholder when the monitor flag is off. |
  | More      | Try a request → `/sandbox`; CLI & agents → `/dev-tools`; Graph → `/graph` (hidden when graph module disabled). |

  **Topbar:** Product logo left; page title centre; help links right; **account menu** (avatar) far right — *required; see CTA grammar below. Implemented by stage W1.2.*

  **Connect hub tabs** (visible when on any `/connect/**` route):

  | Tab label      | URL                           | Notes |
  |----------------|-------------------------------|-------|
  | Home           | `/connect`                    | exact-match active; ledger + trust scorecard + quality history. |
  | Library        | `/connect/library`            | Readiness library (domain pack browser). |
  | Ingest routes  | `/connect/models`             | Ingest routes and provider keys. **Canonical tab label.** See §2 registry note on this surface. |
  | Setup          | `/connect/pipeline`           | 4-step onboarding wizard. |
  | Runs           | `/connect/ingest`             | Ingest runs list → individual run console. |
  | Graph          | `/connect/graph`              | Graph explorer: triage queue, tools, schema mapping. |
  | Proof          | `/connect/proof`              | Graph-vs-baseline comparison + provenance drawer. |
  | Agents         | `/connect/mcp`                | MCP / agent wiring (exact-match active). |

  **New surfaces (June 2026):** Trust scorecard and quality history live on the Connect hub Home tab. Readiness library is accessible via the Library tab. These are first-class surfaces, not experimental — they constitute the product's verification spine.

- **Admin shell** (`/keys/admin`): Separate authenticated shell for founders and operators.
  Entry point: topbar link from the Connect hub (shown only to admin-flagged accounts).
  Contains: Founders Circle, User management, Package registry, Quality gates, Ingest quality.
  The admin shell links back to the dashboard via "← Connect hub".

### Topbar titles

Topbar titles are set by `nav-config.ts` `PATH_TO_TITLE` and `topbarTitle()`. Canonical titles:

| Route prefix / path                  | Topbar title          |
|--------------------------------------|-----------------------|
| `/activity`                          | Overview              |
| `/connect` (exact)                   | Connect               |
| `/connect/ingest/**`                 | Connect · Runs        |
| `/connect/pipeline/**`               | Connect · Pipeline    |
| `/connect/graph/**`                  | Connect · Graph       |
| `/connect/mcp/**`                    | Connect · MCP         |
| `/connect/models/**`                 | Connect · Ingest routes |
| `/integrations`                      | Connections           |
| `/access`                            | Gateway keys          |
| `/analytics`                         | Usage                 |
| `/logs`                              | Logs                  |
| `/sandbox`                           | Try a request         |
| `/settings`                          | Profile               |
| `/billing`                           | Subscription          |

> **IA-8 resolution (W1.2):** `/billing` must have a `PATH_TO_TITLE` entry ("Subscription"). Until
> W1.2 merges the topbar is blank on the billing page — this is a known gap tracked in that stage.
> The topbar title for `/connect/models` is "Connect · Ingest routes" (matching the hub tab label
> and this registry). "Connect · Models" is **deprecated** — do not use in new copy.

Shared nav schema: site nav, docs sidebar, and dashboard sidebar use the same canonical URLs above. See [documentation-strategy.md](documentation-strategy.md) and [design-system-index.md](design-system-index.md).

## 2. Copy conventions (content registry)

### Canonical product nouns

Use these terms consistently. Do not invent synonyms in UI or docs.

> **Registry discipline:** Copy PRs must cite the registry line that governs any new or changed
> surface noun or CTA, the same way marketing PRs cite a row in
> [`verified-context-claims-ledger.md`](verified-context-claims-ledger.md). Stage W4.5 will
> enforce this mechanically; build the habit now.

| Term           | Use for | Enforced by |
|----------------|---------|-------------|
| **Gateway Key**      | The credential your app, CLI, or SDK uses to authenticate to Restormel (Cloud API). Created in the dashboard (Access); format `rk_...`. Not the same as a provider credential. | — |
| **Provider credential** | Your OpenAI, Anthropic, Google, or other provider API key. Under **Connections**, stored **encrypted at rest** (hosted key) or as a **non-secret vault reference**; list/API responses are **masked** only. Optional; you can use Gateway Key only or both. | — |
| **Workspace**        | Top-level account boundary; one default workspace per user, created when you sign in. | — |
| **Project**          | Container for Gateway keys, routes, and usage. One per app or product. | — |
| **Environment**      | Dev, staging, prod (or similar) within a project. | — |
| **Provider integration** | A connected provider (OpenAI, Anthropic, etc.) with hosted encrypted key and/or credential reference; managed under **Connections**. Not "Connect a Provider" (that is a verb phrase for a CTA, not a noun for the surface). H1 on `/integrations` detail pages should name the provider, not the category. | W4.5 |
| **Connections**      | The nav label and section heading for `/keys/dashboard/integrations`. Not "Integrations" in UI nav. | W4.5 |
| **Restormel Testing** (dashboard) | Hub at `/keys/dashboard/testing` for the auto-provisioned Testing **project**, environment IDs, and env snippets (with Gateway keys for CLI/CI). | — |
| **Route**            | Per-project/environment: which model(s), fallbacks, and billing mode. | — |
| **Model catalog**    | The suite-wide catalog of canonical models and provider variants at `/keys/dashboard/models`. Not "Models" alone when disambiguating from the Connect surface. | W4.5 |
| **Ingest routes**    | The Connect hub tab at `/connect/models` listing ingest routes and provider keys. **Canonical label: "Ingest routes".** Not "Models & keys" (registry is hereby updated — this was the prior registry term and is now retired; the tab label is ground truth). Not "Models" alone in Connect context. | W1.3, W4.5 |
| **Usage**            | The nav label and page heading for `/analytics`. Not "Usage & Analytics" — the H1 must match the nav label. | W4.5 |
| **Logs & Traces**    | Request-level logs from the gateway. "Logs" is acceptable in nav for brevity; "Logs & Traces" for full headings and docs. | — |
| **Dashboard**        | The app at restormel.dev/keys/dashboard (not "admin" or "portal"). | — |
| **Graph store**      | Where a Connect knowledge graph persists: the workspace Neon database or a connected SurrealDB (Neo4j/Weaviate configs are saved ahead of adapter support). Not "graph database connection" or "target" in UI copy. | — |
| **Domain pack**      | The ontology + prompts + tables that govern how documents become a graph. Not "schema pack" or "ontology pack". | — |
| **Ingest run**       | One execution of the Connect pipeline over selected documents. **Not "job" or "import" in UI copy.** Every surface that says "job", "ingest job", "knowledge ingest job", or "import" must be updated to "Ingest run" / "ingest run" (capitalised as sentence case; plural "Ingest runs"). | W1.3, W4.5 |
| **Trust scorecard**  | The hub-Home component showing the factor-breakdown trust score. Not "trust score panel" or "quality scorecard". One trust number (the scorecard service formula); all other surfaces that show a trust figure must quote this component, not compute their own. | W2.3 |
| **Quality history**  | The verdict timeline on the hub Home tab. Not "eval verdict history" (that is jargon); `aria-label` must use "Quality history". | W2.3, W4.5 |
| **Readiness library**| Domain pack browser at `/connect/library`. Not "library" alone when the context is ambiguous. | — |
| Sign in        | Auth CTA (not "Login", "Log in"). | — |
| Cloud API      | The HTTP API exposed via Zuplo gateway. | — |
| Zuplo gateway  | The gateway that fronts the Cloud API; consumer keys `zpka_...`, backend key is a Gateway Key `rk_...`. | — |
| Restormel Keys | Product name (not "Keys" alone when disambiguation is needed). | — |

### CTA grammar

- **Primary auth:** "Sign in with GitHub" (button/link). Link target: `https://restormel.dev/keys/dashboard/login`.
- **Dashboard entry:** "Dashboard" (link). Target: `https://restormel.dev/keys/dashboard`.
- **Signed-in account menu:** Avatar opens a menu with "Profile & settings", "Subscription", and "Sign out". *Required in the topbar. Implemented by stage W1.2.* The menu must degrade gracefully when plan/entitlement fetch fails — never block sign-out on a failed fetch.
- **After checkout:** "You're sent to the dashboard. Sign in with GitHub if you aren't already."
- **Key handling:** Use privacy-sensitive copy: "your key", "Gateway key"; never expose raw keys in UI or errors. Use masked identifiers (e.g. key prefix or hash) in support/debug text.
- **Sign-in recovery:** Every signed-out state that currently shows a message-only notice must include a "Sign in" button linking to `/keys/dashboard/login`. (Implemented by stage W1.7; eight surfaces identified in UX review A-P1-1.)

### Security and key copy

- In UI and docs: "your key", "Gateway key", "masked in UI", "never logged".
- Same object model terms everywhere: Workspace, Project, Environment, Gateway Key, Provider credential, Provider integration, Route, Model catalog, Usage, Logs (site, docs, dashboard, embed).

## 3. State conventions

Every user-facing flow must define and handle these states where applicable:

| State    | Purpose | Required behavior |
|----------|---------|--------------------|
| **Loading** | Request or transition in progress | Show a loading indicator or skeleton; avoid blank content. |
| **Error**   | Request failed or validation error | Show a clear message and a recovery action (e.g. "Try again", "Sign in", link to docs). Use semantic error styling (`--rm-*` / `--rk-*` error tokens). |
| **Empty**   | No data yet (e.g. no projects) | Explain what's empty and what to do next (e.g. "Create a project", link to Docs). |
| **Success** | Action completed | Confirm briefly (e.g. "Saved", "Key created"); optional toast or inline message. |

**Recovery actions:** Every error and empty state must offer at least one clear next step (button or link). Do not leave the user with only a message.

**Destructive actions:** Require explicit user confirmation before execution (per [.cursor/rules/04-ux-safety.mdc](../.cursor/rules/04-ux-safety.mdc)). Confirmation copy must state the blast radius where applicable (e.g. "Cancel N running runs and delete M finished runs? Run history and quality reports for them are removed.").

## 4. Section pattern (shell rhythm)

One pattern for every major section so the product shares the same rhythm:

- **Marketing and docs:** Section = **section-title** (h2) + optional **section-intro** (p) + content. Spacing: `--space-6` between title and intro, `--space-6` or `--space-8` below intro to content. Use `.section-title` and `.section-intro` (or equivalent) with tokenized margins and `--rm-muted` for intro text.
- **Dashboard:** Page = **page-title** (h1) + **page-desc** (p) + content. Use `BrutalPageHeader` (the canonical primitive — see COMPONENT-INVENTORY.md) for all dashboard page headers. `BrutalPageHeader` renders an uppercase heavy H1 + description line. Avoid locally-defined `.page-title` style blocks; use the shared component. Sub-sections use `.section-title` + `.section-desc` + content with tokenized spacing.

Apply this pattern on all dashboard pages (Overview, Projects, Billing, Settings, project detail, usage) and keep site Keys/Pricing sections aligned. Buttons and cards use `--rm-radius`, `--rm-sage`, `--rm-border`, `--rm-surface-raised` and padding scale `--space-2`, `--space-4`, `--space-6` so they are visually interchangeable across site and dashboard.

## 5. Application

- **Site (Svelte/SvelteKit):** Nav and footer use the navigation model and canonical URLs. Section pattern: `.section-title` + `.section-intro` + content. Pricing and docs use the same links and copy conventions.
- **Dashboard (SvelteKit):** Layout and routes use the same URLs; welcome and error blocks use state conventions and copy registry terms. Section pattern: `BrutalPageHeader` (h1 + desc) and `.section-title` + `.section-desc` for sub-sections, with tokenized spacing.
- **Docs (Svelte):** Sidebar and content use Dashboard/Sign in links and product nouns from the registry.
- **Embeddable components:** KeyManager and other embeddables use the same security/key copy and state patterns (loading/error/empty/success) where applicable.

When adding or changing copy or nav, check this document and [documentation-strategy.md](documentation-strategy.md) for consistency.

---

## Changelog

### Re-baseline — June 2026 (Stage W1.1)

**Sources:** [`docs/reviews/dashboard-ux-review-2026-06.md`](reviews/dashboard-ux-review-2026-06.md) (findings IA-2, IA-8, F-P1-3) and [`docs/reviews/dashboard-functionality-review-2026-06.md`](reviews/dashboard-functionality-review-2026-06.md).

**Summary of changes:**

- **§1 navigation model rewritten** to match the shipped IA (UX IA-2). The prior §1 described a stale sidebar structure ("Set Up / Monitor / Advanced / Overview / Profile") with no Connect hub, no admin shell, and no account menu. The new §1 documents the actual `Work / Configure / Monitor / More` sidebar, the full Connect hub tab strip (Home · Library · Ingest routes · Setup · Runs · Graph · Proof · Agents), the `/keys/admin` operator shell, and the new surfaces (trust scorecard, quality history, readiness library).

- **Topbar title table added** to §1 (UX IA-8). `/billing` is registered as "Subscription" — the blank topbar on the billing page is a known gap closed by W1.2. The deprecated "Connect · Models" title is replaced with "Connect · Ingest routes".

- **§2 registry: "Ingest run" is already correct.** The registry has mandated "Ingest run" (not "job") since the prior version. The C-P1-1 drift (runs surfaces saying "Ingest jobs") is a *code* gap addressed by stage W1.3, which cites this line.

- **§2 registry: "Ingest routes" is the canonical tab label** for `/connect/models` (UX IA-8). The prior registry entry "Models & keys" is retired. Rationale: the hub tab label (`dashboard-hub-nav.ts:15`) is what users see and say — the registry must match it. Topbar "Connect · Models" is deprecated; new entries use "Connect · Ingest routes".

- **§2 registry: "Provider integration" vs "Connections"** (UX F-P1-3). "Provider integration" is the noun for a single connected provider record. "Connections" is the nav label and section heading. The H1 on `/integrations` must not say "Connect a Provider" (verb phrase, wrong register for a section heading); use the provider name or "Provider integrations" as appropriate. *Enforced by W4.5.*

- **§2 registry: "Usage"** (UX F-P1-3). The page H1 on `/analytics` must match the nav label "Usage", not "Usage & Analytics". *Enforced by W4.5.*

- **§2 registry: new surfaces added** — Trust scorecard, Quality history, Readiness library — with canonical names and non-use synonyms.

- **§2 registry: registry-discipline note added** — copy PRs cite registry lines (mirrors claims-ledger discipline for marketing PRs).

- **§2 CTA grammar: sign-in recovery action added** — every signed-out message-only notice requires a "Sign in" button. Eight surfaces are identified in UX A-P1-1; W1.7 implements them.

- **§3 state conventions: destructive-action blast-radius language** clarified (supporting W1.3).

- **§4 section pattern:** `BrutalPageHeader` named as the canonical primitive for dashboard page headers (aligning with the review's finding that it is used in only one place currently; W4.4/W4.5 sweeps will enforce it).

**What this document intentionally does NOT fix:** The nav gaps (no account menu, orphaned `/billing` and `/settings`, no sign-out) are *code* gaps. This contract records the TARGET state and names the stages that implement each piece. Code gaps are tracked in the roadmap, not here.
