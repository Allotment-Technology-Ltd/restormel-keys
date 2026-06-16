# restormel-keys — agent instructions

These prime every session; reach for the matching skill rather than rediscovering process.

## Governance / ISMS — route automatically
Any **incident / outage / alert** (detected **or** resolved), or any governance/ISMS
record-keeping — evidence, DPIA, access review, posture/audit, ISO 27001 SoA or Cyber
Essentials Plus control mapping, a policy-review cadence falling due, a sub-processor/supplier
change, classification/retention/frontmatter questions — **use the `restormel-isms-records`
skill**. **Filing an incident record after any incident is mandatory** (REC-TPL-004 →
`evidence/incidents/<date>-<slug>.md`, append-only). For live alerts, pair with
`restormel-infra-alert-response`.

## Standing operational norms
- **Forgejo is primary CI/CD** — `origin` = `git.allotmentology.tech`; GitHub is a mirror.
  Push / PR / merge via Forgejo.
- The repo ships task-specific **`restormel-*` skills** (high-risk-security, vuln-triage,
  ci-self-heal, keys-routing, isms-records, infra-alert-response, …) — use the matching one.
- **Records** under `governance/` + `evidence/` are **append-only**, frontmatter-validated
  (`scripts/records/`); control-tier ≥ 2 requires `owner` / `approved-by` / `approved-on` /
  `retention`.
- Touching keys / auth / secrets / Connect / SvelteKit server routes / Postgres → run the
  **`restormel-high-risk-security`** review before opening the PR.
- The local main checkout **auto-resets to `origin/main`** — do isolated work in a `git worktree`,
  never edit the live main checkout while a run is in flight.
- **Prod is not main-auto-deploy** (deliberate tag / `workflow_dispatch=prod`); deploys
  auto-apply pending DB migrations, fail-closed.
