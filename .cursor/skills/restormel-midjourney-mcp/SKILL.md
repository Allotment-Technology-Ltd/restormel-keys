---
name: restormel-midjourney-mcp
description: >-
  Operates the AceDataCloud Midjourney MCP server from Cursor: imagine, upscale, describe, reference-based generation,
  and task polling. Use when Midjourney MCP is configured, when generating Restormel neo-brutalist marketing or OG
  images, or when the user mentions Midjourney, AceDataCloud, or AI hero art for restormel-keys.
---

# Restormel Midjourney MCP

## Prerequisites

- MCP server `midjourney` connected (see [docs/guides/midjourney-cursor-mcp.md](../../../docs/guides/midjourney-cursor-mcp.md))
- **Agent mode** in Cursor
- Read [restormel-design-imagery](../restormel-design-imagery/SKILL.md) for when raster vs SVG applies

If tools are missing, stop and point the user at setup — do not guess API calls.

## Tool workflow

Typical sequence:

1. **`midjourney_get_prompt_guide`** — refresh parameter conventions when unsure
2. **`midjourney_imagine`** — text prompt → task id
3. **`midjourney_get_task`** (poll until complete) — retrieve image URLs
4. **`midjourney_transform`** — upscale (`U1`–`U4`) or variation when the grid needs refinement
5. **`midjourney_describe`** — optional reverse prompt from an uploaded reference (brand mood board only — no secrets in uploads)

Other tools: `midjourney_with_reference`, `midjourney_edit`, `midjourney_blend`, video tools — use only when the user explicitly asks.

**Download:** Fetch finished URLs with terminal/curl into `apps/dashboard/static/…` paths from the design-imagery skill. Do not paste long-lived signed URLs into committed source.

## Restormel prompt template (neo-brutalist v3)

Append style discipline to every imagine prompt:

```text
Editorial product marketing still, neo-brutalist technical brand,
warm cream paper background #F3EAD0, sharp black ink outlines #0C0C0C,
small accent of electric yellow #FFD600 and blueprint blue #1A3F8A only,
flat graphic design not photorealistic faces, no logos no text no watermarks,
high contrast, minimal composition, generous negative space,
professional developer tools aesthetic --ar 16:9 --style raw
```

Adjust `--ar`:

| Use | Aspect |
|-----|--------|
| Hero / landing | `16:9` or `3:2` |
| OG / social | `1200:630` (or `40:21` closest MJ supports) |
| Square card | `1:1` |

**Negative prompt habits:** no stock photo clichés, no purple gradients, no 3D glassmorphism, no fake UI screenshots with readable lies.

## Subscription note (tell the user when relevant)

MCP calls bill **AceDataCloud API credits**, not the user’s midjourney.com subscription hours. For subscription-only usage: generate on midjourney.com, download, and place files under `static/` manually.

## Security

- Never commit `ACEDATA_MIDJOURNEY_API_TOKEN` or log bearer headers
- Do not include customer names, API keys, or PII in prompts
- Do not use generated vendor logos — see [restormel-third-party-brand-marks](../restormel-third-party-brand-marks/SKILL.md)

## After images land in the repo

1. Add/ update `alt` and `og:image` in the relevant `+layout.svelte` or page
2. Run `pnpm --filter dashboard run check`
3. Mention [design-system-index.md](../../../docs/design/design-system-index.md) visual harmony checklist if the page layout changed
