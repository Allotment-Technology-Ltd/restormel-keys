# Cursor and agents — new Restormel product repo

Use this when creating a **new** git repository (e.g. `restormel-testing`) so Cursor picks up shared rules and skills.

## 1. Copy or link the template

From **`cursor-template/`** in this platform tree:

1. Copy `.cursor/rules/*.mdc` into your product repo’s **`.cursor/rules/`** (or merge with product-specific rules such as bootstrap gates and dogfood runbooks).
2. Add **`.cursor/skills/<kebab-name>/SKILL.md`** for product-specific skills; set frontmatter `name` to match the folder name.
3. Mirror skills for Cursor’s alternate path: create **`.agents/skills/`** with **symlinks** to `../../.cursor/skills/<same-name>` (same pattern as Restormel Keys).

## 2. Submodule vs copy

| Approach | Pros | Cons |
|----------|------|------|
| **Git submodule** (`vendor/restormel-platform`) + symlinks from `.cursor/rules` into submodule | Single upstream update | Clone/init friction, path discipline |
| **Copy on upgrade** | Simple, no submodule | Manual sync when platform rules change |

For a solo maintainer, **copy** the template when bootstrapping a repo; re-copy selected rules when the platform version bumps.

## 3. Open the right folder in Cursor

Open the **product repository root** as the workspace so project rules apply. Multi-root workspaces split `.cursor` per root; prefer a **single root** per app unless you have a deliberate polyglot layout.

## 4. `AGENTS.md`

Add **`AGENTS.md`** at the product repo root: point to your canonical **security baseline**, **design tokens** package version (`@restormel/keys-tokens`), and how **CI** is triggered (workflow names, required secrets names only — no values).

## 5. Default stack for new modules

Before scaffolding app code, align with **[docs/architecture/restormel-module-default-stack.md](../../docs/architecture/restormel-module-default-stack.md)** (pnpm, Node 20, SvelteKit default; Next or Python as documented variants). Use the **Initiation prompt** block in that doc for Cursor or ChatGPT.

## 6. Product-specific rules

Keep **Keys-only** rules (bootstrap phase gates, dogfood relay, npm publish tags) in the Keys repo. Suite-wide expectations (security, doc governance, UX safety) belong in this template or in a thin wrapper rule that links to shared docs.
