# UX contracts

**Status:** Canonical. Shared navigation, copy, and state conventions across site, docs, dashboard, and embeddable surfaces.

All user-facing surfaces must align with these contracts so the product feels consistent and predictable.

## 1. Navigation model

### Route taxonomy and canonical URLs

| Label / concept   | URL                     | Use everywhere |
|-------------------|-------------------------|----------------|
| Dashboard         | `/keys/dashboard`       | Nav, footer, docs, runbooks, CTAs. |
| Sign in           | `/keys/dashboard/login` | Auth CTAs, runbooks (“sign in” links). |
| Log out           | `/keys/dashboard/logout`| Dashboard only. |
| Docs              | `/keys/docs/`           | Marketing nav, dashboard welcome. |
| Pricing           | `/keys/pricing`         | Marketing nav, dashboard welcome, billing. |
| Keys (product)    | `/keys`                 | Marketing nav, breadcrumbs. |

When the app is served at a custom domain (e.g. restormel.dev), use the same paths; full URLs are `https://<origin>/keys/dashboard`, etc. No alternate paths or wording (e.g. “Login” vs “Sign in”, or `/dashboard` without `/keys`).

### Shell entry points

- **Marketing (site):** Nav links → Keys, Docs, Pricing, GitHub, Dashboard. Footer → same + Dashboard.
- **Docs (Starlight):** Sidebar → Start here (Overview, Framework compatibility, Cloud API); Product → Dashboard, Sign in.
- **Dashboard:** Sidebar → Overview, Projects, Billing, Settings; topbar → Sign in (when logged out) or user/account.

Shared nav schema: site nav, Starlight sidebar, and dashboard sidebar use the same canonical URLs above. See [documentation-strategy.md](documentation-strategy.md) and [design-system-index.md](design-system-index.md) (SSO and same links).

## 2. Copy conventions (content registry)

### Canonical product nouns

Use these terms consistently. Do not invent synonyms in UI or docs.

| Term           | Use for |
|----------------|---------|
| Project        | The container for API keys and usage (dashboard). |
| API key        | Keys created in the dashboard for the Cloud API; format `rk_...`. |
| Dashboard      | The app at `/keys/dashboard` (not “admin” or “portal”). |
| Sign in        | Auth CTA (not “Login”, “Log in”). |
| Cloud API      | The HTTP API exposed via Zuplo gateway. |
| Zuplo gateway  | The gateway that fronts the Cloud API; consumer keys `zpka_...`, backend key `rk_...`. |
| Restormel Keys | Product name (not “Keys” alone when disambiguation is needed). |

### CTA grammar

- **Primary auth:** “Sign in with GitHub” (button/link). Link target: `/keys/dashboard/login`.
- **Dashboard entry:** “Dashboard” (link). Target: `/keys/dashboard`.
- **After checkout:** “You’re sent to the dashboard. Sign in with GitHub if you aren’t already.”
- **Key handling:** Use privacy-sensitive copy: “your key”, “API key”; never expose raw keys in UI or errors. Use masked identifiers (e.g. key prefix or hash) in support/debug text.

### Security and key copy

- In UI and docs: “your key”, “API key”, “masked in UI”, “never logged”.
- Same object model terms everywhere: Project, API Key, Provider, Plan, Usage (site, docs, dashboard, embed).

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

## 4. Application

- **Site (Astro):** MarketingLayout nav and footer use the navigation model and canonical URLs. Pricing and docs use the same links and copy conventions.
- **Dashboard (SvelteKit):** Layout and routes use the same URLs; welcome and error blocks use state conventions and copy registry terms.
- **Docs (Starlight):** Sidebar and content use Dashboard/Sign in links and product nouns from the registry.
- **Embeddable components:** KeyManager and other embeddables use the same security/key copy and state patterns (loading/error/empty/success) where applicable.

When adding or changing copy or nav, check this document and [documentation-strategy.md](documentation-strategy.md) for consistency.
