# `@restormel/testing-runs-server`

Minimal **Runs API v1** server (`POST` / `GET /v1/runs`) that executes **`@restormel/testing-runner`** against a fixed workspace directory.

```bash
export RESTORMEL_RUNS_WORKSPACE=/abs/path/to/repo
pnpm exec restormel-testing-runs-server --port=8787
```

Documentation: [docs/testing/testing-runs-server.md](../../docs/testing/testing-runs-server.md) · Production: [docs/testing/testing-runs-server-deployment.md](../../docs/testing/testing-runs-server-deployment.md) · Contract: [docs/testing/runs-api-v1.md](../../docs/testing/runs-api-v1.md).
