# Restormel Keys

Library-first 'Bring Your Own Key'(BYOK) and provider-routing product. Headless core is the product; UI wrappers are delivery mechanisms.

**Phase:** 01 (gate lifted). **State:** [STATUS.md](STATUS.md) | **Plan:** [docs/bootstrap-plan.md](docs/bootstrap-plan.md)

**Docs:** [ROADMAP](ROADMAP.md) · [ARCHITECTURE](ARCHITECTURE.md) · [CONTRIBUTING](CONTRIBUTING.md) · [docs/](docs/) (canonical package)

**License:** MIT — [LICENSE](LICENSE)

---

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [@restormel/keys](packages/core) | 0.2.5 | Headless core: routing, cost, providers (OpenAI, Anthropic, Google), storage, server middleware |
| [@restormel/keys-svelte](packages/svelte) | 0.1.0 | Svelte 5: KeyManager, ModelSelector, CostEstimator |
| [@restormel/keys-elements](packages/elements) | 0.1.0 | Web Components: `<rk-key-manager>`, `<rk-model-selector>`, `<rk-cost-estimator>` |
| [@restormel/keys-react](packages/react) | 0.1.0 | React 18+: KeyManager, ModelSelector, CostEstimator, hooks, KeysProvider |
| [@restormel/doctor](packages/doctor) | 0.1.8 | OSS CLI: setup and health checks (`restormel-doctor`) |
| [@restormel/validate](packages/validate) | 0.1.8 | OSS CLI: credential/config validation (`restormel-validate`) |
| [@restormel/keys-cli](packages/cli) | 0.1.2 | Wrapper CLI: `keys init`, `keys add`, `keys list`, `keys validate`, `keys doctor`, `keys estimate` |
| [@restormel/aaif](packages/aaif) | 0.0.1 | AAIF contract + runtime helper (routing + cost estimation) |
| [@restormel/mcp](packages/mcp) | 0.1.0 | MCP tools + stdio server (`restormel-mcp`) for agents/IDEs |

*(Vue wrapper is not published.)*

---

## Quick start

**Core only (headless):**

```bash
pnpm add @restormel/keys
```

```ts
import { createKeys, openaiProvider, anthropicProvider } from "@restormel/keys";

const keys = createKeys(
  { routing: { defaultProvider: "openai" } },
  { providers: [openaiProvider, anthropicProvider] }
);
const resolved = await keys.resolve("openai", "gpt-4o");
const cost = keys.estimateCost("gpt-4o-mini");
```

**With React (e.g. Next.js App Router):**

```bash
pnpm add @restormel/keys @restormel/keys-react @restormel/keys-elements
```

Use `KeysProvider`, `KeyManager`, `ModelSelector` in a client component; fetch keys from your API and pass config. See [apps/demo-next](apps/demo-next) (Next.js) or [apps/demo-svelte](apps/demo-svelte) (SvelteKit) for full examples.

**With Svelte (Phase 5 UI — when `@restormel/keys-svelte` is on npm):**

```bash
pnpm add @restormel/keys @restormel/keys-svelte
```

**SvelteKit headless (Phases 1–4):** `pnpm add @restormel/keys` only; `npx @restormel/doctor` passes without UI packages.

**CLI (when published):**

```bash
pnpm add -D @restormel/keys-cli
npx keys init
npx keys add openai
npx @restormel/doctor
```

If `keys-cli` is unavailable, create `restormel.config.json` manually — see [docs/reference/npm-packages.md](docs/reference/npm-packages.md) and Phase 1 walkthrough.

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

The publish train runs in this order: **`@restormel/keys`** (`npm publish` from `packages/core`) → **`@restormel/keys-svelte`** (`pnpm publish`) → **`@restormel/aaif`** (`pnpm publish`) → **`@restormel/mcp`** (`pnpm publish`, rewrites `workspace:*` on keys) → doctor → validate → keys-cli.

**keys-cli**, **validate**, and **mcp** use **`pnpm publish`** so `@restormel/keys` becomes a semver range in the consumer tarball (not `workspace:*`). Do not publish the Vue wrapper. Test files are not included in `files` and stay in the repo.

**First publish of a new scoped name** (e.g. `@restormel/mcp` on npm): the `NPM_TOKEN` must have permission to create packages under the `@restormel` org; use an **automation** token with publish access. If the workflow returns **404** on publish, confirm org settings and token scope on npmjs.com.
