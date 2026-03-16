# Options: Consolidate on Vercel (done)

**Status:** Reference. **Implemented:** Site and dashboard run on Vercel only; Cloudflare removed. Dashboard at **restormel.dev/keys/dashboard** (base path `""`); site at **restormel.dev** with redirects from `/keys/dashboard` to restormel.dev/keys/dashboard.

---

## Why consolidate?

- **Single host** for app workloads: one dashboard (env, logs, deployments).
- **Avoid path-based proxy:** Dashboard at a subdomain avoids `/keys/dashboard` routing issues on Vercel.
- **Optionally move site to Vercel** so both site and dashboard live there; Cloudflare can stay as DNS only or be dropped in favour of Vercel DNS.

---

## Option A: Dashboard subdomain (minimal change)

Keep site on Cloudflare, dashboard on Vercel; stop using path-based proxy.

1. **Dashboard:** Add custom domain **restormel.dev/keys/dashboard** (or **app.restormel.dev**) to the Vercel dashboard project. Build the dashboard with **base path `""`** for this deployment (so it is served at root).
2. **DNS:** Point **restormel.dev/keys/dashboard** to Vercel (CNAME or Vercel nameservers).
3. **Redirect:** From the Cloudflare Worker (or in the site), redirect **restormel.dev/keys/dashboard** → **https://restormel.dev/keys/dashboard** so existing links still work.
4. **Docs / Zuplo:** Update **KEYS_BACKEND_URL** and any “dashboard URL” references to **https://restormel.dev/keys/dashboard** (no path). GitHub OAuth callback: **https://restormel.dev/keys/dashboard/api/auth/callback/github**.

**Result:** Dashboard at **restormel.dev/keys/dashboard**; no path prefix; no 404 from Vercel path matching. Cloudflare still hosts the site and does the redirect.

---

## Option B: Site + dashboard on Vercel (full consolidation)

Move the site to Vercel so both site and dashboard are on the same platform.

1. **Site:** Create a second Vercel project for **apps/site** (Astro). Add custom domain **restormel.dev** for that project. Deploy from the same repo (Root Directory: `apps/site` or monorepo root with the right build command).
2. **Dashboard:** As in Option A, use **restormel.dev/keys/dashboard** with base path `""`.
3. **Redirect:** In the site app (or Vercel rewrites for the site project), redirect **/keys/dashboard** → **https://restormel.dev/keys/dashboard**.
4. **Cloudflare:** Use only for DNS (optional) or switch restormel.dev to Vercel DNS. The Worker is no longer required for the proxy.

**Result:** One platform (Vercel) for both site and dashboard; simpler ops; Cloudflare reduced or removed.

---

## Option C: Keep path-based proxy (fix 404 first)

If you want to keep **restormel.dev/keys/dashboard** as the dashboard URL without a subdomain:

- The 404 occurs because the adapter-vercel output does not register routes under `/keys/dashboard`. Options: (1) post-build script that patches the Vercel output `config.json` to add the `/keys/dashboard` prefix to route `src` patterns, or (2) contribute/fix adapter-vercel to honour `paths.base` in emitted routes. See [extraction-vercel](extraction-vercel.md) § Troubleshooting.

---

## Recommendation

**Option A** is the fastest way to fix the 404 and reduce moving parts: dashboard on a subdomain, redirect from the path, no adapter or build hacks. **Option B** is the next step if you want to consolidate the whole stack on Vercel.
