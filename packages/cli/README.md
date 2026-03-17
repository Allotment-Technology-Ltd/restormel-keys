# @restormel/keys-cli

CLI for Restormel Keys: reduce setup friction for Next.js, React, SvelteKit, and Astro.

## Install

```bash
pnpm add -D @restormel/keys-cli
# or
npx @restormel/doctor
```

## Commands

| Command | Description |
|--------|-------------|
| `keys init` | Detect framework, generate config, suggest packages |
| `keys add <provider>` | Prompt for API key, validate, store (openai \| anthropic \| google) |
| `keys list` | Show stored keys (masked) |
| `keys validate` | Wrapper for `restormel-validate` (exit 1 if invalid — CI-friendly) |
| `keys doctor` | Wrapper for `restormel-doctor` (setup/health checks) |
| `keys estimate <model> --input <n> --output <n>` | Cost estimate for a model |

## Config and storage

- **Config** (`restormel.config.json`): framework and provider list only — **no secrets**.
- **Key store** (`.restormel/key-store.json`): holds API keys for local use. Add `.restormel/` to `.gitignore`; never commit.

## Gate

In a fresh Next.js (App Router) project, `npx @restormel/doctor` should run and report framework and package status. Run `keys init` first to create config; then `restormel-doctor` exits 0 when setup is OK.
