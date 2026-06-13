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

The Vercel **Git integration is disconnected** (project `restormel-keys`,
`prj_ckFMpwWIVSuDUolzUKaLHCQMb2ek`, team `adams-projects-d2aa6fc5`). Vercel no
longer creates deployments or posts commit/PR checks for pushes to this repo —
all hosting (production + previews) is served by **Coolify on Hetzner**:
production at `restormel.dev`, previews on-demand at `preview.restormel.dev`.

Because Git is severed, the old `scripts/vercel-ignore-dashboard.sh` ignore step
and the `vercel.json` / `apps/dashboard/vercel.json` build config are gone — they
only drove Vercel Git-integration builds, so they were removed. The
switchable SvelteKit adapter (`DEPLOY_TARGET=node` → adapter-node for Coolify;
default → adapter-vercel) and `scripts/post-build.mjs` /
`scripts/vercel-copy-build-output.mjs` are **kept**: they still drive the build
and leave a working adapter-vercel path if Vercel deploys are ever re-enabled.

**Re-enabling Vercel deploys (rollback standby):** reconnect from the Vercel
dashboard (Project → Settings → Git → Connect Git Repository) or
`vercel git connect` with the project linked. No repo change is required to
re-deploy on Vercel once Git is reconnected, though you would want to restore an
ignore step first to avoid building every preview.

> **DNS is unaffected.** `restormel.dev` DNS stays hosted on Vercel
> (`ns1/ns2.vercel-dns.com`); disconnecting Git does not touch the domain or its
> records. Do **not** remove the domain or delete the Vercel project.

## What does NOT move

- **Neon** stays managed (Phase G is a separate, flagged project).
