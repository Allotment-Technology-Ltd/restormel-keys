# Contributing

## Phase 00 (complete)

Bootstrap complete. Gate lifted; Phase 01 implementation may begin. See [docs/bootstrap-plan.md](docs/bootstrap-plan.md) and [docs/working-agreement.md](docs/working-agreement.md).

**Cursor context:** Use **docs/bootstrap-plan.md** as the controlling Phase 00 plan and **docs/reference/bootstrap_prompts.md** as the execution companion for bootstrap work. See [docs/cursor-indexing-policy.md](docs/cursor-indexing-policy.md).

## How to work

- **Plan Mode** before non-trivial work (multi-file, security-sensitive, repo structure, CI, rules/skills/subagents).
- **One canonical source per topic.** Update the owning doc; avoid duplicating truth. See [docs/working-agreement.md](docs/working-agreement.md).
- **Exact target files;** thin slices. Prefer scripts/CI for repeatable checks.
- **Security:** No committed secrets; no raw key logging. [docs/security-baseline.md](docs/security-baseline.md) and [SECURITY.md](SECURITY.md).

## Restormel Testing (`@restormel/testing-*`)

- **Packages:** `packages/testing-*`; publish train **tag `testing-v*`** → [.github/workflows/publish-testing.yml](.github/workflows/publish-testing.yml).
- **Composite GitHub Action:** `packages/testing-github-action/` — **semver Git tags** `testing-action-v*.*.*` for consumer pins (not npm). Maintainer workflow: [.github/workflows/release-testing-action-version.yml](.github/workflows/release-testing-action-version.yml). See [docs/testing/github-action-semver.md](docs/testing/github-action-semver.md).
- **Config contract:** [docs/testing/schema-stability-policy.md](docs/testing/schema-stability-policy.md) (patch/minor/major vs `schema_version`).
- **GA quickstart (external adopters):** [docs/testing/quickstart-ga.md](docs/testing/quickstart-ga.md).

## A3 BYOK dogfood (maintainers)

Optional workflow proves Keys resolve for `judge_rubric` using **GitHub Environment** secrets — [docs/testing/testing-a3-dogfood-workflow.md](docs/testing/testing-a3-dogfood-workflow.md). No credential values belong in the repo.

## Dogfood feedback (other repos)

If you integrate Restormel Keys from another GitHub project, use **[docs/github-dogfood-feedback.md](docs/github-dogfood-feedback.md)**. For **trusted** consumer repos, the default is **label-based relay** (`restormel-feedback` → issue here); copy **[docs/reference/restormel-dogfood-relay-consumer-pack.md](docs/reference/restormel-dogfood-relay-consumer-pack.md)** into the consumer repo for setup. **Do not** put secrets in issues.

## PRs

Use the repo PR template. Confirm scope respects bootstrap constraints and canonical docs are updated as needed.
