# GitHub Action — inputs, outputs, exit codes

**Action:** `packages/testing-github-action` (composite)  
**Entrypoint:** `node …/dist/main.js` → `runCiFromEnv()`  
**Execution model:** Inline runner (no HTTP polling to a control plane in `0.1.x`).

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `suite` | * | `""` | Single suite id when `suites` is empty |
| `suites` | * | `""` | Comma-separated suite ids (non-empty wins over `suite`) |
| `environment` | no | `""` | Environment id (else suite default) |
| `target_url` | no | `""` | Override `base_url` (https or http localhost) |
| `commit_sha` | no | `""` | Recorded on run (`GITHUB_SHA` if unset) |
| `pr_number` | no | `""` | Step summary only |
| `repository` | no | `""` | `GITHUB_REPOSITORY` if unset |
| `config_path` | no | `restormel-testing.yaml` | Config path relative to `working_directory` |
| `working_directory` | no | `.` | Subdir of `GITHUB_WORKSPACE` |
| `fork_pr_policy` | no | `skip` | `skip` \| `run` \| `require_label` \| `sandbox_only` |
| `is_fork_pr` | no | `false` | String `true` when `github.event.pull_request.head.repo.fork` |
| `fork_pr_required_label` | no | `""` | **Documentation only** (echo in summaries); not parsed by runner |
| `fork_pr_label_present` | no | `false` | String `true` when PR has maintainer label (workflow-computed) |
| `poll_interval_seconds` | no | `30` | Reserved; **ignored** (inline MVP) |
| `timeout_minutes` | no | `60` | Reserved; use job `timeout-minutes` |

\*One of `suite` or `suites` must be non-empty or the action exits with usage error.

## Outputs

| Output | When |
|--------|------|
| `verdict` | `passed` \| `failed` \| `indeterminate` \| `skipped` \| `error` |
| `run_id` | UUID from last executed suite; empty if skipped / error before run |
| `skipped` | String `true` or `false` — `true` if fork policy prevented execution |

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success: all suites **passed**, or fork policy **skipped** with `skip` / `require_label` (missing label) |
| `1` | Suite **failed** or **indeterminate**, or unexpected runner failure after start |
| `2` | Usage / config error before a successful run record |
| `78` | **Neutral skip:** `fork_pr_policy: sandbox_only` and fork PR skipped (no maintainer label). Use with branch-protection semantics that treat `78` as neutral if your org supports it; otherwise prefer `require_label` (exit `0` on skip). |

Environment variable mirror (optional): implementations may also respect `RESTORMEL_TESTING_NEUTRAL_EXIT=78` in the future; today **`sandbox_only`** drives exit `78` directly in code.

## Fork PR patterns

**Safe default (same-repo + skip forks):**

```yaml
fork_pr_policy: skip
is_fork_pr: ${{ github.event.pull_request.head.repo.fork }}
```

**Run on forks (public targets only):**

```yaml
fork_pr_policy: run
is_fork_pr: ${{ github.event.pull_request.head.repo.fork }}
```

**Label-gated forks (maintainer approves):**

```yaml
fork_pr_policy: require_label
is_fork_pr: ${{ github.event.pull_request.head.repo.fork }}
fork_pr_label_present: ${{ contains(join(github.event.pull_request.labels.*.name, ','), 'ok-to-test') }}
```

**Sandbox-only neutral skip:**

```yaml
fork_pr_policy: sandbox_only
is_fork_pr: ${{ github.event.pull_request.head.repo.fork }}
fork_pr_label_present: ${{ contains(join(github.event.pull_request.labels.*.name, ','), 'ok-to-test') }}
```

## Artefacts

Set `RESTORMEL_TESTING_ARTIFACT_DIR` in a custom wrapper if needed; default under `GITHUB_WORKSPACE/.restormel-testing/runs/gha-…`. Upload with `actions/upload-artifact`.

## See also

- [runs-api-v1.md](runs-api-v1.md) — future hosted control plane
- [testing-github-actions example](../../examples/testing-github-actions/README.md)
