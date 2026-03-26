# GitHub: dogfood feedback (consumer → Restormel Keys)

**Canonical** for how feedback from projects that dogfood Restormel Keys should reach this repo. **Reference** for consumer-specific notes: existing write-ups such as [docs/reference/sophia-dogfood-findings.md](reference/sophia-dogfood-findings.md).

## Goals

- One **destination** for improvement requirements: **issues in this repository**.
- **Safe by default:** no raw keys, no credential-like strings in titles or bodies; use masked identifiers and links to public context only. See [security-baseline.md](security-baseline.md).

## Default path (trusted consumer repos)

For **trusted** projects (same org/operators, implicit trust), the **de facto standard** is **label-triggered relay** from the consumer repository:

1. **Upstream (maintainers):** A fine-grained PAT with **Issues: Read and write** on **this repository only**; stored as a secret in each consumer repo (e.g. `RESTORMEL_KEYS_ISSUE_TOKEN`). Never commit the token.
2. **Consumer:** Create the label **`restormel-feedback`** (exact name). Add the workflow file (see below). Replace `YOUR_ORG` / `YOUR_REPO` with the GitHub **restormel-keys** owner and repo name.
3. **Day to day:** When an issue in the consumer repo should drive Restormel work, add **`restormel-feedback`**. Actions opens an issue here with title `[Dogfood] …`, body quoting the source and linking back, and label **`task`**.

**Behaviour:** When an issue receives the label `restormel-feedback`, the workflow opens a new issue in this repo. **Duplicate relay:** Labeling again does not de-dupe; avoid relabeling unless you want another upstream issue.

**Self-contained copy for consumer repos:** [docs/reference/restormel-dogfood-relay-consumer-pack.md](reference/restormel-dogfood-relay-consumer-pack.md) — copy this single file into a consumer repo (e.g. as `docs/restormel-dogfood-relay.md`) and follow it end-to-end; it includes the workflow YAML and an **agent prompt** for Cursor.

**Reference workflow (same content as the pack):** [docs/reference/github-dogfood-relay-consumer-workflow.yml](reference/github-dogfood-relay-consumer-workflow.yml).

### Reference implementation: SOPHIA (`Allotment-Technology-Ltd/sophia`)

The following is **what SOPHIA deployed** — it matches the pack and reference workflow above (with repo-specific names and a **fork guard**). Upstream backlog stays in **restormel-keys**; SOPHIA keeps the consumer-side thread and link-back.

**Intent**

- Improvement requests found while dogfooding Restormel Keys are tracked as **issues in SOPHIA**, then **mirrored** to **restormel-keys** without copy-paste.
- **Upstream owns** the backlog item; SOPHIA keeps the consumer-side discussion and a link to the upstream issue.

**Mechanism (relay)**

1. Open an issue on `Allotment-Technology-Ltd/sophia` and apply the label **`restormel-feedback`** (exact name).
2. GitHub Actions runs **`.github/workflows/restormel-dogfood-relay.yml`** on `issues: labeled`.
3. The job uses a **fine-grained PAT** stored as **`RESTORMEL_KEYS_ISSUE_TOKEN`** (repository or org secret scoped to SOPHIA) with **Issues: Read and write** on **`restormel-keys` only**.
4. It creates an issue on **`Allotment-Technology-Ltd/restormel-keys`**: title prefix **`[Dogfood]`**, body includes source repo, issue number, title/body copy, and a **link back** to the SOPHIA issue; upstream label **`task`** is applied.

**Fork guard (recommended on public consumers)**

- The workflow should only run when `github.repository` is the **canonical** consumer repo (e.g. `Allotment-Technology-Ltd/sophia`) so **forks** do not run the job or use the relay secret. See the optional `if:` line in [github-dogfood-relay-consumer-workflow.yml](reference/github-dogfood-relay-consumer-workflow.yml) and the consumer pack.

**Safety / hygiene**

- **No secrets** in labeled issues (the relay copies the body); redact before labeling.
- **Relabeling** can create **duplicate** upstream issues — avoid unless intentional.

**First hop (creating the SOPHIA issue)** — separate from the relay token

Uses **SOPHIA write** access (identity / PAT / `gh`), **not** the restormel-keys-only relay PAT. These assets live **in the SOPHIA repo** (not duplicated here):

| Asset (SOPHIA repo) | Role |
|---------------------|------|
| `docs/restormel-dogfood-relay.md` | Human doc; credentials table; optional org secret; `gh` examples |
| `scripts/restormel/create_dogfood_issue.sh` + `pnpm restormel:dogfood-issue` | CLI wrapper (`tmp/…` + `gh issue create` with `--label restormel-feedback`) |
| `.github/ISSUE_TEMPLATE/restormel-dogfood.yml` | Applies **`restormel-feedback`** on submit |
| Cursor / GitHub MCP | Create or comment on SOPHIA issues when PAT scopes include SOPHIA issues write |
| `.cursor/rules/restormel-dogfood-feedback-relay.mdc` | Agent: file via SOPHIA + label |
| `.cursor/skills/restormel-dogfood-issue-relay/SKILL.md` | Agent skill |
| `.cursor/mcp.json.example` | Example MCP merge for others |

**Credentials (two tokens — do not mix)**

| Secret / credential | Where | Purpose |
|---------------------|--------|---------|
| **`RESTORMEL_KEYS_ISSUE_TOKEN`** | SOPHIA Actions (or org secret → SOPHIA) | **Relay only:** create issues on **restormel-keys** |
| **`gh` / GitHub MCP PAT** | Developer machine / Cursor | Create **SOPHIA** issues + label **`restormel-feedback`** |

**Canonical docs in this repo (restormel-keys)**

| Doc | Role |
|-----|------|
| This file | Operator narrative |
| [restormel-dogfood-relay-consumer-pack.md](reference/restormel-dogfood-relay-consumer-pack.md) | Consumer copy pack |
| [github-dogfood-relay-consumer-workflow.yml](reference/github-dogfood-relay-consumer-workflow.yml) | Reference workflow YAML |

## Fallbacks (optional)

### Open an issue here (manual)

Use when automation is not set up or you want a one-off without touching the consumer repo:

1. **Issues → New issue → Dogfood / consumer feedback** (`.github/ISSUE_TEMPLATE/dogfood-feedback.yml`).
2. Fill **consumer project**, **area**, and **expected vs actual**. Link out to the consumer issue if safe.

### `gh` from your machine

```bash
gh issue create --repo YOUR_ORG/restormel-keys \
  --title "[Dogfood] Short summary" \
  --body-file ./body.md \
  --label task
```

Use the same content rules as the issue form.

## After a relayed issue appears here

- **Implementing the work:** [docs/runbooks/restormel-dogfood-issue-implementation.md](runbooks/restormel-dogfood-issue-implementation.md) — checklist, security, Cursor prompt, PR linkage.
- **Automation:** New issues whose title contains **`[Dogfood]`** get a short GitHub comment from `.github/workflows/dogfood-issue-hint.yml` linking to that runbook.
- **CI draft PR (optional):** `.github/workflows/dogfood-agent-open-pr.yml` runs `scripts/dogfood-agent-open-pr.mjs` with **`ANTHROPIC_API_KEY`** and/or **`OPENAI_API_KEY`** in **GitHub Actions secrets** (never commit). Manual **workflow_dispatch** or scheduled pickup with labels **`dogfood-agent-auto`** + **`task`** — see runbook § *CI agent (draft PR)*.
- **Cursor:** Rule `.cursor/rules/07-dogfood-github-issues.mdc` reminds agents to follow the runbook.

## Related

- [CONTRIBUTING.md](../CONTRIBUTING.md) — how to work in this repo.
- [STATUS.md](../STATUS.md) — current phase and dogfooding pointers.
