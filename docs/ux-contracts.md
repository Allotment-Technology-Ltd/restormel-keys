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
| Sign in           | `https://restormel.dev/keys/dashboard/login` | Auth CTAs, runbooks (“sign in” links). |
| Log out           | `https://restormel.dev/keys/dashboard/logout`| Dashboard only. |
| Docs              | `/keys/docs/`           | Marketing nav, dashboard welcome. |
| Pricing           | `/keys/pricing`         | Marketing nav, dashboard welcome, billing. |
| Keys (product)    | `/keys`                 | Marketing nav, breadcrumbs. |

Site, docs, and dashboard are one app at restormel.dev (dashboard at `/keys/dashboard`). Use the canonical dashboard URLs above in links; no alternate paths or wording (e.g. “Login” vs “Sign in”).

### Shell entry points

- **Marketing (site):** Nav links → Keys, Docs, Pricing, GitHub, Dashboard. Footer → same + Dashboard.
- **Docs (in-app):** Sidebar → Overview, Framework compatibility, Cloud API; Product → Dashboard, Sign in.
- **Dashboard:** Sidebar groups include **Set Up** (Connections, Restormel Testing, Rules, Guard Rails, Model Catalog), **Monitor**, **Advanced** (Gateway keys, Test & Preview, GitHub Setup, Dev Tools), plus Overview and Profile; topbar → Sign in (when logged out) or account menu (avatar) when signed in. **Connections** = `/keys/dashboard/integrations` (provider integrations; hosted encrypted keys and/or vault references).

Shared nav schema: site nav, docs sidebar, and dashboard sidebar use the same canonical URLs above. See [documentation-strategy.md](documentation-strategy.md) and [design-system-index.md](design-system-index.md) (SSO and same links).

## 2. Copy conventions (content registry)

### Canonical product nouns

Use these terms consistently. Do not invent synonyms in UI or docs.

| Term           | Use for |
|----------------|---------|
| **Gateway Key**      | The credential your app, CLI, or SDK uses to authenticate to Restormel (Cloud API). Created in the dashboard (Access); format `rk_...`. Not the same as a provider credential. |
| **Provider credential** | Your OpenAI, Anthropic, Google, or other provider API key. Under **Connections**, stored **encrypted at rest** (hosted key) or as a **non-secret vault reference**; list/API responses are **masked** only. Optional; you can use Gateway Key only or both. |
| **Workspace**        | Top-level account boundary; one default workspace per user, created when you sign in. |
| **Project**          | Container for Gateway keys, routes, and usage. One per app or product. |
| **Environment**      | Dev, staging, prod (or similar) within a project. |
| **Provider integration** | A connected provider (OpenAI, Anthropic, etc.) with hosted encrypted key and/or credential reference; managed under **Connections**. |
| **Restormel Testing** (dashboard) | Hub at `/keys/dashboard/testing` for the auto-provisioned Testing **project**, environment IDs, and env snippets (with Gateway keys for CLI/CI). |
| **Route**            | Per-project/environment: which model(s), fallbacks, and billing mode. |
| **Models**           | The model catalog (canonical models and provider variants). |
| **Analytics**        | Request count, latency, error rate, usage by provider/model/route. |
| **Logs & Traces**    | Request-level logs from the gateway. |
| **Dashboard**        | The app at restormel.dev/keys/dashboard (not "admin" or "portal"). |
| Sign in        | Auth CTA (not “Login”, “Log in”). |
| Cloud API      | The HTTP API exposed via Zuplo gateway. |
| Zuplo gateway  | The gateway that fronts the Cloud API; consumer keys `zpka_...`, backend key is a Gateway Key `rk_...`. |
| Restormel Keys | Product name (not “Keys” alone when disambiguation is needed). |

### CTA grammar

- **Primary auth:** “Sign in with GitHub” (button/link). Link target: `https://restormel.dev/keys/dashboard/login`.
- **Dashboard entry:** “Dashboard” (link). Target: `https://restormel.dev/keys/dashboard`.
- **Signed-in account menu:** Avatar opens a menu with “Profile & settings”, “Subscription”, and “Sign out”.
- **After checkout:** “You’re sent to the dashboard. Sign in with GitHub if you aren’t already.”
- **Key handling:** Use privacy-sensitive copy: “your key”, “Gateway key”; never expose raw keys in UI or errors. Use masked identifiers (e.g. key prefix or hash) in support/debug text.

### Security and key copy

- In UI and docs: “your key”, “Gateway key”, “masked in UI”, “never logged”.
- Same object model terms everywhere: Workspace, Project, Environment, Gateway Key, Provider credential, Provider integration, Route, Models, Analytics, Logs (site, docs, dashboard, embed).

## 3. State conventions

Every user-facing flow must define and handle these states where applicable:

| State    | Purpose | Required behavior |
|----------|---------|--------------------|
| **Loading** | Request or transition in progress | Show a loading indicator or skeleton; avoid blank content. |
| **Error**   | Request failed or validation error | Show a clear message and a recovery action (e.g. “Try again”, “Sign in”, link to docs). Use semantic error styling (`--rm-*` / `--rk-*` error tokens). |
| **Empty**   | No data yet (e.g. no projects) | Explain what’s empty and what to do next (e.g. “Create a project”, link to Docs). |
| **Success** | Action completed | Confirm briefly (e.g. “Saved”, “Key created”); optional toast or inline message. |

**Recovery actions:** Every error and empty state must offer at least one clear next step (button or link). Do not leave the user with only a message.

**Destructive actions:** Require explicit user confirmation before execution (per [.cursor/rules/04-ux-safety.mdc](../.cursor/rules/04-ux-safety.mdc)).

## 4. Section pattern (shell rhythm)

One pattern for every major section so the product shares the same rhythm:

- **Marketing and docs:** Section = **section-title** (h2) + optional **section-intro** (p) + content. Spacing: `--space-6` between title and intro, `--space-6` or `--space-8` below intro to content. Use `.section-title` and `.section-intro` (or equivalent) with tokenized margins and `--rm-muted` for intro text.
- **Dashboard:** Page = **page-title** (h1) + **page-desc** (p) + content. Use `.page-title` and `.page-desc` with `margin: 0 0 var(--space-2)` and `margin: 0 0 var(--space-4)` respectively; font size `var(--text-2xl)` for title, `var(--text-sm)` for desc, color `--rm-muted` for desc. Sub-sections use the same pattern (e.g. `.section-title` + `.section-desc` + content) with tokenized spacing.

Apply this pattern on all dashboard pages (Overview, Projects, Billing, Settings, project detail, usage) and keep site Keys/Pricing sections aligned. Buttons and cards use `--rm-radius`, `--rm-sage`, `--rm-border`, `--rm-surface-raised` and padding scale `--space-2`, `--space-4`, `--space-6` so they are visually interchangeable across site and dashboard.

## 5. Application

- **Site (Svelte/SvelteKit):** Nav and footer use the navigation model and canonical URLs. Section pattern: `.section-title` + `.section-intro` + content. Pricing and docs use the same links and copy conventions.
- **Dashboard (SvelteKit):** Layout and routes use the same URLs; welcome and error blocks use state conventions and copy registry terms. Section pattern: `.page-title` + `.page-desc` (and `.section-title` + `.section-desc` for sub-sections) with tokenized spacing.
- **Docs (Svelte):** Sidebar and content use Dashboard/Sign in links and product nouns from the registry.
- **Embeddable components:** KeyManager and other embeddables use the same security/key copy and state patterns (loading/error/empty/success) where applicable.

When adding or changing copy or nav, check this document and [documentation-strategy.md](documentation-strategy.md) for consistency.
