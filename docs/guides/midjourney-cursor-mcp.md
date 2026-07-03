---
title: Midjourney via Cursor MCP (Restormel design assets)
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-05
last-reviewed: 2026-06-13
review-interval: P12M
---

# Midjourney via Cursor MCP (Restormel design assets)

**Status:** Canonical setup for agent-generated marketing and OG imagery. **Not** a substitute for the in-repo design token system — see [design-system-index.md](../design/design-system-index.md).

## Subscription vs MCP billing

| Path | Uses your Midjourney.com subscription? | Works in Cursor Agent? |
|------|----------------------------------------|-------------------------|
| [midjourney.com](https://www.midjourney.com) (Discord / web) | Yes | No — manual export only |
| AceDataCloud MCP ([`mcp-midjourney`](https://pypi.org/project/mcp-midjourney/)) | **No** — separate API credits on [platform.acedata.cloud](https://platform.acedata.cloud) | Yes |
| Cursor **GenerateImage** (built-in) | N/A | Yes — quick drafts, not Midjourney style |

Your **monthly Midjourney subscription** does not authenticate Cursor MCP tools. To use subscription time directly, generate in Midjourney, download assets, and commit under `apps/dashboard/static/` (see agent skill **restormel-design-imagery**).

## Recommended MCP: AceDataCloud hosted server

Managed endpoint (no local Python server):

- **URL:** `https://midjourney.mcp.acedata.cloud/mcp`
- **Auth:** Bearer token from AceDataCloud (not your Midjourney password)
- **Upstream:** [AceDataCloud/mcp-midjourney](https://github.com/AceDataCloud/mcp-midjourney) (MIT)

### Setup (one-time)

1. Create an API token at [platform.acedata.cloud](https://platform.acedata.cloud) (documented on their Midjourney API page).
2. Export locally (never commit):

   ```bash
   export ACEDATA_MIDJOURNEY_API_TOKEN='your-token-here'
   ```

3. Merge MCP config:
   - **Global (preferred for secrets):** `~/.cursor/mcp.json`
   - **Project template:** copy [`.cursor/mcp.json.example`](../../.cursor/mcp.json.example) and merge the `midjourney` block into your global file, or copy to `.cursor/mcp.json` (gitignored).

4. Restart Cursor. Confirm **Settings → MCP** shows `midjourney` connected.
5. Use **Agent** mode (Composer) — MCP tools are not available in plain chat.

### Security

- Do **not** commit tokens, Discord cookies, or generated URLs with embedded secrets.
- Do **not** log MCP request/response bodies in app code.
- Store only **finished** images in `apps/dashboard/static/`; redact prompts that contain customer data.

## Agent skills (this repo)

| Skill | When |
|-------|------|
| [restormel-design-imagery](../../.cursor/skills/restormel-design-imagery/SKILL.md) | Hero/OG/marketing visuals, asset routing (SVG vs raster vs MCP) |
| [restormel-midjourney-mcp](../../.cursor/skills/restormel-midjourney-mcp/SKILL.md) | Calling Midjourney MCP tools, prompts, export paths |
| [restormel-product-flow-diagrams](../../.cursor/skills/restormel-product-flow-diagrams/SKILL.md) | Inline SVG diagrams — **no** Midjourney |
| [restormel-third-party-brand-marks](../../.cursor/skills/restormel-third-party-brand-marks/SKILL.md) | Vendor logos — **no** Midjourney |

## Alternatives

- **Vinkius-hosted MCP** — another hosted bridge; requires a Vinkius account ([overview](https://vinkius.com/apps/midjourney-ai-generative-image-arts-mcp/with/cursor)). Same billing separation from your Midjourney subscription.
- **Manual workflow** — use subscription on midjourney.com, then optimize and commit WebP/PNG under `static/`.

## Related docs

- [DESIGN-TOKENS.md](../design/DESIGN-TOKENS.md) — neo-brutalist palette for prompts
- [third-party-brand-marks.md](./third-party-brand-marks.md) — logos (not generative)
- [security-baseline.md](../governance/security-baseline.md) — secrets and logging
