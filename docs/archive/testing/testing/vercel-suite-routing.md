# Vercel and `/testing` (reference)

**Canonical deployment documentation:** [`docs/monorepo-vercel.md`](../monorepo-vercel.md) — **one** Vercel project on the **restormel-keys** repo root, **`restormel.dev`** on that project, dashboard build via root [`vercel.json`](../../vercel.json).

**Testing** marketing and docs URLs (`/testing`, `/testing/docs/…`) are served from the **same** SvelteKit deployment as Keys — routes live under [`apps/dashboard/src/routes/testing/`](../../apps/dashboard/src/routes/testing/). There is **no** separate “restormel-testing” Vercel project and **no** `vercel.json` **rewrites** to another `*.vercel.app` origin.

This filename is kept so links from the archived **restormel-testing** repository still resolve to accurate guidance.

## Historical note

Previously, Testing could be deployed as its **own** Vercel project, with Keys **rewriting** `/testing` to that deployment’s URL. That **two-project** model is **retired** after consolidating into **restormel-keys**.

## Skipping needless Vercel builds

Configured on the monorepo root — see **Skipping needless builds** in [`docs/monorepo-vercel.md`](../monorepo-vercel.md) (`ignoreCommand` + [`scripts/vercel-ignore-dashboard.sh`](../../scripts/vercel-ignore-dashboard.sh)).

## Subdomain alternative

If you ever split hosting again (e.g. **`testing.restormel.dev`** on a dedicated project), adjust SvelteKit **`base`**, DNS, and public URLs accordingly — see the checklist spirit in [`monorepo-vercel.md`](../monorepo-vercel.md).
