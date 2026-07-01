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
- **Model tiering for parallel swarms (2026-06-30):** default swarm/fan-out workers to **Fable 5**
  (`claude-fable-5`) at task-appropriate complexity; use **Haiku** (`claude-haiku-4-5`) for rapid,
  clearly-defined iteration loops; reserve **Opus 4.8** (`claude-opus-4-8`) for the hardest reasoning
  (architecture/ADRs, adversarial verify, synthesis). Encode via the Workflow `agent()` / Agent
  `model` + `effort` overrides. See the `multi-agent-orchestration-preference` memory.
- **Prod Argo CD app auto-syncs** the reviewed artefact — the deploy gate is **upstream**
  (PR review + CI: security scan / full build / bundled-asset guard + the `deploy-k3s` pipeline
  gate), not an operator hand-sync. Rollback = **revert the gitops image-bump commit** (Argo
  re-syncs). Deploys still auto-apply pending DB migrations, **fail-closed** (bad migration →
  unready pods → old ReplicaSet keeps serving). This relaxes the former operator-gated rule —
  see `docs/decisions/prod-argo-autosync.md` (REC-ADR-011, traces to REC-INC-006).
