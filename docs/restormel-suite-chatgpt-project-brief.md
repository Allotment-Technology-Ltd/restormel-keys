# Restormel suite — ChatGPT Projects briefing (single file)

**Purpose:** One markdown file to attach or paste into **ChatGPT Projects** (or similar) and **re-sync often** (e.g. daily) from this repo so assistants stay aligned with the suite.

**Status:** **Reference companion.** It does **not** replace canonical docs; it **points** to them. When process, repos, or tags change, update **this file** and the linked canonical sources.

**Canonical repos (GitHub):**

| Repo | Role |
|------|------|
| [restormel-keys](https://github.com/Allotment-Technology-Ltd/restormel-keys) | Keys product monorepo: `@restormel/keys`, dashboard, `aaif`, `mcp`, docs, dogfood. **`keys-v*`** tags → library publish. |
| [restormel-platform](https://github.com/Allotment-Technology-Ltd/restormel-platform) | Suite-wide: **`@restormel/keys-tokens`** source + **`tokens-v*`** npm publish, shared GitHub composites, `cursor-template`, `template-restormel-module` sources. |
| [restormel-module-template](https://github.com/Allotment-Technology-Ltd/restormel-module-template) | GitHub **Template** for new modules; keep in sync with `platform/template-restormel-module/` in keys (or platform). |

---

## Non-negotiable boundaries (avoid drift)

1. **Design token source** (`@restormel/keys-tokens` CSS/TS contracts): edit and publish from **restormel-platform** only; **do not** reintroduce a second token source of truth in keys or module repos. Keys dashboard consumes tokens from **npm** (semver range in `apps/dashboard/package.json`).
2. **New product modules** (e.g. Testing): follow the **default stack** doc; use **`@restormel/keys-tokens`** from npm unless you intentionally pin `file:` to a local platform clone for development.
3. **Suite-wide** CI composite patterns and module **scaffold** changes: canonical copies live under **restormel-platform** (and are mirrored under `platform/` in keys for convenience); if you change something every module should share, update **platform** and sync consumers.

**Quick check:** *Would another Restormel module copy this unchanged?* **Yes** → **restormel-platform** (then consume via npm or template). **No** → **that product repo** (keys vs testing vs other).

---

## Canonical documents (read these for detail)

| Topic | File in restormel-keys (on `main`) |
|--------|-----------------------------------|
| Keys monorepo map, packages, integrations seam | [`ARCHITECTURE.md`](../ARCHITECTURE.md) |
| Suite `platform/` split, npm tokens, deferred extractions | [`docs/platform-modularization.md`](./platform-modularization.md) |
| New module default stack (pnpm, SvelteKit, Vercel, Neon, Actions) | [`docs/restormel-module-default-stack.md`](./restormel-module-default-stack.md) |
| GitHub template + init script | [`docs/template-restormel-module-repo.md`](./template-restormel-module-repo.md) |
| Design system entry (tokens, alignment, drift checks) | [`docs/design-system-index.md`](./design-system-index.md) |
| Frozen CI/hosting snapshot (reference, not live config) | [`docs/platform-inventory.md`](./platform-inventory.md) |
| Security / redaction | [`docs/security-baseline.md`](./security-baseline.md) |
| Keys + Restormel Testing onboarding | [`docs/keys-testing-onboarding.md`](./keys-testing-onboarding.md) |
| Human + agent index for keys repo | [`AGENTS.md`](../AGENTS.md) |

**Raw URLs (for link-based project sources):** replace `main` if you pin a branch/tag.

- `https://raw.githubusercontent.com/Allotment-Technology-Ltd/restormel-keys/main/docs/restormel-suite-chatgpt-project-brief.md` ← **this file**
- `https://raw.githubusercontent.com/Allotment-Technology-Ltd/restormel-keys/main/ARCHITECTURE.md`
- `https://raw.githubusercontent.com/Allotment-Technology-Ltd/restormel-keys/main/docs/platform-modularization.md`
- `https://raw.githubusercontent.com/Allotment-Technology-Ltd/restormel-keys/main/docs/restormel-module-default-stack.md`

---

## Publish tags (memory aid)

| Artifact | Tag pattern | Where |
|----------|-------------|--------|
| Keys libraries (`@restormel/keys`, UI packages, `mcp`, etc.) | `keys-v*` | **restormel-keys** workflows |
| Design tokens npm package | `tokens-v*` | **restormel-platform** |

---

## Maintenance checklist (for humans editing the repo)

When any of the following change, **edit this briefing** so ChatGPT Projects stay accurate:

- Token consumption path (npm package name, major workflow, or dashboard dep).
- Canonical GitHub org/repo names or template URL.
- Default stack defaults (Node/pnpm major, framework choice).
- Deferred extractions (Integrations, dashboard-only repo) moving from deferred to active.
- New **canonical** doc that should appear in the table above.

Also update [`CHANGELOG.md`](../CHANGELOG.md) when this file’s meaning materially changes.

---

## ChatGPT instruction snippet (optional)

Paste below the uploaded file in the project instructions:

```text
Treat docs/restormel-suite-chatgpt-project-brief.md as the suite orientation layer. For implementation detail, follow the canonical files it links to (especially ARCHITECTURE.md, platform-modularization.md, restormel-module-default-stack.md). Do not duplicate design token sources outside restormel-platform; do not commit secrets.
```
