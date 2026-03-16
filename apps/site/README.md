# Site (archived)

**Status:** Archived. Marketing site, docs, and dashboard are now a single SvelteKit app in **apps/dashboard**.

- **Landing:** `/keys`, `/keys/pricing` — see `apps/dashboard/src/routes/keys/`
- **Docs:** `/keys/docs` — see `apps/dashboard/src/routes/keys/docs/`
- **Dashboard:** `/keys/dashboard` — see `apps/dashboard/src/routes/keys/dashboard/`

Deploy the single app from repo root: build command `pnpm --filter dashboard build`, output `apps/dashboard/.vercel/output`. One Vercel project, one domain (e.g. restormel.dev).

This directory is kept so that workspace and hygiene scripts that expect `apps/site` continue to pass. Do not restore the Astro app here without updating docs and deployment.
