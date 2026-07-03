---
name: restormel-suite-vs-platform
description: >-
  Decides whether work belongs in this Restormel module repo or restormel-platform (npm @restormel/keys-tokens
  source, suite GitHub composites, cursor-template, template-restormel-module). Use when changing design tokens,
  adding --rm-* variables, publishing keys-tokens, editing shared CI composites, or asking “module only vs suite-wide”.
---

# Restormel module vs restormel-platform

**Canonical boundary:** [.cursor/rules/09-suite-vs-platform-boundary.mdc](../../rules/09-suite-vs-platform-boundary.mdc) and [AGENTS.md](../../../AGENTS.md) (*Suite vs restormel-platform*).

## Repos

| Repo | Role |
|------|------|
| **This repo** | This module’s product surface, app package(s), module CI |
| **[restormel-platform](https://github.com/Allotment-Technology-Ltd/restormel-platform)** | **`@restormel/keys-tokens`** (`tokens-v*`), default composites, **cursor-template**, **template-restormel-module** |

## Agent workflow

1. **Quick check:** *Would another module reuse this unchanged?* **Yes** → **restormel-platform** (PR/issue there). **No** → **this repo**.
2. **Tokens:** Edit token **source** only in **restormel-platform**; bump **`@restormel/keys-tokens`** here after publish.
3. **Wrong repo:** Say so; do not duplicate token package source in this module.

## Security

No secrets in commits. Token publish uses GitHub Actions secrets on **restormel-platform**.
