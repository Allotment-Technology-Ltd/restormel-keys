# Next.js + Playwright-style goals (Restormel / Testing)

**~5-minute quickstart** — no private credentials, no Keys required (deterministic goals only).

## Prerequisites

From the **monorepo root** (once per machine):

```bash
pnpm install
pnpm run build:testing-packages
pnpm --filter @restormel/testing-browser-playwright exec playwright install chromium
```

## Run locally

Terminal A — install example deps and start Next (first time: `pnpm install` from this directory):

```bash
cd examples/nextjs-playwright
pnpm install
pnpm dev
```

Terminal B — validate and run the two-goal observe-only `web-critical` suite (same shape as `examples/testing-basic-web`):

```bash
cd examples/nextjs-playwright
pnpm exec testing validate --config restormel-testing.yaml
pnpm exec testing run --suite web-critical --config restormel-testing.yaml
```

Artefacts are written under `.restormel-testing/runs/` (see `testing report <dir>`).

## CI / preview URLs

Point `environments.local.base_url` at your **Vercel preview** or set the Action input `target_url` to the preview origin. Keep cookies/session in a `storage_state` file via hooks if needed — see [keys-testing-onboarding.md](../../docs/keys-testing-onboarding.md) and the dashboard Testing docs.

## GitHub Actions

See [examples/testing-github-actions/README.md](../testing-github-actions/README.md) and [docs/archive/testing/testing/github-action-io-spec.md](../../docs/archive/testing/testing/github-action-io-spec.md).
