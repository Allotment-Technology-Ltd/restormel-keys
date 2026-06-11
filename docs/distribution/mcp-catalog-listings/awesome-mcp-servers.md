# MCP catalog listing — awesome-mcp-servers (GitHub)

**Target registry URL:** https://github.com/punkpeye/awesome-mcp-servers (the canonical community-maintained awesome list for MCP servers)
**Prepared by:** Stage 4.2 (DO NOT SUBMIT — human review required before any external submission)
**Status:** DRAFT — verify current list format (table vs bullet, categories used) before opening the PR

---

## Submission method

Open a pull request against `punkpeye/awesome-mcp-servers` adding a row to the appropriate category table.

Before opening: read the repo's `CONTRIBUTING.md` or `README.md` for current submission requirements — format has changed before. The row format below is based on the list's typical table columns.

## Category to add to

**Knowledge & Memory** (or the nearest equivalent; check current headings in the README)

## Row to add

| Name | Description | Transport | Language |
|------|-------------|-----------|----------|
| [Restormel Verified Context](https://github.com/Allotment-Technology-Ltd/restormel-keys/tree/main/packages/mcp) | Evidence-bound knowledge-graph retrieval with verification state, source citations, and provenance traces on every result. Two modes: `strict` (supported-only) and `annotated` (all states). | stdio | TypeScript |

## PR title (suggested)

```
feat: add Restormel Verified Context (evidence-bound knowledge-graph retrieval)
```

## PR body (suggested)

> Adds `@restormel/mcp` to the knowledge/memory section.
>
> - **Tool:** `connect.retrieve_verified`
> - **What it does:** retrieves verified-claim envelopes from a Restormel Connect knowledge graph; each result carries the EBV verification state, a bound evidence span, source citation, and provenance trace export URL.
> - **npm:** https://www.npmjs.com/package/@restormel/mcp
> - **Docs:** https://restormel.dev/keys/docs/guides/mcp-verified-context
> - **License:** MIT

## Checklist before submitting

- [ ] `@restormel/mcp` is published on npm at the version being cited.
- [ ] The quickstart at https://restormel.dev/keys/docs/guides/mcp-verified-context is live and publicly accessible.
- [ ] You have read the awesome list's CONTRIBUTING guide and the row format matches what is currently used.
- [ ] All quality/verification phrases in the PR body cite proven ledger rows (see `docs/verified-context-claims-ledger.md`).
- [ ] No credentials or internal URLs appear in the PR body.

## Claims provenance (required before submitting)

All quality/verification language in this listing is limited to claims with proven status in `docs/verified-context-claims-ledger.md`:
- "evidence-bound" — ledger row 2 (proven)
- "verification state" — ledger row 1, 4 (proven)
- "provenance traces" — ledger row 7 (proven)
- "strict (supported-only)" — ledger row 4 (proven)
