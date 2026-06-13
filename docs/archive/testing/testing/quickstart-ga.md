# Quickstart (GA OSS)

Minimal path from zero to a **passing deterministic** suite in CI, without Restormel Keys (no `judge_rubric` / `ac_sequence`).

## 1. Install

```bash
pnpm add -D @restormel/testing-cli@^0.1.5 @restormel/testing-bundle@^0.1.5
pnpm --filter @restormel/testing-browser-playwright exec playwright install chromium
```

(From a monorepo that already contains `packages/testing-*`, use `workspace:*` and `pnpm run build:testing-packages` instead.)

## 2. Config

Add **`restormel-testing.yaml`** at the repo root (or a path you pass with `--config`). Start from **[examples/testing-basic-web/restormel-testing.yaml](https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/examples/testing-basic-web/restormel-testing.yaml)** and replace `base_url`, suite id, and goals for your app.

## 3. Local verify

Serve your app, then:

```bash
pnpm exec testing validate --config restormel-testing.yaml
pnpm exec testing run --suite web-critical --config restormel-testing.yaml
```

## 4. CI

- **Composite Action (pinned semver tag):** [github-action-semver.md](github-action-semver.md) + [packages/testing-github-action/README.md](../../packages/testing-github-action/README.md).
- **CLI in a shell step:** same commands as local, after `pnpm install` / build and Playwright browser install.

## 5. Keys-backed goals (optional, A3)

When you add **`judge_rubric`** or **`execution_mode: ac_sequence`**, set **`RESTORMEL_KEYS_BASE`**, **`RESTORMEL_GATEWAY_KEY`**, and **`RESTORMEL_PROJECT_ID`** from **GitHub Environments / secrets** (never commit values). Checklist: [p1-byok-e2e-checklist.md](p1-byok-e2e-checklist.md). Monorepo dogfood: [testing-a3-dogfood-workflow.md](testing-a3-dogfood-workflow.md).

## Reference

- Field reference: [config-reference-mvp.md](config-reference-mvp.md)
- Schema policy: [schema-stability-policy.md](schema-stability-policy.md)
- OSS consumption: [oss-consumption.md](oss-consumption.md)
