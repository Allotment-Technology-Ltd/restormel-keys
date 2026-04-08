# GitHub Actions examples

## Restormel / Testing composite action

**Next.js quickstart (local dev server):** [`../nextjs-playwright/README.md`](../nextjs-playwright/README.md) — two-goal observe-only `web-critical` suite on `http://127.0.0.1:3040`.

The action lives at [`../../packages/testing-github-action`](../../packages/testing-github-action) in this repository. Point `uses:` at that path (or at your published fork) **after** a step that installs dependencies and builds TypeScript packages, and **after** installing Playwright browsers if you run browser goals.

See [`sample-workflow.yml`](./sample-workflow.yml) for a full `pull_request` example. It runs against [`restormel-testing.ci-example.yaml`](./restormel-testing.ci-example.yaml) (public `example.com` smoke) so the job can pass without a preview server; swap in your real config for production use.

**Fork PR + maintainer label (`ok-to-test`):** [`sample-workflow-fork-label-ok-to-test.yml`](./sample-workflow-fork-label-ok-to-test.yml) — `fork_pr_label_present` via `contains(join(github.event.pull_request.labels.*.name, ','), 'ok-to-test')`, with `testing-basic-web` served on port 4173 (same pattern as monorepo CI).

## Fork pull requests (safe defaults)

- **Default:** `fork_pr_policy: skip` and `is_fork_pr: ${{ github.event.pull_request.head.repo.fork }}`. Fork PR workflows **do not** run the suite unless you opt in. That avoids failing jobs that cannot access repository secrets or private preview URLs.
- **Branch protection:** when the action **skips**, the step exits **0** (green). If you need a required check to show “tests did not run”, add a separate job or policy (see [hardening follow-up review](../../docs/testing/restormel-testing-hardening-follow-up-review.md)).
- **Same-repo PRs** run normally (`is_fork_pr` is false).
- **To run on forks:** set `fork_pr_policy: run` and ensure goals target **public** URLs only and do not rely on `secrets.*` (fork workflows from outside collaborators do not receive those secrets on `pull_request`).
- Prefer the `pull_request` event unless you have a specific, reviewed reason to use `pull_request_target` (which has different security properties). In-app explainer: [`/testing/docs/guides/ci-security`](https://restormel.dev/testing/docs/guides/ci-security).

## Inline MVP (no polling, no HTTP runs API)

The current action executes the runner **in the job** (same as `testing run`). There is **no** supported hosted `POST`/`GET` `/v1/runs` API in `0.1.x`; use the Action or CLI. Inputs `poll_interval_seconds` and `timeout_minutes` are documented placeholders for a possible future hosted mode and are **ignored** today. Use [`jobs.<job>.timeout-minutes`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idtimeout-minutes) or step timeouts instead. Background: [`/testing/docs/guides/http-runs-and-actions`](https://restormel.dev/testing/docs/guides/http-runs-and-actions).

## Artefacts

The runner writes under `.restormel-testing/runs/` (or `RESTORMEL_TESTING_ARTIFACT_DIR` if you set it in a custom wrapper). Each run directory includes **`report.json`** (stable schema v1 triage bundle), **`summary.md`**, **`github-summary.md`**, **`junit.xml`**, `run.json`, `traces.json`, optional `warnings.txt`, and screenshot paths under `goals/` when enabled. Use `actions/upload-artifact` to retain them in CI.

**Multiple suites in one step:** pass `suites: id-one,id-two` on the composite action (or use repeated `--suite` / `--suites` with the CLI). Artefacts land in per-suite subfolders under the same base directory so files are not overwritten.
