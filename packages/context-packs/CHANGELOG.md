# Changelog

All notable changes to `@restormel/context-packs` are documented here.

## Semver policy

- **MAJOR:** Breaking changes to function signatures, exported type shapes, or materially different selection/rendering behaviour that would change consumer prompts or tests.
- **MINOR:** Additive exports, new optional fields on input types, or backward-compatible stats fields.
- **PATCH:** Bug fixes that restore documented behaviour; documentation-only releases use PATCH when the npm tarball is republished for README fixes.

**Classify explicitly in release notes:**

- Changes to **token budget tables** (`quick` / `standard` / `deep` per pass) → treat as **MINOR** unless consumers relied on exact numbers (then MAJOR).
- Changes to **output text format** (headers, claim line shape, synthesis signals) → **MINOR** if stats stay consistent; **MAJOR** if integrators parse blocks.

## 0.1.0

- Initial publish from Restormel Keys monorepo: `buildPassSpecificContextPacks` on `ContextPackRetrievalInput` only; parity with SOPHIA `contextPacks.ts` behaviour and tests.
- Optional `key_premises` / `conclusion_text` on `ContextPackArgument` for argument ranking (aligned with SOPHIA retrieval arguments).
