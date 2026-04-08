---
name: restormel-keys-vs-platform
description: >-
  Decides whether work belongs in repo-root packages/apps vs the vendored platform/ mirror (templates, scaffold
  composites). Use when changing design tokens or @restormel/keys-tokens, editing suite-default CI composites for
  templates, scaffolding new external Restormel modules, or when unsure “product vs template mirror”.
---

# Restormel monorepo vs `platform/` mirror

**Canonical boundary:** read [.cursor/rules/09-keys-vs-platform-boundary.mdc](../../rules/09-keys-vs-platform-boundary.mdc) and [AGENTS.md](../../../AGENTS.md).

## Layout

| Location | Role |
|----------|------|
| **`packages/keys-tokens`**, **`packages/*`**, **`apps/*`**, **`docs/`** | Product: Keys, Testing (`@restormel/testing-*`), tokens **source**, dashboard, testing-web |
| **`platform/`** | Vendored **template** + composite **mirror** for repos scaffolded from the module template |

## Agent workflow

1. **Tokens:** Edit **`packages/keys-tokens`**. Publish with tag **`tokens-v*`** (see `.github/workflows/publish-keys-tokens.yml`). Keep [docs/design-tokens.css](../../../docs/design-tokens.css) aligned when values change.
2. **Templates / external scaffold parity:** If a change must apply to **new repos** cut from the template, update **`platform/template-restormel-module/`** (and `platform/.github/actions/` if composites are part of that story) alongside root `.github/actions/` where they are duplicated.
3. **Do not** treat a separate **restormel-platform** GitHub repo as canonical for tokens; this repo owns **`@restormel/keys-tokens`** source.

## Security

No secrets in skills or commits. Publishing uses repository **NPM_TOKEN** (or OIDC if you adopt it), never hard-coded credentials.
