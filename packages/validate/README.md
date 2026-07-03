# @restormel/validate

Restormel Validate is an **open-source** CLI for validating provider credentials and configuration. It is designed to be CI-friendly and to act as an **entrypoint** into the Restormel Platform.

## Install

```bash
npx @restormel/validate
```

Or install in a repo:

```bash
pnpm add -D @restormel/validate
```

## Usage

```bash
restormel-validate
```

### Output formats

```bash
restormel-validate --format json
restormel-validate --format json --out validate.json
```

### Modes / CI behavior

- Default behavior is CI-friendly: **exit 1** if any known-provider key is invalid.\n- Use `--fail-on warn` or `--fail-on none` to relax gating.\n- Use `--strict` as a preset for CI (fail on invalid).

### Retries and timeouts

```bash
restormel-validate --retries 2 --timeout-ms 8000
```

## Exit codes

- `0`: all checks passed (or failures suppressed by `--fail-on none`)\n+- `1`: invalid findings (or warnings treated as failures via `--fail-on warn`)\n+- `2`: usage/config error (bad CLI usage or unexpected failure)\n+- `3`: transient failures only (timeouts, rate limits, 5xx) — no confirmed invalid keys

## When to use which CLI

- Prefer **`@restormel/validate`** in CI and automation (works standalone, stable exit codes).\n
- If you’re already using Keys onboarding tooling, use **`@restormel/keys-cli validate`** as a wrapper that delegates to this CLI.

