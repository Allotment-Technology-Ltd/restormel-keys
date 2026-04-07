# AGENTS.md — __MODULE_TITLE__

**Slug:** `__MODULE_SLUG__` · **URL path:** `/__MODULE_PATH__` on `restormel.dev` (when deployed).

## Stack

Follow [Restormel module default stack](https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/restormel-module-default-stack.md) (pnpm 9, Node 20, SvelteKit 2, Vercel, `@restormel/keys-tokens`).

## Security

- No committed secrets. Use obvious placeholders in env files. Align with the Keys [security baseline](https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/security-baseline.md) for redaction and trust boundaries.

## CI

- Workflow: `.github/workflows/ci.yml` — pnpm install composite, `pnpm run check`, `pnpm run build`.

## Cursor

- Rules under `.cursor/rules/` (from Restormel platform template). Add `.cursor/skills/` and symlink `.agents/skills/` per `08-project-skills.mdc` when you add skills.
