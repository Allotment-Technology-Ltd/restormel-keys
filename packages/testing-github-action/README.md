# `@restormel/testing-github-action`

Composite GitHub Action that runs the **same inline runner** as the local CLI (`testing run`): load `restormel-testing.yaml`, execute browser goals, write **`report.json`**, **`summary.md`**, **`github-summary.md`**, **`junit.xml`**, plus `run.json` / `traces.json`, append a **GitHub step summary**, and **fail the step** when the suite verdict is not `passed`.

There is **no hosted control plane** in this MVP; `poll_interval_seconds` and `timeout_minutes` inputs are reserved for documentation alignment only.

## Usage

Prerequisites in your workflow (before this action):

1. Checkout the repository.
2. Install Node (20+) and pnpm (or your package manager).
3. `pnpm install` and `pnpm run build:packages` so `packages/github-action/dist/` exists.
4. `pnpm --filter @restormel/testing-browser-playwright exec playwright install chromium` (or equivalent) for browser goals.

**Keys / `judge_rubric` (optional):** pass through env (never log values), e.g.:

```yaml
env:
  RESTORMEL_KEYS_API_BASE_URL: ${{ secrets.RESTORMEL_KEYS_API_BASE_URL }}
  RESTORMEL_KEYS_API_TOKEN: ${{ secrets.RESTORMEL_KEYS_API_TOKEN }}
```

Or set `RESTORMEL_TESTING_OPENAI_FALLBACK=1` and `OPENAI_API_KEY` only with explicit team approval (documented escape hatch).

Then:

```yaml
- uses: ./packages/github-action
  with:
    suite: web-critical
    environment: local
    target_url: ${{ secrets.PREVIEW_URL }} # optional; never log the secret value
    commit_sha: ${{ github.sha }}
    pr_number: ${{ github.event.pull_request.number }}
    repository: ${{ github.repository }}
    fork_pr_policy: skip
    is_fork_pr: ${{ github.event.pull_request.head.repo.fork }}
```

## Inputs (summary)

| Input | Purpose |
|--------|---------|
| `suite` | **Required.** Suite id from config. |
| `environment` | Optional environment id (defaults to suite’s). |
| `target_url` | Optional safe `base_url` override (e.g. preview). |
| `commit_sha` | Recorded on the run (defaults to `GITHUB_SHA`). |
| `pr_number` | Shown in the step summary only. |
| `repository` | Recorded on the run (defaults to `GITHUB_REPOSITORY`). |
| `config_path` | Config file relative to `working_directory`. |
| `working_directory` | Subdirectory of the workspace to run from. |
| `fork_pr_policy` | `skip` (default) or `run` — see below. |
| `is_fork_pr` | Pass `github.event.pull_request.head.repo.fork` on PR workflows. |
| `poll_interval_seconds` | Ignored (reserved). |
| `timeout_minutes` | Ignored (reserved); use job timeout. |

## Outputs

- `verdict` — `passed` \| `failed` \| `indeterminate` \| `skipped` \| `error`
- `run_id` — UUID from `RunRecord` when the suite ran
- `skipped` — `true` when fork policy skipped execution

## Exit codes

- `0` — Suite **passed**, or fork policy **skipped** (intentionally green).
- `1` — Suite **failed** or **indeterminate**.
- `2` — Config / usage error before a successful run record.

## Fork PR safety

On `pull_request` workflows from **forks**, GitHub does not expose your repository secrets to the job. The default **`fork_pr_policy: skip`** avoids running browser suites when `is_fork_pr` is true, so contributors are not blocked by missing secrets or unreachable private URLs.

Set **`fork_pr_policy: run`** only when the suite is safe without secrets and targets a **public** URL. Do not rely on this for `pull_request_target` without a separate security review.

## GitHub Checks API

This MVP surfaces results via **step summary** Markdown and exit codes, not the GitHub **Checks** REST API. Richer check runs or annotations would be a separate optional integration later.

## See also

- [`examples/github-actions/README.md`](../../examples/github-actions/README.md)
