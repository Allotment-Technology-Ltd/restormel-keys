# Contributing

## Phase 00 (complete)

Bootstrap complete. Gate lifted; Phase 01 implementation may begin. See [docs/archive/2026-03-build-pack/bootstrap-plan.md](docs/archive/2026-03-build-pack/bootstrap-plan.md) and [docs/governance/working-agreement.md](docs/governance/working-agreement.md).

**Cursor context:** Use **docs/archive/2026-03-build-pack/bootstrap-plan.md** as the controlling Phase 00 plan and **docs/reference/bootstrap_prompts.md** as the execution companion for bootstrap work. See [docs/governance/cursor-indexing-policy.md](docs/governance/cursor-indexing-policy.md).

## How to work

- **Plan Mode** before non-trivial work (multi-file, security-sensitive, repo structure, CI, rules/skills/subagents).
- **One canonical source per topic.** Update the owning doc; avoid duplicating truth. See [docs/governance/working-agreement.md](docs/governance/working-agreement.md).
- **Exact target files;** thin slices. Prefer scripts/CI for repeatable checks.
- **Security:** No committed secrets; no raw key logging. [docs/governance/security-baseline.md](docs/governance/security-baseline.md) and [SECURITY.md](SECURITY.md).
- **Before PRs:** Run [docs/guides/pre-pr-security-review.md](docs/guides/pre-pr-security-review.md) (Cursor skill **restormel-high-risk-security**). Local gate complements CI `security` (TruffleHog + `pnpm audit`); it does not replace it.

## Restormel Testing (`@restormel/testing-*`)

- **Packages:** `packages/testing-*`; publish train **tag `testing-v*`** → [.github/workflows/publish-testing.yml](.github/workflows/publish-testing.yml).
- **Composite GitHub Action:** `packages/testing-github-action/` — **semver Git tags** `testing-action-v*.*.*` for consumer pins (not npm). Maintainer workflow: [.github/workflows/release-testing-action-version.yml](.github/workflows/release-testing-action-version.yml). See [docs/archive/testing/testing/github-action-semver.md](docs/archive/testing/testing/github-action-semver.md).
- **Config contract:** [docs/archive/testing/testing/schema-stability-policy.md](docs/archive/testing/testing/schema-stability-policy.md) (patch/minor/major vs `schema_version`).
- **GA quickstart (external adopters):** [docs/archive/testing/testing/quickstart-ga.md](docs/archive/testing/testing/quickstart-ga.md).

## A3 BYOK dogfood (maintainers)

Optional workflow proves Keys resolve for `judge_rubric` using **GitHub Environment** secrets — [docs/archive/testing/testing/testing-a3-dogfood-workflow.md](docs/archive/testing/testing/testing-a3-dogfood-workflow.md). No credential values belong in the repo.

## Dogfood feedback (other repos)

If you integrate Restormel Keys from another GitHub project, use **[docs/archive/github-workflow/github-dogfood-feedback.md](docs/archive/github-workflow/github-dogfood-feedback.md)**. For **trusted** consumer repos, the default is **label-based relay** (`restormel-feedback` → issue here); copy **[docs/archive/reference/restormel-dogfood-relay-consumer-pack.md](docs/archive/reference/restormel-dogfood-relay-consumer-pack.md)** into the consumer repo for setup. **Do not** put secrets in issues.

## PRs

**Primary remote is Forgejo** (`git.allotmentology.tech`) — open PRs there; GitHub is a read-only push-mirror kept for the Neon/Vercel preview legs. See [docs/infra/off-github-runbook.md](docs/infra/off-github-runbook.md).

Use the repo PR template. Confirm scope respects bootstrap constraints and canonical docs are updated as needed.

**Pre-PR security:** For code or security-sensitive docs, complete the [pre-PR security gate](docs/guides/pre-pr-security-review.md) (`PASS` before opening a PR). High-risk areas include BYOK storage, auth, Connect/MCP, gateway routes, and credential encryption.
