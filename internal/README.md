## Internal (local-only)

This folder is for **local-only** artifacts that should **not** be committed to git or exposed in the public GitHub repo.

It is intentionally gitignored (except this README). Typical contents:

- `internal/prompts/` — prompt packs, internal agent prompts, implementation playbooks
- `internal/plans/` — Cursor plans and working notes
- `internal/strategy/` — strategy, tactics, competitive notes, drafts
- `internal/ops-notes/` — private operational notes and checklists

### Rules

- **No secrets.** Do not store keys, tokens, credentials, or real customer data here.
- **Assume your machine is not a secure vault.** If it needs stronger protection, keep it outside the repo entirely (password manager or dedicated secure storage).
- If something must be public and user-facing, put it under `docs/` or the dashboard-served docs routes under `apps/dashboard/src/routes/keys/docs/`.

