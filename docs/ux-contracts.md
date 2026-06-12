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

> **R1 NOTE — TARGET IA vs SHIPPED STATE.** This section records both what is shipped today (W1.x
> baseline, "Shipped" column) and the approved target IA from the north-star redesign
> (`docs/design/keys-northstar-redesign-2026-06.md`, all ten product decisions D1–D10 approved
> 2026-06-12). Columns marked **R2 / R3 / …** are the Wave R stage that implements each piece.
> R2 owns all route moves and redirects; a parallel R2 agent must not modify this file.

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
- **Dashboard:** The authenticated shell. The target IA has two zones (Work + Foundation/Observe) and no hub tab strip.

#### Sidebar — Work zone (six sections)

Six sections read top-to-bottom as the product loop. **Shipped** = state after W1.x + W2.1; **Target** = the approved north-star IA (D1 approved); implementation stage listed.

| Label       | Target URL    | Shipped URL / state                   | Status → Stage |
|-------------|---------------|---------------------------------------|----------------|
| **Home**    | `/home`       | `/activity` (Overview) + `/connect` (two separate homes) | Target: R3 — merges both |
| **Sources** | `/sources`    | No top-level equivalent; content at `/connect/library` + `/connect/pipeline` | R4 |
| **Runs**    | `/runs`       | `/connect/ingest`                     | R2 (move) |
| **Claims**  | `/claims`     | `/connect/graph` — *"Claims", not "Graph": D2 approved; see §2 registry* | R2 (move + rename) |
| **Prove**   | `/prove`      | `/connect/proof` + `/access/audit` (split) | R5 (assemble) |
| **Agents**  | `/agents`     | `/connect/mcp` + `/dev-tools/**` (split) | R5 (assemble) |
| **Testing** | `/testing`    | `/testing` — **unchanged (W3.8 landed)** | Shipped — KEEP |

Sidebar badge/pulse affordances (target):
- Claims: review-count badge (was: Graph tab badge, W2.1 — relocates in R2).
- Runs: live pulse dot when any run is active.
- Live-run chip in topbar: `● INGEST 62% · 2:41` when active; links to `/runs/[id]`; stall turns amber. Implemented in R6.

#### Sidebar — Foundation group (collapsed by default)

Contains the Keys infrastructure surfaces. Always reachable; never the story. Each surface is reached day-to-day via readiness-ledger fix links and exits via the returnTo bar.

| Label            | Target URL      | Shipped URL / state                          | Status → Stage |
|------------------|-----------------|----------------------------------------------|----------------|
| Connections      | `/integrations` | `/integrations` (Configure group)            | Shipped — label unchanged |
| Gateway keys     | `/access`       | `/access` (Configure group)                  | Shipped — group renamed in R2 |
| Routes           | `/routes`       | `/routes` (Configure group) — gains Ingestion view from `/connect/models` | R5 (view added) |
| Guard rails      | `/policies`     | `/policies` (Configure group)                | Shipped — group renamed in R2 |
| Projects         | `/projects`     | `/projects` — no nav entry today (orphan)    | R2 (gains nav entry) |
| Model catalog    | `/models`       | `/models` (Configure group)                  | Shipped — group renamed in R2 |
| Request tester   | `/sandbox`      | `/sandbox` (More group; label "Try a request") | R2 (label change + group move) |

#### Sidebar — Observe group (collapsed by default)

| Label   | Target URL    | Shipped URL / state        | Status → Stage |
|---------|---------------|----------------------------|----------------|
| Logs    | `/logs`       | `/logs` (Monitor group)    | Shipped — group renamed in R2 |
| Usage   | `/analytics`  | `/analytics` (Monitor group) | Shipped — group renamed in R2 |
| Health  | `/healthcheck`| `/healthcheck` (Monitor group) | Shipped — group renamed in R2 |

#### Connect hub tabs — DEPRECATED in target IA (D1 approved)

The Connect hub tab strip dissolves in R2. These tabs are documented here as the shipped state only; do not add new Connect hub tabs. Each tab's content survives at its new canonical location.

| Shipped tab label | Shipped URL         | Target location | Stage |
|-------------------|---------------------|-----------------|-------|
| Home              | `/connect`          | Merges into `/home` | R3 |
| Library           | `/connect/library`  | `/sources` (Packs view) | R4 |
| Ingest routes     | `/connect/models`   | `/routes` (Ingestion view) | R5 |
| Setup             | `/connect/pipeline` | `/sources/ingest` (guided flow) | R4 |
| Runs              | `/connect/ingest`   | `/runs` | R2 |
| Graph             | `/connect/graph`    | `/claims` | R2 |
| Proof             | `/connect/proof`    | `/prove` (Proof tab) | R5 |
| Agents            | `/connect/mcp`      | `/agents` (Wiring tab) | R5 |

**Admin shell** (`/keys/admin`): Unchanged. Separate authenticated shell for founders and operators. Entry: account menu (W1.2, shipped). Contains: Founders Circle, User management, Package registry, Quality gates, Ingest quality. Links back via "← Dashboard".

### Topbar titles

Topbar titles are set by `nav-config.ts` `PATH_TO_TITLE` and `topbarTitle()`.

**Shipped titles** (W1.x baseline, to remain until R2 renames them):

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

**Target titles** (R2 implements; R3/R5 add the new sections):

| Route prefix / path                  | Target topbar title   | Stage |
|--------------------------------------|-----------------------|-------|
| `/home`                              | Home                  | R3 |
| `/sources`                           | Sources               | R4 |
| `/sources/ingest/**`                 | Sources · Ingest      | R4 |
| `/runs`                              | Runs                  | R2 |
| `/runs/[id]`                         | Runs · Console        | R2 |
| `/claims`                            | Claims                | R2 |
| `/claims/memory`                     | Claims · Memory       | R2 |
| `/prove`                             | Prove                 | R5 |
| `/agents`                            | Agents                | R5 |
| `/integrations`                      | Connections           | Shipped |
| `/access`                            | Gateway keys          | Shipped |
| `/routes`                            | Routes                | Shipped |
| `/policies`                          | Guard rails           | R2 (label) |
| `/projects`                          | Projects              | R2 |
| `/models`                            | Model catalog         | Shipped |
| `/sandbox`                           | Request tester        | R2 (label) |
| `/analytics`                         | Usage                 | Shipped |
| `/logs`                              | Logs                  | Shipped |
| `/healthcheck`                       | Health                | R2 (label) |
| `/settings`                          | Profile               | Shipped |
| `/billing`                           | Subscription          | Shipped |

> **IA-8 resolution (W1.2):** `/billing` has a `PATH_TO_TITLE` entry ("Subscription"). The topbar
> title for the former `/connect/models` was "Connect · Ingest routes" (canonical); with R2 that
> content moves to `/routes` (Ingestion view) and the title becomes "Routes". "Connect · Models"
> is **deprecated** — do not use in any copy. "Connect · Graph" is **deprecated** — target title
> is "Claims" (D2 approved; see §2 registry).

Shared nav schema: site nav, docs sidebar, and dashboard sidebar use the same canonical URLs above. See [documentation-strategy.md](documentation-strategy.md) and [design-system-index.md](design-system-index.md).

## 2. Copy conventions (content registry)

### Canonical product nouns

Use these terms consistently. Do not invent synonyms in UI or docs.

> **Registry discipline:** Copy PRs must cite the registry line that governs any new or changed
> surface noun or CTA, the same way marketing PRs cite a row in
> [`verified-context-claims-ledger.md`](verified-context-claims-ledger.md). Stage W4.5 will
> enforce this mechanically; build the habit now.

> **R1 NOTE — new nouns (approved 2026-06-12):** The rows marked **[R1]** were added or updated by
> Stage R1 following the north-star redesign decisions D1–D10. For decision D2 specifically: the
> explorer section is **"Claims"** (not "Graph"). See the D2 entry below.

| Term           | Use for | Enforced by |
|----------------|---------|-------------|
| **Gateway Key**      | The credential your app, CLI, or SDK uses to authenticate to Restormel (Cloud API). Created in the dashboard (Gateway keys); format `rk_...`. Not the same as a provider credential. | — |
| **Provider credential** | Your OpenAI, Anthropic, Google, or other provider API key. Under **Connections**, stored **encrypted at rest** (hosted key) or as a **non-secret vault reference**; list/API responses are **masked** only. Optional; you can use Gateway Key only or both. | — |
| **Workspace**        | Top-level account boundary; one default workspace per user, created when you sign in. | — |
| **Project**          | Container for Gateway keys, routes, and usage. One per app or product. | — |
| **Environment**      | Dev, staging, prod (or similar) within a project. | — |
| **Provider integration** | A connected provider (OpenAI, Anthropic, etc.) with hosted encrypted key and/or credential reference; managed under **Connections**. Not "Connect a Provider" (that is a verb phrase for a CTA, not a noun for the surface). H1 on `/integrations` detail pages should name the provider, not the category. | W4.5 |
| **Connections**      | The nav label and section heading for `/keys/dashboard/integrations` (Foundation group). Not "Integrations" in UI nav. | W4.5 |
| **Restormel Testing** (dashboard) | Hub at `/keys/dashboard/testing` for the auto-provisioned Testing **project**, environment IDs, and env snippets (with Gateway keys for CLI/CI). | — |
| **Route**            | Per-project/environment: which model(s), fallbacks, and billing mode. | — |
| **Model catalog**    | The suite-wide catalog of canonical models and provider variants at `/keys/dashboard/models`. Not "Models" alone when disambiguating from the Connect surface. | W4.5 |
| **Ingest routes**    | The view within Foundation › Routes (`/routes`, Ingestion view) listing ingest routes and provider keys. **Canonical label: "Ingest routes".** Not "Models & keys" (retired). Not "Models" alone in Connect context. In the shipped state this was the Connect hub tab at `/connect/models`; that URL moves in R2. | W1.3, W4.5 |
| **Usage**            | The nav label and page heading for `/analytics`. Not "Usage & Analytics" — the H1 must match the nav label. | W4.5 |
| **Logs & Traces**    | Request-level logs from the gateway. "Logs" is acceptable in nav for brevity; "Logs & Traces" for full headings and docs. | — |
| **Dashboard**        | The app at restormel.dev/keys/dashboard (not "admin" or "portal"). | — |
| **Graph store**      | Where a Connect knowledge graph persists: the workspace Neon database or a connected SurrealDB (Neo4j/Weaviate configs are saved ahead of adapter support). Not "graph database connection" or "target" in UI copy. | — |
| **Domain pack**      | The ontology + prompts + tables that govern how documents become a graph. Not "schema pack" or "ontology pack". | — |
| **Ingest run**       | One execution of the Connect pipeline over selected documents. **Not "job" or "import" in UI copy.** Every surface that says "job", "ingest job", "knowledge ingest job", or "import" must be updated to "Ingest run" / "ingest run" (capitalised as sentence case; plural "Ingest runs"). | W1.3, W4.5 |
| **Trust scorecard**  | The component showing the factor-breakdown trust score. Not "trust score panel" or "quality scorecard". One trust number (the scorecard service formula); all other surfaces that show a trust figure must quote this component, not compute their own. Mounted on the Home masthead in the target IA (W2.3 + R3). | W2.3 |
| **Quality history**  | The verdict timeline. Not "eval verdict history" (that is jargon); `aria-label` must use "Quality history". | W2.3, W4.5 |
| **Evidence dossier** | The Claims section claim detail panel (W2.2): verdict stamp, evidence excerpt with the bound span highlighted, chain of custody, "Re-check now", claim-versions ledger. Not "evidence panel" or "claim inspector". Verification-state copy must match the EBV states (supported / inferred / unverified / contradicted / excluded) and may only assert what claims-ledger rows 2, 9, 10 prove. | W2.2 |
| **Evidence facet**   | The Claims queue filter over EBV verification states (`?filter=supported` etc. — the W2.1 URL contract values, which survive the `/connect/graph` → `/claims` redirect). A claim with no EBV row reads "predates evidence binding", never silently bucketed into a state. | W2.2 |
| **[R1] Home**        | The merged workspace landing page at `/home`. Replaces both `/activity` (Overview) and `/connect` (Connect hub home). Not "Overview", not "Connect home". The product loop starts here. Implemented by R3. | R1 |
| **[R1] Sources**     | The section at `/sources` for documents, domain packs, and changed-source state. Not "Library" (that was the pack browser tab label; "Packs" is the sub-view name). The primary CTA "Ingest" launches the guided flow. Implemented by R4. | R1 |
| **[R1] Runs**        | The section at `/runs` for the ingest runs list and individual run console. Replaces "Connect · Runs" (the shipped hub tab label for `/connect/ingest`). Not "Ingest" as a section label (that is the CTA verb). | R1 |
| **[R1] Claims**      | The section at `/claims` for the explorer: review desk, evidence dossiers, memory inbox, as-of. **Decision D2 (approved 2026-06-12): "Claims", not "Graph".** Three reasons: (a) `/keys/dashboard/graph` is taken by the Restormel Graph module stub — real URL collision; (b) the operator's unit of work is a claim; (c) the entire verification vocabulary already uses "claims". Non-use synonyms: do NOT use "Graph", "Knowledge graph explorer", or "Graph explorer" as a section label in nav, copy, or docs — "Claims" is the canonical term. The underlying storage is still a graph; "graph store" (for the database noun) remains correct. | R1 |
| **[R1] Prove**       | The section at `/prove` for: the graph-vs-baseline proof surface (Proof tab), trace browser (Traces tab), audit log (Audit tab — moved from `/access/audit`, D5 approved), and the public scorecard Share tab (D7 approved). Not "Proof" as a section label (that is one tab within Prove). Claim: an audit log is a proof artefact, not a key-management appendix. | R1 |
| **[R1] Agents**      | The section at `/agents` for MCP/agent wiring, agent gateway keys, and CLI/MCP/AAIF catalogs. Merges `/connect/mcp` + `/dev-tools/**`. Not "CLI & agents" (shipped More-group label; retired in R2). | R1 |
| **[R1] Foundation**  | The collapsed sidebar group containing: Connections, Gateway keys, Routes, Guard rails, Projects, Model catalog, Request tester. Not "Configure" (shipped group label; retired in R2). The Keys surfaces kneel to the work sections — reachable via nav or ledger fix links, never the primary story. | R1 |
| **[R1] Request tester** | The surface at `/sandbox`. Not "Try a request" (shipped More-group label; retired in R2). Workspace mode (W3.2) builds here; Agents links to it. | R1 |
| **Readiness library**| Domain pack browser — shipped as `/connect/library`; moves to `/sources` (Packs view) in R4. Not "library" alone when the context is ambiguous. | — |
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

### §3 panel states — Home masthead (`/home`, Stage R3)

The one Home is a masthead of streamed panels. Each panel below defines its four states; the
trust number is quoted from the scorecard service (never recomputed), and a missing measurement
renders an explicit absent-state, never a fabricated `0`.

| Panel | Loading | Empty | Error | Populated |
|-------|---------|-------|-------|-----------|
| **Trust cap** | Skeleton via `BrutalLoadingState` inside a `role="status"` region | No graph yet → `EmptyState` "No verified context yet" + "Start your first ingest run" CTA | `BrutalErrorBanner` ("Trust scorecard unavailable") with **Try again** + **Check graph store** — the masthead numeral is never silently swallowed | Oversized numeral (quotes the scorecard service) + `TrustSparkline` + "last verified"; the capped `Trust scorecard` factor rails render below as the receipts |
| **Trust sparkline** | (resolves with the cap's `qualityHistory`) | < 2 scored verdicts → "no history yet" text, no flat line | (shares the cap error) | 20-verdict polyline, `role="img"` + `aria-label` trend text + visible mono caption |
| **Ready to verify** (K4 readiness ledger) | `ConnectPageSkeleton` (hub) | First-run → the **unlit** ledger rows ARE the checklist (one fix per row, no separate onboarding widget) | `ConnectVerifiedReadiness` error banner with **Try again** + **Open launch preflight** | Lit/partly-lit rows: `{status, evidence, fixHref}`, square glyph + status word, mono evidence, right-aligned fix link |
| **Inbox** | (resolves with `scorecard` + `qualityHistory`) | No graph → "no graph yet — nothing to review"; no verdicts → "no verdicts recorded yet"; clean → "clear" | (panel rows degrade to absent-state honestly) | Review count → `/claims?filter=review`; latest regression → run diff; memory inbox → `/claims/memory` (pending count **deferred** — link only, no fabricated count) |
| **Runs rail** | (resolves with `hub`) | No run → "no ingest run yet" + "ingest →" CTA | (shares the hub error banner) | Last-run glyph + outcome word + age, → `/runs/[id]`; W3.6 changed-source chip is a comment-marked mount point until the load can answer "changed since last run" |
| **Agent traffic** | (resolves with `livePulse`) | 0 requests → "0 gateway requests" | analytics unavailable → "analytics unavailable — count not measured" (no fabricated count) | Answers-served · 24h count → `/logs?source=agent` |

`/activity` and `/connect` 308-redirect to `/home` (see §A); login lands on `/home`. The page adds
no new stats query — every value is read from the streamed load (Pivot Stage 1.8).

### §3 shell-element states — Shell v2 (Stage R6)

The three shell upgrades from §3.2 (`docs/design/keys-northstar-redesign-2026-06.md`) define their
states below. The live-run chip is fed by ONE workspace-scoped poll (30s) until W3.1's SSE lands;
the chip poll adds no stats/scorecard fetches (poll diet, PR #259).

| Element | Loading / idle | Empty / zero | Stalled / error | Active / populated |
|---------|----------------|--------------|-----------------|--------------------|
| **Live-run chip** (`LiveRunChip`, topbar, any page) | Before the first poll resolves the chip is simply absent (no skeleton in the topbar) | No active ingest run → chip is **not rendered** (never an empty shell, so topbar a11y is untouched) | Active run with a stale worker heartbeat or expired lease (the W1.4 model) → amber chip, label flips to `STALLED`, dot stops pulsing; `aria-label` says "stalled"; still links to `/runs/[id]` | `● INGEST 62% · 2:41` mono chip, pulsing dot (static under `prefers-reduced-motion`), informative `aria-label`, links to `/runs/[id]?from=chip` |
| **DossierRail** (`DossierRail`, shared right rail) | Consumer renders its own loading/empty inside the rail body (reuse `BrutalLoadingState` / `EmptyState`) | Consumer renders `EmptyState` in the body; the rail chrome always renders the title + close | Consumer renders `BrutalErrorBanner` in the body | 420px hard-bordered drawer with offset shadow; `role="dialog"` + `aria-modal` + `aria-labelledby`; Escape closes, focus is trapped, focus returns to the opener; first consumer = the Runs-list quick-peek (`RunQuickPeek`) |
| **Mobile read-only tier** (layout gate) | n/a | n/a | Off-tier path on a phone → the honest gate ("This screen needs a bigger window") naming the two readable destinations (Home, Claims) and the individual run (as plain text — `/runs` the list is itself gated, so it is **not** a link), no disabled-and-teasing actions | `/home`, `/runs/[id]`, `/claims` open read-only on a phone: sidebar hidden, full-bleed, ≥44px touch targets, mutating actions hidden. The shell carries `data-mobile-readonly="true"` and its `.shell-mobile-readonly` rule hides every audited mutation region across all three surfaces. **`/claims` explorer + readiness wizard + library:** `.review-actions`, `.dossier-actions`, `.dossier-recheck`, `.remove-section`, `.cohort-complete-actions`, `.revalidate-actions`, `.wizard-actions`, `.lib-new` (library "New run" create), `.lib-run-archive` (library archive). **`/runs/[id]` ingest console:** `.run-actions` (header restart), `.run-cancel-wrap` (cancel), `.run-error-banner-actions` (failed-run banner restart). **`/home`:** `.switcher-control` (active-graph `POST /activate`). Plus the generic `[data-mobile-hide]` opt-out. **Keyboard:** the verdict shortcuts (`a`/`w`/`u` → `performReview`, a PATCH) bypass CSS hiding, so `ConnectGraphExplorer.handleReviewKeydown` early-returns when a `[data-mobile-readonly="true"]` shell is in the DOM; the read-only navigation keys (`n`/`p`/arrows) stay live. Read-only viewing (pan/zoom/select/inspect, glossary, provenance, recheck *results*, dossier history, guidance/coaching, the library run-select scope switch) stays live. Guarded by `dashboard-mobile-readonly-claims.test.ts`: each selector ⇄ each selector still exists as a real action region, the keyboard guard is asserted, and a per-component mutation-fetch inventory trips when a new `POST/PATCH/PUT/DELETE` region appears un-audited. |

The Evidence Dossier (W2.2) is the eventual DossierRail consumer for Claims; R6 ships the rail + the
Runs quick-peek as its one live consumer, and the three bespoke drawers (explorer detail panel, logs
drawer, proof provenance drawer) migrate onto the rail under W4.4.

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

### Evidence Dossier — June 2026 (Stage W2.2)

- **§2 registry: "Evidence dossier" and "Evidence facet" added.** The graph explorer's
  claim detail panel and verification-state queue filter get canonical names. Dossier
  copy is bound to claims-ledger rows 2 ("supported requires a bound span"), 9
  ("re-check fails closed") and 10 ("uncertainty goes to review"); a claim with no
  EBV row must read "predates evidence binding", never be bucketed into a state.

### IA decision record + re-baseline v2 — June 2026 (Stage R1)

**Source:** [`docs/design/keys-northstar-redesign-2026-06.md`](design/keys-northstar-redesign-2026-06.md) — all ten product decisions D1–D10 approved 2026-06-12. This re-baseline records those decisions as contracts and provides the redirect map R2 implements.

**Summary of changes:**

- **§1 navigation model rewritten to the TARGET IA (D1 approved: dissolve the Connect hub).**
  The section now carries a "shipped vs target (R2/R3/…)" status column per surface.
  The six target work sections (Home, Sources, Runs, Claims, Prove, Agents), two collapsed groups
  (Foundation, Observe), and Testing are documented alongside their shipped equivalents and the
  Wave R stage that delivers each. The Connect hub tab strip is marked DEPRECATED in target IA —
  do not add new Connect hub tabs.

- **§1 topbar title table split into "shipped" and "target" tables.** Target titles added for
  every new section and relocated surface. "Connect · Graph" deprecated — target is "Claims"
  (D2 approved). "Connect · Models" remains deprecated (carried from W1.1).

- **§2 registry: eight new canonical nouns added (all [R1] tagged):** Home, Sources, Runs,
  Claims, Prove, Agents, Foundation, Request tester. Each entry records non-use synonyms
  explicitly — for example: "Claims" is the canonical term; do NOT use "Graph", "Knowledge graph
  explorer", or "Graph explorer" as a section label.

- **§2 registry: Decision D2 recorded.** The explorer section is **"Claims"** (`/claims`), not
  "Graph". Three-reason justification: URL collision with the Restormel Graph module stub;
  "claim" is the operator's unit of work; the entire verification vocabulary already uses
  "claims". Registry entry for Claims includes the full non-use list.

- **Redirect-map appendix added (§A).** Every route in disposition §2.3 of the redesign doc is
  listed with disposition, old URL, target URL, query-param preservation notes, and the
  implementing stage. This is the contract R2 implements.

- **Roadmap amended** (in `docs/dashboard-world-class-roadmap.md`): re-scope notes for K4
  (one mount: Home masthead), W3.6 (chip mounts: Home + Runs), W4.6 (mobile folds into R6),
  W2.3 (mount: Home masthead) — each with a changelog block citing this redesign doc.

---

## A. Redirect map — R2 implementation contract

> **This appendix is the contract R2 implements.** Every row must be covered by a redirect
> in R2 (308 permanent). Query-param preservation is an explicit acceptance criterion for R2;
> rows marked "params preserved" must carry those params through the redirect. Do not modify
> this appendix except via a follow-on R-stage changelog entry.
>
> Legend: **KEEP** (survives in place) · **MOVE** (same page, new URL, permanent redirect) ·
> **MERGE-INTO** (content absorbed, route 308s) · **REDESIGN** (page rebuilt, URL changes) ·
> **KILL** (deleted; redirect only where there are known external links).

| Old route | Disposition | Target route | Query params preserved | Notes | Stage |
|-----------|-------------|--------------|------------------------|-------|-------|
| `/keys/dashboard` (→ `/activity`) | REDESIGN | `/home` | — | Login now lands on `/home` (R3); until R3, keeps landing on `/activity` | R3 |
| `/activity` | MERGE-INTO | `/home` | — | W2.6 (in flight) is the down payment; R3 completes the merge and fires the 308 | R3 |
| `/connect` (hub home) | MERGE-INTO | `/home` | — | Fires the 308 only when R3 merges | R3 |
| `/connect/library` | MERGE-INTO | `/sources` (Packs view) | — | A pack is chosen per ingest; belongs with Sources | R4 |
| `/connect/models` | MOVE | `/routes` (Ingestion view) | — | Day-to-day reach via ledger fix links; "Ingest routes" label survives as the view name inside Routes | R5 |
| `/connect/pipeline` | REDESIGN | `/sources/ingest` (guided flow) | `?step` | Wizard reborn as a guided flow; `?step` preserved by redirect mapping to new panel ids | R4 |
| `/connect/pipeline?step=*` | REDESIGN | `/sources/ingest?step=*` | `?step` | Each wizard step id maps to a flow panel id (R4 defines the mapping) | R4 |
| `/connect/ingest` | MOVE | `/runs` | — | Runs list; page intact post-W1.3 | R2 |
| `/connect/ingest/[jobId]` | MOVE | `/runs/[id]` | — | Run console; intact post-W1.4; W3.1/W4.1 land here | R2 |
| `/connect/ingest/new` | KILL | — | — | Zero inbound links; duplicates the flow. Decision D8 approved. | R2 |
| `/connect/graph` | MOVE | `/claims` | `?filter`, `?unit`, `?workspace`, `?focus` | W2.1 URL contract: `?filter` and `?unit` survive the redirect (explicit R2 acceptance criterion — redirect unit test required). Explorer intact. | R2 |
| `/connect/proof` | MOVE | `/prove` (Proof tab) | — | Joined by traces + audit + share in R5 | R5 |
| `/connect/mcp` | MOVE | `/agents` (Wiring tab) | — | Agent setup intact incl. key handoff | R5 |
| `/connect/memory` *(W2.4 in flight)* | MOVE | `/claims/memory` | — | Memory inbox lands per its spec, then relocates here (nav entry only — it is a component) | R2 |
| `/testing` | KEEP | `/testing` | — | W3.8 landed here — unchanged | Shipped |
| `/integrations` | KEEP | Foundation › Connections | — | K2/K6 land here unchanged | Shipped |
| `/integrations/[id]` | KEEP | Foundation › Connections | — | K2/K6 land here unchanged | Shipped |
| `/access` | KEEP | Foundation › Gateway keys | — | K1 lands here; deep link from Prove to audit preserved | Shipped |
| `/access/audit` | MOVE | `/prove` (Audit tab) | — | Audit log is a proof artefact (journey C). Deep link kept from `/access`. D5 approved. | R5 |
| `/routes` | KEEP | Foundation › Routes | — | Gains Ingestion view from `/connect/models` in R5 | R5 (view) |
| `/projects` | KEEP | Foundation › Projects | — | Projects finally gets a nav entry (R2) | R2 (nav) |
| `/projects/[id]` | KEEP | Foundation › Projects | — | — | Shipped |
| `/projects/[id]/routes` | KEEP | Foundation › Projects | — | W1.5 shipped; W3.5 lands here | Shipped |
| `/projects/[id]/routes/[routeId]` | KEEP | Foundation › Projects | — | Route builder unchanged | Shipped |
| `/projects/[id]/usage` | KILL | `/analytics?project=` | `?project` | Stub that links to Analytics anyway. D8 approved. | R2 |
| `/policies` | KEEP | Foundation › Guard rails | — | — | Shipped |
| `/policies/[id]` | KEEP | Foundation › Guard rails | — | — | Shipped |
| `/models` | KEEP | Foundation › Model catalog | — | — | Shipped |
| `/models/[id]` | KEEP | Foundation › Model catalog | — | — | Shipped |
| `/lifecycle` | KILL | — | — | Honest stub, unlinked; restore when product exists. D8 approved. | R2 |
| `/analytics` | KEEP | Observe › Usage | — | Mock-fallback fix stays in W4.7 | Shipped |
| `/logs` | KEEP | Observe › Logs | — | W3.3 + K5 source tag land here | Shipped |
| `/healthcheck` | KEEP | Observe › Health | — | — | Shipped |
| `/sandbox` | MOVE (label only) | Foundation › Request tester | — | URL stays `/sandbox`; label changes to "Request tester" in R2; W3.2 builds workspace mode | R2 (label) |
| `/dev-tools` | MERGE-INTO | `/agents` (Catalogs tab) | — | CLI & agents was always consumption-wiring; W2.4's MCP catalog mounts here | R5 |
| `/dev-tools/aaif` | MERGE-INTO | `/agents` (Catalogs tab) | — | See above | R5 |
| `/dev-tools/cli` | MERGE-INTO | `/agents` (Catalogs tab) | — | See above | R5 |
| `/dev-tools/mcp` | MERGE-INTO | `/agents` (Catalogs tab) | — | See above | R5 |
| `/copy-for-ci` | KEEP | Testing hub tab | — | — | Shipped |
| `/copy-for-cli` | KEEP | redirect (already is) | — | — | Shipped |
| `/cli/connect` | KEEP | out-of-nav functional page | — | Device-code approval | Shipped |
| `/graph` (Restormel Graph stub) | KILL (from nav) | route may remain as placeholder | — | Leaves the sidebar until Phase 6 ships; frees the "graph" mental slot for Claims. D8 approved. | R2 (nav only) |
| `/settings` | KEEP | account menu | — | — | Shipped |
| `/billing` | KEEP | account menu | — | W1.6 shipped | Shipped |
| `/login`, `/logout` | KEEP | — | — | — | Shipped |
| `/admin`, `/admin/users`, `/admin/package-registry` (legacy 301s) | KILL | — | — | The 301 targets are stable; one release of grace then delete. D8 approved. | R2 |
| `/keys/admin/*` (5 consoles) | KEEP | separate admin shell | — | Unchanged | Shipped |
| `/prototype/brutalist-dashboard` | KILL | — | — | Confirms W4.7. D8 approved. | R2 |
