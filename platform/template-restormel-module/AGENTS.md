# AGENTS.md — __MODULE_TITLE__

**Slug:** `__MODULE_SLUG__` · **URL path:** `/__MODULE_PATH__` on `restormel.dev` (when deployed).

## Stack

Follow [Restormel module default stack](https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/restormel-module-default-stack.md) (pnpm 9, Node 20, SvelteKit 2, Vercel, `@restormel/keys-tokens`).

## Security

- No committed secrets. Use obvious placeholders in env files. Align with the Keys [security baseline](https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/security-baseline.md) for redaction and trust boundaries.

## CI

- Workflow: `.github/workflows/ci.yml` — pnpm install composite, `pnpm run check`, `pnpm run build`.

## Suite vs restormel-platform

- **Tokens** ship from [restormel-platform](https://github.com/Allotment-Technology-Ltd/restormel-platform) as **`@restormel/keys-tokens`** on npm. This app depends on **`^0.1.0`** in `apps/web/package.json` unless you used a local **`file:`** pin (e.g. init with `--platform-repo`).
- **Cursor:** [.cursor/rules/09-suite-vs-platform-boundary.mdc](.cursor/rules/09-suite-vs-platform-boundary.mdc) and [.cursor/skills/restormel-suite-vs-platform/SKILL.md](.cursor/skills/restormel-suite-vs-platform/SKILL.md).

## Cursor

- Rules under `.cursor/rules/` (from Restormel platform template). Add more `.cursor/skills/` and symlink under `.agents/skills/` per `08-project-skills.mdc` when you add skills.
