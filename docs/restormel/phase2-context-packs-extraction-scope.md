# Phase 2 — context packs extraction (scope)

**Canonical package:** `@restormel/context-packs` in **`packages/context-packs`**.

## API contract

- **Input:** `ContextPackRetrievalInput` — `claims`, `relations`, `arguments`, `seed_claim_ids`. Structurally the same portable slice SOPHIA documents in `contextPackRetrieval.ts`. A full SOPHIA `RetrievalResult` remains valid **structurally** when narrowed or adapted; **`engine.ts` does not need to change shape** — only the call site passes the portable input.
- **Function:** `buildPassSpecificContextPacks(input, options?)` with `options.depthMode?: 'quick' | 'standard' | 'deep'`.
- **Exports (stable):** `buildPassSpecificContextPacks`, `ContextPackPass`, `ContextPackRole`, `ContextPackStats`, `ContextPack`, `PassSpecificContextPacks`, `ContextPackRetrievalInput`, `ContextPackClaim`, `ContextPackRelation`, `ContextPackArgument`.
- **Arguments:** `ContextPackArgument` supports optional `key_premises` and `conclusion_text` so scoring matches SOPHIA retrieved arguments.

## Parity tests

- Port `src/lib/server/contextPacks.test.ts` from SOPHIA into the package.
- CI must run `pnpm --filter @restormel/context-packs test` on every PR touching `packages/context-packs/**` (covered by the main **code** path filter and the platform job).
- Dropping the SOPHIA fixture JSON into the Keys test (portable subset) should preserve assertions: claim counts, role inequalities, tension stats, `CLAIM [c:001]` substring, token cap under **quick** depth.

## Documentation requirements (before first publish)

| Deliverable | Content |
|-------------|---------|
| `README.md` | Problem statement; minimal example; types; note SOPHIA maps `RetrievalResult` via `contextPackInputFromRetrieval` (reference only). |
| `CHANGELOG.md` | Semver policy; classify token budget / output format changes. |
| `package.json` exports | Document supported import paths; ESM + types. |
| TSDoc | Especially `ContextPackStats` (`reply_chain_count`, `unresolved_tension_count`, `role_counts`, …). |
| Release notes | Version; breaking vs additive; link here for integrators. |

## OpenAPI

Not applicable for v0 (library only). A future Cloud API that returns packs must be documented in Restormel Keys OpenAPI **upstream first** for SOPHIA.

## Non-goals

- Do not port `retrieval.ts`, `engine.ts`, or SSE handlers into this package.
- Do not add Zod unless required for an external API; internal types stay TypeScript-only.
- Do not merge into `@restormel/graph-reasoning-extensions` — keep context packing separate from reasoning-object compare/eval.

## Non-goals (dependencies)

- No imports from SOPHIA, Surreal, or `@restormel/contracts` in v0.
- No Node-only APIs — safe for browser bundling.
