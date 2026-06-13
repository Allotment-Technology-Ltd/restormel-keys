# MCP catalog listing — Glama.ai MCP Hub

**Target registry URL:** https://glama.ai/mcp/servers (submit via https://glama.ai/mcp/servers/submit or the GitHub-linked auto-import)
**Prepared by:** Stage 4.2 (DO NOT SUBMIT — human review required before any external submission)
**Status:** DRAFT — Glama auto-imports from npm; verify the auto-import path before a manual submission attempt

---

## How Glama.ai ingests servers

Glama.ai typically auto-discovers MCP servers from npm packages that include `mcp` in their keywords and have a valid `bin` entry. Because `@restormel/mcp` already satisfies both conditions, it may already be partially listed. Check https://glama.ai/mcp/servers?q=restormel before submitting manually.

If the server is not listed or the description is incomplete, submit via the form at https://glama.ai/mcp/servers/submit with the metadata below.

## Metadata fields

| Field | Value |
|-------|-------|
| **Name** | Restormel Verified Context |
| **npm package** | `@restormel/mcp` |
| **Homepage** | https://restormel.dev/keys/docs/guides/mcp-verified-context |
| **GitHub** | https://github.com/Allotment-Technology-Ltd/restormel-keys |
| **Transport** | stdio |
| **License** | MIT |
| **Tags / categories** | knowledge-retrieval, rag, verification, citations, provenance, trust |

## Short description (≤ 200 chars)

Retrieve citation-grounded, evidence-bound context from a knowledge graph. Every claim carries its verification state, a verbatim evidence quote, source citation, and a provenance trace URL.

## Long description

`@restormel/mcp` exposes the `connect.retrieve_verified` tool — verified-claim envelope retrieval from a Restormel Connect knowledge graph. Two modes:

- **strict** (default): only `supported` claims (evidence-bound and entailed by a cross-model judge). Safe to present as verified facts.
- **annotated**: all claims with explicit state (`supported | inferred | unverified | contradicted | excluded`). Non-supported claims are labeled, never blended.

Every result includes: the claim text, its EBV verification state, a bound evidence span (verbatim quote + character offsets + source-version SHA-256 hash), entailment judge attribution, source citation, and a provenance trace export URL for auditors.

The tool instructs the calling agent on citing rules: quote from `evidence[].quote`, attribute to `citation`, link `trace_export_url` as the audit trail.

Quick start: `keys init --mcp --mcp-client claude-code` (requires `@restormel/keys` installed globally).

## Claims provenance

All quality/verification language in this listing is limited to proven rows in `docs/product/verified-context-claims-ledger.md`:
- "evidence-bound" — row 2 (proven)
- "supported claims only in strict mode" — row 4 (proven)
- "provenance trace export URL" — row 7 (proven)

## Submission steps (for the human submitting)

1. Check https://glama.ai/mcp/servers?q=restormel — if listed and complete, no action needed; record the URL below.
2. If missing or incomplete, go to https://glama.ai/mcp/servers/submit.
3. Fill in the fields above.
4. Record the resulting listing URL: _TBD_
5. **Do not submit until a marketing-copy review has been done against the ledger.**
