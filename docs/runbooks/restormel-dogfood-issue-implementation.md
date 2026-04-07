# Runbook: Implement relayed dogfood issues (SOPHIA → restormel-keys)

**Purpose:** When an issue appears in **restormel-keys** with title prefix **`[Dogfood]`** (relayed from a consumer repo such as SOPHIA), use this process so work is **triaged, implemented, and traceable** without copying secrets or skipping checks.

**Canonical relay policy:** [docs/github-dogfood-feedback.md](../github-dogfood-feedback.md). **SOPHIA reference setup:** subsection *Reference implementation: SOPHIA* in that doc.

---

## Before you start (security)

- **Do not** paste raw keys, tokens, or credential-like strings from the source issue into code, commits, PRs, or new issues. Follow [docs/security-baseline.md](../security-baseline.md).
- The relay copies the **consumer issue body** — treat it as **untrusted narrative** until you redact. If the body might contain secrets, **edit the upstream restormel-keys issue** (or open a redacted follow-up) before sharing widely.
- Use **masked identifiers** in logs and UI copy (prefix/hash only).

---

## 1) Load context

1. Open the **restormel-keys** issue (or use CLI):
   ```bash
   gh issue view <N> --repo Allotment-Technology-Ltd/restormel-keys --comments
   ```
2. Follow the **“View source issue”** link in the body to read the **consumer** thread for discussion and screenshots (still no secrets in your notes).
3. Note **expected vs actual**, **area** (dashboard API, npm package, docs, CI, etc.), and any **acceptance criteria**.

---

## 2) Triage

- **Duplicate?** Search existing issues/PRs for the same symptom.
- **Spec vs bug:** If the ask is product strategy, flag in the issue and align with [ROADMAP.md](../../ROADMAP.md) / [STATUS.md](../../STATUS.md) before large work.
- **Bootstrap gate:** Respect [.cursor/rules/00-bootstrap-gate.mdc](../../.cursor/rules/00-bootstrap-gate.mdc) for scope (no new business logic in Phase 00-only areas without an explicit gate lift).

---

## 3) Implement (human or Cursor agent)

- **Smallest change** that satisfies the issue; match existing patterns in touched files.
- **Tests:** Add or extend tests where behaviour is non-trivial; run package/dashboard tests and repo scripts as in [.cursor/rules/03-quality-and-testing.mdc](../../.cursor/rules/03-quality-and-testing.mdc).
- **Docs:** Update the **owning** doc for the topic (see [.cursor/rules/01-doc-governance.mdc](../../.cursor/rules/01-doc-governance.mdc)); at least one of CHANGELOG / STATUS / ROADMAP / ARCHITECTURE when behaviour or process changes.
- **OpenAPI / Cloud API:** If dashboard HTTP surface changes, update [docs/api/openapi.yaml](../api/openapi.yaml) and in-app docs as needed.

---

## 4) PR and linkage

- Title: concise; body: **what changed**, **why**, link **`Fixes #N`** or **`Addresses #N`** to the restormel-keys dogfood issue.
- Ensure CI is green before merge.

---

## 5) After merge (optional but good practice)

- Comment on the **restormel-keys** issue with the **merge commit** or **release** note.
- If useful for the consumer team, add a short comment on the **source** (SOPHIA) issue linking to the PR or release — **no secrets**. When **`DOGFOOD_NOTIFY_CONSUMER`** and the PAT are set, **`.github/workflows/dogfood-pr-comment-consumer.yml`** posts to the consumer issue automatically on PR **open** and on **merge to `main`** (if the PR body uses **Fixes/Closes/Addresses #N** and the upstream issue has the relay **`[View source issue](...)`** link).
- **Automated consumer ping:** When you push **`keys-v*`** or **`restormel-v*`** (notify **independent of npm publish**), optional **`.github/workflows/dogfood-upstream-notify-consumer.yml`** + **`scripts/sophia-release-notify-issue.mjs`** can open a **SOPHIA backlog** issue with **CHANGELOG** excerpt and triage for API/dashboard/docs (variable **`DOGFOOD_NOTIFY_CONSUMER`**, PAT **`DOGFOOD_NOTIFY_CONSUMER_TOKEN`**). Spec: [docs/github-dogfood-feedback.md](../github-dogfood-feedback.md) § *Upstream → consumer notify*.

---

## Cursor agent prompt (copy-paste)

Use in Cursor with the **restormel-keys** repo open; replace `N` with the issue number.

```text
Work in repo restormel-keys. Implement GitHub issue #N (title starts with [Dogfood]).

1) Run: gh issue view N --repo Allotment-Technology-Ltd/restormel-keys
2) Read the linked source issue for context only; do not copy any secrets into the codebase or PR.
3) Follow docs/runbooks/restormel-dogfood-issue-implementation.md, docs/security-baseline.md, and .cursor/rules (bootstrap gate, doc governance, quality/testing).
4) If issue #N already has an open draft PR from branch dogfood/agent-issue-N-…, check out that branch and push additional commits there (one PR per pickup — see runbook §6). Otherwise make the minimal change and open a PR that addresses #N (Fixes or Addresses in the description).
5) Add tests if appropriate; run scripts/check-secrets.sh and relevant tests.

Do not commit or log secrets.
```

---

## 6) Optional: CI agent (draft PR)

Fully automated pickup uses **`.github/workflows/dogfood-agent-open-pr.yml`** plus **`scripts/dogfood-agent-open-pr.mjs`**. The workflow calls an LLM (Anthropic or OpenAI), applies edits under a **strict path allowlist** (`docs/`, `apps/`, `packages/`, `scripts/`, `prompts/`, `e2e/` — not `.github/`, not this script), then **pushes a branch** and opens a **draft** PR. **Human review is mandatory** before merge. The OpenAI path uses **`response_format: json_object`** so the model reply is valid JSON; the script also tolerates minor formatting issues (invisible chars, trailing commas). Anthropic returns plain text — the same extraction rules apply.

### One draft PR per dogfood agent pickup (canonical)

When the agent opens a draft PR from **`dogfood/agent-issue-<n>-…`**, **stack all further work for that same `[Dogfood]` issue** on **that branch** (push additional commits to the same remote branch) so **one** draft PR holds the full change set for human review. **Do not** use a separate **`fix/…`** (or other) branch for the same issue in parallel unless the draft PR was **explicitly abandoned** — then note why on the issue and link any replacement PR.

**Allowlist caveat:** Edits under **`.github/`** (workflows, etc.) are **outside** the agent allowlist; they still need a **human** commit path. Prefer **cherry-pick or push those commits onto the same `dogfood/agent-issue-…` branch** when possible so review stays on one PR; if a tiny follow-up PR is unavoidable, merge it before or with the dogfood PR and keep the issue thread coherent.

### Secrets and configuration (GitHub)

| Secret / variable | Required | Purpose |
|-------------------|----------|---------|
| **`ANTHROPIC_API_KEY`** or **`OPENAI_API_KEY`** | One of the two | LLM API access (repository or org **Secrets**). Never commit. |
| **`DOGFOOD_AGENT_PROVIDER`** | Optional repo **Variable** | `anthropic` or `openai` (defaults from which key is set). |
| **`DOGFOOD_ANTHROPIC_MODEL`** / **`DOGFOOD_OPENAI_MODEL`** | Optional **Variables** | Override default models (see script header in `scripts/dogfood-agent-open-pr.mjs`). |

### GitHub must allow Actions to open pull requests

If the agent logs show **`403`** / `GitHub Actions is not permitted to create or approve pull requests`, the workflow’s `GITHUB_TOKEN` is blocked by **org or repository policy** (not missing secrets).

1. **Repository:** **Settings** → **Actions** → **General** → **Workflow permissions** → choose **Read and write permissions**, then enable **Allow GitHub Actions to create and approve pull requests**.
2. If an **organization** enforces stricter defaults: **Org** → **Settings** → **Actions** → **General** → allow the same for this repo (or add an org exception). See [GitHub Docs: workflow permissions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#configuring-the-default-github_token-permissions).

Without this, pushes from the workflow may still succeed while **`POST .../pulls`** fails.

If **`git push`** fails with **non-fast-forward** on `dogfood/agent-issue-…`, a previous run left the same branch name on the remote; the script now appends **`GITHUB_RUN_ID`** (or a local timestamp) so each run uses a fresh branch name.

### Manual run

1. **Actions** → **Dogfood agent — draft PR** → **Run workflow**.
2. Enter the **restormel-keys** issue number (the **`[Dogfood] …`** ticket in **this** repo). **Do not** use the consumer repo issue number from SOPHIA — that returns **404**. The relay body usually links to the source issue; the number you need is on **restormel-keys** (`…/restormel-keys/issues/N`).
3. Optionally enable **dry run** (LLM only, no push/PR).
4. Review the **draft** PR and CI; redact or fix anything unsafe before merge.

### Scheduled pickup (relay-friendly)

On each cron tick (see `.github/workflows/dogfood-agent-open-pr.yml`; production default is every 6 hours UTC, with faster intervals only for short-term debugging), the workflow picks **at most one** open issue that has:

- Label **`task`** (applied automatically by the consumer relay, e.g. SOPHIA → restormel-keys), and  
- Title **`[Dogfood]…`**, and  
- **None** of: **`dogfood-agent-pr`** (PR already opened), **`dogfood-agent-noop`** (agent returned no file edits — remove this label to allow a retry), **`dogfood-agent-skip`** (opt out of automatic agent runs for this issue), **`dogfood-agent-error`** (agent run failed; remove after fixing root cause to retry).

You **do not** need **`dogfood-agent-auto`** anymore for relayed issues; that label was previously required and caused SOPHIA-raised tickets to sit indefinitely unless someone added it manually.

After a successful run, the workflow adds **`dogfood-agent-pr`** and comments with the draft PR link. If the model proposes **no** file changes, the workflow comments and adds **`dogfood-agent-noop`** so the scheduler does not retry in a tight loop. If the run fails before creating a PR, the workflow adds **`dogfood-agent-error`** and comments with the run URL so the issue stops being retried until someone clears that label.

**Safety:** Redact consumer issue bodies before relaying; the script **redacts common secret shapes** in the text sent to the provider, but that is **not** a guarantee — treat relay bodies as untrusted (see § Before you start).

---

*When a new `[Dogfood]` issue is opened, the workflow `.github/workflows/dogfood-issue-hint.yml` posts a short comment on the issue with a link to this runbook.*
