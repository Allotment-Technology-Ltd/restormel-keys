# Consuming Restormel / Testing outside this monorepo

**Published line:** `@restormel/testing-*` **v0.1.3+** on npm — use **`pnpm add -D @restormel/testing-cli@^0.1.3`** or the meta-package **`pnpm add -D @restormel/testing-bundle@^0.1.3`** (pulls CLI + browser adaptor dependency; still run Playwright browser install as below). Pin the same semver line across peer packages if you depend on them directly.

**Plotbudget.com / Plot dogfooding:** consume the CLI from npm in the Plot app repo; keep `restormel-testing.yaml` in git and mirror CI with the composite action or `testing run` in Actions. Deterministic MVP goals do not require Restormel Keys in CI; see [plotbudget-testing-adoption-feedback.md](plotbudget-testing-adoption-feedback.md) and the dashboard guide [Keys in CI (checklist)](https://restormel.dev/testing/docs/guides/keys-ci-checklist).

## Packages to install

| You need | npm package |
|----------|-------------|
| One-line devDependency (CLI + declares browser adaptor) | `@restormel/testing-bundle` |
| CLI only (`testing` / `restormel-testing` binaries) | `@restormel/testing-cli` |
| Pull Playwright browsers for the Testing adaptor | Same workspace: run `pnpm --filter @restormel/testing-browser-playwright exec playwright install chromium` (or install browsers once in CI) |
| Composite GitHub Action | `@restormel/testing-github-action` (build `dist/` before `uses:` if you vendor from npm tarball) |

Other `@restormel/testing-*` packages are for advanced or workspace-style consumption; pin the **same minor** line across any you add directly.

## Option A — Git submodule or subtree (pin a tag)

1. Pin a **tag** or commit of `restormel-testing`.
2. In the consumer `pnpm-workspace.yaml`, add the packages path or use `pnpm` `workspace:` to the checkout.
3. Run `pnpm install`, `pnpm run build:testing-packages` (or your script that runs `tsc -b` on `tsconfig.packages.json`).
4. Add `pnpm exec testing` to CI after building packages.

## Option B — Published npm packages (registry)

```bash
pnpm add -D @restormel/testing-cli@^0.1.3
pnpm exec testing validate --config restormel-testing.yaml
```

Use the same **minor** line across `@restormel/testing-*` packages when you depend on more than the CLI. Releases ship from GitHub Actions ([`publish-testing.yml`](../.github/workflows/publish-testing.yml)) with secret **`NPM_TOKEN`**. See [npm publish checklist](npm-publish-checklist.md) for maintainers.

## Always

- Install **Playwright Chromium** for browser goals:  
  `pnpm --filter @restormel/testing-browser-playwright exec playwright install chromium`
- **Keys:** keep provider material in **CI secrets** or env — never in YAML. You only need `RESTORMEL_KEYS_*` (or OpenAI fallback) when running **`judge_rubric`** or other Keys-backed resolution; deterministic DOM goals do not use Keys in CI.
- **Hosted provider keys (Restormel dashboard):** you can store an encrypted provider API key under **Connections** and use the **Restormel Testing** dashboard page for `RESTORMEL_PROJECT_ID` and environment IDs. Resolve may return an inline key for the runner (`RESTORMEL_HOSTED_INLINE`); still use a Gateway key as `RESTORMEL_GATEWAY_KEY` (compatibility alias: `RESTORMEL_KEYS_API_TOKEN`). Canonical walkthrough: [keys-testing-onboarding.md](../keys-testing-onboarding.md).
- **Lighthouse paths** in `structured_checks` (`lighthouse:*` / `lh:*`) pull **`lighthouse`** and **`chrome-launcher`** via `@restormel/testing-runner`. They launch an extra headless Chrome; use `RESTORMEL_TESTING_SKIP_LIGHTHOUSE=1` to disable in slim jobs.

See [config-reference-mvp.md](config-reference-mvp.md) for env variable names.

## CI: GitHub Action vs HTTP pollers

Run suites with **`@restormel/testing-github-action`** or `pnpm exec testing run` in the job. The MVP does **not** expose a supported hosted HTTP runs API (`POST`/`GET` `/v1/runs`); `poll_interval_seconds` on the action is a reserved placeholder and is ignored. If you used a curl-based poller against a remote “runs” service, standardise on the Action or CLI to avoid fork drift. Public docs: [HTTP runs vs Action](https://restormel.dev/testing/docs/guides/http-runs-and-actions), [Fork PRs and workflow triggers](https://restormel.dev/testing/docs/guides/ci-security).

## Monorepo recipe (Playwright already present)

For pnpm workspaces with an app under `apps/web` (or similar), global Playwright setup, and `storageState` auth, follow the in-dashboard guide [Existing stack](https://restormel.dev/testing/docs/getting-started/existing-stack).
