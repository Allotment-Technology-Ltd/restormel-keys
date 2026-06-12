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
| **As-of view**       | The Claims time-travel control + historical-view banner (W2.5): "View as of &lt;date&gt;". Verb is "View as of" / "Return to now"; not "time machine", "snapshot", or "rewind". A read-only view (mutations hidden, "editing past state is not possible"). When the store cannot reconstruct history the banner reads "History not available for this graph" — never the live view passed off as historical. `?as_of` / `?audit` URL params. | W2.5 |
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
| **Mobile read-only tier** (layout gate) | n/a | n/a | Off-tier path on a phone → the honest gate ("This screen needs a bigger window") naming the two readable destinations (Home, Claims) and the individual run (as plain text — `/runs` the list is itself gated, so it is **not** a link), no disabled-and-teasing actions | `/home`, `/runs/[id]`, `/claims` (and its sub-routes including `/claims/memory`) open read-only on a phone: sidebar hidden, full-bleed, ≥44px touch targets, mutating actions hidden. The shell carries `data-mobile-readonly="true"` and its `.shell-mobile-readonly` rule hides every audited mutation region across all four surfaces. **`/claims` explorer + readiness wizard + library:** `.review-actions`, `.dossier-actions`, `.dossier-recheck`, `.remove-section`, `.cohort-complete-actions`, `.revalidate-actions`, `.wizard-actions`, `.lib-new` (library "New run" create), `.lib-run-archive` (library archive). **`/claims/memory` memory inbox:** `.item-actions` (per-observation Revoke button, `POST /revoke`), `.memory-revoke-error` (per-observation revoke-error banner + "Try again" which re-fires `POST /revoke`; the outer page-load error banner's "Try again" calls `invalidateAll` and is intentionally NOT hidden). **`/runs/[id]` ingest console:** `.run-actions` (header restart), `.run-cancel-wrap` (cancel), `.run-error-banner-actions` (failed-run banner restart). **`/home`:** `.switcher-control` (active-graph `POST /activate`). Plus the generic `[data-mobile-hide]` opt-out. **Keyboard:** the verdict shortcuts (`a`/`w`/`u` → `performReview`, a PATCH) bypass CSS hiding, so `ConnectGraphExplorer.handleReviewKeydown` early-returns when a `[data-mobile-readonly="true"]` shell is in the DOM; the read-only navigation keys (`n`/`p`/arrows) stay live. Read-only viewing (pan/zoom/select/inspect, glossary, provenance, recheck *results*, dossier history, guidance/coaching, the library run-select scope switch) stays live. Guarded by `dashboard-mobile-readonly-claims.test.ts`: each selector ⇄ each selector still exists as a real action region, the keyboard guard is asserted, and a per-component mutation-fetch inventory trips when a new `POST/PATCH/PUT/DELETE` region appears un-audited (memory page pinned at 1 mutation fetch). |

The Evidence Dossier (W2.2) is the eventual DossierRail consumer for Claims; R6 ships the rail + the
Runs quick-peek as its one live consumer, and the three bespoke drawers (explorer detail panel, logs
drawer, proof provenance drawer) migrate onto the rail under W4.4.

### §3 panel states — Request tester (`/sandbox`, Stage W3.2)

The workspace mode adds three panels: picker, prompt, and result. The route builder More tab mounts `RouteResolutionPreview` as a fourth panel.

| Panel | Loading | Empty / idle | Error | Populated |
|-------|---------|--------------|-------|-----------|
| **Project/route picker** (`/sandbox` Workspace tab) | `BrutalLoadingState` "Loading projects…" (rows=2) | No projects → `EmptyState` with "Create a project" link; 401 → `BrutalErrorBanner` with "Sign in" action | `BrutalErrorBanner` with "Try again" (re-fires `loadWsProjects`) | Project `<select>` + Route `<select>`, route name shown; unpublished routes carry `(unpublished)` suffix + warning banner with Publish link |
| **Prompt + action row** (Workspace tab, after route selected) | n/a — rendered only after picker completes | Prompt field empty → "Send real request" button disabled; "Explain" enabled | n/a | Prompt box + two actions: "Explain (dry-run)" (keyless, no cost); "Send real request" (costs tokens) behind an explicit confirm dialog (`role="alertdialog"`) |
| **Result / receipt** (Workspace tab) | `BrutalLoadingState` "Running…" (rows=3) | Idle — "Run Explain or Send real request above to see a receipt." | `BrutalErrorBanner` with "Try again" (resets state to idle) | Structured receipt: route matched + decision badge (WOULD RUN / BLOCKED BY POLICY / NO STEP EXECUTABLE) + provider chain table (per-step outcome badge + est. cost) + step-chain `<details>` + actions (Reset, View logs ↗, Open builder ↗) |
| **RouteResolutionPreview** (route builder More tab, `RouteResolutionPreview.svelte`) | `BrutalLoadingState` "Resolving…" (rows=3) | Idle — "Run resolution preview" primary button | `BrutalErrorBanner` with "Try again" | Same receipt structure as workspace result; footer links to `/logs?route={routeId}` |

**Live-key boundary (W3.2):** `simulate` and `explain-chain` are config-only (no provider calls) and run keyless. `runtime/invoke` spends the user's stored provider credentials — it MUST show a confirm dialog ("SEND REAL REQUEST?") describing blast radius (tokens consumed, appears in Logs) before the request is sent. Tests stub the invoke endpoint; live sends are performed by the key-holder post-merge.

**Fix-forward links (W3.2, rubric X4):** Every route name in the result receipt links to the builder (`/projects/{id}/routes/{routeId}`); every "View logs" link carries `?route={routeId}` so the log table is pre-filtered to this route's requests.

<!-- W3.1-BLOCK-START: live updates (SSE/fallback) + runs pagination. Other batch
     agents edit this file — keep edits inside this fenced block to ease rebase. -->
### §3 live-transport states — Live updates (Stage W3.1)

W3.1 replaces per-surface status polling with ONE SSE channel (`/api/connect/ingest/events`,
session-scoped). Because the Vercel target is serverless (60s function ceiling on Hobby), the
stream self-closes under the cap and the client reconnects by **rebuilding its request URL from the
consumer's current cursor** (no `Last-Event-ID`): the run console sends its live log `since` on every
reconnect and the first frame after connect is a `snapshot` carrying the catch-up log tail since that
cursor, so a 50s reconnect or hidden-tab gap drops no log lines. After repeated connect failures it
**falls back to the pre-existing F8-diet poll** (the run console's 2.5s jittered poll; the chip's 30s
poll) — one transport, the poll is the documented degraded path, never a second live path. The chip's
store contract (`liveRunJobs` / `startLiveRunPoll`) is unchanged, and the runs list **consumes that
same store** rather than opening a second workspace stream (one SSE invocation per viewer, not two).

| Surface / element | Loading | Empty | Error / degraded | Populated (live) |
|-------------------|---------|-------|------------------|------------------|
| **Runs list — live status** (`/keys/dashboard/runs`) | `BrutalLoadingState` (existing) on first load | existing "No runs yet" empty + "Open setup wizard" CTA | shares the topbar chip's workspace stream — SSE→30s-poll fallback is handled transparently inside the shared store, so the list shows no separate degraded note (the chip is the canonical live/degraded indicator); the existing load-error banner + "Try again" is unchanged | active-run rows patch in place from the shared `liveRunJobs` store (status badge + stage + percent update live; row order is stable, never reshuffled) |
| **Runs list — pagination** (`/keys/dashboard/runs`) | `loadMore` shows "Loading…" on the button | n/a (footer hidden until a page loads) | load-more failure reuses the page error banner + "Try again" | honest **"Showing N of M runs"** footer (real `total_count`, not a guess) + **"Load more"** keyset cursor button, hidden when `next_cursor` is null; status-filtered view states "Showing N {status} of M loaded (T total)" so the count is never misread as a server total |
| **Run console — live tail** (`/runs/[id]`) | existing "Loading run console…" (`role="status"`) | n/a (a run always has a row) | existing "Could not load run status" banner + restart actions; **plus** an amber **"Live updates degraded to polling"** mono note (`role="status"`, in-progress runs only) when SSE drops to the 2.5s fallback — the run is explicitly stated to be unaffected | status badge, progress %, stage timeline, heartbeat age, and the activity-log tail all update from SSE `delta` frames (`aria-live="polite"` log region preserved); the W1.4 stall/reclaim narration rides the same frames |
<!-- W3.1-BLOCK-END -->

<!-- K5-BLOCK-START: run attribution (which route/model served this run). Other batch
     agents edit this file — keep K5 edits inside this fenced block to ease rebase. -->
### §3 panel states — Run attribution: "Served by" (Stage K5)

K5 closes K-P1-4: a Connect run can now answer *which route/step/provider/model served each
stage*. The resolve/attribution data is **captured at run time** (not reconstructed after the
fact) inside `stage-route-generate.ts`'s `callResolvedChat`/`embedViaRoute` — the resolved
`{routeId, routeName, projectId, stepId, stepOrderIndex, provider, modelId, attempts}` is recorded
the moment a stage call SUCCEEDS — and persisted into `knowledge_ingest_jobs.progress.attribution`
JSONB (the cheapest persistence slot; no migration). The run console renders a per-stage **"Served
by `<model>` · `<provider>` · route `<name>` (step N) · K attempts"** mono line, the route name
linking to the builder (X4: route → builder). Validation additionally asserts same/different family
vs extraction, feeding K4's cross-model disclosure. Ingest resolves also write a `request_logs` row
tagged **`source=connect_ingest`** (in the existing `metadata` JSONB) so Logs/Usage finally see
Connect traffic (BP-12) — the `/logs` row renders the source tag; the full filter UX stays in W3.3.

| Surface / element | Loading | Empty / absent | Error / degraded | Populated |
|-------------------|---------|----------------|------------------|-----------|
| **Run console — "Served by"** (`/runs/[id]`) | rides the existing run-console load (`role="status"`); attribution rows appear as each stage is captured live | run predates attribution capture (legacy/route-less) → honest absent-state: "Route/model attribution was not recorded for this run — it predates attribution capture" (NO fabricated rows) | n/a — display-only, read-only (adds no fetch; the W3.1 console error/degraded states are unchanged); the mobile read-only contract's 2-mutation-fetch count for this console is preserved | per-served-stage mono row: **`<model>` · `<provider>` · route `<name>` (step N) · K attempts**, route name → builder (`/projects/{id}/routes/{routeId}?flow=visual`); validation row adds "· cross-model ✓" or "· same family as extraction"; an "Attribution recorded from `<date>`" honesty line |
| **Logs — source tag** (`/keys/dashboard/logs`) | existing logs load | n/a — a Connect resolve always writes a row | existing logs error banner + "Try again" | each request-log row renders its **source tag** (`connect ingest` badge for `source=connect_ingest`); gateway/legacy rows show no tag (null source). Full source filter UX is W3.3 |
<!-- K5-BLOCK-END -->

### §3 panel states — Team-shared key metadata + audit log depth (Stage W3.7 + K1)

**Gateway keys — `/access`**

Server-persisted labels (migration `066_api_keys_label_metadata.sql`) replace the localStorage-only
illusion. `label` is `NULL` for pre-W3.7 keys — display "Unlabelled" (italic, `key-label-absent`
class) rather than hiding the field. `createdAt` and `lastUsedAt` are shown as relative times in mono
(`var(--rm-font-mono)`) labelled columns ("CREATED" / "LAST USED"). `lastUsedAt = null` → "never"
(honest; the column exists and is `NULL` — not misleading).

| State | Contract |
|-------|---------|
| **Loading** | SvelteKit server load — no client skeleton needed; flash is acceptable |
| **Error** | `role="alert"` error paragraph with the full error path above the key list |
| **Empty (no keys)** | `EmptyState` component — title + description + Create form |
| **Populated** | Key list with `keyPrefix`, label (or "Unlabelled"), project, `created`, `last used`, Rename + Copy + Revoke actions |
| **Inline rename** | Form replaces the label cell; Save (PATCH) + Cancel; `renameError` shown inline; focus moves to rename input on open |
| **localStorage migration offer** | Banner (role="status") shown when `rk_key_labels` has un-migrated entries; "Save N labels to workspace" batch-PATCH; "Dismiss" hides without migrating; **never auto-writes** |
| **Post-create key box** | `role="status" aria-live="polite"` — copy-once raw key display; "This is the only time the full key will be shown." |

**Security invariants (W3.7/K1 — key-management is auth-adjacent):**
- Label field has `maxlength="120"` and server-side trim + cap.
- POST and PATCH reject labels containing `/rk_[A-Za-z0-9_-]{8,}/` anywhere in the string (key material in label = 400; unanchored — also catches "prod key rk_..." patterns).
- `last_used_at` is written by `verifyGatewayKey` — the column records the timestamp of the last
  authenticated request, not the timestamp of any label operation. No key material passes through
  label update paths at any point.
- Labels are excluded from console logs at the server layer (no `console.log(label)` calls).

**Audit log — `/prove/audit`**

Filters replace the fixed-50-row truncated list. Keyset pagination with a hard cap of 200 rows/page.

| Panel | Loading | Empty (no events) | Empty (filtered, no match) | Error | Populated |
|-------|---------|-------------------|---------------------------|-------|-----------|
| **Filter bar** | Renders immediately (no async) | — | — | — | 5 controls: action (`event_type`), actor type, actor ID, from (datetime-local), to (datetime-local); Apply + Clear when filters are active |
| **Audit list** | SvelteKit server load | `EmptyState` "No audit events yet" + link to Gateway keys | `EmptyState` "No events match these filters" + **Clear filters** CTA | `BrutalErrorBanner`-pattern (`role="alert"`) + **Try again** (re-navigates to the page) | One row per event: relative time, summary, actor (type chip + id code), object link (X4) |
| **Object link (X4)** | — | — | — | — | `gateway_key` → `/access`; `project` → `/projects/{id}`; `policy` → `/policies/{id}`; `provider_integration` → `/integrations/{id}`; `workspace` → `/home`; `route` → `null` (route audit rows lack projectId in this schema — link absent, not dead) |
| **Pagination** | — | — | — | — | "Older →" button (sets `?before=<cursor>` cursor param); "End of results" note when `hasMore === false` |

**Filter → URL params mapping (W3.7):** all filter state lives in URL search params so filtered views
are shareable. `actor=<uid>`, `actorType=user|gateway_key|management_key|system`,
`eventType=<event_type>`, `since=<epoch_ms>`, `until=<epoch_ms>`, `before=<epoch_ms>` (cursor).
Clearing filters navigates to the bare pathname.

**Actor identity (W3.7, K-P1-1 evidence chain):** each audit row shows both the actor type (small
mono chip) and the actor_id (truncated `<code>` element). For `user` type this is the user uid; for
key types this is the key id — both are opaque but meaningful for cross-referencing. The tooltip
shows the full actor_id. This is the maximum fidelity the `audit_events` schema carries without a
user-email join (future W-stage may add that join).

### §3 panel states — Versioned-config intelligence: diff / export / recommend (Stage W3.5)

Builds on W1.5's Versions tab (route builder `/projects/{id}/routes/{routeId}` → Versions; policy
`/policies/{id}` → Versions). W3.5 adds a Compare (diff) panel, an Export affordance, and
recommendations in the route step-add dialog. **Truthfulness invariant:** diffs are computed over the
version *snapshots* the `/history` endpoint stores verbatim (routes: client-side over
`routeSnapshot`+`stepsSnapshot`; policies: the existing server `/diff` endpoint) — never a recomputed
approximation.

| Panel | Loading | Empty | Error | Populated |
|-------|---------|-------|-------|-----------|
| **Compare (diff)** (`VersionDiffView`, inside `VersionsPanel`) | `BrutalLoadingState` "Computing diff…" (rows=3) | Identical versions → "No changes between the selected versions" + pick-another hint; < 2 published versions → "Compare needs at least two published versions… Publish again" | `BrutalErrorBanner` "Could not compute the diff" + **Try again** (re-fires the diff) | Field-level added/removed/changed rows (square `+`/`−`/`~` glyph + status word, mono evidence column) with a raw-JSON toggle; each changed row + field links into the builder via `onOpenDiffField` (route metadata → Setup tab; `step.<orderIndex>` → Flow tab with the step selected) |
| **Export** (route bundle, inside `VersionsPanel`) | "Exporting…" on the action button | n/a — a route always exports | `BrutalErrorBanner` "Export failed" + **Dismiss** (clipboard fallback note when copy fails) | "Export bundle" downloads `<name>.route-bundle.json` (canonical route-graph bundle, schema 1.0.0, no secrets); "Copy as JSON" copies the same; success status "copied to clipboard". Policies have no export endpoint → the affordance is absent (not a dead button) |
| **Recommendations** (route step-add dialog) | "Loading recommendations…" status | "No recommendations — this route looks healthy." | inline `role="alert"` + **Try again** (re-fires the recommend POST) | Recommendations from the existing `routes/{routeId}/recommend` endpoint, quoted verbatim and ordered by priority (high→low). Guidance only — copy states "nothing here changes the route automatically" (`safeAutoApply: false`); never auto-applied |
| **Route coverage** (`RouteCoverageIndicator`, routes list `/projects/{id}/routes`) | `BrutalLoadingState` "Checking route coverage…" (rows=1) | `routeCount === 0` → "No routes yet — coverage appears once this project has at least one route." | `BrutalErrorBanner` "Could not load route coverage" + **Retry** (re-fires the GET) | Headline quotes the endpoint verbatim: "N of M routes have no enabled step" (warn) or "All M routes have at least one enabled step" (ok), linking to the routes it summarizes (X4). A toggle reveals the per-environment workload×stage matrix (`coveredCells/totalCells (coveragePct%)`, gap cells flagged). Reads the existing `api/projects/{id}/route-coverage` endpoint; no recompute |

**Diff/export source-of-truth (W3.5):** the route diff and export both read the same stored
snapshots/bundle the server already produces; there is no second recommendation model and no
recomputed diff.

**Publish-confirm blast radius (W3.5, M2):** the publish confirm describes the blast radius of
*this* publish, not the previous published change. **Routes:** the builder passes the pending draft
(`{ routeSnapshot: data.route, stepsSnapshot: data.steps }`, the same shape `insertRouteVersionEvent`
stores) as `draftSnapshot`; `VersionsPanel` diffs it against the *latest published* snapshot with the
same `buildRouteDiff` and shows "Publishing changes: 1 step changed, … (vs live version N)" — or an
honest "No changes vs live version N — this re-publishes the same configuration", or "This is the
first published version — there is no live version to compare against" when there is no prior
snapshot. A reorder-only draft (orderIndex/entryStepId) is therefore a real change here, never
"No changes" (M1). **Policies (asymmetry):** the policy page has no client-side draft model
(`draftSnapshot` is omitted, `diffMode="server"`), so the publish confirm shows no diff context
line — no snapshot is available on the client to diff against. A route-step-edges-versioning
follow-up (W1.5 server scope) would let the route confirm reflect edge moves too.

**Fix-forward links (W3.5, rubric X4) — routes only:** in the route builder every changed diff field
exposes an "open in builder" affordance landing on the exact field — route metadata → Setup tab;
`step.<orderIndex>` → Flow tab with the step selected, resolved by the snapshot's stable step id (not
the path's orderIndex, which can drift if the draft was reordered since — m4). The policy mount does
not wire `onOpenDiffField`: a policy diff anchors at `policy`/`policy.<field>` and the policy page has
no per-field builder target to land on, so the affordance is absent there (not a dead link).

### §3 panel states — As-of time travel (`/claims`, Stage W2.5)

The Claims explorer gains a **"View as of &lt;date&gt;"** control. As-of is a **read** feature:
viewing a past state issues zero mutation fetches (the explorer mutation-fetch pin stays at 16) and
quotes the same units read path with an `as_of` parameter — never a second formula. Honesty is the
whole point: a store that cannot reconstruct history says so, rather than dressing the live view up
as historical data.

| Element | Loading | Empty / absent | Error / degraded | Active / populated |
|---------|---------|----------------|------------------|--------------------|
| **As-of control** (`.as-of-control`, toolbar) | n/a (static) | No run anchors yet → only the date-time picker shows (no anchor row) | n/a | `datetime-local` picker + "View at this time" + run-timestamp anchors; while a historical view is active a "Return to now" button appears |
| **Historical-view banner** (`.as-of-banner`, `role="status"`) | n/a | n/a | **History not available for this graph** (`role="status"`, coral): the data layer could not reconstruct the instant — copy names *why* (BYO Surreal stores carry no version chains until the Stage 3.2b opt-in; or no graph store; or a version-lookup failure) and the **current** view is shown unchanged, explicitly *not* historical. Recovery action: **Return to now**. | "Viewing graph as of &lt;instant&gt; — counts and states reflect that instant", a one-click **Return to now**, an **Include/Hide superseded versions** toggle, and an honest projection summary ("N shown at an older version · M did not exist yet · K have unknown history (kept, not filtered)") |

**Read-only invariant (view only).** While `?as_of`/`?audit` is active the explorer is read-only on
**desktop too** — a `.as-of-readonly` state class on the explorer root (not the mobile body
attribute) hides the same mutation regions the mobile tier hides (`.review-actions`,
`.dossier-actions`, `.dossier-recheck`, `.remove-section`, `.cohort-complete-actions`,
`.revalidate-actions`, `.wizard-actions`, `.lib-new`, `.lib-run-archive`). The verdict keyboard
shortcuts (which CSS cannot hide) early-return on `asOfActive` in `handleReviewKeydown`. Copy:
*"Editing past state is not possible."* Guarded by `dashboard-as-of-readonly.test.ts`.

**URL contract.** `?as_of=<iso>` (and `?audit=1` for superseded versions) compose with `?filter` /
`?unit` and survive alongside `?workspace` / `?focus` and the `/connect/graph` → `/claims` 308
redirect — shareable historical views (W2.1 contract extended in `explorer-url-state.ts`).
**Boundary semantics** match the connect-v1 retrieve path (`valid_from ≤ t < valid_to`): a claim
valid until T is shown at T-ε, not at T.

### §3 panel states — The Stamping Desk (`/claims`, Stage W4.2)

The Claims explorer gains a **keyboard-first triage desk** (`ClaimsStampingDesk.svelte`, mounted
from the explorer's triage panel behind an "Open stamping desk" button). The desk is a focus mode
over the *existing* review machinery: every verdict reuses `performReview` → PATCH
`/graph/units/{id}/validation`, so the explorer **mutation-fetch pin stays at 16** — the desk issues
zero fetches of its own. All keymap / tally / guard / undo decisions live in the pure module
`claims-stamping-desk.ts` (unit-tested; the desk component is the DOM shell).

| Element | Loading | Empty / absent | Error / degraded | Active / populated |
|---------|---------|----------------|------------------|--------------------|
| **Desk entry** (`.desk-enter`, triage panel head) | n/a | No claims awaiting review → button not shown (nothing to triage) | As-of view → button replaced by an honest note ("Stamping desk unavailable here — editing past state is not possible"); mobile read-only tier → button hidden by the layout's `.shell-mobile-readonly` rule and the click handler refuses at call time | "Open stamping desk" button when `reviewEnabled` and ≥1 claim awaits review and not read-only |
| **Desk overlay** (`.stamping-desk`, `aria-label`) | (inherits the queue's load state) | Queue cleared mid-session → "The review queue is clear … press Esc" | (verdict-save failures surface in the explorer's existing `.workspace-alerts` banner — single error path) | Claim card (focusable, receives focus on advance), AI verdict, evidence link, note field, stamp bar, undo row, session tally rail, shortcut legend |
| **Stamp bar** (`.desk-stamps`, `role="group"`) | n/a | n/a | **Supported (S) guarded off** for an unbound / pre-binding / no-evidence claim — disabled stamp + verbatim `canAcceptAsSupported` reason (`.desk-stamp-guard`), never a silent no-op (claims-ledger row 2) | S=Supported · W=Weak · X=Rejected, each ≥44px, the AI-suggested verdict emphasised; a 100ms mechanical press on stamp (`.desk-stamp-flash`, `prefers-reduced-motion`-guarded) |
| **Session tally rail** (`.desk-tally`, `role="status"`) | n/a | "REVIEWED 0 · SUPPORTED 0 · WEAK 0 · REJECTED 0" | n/a | Live ledger line "REVIEWED N · SUPPORTED N · WEAK N · REJECTED N"; resets per visit (lives in desk state); an honest note that the **trust score** recomputes on the Home scorecard — the desk does not fork or fabricate a per-session score delta |

**Keyboard contract (X10).** Shortcuts: **J/K** (+ arrows) move the queue, **S/W/X** stamp, **E** opens
evidence, **N** focuses the note field, **Z** undoes, **?** toggles the legend, **Esc** exits. The desk's
`<svelte:window>` listener owns the keyboard while open — the explorer's own `handleReviewKeydown`
early-returns on `deskActive` so a/w/u/n/p never double-fire underneath. No shortcut fires from an
input/textarea/select/contenteditable; **Esc is two-step**: inside the note field it only blurs the
field (focus returns to the claim card), a second Esc — now outside the field — exits the desk.
**Modifier chords never fire**: the keymap early-returns on Cmd/Ctrl/Alt, so Cmd/Ctrl+S stays the
browser's Save, never a stamp. Focus moves to the claim card on advance; stamp/undo/guard results
announce on an `aria-live="polite"` region.

**Read-only invariant.** Both read-only tiers gate the desk, by different mechanisms because they
become true at different times. The **as-of history view** (`asOfActive`) is reactive client state, so
`deskReadonly = asOfActive` reactively replaces the entry button with an honest note and puts the desk
in read-only mode (keymap drops every mutating command; stamp/note/undo UI not rendered). The **mobile
read-only tier** (`[data-mobile-readonly]`) is set by the layout's `onMount` matchMedia probe — *after*
the explorer's first reactive pass — so it is enforced at **call time**: every mutation entry
(`enterDesk`, `deskStamp`, `deskUndo`) re-checks `deskMutationBlocked()` (= `asOfActive ||
isMobileReadonlyActive()`, a live DOM query) at the moment of the click/keypress and refuses, and the
layout's `.shell-mobile-readonly` rule hides `.desk-enter` / `.desk-mount` as belt-and-braces. This
reuses the same guards W2.5 and R6 already enforce — it does not fork them. Pinned by
`dashboard-mobile-readonly-claims.test.ts` (selector inventory + call-time-guard contract).

**Truthful dispatch (tally/announce/undo).** `performReview` reports `dispatched | swallowed |
disabled`; the desk counts the tally, announces success and arms undo **only on a confirmed
server-bound dispatch**. An input landing inside the 250ms post-stamp guard window is `swallowed`:
the desk holds with honest feedback ("Hold on — saving the previous stamp") instead of counting a
stamp the server never saw — so S→Z inside the window never announces "Undone", and rapid S→J→S never
counts a dropped stamp. If the server later rejects a stamp, an `onResolved(false)` continuation rolls
the tally back, clears the just-armed undo record and announces the rollback; failed stamps hold with
retry, they do not advance.

**Undo semantics (honest).** The validation endpoint accepts only `{ ok | weak | unsupported }` — there
is no server "un-stamp". Undo is therefore a **single-level re-stamp to the previous verdict** via the
same mutation. When the previous status was *unchecked* (the common first-review case) there is no prior
verdict to restore, so undo is honestly **disabled with a reason** rather than pretending to clear the
verdict. The session tally decrements on undo so the rail never lies about how many claims this session
currently holds.

### §3 panel states — "Prove it" as a global gesture (Stage W4.3)

The brand habit (UX review §3.5 / north-star §2.4): **any number or badge that asserts trust is a
link to its evidence.** W4.3 installs one shared, grep-able affordance and wires it across every
audited trust assertion. The numbers themselves are unchanged — they still come from the scorecard /
dossier services (no second formula); this stage only routes the *click* to the receipt behind them.

**The shared affordance.** One class, one place: `PROVE_LINK_CLASS` (`"prove-it"`, exported from
`src/lib/prove-it.ts`), styled globally in `src/lib/styles/brutalist-utilities.css` (`.prove-it`) as a
dotted-underline + trailing `↗` mono treatment, deliberately distinct from solid nav links and from
buttons. Rendered by `ProveLink.svelte` or applied directly to a raw `<a>`; the `.prove-it--block`
modifier drops the inline underline for card/cell links (metric tiles, state chips) while keeping the
grep-able class and the hover-receipt feel. A prove-it link is **always an `<a>` to evidence** — it
mutates nothing, so it is safe on the mobile and as-of read-only tiers (no read-only-tier hiding needed).

**Destinations (one URL contract, no dead ends — rubric X4).** All hrefs are built by `prove-it.ts`,
which quotes the W2.1 explorer contract (`?filter=` / `?unit=`, optional `?as_of=` from W2.5) and the
canonical section hrefs from `nav-config.ts`:
- `proveClaimsFilterHref(filter, asOf?)` → `/claims?filter=<verification-slice>` (the explorer)
- `proveDossierHref(unitId, asOf?)` → `/claims?unit=<id>` (the W2.2 Evidence Dossier)
- `proveRunVerdictHref(runId, …)` → `/runs/<id>` when the verdict carries its source run; **honestly
  degrades to `/claims?filter=review`** (the diffed claims) when the payload predates run identities.

**Audit table — surface → assertion → destination.** Every trust number rendered today carries the gesture:

| Surface | Trust assertion | Destination (prove-it) |
|---|---|---|
| `/home` trust cap | "N need review" | `/claims?filter=review` |
| `/home` inbox | "Claims to review" count | `/claims?filter=review` |
| `/home` inbox | "Latest regression" | producing run `/runs/<id>` (degrade: `/claims?filter=review`) |
| Scorecard (Home) | Evidence-bound % | **link-less** (store-level aggregate — coverage-facet follow-up) |
| Scorecard (Home) | Embedding coverage % | **link-less** (store-level aggregate — coverage-facet follow-up) |
| Scorecard (Home) | Validated-supported ratio | `/claims?filter=review` |
| Scorecard (Home) | Per-state chips (supported…excluded) | `/claims?filter=<state>` |
| Scorecard (Home) | "What lowered this score" factor rows | `/claims?filter=<factor's slice>` (store-level factors render link-less) |
| Graph answer (Prove › Proof) | MCP answer verified-claim envelope (each injected claim) | `/claims?unit=<id>` (Evidence Dossier) |

The scorecard (`ConnectTrustScorecard.svelte`) renders **only on Home** (the factor rails under the
trust cap); Prove › Proof renders the `ProvenanceDrawer`, whose injected-claim rows carry the gesture.

Surfaces with no honest per-idea filter render **no** prove-it link rather than a dead one. Two kinds:
(1) store-/graph-level factors (vector index, relation health) — never had a per-idea slice; (2) the
**Evidence-bound** and **Embedding-coverage** coverage tiles — store-level aggregates whose per-idea
slice does not yet exist (the explorer's unit rows carry no per-unit binding/embedding field, and
"unbound" conflates pre-EBV / bound-failed / tracked-unbound populations the W2.2 facet machinery
refuses to bucket). These previously pointed at `?filter=unbound` / `?filter=missing_embed`, which
`parseExplorerUrlState` silently drops to the default review queue — dead tokens. They now render
link-less (the `vector_index` precedent). **Coverage-facet follow-up:** add per-unit binding +
embedding fields to the units API, an explorer facet, and a server breakdown so these become real
`?filter=` slices. The `prove-it.test.ts` round-trip guard (every `ProveFilter` must survive
`parseExplorerUrlState`) is the permanent regression pin against re-introducing a dead token.

The launch-forecast "92% supported" surface named in the frozen pre-Wave-R review does not exist in
the current IA; its rule (percentage → producing verdict) is captured by `proveRunVerdictHref` for
when such a surface lands.

**Public share view — DEFERRED behind the D7 STOP gate.** The public, unauthenticated scorecard share
URL (`/prove/share`) requires the D7 security decision. The redesign records D7's *direction* (a scoped,
expiring signed-URL exposure) but states the security review is **mandatory before build**, and no
signed unauthenticated-exposure design exists in the repo. W4.3 therefore ships the internal gesture in
full and keeps `/prove/share` an honest placeholder whose copy now names what is ready (the in-app
gesture) vs what awaits the decision — never a half-secured public surface.

**Lint (best-effort heuristic, documented).** `src/lib/prove-it.test.ts` source-greps the audited
surfaces (scorecard, provenance drawer, Home) and fails if any drops below its minimum count of
`prove-it` applications, plus asserts the global `.prove-it` rule exists. It is a regression pin on the
known trust-assertion surfaces, not a completeness proof across the whole tree.

### §3 shell-element states — Navigation pending state (nav-pending-fix)

Addresses user report: clicking sidebar items (esp. Sources) showed nothing for a while — old
screen + old nav highlight stayed until the server load resolved. Root cause: the dashboard layout
made zero use of SvelteKit's `navigating` store. Fix adds instant feedback via the store.

| Element | While navigating (server-load in flight) | Navigation complete |
|---------|------------------------------------------|---------------------|
| **Destination nav item** (sidebar) | `.nav-link-pending` modifier: dimmed-yellow fill (`55%` opacity) + hard 3 px left-edge ink bar pulsing at `steps(2)` interval. Appears on the work-nav item, group items, and Testing item whose href matches the destination (via `isWorkNavActive` / prefix match — same derivation as the active highlight). The **current** item keeps its `.nav-link-active` state unchanged. | Pending modifier removed; destination item gains `.nav-link-active`. |
| **Top-of-content progress bar** (`.nav-progress-bar`, `role="progressbar"`) | 3 px, ink-on-white, hard edges, no radius. Appears at the top of the content column (absolutely positioned in `.main-wrap`). CSS animation fills to ≈72 % during the load duration; bar disappears instantly when `$navigating` clears. `aria-label` names the destination: `"Loading Sources…"`. | Removed from DOM. |
| **`aria-busy` on `<main>`** | `aria-busy="true"` while `$navigating` is truthy. | Attribute removed. |
| **Visually-hidden live region** (`role="status"`, `aria-live="polite"`) | `"Loading {label}…"` text inside a `.sr-only` element, announces the pending destination to screen readers without stealing focus. Complements `aria-busy`. | Removed from DOM. |

**A11y invariants:**
- The `.nav-link-pending` pulsing animation is suppressed under `prefers-reduced-motion`
  (static bar stays visible — no animation, no flicker).
- The progress bar fill animation is also suppressed under `prefers-reduced-motion`
  (bar fills to full width immediately and stays static until navigation completes).
- `aria-busy="true"` on the main content region communicates the pending state to AT
  without redirecting focus.
- The visually-hidden `role="status"` live region is announced by screen readers as
  `"Loading Sources…"` (or the matched nav item label, or `"Loading page…"` as a fallback
  when no nav item matches the destination path).

**Derivation contract (`pendingHref`):** `$navigating.to?.url.pathname` is matched against
`workNavForUi`, `testingNavForUi`, and `navGroupsForLayout` items using the same
`isWorkNavActive` (prefix + exact) logic as the active highlight. The first match wins.
`pendingLabel` is the matched item's `label` field. Tested by
`nav-config.test.ts` (pending derivation suite).

### §3 auth states — fail-closed verification (Stage W4.6a)

A protected surface has **three** auth states, not two. The defect this fixes: a transient Neon Auth
verification failure (5xx, rate-limit with no last-known-good, network throw) was silently demoting a
signed-in user to **signed-out** on that one request — so the shell could say signed-in while a page
said signed-out, and a refresh could bounce the user to login on an infra blip. The convention below
is enforced by the single `sessionUser` / `requireSessionUser` / `isSignedInSession` helper
(`$lib/server/session-user`) at every session-page surface.

| State | When | Required behavior |
|-------|------|--------------------|
| **Signed in** | Verification resolved a session user | Render the surface normally. |
| **Signed out** (genuine) | No session cookie, or Neon Auth returned 200 `{user:null}` / a 4xx | Render the signed-out CTA — `SignInNotice` (in-place) or redirect to `/keys/dashboard/login`. This is the ONLY state that shows "Sign in". |
| **Auth degraded** (verification errored) | A cookie-bearing request where verification could **not** complete (Neon Auth 5xx, 429 with no last-known-good, network throw, or an unexpected throw in the auth pipeline) | Render an honest auth-degraded state (`AuthDegradedNotice`): copy says we couldn't confirm sign-in (likely a brief hiccup, **not** a sign-out) + a **Try again** that calls `invalidateAll()`. **Never** the signed-out CTA, and **never** a redirect to login. `getSession` first serves a short-TTL last-known-good session verification (keyed by the session cookie); only with no cached value does it report `degraded`. Carried on `locals.authDegraded` → `LayoutData.authDegraded`; the shell shows the same degraded banner so it cannot contradict the page. |

**Shell/page agreement.** The shell renders `$page.data.user` from layout data, which persists across
client navigations; pages re-check. The 4-minute client session refresh
(`hooks.client.ts` → `/keys/dashboard/api/auth/session-cache`) now compares the polled `signedIn`
boolean against the rendered state and calls `invalidateAll()` on a definite **change** (decision in
`$lib/auth-change`, `shouldInvalidateOnSessionPoll`), so a mid-session expiry or a sign-in in another
tab reconciles the shell and pages instead of leaving them disagreeing. A `degraded` poll is never
treated as a change.

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

### "Prove it" global gesture — June 2026 (Stage W4.3)

Added the §3 block **"Prove it" as a global gesture**. One shared, grep-able affordance
(`PROVE_LINK_CLASS` / `ProveLink.svelte`, global `.prove-it` rule) now links every audited trust
assertion to its evidence via the `prove-it.ts` destination builders (W2.1/W2.2 deep links; degrade
rule for regressions). The block carries the full surface → assertion → destination audit table.
**STOP gate:** the public `/prove/share` view stays deferred behind the D7 security decision — the
internal gesture shipped in full; the share placeholder copy now names ready-vs-deferred honestly.

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

### In-dashboard request tester — June 2026 (Stage W3.2)

- **§3 states added for the Request tester (`/sandbox` workspace mode + `RouteResolutionPreview`).**
  Four panels: project/route picker, prompt + action row, result/receipt, and the route builder
  More tab preview. Each has loading / empty / error / populated states per the §3 contract.

- **Live-key boundary registered.** `simulate` and `explain-chain` are config-only (no provider
  calls); `runtime/invoke` requires explicit confirm dialog before sending. Tests use stubs;
  live sends are key-holder demos post-merge.

- **Fix-forward link contract.** Every route name in the receipt links to its builder; every
  "View logs" link carries `?route={routeId}` for pre-filtered log views (rubric X4).

### As-of time travel — June 2026 (Stage W2.5)

- **§2 registry: "As-of view" added.** The Claims time-travel control + historical-view banner
  get a canonical name and verb ("View as of" / "Return to now"; not "time machine" / "snapshot").
- **§3: a stage-labelled W2.5 panel-states block added** for the as-of control and the
  historical-view banner (including the **degraded** "History not available for this graph" state),
  plus the **read-only invariant** (a `.as-of-readonly` root state class hides mutation regions on
  desktop too; the verdict keyboard shortcuts early-return on `asOfActive`) and the **URL contract**
  (`?as_of` / `?audit` compose with `?filter` / `?unit` and survive the `/connect/graph` → `/claims`
  redirect; boundary semantics `valid_from ≤ t < valid_to`).
- **Honesty + no-second-formula:** as-of quotes the same units read path with an `as_of` parameter;
  it is a read (zero mutation fetches — the explorer mutation pin stays at 16). Where the data layer
  cannot reconstruct history (BYO Surreal stores without the Stage 3.2b version-chain opt-in; no
  graph store; version-lookup failure) the view degrades explicitly and shows the current data
  unchanged, never dressed up as historical.

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
