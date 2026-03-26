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
- If useful for the consumer team, add a short comment on the **source** (SOPHIA) issue linking to the PR or release — **no secrets**.
- **Automated consumer ping:** When you ship a **`keys-v*`** tag, optional workflow **`.github/workflows/dogfood-upstream-notify-consumer.yml`** can open a tracking issue on the consumer repo (variable **`DOGFOOD_NOTIFY_CONSUMER`**, PAT secret **`DOGFOOD_NOTIFY_CONSUMER_TOKEN`**). Spec: [docs/github-dogfood-feedback.md](../github-dogfood-feedback.md) § *Upstream → consumer notify*.

---

## Cursor agent prompt (copy-paste)

Use in Cursor with the **restormel-keys** repo open; replace `N` with the issue number.

```text
Work in repo restormel-keys. Implement GitHub issue #N (title starts with [Dogfood]).

1) Run: gh issue view N --repo Allotment-Technology-Ltd/restormel-keys
2) Read the linked source issue for context only; do not copy any secrets into the codebase or PR.
3) Follow docs/runbooks/restormel-dogfood-issue-implementation.md, docs/security-baseline.md, and .cursor/rules (bootstrap gate, doc governance, quality/testing).
4) Make the minimal code/doc change, add tests if appropriate, run scripts/check-secrets.sh and relevant tests.
5) Open a PR that addresses #N (Fixes or Addresses in the description).

Do not commit or log secrets.
```

---

## 6) Optional: CI agent (draft PR)

Fully automated pickup uses **`.github/workflows/dogfood-agent-open-pr.yml`** plus **`scripts/dogfood-agent-open-pr.mjs`**. The workflow calls an LLM (Anthropic or OpenAI), applies edits under a **strict path allowlist** (`docs/`, `apps/`, `packages/`, `scripts/`, `prompts/`, `e2e/` — not `.github/`, not this script), then **pushes a branch** and opens a **draft** PR. **Human review is mandatory** before merge.

### Secrets and configuration (GitHub)

| Secret / variable | Required | Purpose |
|-------------------|----------|---------|
| **`ANTHROPIC_API_KEY`** or **`OPENAI_API_KEY`** | One of the two | LLM API access (repository or org **Secrets**). Never commit. |
| **`DOGFOOD_AGENT_PROVIDER`** | Optional repo **Variable** | `anthropic` or `openai` (defaults from which key is set). |
| **`DOGFOOD_ANTHROPIC_MODEL`** / **`DOGFOOD_OPENAI_MODEL`** | Optional **Variables** | Override default models (see script header in `scripts/dogfood-agent-open-pr.mjs`). |

### Manual run

1. **Actions** → **Dogfood agent — draft PR** → **Run workflow**.
2. Enter the **restormel-keys issue number**; optionally enable **dry run** (LLM only, no push/PR).
3. Review the **draft** PR and CI; redact or fix anything unsafe before merge.

### Scheduled (opt-in) pickup

To queue **one** issue per run on a **schedule** (cron is in `.github/workflows/dogfood-agent-open-pr.yml`; may be set to every few minutes for testing — restore a slower cadence for production), concurrency-limited:

1. Ensure the relay issue has **`task`** (added by the consumer relay) and title **`[Dogfood]…`**.
2. Add label **`dogfood-agent-auto`** (create it in the repo if needed). Do **not** add **`dogfood-agent-pr`** until a PR exists.
3. After a successful run, the workflow adds **`dogfood-agent-pr`**, removes **`dogfood-agent-auto`**, and comments with the draft PR link.

**Safety:** Redact consumer issue bodies before relaying; the script **redacts common secret shapes** in the text sent to the provider, but that is **not** a guarantee — treat relay bodies as untrusted (see § Before you start).

---

*When a new `[Dogfood]` issue is opened, the workflow `.github/workflows/dogfood-issue-hint.yml` posts a short comment on the issue with a link to this runbook.*
