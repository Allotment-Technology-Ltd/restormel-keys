# `@restormel/connect-eval-github-action`

Composite GitHub Action for the **Connect context-regression CI gate** (verified-context roadmap, Stage 2.3): runs the same `keys connect eval --baseline` as the local CLI, appends a **GitHub step summary**, posts/updates **one sticky PR comment** with the regression diff table, and **fails the check** on a quality-bar miss or a regression vs the committed baseline.

There is exactly **one** comment per PR per gate: the action finds its previous comment by an invisible HTML marker (`<!-- restormel-connect-eval[:discriminator] -->`) and edits it in place — no comment spam on repeated pushes.

## Usage

Prerequisites in your workflow (before this action) — same model as [`packages/testing-github-action`](../testing-github-action/README.md):

1. Checkout the repository.
2. Install Node (20+) and pnpm.
3. Build the keys CLI and this action so both `dist/` folders exist:
   `pnpm --filter @restormel/keys-cli run build && pnpm --filter @restormel/connect-eval-github-action run build`
   (the CLI build needs its workspace deps built first — see [.github/workflows/connect-eval-gate.yml](../../.github/workflows/connect-eval-gate.yml) for the exact filter list).

Then either **remote mode** (evaluate the latest ingest run of a workspace through the gateway-key-authed Connect v1 API):

```yaml
permissions:
  contents: read
  pull-requests: write # sticky comment

- uses: ./packages/connect-eval-github-action
  with:
    gateway_key: ${{ secrets.RESTORMEL_GATEWAY_KEY }} # never logged
    workspace: ${{ vars.RESTORMEL_WORKSPACE_ID }}
    project: ${{ vars.RESTORMEL_PROJECT_ID }} # optional
    baseline_path: ci/connect-eval-baseline.json # from `keys connect eval --save-baseline`
    tolerance: '1'
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

or **local counts mode** (no network, no key — evaluate a counts/quality-report JSON produced by any pipeline):

```yaml
- uses: ./packages/connect-eval-github-action
  with:
    counts_path: .artifacts/quality-report.json
    baseline_path: ci/connect-eval-baseline.json
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs (summary)

| Input | Purpose |
|---|---|
| `gateway_key` | **Secret.** Restormel gateway key for remote mode; forwarded to the CLI via env (`RESTORMEL_GATEWAY_KEY`), never argv, never logged. |
| `workspace` / `project` | Workspace (required for remote mode) and optional project ref. |
| `job_id` | Pin a specific ingest job (default: latest run with a quality report). |
| `counts_path` | Local mode: counts/quality-report JSON. Mutually exclusive with remote mode. |
| `baseline_path` | Committed baseline from `keys connect eval --save-baseline`; enables the regression diff (exit 3). |
| `tolerance` | Allowed `ok_pct`/`trust_score` drop in points (CLI default 1). |
| `warn_only` | `"true"` = non-blocking: quality fail (1) and regression (3) exit 0; config errors (2) still fail. |
| `github_token` | `secrets.GITHUB_TOKEN` for the sticky comment (`pull-requests: write`). Empty = no comment. |
| `sticky_comment` / `comment_discriminator` / `pr_number` | Comment controls (disable, multiple gates per PR, PR override). |
| `site_base` | Restormel site origin override (default `https://restormel.dev`). |
| `working_directory` | Subdirectory of the workspace to run from. |
| `cli_js` | Path to the built `@restormel/keys-cli` entry; default is the monorepo sibling `packages/cli/dist/index.js`. |

## Outputs

- `verdict` — `pass` \| `quality_fail` \| `regression` \| `config_error` \| `error`
- `exit_code` — raw CLI exit code (`0/1/2/3`) **before** any warn-mode downgrade
- `regression` — `"true"` when the baseline diff flagged a regression
- `commented` — `"true"` when the sticky comment was created or updated

## Exit codes

Mirrors the `keys connect eval` contract (Stage 2.1/2.2):

- `0` — quality bar met, no regression (or warn mode downgraded a 1/3).
- `1` — graph misses the published G2 bar (≥90% supported, ≤2% unsupported).
- `2` — config / usage error (bad inputs, missing CLI build, unreadable baseline). **Never** downgraded by warn mode — a broken gate must be loud.
- `3` — quality regressed vs the committed baseline beyond the tolerance.

## Warn mode → blocking

This repo dogfoods the gate in **warn mode** (`warn_only: 'true'`) against the philosophy-starter gate fixture ([scripts/ci/connect-eval/](../../scripts/ci/connect-eval/)). Flip to blocking (`warn_only: 'false'`) once **both** hold:

1. the gate evaluates a **live ingest** (remote mode with `RESTORMEL_GATEWAY_KEY`) rather than the pinned counts fixture, and
2. the committed baseline has been re-saved from that live run (`keys connect eval --save-baseline`).

## Baseline lifecycle

- Save: `keys connect eval ... --save-baseline ci/connect-eval-baseline.json` and commit the file.
- Baselines are keyed by the source-set fingerprint: when the corpus changes, the diff reports **baseline superseded** (never a regression) and the comment tells you to re-save.
- Tune `tolerance` instead of deleting the baseline when integer-rounding jitter bites.

## Forgejo

The sticky comment uses the GitHub-compatible issues API at `GITHUB_API_URL`, which Forgejo also serves — the same action works in `.forgejo/workflows` (see [.forgejo/workflows/connect-eval-gate.yml](../../.forgejo/workflows/connect-eval-gate.yml)). Remember `.forgejo/workflows` **overrides** `.github/workflows` on the Forgejo mirror: keep both copies of the gate in sync.

## See also

- Guide: [Context-regression CI](https://restormel.dev/keys/docs/guides/context-regression-ci) (same content in the in-app docs)
- Claims integrity: [.github/workflows/connect-efficacy-weekly.yml](../../.github/workflows/connect-efficacy-weekly.yml) + [docs/product/verified-context-claims-ledger.md](../../docs/product/verified-context-claims-ledger.md)
