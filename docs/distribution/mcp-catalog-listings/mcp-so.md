# MCP catalog listing — mcp.so

**Target registry URL:** https://mcp.so/submit (or https://mcp.so/servers — choose "Submit a server")
**Prepared by:** Stage 4.2 (DO NOT SUBMIT — human review required before any external submission)
**Status:** DRAFT — fill in live package version and verify metadata fields before submitting

---

## Required metadata fields

| Field | Value |
|-------|-------|
| **Name** | Restormel Verified Context |
| **Package / npm name** | `@restormel/mcp` |
| **npm URL** | https://www.npmjs.com/package/@restormel/mcp |
| **GitHub source** | https://github.com/Allotment-Technology-Ltd/restormel-keys |
| **Homepage / docs** | https://restormel.dev/keys/docs/guides/mcp-verified-context |
| **License** | MIT |
| **Version** | _fill in latest published version before submitting_ |
| **Transport** | stdio |
| **Categories** | knowledge-retrieval, rag, verification, citations, provenance |

## Short description (≤ 160 chars)

Retrieve citation-grounded, evidence-bound context from a Restormel Connect knowledge graph. Every claim is verified against its source — provenance trace included.

## Long description

Restormel Verified Context is an MCP tool that surfaces provably trustworthy knowledge-graph context directly inside Claude Code, Claude Desktop, and Cursor.

Every result from the `connect.retrieve_verified` tool is a **verified-claim envelope**: the claim text, its EBV verification state, a verbatim evidence span (quote + character offsets + source-version hash), entailment judge attribution, source citation, and a provenance trace export URL. The tool teaches the calling agent how to cite correctly — quote the evidence, attribute to the citation, link the trace.

**Two modes:**
- `strict` (default) — returns only `supported` claims, fully evidence-bound and entailed. Safe to present as verified facts.
- `annotated` — returns all claims with their state (`supported | inferred | unverified | contradicted | excluded`). Non-supported claims are present but labeled, never silently blended.

**Why this matters for regulated and high-stakes domains:** Agents built on unverified context produce hallucinations that look authoritative. Restormel's verification pipeline (Layer 1: deterministic evidence binding; Layer 2: cross-model entailment judge with abstention) means every claim the agent receives has been checked, and every claim it cannot verify is either excluded or explicitly labeled. The provenance trace answers "why did the agent say that?" — the question regulators and internal audit actually ask.

**Claims made above are from proven ledger rows (per the Stage 4.2 scope contract):**
- Row 4: "Unsupported claims are excluded, not blended" — strict mode enforced by `connect.retrieve_verified`
- Row 7: "Every claim carries a provenance trace" — `trace_export_url` on every envelope

**Quick start:**
```bash
npm install -g @restormel/mcp @restormel/keys
keys init --mcp --mcp-client claude-code
# Paste the output into ~/.claude.json, fill in your workspace ID and gateway key, restart.
```

**Required environment variables:**
- `RESTORMEL_GATEWAY_KEY` — project Gateway key (`rk_…`) from your Restormel Dashboard
- `RESTORMEL_CONNECT_API_BASE` — `https://restormel.dev` (hosted) or your self-hosted origin
- `RESTORMEL_WORKSPACE_ID` — workspace UUID from the Connect hub

## Tags / keywords

mcp, model-context-protocol, rag, knowledge-graph, verification, citations, provenance, trust, evidence, surreal, graphrag, restormel, claude, cursor, ai-safety

## Categories (select all that apply)

- Knowledge retrieval
- RAG / context retrieval
- Research & citations
- Compliance / audit

---

## Submission steps (for the human submitting)

1. Confirm `@restormel/mcp` is published at the version you are submitting (run `npm view @restormel/mcp version`).
2. Confirm the quickstart guide at https://restormel.dev/keys/docs/guides/mcp-verified-context is live.
3. Navigate to https://mcp.so/submit.
4. Fill in the fields above (copy-paste descriptions from this file).
5. Use the GitHub source URL; mcp.so may auto-populate fields from the package.json.
6. Submit and record the listing URL in this file once approved.
7. **Do not submit until a marketing-copy review confirms all quality phrases cite proven ledger rows (see `docs/verified-context-claims-ledger.md`).**
