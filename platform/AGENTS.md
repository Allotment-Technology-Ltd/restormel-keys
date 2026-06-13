# AGENTS.md — restormel-platform

This directory is the **Restormel platform** subtree vendored in Keys: reusable GitHub composite actions, Cursor template, and module template sources. **`@restormel/keys-tokens`** source and publish live in the **[restormel-platform](https://github.com/Allotment-Technology-Ltd/restormel-platform)** GitHub repo (not under `platform/packages/` here).

## Humans and coding agents

- **Security:** No secrets in the repo. Use obvious placeholders; follow the Restormel Keys [docs/governance/security-baseline.md](../docs/governance/security-baseline.md) when working in the monorepo checkout.
- **Tokens:** Edit and publish in **restormel-platform** (`packages/tokens`, tag `tokens-v*`, `NPM_TOKEN`). **restormel-keys** installs the package from **npm**.
- **CI composites:** `pnpm-workspace-install` and `js-security-scan` under `.github/actions/` are mirrored in the Keys repo at the monorepo root. After splitting platform to its own repo, Keys should reference `uses: <org>/restormel-platform/.github/actions/<name>@<pinned-ref>`.

## New product repository checklist

See [docs/cursor-init.md](./docs/cursor-init.md).

**Default stack** (hosting, DB, Actions, frameworks): [docs/architecture/restormel-module-default-stack.md](../docs/architecture/restormel-module-default-stack.md) in the Keys repo.
