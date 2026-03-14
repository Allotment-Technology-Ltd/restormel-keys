# @restormel/keys-cli

CLI for Restormel Keys: reduce setup friction for Next.js, React, SvelteKit, and Astro.

## Install

```bash
pnpm add -D @restormel/keys-cli
# or
npx @restormel/keys-cli doctor
```

## Commands

| Command | Description |
|--------|-------------|
| `keys init` | Detect framework, generate config, suggest packages |
| `keys add <provider>` | Prompt for API key, validate, store (openai \| anthropic \| google) |
| `keys list` | Show stored keys (masked) |
| `keys validate` | Re-validate all keys; exit 1 if any invalid (CI-friendly) |
| `keys doctor` | Check framework, packages, config, key health |
| `keys estimate <model> --input <n> --output <n>` | Cost estimate for a model |

## Config and storage

- **Config** (`restormel.config.json`): framework and provider list only — **no secrets**.
- **Key store** (`.restormel/key-store.json`): holds API keys for local use. Add `.restormel/` to `.gitignore`; never commit.

## Gate

In a fresh Next.js (App Router) project, `npx @restormel/keys-cli doctor` should run and report framework and package status. Run `keys init` first to create config; then `keys doctor` exits 0 when setup is OK.
