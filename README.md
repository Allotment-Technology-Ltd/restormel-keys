# Restormel Keys

Library-first 'Bring Your Own Key'(BYOK) and provider-routing product. Headless core is the product; UI wrappers are delivery mechanisms.

**Phase:** 01 (gate lifted). **State:** [STATUS.md](STATUS.md) | **Plan:** [docs/bootstrap-plan.md](docs/bootstrap-plan.md)

**Docs:** [ROADMAP](ROADMAP.md) · [ARCHITECTURE](ARCHITECTURE.md) · [CONTRIBUTING](CONTRIBUTING.md) · [docs/](docs/) (canonical package)

**License:** MIT — [LICENSE](LICENSE)

---

## Packages (public integrators)

**Recommended:** Keys REST + `@restormel/keys-elements`, `@restormel/keys-cli`, `@restormel/doctor`, `@restormel/mcp`, `@restormel/aaif`. See [docs/reference/npm-packages.md](docs/reference/npm-packages.md) and [docs/guides/keys-mvp-mode.md](docs/guides/keys-mvp-mode.md).

| Package | Status | Description |
|---------|--------|-------------|
| [@restormel/keys-elements](packages/elements) | **Public** | Web Components: `<rk-key-manager>`, `<rk-model-selector>`, `<rk-cost-estimator>` |
| [@restormel/keys-cli](packages/cli) | **Public** | `keys init`, `keys login`, `keys doctor`, `keys catalog fetch` |
| [@restormel/doctor](packages/doctor) | **Public** | OSS CLI: setup and health checks |
| [@restormel/validate](packages/validate) | **Public** | OSS CLI: credential/config validation |
| [@restormel/aaif](packages/aaif) | **Public** | AAIF contract + runtime helper |
| [@restormel/mcp](packages/mcp) | **Public** | MCP tools + stdio server for agents/IDEs |
| [@restormel/keys](packages/core) | **Deprecated** | In-process core — use [Keys REST](docs/guides/npm-to-rest-keys.md) for new apps |
| [@restormel/keys-svelte](packages/svelte) | **Deprecated** | Use `@restormel/keys-elements` |
| [@restormel/keys-react](packages/react) | **Deprecated** | Use `@restormel/keys-elements` |

**Restormel Testing** (non-MVP by default — enable `restormel-module-testing` for public docs) — see [docs/restormel-monorepo-packages.md](docs/restormel-monorepo-packages.md):

| Package | Description |
|---------|-------------|
| [@restormel/testing-core](packages/testing-core) | Schemas, verdict model, run contract |
| [@restormel/testing-config](packages/testing-config) | Config load + MVP validation |
| [@restormel/testing-runner](packages/testing-runner) | Suite execution |
| [@restormel/testing-cli](packages/testing-cli) | `testing` / `restormel-testing` CLI |
| [@restormel/testing-github-action](packages/testing-github-action) | Composite GitHub Action |
| … | (`testing-report`, `testing-keys-adapter`, `testing-browser-playwright`) |

*(Vue wrapper is not published.)*

**Monorepo / Vercel / publish tags:** [docs/restormel-monorepo-packages.md](docs/restormel-monorepo-packages.md) · [docs/monorepo-vercel.md](docs/monorepo-vercel.md)

---

## Quick start

**Keys REST (recommended — no npm core):**

```bash
export RESTORMEL_KEYS_BASE=https://restormel.dev
export RESTORMEL_GATEWAY_KEY=rk_…   # from Dashboard → Gateway keys
curl -sS -X POST "$RESTORMEL_KEYS_BASE/keys/v1/projects/$RESTORMEL_PROJECT_ID/resolve" \
  -H "Authorization: Bearer $RESTORMEL_GATEWAY_KEY" \
  -H "Content-Type: application/json" \
  -d '{"workload":"chat"}'
```

**Web Components UI:**

```bash
pnpm add @restormel/keys-elements
```

**CLI + doctor:**

```bash
pnpm add -D @restormel/keys-cli @restormel/doctor
pnpm exec keys login
pnpm exec keys doctor
```

Legacy in-process `@restormel/keys` npm remains in **maintenance mode** until 2026-12-01 — see [npm-to-rest-keys.md](docs/guides/npm-to-rest-keys.md). Do not start new integrations on `@restormel/keys-svelte` or `@restormel/keys-react`.

If `keys-cli` is unavailable, create `restormel.config.json` manually — see [docs/reference/npm-packages.md](docs/reference/npm-packages.md).

### CLI choices (what to use when)

- **`@restormel/doctor`**: local setup + repo inventory checks (great for “is this wired correctly?”).\n
- **`@restormel/validate`**: credential health gates (great for CI; stable exit codes).\n
- **`@restormel/keys-cli`**: onboarding and wrappers (`keys init/add/list/estimate`, plus `keys doctor/validate` delegating to the wedge CLIs).

See the public docs page: `/keys/docs/reference/cli` in the dashboard app.

---

## Publish (Phase 2)

CI builds **`@restormel/aaif`** and **`@restormel/mcp`** on every main/PR run (with keys + keys-svelte) via [.github/workflows/ci.yml](.github/workflows/ci.yml). Local full quality: `pnpm run quality` (includes AAIF + MCP build).

Publishing is **tag-driven only**. The [Publish workflow](.github/workflows/publish.yml) runs only when a git tag matching **`keys-v*`** is pushed (for example `keys-v0.2.9`).

Release process for npm packages:
1. Bump versions for every package you intend to release.
2. Ensure package quality checks pass (`pnpm run build` and relevant tests).
3. Merge release-ready changes to `main`.
4. Create and push a release tag: `git tag keys-vX.Y.Z && git push origin keys-vX.Y.Z`.

If a PR changes any publishable package under `packages/` (for example `@restormel/keys`, `@restormel/keys-cli`, `@restormel/validate`, `@restormel/doctor`, `@restormel/mcp`, `@restormel/keys-svelte`, `@restormel/aaif`), you must include a release-tag follow-up in the rollout plan or those changes will not ship to npm.

The publish train runs in this order: **`@restormel/keys`** (`npm publish` from `packages/core`) → **`@restormel/keys-svelte`** (`pnpm publish`) → **`@restormel/keys-elements`** (`pnpm publish`) → **`@restormel/keys-react`** (`pnpm publish`) → **`@restormel/aaif`** (`pnpm publish`) → **`@restormel/mcp`** (`pnpm publish`, rewrites `workspace:*` on keys) → doctor → validate → keys-cli.

**keys-cli**, **validate**, and **mcp** use **`pnpm publish`** so `@restormel/keys` becomes a semver range in the consumer tarball (not `workspace:*`). Do not publish the Vue wrapper. Test files are not included in `files` and stay in the repo.

**First publish of a new scoped name** (e.g. `@restormel/mcp` on npm): the `NPM_TOKEN` must have permission to create packages under the `@restormel` org; use an **automation** token with publish access. If the workflow returns **404** on publish, confirm org settings and token scope on npmjs.com.
