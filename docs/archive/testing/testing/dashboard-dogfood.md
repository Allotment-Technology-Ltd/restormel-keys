# Dashboard dogfood (Restormel Testing)

**Purpose:** Run the same **goal-based browser checks** we ship to adopters against the **real** SvelteKit dashboard (`apps/dashboard`), so marketing SSR and core docs shells regressions fail in CI—not only on production.

## Config

- **[`examples/dashboard-dogfood/restormel-testing.yaml`](../../examples/dashboard-dogfood/restormel-testing.yaml)** — suite **`dashboard-critical`** (observe-only: suite home, **`/pricing`**, **`/founders`**, **`/changelog`**, Keys + Testing docs hubs; no LLM cost).

## CI

After **`pnpm --filter dashboard run build`**, the **`test`** job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml):

1. Finishes the existing **`examples/testing-basic-web`** + **`web-critical`** integration (port **4173**).
2. Starts **`vite preview`** for the dashboard on **4173** with **`--host 127.0.0.1`** (explicit bind for Playwright).
3. Runs **`testing validate`** and **`testing run --suite dashboard-critical`** against the dogfood config.

## Local (parity with CI)

From repo root, after a dashboard build:

```bash
pnpm --filter dashboard run build
(cd apps/dashboard && pnpm exec vite preview --port 4173 --strictPort --host 127.0.0.1) &
# wait until http://127.0.0.1:4173/ returns 200
pnpm run build:testing-packages
pnpm --filter @restormel/testing-browser-playwright exec playwright install chromium
node packages/testing-cli/dist/bin/testing.js validate --config examples/dashboard-dogfood/restormel-testing.yaml
node packages/testing-cli/dist/bin/testing.js run --suite dashboard-critical --config examples/dashboard-dogfood/restormel-testing.yaml
```

## Complements

- **[`scripts/smoke-dashboard-docs.sh`](../../scripts/smoke-dashboard-docs.sh)** — fast **curl** 2xx sweep (now includes **`/`**). Use for a cheap check without Playwright.
- **BYOK / agentic** suites (optional, token cost): [testing-a3-dogfood-workflow.md](testing-a3-dogfood-workflow.md).

## See also

- [testing-strategy.md](../testing-strategy.md) — repo verification scope.
- [quickstart-ga.md](quickstart-ga.md) — adopter-facing quickstart.
