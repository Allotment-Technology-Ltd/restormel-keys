# MCP catalog distribution listings

**Stage:** 4.2 — prepared but not submitted (per product-owner PREPARE ONLY constraint).

This directory holds one file per MCP registry/catalog, each containing:
- The target registry URL and submission method.
- All required metadata fields filled in.
- Step-by-step submission instructions for a human.
- Claims provenance: every quality/verification phrase maps to a proven row in
  `docs/verified-context-claims-ledger.md`.

## Catalogs covered

| File | Registry | Method |
|------|----------|--------|
| `mcp-so.md` | [mcp.so](https://mcp.so) | Web form at mcp.so/submit |
| `awesome-mcp-servers.md` | [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) | GitHub PR to the awesome list |
| `glama-ai.md` | [Glama.ai MCP Hub](https://glama.ai/mcp/servers) | Auto-import from npm + optional manual form |
| `smithery-ai.md` | [Smithery.ai](https://smithery.ai) | `smithery.yaml` in repo root + auto-discovery (security review required first) |

## Before submitting any listing

1. Confirm `@restormel/mcp` is published on npm at the version being cited.
2. Confirm the quickstart at https://restormel.dev/keys/docs/guides/mcp-verified-context is live.
3. Read the individual file's submission steps — each registry has its own format.
4. Do a marketing-copy review: every quality phrase must map to a `proven` row in
   `docs/verified-context-claims-ledger.md`. If a row was flipped to `broken` since this
   file was written, the phrase must be weakened or removed before submitting.
5. Never include credentials or internal infrastructure URLs in external submissions.

## Claims integrity rule

Per the Stage 4.2 scope contract and `docs/verified-context-pivot-roadmap.md`:
> Stage 4.2 marketing copy may only use rows marked **proven**.

The distribution copy in each listing file is scoped to:
- Row 2: "Every supported claim is backed by a verbatim quote you can check yourself" — **proven**
- Row 4: "Unsupported claims are excluded, not blended" — **proven**
- Row 7: "Every claim carries a provenance trace" — **proven**
