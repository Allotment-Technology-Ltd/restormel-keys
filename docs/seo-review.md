# SEO review — Restormel Keys (public surface)

**Status:** Canonical\n
**Scope:** Public-facing pages served by the single SvelteKit app in `apps/dashboard`:\n
- `/keys`\n
- `/keys/pricing`\n
- `/keys/docs/*`\n

## Current baseline (implemented)

### Indexability

- **robots.txt**: served at `/robots.txt` and points to `/sitemap.xml`.\n
- **Dashboard is excluded**: robots disallows `/keys/dashboard/*` and the dashboard layout sets `<meta name="robots" content="noindex, nofollow" />`.\n

### Discovery

- **sitemap.xml**: served at `/sitemap.xml` with a curated set of public URLs.\n

### Metadata

- Titles and descriptions exist for major pages.\n
- Default OG/Twitter metadata is provided in layouts.\n

### Structured data

- Organization + product JSON-LD on marketing layout (`/keys/*`).\n
- Breadcrumb JSON-LD on docs layout (`/keys/docs/*`).\n

## Checklist (top benchmarks)

### Must-have

- **Each indexable page has**: one `<h1>`, descriptive `<title>`, meta description, canonical URL.\n
- **Sitemap** includes all indexable routes.\n
- **Robots** disallows non-public application surfaces.\n
- **No accidental indexing** of authenticated dashboard pages.\n

### High-impact improvements (next)

- Add a dedicated OG image for Keys pages (SVG/PNG) and reference via `og:image` / `twitter:image`.\n
- Ensure canonical URLs are consistent and do not vary by query params.\n
- Add internal links from high-authority pages (README, landing, docs overview) to key docs pages (CLI options, walkthrough, verification).\n
- Ensure docs pages have unique meta descriptions (at least for major hubs).\n

### Nice-to-have

- Lighthouse checks (Performance, Accessibility, Best Practices, SEO) run in CI for public routes.\n
- JSON-LD enhancements: FAQ schema for pricing FAQ; SoftwareSourceCode schema for GitHub repo.\n

## Notes / conventions

- **Public vs app**: `/keys/docs/*` and `/keys/*` are indexable; `/keys/dashboard/*` is not.\n
- **Registry content**: lifecycle warnings are advisory; avoid over-claiming real-time accuracy.\n

