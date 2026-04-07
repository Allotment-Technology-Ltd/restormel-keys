# Restormel module — default core stack

**Status:** Canonical. **Single source of truth** for what new Restormel-owned modules should assume unless a written ADR opts out. Use this for GitHub repo templates, init scripts, and agent prompts.

**Scope:** Product-facing web apps and adjacent services under the Restormel brand (e.g. future `restormel.dev/<module>`). Library-only repos may use a **subset** (pnpm, TS, Actions, tokens only).

## Principles

1. **One default path** — Prefer the same tooling as [apps/dashboard](../apps/dashboard) so you reuse mental model, CI patterns, and `@restormel/keys-tokens`.
2. **Explicit variants** — Next.js, Cloudflare Workers, or Python are **documented alternatives**, not silent drift.
3. **Platform packages** — Consume [platform/](../platform/) (or published `@restormel/keys-tokens`) and shared GitHub composite actions from [platform/.github/actions/](../platform/.github/actions/) where applicable.

## Default stack (full-stack product module)

| Layer | Default | Notes |
|--------|---------|--------|
| **Language** | **TypeScript** | Strict mode; ESM (`"type": "module"`) where the app framework expects it. |
| **Runtime** | **Node.js 20.x** | Match dashboard `engines`; CI uses Node 20. |
| **Package manager** | **pnpm 9.x** | Pin via root `packageManager` in `package.json` (e.g. `pnpm@9.0.0`). |
| **Monorepo** | **pnpm workspaces** | `pnpm-workspace.yaml` with `packages/*`, `apps/*` as needed; keep apps thin. |
| **App framework** | **SvelteKit 2 + Vite** | Same class as Keys dashboard: file-based routes, server loads, adapters. |
| **UI runtime** | **Svelte 5** | Keys reference UI; use `@restormel/keys-tokens` for `--rm-*` / `--rk-*` alignment. |
| **React / Next** | **Not default** | Use for a module that explicitly targets the React ecosystem; see **Variant A** below. |
| **Python** | **Not default** | Use for batch jobs, ML, or dedicated APIs when required; see **Variant B**. Do not mix as the primary web app stack without an ADR. |
| **Database** | **Neon (Postgres)** | Serverless driver patterns as in dashboard (`@neondatabase/serverless`, migrations as SQL in-repo). |
| **Auth** | **Product-specific** | Keys uses session + Gateway keys + OIDC surfaces on Better Auth / Neon Auth patterns; new modules **document** cookie domain and issuer URLs if they share `restormel.dev`. |
| **Hosting** | **Vercel** | SvelteKit via `@sveltejs/adapter-vercel`; root `vercel.json` pattern: `pnpm install`, `pnpm --filter <app> build`. |
| **CI/CD** | **GitHub Actions** | Path-filtered workflow on `main`/`master`; reuse **pnpm install** + **JS security** composites ([.github/actions/pnpm-workspace-install](../.github/actions/pnpm-workspace-install), [js-security-scan](../.github/actions/js-security-scan)). Add module-specific jobs (tests, E2E) behind filters. |
| **E2E (optional)** | **Playwright** | Chromium-first; align with [apps/demo-next](../apps/demo-next) pattern if you ship a browser UI. |
| **Unit / component tests** | **Vitest** | Matches dashboard app. |
| **Analytics (optional)** | **PostHog** | Only if the module needs product analytics; use env-based config, no secrets in repo. |
| **Design tokens** | **`@restormel/keys-tokens`** | From workspace `platform/packages/tokens` or npm after [platform split](./platform-modularization.md). |
| **Secrets** | **GitHub Actions secrets + host env** | Never commit credentials; follow [security-baseline.md](./security-baseline.md). |

## Variant A — Next.js (React) module

Use when the module **must** ship on Next.js (e.g. ecosystem constraints, team skill).

| Layer | Choice |
|--------|--------|
| Framework | **Next.js** (modern stable major in repo today: see [apps/demo-next/package.json](../apps/demo-next/package.json)) |
| UI | **React 18+** with **`@restormel/keys-react`** / **`@restormel/keys-elements`** when integrating Keys |
| Hosting | **Vercel** (native Next support) |
| Rest | Same: **pnpm**, **Node 20**, **TypeScript**, **Neon** if stateful, **GitHub Actions** |

## Variant B — Python service or job

Use for **non-primary** web surfaces: workers, cron, ML inference, internal tooling.

| Layer | Choice |
|--------|--------|
| Language | **Python 3.11+** (pin in `pyproject.toml` or `.python-version`) |
| Packaging | **uv** or **pip** + lockfile; one clear entrypoint |
| CI | **GitHub Actions** with `actions/setup-python`; reuse org **secret naming** conventions |
| API / HTTP | **FastAPI** or minimal **Starlette** if exposing HTTP; or batch-only (no HTTP) |
| DB | **Neon** via `asyncpg` / SQLAlchemy if needed |

Python modules **do not** replace the default web stack; they complement it (call from TS app via HTTP or queue).

## Variant C — Edge / Workers (future)

If a module must run on **Cloudflare Workers** or similar, document **adapter**, **env binding**, and **D1 / Hyperdrive / external Neon** explicitly in the module README. Not the default until an ADR adopts it suite-wide.

## Scaffold and GitHub template (implemented)

- **Template files:** [platform/template-restormel-module/](../platform/template-restormel-module/) — SvelteKit `apps/web`, pnpm workspace, `vercel.json`, CI workflow, vendored `.github/actions`, `.cursor` rules, `env.example` (renamed to `.env.example` by the init script).
- **Init script:** `pnpm run init-module -- --out <dir> --slug <kebab> --title "<name>" [--path <segment>] [--keys-repo <path-to-keys>]` (runs [scripts/init-restormel-module.mjs](../scripts/init-restormel-module.mjs)).
- **How to publish as a GitHub Template repo:** [template-restormel-module-repo.md](./template-restormel-module-repo.md).

## What the GitHub repo template should include

Minimum files and folders. The **implemented** tree under `platform/template-restormel-module/` matches this checklist (init script fills names; manual template publish requires find-replace for `__…__` placeholders):

- [ ] Root `package.json` with `packageManager: "pnpm@9.0.0"` and `engines.node`
- [ ] `pnpm-workspace.yaml` and committed `pnpm-lock.yaml`
- [ ] `apps/<module-web>/` SvelteKit app (or Next app for Variant A) with README
- [ ] `.github/workflows/ci.yml` calling **`pnpm-workspace-install`** then typecheck/test/build
- [ ] `.github/actions/` **or** `uses: <org>/restormel-platform/.github/actions/...` at pinned ref
- [ ] Dependency on **`@restormel/keys-tokens`** (workspace path or semver)
- [ ] `.cursor/rules/` from [platform/cursor-template/](../platform/cursor-template/) + product-specific rules
- [ ] `AGENTS.md` linking [security-baseline.md](./security-baseline.md) and this doc
- [ ] `vercel.json` (or host-specific config) with explicit `installCommand` / `buildCommand`
- [ ] `.env.example` with **placeholder** names only (no realistic secrets)
- [ ] `LICENSE` aligned with org

Optional:

- [ ] Neon branch workflow (copy pattern from Keys [neon_workflow.yml](../.github/workflows/neon_workflow.yml) if using preview DBs)
- [ ] `migrations/*.sql` convention if the module has Postgres state

## Initiation prompt (copy for Cursor / ChatGPT)

Use after creating an empty repo from the template (or before, to generate the scaffold).

```text
You are scaffolding a new Restormel product module. Follow the canonical stack in docs/restormel-module-default-stack.md (in the restormel-keys repo) or the equivalent AGENTS.md in this repo.

Requirements:
- pnpm 9 workspaces, Node 20, TypeScript, ESM where applicable.
- Default web stack: SvelteKit 2 + Vite + Svelte 5 + adapter-vercel unless I said “Variant A Next.js”.
- Use @restormel/keys-tokens for design tokens (import CSS layers or contracts).
- CI: GitHub Actions with path filters; use composite actions for pnpm install and TruffleHog + pnpm audit where available.
- No secrets in repo; .env.example with obvious placeholders only.
- Add AGENTS.md pointing to security baseline and this stack doc.
- If the module needs Postgres, use Neon + SQL migrations in-repo; document DATABASE_URL usage.

Module name: <NAME>
Public path on restormel.dev: /<PATH>
Deliver: file tree, key package.json scripts, and a short README “Local dev” + “Deploy” section.
```

Replace `<NAME>` and `<PATH>` before sending.

## Related docs

- [platform-modularization.md](./platform-modularization.md) — splitting `platform/` and npm `tokens-v*`
- [platform-inventory.md](./platform-inventory.md) — Keys repo CI/hosting facts
- [design-system-index.md](./design-system-index.md) — tokens and UI contracts
- [platform/docs/cursor-init.md](../platform/docs/cursor-init.md) — Cursor skills/symlinks for new repos

## Changing this default

Any deviation from the table above for a **new** module should be recorded in `docs/decisions/` (short ADR) or the module README **“Stack rationale”** section so the suite does not accrete accidental one-offs.
