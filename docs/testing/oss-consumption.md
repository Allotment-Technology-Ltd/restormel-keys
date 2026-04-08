# Consuming Restormel / Testing outside this monorepo

**Published line:** `@restormel/testing-*` **v0.1.0+** on npm — use **`pnpm add -D @restormel/testing-cli@^0.1.0`** (and install Playwright Chromium as below). Pin the same semver line across peer packages if you depend on them directly.

**Plotbudget.com / Plot dogfooding:** consume the CLI from npm in the Plot app repo; keep `restormel-testing.yaml` in git and mirror CI with the composite action or `testing run` in Actions.

## Option A — Git submodule or subtree (pin a tag)

1. Pin a **tag** or commit of `restormel-testing`.
2. In the consumer `pnpm-workspace.yaml`, add the packages path or use `pnpm` `workspace:` to the checkout.
3. Run `pnpm install`, `pnpm run build:testing-packages` (or your script that runs `tsc -b` on `tsconfig.packages.json`).
4. Add `pnpm exec testing` to CI after building packages.

## Option B — Published npm packages (registry)

```bash
pnpm add -D @restormel/testing-cli@^0.1.0
pnpm exec testing validate --config restormel-testing.yaml
```

Use the same **minor** line across `@restormel/testing-*` packages when you depend on more than the CLI. Releases ship from GitHub Actions ([`publish-npm.yml`](../.github/workflows/publish-npm.yml)) with secret **`NPM_TOKEN`**. See [npm publish checklist](npm-publish-checklist.md) for maintainers.

## Always

- Install **Playwright Chromium** for browser goals:  
  `pnpm --filter @restormel/testing-browser-playwright exec playwright install chromium`
- Keep **Keys** / provider material in **CI secrets** or env — never in YAML.

See [config-reference-mvp.md](config-reference-mvp.md) for env variable names.
