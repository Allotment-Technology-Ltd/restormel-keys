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

## Related

- [CONTRIBUTING.md](../CONTRIBUTING.md) — how to work in this repo.
- [STATUS.md](../STATUS.md) — current phase and dogfooding pointers.
