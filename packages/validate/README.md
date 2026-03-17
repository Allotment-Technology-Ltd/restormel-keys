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

## Exit codes

- `0`: all checks passed\n- `1`: failed checks (per `--fail-on` policy)\n- `2`: usage/config error (unexpected failure)

