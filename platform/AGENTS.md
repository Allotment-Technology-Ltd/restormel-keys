# AGENTS.md — restormel-platform

This directory is the **Restormel platform** subtree: design tokens (`@restormel/keys-tokens`), reusable GitHub composite actions, and Cursor template files for new product repos.

## Humans and coding agents

- **Security:** No secrets in the repo. Use obvious placeholders; follow the Restormel Keys [docs/security-baseline.md](../docs/security-baseline.md) when working in the monorepo checkout.
- **Tokens:** Source lives in `packages/tokens`. Publish with Git tag `tokens-v*` and workflow `publish-tokens.yml` after this tree is pushed to its own GitHub repository with `NPM_TOKEN` configured.
- **CI composites:** `pnpm-workspace-install` and `js-security-scan` under `.github/actions/` are mirrored in the Keys repo at the monorepo root. After splitting platform to its own repo, Keys should reference `uses: <org>/restormel-platform/.github/actions/<name>@<pinned-ref>`.

## New product repository checklist

See [docs/cursor-init.md](./docs/cursor-init.md).

**Default stack** (hosting, DB, Actions, frameworks): [docs/restormel-module-default-stack.md](../docs/restormel-module-default-stack.md) in the Keys repo.
