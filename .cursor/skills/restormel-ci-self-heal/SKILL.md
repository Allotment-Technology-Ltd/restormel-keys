---
name: restormel-ci-self-heal
description: >-
  Restormel Keys self-healing dependency loop: how self-hosted Renovate + the Forgejo security gate
  + Agent D's auto-merge policy work together, how to extend or debug the loop, and what to do when
  it stalls (Renovate not opening PRs, CI red on a security fix PR, auto-merge not firing, SLA
  escalation triggered). Use when debugging why a security fix PR was not auto-merged, when
  configuring Renovate for a new dependency type, when checking whether the self-heal loop is
  healthy, or when onboarding to how the security automation works.
---

# CI self-heal loop (Restormel Keys)

The self-healing loop keeps security findings from sitting idle. No finding should require a human to manually open a dependency-bump PR or remember a SLA deadline — the tooling does that work, and humans only intervene for triage decisions that require judgment.

Canonical config files (authored by Agent A):
- `renovate.json` — Renovate configuration, schedule, auto-merge policy, security-prioritised PR rules
- `scripts/security/severity-gate.mjs` — CI gate logic for which severity classes block vs warn
- `.forgejo/workflows/ci.yml` — the `security` job that is a required PR check
- `.forgejo/actions/security-scan/action.yml` — pinned scanner binaries (OSV-Scanner, gitleaks, Trivy)

---

## How the loop works

```
OSV-Scanner / pnpm audit / Trivy
          │
          │ detects CVE with available fix
          ▼
   Self-hosted Renovate (Forgejo cron)
          │
          │ opens or bumps a PR with security-priority label
          ▼
   CI `security` job runs on the PR
          │
          ├─ PASS → Agent D checks auto-merge eligibility
          │             │
          │             ├─ within policy → auto-merge
          │             └─ outside policy → escalate (open issue + SLA timer)
          │
          └─ FAIL → finding is unresolved; Agent D opens triage issue
```

The weekly drift scan (Phase 2, `A6`) adds an outer loop: OSV-Scanner + `trivy image` against the deployed image tag, so a newly disclosed CVE on an unchanged dependency is caught without a code change.

---

## Renovate configuration

Self-hosted Renovate runs as a Forgejo Actions cron job. The `renovate.json` at repo root controls its behaviour. Key areas to understand:

**Schedule:** Renovate runs on a cron (e.g. daily at 03:00). Security fixes are raised immediately using `prCreation: "immediate"` for the vulnerability alert schedule. Read `renovate.json` for the current schedule string.

**Security-prioritised PRs:** Renovate reads OSV data and opens PRs for known CVEs first, regardless of the normal batching/grouping rules. These PRs are labelled with the CVE ID and severity.

**Grouping:** non-security patch and minor updates are grouped by package type (e.g. all `@types/*` updates in one PR) to reduce noise. Security PRs are always individual.

**Auto-merge policy (from `renovate.json`):**

| Change type | Auto-merge? |
|------------|-------------|
| Patch/minor `devDependencies`, known-safe ranges | Yes, if CI green |
| Any-severity security fix | Yes, if CI green and within policy (see below) |
| Major version bump | No — triage required |
| Runtime-critical packages (DB drivers, auth libs, encryption helpers) | No — triage required |
| GitHub Dependabot PRs (mirror) | Treated as secondary; Forgejo Renovate PR takes precedence |

"Within policy" for security fixes: the fix must be a semver-compatible upgrade (patch or minor), the package must not be in the `manualMergePackages` list in `renovate.json`, and CI must be fully green (all required checks passing including `security`).

---

## CI security gate

The `security` job in `.forgejo/workflows/ci.yml` is a **required status check**. A PR to `main` cannot merge while it is red.

The job calls `.forgejo/actions/security-scan/action.yml`, which runs pinned static binaries — no docker-in-docker, no Marketplace actions that might not resolve on the self-hosted act-runner.

Gate logic is in `scripts/security/severity-gate.mjs`. To change which severity classes block vs warn, edit that file. Do not hard-code severity thresholds in the workflow YAML — the script is the single authoritative source.

The GitHub-mirror `security` job (`.github/workflows/ci.yml` → `.github/actions/js-security-scan`) remains the secondary net. Changes to scanner policy should be applied to both composites.

---

## Auto-merge (Agent D's role)

Agent D watches CI on every PR. When a Renovate security-fix PR goes green:

1. Agent D verifies the PR is within auto-merge policy (checking `renovate.json` directly, not from memory).
2. Agent D dispatches the per-PR security review (using `code-review` or `security-review` skill).
3. If the review verdict is passing: Agent D merges.
4. If the review reveals a concern: Agent D escalates to the Orchestrator before merging.

Agent D does not merge before the review verdict lands (`merge-after-review-verdict` memory).

---

## Debugging the loop

### Renovate is not opening PRs

1. Check the Forgejo Actions cron job: Forgejo → CI/CD → `renovate` workflow → last run log.
2. Common causes:
   - Renovate's `RENOVATE_TOKEN` secret is expired or missing from Forgejo Actions secrets.
   - The Forgejo API rate-limit is being hit (check Renovate log for 429 responses).
   - The dependency has no available fix version (Renovate will not open a PR for an unfixable CVE — go to risk-accept path instead).
   - The package is in the `ignoreDeps` list in `renovate.json`.
3. To manually trigger Renovate: Forgejo → CI/CD → `renovate` workflow → Run workflow (select `main`).

### CI security gate is red on a Renovate PR

1. Read the `security` job output carefully — it will name the specific scanner and finding.
2. Common causes:
   - The Renovate bump introduced a transitive dependency with a new CVE. This is intentional blocking behaviour — triage the new finding.
   - A `gitleaks` rule triggered on the diff (check for accidental secret literals in lock file comments or changelogs).
   - The pinned scanner binary URL in `security-scan/action.yml` is stale (check for download failure in the job log).
3. Do not bypass the gate by pushing directly to `main`. Fix the finding or follow the triage funnel.

### Auto-merge did not fire on a green PR

1. Check whether the PR has all required labels. Renovate security PRs should have a `security` or `vuln/*` label.
2. Check `renovate.json` → `automerge` and `automergeType` fields — confirm `automergeType` is `"pr"` (not `"branch"` which would bypass CI).
3. Check whether the package is listed in `manualMergePackages` or has a major version bump.
4. If Agent D has not picked up the PR: check whether the Orchestrator session is still active.

### SLA escalation triggered

1. Read the Forgejo issue — the triage comment should explain the decision and deadline.
2. If escalating to the owner: surface the issue link, the severity, the SLA breach date, and the available options (fix, risk-accept with expiry, or dependency removal).
3. Apply the `restormel-vuln-triage` skill to make the triage decision.

---

## Extending Renovate for a new dependency type

1. Read `renovate.json` to understand the current `packageRules` array.
2. To add a new package group (e.g. SurrealDB driver): add a `packageRules` entry with `matchPackageNames`, `groupName`, and the desired update schedule.
3. To add a package to the `manualMergePackages` list (no auto-merge): add it by exact name.
4. To change the security-fix auto-merge policy: edit the rule matching `"vulnerability-alert"` schedule. Do not change the `severity-gate.mjs` threshold and the Renovate policy independently — they should be consistent.
5. After editing `renovate.json`: manually trigger Renovate to validate the config (Renovate will post a PR comment with a config-error message if the JSON is invalid).

---

## Related

- `restormel-vuln-triage` skill — what to do with a finding once the loop surfaces it
- [docs/security/vulnerability-management.md](../../../docs/security/vulnerability-management.md) — governance doc with full SLA table
- [docs/infra/security-monitoring-roadmap.md](../../../docs/infra/security-monitoring-roadmap.md) — Workstream A details and the drift scan (Phase 2)
