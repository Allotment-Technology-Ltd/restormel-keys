---
name: restormel-design-imagery
description: >-
  Routes Restormel Keys marketing and product imagery work: neo-brutalist raster heroes and OG art via Midjourney MCP,
  inline SVG flow diagrams, existing static assets, or Cursor GenerateImage for quick drafts. Use when improving
  visual quality, hero images, OG/social previews, illustrations, marketing art, or asking for Midjourney / AI images
  for restormel.dev surfaces.
---

# Restormel design imagery

## Canonical references

- Design system index: [docs/design/design-system-index.md](../../../docs/design/design-system-index.md)
- Neo-brutalist tokens: [docs/design/DESIGN-TOKENS.md](../../../docs/design/DESIGN-TOKENS.md) (`#F3EAD0` canvas, `#FFD600` yellow accent, `#0C0C0C` ink, `#1A3F8A` blueprint blue, Barlow Condensed / DM Sans / Space Mono)
- Midjourney MCP setup: [docs/guides/midjourney-cursor-mcp.md](../../../docs/guides/midjourney-cursor-mcp.md)

## Choose the right medium (decision tree)

| Need | Use | Skill / tool |
|------|-----|----------------|
| Architecture / “how it fits” diagram | Inline SVG, `--rm-*` tokens only | [restormel-product-flow-diagrams](../restormel-product-flow-diagrams/SKILL.md) |
| Vendor / integration logos | Monochrome SVG from Simple Icons or press kit | [restormel-third-party-brand-marks](../restormel-third-party-brand-marks/SKILL.md) |
| Hero photo/illustration, OG image, editorial texture | Midjourney MCP (if configured) or manual sub export | [restormel-midjourney-mcp](../restormel-midjourney-mcp/SKILL.md) |
| Fast placeholder / icon concept | Cursor **GenerateImage** | Built-in tool — not for final brand-critical art |
| UI chrome (cards, nav, buttons) | CSS + tokens — **never** rasterize | [design-system-index](../../../docs/design/design-system-index.md) |

**Default:** Prefer code (SVG + tokens) over generative raster when the message is structural. Use Midjourney when the page needs **atmosphere** (hero, social card, case-study mood) without inventing fake metrics or vendor logos.

## Before generating raster art

1. Read **DESIGN-TOKENS.md** neo-brutalist v3 table — prompts must name cream canvas, ink borders, yellow accent discipline (yellow for CTAs only, not full-bleed chaos).
2. Check existing assets under `apps/dashboard/static/` — extend or restyle instead of duplicating.
3. Confirm MCP: if `midjourney_*` tools are unavailable, tell the user to complete [midjourney-cursor-mcp.md](../../../docs/guides/midjourney-cursor-mcp.md) or use manual Midjourney export.

## Asset placement (dashboard app)

| Asset type | Suggested path |
|------------|----------------|
| Marketing hero / section art | `apps/dashboard/static/marketing/<slug>.webp` |
| OG / social | `apps/dashboard/static/og/<route-slug>.png` (1200×630) |
| Module landings (`/keys`, `/testing`, `/graph`) | `apps/dashboard/static/<module>/hero.webp` |

Wire into SvelteKit `<svelte:head>` / layout `og:image` using existing `absoluteUrl` patterns in route layouts. Prefer **WebP** for heroes; **PNG** for OG when sharp text edges matter.

## Post-generation checklist

- [ ] No third-party trademarks or fake “partner” logos in generated art
- [ ] No invented statistics or customer names
- [ ] Compress (reasonable quality 80–85 WebP); keep file size suitable for marketing LCP
- [ ] Meaningful `alt` on `<img>`; decorative heroes may use empty alt only if adjacent heading carries the message
- [ ] `pnpm --filter dashboard run check` after route/layout changes

## Do not

- Replace `RestormelLogo` or lockup SVGs with Midjourney output
- Generate vendor logos (trademark risk) — use brand-marks skill
- Commit API tokens or AceDataCloud bearer strings
- Use rainbow “AI slop” palettes that break neo-brutalist discipline
