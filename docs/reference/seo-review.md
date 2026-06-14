---
title: SEO review — Restormel Keys (public surface)
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# SEO review — Restormel Keys (public surface)

**Status:** Canonical
**Scope:** Public-facing pages served by the single SvelteKit app in `apps/dashboard`:
- `/keys`
- `/keys/pricing`
- `/keys/docs/*`

## Current baseline (implemented)

### Indexability

- **robots.txt**: served at `/robots.txt` and points to `/sitemap.xml`.
- **Dashboard is excluded**: robots disallows `/keys/dashboard/*` and the dashboard layout sets `<meta name="robots" content="noindex, nofollow" />`.

### Discovery

- **sitemap.xml**: served at `/sitemap.xml` with a curated set of public URLs.

### Metadata

- Titles and descriptions exist for major pages.
- Default OG/Twitter metadata is provided in layouts.

### Structured data

- Organization + product JSON-LD on marketing layout (`/keys/*`).
- Breadcrumb JSON-LD on docs layout (`/keys/docs/*`).

## Checklist (top benchmarks)

### Must-have

- **Each indexable page has**: one `<h1>`, descriptive `<title>`, meta description, canonical URL.
- **Sitemap** includes all indexable routes.
- **Robots** disallows non-public application surfaces.
- **No accidental indexing** of authenticated dashboard pages.

### High-impact improvements (next)

- Add a dedicated OG image for Keys pages (SVG/PNG) and reference via `og:image` / `twitter:image`.
- Ensure canonical URLs are consistent and do not vary by query params.
- Add internal links from high-authority pages (README, landing, docs overview) to key docs pages (CLI options, walkthrough, verification).
- Ensure docs pages have unique meta descriptions (at least for major hubs).

### Nice-to-have

- Lighthouse checks (Performance, Accessibility, Best Practices, SEO) run in CI for public routes.
- JSON-LD enhancements: FAQ schema for pricing FAQ; SoftwareSourceCode schema for GitHub repo.

## Notes / conventions

- **Public vs app**: `/keys/docs/*` and `/keys/*` are indexable; `/keys/dashboard/*` is not.
- **Registry content**: lifecycle warnings are advisory; avoid over-claiming real-time accuracy.
