# @restormel/keys-cli

CLI for Restormel Keys: reduce setup friction for Next.js, React, SvelteKit, and Astro.

## Install

Use current npm release (**≥0.1.4** for `keys patch` + `@restormel/keys@0.2.7` train; latest trains with core/doctor/validate). **v0.1.0** had broken deps.

```bash
pnpm add -D @restormel/keys-cli
```

If you only need checks (no Keys scaffolding), use the standalone wedge CLIs:

```bash
npx @restormel/doctor
npx @restormel/validate
```

## Commands

| Command | Description |
|--------|-------------|
| `keys init` | Detect framework, generate config, suggest packages |
| `keys add <provider>` | Prompt for API key, validate, store (openai \| anthropic \| google) |
| `keys list` | Show stored keys (masked) |
| `keys validate` | Wrapper for `restormel-validate` (exit 1 if invalid — CI-friendly) |
| `keys doctor [--report]` | Wrapper for `restormel-doctor` (setup/health checks); `--report` prints a pre-filled GitHub issue URL when checks fail |
| `keys estimate <model> --input <n> --output <n>` | Cost estimate for a model |
| `keys login` | Device login: browser-approved Gateway key in the terminal (OAuth-style device flow) |
| `keys patch` | One-command patch upgrade for installed Restormel packages + optional catalog verification |
| `keys catalog fetch` | Fetch public `GET /keys/dashboard/api/catalog` (summary or `--json`; optional `--base-url`, paging, `--include-unhealthy`, `--skip-allowlist`) |

### Canonical catalog (public feed)

Verify connectivity and inspect contract version (uses `RESTORMEL_KEYS_BASE` or `https://restormel.dev`):

```bash
npx @restormel/keys-cli catalog fetch
npx @restormel/keys-cli catalog fetch --json | jq .contractVersion
```

### One-command patch upgrades

```bash
npx @restormel/keys-cli patch
```

This command detects your package manager, updates installed `@restormel/*` packages to latest patch-compatible versions, and verifies the canonical provider/model catalog endpoint (`/keys/dashboard/api/catalog`) when possible.

- In **pnpm workspaces**, running from the workspace root uses a recursive upgrade (`pnpm up -r`) so you do not hit root add checks.
- If you prefer a preview first, use `npx @restormel/keys-cli patch --dry-run`.

## Config and storage

- **Config** (`restormel.config.json`): framework and provider list only — **no secrets**.
- **Key store** (`.restormel/key-store.json`): holds API keys for local use. Add `.restormel/` to `.gitignore`; never commit.

## Gate

In a fresh Next.js (App Router) project, `npx @restormel/doctor` should run and report framework and package status. Run `keys init` first to create config; then `restormel-doctor` exits 0 when setup is OK.
