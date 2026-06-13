# Phase F runbook — Forgejo as primary remote (off-GitHub)

Status: DRAFTED 2026-06-13 (cutover night). Prerequisite met: Forgejo CI is green on
main pushes and the deploy pipeline is merged (#300). Execute the steps below in a
daytime session — F3 needs an owner-minted admin token, and F4 changes the PR habit
agents and humans share.

## Current state (after the 2026-06-13 cutover)

- Forgejo `git.allotmentology.tech/Allotment-Technology-Ltd/restormel-keys` is a
  **peer remote, dual-pushed** from the Mac (`forgejo` remote via the `forgejo-tunnel`
  ssh alias, key `id_hetzner_allotment` = "adams-macbook-push").
- Coolify staging AND prod apps deploy from **Forgejo `main`** — Forgejo is already the
  deployment source of truth. GitHub is where PRs, reviews, and the richer CI matrix run.
- Forgejo Actions: CI workflow green; deploy workflow merged, gated on the
  `COOLIFY_TOKEN` secret (morning checklist item 4).

## F1 [OWNER+AGENT] — Make Forgejo `origin`

1. Local: `git remote rename origin github && git remote rename forgejo origin`.
2. Update any tooling that assumes `origin` = GitHub (gh CLI keeps working — it
   resolves the GitHub remote by URL, but verify `gh pr list` still works).
3. Push habit: `git push origin <branch> && git push github <branch>` until F3 automates it.

## F2 [OWNER] — PR workflow on Forgejo

- Open PRs on Forgejo for day-to-day work; keep GitHub PRs only for changes that need
  the GitHub-only CI legs (Neon preview branches, Vercel previews) until those are ported.
- Branch protection: Forgejo repo → Settings → Branches → protect `main`
  (require PR + green status checks) to mirror the GitHub rules.

## F3 [OWNER] — GitHub as push-mirror (replaces dual-push)

1. Mint a GitHub fine-grained PAT with `contents:write` on the repo.
2. Forgejo repo → Settings → Repository → Mirror Settings → "Push mirror" →
   add `https://github.com/Allotment-Technology-Ltd/restormel-keys.git` + the PAT,
   interval 8h (or "sync on commit").
3. Remove the manual dual-push habit; GitHub becomes a read-only mirror that still
   feeds Vercel preview deployments (migration plan D4/D6).
4. Known quirk: mirror pushes re-trigger GitHub workflows — harmless (see
   `.forgejo/workflows` precedence note in repo memory/docs).

## F4 [AGENT] — CI reference updates

- Port the GitHub-only CI legs worth keeping (Neon preview-branch migrations) to
  `.forgejo/workflows/ci.yml`, or explicitly document them as GitHub-mirror-only.
- Update `CONTRIBUTING`/docs references from github.com URLs to Forgejo URLs.

## Vercel previews → Coolify

Preview builds are now **disabled at the Vercel ignore step**
(`scripts/vercel-ignore-dashboard.sh`). Any deploy where `VERCEL_ENV == preview`,
`VERCEL_GIT_PULL_REQUEST_ID` is set, or the branch is not `main`/`master` returns
`exit 0` (skip), so Vercel neither builds the app nor creates a Neon preview branch.

Previews are served on-demand from **Coolify at `preview.restormel.dev`**.

**Vercel production (main branch) remains a frozen rollback standby** — the existing
diff logic in the ignore script still runs for `main` pushes and builds only when
dashboard-relevant paths change.

## What does NOT move

- **Neon** stays managed (Phase G is a separate, flagged project).
