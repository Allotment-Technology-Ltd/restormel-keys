---
name: restormel-keys-vs-platform
description: >-
  Decides whether work belongs in restormel-keys (Keys product) or restormel-platform (suite-wide npm tokens,
  GitHub composite actions, cursor-template, template-restormel-module). Use when changing design tokens or
  @restormel/keys-tokens, adding --rm-* CSS variables, publishing keys-tokens, editing suite-default CI composites,
  scaffolding new Restormel modules, syncing platform/ mirror vs canonical platform repo, or when unsure “Keys only
  vs shared across modules”.
---

# Restormel Keys vs restormel-platform

**Canonical boundary:** read [.cursor/rules/09-keys-vs-platform-boundary.mdc](../../rules/09-keys-vs-platform-boundary.mdc) and [AGENTS.md](../../../AGENTS.md) (*Keys vs restormel-platform*).

## Repos

| Repo | Role |
|------|------|
| **restormel-keys** (this workspace) | Keys product: `@restormel/keys`, dashboard, `aaif`, `mcp`, Keys docs, dogfood, publish **`keys-v*`** |
| **[restormel-platform](https://github.com/Allotment-Technology-Ltd/restormel-platform)** | Suite-wide: **`@restormel/keys-tokens`** (publish tag **`tokens-v*`**), default composites, **cursor-template**, **template-restormel-module** sources |

## Agent workflow

1. **Quick check:** *Would Restormel Testing (or another module) reuse this unchanged?* **Yes** → implement in **restormel-platform** (or open an issue/PR there). **No** → **restormel-keys**.
2. **Tokens:** Do **not** add or edit token **source** in restormel-keys. Edit the tokens package in **restormel-platform**, publish a new npm version, then bump **`apps/dashboard`** dependency on `@restormel/keys-tokens` and align [docs/design-tokens.css](../../../docs/design-tokens.css) if values changed.
3. **Vendored `platform/` in keys:** Composites and template sources are a **mirror**. Suite-wide changes should be reflected in **restormel-platform** so the template repo and other modules do not drift.
4. **If the user opened the wrong repo:** Say so clearly; do not duplicate token definitions in keys.

## Security

No secrets in skills or commits. Token publish uses GitHub Actions secrets in the **platform** repo, not hard-coded credentials.
