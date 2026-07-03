# @restormel/doctor

Restormel Doctor is an **open-source** CLI that checks your local setup and surfaces actionable “what to fix next” issues. It is designed to be the **entrypoint** into the Restormel Platform.

## Install

```bash
npx @restormel/doctor
```

Or install globally / in a repo:

```bash
pnpm add -D @restormel/doctor
```

## Usage

```bash
restormel-doctor
```

### Repo scan (best-effort)

```bash
restormel-doctor --repo
```

### Manifest output (CI-stable inventory)

```bash
restormel-doctor --repo --manifest-out restormel.doctor.manifest.json
```

### Output formats

- **Text (default)**:

```bash
restormel-doctor
```

- **JSON (for CI/artifacts)**:

```bash
restormel-doctor --format json
restormel-doctor --format json --out doctor.json
```

### Exit codes

- `0`: no blocking issues found
- `1`: blocking issues found
- `2`: usage/config error (unexpected failure)

## What it checks (v1)

- Framework detection (Next.js / React / SvelteKit / Astro)
- `restormel.config.json` presence + parseability
- **Core:** `@restormel/keys` must be installed (exit **non-zero** if missing)
- **Optional UI (Phase 5):** `@restormel/keys-svelte` / `keys-react` / `keys-elements` — **warning only** if missing (headless Phases 1–4 still pass)
- Local key store presence (keys are never printed raw)

## Relationship to Restormel Keys

- `@restormel/doctor` is standalone and open source.
- Restormel Keys (dashboard) will expose a **Pro** Healthcheck UI that aggregates Doctor + Validate signals across integrations, models, routes, and policies.

