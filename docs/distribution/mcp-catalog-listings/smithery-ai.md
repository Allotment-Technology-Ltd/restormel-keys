---
title: MCP catalog listing — Smithery.ai
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-11
last-reviewed: 2026-06-13
review-interval: P12M
---

# MCP catalog listing — Smithery.ai

**Target registry URL:** https://smithery.ai (submit via https://smithery.ai/submit or the deploy-to-Smithery flow)
**Prepared by:** Stage 4.2 (DO NOT SUBMIT — human review required before any external submission)
**Status:** DRAFT — Smithery requires a `smithery.yaml` config file in the repo; verify current requirements at https://smithery.ai/docs before adding the file

---

## How Smithery ingests servers

Smithery.ai discovers MCP servers via a `smithery.yaml` file in the GitHub repository root. It also provides a hosted-run capability (so users can run the server via Smithery's infrastructure rather than `npx`). The listing below covers the metadata needed for discovery; a `smithery.yaml` file addition to the repo is a separate task.

**Decision for Stage 4.2:** Prepare the listing metadata here. The `smithery.yaml` file is documented below but NOT added to the repo in this PR — it requires a security review (Smithery hosted-run exposes config to Smithery's infrastructure). Add it in a follow-up after the security review clears.

## smithery.yaml contents (NOT yet in repo — pending security review)

```yaml
# smithery.yaml — place in the monorepo root when approved
name: restormel-verified-context
description: >
  Evidence-bound knowledge-graph retrieval with verification state, source citations,
  and provenance traces on every result. Two modes: strict (supported-only) and
  annotated (all states labeled).
startCommand:
  type: stdio
  command: npx
  args:
    - "-y"
    - "@restormel/mcp@latest"
  configSchema:
    type: object
    required:
      - RESTORMEL_GATEWAY_KEY
      - RESTORMEL_WORKSPACE_ID
    properties:
      RESTORMEL_GATEWAY_KEY:
        type: string
        description: "Gateway key (rk_…) from your Restormel Dashboard"
      RESTORMEL_CONNECT_API_BASE:
        type: string
        default: "https://restormel.dev"
        description: "Restormel Connect REST API base URL"
      RESTORMEL_WORKSPACE_ID:
        type: string
        description: "Workspace UUID from the Connect hub"
```

## Listing metadata

| Field | Value |
|-------|-------|
| **Name** | Restormel Verified Context |
| **npm package** | `@restormel/mcp` |
| **Repository** | https://github.com/Allotment-Technology-Ltd/restormel-keys |
| **Homepage** | https://restormel.dev/keys/docs/guides/mcp-verified-context |
| **License** | MIT |
| **Tags** | knowledge-graph, rag, verification, citations, provenance |

## Short description

Retrieve verified-claim envelopes from a Restormel Connect knowledge graph. Evidence-bound, citation-grounded, provenance-traced — every result the agent can cite with confidence.

## Claims provenance

All quality/verification language is limited to proven rows in `docs/product/verified-context-claims-ledger.md`:
- "evidence-bound" — row 2 (proven)
- "verified-claim envelopes" — row 4, 7 (proven)

## Submission steps (for the human submitting)

1. Complete the security review of the `smithery.yaml` above (Smithery hosted-run trust boundary).
2. Add `smithery.yaml` to the repository root (separate PR with security review).
3. Push the tag that triggers npm publish (`platform-v*` for this package — confirm tag pattern).
4. Smithery should auto-discover the repo via the YAML file. If not, submit manually at https://smithery.ai/submit.
5. Record the resulting listing URL: _TBD_
6. **Do not add `smithery.yaml` or submit until the security review clears.**
